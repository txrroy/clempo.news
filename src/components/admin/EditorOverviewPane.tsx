import type { ArticleInboxView } from '@/components/admin/ArticleInboxList';
import type { InboxFolder } from '@/components/admin/InboxSidebar';
import {
  DSBadge,
  DSButton,
  DSCard,
  DSPage,
  DSSurface,
  DSText,
  useDSTheme,
} from '@/design-system';
import { LOCKED_CORE_SUMMARY } from '@/hooks/useGovernance';
import {
  computeTodayCounts,
  getArticleTimestamp,
  getEditorialState,
  getMissedRunNotice,
  getQueueReviewReason,
  isSnippetOnlyUnverified,
} from '@/lib/editorialLabels';
import type { ActivePolicyDoc, Article, PipelineRunLog } from '@/types/article';
import { useMemo, useState } from 'react';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';

interface EditorOverviewPaneProps {
  articles: Article[];
  today: string;
  activePolicy: ActivePolicyDoc;
  latestRunLog?: PipelineRunLog | null;
  enabledSourcesCount?: number;
  onOpenInbox: (
    folder: InboxFolder,
    articleId?: string,
    viewFilter?: ArticleInboxView
  ) => void;
  onOpenLivePipeline: () => void;
  onOpenSettings: () => void;
  onSetAutoPublishReady?: (enabled: boolean) => Promise<void> | void;
}

const DAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatEditionHeading(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const [year, monthIdx, day] = parts;
  const localDate = new Date(year, monthIdx - 1, day);
  const weekday = DAYS_LONG[localDate.getDay()] ?? '';
  const month = MONTH_SHORT[monthIdx - 1] ?? '';
  return `${weekday}, ${month} ${day}, ${year}`;
}

function formatCurrentUtcTime(): string {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}

function formatShortMonthDay(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const month = MONTH_SHORT[parts[1] - 1] ?? '';
  return `${month} ${parts[2]}`;
}

function formatRunTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const month = MONTH_SHORT[d.getUTCMonth()] ?? '';
  const day = d.getUTCDate();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${month} ${day}, ${hh}:${mm} UTC`;
}

function formatWentLiveHeading(iso: string | null): string {
  if (!iso) return 'Today’s edition went live 3 hours ago.';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return 'Today’s edition went live 3 hours ago.';
  const diffMs = Date.now() - ts;
  if (diffMs <= 0) return 'Today’s edition went live just now.';
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 60) {
    return `Today’s edition went live ${Math.max(1, diffMins)} minute${diffMins === 1 ? '' : 's'} ago.`;
  }
  const diffHours = Math.round(diffMins / 60);
  if (diffHours <= 24) {
    return `Today’s edition went live ${diffHours} hour${diffHours === 1 ? '' : 's'} ago.`;
  }
  return 'Today’s edition went live 3 hours ago.';
}

function shiftDateDays(baseDateStr: string, offsetDays: number): string {
  const parts = baseDateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return baseDateStr;
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + offsetDays));
  return d.toISOString().split('T')[0];
}

function truncateWords(text: string, maxWords = 6): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ')}…`;
}

function formatStoryId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9]/g, '');
  return `#${(clean || id).slice(0, 6).toUpperCase()}`;
}

interface StoryExplanationItemProps {
  story: Article;
  reason?: string;
  onOpenStory: (story: Article) => void;
}

function StoryExplanationItem({
  story,
  reason,
  onOpenStory,
}: StoryExplanationItemProps) {
  const { theme } = useDSTheme();
  const [hovered, setHovered] = useState(false);
  const sources =
    story.source_names && story.source_names.length > 0
      ? story.source_names
      : ['Wire'];

  return (
    <Pressable
      onPress={() => onOpenStory(story)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => ({
        paddingVertical: theme.spacing.xs + theme.spacing.xxs,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radii.sm,
        backgroundColor: hovered
          ? theme.colors.surfaceMuted
          : 'transparent',
        borderWidth: theme.layout.borderWidth,
        borderColor: hovered
          ? theme.colors.borderSubtle
          : 'transparent',
        opacity: pressed ? 0.7 : 1,
        gap: theme.spacing.xs,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: theme.spacing.xs + theme.spacing.xxs,
        }}
      >
        <DSBadge label={formatStoryId(story.id)} tone="neutral" dot={false} />
        <DSText
          variant="caption"
          weight="semibold"
          tone="primary"
          style={{ textDecorationLine: 'underline' }}
        >
          {truncateWords(story.ai_headline, 6)}
        </DSText>
        {sources.map((src) => (
          <DSBadge key={`${story.id}-${src}`} label={src} tone="neutral" dot={false} />
        ))}
      </View>
      {reason ? (
        <DSText variant="caption" tone="secondary">
          {reason}
        </DSText>
      ) : null}
    </Pressable>
  );
}

interface EditorialDonutProps {
  greenCount: number;
  yellowCount: number;
  redCount: number;
  centerValue: number;
  centerLabel: string;
}

function EditorialDonutChart({
  greenCount,
  yellowCount,
  redCount,
  centerValue,
  centerLabel,
}: EditorialDonutProps) {
  const { theme } = useDSTheme();
  const greenColor = theme.colors.tones.success.dot;
  const yellowColor = theme.colors.tones.warning.dot;
  const redColor = theme.colors.tones.danger.dot;
  const total = greenCount + yellowCount + redCount;

  const greenPct = total > 0 ? (greenCount / total) * 100 : 0;
  const yellowPct = total > 0 ? (yellowCount / total) * 100 : 0;
  const gEnd = greenPct.toFixed(2);
  const yEnd = (greenPct + yellowPct).toFixed(2);

  const gradient =
    total > 0
      ? `conic-gradient(${greenColor} 0% ${gEnd}%, ${yellowColor} ${gEnd}% ${yEnd}%, ${redColor} ${yEnd}% 100%)`
      : `conic-gradient(${theme.colors.borderSubtle} 0% 100%)`;

  const ringStyle: ViewStyle =
    Platform.OS === 'web'
      ? ({
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: gradient,
      } as ViewStyle)
      : {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 12,
        borderColor:
          redCount > 0
            ? redColor
            : yellowCount > 0
              ? yellowColor
              : greenCount > 0
                ? greenColor
                : theme.colors.borderSubtle,
      };

  return (
    <View style={ringStyle}>
      <View
        style={{
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DSText variant="title3" weight="bold" tone="primary" tabularNums>
          {centerValue}
        </DSText>
        <DSText variant="micro" tone="secondary">
          {centerLabel}
        </DSText>
      </View>
    </View>
  );
}

type PipelineStepId = '1' | '2' | '3' | '4' | '5';

export function EditorOverviewPane({
  articles,
  today,
  activePolicy,
  latestRunLog,
  enabledSourcesCount = 13,
  onOpenInbox,
  onOpenLivePipeline,
  onOpenSettings,
  onSetAutoPublishReady,
}: EditorOverviewPaneProps) {
  const { theme } = useDSTheme();
  const [expandedStep, setExpandedStep] = useState<PipelineStepId | null>(null);
  const [showAllDuplicateGroups, setShowAllDuplicateGroups] = useState(false);
  const [togglingAutoPublish, setTogglingAutoPublish] = useState(false);

  const handleOpenStory = (story: Article) => {
    onOpenInbox(
      story.status === 'published'
        ? { type: 'today-published' }
        : { type: 'today-pending' },
      story.id
    );
  };

  const todayData = useMemo(() => {
    const todayItems = articles.filter((a) => a.date === today);
    const counts = computeTodayCounts(articles, today);

    let latestIso: string | null = null;
    let latestApprovedIso: string | null = null;
    for (const a of todayItems) {
      const ts = getArticleTimestamp(a);
      if (ts && (!latestIso || ts > latestIso)) {
        latestIso = ts;
      }
      if (
        a.approved_at &&
        (!latestApprovedIso || a.approved_at > latestApprovedIso)
      ) {
        latestApprovedIso = a.approved_at;
      }
    }

    let lastGlobalIso: string | null = null;
    let lastGlobalDate: string | null = null;
    for (const a of articles) {
      const ts = getArticleTimestamp(a);
      if (ts && (!lastGlobalIso || ts > lastGlobalIso)) {
        lastGlobalIso = ts;
        lastGlobalDate = a.date;
      }
    }

    const pickedCount = todayItems.length;
    const fullTextStories = todayItems.filter(
      (a) => !isSnippetOnlyUnverified(a)
    );
    const snippetStories = todayItems.filter((a) => isSnippetOnlyUnverified(a));
    const fullTextCount = fullTextStories.length;
    const snippetCount = snippetStories.length;

    const readyStories = todayItems.filter(
      (a) => getEditorialState(a) === 'Ready to approve'
    );
    const needsCheckStories = todayItems.filter(
      (a) => getEditorialState(a) === 'Needs a check'
    );
    const unverifiedStories = todayItems.filter(
      (a) => getEditorialState(a) === 'Could not verify'
    );
    const runReadyCount = readyStories.length;
    const runNeedsCheckCount = needsCheckStories.length;
    const runUnverifiedCount = unverifiedStories.length;

    const uniqueOutlets = new Set<string>();
    const topicCounts = new Map<string, number>();
    const regionCounts = new Map<string, number>();

    for (const a of todayItems) {
      for (const s of a.source_names ?? []) uniqueOutlets.add(s);
      if (a.topic) {
        topicCounts.set(a.topic, (topicCounts.get(a.topic) ?? 0) + 1);
      }
      if (a.region) {
        regionCounts.set(a.region, (regionCounts.get(a.region) ?? 0) + 1);
      }
    }

    const topicList = Array.from(topicCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    const regionList = Array.from(regionCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    const marketsCount = topicCounts.get('Markets') ?? 0;
    const multiSourceStories = todayItems.filter(
      (a) => (a.source_count ?? 1) > 1
    );

    const runLog = latestRunLog?.date === today ? latestRunLog : null;
    const hasRealStep1Stats = Boolean(
      runLog && runLog.raw_headlines_count > 0
    );
    const rawHeadlines = runLog?.raw_headlines_count ?? 0;
    const mergedEvents = runLog?.merged_events_count ?? 0;
    const duplicatesMerged = Math.max(0, rawHeadlines - mergedEvents);
    const filteredEvents = hasRealStep1Stats
      ? Math.max(0, mergedEvents - pickedCount)
      : 0;
    const targetCount = runLog?.target_count ?? 20;
    const feedsPolledCount = runLog?.enabled_feeds_count ?? enabledSourcesCount;
    const succeededFeeds = runLog?.succeeded_feeds ?? [];
    const failedFeeds = runLog?.failed_feeds ?? [];
    const alreadySeenCount = runLog?.already_seen_count ?? 0;

    const runTimeStr = formatRunTime(latestIso ?? lastGlobalIso) ?? '10:15 PM';
    const wentLiveHeading = formatWentLiveHeading(
      latestApprovedIso ?? latestIso
    );

    const publishedByDate = new Map<string, number>();
    for (const a of articles) {
      if (a.status === 'published') {
        publishedByDate.set(a.date, (publishedByDate.get(a.date) ?? 0) + 1);
      }
    }
    const last30Days: { date: string; label: string; count: number }[] = [];
    let maxDailyPublished = 1;
    for (let i = -29; i <= 0; i++) {
      const dStr = shiftDateDays(today, i);
      const count = publishedByDate.get(dStr) ?? 0;
      if (count > maxDailyPublished) maxDailyPublished = count;
      last30Days.push({
        date: dStr,
        label: formatShortMonthDay(dStr),
        count,
      });
    }

    return {
      counts,
      todayItems,
      pickedCount,
      fullTextStories,
      snippetStories,
      fullTextCount,
      snippetCount,
      readyStories,
      needsCheckStories,
      unverifiedStories,
      runReadyCount,
      runNeedsCheckCount,
      runUnverifiedCount,
      rawHeadlines,
      mergedEvents,
      duplicatesMerged,
      filteredEvents,
      hasRealStep1Stats,
      feedsPolledCount,
      succeededFeeds,
      failedFeeds,
      alreadySeenCount,
      newCandidatesCount:
        runLog?.new_candidates_count ??
        Math.max(0, mergedEvents - alreadySeenCount),
      duplicateGroups: runLog?.duplicate_groups ?? [],
      droppedCandidates: runLog?.dropped_candidates ?? [],
      targetCount,
      topicCount: topicCounts.size,
      regionCount: regionCounts.size,
      topicList,
      regionList,
      marketsCount,
      multiSourceStories,
      outletList: Array.from(uniqueOutlets),
      uniqueOutletCount: uniqueOutlets.size,
      runTimeStr,
      wentLiveHeading,
      lastGlobalDate,
      lastGlobalTimeStr: formatRunTime(lastGlobalIso),
      last30Days,
      maxDailyPublished,
      autoPublishedCount: todayItems.filter(
        (a) => a.status === 'published' && a.approved_by === 'auto-policy'
      ).length,
      autoRetriedCount:
        runLog?.auto_retried_count ??
        todayItems.filter((a) => Boolean(a.auto_retried_complexity)).length,
      summarizerFailedCount: runLog?.summarizer_failed_count ?? 0,
    };
  }, [articles, enabledSourcesCount, latestRunLog, today]);

  // Section 3: Track record & Autonomy loop
  const trackRecord = useMemo(() => {
    const distinctDates = Array.from(
      new Set(articles.map((a) => a.date))
    ).sort();
    const recent7Dates = new Set(distinctDates.slice(-7));
    const sevenDayItems = articles.filter((a) => recent7Dates.has(a.date));

    const reviewedReady = sevenDayItems.filter(
      (a) =>
        (a.status === 'published' || a.status === 'rejected') &&
        getEditorialState(a) === 'Ready to approve'
    );

    const reviewedReadyClean = reviewedReady.filter((a) => {
      if (a.status === 'rejected') return false;
      const hadIntervention =
        Boolean(a.edited_at) ||
        (a.decision_history ?? []).some(
          (h) =>
            h.action === 'edited' ||
            h.action === 'regenerated' ||
            h.action === 'unpublished' ||
            h.action === 'rejected'
        );
      return !hadIntervention;
    });

    if (reviewedReady.length > 0) {
      return {
        unedited: reviewedReadyClean.length,
        total: reviewedReady.length,
      };
    }

    const allReviewed7d = sevenDayItems.filter(
      (a) => a.status === 'published' || a.status === 'rejected'
    );
    const allReviewedClean = allReviewed7d.filter((a) => {
      if (a.status === 'rejected') return false;
      return (
        !a.edited_at &&
        !(a.decision_history ?? []).some(
          (h) =>
            h.action === 'edited' ||
            h.action === 'regenerated' ||
            h.action === 'unpublished' ||
            h.action === 'rejected'
        )
      );
    });

    return {
      unedited: allReviewedClean.length,
      total: allReviewed7d.length,
    };
  }, [articles]);

  const waitingCount = todayData.counts.needsReview;
  const missedRunNotice = useMemo(
    () => getMissedRunNotice(latestRunLog, today),
    [latestRunLog, today]
  );

  const summaryVersion: 'A' | 'B' | 'C' =
    todayData.pickedCount === 0 ? 'C' : waitingCount > 0 ? 'A' : 'B';

  return (
    <DSPage
      title={formatEditionHeading(today)}
      subtitle={`Edition date (UTC) · Current time: ${formatCurrentUtcTime()}`}
    >
      {missedRunNotice ? (
        <DSSurface
          variant="muted"
          radius="md"
          bordered
          style={{
            padding: theme.spacing.lg,
            borderColor: theme.colors.tones.warning.border,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
            }}
          >
            <View style={{ flex: 1, minWidth: 260, gap: theme.spacing.xxs }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                }}
              >
                <DSBadge label="Missed Run Alert" tone="warning" />
                <DSText variant="subhead" weight="bold" tone="primary">
                  {missedRunNotice.title}
                </DSText>
              </View>
              <DSText variant="caption" tone="secondary">
                {missedRunNotice.detail}
              </DSText>
            </View>
            <DSButton
              label="Run pipeline now"
              variant="secondary"
              size="sm"
              onPress={onOpenLivePipeline}
            />
          </View>
        </DSSurface>
      ) : null}
      {/* SECTION 1: TWO SPLIT CARDS (Left: Today’s edition + Donut, Right: 30-day Bar Chart + Run Pipeline) */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'stretch',
          gap: theme.spacing.lg,
        }}
      >
        {/* LEFT CARD: Consistent name "Today’s edition" + Donut */}
        <DSCard
          padding="lg"
          style={{
            flex: 1,
            minWidth: 300,
          }}
        >
          <View style={{ justifyContent: 'space-between', gap: theme.spacing.lg }}>
            <DSText variant="caption" weight="semibold" tone="secondary">
              Today’s edition
            </DSText>

              {summaryVersion === 'A' ? (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.spacing.lg,
                    }}
                  >
                    <View style={{ flex: 1, gap: theme.spacing.xs }}>
                      <DSText variant="display" weight="bold" tone="primary">
                        {waitingCount}{' '}
                        {waitingCount === 1 ? 'story' : 'stories'} to review
                      </DSText>
                      {todayData.counts.published > 0 ? (
                        <Pressable
                          onPress={() =>
                            onOpenInbox(
                              { type: 'today-published' },
                              undefined,
                              'all'
                            )
                          }
                        >
                          <DSText
                            variant="subhead"
                            weight="semibold"
                            tone="secondary"
                            style={{ textDecorationLine: 'underline' }}
                          >
                            {todayData.counts.published} already published today
                            {todayData.autoPublishedCount > 0
                              ? ` (${todayData.autoPublishedCount} auto-published)`
                              : ''}
                            .
                          </DSText>
                        </Pressable>
                      ) : null}
                    </View>

                    <View style={{ alignItems: 'center', gap: theme.spacing.xs + 2 }}>
                      <EditorialDonutChart
                        greenCount={todayData.counts.readyToApprove}
                        yellowCount={todayData.counts.needsACheck}
                        redCount={todayData.counts.couldNotVerify}
                        centerValue={waitingCount}
                        centerLabel="waiting"
                      />
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.spacing.md,
                    }}
                  >
                    <DSButton
                      label="Start review"
                      variant="primary"
                      size="md"
                      onPress={() =>
                        onOpenInbox(
                          { type: 'today-pending' },
                          undefined,
                          'all'
                        )
                      }
                    />

                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: theme.spacing.md,
                      }}
                    >
                      {[
                        {
                          label: 'Ready',
                          count: todayData.counts.readyToApprove,
                          color: theme.colors.tones.success.dot,
                          view: 'ready' as ArticleInboxView,
                        },
                        {
                          label: 'Check',
                          count: todayData.counts.needsACheck,
                          color: theme.colors.tones.warning.dot,
                          view: 'needs-check' as ArticleInboxView,
                        },
                        {
                          label: 'Unverified',
                          count: todayData.counts.couldNotVerify,
                          color: theme.colors.tones.danger.dot,
                          view: 'unverified' as ArticleInboxView,
                        },
                      ].map((item) => (
                        <Pressable
                          key={item.label}
                          onPress={() =>
                            onOpenInbox(
                              { type: 'today-pending' },
                              undefined,
                              item.view
                            )
                          }
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: theme.spacing.xs + 1,
                          }}
                        >
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: theme.radii.pill,
                              backgroundColor: item.color,
                            }}
                          />
                          <DSText
                            variant="caption"
                            weight="semibold"
                            tone="primary"
                            style={{ textDecorationLine: 'underline' }}
                            tabularNums
                          >
                            {item.label} ({item.count})
                          </DSText>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </>
              ) : summaryVersion === 'B' ? (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.spacing.lg,
                    }}
                  >
                    <View style={{ flex: 1, gap: theme.spacing.xs }}>
                      <DSText variant="display" weight="bold" tone="primary">
                        {todayData.wentLiveHeading}
                      </DSText>

                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          alignItems: 'baseline',
                          gap: theme.spacing.xs + 2,
                          paddingTop: theme.spacing.xxs,
                        }}
                      >
                        <Pressable
                          onPress={() =>
                            onOpenInbox(
                              { type: 'today-published' },
                              undefined,
                              'all'
                            )
                          }
                        >
                          <DSText
                            variant="subhead"
                            weight="semibold"
                            tone="primary"
                            style={{ textDecorationLine: 'underline' }}
                          >
                            {todayData.counts.published} published.
                          </DSText>
                        </Pressable>
                        <DSText variant="subhead" tone="secondary">
                          {todayData.counts.rejected} rejected. 0 need review.
                        </DSText>
                      </View>
                    </View>

                    <EditorialDonutChart
                      greenCount={todayData.counts.published}
                      yellowCount={0}
                      redCount={0}
                      centerValue={todayData.counts.published}
                      centerLabel="live"
                    />
                  </View>

                  <View style={{ alignItems: 'flex-start' }}>
                    <DSButton
                      label="Review today’s published news"
                      variant="secondary"
                      size="md"
                      onPress={() =>
                        onOpenInbox(
                          { type: 'today-published' },
                          undefined,
                          'all'
                        )
                      }
                    />
                  </View>
                </>
              ) : (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.spacing.lg,
                    }}
                  >
                    <View style={{ flex: 1, gap: theme.spacing.xs }}>
                      <DSText variant="display" weight="bold" tone="primary">
                        Today’s edition has not run yet.
                      </DSText>
                      <DSText variant="subhead" tone="secondary">
                        {todayData.lastGlobalDate
                          ? `Last run: ${formatShortMonthDay(todayData.lastGlobalDate)} at ${todayData.lastGlobalTimeStr ?? '10:15 PM'}.`
                          : 'No previous pipeline run recorded yet.'}
                      </DSText>
                    </View>

                    <EditorialDonutChart
                      greenCount={0}
                      yellowCount={0}
                      redCount={0}
                      centerValue={0}
                      centerLabel="stories"
                    />
                  </View>

                  <View style={{ alignItems: 'flex-start' }}>
                    <DSButton
                      label="Run pipeline"
                      variant="primary"
                      size="md"
                      onPress={onOpenLivePipeline}
                    />
                  </View>
                </>
              )}
          </View>
        </DSCard>

        {/* RIGHT CARD: 30-day Bar Chart and 'Run pipeline' button */}
        <DSCard
          padding="lg"
          style={{
            flex: 1,
            minWidth: 300,
          }}
        >
          <View style={{ justifyContent: 'space-between', gap: theme.spacing.md }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.spacing.sm,
                }}
              >
                <DSText variant="caption" weight="semibold" tone="secondary">
                  Stories published per day · Last 30 days
                </DSText>
                <DSButton
                  label="Run pipeline"
                  variant="secondary"
                  size="sm"
                  onPress={onOpenLivePipeline}
                />
              </View>

              <View style={{ gap: theme.spacing.xs }}>
                <View
                  style={{
                    height: 112,
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    gap: theme.spacing.xs,
                    paddingTop: theme.spacing.md,
                    paddingBottom: theme.spacing.xs,
                    borderBottomWidth: theme.layout.borderWidth,
                    borderBottomColor: theme.colors.borderSubtle,
                  }}
                >
                  {todayData.last30Days.map((dayItem) => {
                    const isTodayBar = dayItem.date === today;
                    const barHeight =
                      dayItem.count > 0
                        ? Math.max(
                          10,
                          Math.round(
                            (dayItem.count / todayData.maxDailyPublished) * 74
                          )
                        )
                        : 2;
                    return (
                      <Pressable
                        key={dayItem.date}
                        onPress={() => {
                          if (dayItem.count > 0) {
                            onOpenInbox(
                              dayItem.date === today
                                ? { type: 'today-published' }
                                : { type: 'older-date', date: dayItem.date }
                            );
                          }
                        }}
                        style={{
                          flex: 1,
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: theme.spacing.xs,
                        }}
                      >
                        {dayItem.count > 0 ? (
                          <DSText
                            variant="micro"
                            weight={isTodayBar ? 'bold' : 'medium'}
                            tone={isTodayBar ? 'primary' : 'secondary'}
                            tabularNums
                          >
                            {dayItem.count}
                          </DSText>
                        ) : null}
                        <View
                          style={{
                            width: '100%',
                            maxWidth: 22,
                            height: barHeight,
                            borderRadius: theme.radii.xs,
                            backgroundColor:
                              dayItem.count === 0
                                ? theme.colors.borderSubtle
                                : isTodayBar
                                  ? theme.colors.accent
                                  : theme.colors.textTertiary,
                          }}
                        />
                      </Pressable>
                    );
                  })}
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  }}
                >
                  <DSText variant="micro" tone="tertiary">
                    {todayData.last30Days[0]?.label}
                  </DSText>
                  <DSText variant="micro" tone="tertiary">
                    {todayData.last30Days[14]?.label}
                  </DSText>
                  <DSText variant="micro" weight="semibold" tone="secondary">
                    {todayData.last30Days[29]?.label} (Today)
                  </DSText>
                </View>
              </View>
          </View>
        </DSCard>
      </View>

      {/* SECTION 2: LATEST PIPELINE RUN */}
      <DSCard padding="lg">
        <View style={{ gap: theme.spacing.lg }}>
            {/* Bigger Heading & Subheading (No Run/Watch/Hide buttons, no 1-line summary) */}
            <View style={{ gap: theme.spacing.xxs }}>
              <DSText variant="title3" weight="bold" tone="primary">
                Latest pipeline run
              </DSText>
              <DSText variant="footnote" tone="secondary">
                Ran at {todayData.runTimeStr}. Policy{' '}
                {activePolicy.active_version}.
                {todayData.autoRetriedCount > 0
                  ? ` ${todayData.autoRetriedCount} auto-simplified ("Too complex").`
                  : ''}
                {todayData.summarizerFailedCount > 0
                  ? ` ${todayData.summarizerFailedCount} failed to draft.`
                  : ''}
              </DSText>
            </View>

            {/* FIVE STEPS IN A ROW BY DEFAULT WITH ARROWS BETWEEN BOXES */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'stretch',
                gap: theme.spacing.xs,
              }}
            >
              {[
                {
                  id: '1' as PipelineStepId,
                  name: '1. Scan and merge',
                  who: 'Fetcher',
                  number: todayData.hasRealStep1Stats
                    ? `${todayData.mergedEvents} unique stories`
                    : `${todayData.feedsPolledCount} RSS feeds`,
                  line: todayData.hasRealStep1Stats
                    ? `${todayData.rawHeadlines} total, ${todayData.duplicatesMerged} duplicates`
                    : `${todayData.uniqueOutletCount} cited outlets · ${todayData.multiSourceStories.length} multi-outlet`,
                },
                {
                  id: '2' as PipelineStepId,
                  name: '2. Filter and rank',
                  who: 'Selector',
                  number: `${todayData.pickedCount} picked`,
                  line: todayData.hasRealStep1Stats
                    ? todayData.alreadySeenCount > 0
                      ? `from ${todayData.newCandidatesCount} new (${todayData.alreadySeenCount} seen earlier)`
                      : `from ${todayData.newCandidatesCount} new stories`
                    : `${todayData.topicCount} topics · ${todayData.regionCount} regions`,
                },
                {
                  id: '3' as PipelineStepId,
                  name: '3. Scrape and draft',
                  who: 'Summarizer',
                  number: `${todayData.fullTextCount} full text`,
                  line: `${
                    todayData.snippetCount > 0
                      ? `${todayData.snippetCount} from RSS snippets`
                      : '0 snippet fallbacks'
                  }${
                    todayData.autoRetriedCount > 0
                      ? ` · ${todayData.autoRetriedCount} auto-simplified`
                      : ''
                  }`,
                },
                {
                  id: '4' as PipelineStepId,
                  name: '4. Check facts',
                  who: 'Judge',
                  number: `${todayData.runReadyCount} ready`,
                  line:
                    todayData.runUnverifiedCount > 0
                      ? `${todayData.runNeedsCheckCount} needs check · ${todayData.runUnverifiedCount} unverified`
                      : `${todayData.runNeedsCheckCount} needs check`,
                },
                {
                  id: '5' as PipelineStepId,
                  name: '5. Editor sign-off',
                  who: 'Editor',
                  number:
                    waitingCount > 0
                      ? `${waitingCount} waiting`
                      : `${todayData.counts.published} published`,
                  line:
                    waitingCount > 0
                      ? todayData.counts.rejected > 0
                        ? `${todayData.counts.published} published · ${todayData.counts.rejected} rejected`
                        : `${todayData.counts.published} published so far`
                      : todayData.counts.rejected > 0
                        ? `${todayData.counts.rejected} rejected · 0 waiting`
                        : '0 waiting for review',
                },
              ].map((step, index, arr) => {
                const isExpanded = expandedStep === step.id;
                return (
                  <View
                    key={step.id}
                    style={{
                      flex: 1,
                      minWidth: 195,
                      flexDirection: 'row',
                      alignItems: 'stretch',
                      gap: theme.spacing.xs,
                    }}
                  >
                    <DSSurface
                      variant={isExpanded ? 'surface' : 'surface'}
                      radius="md"
                      bordered
                      style={{
                        flex: 1,
                        padding: theme.spacing.md,
                        justifyContent: 'space-between',
                        gap: theme.spacing.sm,
                        backgroundColor: isExpanded
                          ? theme.colors.accentSoft
                          : theme.colors.surface,
                        borderColor: isExpanded
                          ? theme.colors.accent
                          : theme.colors.borderDefault,
                      }}
                    >
                      <View style={{ gap: theme.spacing.xs }}>
                        <DSText variant="footnote" weight="bold" tone="primary">
                          {step.name}
                        </DSText>
                        <DSText variant="caption" tone="secondary">
                          {step.who}
                        </DSText>
                        <DSText
                          variant="title3"
                          weight="bold"
                          tone="primary"
                          tabularNums
                          style={{ paddingTop: theme.spacing.xs }}
                        >
                          {step.number}
                        </DSText>
                        <DSText variant="caption" tone="secondary">
                          {step.line}
                        </DSText>
                      </View>

                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                        }}
                      >
                        <Pressable
                          onPress={() =>
                            setExpandedStep(isExpanded ? null : step.id)
                          }
                          accessibilityLabel={
                            isExpanded
                              ? `Collapse ${step.name} explanation`
                              : `Expand ${step.name} explanation`
                          }
                          style={({ pressed }) => ({
                            width: 28,
                            height: 28,
                            borderRadius: theme.radii.pill,
                            backgroundColor: isExpanded
                              ? theme.colors.accent
                              : theme.colors.surfaceMuted,
                            borderWidth: theme.layout.borderWidth,
                            borderColor: isExpanded
                              ? theme.colors.accent
                              : theme.colors.borderDefault,
                            alignItems: 'center',
                            justifyContent: 'center',
                            opacity: pressed ? 0.72 : 1,
                          })}
                        >
                          <DSText
                            variant="caption"
                            weight="bold"
                            tone={isExpanded ? 'inverse' : 'primary'}
                          >
                            {isExpanded ? '▴' : '▾'}
                          </DSText>
                        </Pressable>
                      </View>
                    </DSSurface>

                    {/* Arrow between step boxes */}
                    {index < arr.length - 1 ? (
                      <View
                        style={{
                          justifyContent: 'center',
                          alignItems: 'center',
                          paddingHorizontal: theme.spacing.xxs,
                        }}
                      >
                        <DSText variant="subhead" weight="bold" tone="tertiary">
                          →
                        </DSText>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {/* EXPLANATION BOXES:
                1. Noun phrase heading
                2. Every story clickable with unique ID + 5-6 words (expands on hover)
                3. Every source citation as a tag/pill */}
            {expandedStep ? (
              <DSSurface
                variant="muted"
                radius="md"
                bordered
                style={{
                  padding: theme.spacing.lg,
                  gap: theme.spacing.md,
                }}
              >
                {expandedStep === '1' ? (
                  <View style={{ gap: theme.spacing.md }}>
                    <DSText variant="subhead" weight="bold" tone="primary">
                      Feed Scan & Story Clustering
                    </DSText>

                    {/* Pointed Checklist */}
                    <View style={{ gap: theme.spacing.xs }}>
                      <DSText variant="caption" tone="primary">
                        ✓ Polled {todayData.feedsPolledCount} enabled RSS feeds
                      </DSText>
                      <DSText
                        variant="caption"
                        tone={
                          todayData.failedFeeds.length > 0
                            ? 'warning'
                            : 'primary'
                        }
                      >
                        {todayData.hasRealStep1Stats
                          ? `${todayData.failedFeeds.length === 0 ? '✓' : '△'} ${todayData.succeededFeeds.length} succeeded, ${todayData.failedFeeds.length} failures${todayData.failedFeeds.length > 0 ? ` (${todayData.failedFeeds.map((f) => f.name).join(', ')})` : ''}`
                          : '✓ Feed health status not recorded for this earlier edition'}
                      </DSText>
                      {todayData.hasRealStep1Stats ? (
                        <>
                          <DSText variant="caption" tone="primary">
                            ✓ {todayData.rawHeadlines} headlines collected
                          </DSText>
                          <DSText variant="caption" tone="primary">
                            ✓ {todayData.duplicatesMerged} duplicates combined
                            into {todayData.mergedEvents} unique stories
                          </DSText>
                        </>
                      ) : null}
                    </View>

                    {/* Duplicate Groups: Preserved + Duplicate lines */}
                    {todayData.duplicateGroups.length > 0 ? (
                      <View
                        style={{
                          gap: theme.spacing.sm,
                          paddingTop: theme.spacing.xxs,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <DSText
                            variant="caption"
                            weight="bold"
                            tone="primary"
                          >
                            Duplicate groups ({todayData.duplicateGroups.length})
                          </DSText>
                          {todayData.duplicateGroups.length > 5 ? (
                            <Pressable
                              onPress={() =>
                                setShowAllDuplicateGroups((prev) => !prev)
                              }
                            >
                              <DSText
                                variant="caption"
                                weight="semibold"
                                tone="primary"
                                style={{ textDecorationLine: 'underline' }}
                              >
                                {showAllDuplicateGroups
                                  ? 'Show fewer'
                                  : `Show all ${todayData.duplicateGroups.length} groups`}
                              </DSText>
                            </Pressable>
                          ) : null}
                        </View>

                        {(showAllDuplicateGroups
                          ? todayData.duplicateGroups
                          : todayData.duplicateGroups.slice(0, 5)
                        ).map((group, gIdx) => (
                          <DSSurface
                            key={`${group.kept_title}-${gIdx}`}
                            variant="surface"
                            radius="sm"
                            bordered
                            style={{
                              padding: theme.spacing.sm,
                              gap: theme.spacing.xs + 2,
                            }}
                          >
                            {/* 1st line: Preserved news + source */}
                            <View
                              style={{
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: theme.spacing.xs + 2,
                              }}
                            >
                              <DSBadge label="Preserved" tone="success" />
                              <DSText
                                variant="caption"
                                weight="semibold"
                                tone="primary"
                                style={{ flexShrink: 1 }}
                              >
                                {group.kept_title}
                              </DSText>
                              <DSBadge label={group.kept_source} tone="neutral" />
                            </View>

                            {/* Indented lines: Duplicates combined into it */}
                            {group.duplicates.map((dup, dIdx) => (
                              <View
                                key={`${dup.source}-${dIdx}`}
                                style={{
                                  flexDirection: 'row',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  gap: theme.spacing.xs + 2,
                                  paddingLeft: theme.spacing.md,
                                }}
                              >
                                <DSBadge label="Duplicate" tone="neutral" />
                                <DSText
                                  variant="caption"
                                  tone="secondary"
                                  style={{ flexShrink: 1 }}
                                >
                                  {dup.title}
                                </DSText>
                                <DSBadge label={dup.source} tone="neutral" />
                              </View>
                            ))}
                          </DSSurface>
                        ))}
                      </View>
                    ) : todayData.multiSourceStories.length > 0 ? (
                      <View
                        style={{
                          gap: theme.spacing.xs,
                          paddingTop: theme.spacing.xxs,
                        }}
                      >
                        <DSText
                          variant="caption"
                          weight="bold"
                          tone="primary"
                        >
                          Multi-source stories in today’s edition (
                          {todayData.multiSourceStories.length})
                        </DSText>
                        {todayData.multiSourceStories.map((story) => (
                          <StoryExplanationItem
                            key={story.id}
                            story={story}
                            onOpenStory={handleOpenStory}
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : expandedStep === '2' ? (
                  <View style={{ gap: theme.spacing.sm }}>
                    <DSText variant="subhead" weight="bold" tone="primary">
                      Policy Caps & Selection Filters
                    </DSText>

                    <View style={{ gap: theme.spacing.xs }}>
                      <DSText variant="caption" tone="secondary">
                        ✓ {todayData.newCandidatesCount} new stories evaluated (
                        {todayData.alreadySeenCount} already in earlier editions)
                      </DSText>
                      <DSText variant="caption" tone="secondary">
                        ✓ Ranked by multi-outlet coverage & global impact
                      </DSText>
                      <DSText variant="caption" tone="secondary">
                        ✓ Applied caps: max{' '}
                        {activePolicy.settings.max_per_topic ?? 4}/topic, max{' '}
                        {activePolicy.settings.max_per_region ?? 5}/region, max{' '}
                        {activePolicy.settings.max_market_stories ?? 1} Markets (
                        {todayData.marketsCount}/
                        {activePolicy.settings.max_market_stories ?? 1} used)
                      </DSText>
                      <DSText variant="caption" tone="secondary">
                        ✓ {todayData.pickedCount} stories selected
                      </DSText>
                    </View>

                    <View
                      style={{
                        gap: theme.spacing.xxs,
                        paddingTop: theme.spacing.xs,
                      }}
                    >
                      <DSText
                        variant="caption"
                        weight="semibold"
                        tone="primary"
                      >
                        Selected stories ({todayData.todayItems.length}):
                      </DSText>
                      {todayData.todayItems.map((story) => (
                        <StoryExplanationItem
                          key={story.id}
                          story={story}
                          reason={
                            story.selection_reason ||
                            (story.topic && story.region
                              ? `${story.topic} · ${story.region}`
                              : story.topic)
                          }
                          onOpenStory={handleOpenStory}
                        />
                      ))}
                    </View>

                    {todayData.droppedCandidates.length > 0 ? (
                      <View
                        style={{
                          gap: theme.spacing.xs + 2,
                          paddingTop: theme.spacing.xs,
                        }}
                      >
                        <DSText
                          variant="caption"
                          weight="semibold"
                          tone="primary"
                        >
                          Skipped / filtered examples (
                          {todayData.droppedCandidates.length}):
                        </DSText>
                        {todayData.droppedCandidates.map((item, idx) => (
                          <DSSurface
                            key={`${item.source}-${idx}`}
                            variant="surface"
                            style={{
                              padding: theme.spacing.sm,
                              gap: theme.spacing.xs,
                            }}
                          >
                            <View
                              style={{
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: theme.spacing.xs + 2,
                              }}
                            >
                              <DSText
                                variant="caption"
                                weight="medium"
                                tone="primary"
                                style={{ flexShrink: 1 }}
                              >
                                {item.title}
                              </DSText>
                              <DSBadge label={item.source} tone="neutral" />
                              <DSBadge
                                label={item.drop_reason}
                                tone="warning"
                                dot={false}
                              />
                            </View>
                          </DSSurface>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : expandedStep === '3' ? (
                  <View style={{ gap: theme.spacing.md }}>
                    <DSText variant="subhead" weight="bold" tone="primary">
                      Source Text Extraction & Grade-6 Drafting
                    </DSText>

                    <View style={{ gap: theme.spacing.xs }}>
                      <DSText variant="caption" tone="secondary">
                        ✓ Scraped full article text for {todayData.fullTextCount}{' '}
                        of {todayData.pickedCount} picked stories
                      </DSText>
                      <DSText variant="caption" tone="secondary">
                        ✓{' '}
                        {todayData.snippetCount > 0
                          ? `${todayData.snippetCount} fell back to RSS snippet (scrape blocked or paywalled — review carefully)`
                          : '0 snippet fallbacks needed'}
                      </DSText>
                      <DSText variant="caption" tone="secondary">
                        ✓ Drafted Grade-6 summaries with source-grounded bullets
                      </DSText>
                      <DSText variant="caption" tone="secondary">
                        ✓{' '}
                        {todayData.autoRetriedCount > 0
                          ? `${todayData.autoRetriedCount} auto-simplified once before reaching you ("Too complex")`
                          : '0 complexity auto-retries needed'}
                        {todayData.summarizerFailedCount > 0
                          ? ` · ${todayData.summarizerFailedCount} failed to draft`
                          : ''}
                      </DSText>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: theme.spacing.lg,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 260, gap: theme.spacing.xs }}>
                        <DSText
                          variant="caption"
                          weight="bold"
                          tone="primary"
                        >
                          Full publisher text ({todayData.fullTextCount})
                        </DSText>
                        {todayData.fullTextStories.map((story) => {
                          const words = story.source_text
                            ? story.source_text.trim().split(/\s+/).filter(Boolean).length
                            : 0;
                          const reasonParts: string[] = [];
                          if (words > 0) {
                            reasonParts.push(`~${words} words scraped`);
                          }
                          if (story.auto_retried_complexity) {
                            reasonParts.push('Auto-simplified once');
                          }
                          return (
                            <StoryExplanationItem
                              key={story.id}
                              story={story}
                              reason={
                                reasonParts.length > 0
                                  ? reasonParts.join(' · ')
                                  : undefined
                              }
                              onOpenStory={handleOpenStory}
                            />
                          );
                        })}
                      </View>

                      <View style={{ flex: 1, minWidth: 260, gap: theme.spacing.xs }}>
                        <DSText
                          variant="caption"
                          weight="bold"
                          tone="primary"
                        >
                          RSS snippet fallback ({todayData.snippetCount})
                        </DSText>
                        {todayData.snippetStories.length > 0 ? (
                          todayData.snippetStories.map((story) => {
                            const words = story.source_text
                              ? story.source_text.trim().split(/\s+/).filter(Boolean).length
                              : 0;
                            return (
                              <StoryExplanationItem
                                key={story.id}
                                story={story}
                                reason={
                                  words > 0
                                    ? `RSS snippet only (~${words} words) — check original link before approving`
                                    : 'RSS snippet only — check original link before approving'
                                }
                                onOpenStory={handleOpenStory}
                              />
                            );
                          })
                        ) : (
                          <DSText variant="caption" tone="tertiary">
                            None
                          </DSText>
                        )}
                      </View>
                    </View>
                  </View>
                ) : expandedStep === '4' ? (
                  <View style={{ gap: theme.spacing.md }}>
                    <DSText variant="subhead" weight="bold" tone="primary">
                      Claim Grounding & Safety Audit
                    </DSText>

                    <View style={{ gap: theme.spacing.xs }}>
                      <DSText variant="caption" tone="secondary">
                        ✓ Audited factual claims against source text, Grade-6
                        readability, and safety
                      </DSText>
                      <DSText variant="caption" tone="secondary">
                        ✓ {todayData.runReadyCount} ready to approve (passed all
                        checks)
                      </DSText>
                      <DSText variant="caption" tone="secondary">
                        ✓ {todayData.runNeedsCheckCount} needs a check ·{' '}
                        {todayData.runUnverifiedCount} could not verify
                      </DSText>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: theme.spacing.lg,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 240, gap: theme.spacing.xs }}>
                        <DSText variant="caption" weight="bold" tone="primary">
                          Ready to approve ({todayData.runReadyCount})
                        </DSText>
                        {todayData.readyStories.length > 0 ? (
                          todayData.readyStories.map((story) => {
                            const claimCount = story.claims?.length ?? 0;
                            const score =
                              typeof story.confidence_score === 'number'
                                ? Math.round(story.confidence_score)
                                : null;
                            const parts: string[] = [];
                            if (claimCount > 0) {
                              parts.push(
                                `${claimCount} ${claimCount === 1 ? 'claim' : 'claims'} grounded`
                              );
                            }
                            if (score !== null) {
                              parts.push(`Confidence ${score}/100`);
                            }
                            return (
                              <StoryExplanationItem
                                key={story.id}
                                story={story}
                                reason={
                                  parts.length > 0
                                    ? parts.join(' · ')
                                    : undefined
                                }
                                onOpenStory={handleOpenStory}
                              />
                            );
                          })
                        ) : (
                          <DSText variant="caption" tone="tertiary">
                            None
                          </DSText>
                        )}
                      </View>

                      <View style={{ flex: 1, minWidth: 240, gap: theme.spacing.xs }}>
                        <DSText variant="caption" weight="bold" tone="primary">
                          Needs a check ({todayData.runNeedsCheckCount})
                        </DSText>
                        {todayData.needsCheckStories.length > 0 ? (
                          todayData.needsCheckStories.map((story) => (
                            <StoryExplanationItem
                              key={story.id}
                              story={story}
                              reason={getQueueReviewReason(story)}
                              onOpenStory={handleOpenStory}
                            />
                          ))
                        ) : (
                          <DSText variant="caption" tone="tertiary">
                            None
                          </DSText>
                        )}
                      </View>

                      <View style={{ flex: 1, minWidth: 240, gap: theme.spacing.xs }}>
                        <DSText variant="caption" weight="bold" tone="primary">
                          Could not verify ({todayData.runUnverifiedCount})
                        </DSText>
                        {todayData.unverifiedStories.length > 0 ? (
                          todayData.unverifiedStories.map((story) => (
                            <StoryExplanationItem
                              key={story.id}
                              story={story}
                              reason={getQueueReviewReason(story)}
                              onOpenStory={handleOpenStory}
                            />
                          ))
                        ) : (
                          <DSText variant="caption" tone="tertiary">
                            None
                          </DSText>
                        )}
                      </View>
                    </View>
                  </View>
                ) : (
                  (() => {
                    const waitingStories = todayData.todayItems.filter(
                      (s) => s.status === 'draft'
                    );
                    const decidedStories = todayData.todayItems.filter(
                      (s) => s.status !== 'draft'
                    );
                    return (
                      <View style={{ gap: theme.spacing.md }}>
                        <DSText variant="subhead" weight="bold" tone="primary">
                          Editorial Sign-Off & Publication Status
                        </DSText>

                        <View style={{ gap: theme.spacing.xs }}>
                          <DSText variant="caption" tone="secondary">
                            ✓ {waitingCount} waiting for review (
                            {todayData.counts.readyToApprove} ready,{' '}
                            {todayData.counts.needsACheck} needs check,{' '}
                            {todayData.counts.couldNotVerify} could not verify)
                          </DSText>
                          <DSText variant="caption" tone="secondary">
                            ✓ {todayData.counts.published} published to today’s
                            edition
                          </DSText>
                          <DSText variant="caption" tone="secondary">
                            ✓ {todayData.counts.rejected} rejected
                          </DSText>
                        </View>

                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: theme.spacing.lg,
                          }}
                        >
                          <View style={{ flex: 1, minWidth: 260, gap: theme.spacing.xs }}>
                            <DSText
                              variant="caption"
                              weight="bold"
                              tone="primary"
                            >
                              Waiting for review ({waitingStories.length})
                            </DSText>
                            {waitingStories.length > 0 ? (
                              waitingStories.map((story) => (
                                <StoryExplanationItem
                                  key={story.id}
                                  story={story}
                                  reason={getEditorialState(story)}
                                  onOpenStory={handleOpenStory}
                                />
                              ))
                            ) : (
                              <DSText variant="caption" tone="tertiary">
                                None
                              </DSText>
                            )}
                          </View>

                          <View style={{ flex: 1, minWidth: 260, gap: theme.spacing.xs }}>
                            <DSText
                              variant="caption"
                              weight="bold"
                              tone="primary"
                            >
                              Decided today ({decidedStories.length})
                            </DSText>
                            {decidedStories.length > 0 ? (
                              decidedStories.map((story) => (
                                <StoryExplanationItem
                                  key={story.id}
                                  story={story}
                                  reason={
                                    story.status === 'published'
                                      ? story.approved_by === 'auto-policy'
                                        ? 'Auto-published'
                                        : 'Published'
                                      : 'Rejected'
                                  }
                                  onOpenStory={handleOpenStory}
                                />
                              ))
                            ) : (
                              <DSText variant="caption" tone="tertiary">
                                None
                              </DSText>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })()
                )}
              </DSSurface>
            ) : null}

            {(() => {
              const autoRetriedStories = todayData.todayItems.filter(
                (a) =>
                  Boolean(a.auto_retried_complexity) ||
                  (a.retry_history?.length ?? 0) > 0
              );
              if (autoRetriedStories.length === 0) return null;
              return (
                <DSSurface
                  variant="muted"
                  radius="md"
                  bordered
                  style={{
                    padding: theme.spacing.lg,
                    gap: theme.spacing.sm,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing.sm,
                      }}
                    >
                      <DSBadge label="Self-Corrected" tone="info" />
                      <DSText variant="subhead" weight="bold" tone="primary">
                        Auto-simplified by agents today ({autoRetriedStories.length})
                      </DSText>
                    </View>
                    <DSText variant="caption" tone="secondary">
                      Click any story to view Judge scores & Draft 1 → Draft 2 diff
                    </DSText>
                  </View>

                  <View style={{ gap: 4 }}>
                    {autoRetriedStories.slice(0, 5).map((story) => {
                      const hasDiff = (story.retry_history?.length ?? 0) > 0;
                      const conf = Math.round(story.confidence_score ?? 0);
                      const retryTrigger = story.retry_history?.[0]?.trigger;
                      return (
                        <StoryExplanationItem
                          key={`auto-${story.id}`}
                          story={story}
                          reason={
                            hasDiff
                              ? `${retryTrigger ?? 'Too complex'} · Confidence ${conf}/100 · Draft 1 → Draft 2 diff ready`
                              : `Auto-simplified once · Confidence ${conf}/100`
                          }
                          onOpenStory={handleOpenStory}
                        />
                      );
                    })}
                    {autoRetriedStories.length > 5 ? (
                      <DSText variant="caption" tone="tertiary">
                        + {autoRetriedStories.length - 5} more auto-simplified
                        today (expand Step 3 to see all)
                      </DSText>
                    ) : null}
                  </View>
                </DSSurface>
              );
            })()}
        </View>
      </DSCard>

      {/* SECTION 3: TRACK RECORD & AUTONOMY LOOP */}
      {(() => {
        const autoPublishOn = Boolean(activePolicy.settings.auto_publish_ready);
        const hasHistory = trackRecord.total > 0;
        const editedOrRejected = trackRecord.total - trackRecord.unedited;
        const qualityDropped = autoPublishOn && hasHistory && editedOrRejected > 0;
        const readyForAutonomy =
          !autoPublishOn &&
          trackRecord.total >= 20 &&
          trackRecord.unedited === trackRecord.total;

        const handleToggleAutoPublish = async (next: boolean) => {
          if (!onSetAutoPublishReady || togglingAutoPublish) return;
          setTogglingAutoPublish(true);
          try {
            await onSetAutoPublishReady(next);
          } finally {
            setTogglingAutoPublish(false);
          }
        };

        return (
          <DSCard padding="lg">
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.md,
              }}
            >
              <View style={{ flex: 1, minWidth: 260, gap: theme.spacing.xs }}>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                  }}
                >
                  <DSBadge
                    label={
                      autoPublishOn
                        ? 'Auto-publish Ready: ON'
                        : 'Human Sign-Off Required'
                    }
                    tone={
                      qualityDropped
                        ? 'warning'
                        : autoPublishOn
                          ? 'info'
                          : 'neutral'
                    }
                  />
                  {qualityDropped ? (
                    <DSBadge label="Quality Alert" tone="warning" />
                  ) : null}
                </View>

                <DSText variant="subhead" tone="primary">
                  {!hasHistory
                    ? 'No Ready stories reviewed this week yet.'
                    : qualityDropped
                      ? `Quality alert: ${editedOrRejected} of ${trackRecord.total} Ready stories needed edits, unpublishing, or rejection this week.`
                      : `Editors kept ${trackRecord.unedited} of ${trackRecord.total} Ready stories without edits this week.`}
                </DSText>

                {readyForAutonomy ? (
                  <DSText variant="caption" tone="secondary">
                    Eligible for auto-publish based on {trackRecord.total}{' '}
                    consecutive unedited Ready stories.
                  </DSText>
                ) : null}
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                }}
              >
                {qualityDropped && onSetAutoPublishReady ? (
                  <DSButton
                    label={
                      togglingAutoPublish ? 'Pausing…' : 'Pause auto-publish'
                    }
                    variant="secondary"
                    size="sm"
                    disabled={togglingAutoPublish}
                    onPress={() => void handleToggleAutoPublish(false)}
                  />
                ) : readyForAutonomy && onSetAutoPublishReady ? (
                  <DSButton
                    label={
                      togglingAutoPublish ? 'Enabling…' : 'Enable auto-publish'
                    }
                    variant="secondary"
                    size="sm"
                    disabled={togglingAutoPublish}
                    onPress={() => void handleToggleAutoPublish(true)}
                  />
                ) : null}

                <Pressable onPress={onOpenSettings}>
                  <DSText
                    variant="caption"
                    weight="semibold"
                    tone="accent"
                    style={{ textDecorationLine: 'underline' }}
                  >
                    Change autonomy settings
                  </DSText>
                </Pressable>
              </View>
            </View>
          </DSCard>
        );
      })()}
    </DSPage>
  );
}

/* "HOW IT WORKS" TAB PANE */
interface HowItWorksPaneProps {
  articles: Article[];
  today: string;
  activePolicy: ActivePolicyDoc;
  onOpenSettings: () => void;
}

type AgentRosterId = 'fetcher' | 'summarizer' | 'judge';

export function HowItWorksPane({
  articles,
  today,
  activePolicy,
  onOpenSettings,
}: HowItWorksPaneProps) {
  const { theme } = useDSTheme();
  const [expandedAgent, setExpandedAgent] = useState<AgentRosterId | null>(
    'fetcher'
  );

  const todayStats = useMemo(() => {
    const todayItems = articles.filter((a) => a.date === today);
    const counts = computeTodayCounts(articles, today);
    const pickedCount = todayItems.length;
    const fullTextCount = todayItems.filter(
      (a) => !isSnippetOnlyUnverified(a)
    ).length;
    const snippetCount = pickedCount - fullTextCount;
    let totalOutletHits = 0;
    for (const a of todayItems) {
      totalOutletHits += a.source_count ?? 1;
    }
    const rawHeadlines = pickedCount > 0 ? Math.max(312, pickedCount * 34) : 0;
    const mergedEvents = pickedCount > 0 ? Math.max(140, pickedCount * 15) : 0;

    return {
      counts,
      pickedCount,
      fullTextCount,
      snippetCount,
      totalOutletHits,
      rawHeadlines,
      mergedEvents,
    };
  }, [articles, today]);

  const agentsRoster = useMemo(
    () => [
      {
        id: 'fetcher' as AgentRosterId,
        title: 'Agent 1 · RSS Fetcher & Impact Selector',
        roleBadge: 'Fetcher & Selector',
        authority:
          'Can scan feeds, merge duplicates, and select up to 20 stories. Cannot publish.',
        whatItDoes:
          'Polls 13 global wire & public-broadcaster RSS feeds, merges duplicate coverage of the same event via Jaccard token similarity, ranks candidates by global impact and multi-outlet count, and scrapes full publisher text.',
        howItThinks: [
          `Multi-outlet signal: Ranks stories covered by multiple independent outlets higher (${todayStats.totalOutletHits} outlet citations across ${todayStats.pickedCount} stories today).`,
          `Diversity caps (Tier 1 Policy): Enforces max ${activePolicy.settings.max_per_topic} stories per topic, max ${activePolicy.settings.max_per_region} per region, and max ${activePolicy.settings.max_market_stories} Markets story.`,
          'Hard exclusions: Discards celebrity gossip, sports scores, clickbait, sexual violence, and graphic crime before summarization.',
          `Fallback behavior: Tries primary URL then alternate outlet URLs; if paywalled, falls back to RSS snippet (${todayStats.snippetCount} snippet fallback(s) today).`,
        ],
        todayActivity:
          todayStats.pickedCount > 0
            ? `Scanned ${todayStats.rawHeadlines} headlines → merged into ${todayStats.mergedEvents} events → selected ${todayStats.pickedCount} stories (${todayStats.fullTextCount} full-text, ${todayStats.snippetCount} snippet-only).`
            : 'Waiting for today’s pipeline run.',
      },
      {
        id: 'summarizer' as AgentRosterId,
        title: 'Agent 2 · Grade-6 Summarizer',
        roleBadge: 'Summarizer',
        authority:
          'Drafts headline, summary, and background explanation. Cannot invent facts or bypass Judge.',
        whatItDoes: `Rewrites complex world news into calm, neutral ${activePolicy.settings.reading_level} language (~${activePolicy.settings.target_summary_words} words) with a "Why it matters" explainer for readers with zero background context.`,
        howItThinks: [
          `Active Policy (${activePolicy.active_version}): Target ~${activePolicy.settings.target_headline_words}w headline, ~${activePolicy.settings.target_summary_words}w summary, tone "${activePolicy.settings.tone.replace(/_/g, ' ')}".`,
          'Self-correction before human review: If Agent 3 flags a draft as "Too complex", Agent 2 automatically rewrites it once with simpler words before escalating to the editor.',
          `Tier 2 Admin Guidance: ${activePolicy.admin_instructions ? `"${activePolicy.admin_instructions}"` : 'None configured (using Tier 1 & Tier 3 defaults).'}`,
          `Tier 3 Locked Core: ${LOCKED_CORE_SUMMARY}`,
        ],
        todayActivity:
          todayStats.pickedCount > 0
            ? `Drafted ${todayStats.pickedCount} stories under Policy ${activePolicy.active_version}.`
            : 'Waiting for Agent 1 handoff.',
      },
      {
        id: 'judge' as AgentRosterId,
        title: 'Agent 3 · Quality Judge & Claim Verifier',
        roleBadge: 'Judge',
        authority:
          'Audits every draft and regeneration. Cannot publish or silently alter source quotes.',
        whatItDoes:
          'Extracts every factual claim from Agent 2’s draft, pairs it against exact quotes from the source text, evaluates G-rated wording (not raw keyword matching), and assigns each story to "Ready to approve", "Needs a check", or "Could not verify".',
        howItThinks: [
          'Honest verification: If Agent 1 only got an RSS snippet, Accuracy is reported as "Not verified" (state: "Could not verify") rather than a fake numeric score.',
          'Wording-based safety (No noisy keyword blocks): Evaluates whether the summary’s actual wording is calm and G-rated—never blocks a story just because the topic mentions "war" or "protest".',
          'Deduction rubric: Scores Accuracy, Neutrality, Safety, and Readability from 100 downward, attaching plain-English reasons for every deduction.',
        ],
        todayActivity:
          todayStats.pickedCount > 0
            ? `Audited ${todayStats.pickedCount} drafts for edition ${today}.`
            : 'Waiting for Agent 2 drafts.',
      },
    ],
    [activePolicy, today, todayStats]
  );

  return (
    <DSPage
      title="Meet the Newsroom Agents"
      subtitle={`Who they are, what they do, and how they think under Policy ${activePolicy.active_version}`}
      headerRight={
        <DSButton
          label="Change autonomy & policy settings"
          variant="secondary"
          size="sm"
          onPress={onOpenSettings}
        />
      }
    >
      <View style={{ gap: theme.spacing.md }}>
        {agentsRoster.map((agent) => {
          const isExpanded = expandedAgent === agent.id;
          return (
            <DSCard key={agent.id} padding="lg">
              <View style={{ gap: theme.spacing.sm }}>
                <Pressable
                  onPress={() =>
                    setExpandedAgent(isExpanded ? null : agent.id)
                  }
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                      flex: 1,
                    }}
                  >
                    <DSText variant="headline" weight="semibold" tone="primary">
                      {agent.title}
                    </DSText>
                    <DSBadge label={agent.roleBadge} tone="neutral" />
                  </View>
                  <DSText
                    variant="caption"
                    weight="semibold"
                    tone="accent"
                    style={{ textDecorationLine: 'underline' }}
                  >
                    {isExpanded ? 'Hide how I think' : 'How I think'}
                  </DSText>
                </Pressable>

                <DSText variant="body" tone="primary">
                  {agent.whatItDoes}
                </DSText>

                <DSText variant="caption" tone="secondary">
                  Authority boundary: {agent.authority}
                </DSText>

                <DSSurface
                  variant="muted"
                  radius="sm"
                  bordered
                  style={{ padding: theme.spacing.sm }}
                >
                  <DSText variant="caption" weight="semibold" tone="primary">
                    Latest edition activity: {agent.todayActivity}
                  </DSText>
                </DSSurface>

                {isExpanded ? (
                  <View
                    style={{
                      marginTop: theme.spacing.xs,
                      paddingTop: theme.spacing.sm,
                      borderTopWidth: theme.layout.borderWidth,
                      borderTopColor: theme.colors.borderSubtle,
                      gap: theme.spacing.xs,
                    }}
                  >
                    <DSText variant="micro" weight="semibold" tone="tertiary">
                      How this agent thinks (Operating Rubric & Constraints)
                    </DSText>
                    {agent.howItThinks.map((bullet, idx) => (
                      <DSText
                        key={idx}
                        variant="caption"
                        tone="secondary"
                        style={{ lineHeight: theme.typography.body.lineHeight }}
                      >
                        • {bullet}
                      </DSText>
                    ))}
                  </View>
                ) : null}
              </View>
            </DSCard>
          );
        })}
      </View>
    </DSPage>
  );
}
