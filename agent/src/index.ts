import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  extractFullArticle,
  fetchRssCandidatesWithStats,
  isSameTitle,
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
import { sleep } from './lib/retry';
import { buildInstructionsSnapshot } from './policy';
import type {
  ArticleDocument,
  ArticleRetryHistoryEntry,
  PipelineTraceStep,
} from './types';

// Load agent/.env if present (local dev); existing env vars (e.g. Hostinger) take precedence
const AGENT_DIR = resolve(__dirname, '../../agent');
for (const envPath of [resolve(AGENT_DIR, '.env'), 'agent/.env', '.env']) {
  try {
    if (existsSync(envPath)) {
      process.loadEnvFile?.(envPath);
      break;
    }
  } catch {
    // Ignore if loadEnvFile fails
  }
}

async function runPipeline() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required.');
  }

  const db = initFirebaseAdmin();
  const ai = new GoogleGenAI({ apiKey });
  const today = new Date().toISOString().split('T')[0];

  const [activePolicy, sources] = await Promise.all([
    loadActivePolicy(db),
    loadRssSources(db),
  ]);
  const instructionsSnapshot = buildInstructionsSnapshot(activePolicy);

  console.log(
    `[${today}] Starting SnappyLit agent pipeline (policy ${activePolicy.active_version}, ${sources.filter((s) => s.enabled).length} enabled sources)...`
  );

  // Agent 1: Fetch all enabled RSS feeds, dedupe events, select top 20 by global impact, and scrape full text
  const fetchStart = Date.now();
  const [existing, rssResult] = await Promise.all([
    getExistingDedupeContext(db),
    fetchRssCandidatesWithStats(sources),
  ]);
  const allCandidates = rssResult.candidates;
  const candidates = allCandidates.filter(
    (item) =>
      !existing.urls.has(item.link) &&
      !(item.alternate_urls ?? []).some((u) => existing.urls.has(u)) &&
      !existing.recentHeadlines.some((h) => isSameTitle(h, item.title))
  );
  const fetchDurationMs = Date.now() - fetchStart;
  console.log(
    `Fetched ${rssResult.rawHeadlinesCount} headlines -> ${allCandidates.length} unique events (${allCandidates.length - candidates.length} already in Firestore).`
  );

  if (candidates.length === 0) {
    console.warn('No new RSS candidates to process. Exiting.');
    await savePipelineRunLog(db, {
      id: randomUUID(),
      date: today,
      at: new Date().toISOString(),
      enabled_feeds_count: rssResult.enabledFeedsCount,
      succeeded_feeds: rssResult.succeededFeeds,
      failed_feeds: rssResult.failedFeeds,
      raw_headlines_count: rssResult.rawHeadlinesCount,
      merged_events_count: rssResult.mergedEventsCount,
      new_candidates_count: 0,
      already_seen_count: Math.max(
        0,
        allCandidates.length - candidates.length
      ),
      duplicate_groups: rssResult.duplicateGroups,
      picked_count: 0,
      target_count: 20,
      full_text_count: 0,
      snippet_fallback_count: 0,
      ready_count: 0,
      needs_check_count: 0,
      could_not_verify_count: 0,
      auto_retried_count: 0,
      summarizer_failed_count: 0,
      shortfall_reason: 'All deduplicated stories already appeared in earlier editions.',
    });
    return;
  }

  const selectStart = Date.now();
  console.log('Calling Agent 1 (Fetcher filter) via Gemini...');
  const { selected: topStories, droppedCandidates } =
    await selectTopImpactStoriesWithLog(
      ai,
      candidates,
      activePolicy.settings
    );
  const selectDurationMs = Date.now() - selectStart;
  console.log(`Selected ${topStories.length} top stories for full-text extraction.`);

  const extractStart = Date.now();
  const rawFetchedArticles = await Promise.all(
    topStories.map((item) => extractFullArticle(item))
  );
  const extractDurationMs = Date.now() - extractStart;
  const fetchedArticles = rawFetchedArticles.filter(
    (article) => !existing.urls.has(article.link)
  );
  const fallbackCount = fetchedArticles.filter((a) => a.usedFallbackSnippet).length;
  console.log(
    `Extracted text for ${fetchedArticles.length} new articles (${fallbackCount} fell back to RSS snippet).`
  );

  // Agent 2 & Agent 3: Summarize and Judge each article independently
  const drafts: ArticleDocument[] = [];
  let autoRetriedCount = 0;
  let summarizerFailedCount = 0;

  for (const [index, article] of fetchedArticles.entries()) {
    console.log(`[${index + 1}/${fetchedArticles.length}] Summarizing & judging: ${article.title}`);
    const summarizeStart = Date.now();
    let summary = await summarizeArticle(ai, article, {
      policy: activePolicy,
    });
    let summarizeDurationMs = Date.now() - summarizeStart;
    if (!summary) {
      summarizerFailedCount += 1;
      if (index < fetchedArticles.length - 1) {
        await sleep(8_000);
      }
      continue;
    }

    const judgeStart = Date.now();
    let judgment = await judgeArticle(ai, article, summary);
    let judgeDurationMs = Date.now() - judgeStart;
    let autoRetriedComplexity = false;
    const retryHistory: ArticleRetryHistoryEntry[] = [];

    // Fix 4: Retry "Too complex" automatically once before a human sees it.
    if (
      judgment.flags.includes('TOO_COMPLEX') ||
      judgment.scores.readability < 80
    ) {
      console.log(
        `  -> Auto-retrying "Too complex" for "${article.title}" before editor sees it...`
      );
      const firstSummary = summary;
      const firstJudgment = judgment;
      const triggerLabel = firstJudgment.flags.includes('TOO_COMPLEX')
        ? `TOO_COMPLEX (Readability ${Math.round(firstJudgment.scores.readability)}/100)`
        : `Low readability (${Math.round(firstJudgment.scores.readability)}/100 < 80)`;

      const retryStart = Date.now();
      const simplified = await summarizeArticle(ai, article, {
        policy: activePolicy,
        editorRedirect:
          'Simplify the reading level strictly to Grade 6 or below. Replace multi-syllable or technical terms with plain everyday words and keep sentences under 16 words.',
      });
      if (simplified) {
        summary = simplified;
        summarizeDurationMs += Date.now() - retryStart;
        const reJudgeStart = Date.now();
        judgment = await judgeArticle(ai, article, summary);
        judgeDurationMs += Date.now() - reJudgeStart;
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
      }
    }

    const nowIso = new Date().toISOString();
    const pipelineTrace: PipelineTraceStep[] = [
      {
        step: 'fetch',
        agent: 'Agent 1 · RSS Fetcher',
        at: nowIso,
        duration_ms: fetchDurationMs,
        status: 'ok',
        summary: `Grouped from ${article.source_count} outlet(s): ${article.source_names.join(', ')}`,
        details: {
          source_count: article.source_count,
          primary_source: article.source,
        },
      },
      {
        step: 'select',
        agent: 'Agent 1 · Story Selector',
        at: nowIso,
        duration_ms: selectDurationMs,
        status: article.sensitive ? 'warning' : 'ok',
        summary: article.reason,
        details: {
          topic: article.topic,
          region: article.region,
          sensitive: article.sensitive,
        },
      },
      {
        step: 'extract',
        agent: 'Agent 1 · Text Extractor',
        at: nowIso,
        duration_ms: extractDurationMs,
        status: article.usedFallbackSnippet ? 'fallback' : 'ok',
        summary: article.usedFallbackSnippet
          ? `Full-text scrape failed; fell back to RSS snippet (${article.fullText.length} chars).`
          : `Extracted ${article.fullText.length} chars from publisher page.`,
        details: {
          chars: article.fullText.length,
          used_fallback_snippet: article.usedFallbackSnippet,
        },
      },
      {
        step: 'summarize',
        agent: 'Agent 2 · Summarizer',
        at: nowIso,
        duration_ms: summarizeDurationMs,
        status: 'ok',
        summary: autoRetriedComplexity
          ? `Generated Draft 1 under policy ${activePolicy.active_version}, then auto-simplified once for ${activePolicy.settings.reading_level}.`
          : `Generated headline & summary under policy ${activePolicy.active_version} (${activePolicy.settings.reading_level}).`,
        details: {
          prompt_version: activePolicy.active_version,
          reading_level: activePolicy.settings.reading_level,
          summary_words: summary.ai_summary.split(/\s+/).filter(Boolean).length,
          auto_retried_complexity: autoRetriedComplexity,
          raw_candidates: allCandidates.length,
          picked_count: topStories.length,
        },
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
        duration_ms: judgeDurationMs,
        status: judgment.pass ? 'ok' : 'warning',
        summary: judgment.pass
          ? `Passed audit (Acc ${judgment.scores.accuracy}, Neu ${judgment.scores.neutrality}, Saf ${judgment.scores.safety}, Read ${judgment.scores.readability}).`
          : `Flagged for human review (${judgment.flags.join(', ') || 'score below threshold'}).`,
        details: {
          accuracy: judgment.scores.accuracy,
          neutrality: judgment.scores.neutrality,
          safety: judgment.scores.safety,
          readability: judgment.scores.readability,
          pass: judgment.pass,
        },
      },
    ];

    const canAutoPublish =
      Boolean(activePolicy.settings.auto_publish_ready) &&
      judgment.pass === true &&
      (judgment.flags ?? []).length === 0 &&
      !article.usedFallbackSnippet;

    drafts.push({
      id: randomUUID(),
      date: today,
      original_url: article.link,
      image_url: article.imageUrl,
      ai_headline: summary.ai_headline,
      ai_summary: summary.ai_summary,
      ai_explanation: summary.ai_explanation,
      source_text: article.fullText,
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
      used_fallback_snippet: article.usedFallbackSnippet,
      auto_retried_complexity: autoRetriedComplexity,
      ...(retryHistory.length > 0 ? { retry_history: retryHistory } : {}),
      status: canAutoPublish ? 'published' : 'draft',
      approved_by: canAutoPublish ? 'auto-policy' : null,
      approved_at: canAutoPublish ? nowIso : null,
      prompt_version: activePolicy.active_version,
      instructions_snapshot: instructionsSnapshot,
      pipeline_trace: pipelineTrace,
    });

    if (index < fetchedArticles.length - 1) {
      await sleep(8_000);
    }
  }

  const savedCount = await saveDraftArticles(db, drafts);
  const fullTextCount = drafts.filter((d) => !d.used_fallback_snippet).length;
  const snippetCount = drafts.length - fullTextCount;
  const couldNotVerifyCount = drafts.filter(
    (d) =>
      !d.judge_pass ||
      d.confidence_score < 60 ||
      d.used_fallback_snippet ||
      (d.flags ?? []).includes('SNIPPET_ONLY')
  ).length;
  const readyCount = drafts.filter(
    (d) =>
      d.judge_pass === true &&
      d.confidence_score >= 80 &&
      !d.used_fallback_snippet &&
      (d.flags ?? []).length === 0
  ).length;
  const needsCheckCount = Math.max(
    0,
    drafts.length - readyCount - couldNotVerifyCount
  );

  await savePipelineRunLog(db, {
    id: randomUUID(),
    date: today,
    at: new Date().toISOString(),
    enabled_feeds_count: rssResult.enabledFeedsCount,
    succeeded_feeds: rssResult.succeededFeeds,
    failed_feeds: rssResult.failedFeeds,
    raw_headlines_count: rssResult.rawHeadlinesCount,
    merged_events_count: rssResult.mergedEventsCount,
    new_candidates_count: candidates.length,
    already_seen_count: Math.max(
      0,
      allCandidates.length - candidates.length
    ),
    duplicate_groups: rssResult.duplicateGroups,
    dropped_candidates: droppedCandidates,
    picked_count: drafts.length,
    target_count: 20,
    full_text_count: fullTextCount,
    snippet_fallback_count: snippetCount,
    ready_count: readyCount,
    needs_check_count: needsCheckCount,
    could_not_verify_count: couldNotVerifyCount,
    auto_retried_count: autoRetriedCount,
    summarizer_failed_count: summarizerFailedCount,
  });

  console.log(`Pipeline complete. Saved ${savedCount} draft articles for ${today}.`);
}

runPipeline().catch((err) => {
  console.error('Fatal agent pipeline error:', err);
  process.exit(1);
});
