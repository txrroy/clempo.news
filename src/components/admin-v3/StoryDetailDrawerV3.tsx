import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  acceptRegeneratedDraft,
  LOCKED_CORE_SUMMARY,
  regenerateDraftRequest,
  type RegenerateProgressEvent,
  type RegenerateResponse,
} from '@/hooks/useGovernance';
import {
  formatEditionDate,
  getSourceLabel,
  splitSummaryIntoPoints,
} from '@/lib/consumerUtils';
import {
  getEditorialState,
  getFlagPlainReason,
  getFlagShortLabel,
  getWhyThisNeedsYouMessage,
  isSnippetOnlyUnverified,
} from '@/lib/editorialLabels';
import type {
  Article,
  ArticleFlag,
  ArticleRevision,
  ReadingLevel,
} from '@/types/article';
import {
  V3Badge,
  V3Button,
  V3Card,
  V3Input,
  V3Rule,
  V3Text,
  type V3BadgeTone,
} from './primitives';
import { V3_COLORS, V3_RADII, V3_SPACE, V3_TYPE } from './tokens';

interface StoryDetailDrawerV3Props {
  article: Article | null;
  adminUid: string;
  hasPrev: boolean;
  hasNext: boolean;
  getIdToken: () => Promise<string>;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onSaveChanges: (id: string, headline: string, summary: string) => Promise<void>;
  onApprove: (
    id: string,
    headline: string,
    summary: string,
    adminUid: string
  ) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
  onUnpublish?: (id: string) => Promise<void>;
  onConfirmSourceChecked?: (id: string, checked: boolean) => Promise<void>;
}

const READING_LEVELS: ReadingLevel[] = [
  'grade 4',
  'grade 5',
  'grade 6',
  'grade 7',
  'grade 8',
];

const WORD_TARGETS = [40, 50, 60, 75, 90] as const;

function getStatusBadgeProps(article: Article): {
  label: string;
  tone: V3BadgeTone;
} {
  if (article.status === 'published') {
    return { label: 'PUBLISHED', tone: 'approved' };
  }
  if (article.status === 'rejected') {
    return { label: 'REJECTED', tone: 'rejected' };
  }
  const state = getEditorialState(article);
  if (state === 'Ready to approve') return { label: 'READY TO APPROVE', tone: 'approved' };
  if (state === 'Needs a check') return { label: 'NEEDS A CHECK', tone: 'pending' };
  return { label: 'COULD NOT VERIFY', tone: 'rejected' };
}

function getScoreTone(score: number): 'accent' | 'warning' | 'danger' {
  if (score >= 85) return 'accent';
  if (score >= 65) return 'warning';
  return 'danger';
}

function ReasoningBulletList({
  text,
  tone = 'muted',
}: {
  text: string;
  tone?: 'ink' | 'muted';
}) {
  const items = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (items.length <= 1) {
    return (
      <V3Text role="body" tone={tone}>
        {text}
      </V3Text>
    );
  }

  return (
    <View style={{ gap: V3_SPACE.xs }}>
      {items.map((item, idx) => (
        <View
          key={`${idx}-${item.slice(0, 12)}`}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: V3_SPACE.sm,
          }}
        >
          <V3Text role="body" tone={tone}>
            •
          </V3Text>
          <V3Text role="body" tone={tone} style={{ flex: 1 }}>
            {item}
          </V3Text>
        </View>
      ))}
    </View>
  );
}

export function StoryDetailDrawerV3(props: StoryDetailDrawerV3Props) {
  const { height: windowHeight } = useWindowDimensions();
  const minHeight = 280;
  const maxHeight = Math.max(minHeight, windowHeight - 40);
  const [drawerHeight, setDrawerHeight] = useState<number>(() =>
    Math.min(maxHeight, Math.max(minHeight, Math.round(windowHeight * 0.75)))
  );

  const clampedHeight = Math.min(maxHeight, Math.max(minHeight, drawerHeight));
  const dragStartRef = useRef<{ startY: number; startHeight: number } | null>(
    null
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const deltaY = dragStartRef.current.startY - e.clientY;
      setDrawerHeight(
        Math.min(
          maxHeight,
          Math.max(minHeight, dragStartRef.current.startHeight + deltaY)
        )
      );
    };

    const handleMouseUp = () => {
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [maxHeight, minHeight]);

  if (!props.article) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        justifyContent: 'flex-end',
      }}
    >
      {/* Backdrop above bottom drawer */}
      <Pressable
        onPress={props.onClose}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(18, 24, 20, 0.28)',
        }}
      />

      {/* Resizable Bottom Drawer */}
      <View
        style={{
          height: clampedHeight,
          width: '100%',
          backgroundColor: V3_COLORS.canvas,
          borderTopWidth: 2,
          borderTopColor: V3_COLORS.ruleStrong,
          overflow: 'hidden',
        }}
      >
        {/* Drag Handle for Height Adjustment */}
        <View
          onStartShouldSetResponder={() => Platform.OS !== 'web'}
          onMoveShouldSetResponder={() => Platform.OS !== 'web'}
          onResponderGrant={(e) => {
            dragStartRef.current = {
              startY: e.nativeEvent.pageY,
              startHeight: clampedHeight,
            };
          }}
          onResponderMove={(e) => {
            if (!dragStartRef.current) return;
            const deltaY = dragStartRef.current.startY - e.nativeEvent.pageY;
            setDrawerHeight(
              Math.min(
                maxHeight,
                Math.max(minHeight, dragStartRef.current.startHeight + deltaY)
              )
            );
          }}
          onResponderRelease={() => {
            dragStartRef.current = null;
          }}
          {...(Platform.OS === 'web'
            ? ({
                onMouseDown: (e: { clientY: number; preventDefault: () => void }) => {
                  e.preventDefault();
                  dragStartRef.current = {
                    startY: e.clientY,
                    startHeight: clampedHeight,
                  };
                },
              } as Record<string, unknown>)
            : {})}
          style={{
            height: 18,
            width: '100%',
            backgroundColor: V3_COLORS.surface,
            alignItems: 'center',
            justifyContent: 'center',
            borderBottomWidth: 1,
            borderBottomColor: V3_COLORS.border,
            ...(Platform.OS === 'web'
              ? ({ cursor: 'ns-resize', userSelect: 'none' } as Record<
                  string,
                  unknown
                >)
              : {}),
          }}
        >
          <View
            style={{
              width: 44,
              height: 4,
              borderRadius: V3_RADII.control,
              backgroundColor: V3_COLORS.border,
            }}
          />
        </View>

        <StoryDetailContent
          key={props.article.id}
          {...props}
          article={props.article}
        />
      </View>
    </View>
  );
}

interface StoryDetailContentProps
  extends Omit<StoryDetailDrawerV3Props, 'article'> {
  article: Article;
}

function StoryDetailContent({
  article,
  adminUid,
  hasPrev,
  hasNext,
  getIdToken,
  onPrev,
  onNext,
  onClose,
  onSaveChanges,
  onApprove,
  onReject,
  onUnpublish,
  onConfirmSourceChecked,
}: StoryDetailContentProps) {
  const [headline, setHeadline] = useState(article.ai_headline);
  const [summary, setSummary] = useState(article.ai_summary);
  const [editingDraftText, setEditingDraftText] = useState(false);
  const [busyAction, setBusyAction] = useState<
    | 'save'
    | 'approve'
    | 'reject'
    | 'unpublish'
    | 'regen'
    | 'accept-regen'
    | null
  >(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [showCustomSteer, setShowCustomSteer] = useState(false);
  const [showProvideSource, setShowProvideSource] = useState(false);
  const [customSourceUrl, setCustomSourceUrl] = useState('');
  const [regenLevel, setRegenLevel] = useState<ReadingLevel>(
    (article.instructions_snapshot?.reading_level as ReadingLevel) || 'grade 6'
  );
  const [regenWords, setRegenWords] = useState<number>(
    article.instructions_snapshot?.target_summary_words || 60
  );
  const [regenRedirect, setRegenRedirect] = useState('');
  const [regenPreview, setRegenPreview] = useState<RegenerateResponse | null>(
    null
  );
  const [liveSteps, setLiveSteps] = useState<RegenerateProgressEvent[]>([]);
  const [activeGoal, setActiveGoal] = useState<string | null>(null);

  const { width: windowWidth } = useWindowDimensions();
  const isWideSplit = windowWidth >= 900;

  const [localSourceChecked, setLocalSourceChecked] = useState(
    Boolean(article.source_checked)
  );
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showReaderPreview, setShowReaderPreview] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);

  const unsupportedClaims = useMemo(
    () =>
      (article.claims ?? []).filter(
        (c) => c.evidence.trim().toLowerCase() === 'unsupported'
      ),
    [article.claims]
  );

  const sentenceMappings = useMemo(() => {
    const sentences = summary
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const claims = article.claims ?? [];
    const unverifiedSnippet = isSnippetOnlyUnverified(article);

    // Map each unsupported claim to its best-matching sentence so it is never hidden by another claim
    const unsupportedBySentence = new Map<number, string>();
    for (const c of unsupportedClaims) {
      const cWords = c.claim
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 3);
      let bestSentIdx = -1;
      let bestSentHits = 0;
      sentences.forEach((s, sIdx) => {
        const sLower = s.toLowerCase();
        const hits = cWords.filter((w) => sLower.includes(w)).length;
        if (hits > bestSentHits) {
          bestSentHits = hits;
          bestSentIdx = sIdx;
        }
      });
      if (bestSentIdx >= 0 && bestSentHits >= 2) {
        unsupportedBySentence.set(bestSentIdx, c.claim);
      }
    }

    return sentences.map((sentence, idx) => {
      const words = sentence
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 3);
      let bestClaim = claims[idx] ?? null;
      let bestHits = 0;

      for (const c of claims) {
        const cl = c.claim.toLowerCase();
        const hits = words.filter((w) => cl.includes(w)).length;
        if (hits > bestHits) {
          bestHits = hits;
          bestClaim = c;
        }
      }

      const mappedUnsupported = unsupportedBySentence.get(idx);
      const evidenceQuote = mappedUnsupported
        ? 'unsupported'
        : bestClaim?.evidence?.trim() || '';
      const isExplicitlyUnsupported =
        Boolean(mappedUnsupported) ||
        evidenceQuote.toLowerCase() === 'unsupported';
      const status: 'supported' | 'unsupported' | 'unverified' =
        isExplicitlyUnsupported
          ? 'unsupported'
          : unverifiedSnippet || !evidenceQuote
            ? 'unverified'
            : 'supported';

      return {
        idx,
        sentence,
        evidenceQuote,
        status,
      };
    });
  }, [article, summary, unsupportedClaims]);

  const [selectedSentenceIdx, setSelectedSentenceIdx] = useState<number | null>(
    () => {
      const firstUnsupported = sentenceMappings.findIndex(
        (m) => m.status === 'unsupported'
      );
      return firstUnsupported >= 0 ? firstUnsupported : 0;
    }
  );

  const sourceSegments = useMemo(() => {
    const rawSource = (article.source_text || '').trim();
    if (!rawSource) return [];

    const activeMap =
      selectedSentenceIdx !== null
        ? sentenceMappings[selectedSentenceIdx]
        : null;
    const quoteToMatch = activeMap?.evidenceQuote?.toLowerCase().trim() || '';
    const quoteTokens = quoteToMatch
      .split(/\W+/)
      .filter((w) => w.length > 4);

    const paragraphs = rawSource
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    const segments: { text: string; highlighted: boolean }[] = [];
    for (const para of paragraphs) {
      const sents = para
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const s of sents) {
        const sLower = s.toLowerCase();
        let highlighted = false;
        if (
          quoteToMatch &&
          quoteToMatch !== 'unsupported' &&
          quoteToMatch.length > 12
        ) {
          if (
            sLower.includes(quoteToMatch.slice(0, 32)) ||
            quoteToMatch.includes(sLower.slice(0, 32))
          ) {
            highlighted = true;
          } else if (quoteTokens.length >= 3) {
            const shared = quoteTokens.filter((t) => sLower.includes(t)).length;
            if (shared >= Math.ceil(quoteTokens.length * 0.6)) {
              highlighted = true;
            }
          }
        }
        segments.push({ text: s, highlighted });
      }
    }
    return segments;
  }, [article, selectedSentenceIdx, sentenceMappings]);

  const isDirty =
    headline.trim() !== article.ai_headline.trim() ||
    summary.trim() !== article.ai_summary.trim();

  const editorialState = getEditorialState(article);
  const whyNeedsYou = getWhyThisNeedsYouMessage(article);
  const snippetUnverified = isSnippetOnlyUnverified(article);
  const requiresPreFlightCheck = editorialState === 'Could not verify';
  const canApproveNow = !requiresPreFlightCheck || localSourceChecked;

  const snapshot = article.instructions_snapshot;
  const traceSteps = article.pipeline_trace ?? [];
  const statusBadge = getStatusBadgeProps(article);
  const flags = article.flags ?? [];

  const fetcherStep = traceSteps.find(
    (s) => s.step === 'fetch' || s.step === 'select' || s.step === 'extract'
  );
  const summarizerStep = traceSteps.find((s) => s.step === 'summarize');
  const judgeStep = traceSteps.find((s) => s.step === 'judge');

  const activeMapping =
    selectedSentenceIdx !== null ? sentenceMappings[selectedSentenceIdx] : null;

  const accuracyScore = article.scores?.accuracy ?? article.confidence_score;
  const neutralityScore =
    article.scores?.neutrality ?? article.confidence_score;
  const safetyScore = article.scores?.safety ?? article.confidence_score;
  const readabilityScore =
    article.scores?.readability ?? article.confidence_score;

  const handleToggleSourceCheck = async () => {
    const next = !localSourceChecked;
    setLocalSourceChecked(next);
    if (onConfirmSourceChecked) {
      try {
        await onConfirmSourceChecked(article.id, next);
      } catch {
        // Ignore persistence error if offline
      }
    }
  };

  const handleSave = async () => {
    setBusyAction('save');
    setFeedback(null);
    try {
      await onSaveChanges(article.id, headline, summary);
      setFeedback('Changes saved.');
      setEditingDraftText(false);
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : 'Failed to save changes.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleApprove = async () => {
    if (!canApproveNow) return;
    setBusyAction('approve');
    setFeedback(null);
    try {
      await onApprove(article.id, headline, summary, adminUid);
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : 'Failed to approve article.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleReject = async () => {
    setBusyAction('reject');
    setFeedback(null);
    try {
      await onReject(article.id);
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : 'Failed to reject article.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleUnpublish = async () => {
    if (!onUnpublish) return;
    setBusyAction('unpublish');
    setFeedback(null);
    try {
      await onUnpublish(article.id);
      setFeedback('Story unpublished and returned to review queue.');
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : 'Failed to unpublish story.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleRunAgentAction = async (options: {
    goal?: string;
    redirectInstructions: string;
    readingLevel?: ReadingLevel;
    tryAlternateSource?: boolean;
    customSourceUrl?: string;
    addOtherSide?: boolean;
  }) => {
    const resolvedGoal =
      options.goal ||
      (options.customSourceUrl
        ? `Extract full article from ${options.customSourceUrl} and verify all claims.`
        : options.addOtherSide
          ? 'Search other outlets for opposing views, draft a balanced sentence, and cite the source.'
          : options.tryAlternateSource
            ? 'Find an alternate outlet URL and extract full article text.'
            : options.redirectInstructions.trim() ||
              'Rewrite and verify the draft against the source text.');

    setBusyAction('regen');
    setFeedback(null);
    setRegenPreview(null);
    setLiveSteps([]);
    setActiveGoal(resolvedGoal);
    if (options.readingLevel) {
      setRegenLevel(options.readingLevel);
    }
    setRegenRedirect(options.redirectInstructions);
    try {
      const token = await getIdToken();
      const result = await regenerateDraftRequest({
        articleId: article.id,
        readingLevel: options.readingLevel ?? regenLevel,
        targetSummaryWords: regenWords,
        redirectInstructions: options.redirectInstructions,
        tryAlternateSource: options.tryAlternateSource,
        customSourceUrl: options.customSourceUrl,
        addOtherSide: options.addOtherSide,
        idToken: token,
        onProgress: (ev) => setLiveSteps((prev) => [...prev, ev]),
      });
      setRegenPreview(result);
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : 'Failed to run agent action.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleAcceptRegenerated = async () => {
    if (!regenPreview) return;
    setBusyAction('accept-regen');
    setFeedback(null);
    try {
      await acceptRegeneratedDraft(article.id, regenPreview, article);
      setHeadline(regenPreview.after.ai_headline);
      setSummary(regenPreview.after.ai_summary);
      setRegenPreview(null);
      setLiveSteps([]);
      setActiveGoal(null);
      setRegenRedirect('');
      setFeedback('Updated draft & verification applied.');
    } catch (err) {
      setFeedback(
        err instanceof Error
          ? err.message
          : 'Failed to apply regenerated draft.'
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <View style={{ flex: 1, minHeight: 0, flexDirection: 'column' }}>
      {/* Drawer Header with Navigation & All Decision Actions */}
      <View
        style={{
          backgroundColor: V3_COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: V3_COLORS.border,
          paddingHorizontal: V3_SPACE.xxl,
          paddingVertical: V3_SPACE.md,
          gap: V3_SPACE.sm,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: V3_SPACE.md,
            flexWrap: 'wrap',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: V3_SPACE.sm,
              flexWrap: 'wrap',
            }}
          >
            <V3Button
              label="✕ Close"
              variant="outline"
              size="sm"
              onPress={onClose}
            />
            <V3Button
              label="‹ Prev"
              variant="outline"
              size="sm"
              disabled={!hasPrev}
              onPress={onPrev}
            />
            <V3Button
              label="Next ›"
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onPress={onNext}
            />
            <V3Button
              label="Open source ↗"
              variant="outline"
              size="sm"
              onPress={() => Linking.openURL(article.original_url)}
            />
            <V3Button
              label={showReaderPreview ? 'Back to Editor' : 'Preview as Reader'}
              variant={showReaderPreview ? 'dark' : 'outline'}
              size="sm"
              onPress={() => setShowReaderPreview((v) => !v)}
            />
            <V3Badge label={statusBadge.label} tone={statusBadge.tone} />
            {article.sensitive ? (
              <V3Badge label="SENSITIVE" tone="neutral" />
            ) : null}
            {article.prompt_version ? (
              <V3Badge
                label={`POLICY ${article.prompt_version.toUpperCase()}`}
                tone="neutral"
              />
            ) : null}
          </View>

          {/* All Decision Action Items on the Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: V3_SPACE.sm,
              flexWrap: 'wrap',
            }}
          >
            <V3Button
              label={article.status === 'rejected' ? 'Rejected' : 'Reject'}
              variant="danger"
              size="sm"
              disabled={busyAction !== null || article.status === 'rejected'}
              onPress={() => void handleReject()}
            />

            {article.status === 'published' && onUnpublish ? (
              <V3Button
                label="Unpublish"
                variant="outline"
                size="sm"
                disabled={busyAction !== null}
                onPress={() => void handleUnpublish()}
              />
            ) : null}

            {isDirty || editingDraftText ? (
              <V3Button
                label="Save Changes"
                variant="outline"
                size="sm"
                disabled={busyAction !== null}
                onPress={() => void handleSave()}
              />
            ) : null}

            <V3Button
              label={
                article.status === 'published'
                  ? 'Update Published'
                  : 'Approve & Publish'
              }
              variant="primary"
              size="sm"
              disabled={busyAction !== null || !canApproveNow}
              onPress={() => void handleApprove()}
            />
          </View>
        </View>

        {requiresPreFlightCheck && article.status !== 'published' ? (
          <Pressable
            onPress={() => void handleToggleSourceCheck()}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: V3_SPACE.sm,
              paddingTop: V3_SPACE.xs,
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: V3_RADII.sharp,
                borderWidth: 1.5,
                borderColor: localSourceChecked
                  ? V3_COLORS.accent
                  : V3_COLORS.danger,
                backgroundColor: localSourceChecked
                  ? V3_COLORS.accent
                  : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {localSourceChecked ? (
                <V3Text role="mono" weight="700" tone="inverse">
                  ✓
                </V3Text>
              ) : null}
            </View>
            <V3Text
              role="mono"
              weight="600"
              tone={localSourceChecked ? 'ink' : 'danger'}
            >
              I checked this against the source (required to approve &ldquo;Could
              not verify&rdquo; stories)
            </V3Text>
          </Pressable>
        ) : null}
      </View>

      {/* Main Scrollable Workspace */}
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{
          maxWidth: 1180,
          width: '100%',
          alignSelf: 'center',
          paddingHorizontal: V3_SPACE.xxl,
          paddingVertical: V3_SPACE.xl,
          paddingBottom: V3_SPACE.xxl * 2,
          gap: V3_SPACE.xl,
        }}
      >
        {showReaderPreview ? (
          <V3Card
            variant="outlined"
            padding="lg"
            style={{
              maxWidth: 680,
              width: '100%',
              alignSelf: 'center',
              gap: V3_SPACE.md,
              backgroundColor: V3_COLORS.surface,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: V3_SPACE.sm,
              }}
            >
              <V3Badge label="READER PREVIEW · LIVE DRAFT" tone="approved" />
              <V3Text role="mono" tone="muted">
                {formatEditionDate(article.date, 'short')}
                {article.topic ? ` · ${article.topic.toUpperCase()}` : ''}
              </V3Text>
            </View>

            {article.image_url ? (
              <Image
                source={{ uri: article.image_url }}
                style={{
                  width: '100%',
                  height: 240,
                  borderRadius: V3_RADII.control,
                  backgroundColor: V3_COLORS.surfaceWell,
                }}
                contentFit="cover"
              />
            ) : null}

            <V3Text role="title">{headline}</V3Text>

            <View style={{ gap: V3_SPACE.sm }}>
              {splitSummaryIntoPoints(summary).map((point, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: V3_SPACE.sm,
                  }}
                >
                  <V3Text role="body" tone="accent" weight="700">
                    •
                  </V3Text>
                  <V3Text role="body" style={{ flex: 1 }}>
                    {point}
                  </V3Text>
                </View>
              ))}
            </View>

            {article.ai_explanation ? (
              <View
                style={{
                  backgroundColor: V3_COLORS.surfaceWell,
                  borderLeftWidth: 3,
                  borderLeftColor: V3_COLORS.accent,
                  paddingHorizontal: V3_SPACE.md,
                  paddingVertical: V3_SPACE.sm,
                  gap: 4,
                }}
              >
                <V3Text role="kicker" tone="muted">
                  BACKGROUND CONTEXT
                </V3Text>
                <V3Text role="body" tone="muted">
                  {article.ai_explanation}
                </V3Text>
              </View>
            ) : null}

            <V3Rule />

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: V3_SPACE.sm,
              }}
            >
              <V3Text role="mono" tone="muted">
                SOURCE: {getSourceLabel(article) || 'Original source'}
              </V3Text>
              <V3Button
                label="Open source link ↗"
                variant="outline"
                size="sm"
                onPress={() => Linking.openURL(article.original_url)}
              />
            </View>
          </V3Card>
        ) : null}

        {/* 1. Headline First */}
        <View style={{ gap: V3_SPACE.xs }}>
          <V3Text role="mono" tone="muted">
            {article.date}
            {article.topic ? ` · ${article.topic.toUpperCase()}` : ''}
            {article.region ? ` · ${article.region.toUpperCase()}` : ''}
            {article.source_names?.length
              ? ` · ${article.source_names.join(', ')}`
              : ''}
          </V3Text>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: V3_SPACE.md,
            }}
          >
            <View style={{ flex: 1, minWidth: 260 }}>
              {editingDraftText ? (
                <V3Input
                  value={headline}
                  onChangeText={setHeadline}
                  multiline
                  style={[V3_TYPE.title, { minHeight: 54 }]}
                />
              ) : (
                <V3Text role="title">{headline}</V3Text>
              )}
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: V3_SPACE.sm,
              }}
            >
              {isDirty ? (
                <V3Badge label="UNSAVED EDITS" tone="pending" />
              ) : null}
              <V3Button
                label={editingDraftText ? 'Done editing' : 'Edit text'}
                variant="outline"
                size="sm"
                onPress={() => setEditingDraftText((v) => !v)}
              />
            </View>
          </View>
        </View>

        <V3Rule strong />

        {/* 2. Triage Strip & Live Agent Actions (Filled well, never nested cards) */}
        <V3Card
          variant="filled"
          style={{
            backgroundColor: V3_COLORS.surfaceWell,
            gap: V3_SPACE.md,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: V3_SPACE.md,
            }}
          >
            <View style={{ flex: 1, minWidth: 260, gap: V3_SPACE.xs }}>
              <V3Text
                role="kicker"
                tone={
                  whyNeedsYou.state === 'Ready to approve'
                    ? 'accent'
                    : whyNeedsYou.state === 'Needs a check'
                      ? 'warning'
                      : 'danger'
                }
              >
                {whyNeedsYou.headline}
              </V3Text>
              <ReasoningBulletList text={whyNeedsYou.sentence} tone="ink" />
              {requiresPreFlightCheck && unsupportedClaims.length > 0 ? (
                <View style={{ gap: 2, marginTop: V3_SPACE.xs }}>
                  {unsupportedClaims.map((c, idx) => (
                    <V3Text key={idx} role="mono" tone="danger">
                      • Unmatched claim: &ldquo;{c.claim}&rdquo;
                    </V3Text>
                  ))}
                </View>
              ) : null}
            </View>

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: V3_SPACE.sm,
              }}
            >
              {requiresPreFlightCheck ? (
                <>
                  {snippetUnverified ? (
                    <V3Button
                      label="Try another source"
                      variant="dark"
                      size="sm"
                      disabled={busyAction !== null}
                      onPress={() =>
                        void handleRunAgentAction({
                          tryAlternateSource: true,
                          redirectInstructions:
                            'Re-extract from alternate outlet URL and verify all claims against full text.',
                        })
                      }
                    />
                  ) : (
                    <V3Button
                      label={
                        busyAction === 'regen'
                          ? 'Verifying...'
                          : 'Verify against source'
                      }
                      variant="dark"
                      size="sm"
                      disabled={busyAction !== null}
                      onPress={() =>
                        void handleRunAgentAction({
                          goal: 'Rewrite any unsupported sentence or headline claim so every claim matches a direct quote in the source text.',
                          redirectInstructions:
                            'Check both the headline and every sentence strictly against the source text. Remove or rewrite any unsupported claim (including numbers or dates not backed by the source) so every claim is directly supported by a quote in the source text.',
                        })
                      }
                    />
                  )}
                  <V3Button
                    label={
                      showProvideSource ? 'Hide source input ▲' : 'Provide better source'
                    }
                    variant="outline"
                    size="sm"
                    disabled={busyAction !== null}
                    onPress={() => setShowProvideSource((v) => !v)}
                  />
                </>
              ) : (
                <>
                  {flags.includes('TOO_COMPLEX') ? (
                    <V3Button
                      label="Simplify"
                      variant="dark"
                      size="sm"
                      disabled={busyAction !== null}
                      onPress={() =>
                        void handleRunAgentAction({
                          goal: 'Simplify reading level to Grade 5–6 with everyday words.',
                          readingLevel: 'grade 5',
                          redirectInstructions:
                            'Simplify reading level to Grade 5–6. Replace complex or technical terms with everyday words and shorten long sentences.',
                        })
                      }
                    />
                  ) : null}

                  {flags.includes('ONE_SIDED') ? (
                    <V3Button
                      label="Add other side"
                      variant="dark"
                      size="sm"
                      disabled={busyAction !== null}
                      onPress={() =>
                        void handleRunAgentAction({
                          addOtherSide: true,
                          redirectInstructions:
                            'Present each side’s position in one calm, neutral attributed sentence so the summary is balanced.',
                        })
                      }
                    />
                  ) : null}

                  {flags.includes('LOADED_LANGUAGE') ? (
                    <V3Button
                      label="Neutralize tone"
                      variant="dark"
                      size="sm"
                      disabled={busyAction !== null}
                      onPress={() =>
                        void handleRunAgentAction({
                          goal: 'Replace loaded wording with calm, neutral reporting.',
                          redirectInstructions:
                            'Replace any loaded or emotional adjectives with plain, neutral verbs and attributed statements.',
                        })
                      }
                    />
                  ) : null}

                  {flags.includes('GRAPHIC_DETAIL') ? (
                    <V3Button
                      label="Soften for G-rating"
                      variant="dark"
                      size="sm"
                      disabled={busyAction !== null}
                      onPress={() =>
                        void handleRunAgentAction({
                          goal: 'Remove graphic details to meet G-rated safety.',
                          redirectInstructions:
                            'Remove all graphic or injury details and state what happened in one plain factual G-rated sentence.',
                        })
                      }
                    />
                  ) : null}
                </>
              )}

              <V3Button
                label={showCustomSteer ? 'Hide rewrite ▲' : 'Rewrite with AI ▼'}
                variant="outline"
                size="sm"
                onPress={() => setShowCustomSteer((v) => !v)}
              />
            </View>
          </View>

          {feedback ? (
            <View
              style={{
                paddingHorizontal: V3_SPACE.md,
                paddingVertical: V3_SPACE.sm,
                borderRadius: V3_RADII.control,
                backgroundColor: V3_COLORS.surface,
                borderWidth: 1,
                borderColor: V3_COLORS.border,
              }}
            >
              <V3Text role="mono" tone="ink">
                {feedback}
              </V3Text>
            </View>
          ) : null}

          {showProvideSource ? (
            <View style={{ gap: V3_SPACE.sm }}>
              <V3Rule />
              <V3Text role="kicker">PROVIDE BETTER SOURCE URL</V3Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: V3_SPACE.sm,
                }}
              >
                <View style={{ flex: 1, minWidth: 240 }}>
                  <V3Input
                    value={customSourceUrl}
                    onChangeText={setCustomSourceUrl}
                    placeholder="https://..."
                  />
                </View>
                <V3Button
                  label={
                    busyAction === 'regen'
                      ? 'Verifying...'
                      : 'Verify with source'
                  }
                  variant="dark"
                  size="sm"
                  disabled={
                    busyAction !== null || !customSourceUrl.trim().startsWith('http')
                  }
                  onPress={() =>
                    void handleRunAgentAction({
                      customSourceUrl: customSourceUrl.trim(),
                      redirectInstructions:
                        'Extract the full article from the editor-provided source URL and rewrite/verify all claims strictly against it.',
                    })
                  }
                />
              </View>
            </View>
          ) : null}

          {showCustomSteer ? (
            <View style={{ gap: V3_SPACE.md }}>
              <V3Rule />
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: V3_SPACE.xl,
                }}
              >
                <View style={{ gap: V3_SPACE.xs }}>
                  <V3Text role="kicker">READING LEVEL</V3Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: V3_SPACE.xs,
                    }}
                  >
                    {READING_LEVELS.map((lvl) => (
                      <Pressable
                        key={lvl}
                        onPress={() => setRegenLevel(lvl)}
                        style={{
                          paddingHorizontal: V3_SPACE.md,
                          paddingVertical: V3_SPACE.xs,
                          borderRadius: V3_RADII.control,
                          backgroundColor:
                            regenLevel === lvl
                              ? V3_COLORS.ink
                              : V3_COLORS.surface,
                        }}
                      >
                        <V3Text
                          role="mono"
                          tone={regenLevel === lvl ? 'inverse' : 'muted'}
                        >
                          {lvl}
                        </V3Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={{ gap: V3_SPACE.xs }}>
                  <V3Text role="kicker">TARGET LENGTH ({regenWords}W)</V3Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: V3_SPACE.xs,
                    }}
                  >
                    {WORD_TARGETS.map((w) => (
                      <Pressable
                        key={w}
                        onPress={() => setRegenWords(w)}
                        style={{
                          paddingHorizontal: V3_SPACE.md,
                          paddingVertical: V3_SPACE.xs,
                          borderRadius: V3_RADII.control,
                          backgroundColor:
                            regenWords === w
                              ? V3_COLORS.ink
                              : V3_COLORS.surface,
                        }}
                      >
                        <V3Text
                          role="mono"
                          tone={regenWords === w ? 'inverse' : 'muted'}
                        >
                          ~{w}w
                        </V3Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: V3_SPACE.sm,
                  alignItems: 'center',
                }}
              >
                <V3Input
                  value={regenRedirect}
                  onChangeText={setRegenRedirect}
                  placeholder="Instruction for AI rewrite..."
                  style={{ flex: 1, minWidth: 240 }}
                />
                <V3Button
                  label="Rewrite & Verify"
                  variant="primary"
                  size="sm"
                  disabled={busyAction !== null}
                  onPress={() =>
                    void handleRunAgentAction({
                      redirectInstructions: regenRedirect.trim(),
                    })
                  }
                />
              </View>
            </View>
          ) : null}

          {(liveSteps.length > 0 || busyAction === 'regen') &&
          (busyAction === 'regen' || regenPreview) ? (
            <View style={{ gap: V3_SPACE.xs }}>
              <V3Rule />
              <V3Text role="headline">
                Goal: {activeGoal || 'Updating and verifying draft'}
              </V3Text>
              {liveSteps.map((step, i) => {
                const icon =
                  step.status === 'done'
                    ? '✓'
                    : step.status === 'warn'
                      ? '!'
                      : '•';
                const tone =
                  step.status === 'done'
                    ? 'accent'
                    : step.status === 'warn'
                      ? 'warning'
                      : 'ink';
                return (
                  <View
                    key={`${step.at}-${i}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: V3_SPACE.sm,
                    }}
                  >
                    <V3Text role="mono" weight="700" tone={tone}>
                      {icon}
                    </V3Text>
                    <V3Text role="mono" weight="700" tone="ink">
                      {step.agent}:
                    </V3Text>
                    <V3Text role="body" tone="muted" style={{ flex: 1 }}>
                      {step.message}
                    </V3Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          {regenPreview ? (
            <View style={{ gap: V3_SPACE.sm }}>
              <V3Rule />
              <V3Text role="kicker" tone="accent">
                CANDIDATE REWRITE
              </V3Text>
              <V3Text role="section">{regenPreview.after.ai_headline}</V3Text>
              <V3Text role="body">{regenPreview.after.ai_summary}</V3Text>
              <V3Text role="mono" tone="muted">
                Judge: {regenPreview.after.confidence_reasoning}
              </V3Text>
              {regenPreview.after.addedSources &&
              regenPreview.after.addedSources.length > 0 ? (
                <V3Text role="mono" tone="accent" weight="600">
                  Consulted &amp; cited outlets:{' '}
                  {regenPreview.after.addedSources
                    .map((s) => s.name)
                    .join(', ')}
                </V3Text>
              ) : null}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  gap: V3_SPACE.sm,
                }}
              >
                <V3Button
                  label="Discard"
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    setRegenPreview(null);
                    setLiveSteps([]);
                    setActiveGoal(null);
                  }}
                />
                <V3Button
                  label="Accept Rewrite"
                  variant="primary"
                  size="sm"
                  disabled={busyAction !== null}
                  onPress={() => void handleAcceptRegenerated()}
                />
              </View>
            </View>
          ) : null}
        </V3Card>

        {/* 3. Unified Split Reading Desk (Filled Card Only — No Borders) */}
        <V3Card variant="filled" padding="xs" style={{ padding: 0 }}>
          <View
            style={{
              flexDirection: isWideSplit ? 'row' : 'column',
              alignItems: 'stretch',
            }}
          >
            {/* Left Column: Summary */}
            <View
              style={{
                flex: isWideSplit ? 4 : 1,
                padding: V3_SPACE.xl,
                gap: V3_SPACE.md,
                borderRightWidth: isWideSplit ? 1 : 0,
                borderBottomWidth: isWideSplit ? 0 : 1,
                borderColor: V3_COLORS.border,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <V3Text role="kicker">SUMMARY</V3Text>
                {!editingDraftText ? (
                  <V3Text role="mono" tone="subtle">
                    CLICK SENTENCE TO MATCH QUOTE
                  </V3Text>
                ) : null}
              </View>

              {editingDraftText ? (
                <V3Input
                  value={summary}
                  onChangeText={setSummary}
                  multiline
                  textAlignVertical="top"
                  style={{ minHeight: 220 }}
                />
              ) : (
                <View style={{ gap: V3_SPACE.xs }}>
                  {sentenceMappings.map((item) => {
                    const isSelected = selectedSentenceIdx === item.idx;
                    const isFlagged = item.status !== 'supported';
                    return (
                      <Pressable
                        key={item.idx}
                        onPress={() => setSelectedSentenceIdx(item.idx)}
                        style={{
                          paddingHorizontal: V3_SPACE.md,
                          paddingVertical: V3_SPACE.sm,
                          borderLeftWidth: 2,
                          borderLeftColor: isSelected
                            ? item.status === 'unsupported'
                              ? V3_COLORS.danger
                              : V3_COLORS.accent
                            : item.status === 'unsupported'
                              ? V3_COLORS.danger
                              : 'transparent',
                          backgroundColor:
                            item.status === 'unsupported'
                              ? V3_COLORS.dangerSoft
                              : isSelected
                                ? V3_COLORS.accentSoft
                                : 'transparent',
                          ...(Platform.OS === 'web'
                            ? ({ cursor: 'pointer' } as Record<
                                string,
                                unknown
                              >)
                            : {}),
                        }}
                      >
                        <V3Text
                          role="body"
                          weight={isSelected ? '500' : '400'}
                        >
                          {item.sentence}
                        </V3Text>
                        {isFlagged ? (
                          <View style={{ marginTop: V3_SPACE.xs }}>
                            <V3Badge
                              label={
                                item.status === 'unsupported'
                                  ? 'UNSUPPORTED IN SOURCE'
                                  : 'SNIPPET ONLY'
                              }
                              tone={
                                item.status === 'unsupported'
                                  ? 'rejected'
                                  : 'pending'
                              }
                            />
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {article.ai_explanation ? (
                <>
                  <V3Rule />
                  <View style={{ gap: V3_SPACE.xs }}>
                    <V3Text role="kicker">WHY IT MATTERS</V3Text>
                    <V3Text role="body" tone="muted">
                      {article.ai_explanation}
                    </V3Text>
                  </View>
                </>
              ) : null}
            </View>

            {/* Right Column: Source Text */}
            <View
              style={{
                flex: isWideSplit ? 6 : 1,
                padding: V3_SPACE.xl,
                gap: V3_SPACE.md,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <V3Text role="kicker">SOURCE TEXT</V3Text>
                <V3Text role="mono" tone="subtle">
                  {snippetUnverified
                    ? 'FALLBACK RSS SNIPPET'
                    : 'EXTRACTED PUBLISHER TEXT'}
                </V3Text>
              </View>

              {activeMapping?.status === 'unsupported' ? (
                <V3Text role="body" tone="danger" weight="600">
                  No direct quote found in the source text for the selected
                  sentence.
                </V3Text>
              ) : null}

              <ScrollView
                showsVerticalScrollIndicator
                nestedScrollEnabled
                style={{ maxHeight: 460 }}
                contentContainerStyle={{ gap: V3_SPACE.sm }}
              >
                {sourceSegments.length === 0 ? (
                  <V3Text role="body" tone="muted">
                    No source text stored for this story. Click &ldquo;Open source
                    ↗&rdquo; above to read the original article.
                  </V3Text>
                ) : (
                  sourceSegments.map((seg, idx) => (
                    <View
                      key={idx}
                      style={{
                        paddingHorizontal: seg.highlighted ? V3_SPACE.md : 0,
                        paddingVertical: seg.highlighted ? V3_SPACE.xs : 0,
                        backgroundColor: seg.highlighted
                          ? V3_COLORS.accentSoft
                          : 'transparent',
                        borderLeftWidth: seg.highlighted ? 2 : 0,
                        borderLeftColor: seg.highlighted
                          ? V3_COLORS.accent
                          : 'transparent',
                      }}
                    >
                      <V3Text
                        role="body"
                        weight={seg.highlighted ? '600' : '400'}
                        tone={seg.highlighted ? 'ink' : 'muted'}
                      >
                        {seg.text}
                      </V3Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </V3Card>

        {/* 4. Compact Judge Checks & Trace Strip (Outlined Card Only) */}
        <V3Card variant="outlined" padding="lg" style={{ gap: V3_SPACE.md }}>
          <Pressable
            onPress={() => setShowDiagnostics((v) => !v)}
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: V3_SPACE.md,
              ...(Platform.OS === 'web'
                ? ({ cursor: 'pointer' } as Record<string, unknown>)
                : {}),
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: V3_SPACE.lg,
              }}
            >
              <V3Text role="kicker">VERIFIER CHECKS</V3Text>

              <V3Text role="mono" tone="ink" tabularNums>
                ACCURACY:{' '}
                <V3Text
                  role="mono"
                  weight="700"
                  tone={snippetUnverified ? 'danger' : getScoreTone(accuracyScore)}
                >
                  {snippetUnverified ? 'NOT VERIFIED' : accuracyScore}
                </V3Text>
              </V3Text>

              <V3Text role="mono" tone="ink" tabularNums>
                NEUTRALITY:{' '}
                <V3Text
                  role="mono"
                  weight="700"
                  tone={getScoreTone(neutralityScore)}
                >
                  {neutralityScore}
                </V3Text>
              </V3Text>

              <V3Text role="mono" tone="ink" tabularNums>
                SAFETY:{' '}
                <V3Text
                  role="mono"
                  weight="700"
                  tone={getScoreTone(safetyScore)}
                >
                  {safetyScore}
                </V3Text>
              </V3Text>

              <V3Text role="mono" tone="ink" tabularNums>
                READABILITY:{' '}
                <V3Text
                  role="mono"
                  weight="700"
                  tone={getScoreTone(readabilityScore)}
                >
                  {readabilityScore}
                </V3Text>
              </V3Text>
            </View>

            <V3Text role="mono" tone="muted">
              {showDiagnostics ? 'HIDE TRACE ▲' : 'AGENT TRACE ▼'}
            </V3Text>
          </Pressable>

          {showDiagnostics ? (
            <View style={{ gap: V3_SPACE.md }}>
              <V3Rule />
              <View style={{ gap: 2 }}>
                <V3Text role="headline">
                  1. Curator · {article.source_count ?? 1} outlet(s)
                  {fetcherStep?.duration_ms
                    ? ` · ${fetcherStep.duration_ms}ms`
                    : ''}
                </V3Text>
                <V3Text role="body" tone="muted">
                  {article.selection_reason ||
                    'Selected for high global impact and multi-outlet coverage.'}{' '}
                  ({(article.source_names ?? []).join(', ') || 'Primary feed'})
                </V3Text>
              </View>

              <V3Rule />

              <View style={{ gap: 2 }}>
                <V3Text role="headline">
                  2. Writer · Policy{' '}
                  {snapshot?.prompt_version || article.prompt_version || 'v1'} ·{' '}
                  {snapshot?.reading_level || 'grade 6'} · ~
                  {snapshot?.target_summary_words || 60}w
                </V3Text>
                <V3Text role="body" tone="muted">
                  {summarizerStep?.summary ||
                    `Rewrote story at ${snapshot?.reading_level || 'grade 6'} level.`}
                </V3Text>
                <V3Text role="mono" tone="subtle">
                  {snapshot?.locked_core_summary || LOCKED_CORE_SUMMARY}
                </V3Text>
              </View>

              <V3Rule />

              <View style={{ gap: V3_SPACE.xs }}>
                <V3Text role="headline">
                  3. Verifier · {editorialState} ·{' '}
                  {flags.length > 0
                    ? flags.map(getFlagShortLabel).join(', ')
                    : 'No flags'}
                </V3Text>
                <ReasoningBulletList
                  text={
                    article.confidence_reasoning ||
                    judgeStep?.summary ||
                    'Verified claims and rubric scores.'
                  }
                  tone="muted"
                />
                {flags.map((f: ArticleFlag) => (
                  <V3Text key={f} role="mono" tone="danger">
                    • {getFlagShortLabel(f)}: {getFlagPlainReason(f)}
                  </V3Text>
                ))}
              </View>
            </View>
          ) : null}
        </V3Card>

        {/* 5. Revision History */}
        <V3Card variant="outlined" padding="lg" style={{ gap: V3_SPACE.md }}>
          <Pressable
            onPress={() => setShowRevisions((v) => !v)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: V3_SPACE.md,
              ...(Platform.OS === 'web'
                ? ({ cursor: 'pointer' } as Record<string, unknown>)
                : {}),
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: V3_SPACE.md,
              }}
            >
              <V3Text role="kicker">
                REVISION HISTORY ({article.revisions?.length ?? 1})
              </V3Text>
              <V3Text role="mono" tone="muted">
                {article.used_fallback_snippet
                  ? 'STARTED FROM RSS SNIPPET'
                  : 'FULL SOURCE'}
              </V3Text>
            </View>
            <V3Text role="kicker" tone="subtle">
              {showRevisions ? 'HIDE REVISIONS ▲' : 'SHOW REVISIONS ▼'}
            </V3Text>
          </Pressable>

          {showRevisions ? (
            <View style={{ gap: V3_SPACE.md }}>
              <V3Rule />
              {(article.revisions && article.revisions.length > 0
                ? article.revisions
                : ([
                    {
                      at: article.edited_at || article.date,
                      kind: 'initial',
                      headline: article.ai_headline,
                      summary: article.ai_summary,
                      original_url: article.original_url,
                      source_name: article.source_names?.[0],
                      used_fallback_snippet: Boolean(
                        article.used_fallback_snippet
                      ),
                      confidence_score: article.confidence_score,
                      note: article.used_fallback_snippet
                        ? 'Started from short RSS snippet'
                        : 'Initial collected draft',
                    },
                  ] as ArticleRevision[])
              ).map((rev, idx) => {
                const kindLabel =
                  rev.kind === 'initial'
                    ? rev.used_fallback_snippet
                      ? 'INITIAL RSS SNIPPET'
                      : 'INITIAL DRAFT'
                    : rev.kind === 'source_change'
                      ? 'NEW SOURCE'
                      : rev.kind === 'ai_rewrite'
                        ? 'AI REWRITE'
                        : rev.kind === 'manual_edit'
                          ? 'MANUAL EDIT'
                          : 'PUBLISHED';
                const kindTone =
                  rev.kind === 'published' || rev.kind === 'source_change'
                    ? 'approved'
                    : rev.used_fallback_snippet
                      ? 'pending'
                      : 'neutral';
                return (
                  <View key={`${rev.at}-${idx}`} style={{ gap: V3_SPACE.xs }}>
                    {idx > 0 ? <V3Rule /> : null}
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: V3_SPACE.sm,
                      }}
                    >
                      <V3Badge label={kindLabel} tone={kindTone} />
                      <V3Text role="mono" tone="muted">
                        {rev.at}
                      </V3Text>
                      {rev.source_name ? (
                        <V3Text role="mono" tone="ink">
                          {rev.source_name}
                        </V3Text>
                      ) : null}
                      {typeof rev.confidence_score === 'number' ? (
                        <V3Text role="mono" tone="muted">
                          SCORE {rev.confidence_score}
                        </V3Text>
                      ) : null}
                    </View>
                    <V3Text role="headline">{rev.headline}</V3Text>
                    <V3Text role="body" tone="muted">
                      {rev.summary}
                    </V3Text>
                    {rev.original_url ? (
                      <V3Text role="mono" tone="subtle">
                        {rev.original_url}
                      </V3Text>
                    ) : null}
                    {rev.note ? (
                      <V3Text role="mono" tone="muted">
                        {rev.note}
                      </V3Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}
        </V3Card>

        {feedback ? (
          <V3Card
            variant="filled"
            padding="md"
            style={{ backgroundColor: V3_COLORS.accentSoft }}
          >
            <V3Text role="body" weight="600" tone="accent">
              {feedback}
            </V3Text>
          </V3Card>
        ) : null}
      </ScrollView>
    </View>
  );
}

