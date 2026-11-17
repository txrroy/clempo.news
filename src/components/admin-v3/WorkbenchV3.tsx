import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  computeTodayCounts,
  getEditorialState,
  getMissedRunNotice,
  getQueueReviewReason,
  isSnippetOnlyUnverified,
} from '@/lib/editorialLabels';
import type { ActivePolicyDoc, Article, PipelineRunLog } from '@/types/article';
import {
  V3AccordionItem,
  V3Badge,
  V3Button,
  V3Card,
  V3Rule,
  V3Tabs,
  V3Text,
} from './primitives';
import { V3_COLORS, V3_SPACE } from './tokens';
import { TreeV3, type V3TraceNode, type V3TraceNodeId } from './TreeV3';

interface WorkbenchV3Props {
  articles: Article[];
  today: string;
  activePolicy: ActivePolicyDoc;
  latestRunLog: PipelineRunLog | null;
  enabledSourcesCount: number;
  collectionScheduleLabel: string;
  onStartCollecting: () => void;
  onViewDetails: (articleId: string) => void;
  onApproveArticle: (article: Article) => Promise<void>;
  onRejectArticle: (article: Article) => Promise<void>;
}

function getArticleDecision(article: Article): 'approved' | 'rejected' | null {
  if (article.status === 'published') return 'approved';
  if (article.status === 'rejected') return 'rejected';
  return null;
}

function StoryReviewAccordion({
  stories,
  emptyLabel,
  onViewDetails,
  onApproveArticle,
  onRejectArticle,
}: {
  stories: Article[];
  emptyLabel: string;
  onViewDetails: (id: string) => void;
  onApproveArticle: (article: Article) => Promise<void>;
  onRejectArticle: (article: Article) => Promise<void>;
}) {
  // First item expanded by default
  const [expandedId, setExpandedId] = useState<string | null>(
    () => stories[0]?.id ?? null
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  if (stories.length === 0) {
    return (
      <V3Card variant="outlined">
        <V3Text role="body" tone="muted">
          {emptyLabel}
        </V3Text>
      </V3Card>
    );
  }

  const handleDecision = async (
    article: Article,
    idx: number,
    kind: 'approve' | 'reject'
  ) => {
    setBusyId(article.id);
    try {
      if (kind === 'approve') {
        await onApproveArticle(article);
      } else {
        await onRejectArticle(article);
      }
      // Collapse current item and expand next item
      const nextStory = stories[idx + 1] ?? null;
      setExpandedId(nextStory ? nextStory.id : null);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View>
      <V3Rule strong />
      {stories.map((story, idx) => {
        const isExpanded = expandedId === story.id;
        const decision = getArticleDecision(story);
        const source = story.source_names?.[0] || story.topic || 'News';
        const score = story.scores?.accuracy ?? story.confidence_score;
        const statusLabel =
          story.status === 'published'
            ? 'PUBLISHED'
            : story.status === 'rejected'
              ? 'REJECTED'
              : getEditorialState(story).toUpperCase();

        return (
          <V3AccordionItem
            key={story.id}
            title={story.ai_headline}
            meta={`${source.toUpperCase()} · SCORE ${score} · ${statusLabel}`}
            expanded={isExpanded}
            decision={decision}
            onToggle={() =>
              setExpandedId((prev) => (prev === story.id ? null : story.id))
            }
          >
            <View style={{ gap: V3_SPACE.md }}>
              <V3Text role="body">{story.ai_summary}</V3Text>
              {story.status === 'draft' ? (
                <V3Text role="mono" tone="muted">
                  {getQueueReviewReason(story)}
                </V3Text>
              ) : null}
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: V3_SPACE.sm,
                }}
              >
                <V3Button
                  label="Approve"
                  variant="primary"
                  size="sm"
                  disabled={busyId !== null || story.status === 'published'}
                  onPress={() => void handleDecision(story, idx, 'approve')}
                />
                <V3Button
                  label="Reject"
                  variant="danger"
                  size="sm"
                  disabled={busyId !== null || story.status === 'rejected'}
                  onPress={() => void handleDecision(story, idx, 'reject')}
                />
                <V3Button
                  label="View details"
                  variant="outline"
                  size="sm"
                  onPress={() => onViewDetails(story.id)}
                />
              </View>
            </View>
          </V3AccordionItem>
        );
      })}
    </View>
  );
}

export function WorkbenchV3({
  articles,
  today,
  activePolicy,
  latestRunLog,
  enabledSourcesCount,
  collectionScheduleLabel,
  onStartCollecting,
  onViewDetails,
  onApproveArticle,
  onRejectArticle,
}: WorkbenchV3Props) {
  const [editionTab, setEditionTab] = useState<'stories' | 'trace'>('stories');
  const [selectedTraceNode, setSelectedTraceNode] =
    useState<V3TraceNodeId>('signoff');

  const todayItems = useMemo(
    () => articles.filter((a) => a.date === today),
    [articles, today]
  );
  const counts = useMemo(
    () => computeTodayCounts(articles, today),
    [articles, today]
  );

  const missedRunNotice = useMemo(
    () => getMissedRunNotice(latestRunLog, today),
    [latestRunLog, today]
  );
  const needsCollectionToday =
    Boolean(missedRunNotice) ||
    (todayItems.length === 0 && latestRunLog?.date !== today);

  const runLog = latestRunLog?.date === today ? latestRunLog : null;
  const hasStats = Boolean(runLog && runLog.raw_headlines_count > 0);
  const rawHeadlines = runLog?.raw_headlines_count ?? 0;
  const mergedEvents = runLog?.merged_events_count ?? 0;
  const alreadySeen = runLog?.already_seen_count ?? 0;
  const newCandidates =
    runLog?.new_candidates_count ?? Math.max(0, mergedEvents - alreadySeen);
  const filteredOut = hasStats
    ? Math.max(0, newCandidates - todayItems.length)
    : 0;

  const fullTextStories = useMemo(
    () => todayItems.filter((a) => !isSnippetOnlyUnverified(a)),
    [todayItems]
  );
  const snippetStories = useMemo(
    () => todayItems.filter((a) => isSnippetOnlyUnverified(a)),
    [todayItems]
  );
  const flaggedStories = useMemo(
    () =>
      todayItems.filter((a) => getEditorialState(a) === 'Needs a check'),
    [todayItems]
  );
  const passedStories = useMemo(
    () =>
      todayItems.filter((a) => getEditorialState(a) === 'Ready to approve'),
    [todayItems]
  );

  const traceRoot = useMemo<V3TraceNode>(() => {
    const judgeChildren: V3TraceNode[] = [
      {
        id: 'signoff',
        title: '5. SIGN-OFF',
        metric:
          counts.needsReview > 0
            ? `${counts.needsReview} to review`
            : `${counts.published} published`,
        sublabel: `${counts.published} pub · ${counts.rejected} rej`,
        tone: counts.needsReview > 0 ? 'orange' : 'green',
      },
    ];
    if (flaggedStories.length > 0) {
      judgeChildren.push({
        id: 'flagged',
        title: 'NEEDS CHECK',
        metric: `${flaggedStories.length} stories`,
        tone: 'orange',
      });
    }
    if (snippetStories.length > 0) {
      judgeChildren.push({
        id: 'unverified',
        title: 'UNVERIFIED',
        metric: `${snippetStories.length} stories`,
        tone: 'red',
      });
    }

    const draftChildren: V3TraceNode[] = [
      {
        id: 'judge',
        title: '4. CHECK FACTS',
        metric: `${passedStories.length} passed`,
        sublabel: `${flaggedStories.length + snippetStories.length} flagged`,
        children: judgeChildren,
      },
    ];
    if (snippetStories.length > 0) {
      draftChildren.push({
        id: 'snippets',
        title: 'RSS SNIPPETS',
        metric: `${snippetStories.length} fallback`,
        tone: 'orange',
      });
    }

    const rankChildren: V3TraceNode[] = [
      {
        id: 'draft',
        title: '3. SUMMARIZE',
        metric: `${fullTextStories.length} full text`,
        sublabel: `${todayItems.length} drafted`,
        children: draftChildren,
      },
    ];
    if (hasStats && filteredOut > 0) {
      rankChildren.push({
        id: 'filtered',
        title: 'BELOW CAP',
        metric: `${filteredOut} dropped`,
      });
    }

    const scanChildren: V3TraceNode[] = [
      {
        id: 'rank',
        title: '2. SELECT',
        metric: `${todayItems.length} picked`,
        sublabel: hasStats ? `from ${newCandidates} new` : 'Top stories',
        children: rankChildren,
      },
    ];
    if (hasStats && alreadySeen > 0) {
      scanChildren.push({
        id: 'seen',
        title: 'SEEN EARLIER',
        metric: `${alreadySeen} skipped`,
      });
    }

    return {
      id: 'scan',
      title: '1. COLLECT',
      metric: hasStats ? `${mergedEvents} unique` : `${enabledSourcesCount} feeds`,
      sublabel: hasStats ? `${rawHeadlines} scanned` : 'RSS scan',
      children: scanChildren,
    };
  }, [
    alreadySeen,
    counts.needsReview,
    counts.published,
    counts.rejected,
    enabledSourcesCount,
    filteredOut,
    flaggedStories.length,
    fullTextStories.length,
    hasStats,
    mergedEvents,
    newCandidates,
    passedStories.length,
    rawHeadlines,
    snippetStories.length,
    todayItems.length,
  ]);

  const traceNodeStories = useMemo(() => {
    switch (selectedTraceNode) {
      case 'snippets':
      case 'unverified':
        return snippetStories;
      case 'flagged':
        return flaggedStories;
      case 'judge':
        return passedStories;
      case 'draft':
        return fullTextStories;
      case 'signoff':
        return todayItems.filter((a) => a.status === 'draft');
      default:
        return todayItems;
    }
  }, [
    flaggedStories,
    fullTextStories,
    passedStories,
    selectedTraceNode,
    snippetStories,
    todayItems,
  ]);

  const lastRunTimestamp = latestRunLog?.at
    ? `${latestRunLog.at.slice(0, 16).replace('T', ' ')} UTC`
    : 'No recent run recorded';

  return (
    <View style={{ gap: V3_SPACE.xl }}>
      {/* JOB 1: COLLECT NEWS */}
      <View style={{ gap: V3_SPACE.md }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: V3_SPACE.md,
          }}
        >
          <View style={{ gap: 2 }}>
            <V3Text role="kicker" tone="green">
              01 · COLLECT NEWS
            </V3Text>
            <V3Text role="section">Daily Collection</V3Text>
          </View>
          <V3Text role="mono" tone="muted">
            SCHEDULE: {collectionScheduleLabel} · {enabledSourcesCount} SOURCES
          </V3Text>
        </View>

        {needsCollectionToday ? (
          <V3Card
            variant="filled"
            style={{
              backgroundColor: V3_COLORS.orangeSoft,
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: V3_SPACE.md,
            }}
          >
            <View style={{ flex: 1, minWidth: 260, gap: V3_SPACE.xs }}>
              <V3Badge label="MISSED RUN" tone="pending" />
              <V3Text role="headline">
                {missedRunNotice?.title ||
                  `Today's news (${today}) has not been collected yet.`}
              </V3Text>
              <V3Text role="body" tone="muted">
                {missedRunNotice?.detail ||
                  'Run today’s collection to scan enabled RSS feeds and prepare stories for review.'}
              </V3Text>
            </View>
            <V3Button
              label="Start collecting News"
              variant="dark"
              onPress={onStartCollecting}
            />
          </V3Card>
        ) : (
          <V3Card
            variant="outlined"
            padding="lg"
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: V3_SPACE.md,
            }}
          >
            <View style={{ gap: 2 }}>
              <V3Text role="headline">
                Collected {todayItems.length} stories for {today}
              </V3Text>
              <V3Text role="mono" tone="muted">
                LAST COLLECTION: {lastRunTimestamp} · POLICY{' '}
                {activePolicy.active_version.toUpperCase()}
              </V3Text>
            </View>
            <V3Button
              label="Collect Again"
              variant="outline"
              size="sm"
              onPress={onStartCollecting}
            />
          </V3Card>
        )}
      </View>

      <V3Rule strong />

      {/* JOB 2: REVIEW & PUBLISH (TODAY'S EDITION) */}
      <View style={{ gap: V3_SPACE.lg }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: V3_SPACE.md,
          }}
        >
          <View style={{ gap: 2 }}>
            <V3Text role="kicker" tone="green">
              02 · REVIEW &amp; PUBLISH
            </V3Text>
            <V3Text role="title">Today&apos;s edition</V3Text>
            <V3Text role="mono" tone="muted">
              {todayItems.length} COLLECTED · {counts.needsReview} TO REVIEW ·{' '}
              {counts.published} PUBLISHED · {counts.rejected} REJECTED
            </V3Text>
          </View>

          <V3Tabs
            options={[
              { id: 'stories', label: 'Stories' },
              { id: 'trace', label: 'Trace' },
            ]}
            value={editionTab}
            onChange={setEditionTab}
          />
        </View>

        {editionTab === 'stories' ? (
          <StoryReviewAccordion
            key={`stories-${today}-${todayItems.length}`}
            stories={todayItems}
            emptyLabel="No stories collected for this edition yet."
            onViewDetails={onViewDetails}
            onApproveArticle={onApproveArticle}
            onRejectArticle={onRejectArticle}
          />
        ) : (
          <View style={{ gap: V3_SPACE.lg }}>
            <V3Card variant="outlined" padding="lg">
              <TreeV3
                rootData={traceRoot}
                selectedNodeId={selectedTraceNode}
                onSelectNode={setSelectedTraceNode}
              />
            </V3Card>

            <View style={{ gap: V3_SPACE.sm }}>
              <V3Text role="kicker" tone="muted">
                SELECTED NODE STORIES ({traceNodeStories.length})
              </V3Text>
              <StoryReviewAccordion
                key={`trace-${selectedTraceNode}-${traceNodeStories.length}`}
                stories={traceNodeStories}
                emptyLabel="No stories in this stage."
                onViewDetails={onViewDetails}
                onApproveArticle={onApproveArticle}
                onRejectArticle={onRejectArticle}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
