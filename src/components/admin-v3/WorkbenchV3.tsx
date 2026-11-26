import {
  computeTodayCounts,
  getEditorialState,
  getMissedRunNotice,
  getQueueReviewReason,
  isSnippetOnlyUnverified,
} from '@/lib/editorialLabels';
import type { ActivePolicyDoc, Article, PipelineRunLog } from '@/types/article';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  V3AccordionItem,
  V3Badge,
  V3Button,
  V3Card,
  V3Tabs,
  V3Text
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

function formatEditionDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d
    .toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    })
    .toUpperCase();
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
  const [storyFilter, setStoryFilter] = useState<
    'all' | 'review' | 'published' | 'rejected'
  >('all');
  const [editorialFilter, setEditorialFilter] = useState<
    'all' | 'ready' | 'check' | 'unverified'
  >('all');
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

  const draftStories = useMemo(
    () => todayItems.filter((a) => a.status === 'draft'),
    [todayItems]
  );

  const statusFilteredStories = useMemo(() => {
    switch (storyFilter) {
      case 'review':
        return draftStories;
      case 'published':
        return todayItems.filter((a) => a.status === 'published');
      case 'rejected':
        return todayItems.filter((a) => a.status === 'rejected');
      default:
        return todayItems;
    }
  }, [draftStories, storyFilter, todayItems]);

  const editorialSubCounts = useMemo(() => {
    let ready = 0;
    let check = 0;
    let unverified = 0;
    for (const item of draftStories) {
      const state = getEditorialState(item);
      if (state === 'Ready to approve') ready += 1;
      else if (state === 'Needs a check') check += 1;
      else unverified += 1;
    }
    return { ready, check, unverified };
  }, [draftStories]);

  const filteredStories = useMemo(() => {
    if (editorialFilter === 'all') return statusFilteredStories;
    const targetState =
      editorialFilter === 'ready'
        ? 'Ready to approve'
        : editorialFilter === 'check'
          ? 'Needs a check'
          : 'Could not verify';
    return draftStories.filter(
      (a) => getEditorialState(a) === targetState
    );
  }, [draftStories, editorialFilter, statusFilteredStories]);

  const storiesEmptyLabel =
    editorialFilter === 'ready'
      ? 'No stories ready to approve in this view.'
      : editorialFilter === 'check'
        ? 'No stories needing a check in this view.'
        : editorialFilter === 'unverified'
          ? 'No unverified stories in this view.'
          : storyFilter === 'review'
            ? 'No stories waiting for review.'
            : storyFilter === 'published'
              ? 'No published stories in this edition yet.'
              : storyFilter === 'rejected'
                ? 'No rejected stories in this edition.'
                : 'No stories collected for this edition yet.';

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
      {/* STANDARD PAGE HEADER (matches System & Settings) */}
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
          <V3Text role="kicker" tone="accent">
            {formatEditionDateLabel(today)} · {lastRunTimestamp}
          </V3Text>
          <V3Text role="title">Today&apos;s edition</V3Text>
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

      {/* JOB 1: COLLECT NEWS / MISSED RUN ERROR ALERT */}
      {needsCollectionToday ? (
        <V3Card
          variant="filled"
          style={{
            backgroundColor: V3_COLORS.dangerSoft,
            borderLeftWidth: 3,
            borderLeftColor: V3_COLORS.danger,
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: V3_SPACE.md,
          }}
        >
          <View style={{ flex: 1, minWidth: 260, gap: V3_SPACE.xs }}>
            <V3Badge label="PIPELINE ERROR · MISSED RUN" tone="rejected" />
            <V3Text role="headline" tone="danger">
              {missedRunNotice?.title ||
                `Today's news (${today}) has not been collected yet.`}
            </V3Text>
            <V3Text role="body" tone="ink">
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

      {/* JOB 2: REVIEW & PUBLISH (TODAY'S EDITION) */}
      <View style={{ gap: V3_SPACE.lg }}>
        <View style={{ gap: V3_SPACE.sm }}>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: V3_SPACE.md,
            }}
          >
            <V3Tabs
              options={[
                { id: 'all', label: `${todayItems.length} Collected` },
                { id: 'review', label: `${counts.needsReview} To Review` },
                { id: 'published', label: `${counts.published} Published` },
                { id: 'rejected', label: `${counts.rejected} Rejected` },
              ]}
              value={storyFilter}
              onChange={(next) => {
                setStoryFilter(next);
                setEditorialFilter('all');
                if (editionTab !== 'stories') {
                  setEditionTab('stories');
                }
              }}
            />
          </View>

          {(storyFilter === 'all' || storyFilter === 'review') ? (
            <V3Tabs
              options={[
                { id: 'all', label: `All (${statusFilteredStories.length})` },
                {
                  id: 'ready',
                  label: `${editorialSubCounts.ready} Ready to approve`,
                },
                {
                  id: 'check',
                  label: `${editorialSubCounts.check} Needs a check`,
                },
                {
                  id: 'unverified',
                  label: `${editorialSubCounts.unverified} Could not verify`,
                },
              ]}
              value={editorialFilter}
              onChange={(next) => {
                setEditorialFilter(next);
                if (next !== 'all' && storyFilter !== 'review') {
                  setStoryFilter('review');
                }
                if (editionTab !== 'stories') {
                  setEditionTab('stories');
                }
              }}
            />
          ) : null}
        </View>

        {editionTab === 'stories' ? (
          <StoryReviewAccordion
            key={`stories-${today}-${storyFilter}-${editorialFilter}-${filteredStories.length}`}
            stories={filteredStories}
            emptyLabel={storiesEmptyLabel}
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
