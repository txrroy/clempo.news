import { GoogleGenAI, Type } from '@google/genai';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PIPELINE_CONFIG } from './config';
import { initFirebaseAdmin, loadActivePolicy } from './lib/firebase';
import { sleep, withGeminiRetry } from './lib/retry';
import type { ArticleDocument } from './types';

function loadAgentEnv(): void {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'agent/.env'),
    resolve(__dirname, '../../agent/.env'),
  ];
  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
    break;
  }
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function rewriteHeadline(
  ai: GoogleGenAI,
  article: ArticleDocument,
  targetWords: number,
  readingLevel: string
): Promise<string | null> {
  const maxWords = targetWords + 1;
  const prompt = [
    `Rewrite the news headline below so it is short, clear, and easy for an 11-year-old (${readingLevel} reading level) to understand.`,
    '',
    'Rules:',
    `- Strictly ${maxWords} words or fewer (aim for ${targetWords} words).`,
    '- Lead with the most recognizable actor (well-known company, country, or person) rather than niche product names, sub-brands, or jargon.',
    '- Example: prefer "Microsoft faces global service outage" over "Global outage hits Outlook and Teams".',
    '- Stick strictly to facts in the provided headline and summary. Do not invent details.',
    '- Clear, calm, neutral, G-rated language. Plain verbs. No questions, no teasers, no exclamation marks.',
    '',
    `Topic: ${article.topic}`,
    `Current Headline: ${article.ai_headline}`,
    `Summary: ${article.ai_summary}`,
  ].join('\n');

  const response = await withGeminiRetry(
    `ShortenHeadline (${article.id})`,
    () =>
      ai.models.generateContent({
        model: PIPELINE_CONFIG.geminiModel,
        contents: prompt,
        config: {
          abortSignal: AbortSignal.timeout(PIPELINE_CONFIG.llmTimeoutMs),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ai_headline: { type: Type.STRING },
            },
            required: ['ai_headline'],
          },
        },
      })
  );

  const parsed = JSON.parse(response.text || '{}') as { ai_headline?: string };
  const next = parsed.ai_headline?.trim();
  return next || null;
}

async function main() {
  loadAgentEnv();

  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const rewriteAll = args.has('--all');
  const includePending = args.has('--include-pending');
  if (args.has('--prod')) {
    delete process.env.FIRESTORE_EMULATOR_HOST;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required (set in env or agent/.env)');
  }

  const db = initFirebaseAdmin();
  const policy = await loadActivePolicy(db);
  const targetWords = policy.settings.target_headline_words || 6;
  const readingLevel = policy.settings.reading_level || 'grade 6';

  console.log(
    `Policy target_headline_words=${targetWords}, reading_level=${readingLevel}, dryRun=${dryRun}, all=${rewriteAll}`
  );

  const statuses = includePending
    ? ['published', 'pending_review']
    : ['published'];

  const snapshot = await db
    .collection('articles')
    .where('status', 'in', statuses)
    .get();

  const candidates = snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<ArticleDocument, 'id'>) }))
    .filter((a) => rewriteAll || countWords(a.ai_headline || '') > targetWords);

  console.log(
    `Found ${snapshot.size} articles (${statuses.join(', ')}); ${candidates.length} to shorten.`
  );

  const ai = new GoogleGenAI({ apiKey });
  let updated = 0;

  for (const article of candidates) {
    try {
      const nextHeadline = await rewriteHeadline(
        ai,
        article,
        targetWords,
        readingLevel
      );
      if (!nextHeadline) {
        console.warn(`[SKIP] ${article.id}: empty headline returned`);
        continue;
      }

      console.log(
        `[${dryRun ? 'DRY' : 'UPDATE'}] (${article.date}) "${article.ai_headline}" -> "${nextHeadline}"`
      );

      if (!dryRun) {
        await db.collection('articles').doc(article.id).update({
          ai_headline: nextHeadline,
          edited_at: new Date().toISOString(),
        });
      }
      updated += 1;
      await sleep(250);
    } catch (err) {
      console.error(`[ERROR] ${article.id}:`, err);
    }
  }

  console.log(`Done. ${dryRun ? 'Would update' : 'Updated'} ${updated} headlines.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
