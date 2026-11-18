import { GoogleGenAI } from '@google/genai';
import { getAuth } from 'firebase-admin/auth';
import { randomUUID } from 'node:crypto';
import {
  extractFullArticle,
  fetchRssCandidatesWithStats,
  isSameTitle,
  searchOtherOutletsForStory,
  selectTopImpactStoriesWithLog,
} from './agents/fetcher';
import { judgeArticle } from './agents/judge';
import { summarizeArticle } from './agents/summarizer';
import {
  getExistingDedupeContext,
  initFirebaseAdmin,
  loadActivePolicy,
  loadRssSources,
  saveDraftArticles,
  savePipelineRunLog,
} from './lib/firebase';
import {
  buildInstructionsSnapshot,
  DEFAULT_POLICY_SETTINGS,
} from './policy';
import type {
  ActivePolicyDoc,
  ArticleDocument,
  ArticleRetryHistoryEntry,
  DuplicateClusterGroup,
  FetchedArticle,
  PipelineTraceStep,
  PolicySettings,
  ReadingLevel,
} from './types';

try {
  process.loadEnvFile?.('agent/.env');
} catch {
  // Ignore if agent/.env does not exist
}

interface HttpRequest {
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface HttpResponse {
  status: (code: number) => HttpResponse;
  json: (payload: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  flushHeaders?: () => void;
  write?: (chunk: string) => void;
  end?: () => void;
}

const ALLOWED_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || 'txrroy@gmail.com,riteshtiwari@gmail.com,riteshtiwari.research@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

async function verifyEditorAuth(req: HttpRequest): Promise<string> {
  const authHeader = req.headers.authorization;
  const headerStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!headerStr || !headerStr.startsWith('Bearer ')) {
    throw new Error('Missing Authorization Bearer token');
  }
  const token = headerStr.slice('Bearer '.length).trim();
  initFirebaseAdmin();
  const decoded = await getAuth().verifyIdToken(token);
  const email = (decoded.email || '').toLowerCase();
  if (!email || !ALLOWED_EMAILS.has(email)) {
    throw new Error('Unauthorized editor account');
  }
  return email;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }
  return new GoogleGenAI({ apiKey });
}

async function buildFetchedFromDoc(
  doc: ArticleDocument,
  tryAlternateSource = false,
  customSourceUrl?: string
): Promise<FetchedArticle> {
  const altUrls = doc.alternate_urls || [];
  const trimmedCustom = customSourceUrl?.trim();
  const primaryLink = trimmedCustom
    ? trimmedCustom
    : tryAlternateSource && altUrls.length > 0
      ? altUrls[0]
      : doc.original_url;
  const remainingAlts = trimmedCustom
    ? [doc.original_url, ...altUrls].filter((u) => u && u !== trimmedCustom)
    : tryAlternateSource && altUrls.length > 0
      ? [...altUrls.slice(1), doc.original_url]
      : altUrls;

  const base: FetchedArticle = {
    title: doc.ai_headline,
    link: primaryLink,
    snippet: doc.ai_summary,
    source: doc.source_names?.[0] || 'Source',
    imageUrl: doc.image_url,
    source_count: doc.source_count || 1,
    source_names: doc.source_names || [],
    alternate_urls: remainingAlts,
    topic: doc.topic || 'World',
    region: doc.region || 'Global',
    tags: doc.tags && doc.tags.length > 0 ? doc.tags : [doc.topic || 'World', doc.region || 'Global'],
    sensitive: Boolean(doc.sensitive),
    reason: doc.selection_reason || '',
    fullText: trimmedCustom || tryAlternateSource ? '' : doc.source_text || '',
    usedFallbackSnippet: Boolean(doc.used_fallback_snippet),
  };

  if (
    !trimmedCustom &&
    !tryAlternateSource &&
    base.fullText.trim().length >= 100 &&
    !doc.used_fallback_snippet
  ) {
    return base;
  }

  try {
    const extracted = await extractFullArticle(base);
    if (extracted.fullText.trim().length > 0) {
      return extracted;
    }
  } catch {
    // Fall back to summary if source URL cannot be scraped live
  }

  return {
    ...base,
    fullText: doc.source_text || doc.ai_summary,
    usedFallbackSnippet: true,
  };
}

export async function handleRegenerate(
  req: HttpRequest,
  res: HttpResponse
): Promise<void> {
  const body = (req.body || {}) as {
    articleId?: string;
    readingLevel?: ReadingLevel;
    targetSummaryWords?: number;
    redirectInstructions?: string;
    tryAlternateSource?: boolean;
    customSourceUrl?: string;
    addOtherSide?: boolean;
    stream?: boolean;
  };
  const wantsStream = Boolean(body.stream);

  const emitProgress = (
    agent: string,
    message: string,
    status: 'running' | 'done' | 'warn' = 'running'
  ) => {
    if (!wantsStream) return;
    res.write?.(
      `data: ${JSON.stringify({
        type: 'progress',
        agent,
        message,
        status,
        at: new Date().toISOString(),
      })}\n\n`
    );
  };

  try {
    await verifyEditorAuth(req);

    if (!body.articleId) {
      res.status(400).json({ error: 'articleId is required' });
      return;
    }

    if (wantsStream) {
      res.setHeader?.('Content-Type', 'text/event-stream');
      res.setHeader?.('Cache-Control', 'no-cache');
      res.setHeader?.('Connection', 'keep-alive');
      res.flushHeaders?.();
    }

    const db = initFirebaseAdmin();
    const snap = await db.collection('articles').doc(body.articleId).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    const articleDoc = {
      ...(snap.data() as Omit<ArticleDocument, 'id'>),
      id: snap.id,
    };

    const ai = getGeminiClient();
    const activePolicy = await loadActivePolicy(db);
    const effectivePolicy: ActivePolicyDoc = {
      ...activePolicy,
      settings: {
        ...activePolicy.settings,
        ...(body.readingLevel ? { reading_level: body.readingLevel } : {}),
        ...(typeof body.targetSummaryWords === 'number'
          ? { target_summary_words: body.targetSummaryWords }
          : {}),
      },
    };

    const customSourceUrl = body.customSourceUrl?.trim();
    if (customSourceUrl) {
      let parsedUrl: URL | null = null;
      try {
        parsedUrl = new URL(customSourceUrl);
      } catch {
        parsedUrl = null;
      }
      if (!parsedUrl || (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')) {
        res.status(400).json({ error: 'Please provide a valid http(s) source URL.' });
        return;
      }
      emitProgress(
        'Agent 1 · Extractor',
        `Extracting full article from ${customSourceUrl}...`
      );
    } else if (body.tryAlternateSource) {
      emitProgress('Agent 1 · Extractor', 'Fetching alternate source URL...');
    }

    const fetched = await buildFetchedFromDoc(
      articleDoc,
      Boolean(body.tryAlternateSource),
      customSourceUrl
    );

    if (customSourceUrl || body.tryAlternateSource) {
      emitProgress(
        'Agent 1 · Extractor',
        fetched.usedFallbackSnippet
          ? 'Could not extract full text from that URL — using fallback snippet.'
          : `Extracted full text from ${fetched.link}`,
        fetched.usedFallbackSnippet ? 'warn' : 'done'
      );
    }

    let addedSources: { name: string; url: string }[] = [];
    let effectiveRedirect = body.redirectInstructions;

    if (body.addOtherSide) {
      emitProgress(
        'Agent 1 · Source Search',
        'Searching other outlets for opposing or additional perspectives...'
      );
      const rssSources = await loadRssSources(db);
      const externalOutlets = await searchOtherOutletsForStory({
        headline: articleDoc.ai_headline,
        originalUrl: articleDoc.original_url,
        alternateUrls: articleDoc.alternate_urls || [],
        existingSourceNames: articleDoc.source_names || [],
        sources: rssSources,
        maxOutlets: 2,
        onProgress: (msg) => emitProgress('Agent 1 · Source Search', msg),
      });

      if (externalOutlets.length > 0) {
        addedSources = externalOutlets.map((o) => ({ name: o.name, url: o.url }));
        const extraSections = externalOutlets
          .map(
            (o) =>
              `\n\n--- Additional Outlet: ${o.name} (${o.url}) ---\n${o.text}`
          )
          .join('');
        fetched.fullText = `${fetched.fullText}${extraSections}`.slice(
          0,
          14000
        );

        const mergedNames = Array.from(
          new Set([
            ...(fetched.source_names || []),
            ...externalOutlets.map((o) => o.name),
          ])
        );
        const mergedUrls = Array.from(
          new Set([
            ...(fetched.alternate_urls || []),
            ...externalOutlets.map((o) => o.url),
          ])
        );
        fetched.source_names = mergedNames;
        fetched.alternate_urls = mergedUrls;
        fetched.source_count = mergedNames.length;

        const outletNamesList = externalOutlets.map((o) => o.name).join(', ');
        emitProgress(
          'Agent 1 · Source Search',
          `Retrieved & ready to cite: ${outletNamesList}`,
          'done'
        );
        effectiveRedirect = `${body.redirectInstructions ? `${body.redirectInstructions} ` : ''}Use the additional outlet coverage retrieved (${outletNamesList}) to draft a calm, neutral sentence presenting the opposing or alternate viewpoint, and explicitly cite the outlet name (e.g., "according to ${externalOutlets[0].name}") in that sentence.`;
      } else {
        emitProgress(
          'Agent 1 · Source Search',
          'No additional external outlets matched — balancing using existing source.',
          'warn'
        );
      }
    }

    const startMs = Date.now();
    emitProgress(
      'Agent 2 · Summarizer',
      `Drafting rewrite (${effectivePolicy.settings.reading_level}, ~${effectivePolicy.settings.target_summary_words}w)...`
    );
    let regenerated = await summarizeArticle(ai, fetched, {
      policy: effectivePolicy,
      editorRedirect: effectiveRedirect,
    });

    if (!regenerated) {
      if (wantsStream) {
        res.write?.(
          `data: ${JSON.stringify({ type: 'error', error: 'Summarizer failed to regenerate draft' })}\n\n`
        );
        res.end?.();
      } else {
        res.status(502).json({ error: 'Summarizer failed to regenerate draft' });
      }
      return;
    }

    emitProgress('Agent 2 · Summarizer', 'Draft rewrite complete.', 'done');

    // Rule 1: Every regenerated draft goes through the Judge again
    emitProgress(
      'Agent 3 · Quality Judge',
      'Verifying claims, neutrality, safety, and readability...'
    );
    let judgment = await judgeArticle(ai, fetched, regenerated);

    // Fix 4: Retry "Too complex" automatically once before a human sees it
    if (
      judgment.flags.includes('TOO_COMPLEX') ||
      judgment.scores.readability < 80
    ) {
      emitProgress(
        'Agent 2 · Auto-Simplify',
        'Readability below target — simplifying wording once...',
        'warn'
      );
      const simplified = await summarizeArticle(ai, fetched, {
        policy: effectivePolicy,
        editorRedirect: `${effectiveRedirect ? `${effectiveRedirect}. ` : ''}Simplify the reading level strictly to Grade 6 or below with plain everyday words.`,
      });
      if (simplified) {
        regenerated = simplified;
        emitProgress(
          'Agent 3 · Quality Judge',
          'Re-auditing simplified draft...'
        );
        judgment = await judgeArticle(ai, fetched, regenerated);
      }
    }
    emitProgress(
      'Agent 3 · Quality Judge',
      `Verification complete (Accuracy ${judgment.scores.accuracy}, Neutrality ${judgment.scores.neutrality}).`,
      'done'
    );
    const durationMs = Date.now() - startMs;

    const instructionsSnapshot = buildInstructionsSnapshot(
      effectivePolicy,
      effectiveRedirect
    );

    const traceStep: PipelineTraceStep = {
      step: 'regenerate',
      agent: body.addOtherSide
        ? 'Agent 1 + Agent 2 + Agent 3 · Cross-Outlet Balance'
        : 'Agent 2 + Agent 3 · Live Regenerate',
      at: new Date().toISOString(),
      duration_ms: durationMs,
      status: judgment.pass ? 'ok' : 'warning',
      summary: body.addOtherSide && addedSources.length > 0
        ? `Searched & cited ${addedSources.map((s) => s.name).join(', ')}; re-audited by Judge.`
        : `Regenerated (${effectivePolicy.settings.reading_level}, ~${effectivePolicy.settings.target_summary_words}w) and re-audited by Judge.`,
      details: {
        reading_level: effectivePolicy.settings.reading_level,
        target_summary_words: effectivePolicy.settings.target_summary_words,
        accuracy: judgment.scores.accuracy,
        safety: judgment.scores.safety,
        pass: judgment.pass,
      },
    };

    const payload = {
      before: {
        ai_headline: articleDoc.ai_headline,
        ai_summary: articleDoc.ai_summary,
        ai_explanation: articleDoc.ai_explanation || '',
        scores: articleDoc.scores || {
          accuracy: articleDoc.confidence_score,
          neutrality: articleDoc.confidence_score,
          safety: articleDoc.confidence_score,
          readability: articleDoc.confidence_score,
        },
        judge_pass: articleDoc.judge_pass ?? false,
        flags: articleDoc.flags || [],
      },
      after: {
        ai_headline: regenerated.ai_headline,
        ai_summary: regenerated.ai_summary,
        ai_explanation: regenerated.ai_explanation,
        confidence_score: judgment.confidence_score,
        confidence_reasoning: judgment.reasoning,
        judge_pass: judgment.pass,
        scores: judgment.scores,
        flags: judgment.flags,
        claims: judgment.claims,
        ...(customSourceUrl || body.tryAlternateSource
          ? {
              original_url: fetched.link,
              source_text: fetched.fullText,
              alternate_urls: fetched.alternate_urls,
              used_fallback_snippet: fetched.usedFallbackSnippet,
            }
          : {}),
        ...(addedSources.length > 0
          ? {
              addedSources,
              source_text: fetched.fullText,
              source_names: fetched.source_names,
              alternate_urls: fetched.alternate_urls,
            }
          : {}),
      },
      instructionsSnapshot,
      traceStep,
    };

    if (wantsStream) {
      res.write?.(`data: ${JSON.stringify({ type: 'result', data: payload })}\n\n`);
      res.end?.();
    } else {
      res.status(200).json(payload);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Regeneration failed';
    if (wantsStream) {
      res.write?.(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
      res.end?.();
      return;
    }
    const status = message.includes('Unauthorized') || message.includes('token') ? 401 : 500;
    res.status(status).json({ error: message });
  }
}

export async function handleTestPolicy(
  req: HttpRequest,
  res: HttpResponse
): Promise<void> {
  try {
    await verifyEditorAuth(req);
    const body = (req.body || {}) as {
      settings?: Partial<PolicySettings>;
      adminInstructions?: string;
    };

    const db = initFirebaseAdmin();
    const ai = getGeminiClient();

    const candidatePolicy: ActivePolicyDoc = {
      active_version: 'preview',
      settings: {
        ...DEFAULT_POLICY_SETTINGS,
        ...(body.settings || {}),
      },
      admin_instructions: body.adminInstructions || '',
    };

    const recentSnap = await db
      .collection('articles')
      .orderBy('date', 'desc')
      .limit(8)
      .get();

    const docs = recentSnap.docs
      .map((d) => ({ ...(d.data() as Omit<ArticleDocument, 'id'>), id: d.id }))
      .sort((a, b) => (b.source_text ? 1 : 0) - (a.source_text ? 1 : 0))
      .slice(0, 2);

    if (docs.length === 0) {
      res.status(200).json({ samples: [] });
      return;
    }

    const samples = [];
    for (const doc of docs) {
      const fetched = await buildFetchedFromDoc(doc);
      const summary = await summarizeArticle(ai, fetched, {
        policy: candidatePolicy,
      });
      if (!summary) continue;

      const judgment = await judgeArticle(ai, fetched, summary);
      samples.push({
        id: doc.id,
        date: doc.date,
        originalHeadline: doc.ai_headline,
        originalSummary: doc.ai_summary,
        originalScores: doc.scores || {
          accuracy: doc.confidence_score,
          neutrality: doc.confidence_score,
          safety: doc.confidence_score,
          readability: doc.confidence_score,
        },
        candidateHeadline: summary.ai_headline,
        candidateSummary: summary.ai_summary,
        candidateScores: judgment.scores,
        candidatePass: judgment.pass,
        candidateFlags: judgment.flags,
        candidateReasoning: judgment.reasoning,
      });
    }

    res.status(200).json({ samples });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Policy test failed';
    const status = message.includes('Unauthorized') || message.includes('token') ? 401 : 500;
    res.status(status).json({ error: message });
  }
}

export async function handlePipelineStream(
  req: HttpRequest,
  res: HttpResponse
): Promise<void> {
  const sendEvent = (event: Record<string, unknown>) => {
    res.write?.(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    await verifyEditorAuth(req);
    const body = (req.body || {}) as {
      mode?: 'single-url' | 'edition';
      url?: string;
    };

    res.setHeader?.('Content-Type', 'text/event-stream');
    res.setHeader?.('Cache-Control', 'no-cache');
    res.setHeader?.('Connection', 'keep-alive');
    res.flushHeaders?.();

    const db = initFirebaseAdmin();
    const ai = getGeminiClient();
    const today = new Date().toISOString().split('T')[0];

    const [activePolicy, sources] = await Promise.all([
      loadActivePolicy(db),
      loadRssSources(db),
    ]);
    const instructionsSnapshot = buildInstructionsSnapshot(activePolicy);

    let targets: FetchedArticle[] = [];
    let rssStats: {
      rawHeadlinesCount: number;
      mergedEventsCount: number;
      enabledFeedsCount: number;
      succeededFeeds: string[];
      failedFeeds: { name: string; error: string }[];
      newCandidatesCount: number;
      alreadySeenCount: number;
      duplicateGroups: DuplicateClusterGroup[];
      droppedCandidates?: {
        title: string;
        source: string;
        source_count: number;
        drop_reason: string;
      }[];
    } | null = null;

    if (body.mode === 'single-url' && body.url?.trim()) {
      const targetUrl = body.url.trim();
      sendEvent({
        type: 'agent1_start',
        message: `Scanning single URL: ${targetUrl}`,
      });
      const base: FetchedArticle = {
        title: targetUrl,
        link: targetUrl,
        snippet: '',
        source: (() => {
          try {
            return new URL(targetUrl).hostname.replace(/^www\./, '');
          } catch {
            return 'Web Source';
          }
        })(),
        imageUrl: null,
        source_count: 1,
        source_names: [],
        alternate_urls: [],
        topic: 'World',
        region: 'Global',
        tags: ['World', 'Global'],
        sensitive: false,
        reason: 'Editor-submitted URL for live multi-agent ingestion.',
        fullText: '',
        usedFallbackSnippet: false,
      };
      base.source_names = [base.source];
      const extracted = await extractFullArticle(base);
      targets = [extracted];
      sendEvent({
        type: 'agent1_done',
        count: 1,
        stories: [
          {
            title: extracted.title,
            source: extracted.source,
            sourceCount: 1,
            reason: extracted.reason,
          },
        ],
      });
    } else {
      sendEvent({
        type: 'agent1_start',
        message: `Scanning ${sources.filter((s) => s.enabled).length} enabled RSS feeds & clustering duplicate coverage...`,
      });
      const [existing, rssResult] = await Promise.all([
        getExistingDedupeContext(db),
        fetchRssCandidatesWithStats(sources),
      ]);
      const rawCandidates = rssResult.candidates;
      const candidates = rawCandidates.filter(
        (item) =>
          !existing.urls.has(item.link) &&
          !(item.alternate_urls ?? []).some((u) => existing.urls.has(u)) &&
          !existing.recentHeadlines.some((h) => isSameTitle(h, item.title))
      );
      rssStats = {
        rawHeadlinesCount: rssResult.rawHeadlinesCount,
        mergedEventsCount: rssResult.mergedEventsCount,
        enabledFeedsCount: rssResult.enabledFeedsCount,
        succeededFeeds: rssResult.succeededFeeds,
        failedFeeds: rssResult.failedFeeds,
        newCandidatesCount: candidates.length,
        alreadySeenCount: Math.max(0, rawCandidates.length - candidates.length),
        duplicateGroups: rssResult.duplicateGroups,
      };
      sendEvent({
        type: 'agent1_progress',
        message: `Scanned ${rssResult.rawHeadlinesCount} headlines → ${rawCandidates.length} unique events (${candidates.length} new). Selecting top stories...`,
      });
      const { selected: topStories, droppedCandidates } =
        await selectTopImpactStoriesWithLog(
          ai,
          candidates,
          activePolicy.settings
        );
      rssStats.droppedCandidates = droppedCandidates;
      const selected = topStories.slice(0, 2);
      const rawTargets = await Promise.all(selected.map((s) => extractFullArticle(s)));
      targets = rawTargets.filter((t) => !existing.urls.has(t.link));
      sendEvent({
        type: 'agent1_done',
        count: targets.length,
        stories: targets.map((t) => ({
          title: t.title,
          source: t.source,
          sourceCount: t.source_count,
          reason: t.reason,
        })),
      });
    }

    const savedDrafts: ArticleDocument[] = [];
    let autoRetriedCount = 0;
    let summarizerFailedCount = 0;

    for (const [idx, article] of targets.entries()) {
      sendEvent({
        type: 'agent2_start',
        index: idx,
        title: article.title,
        message: `Drafting ${activePolicy.settings.reading_level} summary (~${activePolicy.settings.target_summary_words}w)...`,
      });

      let summary = await summarizeArticle(ai, article, {
        policy: activePolicy,
      });

      if (!summary) {
        summarizerFailedCount += 1;
        sendEvent({
          type: 'error',
          message: `Agent 2 could not summarize "${article.title}".`,
        });
        continue;
      }

      sendEvent({
        type: 'agent2_done',
        index: idx,
        headline: summary.ai_headline,
        summary: summary.ai_summary,
      });

      sendEvent({
        type: 'agent3_start',
        index: idx,
        headline: summary.ai_headline || article.title,
        message: 'Auditing claims against source text, G-safety & neutrality...',
      });

      let judgment = await judgeArticle(ai, article, summary);

      for (const claim of judgment.claims) {
        const supported =
          claim.evidence.trim().toLowerCase() !== 'unsupported';
        sendEvent({
          type: 'agent3_claim',
          index: idx,
          claim: claim.claim,
          evidence: claim.evidence,
          supported,
        });
      }

      let autoRetriedComplexity = false;
      const retryHistory: ArticleRetryHistoryEntry[] = [];

      // Autonomous self-correction loop if Agent 3 flags issues or low readability
      if (
        !judgment.pass ||
        judgment.flags.includes('TOO_COMPLEX') ||
        judgment.scores.readability < 80
      ) {
        const firstSummary = summary;
        const firstJudgment = judgment;
        const triggerLabel = !firstJudgment.pass
          ? `Judge flagged review (${firstJudgment.flags.join(', ') || 'score below threshold'})`
          : firstJudgment.flags.includes('TOO_COMPLEX')
            ? `TOO_COMPLEX (Readability ${Math.round(firstJudgment.scores.readability)}/100)`
            : `Low readability (${Math.round(firstJudgment.scores.readability)}/100 < 80)`;

        sendEvent({
          type: 'agent3_retry',
          index: idx,
          headline: summary.ai_headline || article.title,
          reason: judgment.reasoning,
          flags: judgment.flags,
          message:
            'Judge flagged issues — sending critique back to Agent 2 for autonomous self-correction...',
        });

        const retrySummary = await summarizeArticle(ai, article, {
          policy: activePolicy,
          editorRedirect: `Fix these Judge audit issues: ${judgment.reasoning}. Flags: ${judgment.flags.join(', ')}`,
        });

        if (retrySummary) {
          summary = retrySummary;
          sendEvent({
            type: 'agent2_done',
            index: idx,
            headline: summary.ai_headline,
            summary: summary.ai_summary,
            isRetry: true,
          });
          judgment = await judgeArticle(ai, article, summary);
          autoRetriedComplexity = true;
          autoRetriedCount += 1;

          retryHistory.push({
            attempt: 1,
            trigger: triggerLabel,
            at: new Date().toISOString(),
            before: {
              ai_headline: firstSummary.ai_headline,
              ai_summary: firstSummary.ai_summary,
              ai_explanation: firstSummary.ai_explanation,
              confidence_score: firstJudgment.confidence_score,
              confidence_reasoning: firstJudgment.reasoning,
              scores: firstJudgment.scores,
              flags: firstJudgment.flags,
            },
            after: {
              ai_headline: summary.ai_headline,
              ai_summary: summary.ai_summary,
              ai_explanation: summary.ai_explanation,
              confidence_score: judgment.confidence_score,
              confidence_reasoning: judgment.reasoning,
              scores: judgment.scores,
              flags: judgment.flags,
            },
          });

          for (const claim of judgment.claims) {
            const supported =
              claim.evidence.trim().toLowerCase() !== 'unsupported';
            sendEvent({
              type: 'agent3_claim',
              index: idx,
              claim: claim.claim,
              evidence: claim.evidence,
              supported,
              isRetry: true,
            });
          }
        }
      }

      sendEvent({
        type: 'agent3_done',
        index: idx,
        pass: judgment.pass,
        scores: judgment.scores,
        flags: judgment.flags,
        reasoning: judgment.reasoning,
      });

      const nowIso = new Date().toISOString();
      const traceSteps: PipelineTraceStep[] = [
        {
          step: 'fetch',
          agent: 'Agent 1 · RSS Fetcher',
          at: nowIso,
          status: 'ok',
          summary: `Grouped from ${article.source_count} outlet(s): ${article.source_names.join(', ')}`,
        },
        {
          step: 'extract',
          agent: 'Agent 1 · Text Extractor',
          at: nowIso,
          status: article.usedFallbackSnippet ? 'fallback' : 'ok',
          summary: article.usedFallbackSnippet
            ? `Full-text scrape failed; fell back to RSS snippet (${article.fullText.length} chars).`
            : `Extracted ${article.fullText.length} chars from publisher page.`,
        },
        {
          step: 'summarize',
          agent: 'Agent 2 · Summarizer',
          at: nowIso,
          status: 'ok',
          summary: autoRetriedComplexity
            ? `Drafted ${activePolicy.settings.reading_level} summary, then auto-retried once.`
            : `Drafted ${activePolicy.settings.reading_level} summary`,
        },
        ...(retryHistory.length > 0
          ? [
              {
                step: 'regenerate' as const,
                agent: 'Agent 2 · Auto-Retry',
                at: retryHistory[0].at,
                status: 'ok' as const,
                summary: `Auto-retried after "${retryHistory[0].trigger}": Readability ${Math.round(retryHistory[0].before.scores?.readability ?? retryHistory[0].before.confidence_score)} → ${Math.round(retryHistory[0].after.scores?.readability ?? retryHistory[0].after.confidence_score)}/100.`,
              },
            ]
          : []),
        {
          step: 'judge',
          agent: 'Agent 3 · Judge',
          at: nowIso,
          status: judgment.pass ? 'ok' : 'warning',
          summary: `${judgment.pass ? 'AUTO-PASS' : 'NEEDS REVIEW'} · Accuracy ${judgment.scores.accuracy}/100`,
        },
      ];

      const canAutoPublish =
        Boolean(activePolicy.settings.auto_publish_ready) &&
        judgment.pass === true &&
        (judgment.flags ?? []).length === 0 &&
        !article.usedFallbackSnippet;

      const doc: ArticleDocument = {
        id: randomUUID(),
        date: today,
        original_url: article.link,
        image_url: article.imageUrl,
        ai_headline: summary.ai_headline,
        ai_summary: summary.ai_summary,
        ai_explanation: summary.ai_explanation,
        confidence_score: judgment.confidence_score,
        confidence_reasoning: judgment.reasoning,
        judge_pass: judgment.pass,
        scores: judgment.scores,
        flags: judgment.flags,
        claims: judgment.claims,
        source_count: article.source_count,
        source_names: article.source_names,
        alternate_urls: article.alternate_urls,
        topic: article.topic,
        region: article.region,
        tags: article.tags,
        sensitive: article.sensitive,
        selection_reason: article.reason,
        source_text: article.fullText.slice(0, 6000),
        used_fallback_snippet: article.usedFallbackSnippet,
        auto_retried_complexity: autoRetriedComplexity,
        ...(retryHistory.length > 0 ? { retry_history: retryHistory } : {}),
        prompt_version: activePolicy.active_version,
        instructions_snapshot: instructionsSnapshot,
        pipeline_trace: traceSteps,
        status: canAutoPublish ? 'published' : 'draft',
        approved_by: canAutoPublish ? 'auto-policy' : null,
        edited_at: null,
        approved_at: canAutoPublish ? nowIso : null,
        rejected_at: null,
        decision_history: [],
      };
      savedDrafts.push(doc);
    }

    if (savedDrafts.length > 0) {
      await saveDraftArticles(db, savedDrafts);
    }

    if (rssStats) {
      const fullTextCount = savedDrafts.filter(
        (d) => !d.used_fallback_snippet
      ).length;
      const snippetCount = savedDrafts.length - fullTextCount;
      const couldNotVerifyCount = savedDrafts.filter(
        (d) =>
          !d.judge_pass ||
          d.confidence_score < 60 ||
          d.used_fallback_snippet ||
          (d.flags ?? []).includes('SNIPPET_ONLY')
      ).length;
      const readyCount = savedDrafts.filter(
        (d) =>
          d.judge_pass === true &&
          d.confidence_score >= 80 &&
          !d.used_fallback_snippet &&
          (d.flags ?? []).length === 0
      ).length;
      const needsCheckCount = Math.max(
        0,
        savedDrafts.length - readyCount - couldNotVerifyCount
      );

      await savePipelineRunLog(db, {
        id: randomUUID(),
        date: today,
        at: new Date().toISOString(),
        enabled_feeds_count: rssStats.enabledFeedsCount,
        succeeded_feeds: rssStats.succeededFeeds,
        failed_feeds: rssStats.failedFeeds,
        raw_headlines_count: rssStats.rawHeadlinesCount,
        merged_events_count: rssStats.mergedEventsCount,
        new_candidates_count: rssStats.newCandidatesCount,
        already_seen_count: rssStats.alreadySeenCount,
        duplicate_groups: rssStats.duplicateGroups,
        dropped_candidates: rssStats.droppedCandidates,
        picked_count: savedDrafts.length,
        target_count: 20,
        full_text_count: fullTextCount,
        snippet_fallback_count: snippetCount,
        ready_count: readyCount,
        needs_check_count: needsCheckCount,
        could_not_verify_count: couldNotVerifyCount,
        auto_retried_count: autoRetriedCount,
        summarizer_failed_count: summarizerFailedCount,
      });
    }

    sendEvent({
      type: 'complete',
      savedIds: savedDrafts.map((d) => d.id),
      count: savedDrafts.length,
      stories: savedDrafts.map((d) => ({
        id: d.id,
        headline: d.ai_headline,
        source: d.source_names?.[0] || d.topic || 'News',
        accuracy: d.scores?.accuracy ?? d.confidence_score,
        judge_pass: Boolean(d.judge_pass),
        flags: d.flags ?? [],
        used_fallback_snippet: Boolean(d.used_fallback_snippet),
      })),
    });
    res.end?.();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Live pipeline failed';
    if (res.write) {
      sendEvent({ type: 'error', message });
      res.end?.();
    } else {
      res.status(500).json({ error: message });
    }
  }
}

export async function handleProposePolicy(
  req: HttpRequest,
  res: HttpResponse
): Promise<void> {
  try {
    await verifyEditorAuth(req);
    const db = initFirebaseAdmin();
    const ai = getGeminiClient();

    const activePolicy = await loadActivePolicy(db);
    const snap = await db
      .collection('articles')
      .orderBy('date', 'desc')
      .limit(40)
      .get();

    const docs = snap.docs.map((d) => d.data() as ArticleDocument);
    const editedOrRejected = docs.filter(
      (d) =>
        d.edited_at ||
        d.status === 'rejected' ||
        (d.decision_history ?? []).some(
          (h) => h.action === 'edited' || h.action === 'regenerated'
        )
    );

    const sampleSummary = editedOrRejected
      .slice(0, 10)
      .map(
        (d) =>
          `- [${d.status}] Headline: "${d.ai_headline}" | Summary: "${d.ai_summary}" | Flags: ${(d.flags ?? []).join(', ') || 'none'} | Notes: ${(d.decision_history ?? []).map((h) => h.action).join(',')}`
      )
      .join('\n');

    const prompt = `You are an Editorial Policy Meta-Agent. Analyze the recent human editor corrections, regenerations, and rejections below alongside the current Tier 2 instructions, and propose ONE concise, actionable new Tier 2 rule.

Current Tier 2 instructions: "${activePolicy.admin_instructions || '(none)'}"
Recent editor-touched articles (${editedOrRejected.length} total):
${sampleSummary || '(No recent edits yet — suggest a high-clarity Grade-6 journalism rule such as spelling out acronyms on first mention.)'}

Return ONLY valid JSON:
{
  "observation": "1-sentence observation summarizing the pattern",
  "proposedRule": "1 concise imperative sentence to add to Tier 2 instructions",
  "changeNote": "Short version changelog note",
  "evidenceCount": ${editedOrRejected.length}
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text || '{}') as {
      observation?: string;
      proposedRule?: string;
      changeNote?: string;
      evidenceCount?: number;
    };

    res.status(200).json({
      observation:
        parsed.observation ||
        `Analyzed ${editedOrRejected.length} editor-reviewed articles for recurring style patterns.`,
      proposedRule:
        parsed.proposedRule ||
        'Spell out uncommon acronyms (such as UN, WHO, IAEA) on first mention and keep sentences under 18 words.',
      changeNote:
        parsed.changeNote || 'Added acronym clarity rule from editor edits',
      evidenceCount: editedOrRejected.length,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Policy proposal failed';
    const status =
      message.includes('Unauthorized') || message.includes('token') ? 401 : 500;
    res.status(status).json({ error: message });
  }
}

export async function handleAgentChat(
  req: HttpRequest,
  res: HttpResponse
): Promise<void> {
  try {
    await verifyEditorAuth(req);
    const body = (req.body || {}) as {
      agentId?: 'fetcher' | 'summarizer' | 'judge';
      message?: string;
    };

    if (!body.message?.trim()) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const db = initFirebaseAdmin();
    const ai = getGeminiClient();
    const activePolicy = await loadActivePolicy(db);

    const agentRoleMap = {
      fetcher: 'Agent 1 · RSS Fetcher (scans RSS feeds, clusters duplicate stories, picks top global impact events)',
      summarizer: 'Agent 2 · Grade-6 Summarizer (writes calm, neutral, G-rated summaries grounded in source text)',
      judge: 'Agent 3 · Quality Judge (audits claims against source evidence, scores accuracy/neutrality/safety/readability)',
    };

    const roleDesc =
      agentRoleMap[body.agentId || 'summarizer'] || agentRoleMap.summarizer;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are ${roleDesc} for the SnappyLit newsroom.
Current active policy (${activePolicy.active_version}): reading level ${activePolicy.settings.reading_level}, ~${activePolicy.settings.target_summary_words} words, tone ${activePolicy.settings.tone}.
Tier 2 instructions: "${activePolicy.admin_instructions || 'None'}".

The human editor says: "${body.message.trim()}"

Respond concisely in 2-3 sentences acknowledging the instruction, explaining how you apply it (while respecting Locked Core safety & source-grounding rules), and noting if it should be saved to Tier 2 Policy for future runs.`,
    });

    res.status(200).json({
      reply:
        response.text?.trim() ||
        'Instruction noted. I will apply this guidance in the next run.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent chat failed';
    const status =
      message.includes('Unauthorized') || message.includes('token') ? 401 : 500;
    res.status(status).json({ error: message });
  }
}

