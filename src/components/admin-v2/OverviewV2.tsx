import { useMemo, useState } from 'react';
import { View } from 'react-native';
import type {
  ActivePolicyDoc,
  Article,
  PipelineRunLog,
} from '@/types/article';
import { getMissedRunNotice } from '@/lib/editorialLabels';
import {
  StatusLabel,
  V2Button,
  V2Divider,
  V2InlineLink,
  V2Text,
} from './primitives';
import {
  formatArticleIssueLine,
  formatStoryAge,
  formatUtcDateOnly,
  formatUtcTimestamp,
  getArticleVerdict,
  sortByLowestScoreThenOldest,
  V2_COLORS,
  V2_SPACE,
} from './tokens';

interface OverviewV2Props {
  articles: Article[];
  today: string;
  activePolicy: ActivePolicyDoc;
  latestRunLog: PipelineRunLog | null;
  enabledSourcesCount: number;
  onReviewArticle: (articleId: string) => void;
  onReviewAllPending: () => void;
  onViewAllPending: () => void;
  onApproveArticle: (articleId: string) => Promise<void>;
  onViewPublished: () => void;
  onViewHistory: () => void;
  onOpenLivePipeline: () => void;
  onOpenAutonomySettings: () => void;
}

export function OverviewV2({
  articles,
  today,
  activePolicy,
  latestRunLog,
  enabledSourcesCount,
  onReviewArticle,
  onReviewAllPending,
  onViewAllPending,
  onApproveArticle,
  onViewPublished,
  onViewHistory,
  onOpenLivePipeline,
  onOpenAutonomySettings,
}: OverviewV2Props) {
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const yesterday = useMemo(() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().split('T')[0];
  }, [today]);

  const thirtyDaysAgo = useMemo(() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 30);
    return d.toISOString().split('T')[0];
  }, [today]);

  const pendingArticles = useMemo(() => {
    return articles
      .filter((a) => a.status === 'draft')
      .sort(sortByLowestScoreThenOldest);
  }, [articles]);

  const visiblePending = useMemo(
    () => pendingArticles.slice(0, 5),
    [pendingArticles]
  );

  const uniformPendingVerdict = useMemo(() => {
    if (pendingArticles.length === 0) return null;
    const first = getArticleVerdict(pendingArticles[0]);
    for (let i = 1; i < pendingArticles.length; i += 1) {
      if (getArticleVerdict(pendingArticles[i]) !== first) {
        return null;
      }
    }
    return first;
  }, [pendingArticles]);

  const todayDrafts = useMemo(
    () => articles.filter((a) => a.date === today),
    [articles, today]
  );

  const publishedTodayCount = useMemo(
    () => articles.filter((a) => a.date === today && a.status === 'published').length,
    [articles, today]
  );

  const publishedYesterdayCount = useMemo(
    () =>
      articles.filter((a) => a.date === yesterday && a.status === 'published')
        .length,
    [articles, yesterday]
  );

  const published30DaysCount = useMemo(
    () =>
      articles.filter(
        (a) => a.status === 'published' && a.date >= thirtyDaysAgo
      ).length,
    [articles, thirtyDaysAgo]
  );

  const pendingVerdictCounts = useMemo(() => {
    let ready = 0;
    let check = 0;
    let unverified = 0;
    for (const a of pendingArticles) {
      const v = getArticleVerdict(a);
      if (v === 'ready') ready += 1;
      else if (v === 'check') check += 1;
      else unverified += 1;
    }
    return { ready, check, unverified };
  }, [pendingArticles]);

  const pipelineRows = useMemo(() => {
    if (!latestRunLog) {
      return [
        {
          stage: '1. Scan and merge',
          inCol: `${enabledSourcesCount} feeds enabled`,
          outCol: 'No run logged yet',
          notes: 'Run the pipeline to fetch today’s headlines.',
        },
      ];
    }

    const feedsCount =
      latestRunLog.enabled_feeds_count ?? enabledSourcesCount;
    const failedCount = latestRunLog.failed_feeds?.length ?? 0;
    const duplicatesMerged = Math.max(
      0,
      latestRunLog.raw_headlines_count - latestRunLog.merged_events_count
    );
    const newCandidates =
      latestRunLog.new_candidates_count ?? latestRunLog.merged_events_count;
    const skippedCount = Math.max(0, newCandidates - latestRunLog.picked_count);
    const draftedCount =
      latestRunLog.full_text_count + latestRunLog.snippet_fallback_count;
    const autoRetried =
      latestRunLog.auto_retried_count ??
      todayDrafts.filter((a) => Boolean(a.auto_retried_complexity)).length;
    const failedDrafts = latestRunLog.summarizer_failed_count ?? 0;
    const todayPubCount = todayDrafts.filter(
      (a) => a.status === 'published'
    ).length;

    return [
      {
        stage: '1. Scan and merge',
        inCol: `${latestRunLog.raw_headlines_count} headlines from ${feedsCount} feeds`,
        outCol: `${latestRunLog.merged_events_count} unique stories`,
        notes: `${duplicatesMerged} duplicates merged. ${failedCount} feeds failed.`,
      },
      {
        stage: '2. Filter and rank',
        inCol: `${newCandidates} new stories`,
        outCol: `${latestRunLog.picked_count} picked`,
        notes: `${skippedCount} of ${newCandidates} skipped${
          latestRunLog.shortfall_reason
            ? `: ${latestRunLog.shortfall_reason}`
            : '.'
        }`,
      },
      {
        stage: '3. Scrape and draft',
        inCol: `${latestRunLog.picked_count} picked`,
        outCol: `${draftedCount} drafts`,
        notes: `${latestRunLog.full_text_count} from full text. ${latestRunLog.snippet_fallback_count} from an RSS snippet.${
          autoRetried > 0 ? ` ${autoRetried} auto-retried ("Too complex").` : ''
        }${failedDrafts > 0 ? ` ${failedDrafts} failed to draft.` : ''}`,
      },
      {
        stage: '4. Check facts',
        inCol: `${draftedCount} drafts`,
        outCol: `${latestRunLog.ready_count} ready, ${latestRunLog.needs_check_count} check, ${latestRunLog.could_not_verify_count} unverified`,
        notes:
          autoRetried > 0
            ? `${autoRetried} simplified and re-audited automatically before reaching you.`
            : 'Judge verdicts at the end of the run.',
      },
      {
        stage: '5. Editor sign-off',
        inCol: `${draftedCount} checked`,
        outCol: `${todayPubCount} published`,
        notes: `${pendingArticles.length} still waiting: ${pendingVerdictCounts.ready} ready, ${pendingVerdictCounts.check} check, ${pendingVerdictCounts.unverified} unverified.`,
      },
    ];
  }, [
    latestRunLog,
    enabledSourcesCount,
    todayDrafts,
    pendingArticles.length,
    pendingVerdictCounts,
  ]);

  const editionTimestamp = useMemo(
    () => formatUtcTimestamp(latestRunLog?.at ?? `${today}T00:00:00Z`),
    [latestRunLog?.at, today]
  );

  const autoRetriedToday = useMemo(
    () =>
      todayDrafts.filter(
        (a) => Boolean(a.auto_retried_complexity) || (a.retry_history?.length ?? 0) > 0
      ),
    [todayDrafts]
  );

  const lastRunSummary = useMemo(() => {
    if (!latestRunLog) {
      return `No pipeline run logged. Policy ${activePolicy.active_version}.`;
    }
    const failedCount = latestRunLog.failed_feeds?.length ?? 0;
    const failureText =
      failedCount === 0 ? 'No feed failures.' : `${failedCount} feed failures.`;
    const autoRetried =
      latestRunLog.auto_retried_count ?? autoRetriedToday.length;
    const retryText =
      autoRetried > 0 ? ` ${autoRetried} auto-simplified ("Too complex").` : '';
    return `Last run ${formatUtcTimestamp(latestRunLog.at)}. Policy ${activePolicy.active_version}. ${failureText}${retryText}`;
  }, [latestRunLog, activePolicy.active_version, autoRetriedToday.length]);

  const missedRunNotice = useMemo(
    () => getMissedRunNotice(latestRunLog, today),
    [latestRunLog, today]
  );

  const autoPublishOn = Boolean(activePolicy.settings.auto_publish_ready);

  const handleQuickPublish = async (id: string) => {
    setPublishingId(id);
    try {
      await onApproveArticle(id);
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <View style={{ gap: V2_SPACE.sectionGap }}>
      {/* Missed-run notice */}
      {missedRunNotice ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: V2_COLORS.statusCheck,
            borderRadius: 6,
            padding: 16,
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: V2_SPACE.gapMd,
          }}
        >
          <View style={{ flex: 1, minWidth: 260, gap: 4 }}>
            <V2Text variant="sectionTitle" tone="check">
              {missedRunNotice.title}
            </V2Text>
            <V2Text variant="body" tone="muted">
              {missedRunNotice.detail}
            </V2Text>
          </View>
          <V2Button
            variant="secondary"
            label="Run pipeline now"
            onPress={onOpenLivePipeline}
          />
        </View>
      ) : null}

      {/* Header + 4 edition stats */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: V2_SPACE.gapLg,
        }}
      >
        <View style={{ gap: 4 }}>
          <V2Text variant="pageTitle">Today&apos;s edition</V2Text>
          <V2Text variant="meta">{editionTimestamp}</V2Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: V2_SPACE.gapLg,
          }}
        >
          <View style={{ gap: 4 }}>
            <V2Text variant="meta">To review</V2Text>
            <V2Text variant="pageTitle" tabular>
              {pendingArticles.length}
            </V2Text>
          </View>
          <View style={{ gap: 4 }}>
            <V2Text variant="meta">Published today</V2Text>
            <V2Text variant="pageTitle" tabular>
              {publishedTodayCount}
            </V2Text>
          </View>
          <View style={{ gap: 4 }}>
            <V2Text variant="meta">Published yesterday</V2Text>
            <V2Text variant="pageTitle" tabular>
              {publishedYesterdayCount}
            </V2Text>
          </View>
          <View style={{ gap: 4 }}>
            <V2Text variant="meta">Last 30 days</V2Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: V2_SPACE.gapSm,
              }}
            >
              <V2Text variant="pageTitle" tabular>
                {published30DaysCount}
              </V2Text>
              <V2InlineLink label="History" onPress={onViewHistory} />
            </View>
          </View>
        </View>
      </View>

      {/* Section 1: Editor's main task */}
      <View>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: V2_SPACE.gapMd,
            paddingBottom: V2_SPACE.gapMd,
          }}
        >
          <V2Text variant="sectionTitle" tabular>
            {uniformPendingVerdict
              ? `To review ${pendingArticles.length}, all ${uniformPendingVerdict}`
              : `To review ${pendingArticles.length}`}
          </V2Text>
          {pendingArticles.length > 0 ? (
            <V2Button
              variant="primary"
              label={`Review all ${pendingArticles.length}`}
              onPress={onReviewAllPending}
            />
          ) : null}
        </View>

        <V2Divider />

        {visiblePending.length === 0 ? (
          <View style={{ paddingVertical: V2_SPACE.listRowPadY }}>
            <V2Text variant="body" tone="muted">
              No drafts waiting for review.
            </V2Text>
          </View>
        ) : (
          visiblePending.map((article) => {
            const verdict = getArticleVerdict(article);
            const sourceList =
              article.source_names && article.source_names.length > 0
                ? article.source_names.join(', ')
                : 'Source unavailable';
            const sourceCount =
              article.source_count ?? article.source_names?.length ?? 1;
            const issueLine = formatArticleIssueLine(article);
            const storyAge = formatStoryAge(article.date, today);

            return (
              <View key={article.id}>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                    paddingVertical: V2_SPACE.listRowPadY,
                    gap: V2_SPACE.gapLg,
                  }}
                >
                  {!uniformPendingVerdict ? (
                    <View style={{ width: 112, paddingTop: 2 }}>
                      <StatusLabel kind={verdict} />
                    </View>
                  ) : null}

                  <View style={{ flex: 1, minWidth: 220, gap: 4 }}>
                    <V2Text variant="itemHeadline" numberOfLines={1}>
                      {article.ai_headline}
                    </V2Text>
                    <V2Text variant="body" tone="muted" tabular numberOfLines={1}>
                      {issueLine}
                    </V2Text>
                    <V2Text variant="meta" tabular numberOfLines={1}>
                      Confidence {Math.round(article.confidence_score ?? 0)}/100 ·{' '}
                      {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}:{' '}
                      {sourceList} · {storyAge}
                      {article.auto_retried_complexity
                        ? ' · Auto-retried once'
                        : ''}
                    </V2Text>
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: V2_SPACE.gapSm,
                    }}
                  >
                    {verdict === 'ready' ? (
                      <V2Button
                        variant="low"
                        label={
                          publishingId === article.id
                            ? 'Publishing...'
                            : 'Publish'
                        }
                        disabled={publishingId === article.id}
                        onPress={() => handleQuickPublish(article.id)}
                      />
                    ) : null}
                    <V2Button
                      variant="low"
                      label="Review"
                      onPress={() => onReviewArticle(article.id)}
                    />
                  </View>
                </View>
                <V2Divider />
              </View>
            );
          })
        )}

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: V2_SPACE.gapMd,
            paddingTop: V2_SPACE.listRowPadY,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: V2_SPACE.gapSm,
            }}
          >
            <V2Text variant="body" tone="muted" tabular>
              {publishedTodayCount}{' '}
              {publishedTodayCount === 1 ? 'story' : 'stories'} published today (
              {formatUtcDateOnly(today)}).
            </V2Text>
            <V2InlineLink label="View published" onPress={onViewPublished} />
          </View>

          {pendingArticles.length > 5 ? (
            <V2InlineLink
              label={`View all ${pendingArticles.length}`}
              onPress={onViewAllPending}
            />
          ) : null}
        </View>
      </View>

      {/* Section 2: Pipeline table */}
      <View>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: V2_SPACE.gapMd,
            paddingBottom: V2_SPACE.gapMd,
          }}
        >
          <View style={{ gap: 4 }}>
            <V2Text variant="sectionTitle">Pipeline</V2Text>
            <V2Text variant="meta">{lastRunSummary}</V2Text>
          </View>
          <V2Button
            variant="low"
            label="Run pipeline"
            onPress={onOpenLivePipeline}
          />
        </View>

        <View style={{ width: '100%' }}>
          <View
            style={{
              flexDirection: 'row',
              paddingVertical: V2_SPACE.tableRowPadY,
              gap: V2_SPACE.gapMd,
              borderBottomWidth: 1,
              borderBottomColor: V2_COLORS.lineStrong,
            }}
          >
            <V2Text variant="meta" style={{ width: 155 }}>
              Stage
            </V2Text>
            <V2Text variant="meta" style={{ width: 170 }}>
              In
            </V2Text>
            <V2Text variant="meta" style={{ width: 185 }}>
              Out
            </V2Text>
            <V2Text variant="meta" style={{ flex: 1, minWidth: 180 }}>
              Notes
            </V2Text>
          </View>

          {pipelineRows.map((row) => (
            <View key={row.stage}>
              <View
                style={{
                  flexDirection: 'row',
                  paddingVertical: V2_SPACE.tableRowPadY,
                  gap: V2_SPACE.gapMd,
                }}
              >
                <V2Text
                  variant="body"
                  weight="500"
                  style={{ width: 155 }}
                >
                  {row.stage}
                </V2Text>
                <V2Text
                  variant="body"
                  tabular
                  style={{ width: 170 }}
                >
                  {row.inCol}
                </V2Text>
                <V2Text
                  variant="body"
                  tabular
                  style={{ width: 185 }}
                >
                  {row.outCol}
                </V2Text>
                <V2Text
                  variant="body"
                  tone="muted"
                  tabular
                  style={{ flex: 1, minWidth: 180 }}
                >
                  {row.notes}
                </V2Text>
              </View>
              <V2Divider />
            </View>
          ))}
        </View>
      </View>

      {/* Self-corrected stories today */}
      {autoRetriedToday.length > 0 ? (
        <View>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: V2_SPACE.gapMd,
              paddingBottom: V2_SPACE.gapMd,
            }}
          >
            <View style={{ gap: 4 }}>
              <V2Text variant="sectionTitle" tabular>
                Self-corrected by agents today ({autoRetriedToday.length})
              </V2Text>
              <V2Text variant="meta">
                Stories the Summarizer automatically simplified and the Judge re-checked before reaching your queue.
              </V2Text>
            </View>
          </View>

          <V2Divider />

          {autoRetriedToday.slice(0, 5).map((article) => {
            const hasDiff = (article.retry_history?.length ?? 0) > 0;
            const conf = Math.round(article.confidence_score ?? 0);
            const trigger = article.retry_history?.[0]?.trigger;
            return (
              <View key={`retry-v2-${article.id}`}>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: V2_SPACE.listRowPadY,
                    gap: V2_SPACE.gapMd,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 240, gap: 4 }}>
                    <V2Text variant="itemHeadline" numberOfLines={1}>
                      {article.ai_headline}
                    </V2Text>
                    <V2Text variant="meta" tabular>
                      Confidence {conf}/100 ·{' '}
                      {hasDiff
                        ? `${trigger ?? 'Too complex'} · Draft 1 → Draft 2 diff available`
                        : 'Auto-simplified once ("Too complex")'}
                    </V2Text>
                  </View>
                  <V2Button
                    variant="low"
                    label={hasDiff ? 'Inspect diff' : 'Inspect'}
                    onPress={() => onReviewArticle(article.id)}
                  />
                </View>
                <V2Divider />
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Section 3: Auto-publish status */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: V2_SPACE.gapMd,
        }}
      >
        <View style={{ flex: 1, minWidth: 240, gap: 4 }}>
          <V2Text variant="sectionTitle">
            {autoPublishOn ? 'Auto-publish is on' : 'Auto-publish is off'}
          </V2Text>
          <V2Text variant="body" tone="muted">
            {autoPublishOn
              ? 'Stories marked Ready publish automatically after fact-checking.'
              : "Every story needs an editor's sign-off."}
          </V2Text>
        </View>
        <V2InlineLink
          label="Autonomy settings"
          onPress={onOpenAutonomySettings}
        />
      </View>
    </View>
  );
}
