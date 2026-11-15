import { useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  DSBadge,
  DSButton,
  DSChip,
  DSDivider,
  DSInput,
  DSSurface,
  DSText,
  useDSTheme,
  type DSTone,
} from '@/design-system';
import {
  acceptRegeneratedDraft,
  LOCKED_CORE_SUMMARY,
  regenerateDraftRequest,
  type RegenerateResponse,
} from '@/hooks/useGovernance';
import {
  getEditorialState,
  getEditorialStateTone,
  getFlagPlainReason,
  getFlagShortLabel,
  getWhyThisNeedsYouMessage,
  isSnippetOnlyUnverified,
} from '@/lib/editorialLabels';
import type { Article, ArticleFlag, ReadingLevel } from '@/types/article';
import { BottomDrawer } from './BottomDrawer';

export interface ArticleReaderPaneProps {
  article: Article;
  adminUid: string;
  getIdToken: () => Promise<string>;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onClose?: () => void;
  closeLabel?: string;
  onSaveChanges: (id: string, headline: string, summary: string) => Promise<void>;
  onApprove: (
    id: string,
    headline: string,
    summary: string,
    adminUid: string
  ) => Promise<void>;
  onReject: (id: string, reason?: string) => Promise<void>;
  onUnpublish?: (id: string) => Promise<void>;
  onConfirmKidsTopic?: (id: string, confirmed: boolean) => Promise<void>;
  onConfirmSourceChecked?: (id: string, checked: boolean) => Promise<void>;
}

export interface ArticleReaderDrawerProps
  extends Omit<ArticleReaderPaneProps, 'article'> {
  article: Article | null;
  onClose: () => void;
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
  tone: DSTone;
} {
  if (article.status === 'published') {
    return { label: 'Published', tone: 'success' };
  }
  if (article.status === 'rejected') {
    return { label: 'Rejected', tone: 'danger' };
  }
  const state = getEditorialState(article);
  return { label: state, tone: getEditorialStateTone(state) };
}

function getScoreTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 85) return 'success';
  if (score >= 65) return 'warning';
  return 'danger';
}

type JudgeDimensionKey = 'accuracy' | 'neutrality' | 'safety' | 'readability';

interface JudgeCheckItem {
  key: JudgeDimensionKey;
  label: string;
  displayValue: string;
  tone: DSTone;
  reason: string | null;
  needsAttention: boolean;
}

interface ParsedJudgeReasoning {
  byDimension: Partial<Record<JudgeDimensionKey, string>>;
  generalNotes: string[];
}

function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const sentences: string[] = [];
  let start = 0;
  for (let i = 0; i < cleaned.length - 2; i++) {
    const ch = cleaned[i];
    if ((ch === '.' || ch === '!' || ch === '?') && cleaned[i + 1] === ' ') {
      const prevTwo = cleaned.slice(Math.max(0, i - 2), i + 1);
      const nextChar = cleaned[i + 2];
      if (!/^[A-Z]\.[A-Z]\.$/.test(prevTwo) && /[A-Z"'(]/.test(nextChar)) {
        const part = cleaned.slice(start, i + 1).trim();
        if (part) sentences.push(part);
        start = i + 2;
      }
    }
  }
  const tail = cleaned.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

/**
 * Splits Judge `confidence_reasoning` into per-dimension rubric explanations
 * plus any remaining unmapped sentences so the UI renders scannable rows.
 */
function parseJudgeReasoning(reasoning: string): ParsedJudgeReasoning {
  const normalized = reasoning.replace(/\s+/g, ' ').trim();
  if (!normalized) return { byDimension: {}, generalNotes: [] };

  const anchorRe =
    /(?:^|[.!?]\s+)(Accuracy|Neutrality|Safety(?:\s*\(G\))?|Readability)\b(?=\s*(?:score\b|is\b|was\b|remains\b|:|-|–|\(|\d|checks?\b|passed\b|rating\b))/gi;

  const anchors: { dimIndex: number; key: JudgeDimensionKey }[] = [];
  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(normalized)) !== null) {
    const prefixLen = match[0].length - match[1].length;
    const rawDim = match[1].toLowerCase();
    const key: JudgeDimensionKey = rawDim.startsWith('safety')
      ? 'safety'
      : (rawDim as JudgeDimensionKey);
    anchors.push({ dimIndex: match.index + prefixLen, key });
  }

  if (anchors.length === 0) {
    return { byDimension: {}, generalNotes: splitSentences(normalized) };
  }

  const byDimension: Partial<Record<JudgeDimensionKey, string>> = {};
  const generalNotes: string[] = [];

  if (anchors[0].dimIndex > 0) {
    generalNotes.push(...splitSentences(normalized.slice(0, anchors[0].dimIndex)));
  }

  for (let i = 0; i < anchors.length; i++) {
    const start = anchors[i].dimIndex;
    const end = i + 1 < anchors.length ? anchors[i + 1].dimIndex : normalized.length;
    const segment = normalized.slice(start, end).trim();

    let detail = segment
      .replace(
        /^(?:Accuracy|Neutrality|Safety(?:\s*\(G\))?|Readability)(?:\s*\(G\))?(?:\s+score)?(?:\s*\(\s*\d+(?:\s*\/\s*100)?\s*\))?(?:\s*(?:is|was|remains|:|-|–)\s*\d+(?:\s*\/\s*100)?)?(?:\s*(?:because|since|as|with|given|where|—|-|:|,)\s*)?/i,
        ''
      )
      .trim();

    if (/^[.,;:!?-]*$/.test(detail)) {
      detail = '';
    } else if (detail.length > 0) {
      detail = detail.charAt(0).toUpperCase() + detail.slice(1);
    }

    if (detail) {
      const key = anchors[i].key;
      byDimension[key] = byDimension[key]
        ? `${byDimension[key]} ${detail}`
        : detail;
    }
  }

  return { byDimension, generalNotes };
}

interface JudgeBreakdownProps {
  judgeChecks: JudgeCheckItem[];
  extraNotes: string[];
  hasPerDimensionReasons: boolean;
  snippetUnverified: boolean;
  badgeRowTitle?: string;
  fallbackText?: string;
}

/**
 * Renders scannable Judge rubric rows (badge + concise reason) or a compact
 * score badge strip when no per-dimension explanation is present.
 */
function JudgeBreakdown({
  judgeChecks,
  extraNotes,
  hasPerDimensionReasons,
  snippetUnverified,
  badgeRowTitle,
  fallbackText,
}: JudgeBreakdownProps) {
  const { theme } = useDSTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {extraNotes.length > 0 ? (
        <View style={{ gap: theme.spacing.xxs }}>
          {extraNotes.map((note, idx) => (
            <DSText
              key={`${idx}-${note.slice(0, 16)}`}
              variant="caption"
              tone="primary"
            >
              • {note}
            </DSText>
          ))}
        </View>
      ) : null}

      {hasPerDimensionReasons ? (
        <View style={{ gap: theme.spacing.sm }}>
          {judgeChecks.map((check) => (
            <View
              key={check.key}
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
                columnGap: theme.spacing.sm,
                rowGap: theme.spacing.xs,
              }}
            >
              <View style={{ alignItems: 'flex-start' }}>
                <DSBadge
                  label={`${check.label} · ${check.displayValue}`}
                  tone={check.tone}
                  bordered={check.needsAttention}
                />
              </View>
              <DSText
                variant="caption"
                tone={check.needsAttention ? 'primary' : 'secondary'}
                style={{
                  flex: 1,
                  minWidth: 200,
                  lineHeight: 19,
                  paddingTop: 2,
                }}
              >
                {check.reason ??
                  (check.key === 'accuracy' && snippetUnverified
                    ? 'Could not verify against full source text.'
                    : 'Passed check.')}
              </DSText>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ gap: theme.spacing.xs }}>
          {extraNotes.length === 0 && fallbackText ? (
            <DSText variant="caption" tone="secondary">
              {fallbackText}
            </DSText>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            {badgeRowTitle ? (
              <DSText variant="caption" weight="semibold" tone="secondary">
                {badgeRowTitle}
              </DSText>
            ) : null}
            {judgeChecks.map((check) => (
              <DSBadge
                key={check.key}
                label={`${check.label} · ${check.displayValue}`}
                tone={check.tone}
                bordered={check.needsAttention}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export function ArticleReaderDrawer(props: ArticleReaderDrawerProps) {
  return (
    <BottomDrawer
      visible={Boolean(props.article)}
      onClose={props.onClose}
      storageKey="snappylit_admin_reader_drawer_height_ratio_v1"
      accessibilityLabel="Close article drawer"
    >
      {props.article ? (
        <ArticleReaderPane
          key={props.article.id}
          {...props}
          article={props.article}
        />
      ) : null}
    </BottomDrawer>
  );
}

/**
 * Reusable article editorial review, split summary/source reader, and Agent trace
 * workspace that can render either inside `BottomDrawer` or docked in a split panel.
 */
export function ArticleReaderPane({
  article,
  adminUid,
  hasPrev = false,
  hasNext = false,
  getIdToken,
  onPrev,
  onNext,
  onClose,
  closeLabel = '← Back',
  onSaveChanges,
  onApprove,
  onReject,
  onUnpublish,
  onConfirmSourceChecked,
}: ArticleReaderPaneProps) {
  const { theme } = useDSTheme();

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

  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);
  const effectiveWidth = containerWidth > 0 ? containerWidth : windowWidth;
  const isWideSplit = effectiveWidth >= 900;
  const tracePanelWidth = effectiveWidth >= 1220 ? 360 : 300;

  const [selectedSentenceIdx, setSelectedSentenceIdx] = useState<number | null>(
    0
  );
  const [localSourceChecked, setLocalSourceChecked] = useState(
    Boolean(article.source_checked)
  );

  // Split summary into sentences and pair each sentence with its closest Judge claim
  const sentenceMappings = useMemo(() => {
    const sentences = summary
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const claims = article.claims ?? [];
    const unverifiedSnippet = isSnippetOnlyUnverified(article);

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

      const evidenceQuote = bestClaim?.evidence?.trim() || '';
      const isExplicitlyUnsupported =
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
  }, [article, summary]);

  // Split source text into sentences and highlight whichever matches the selected draft sentence
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

  const rawConfidenceReasoning = (article.confidence_reasoning ?? '').trim();
  const parsedJudge = useMemo(
    () => parseJudgeReasoning(rawConfidenceReasoning),
    [rawConfidenceReasoning]
  );
  const judgeChecks = useMemo<JudgeCheckItem[]>(() => {
    const items: JudgeCheckItem[] = [
      {
        key: 'accuracy',
        label: 'Accuracy',
        displayValue: snippetUnverified ? 'Not verified' : String(accuracyScore),
        tone: snippetUnverified ? 'danger' : getScoreTone(accuracyScore),
        reason: parsedJudge.byDimension.accuracy ?? null,
        needsAttention: snippetUnverified || accuracyScore < 100,
      },
      {
        key: 'neutrality',
        label: 'Neutrality',
        displayValue: String(neutralityScore),
        tone: getScoreTone(neutralityScore),
        reason: parsedJudge.byDimension.neutrality ?? null,
        needsAttention: neutralityScore < 100,
      },
      {
        key: 'safety',
        label: 'Safety (G)',
        displayValue: String(safetyScore),
        tone: getScoreTone(safetyScore),
        reason: parsedJudge.byDimension.safety ?? null,
        needsAttention: safetyScore < 100,
      },
      {
        key: 'readability',
        label: 'Readability',
        displayValue: String(readabilityScore),
        tone: getScoreTone(readabilityScore),
        reason: parsedJudge.byDimension.readability ?? null,
        needsAttention: readabilityScore < 100,
      },
    ];
    return [...items].sort(
      (a, b) => Number(b.needsAttention) - Number(a.needsAttention)
    );
  }, [
    accuracyScore,
    neutralityScore,
    safetyScore,
    readabilityScore,
    snippetUnverified,
    parsedJudge,
  ]);
  const primaryIsRawReasoning =
    rawConfidenceReasoning.length > 0 &&
    whyNeedsYou.sentence.trim() === rawConfidenceReasoning;
  const extraJudgeNotes = parsedJudge.generalNotes.filter(
    (note) => note !== whyNeedsYou.sentence.trim()
  );
  const hasPerDimensionReasons = judgeChecks.some((c) => Boolean(c.reason));
  const flaggedTriageReasons = judgeChecks
    .filter((c) => c.needsAttention && c.reason)
    .map((c) => c.reason!);
  const triageNotes = !primaryIsRawReasoning
    ? [whyNeedsYou.sentence]
    : flaggedTriageReasons.length > 0
      ? flaggedTriageReasons
      : extraJudgeNotes.length > 0
        ? extraJudgeNotes
        : ['Flagged for a quick editorial check.'];

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
    redirectInstructions: string;
    readingLevel?: ReadingLevel;
    tryAlternateSource?: boolean;
  }) => {
    setBusyAction('regen');
    setFeedback(null);
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
        idToken: token,
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
      await acceptRegeneratedDraft(article.id, regenPreview);
      setHeadline(regenPreview.after.ai_headline);
      setSummary(regenPreview.after.ai_summary);
      setRegenPreview(null);
      setRegenRedirect('');
      setFeedback('Updated draft & Judge verification applied.');
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

  const agentTraceSection = (
    <View style={{ gap: theme.spacing.sm }}>
      <DSText variant="headline" weight="semibold" tone="primary">
        Agent trace
      </DSText>

      <DSSurface variant="surface" radius="md" bordered>
        <View
          style={{
            padding: theme.spacing.lg,
            gap: theme.spacing.md,
          }}
        >
          {/* Fetcher */}
          <View style={{ gap: theme.spacing.xs }}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
              }}
            >
              <DSText variant="caption" weight="semibold" tone="primary">
                1. Fetcher · {article.source_count ?? 1} outlet(s)
                {fetcherStep?.duration_ms ? ` · ${fetcherStep.duration_ms}ms` : ''}
              </DSText>
              <DSButton
                label="Open source ↗"
                variant="secondary"
                size="sm"
                onPress={() => Linking.openURL(article.original_url)}
              />
            </View>
            <DSText variant="caption" tone="secondary">
              {article.selection_reason ||
                'Selected for high global impact and multi-outlet coverage.'}{' '}
              ({(article.source_names ?? []).join(', ') || 'Primary feed'})
            </DSText>
          </View>

          <DSDivider />

          {/* Summarizer */}
          <View style={{ gap: theme.spacing.xxs }}>
            <DSText variant="caption" weight="semibold" tone="primary">
              2. Summarizer · Policy{' '}
              {snapshot?.prompt_version || article.prompt_version || 'v1'} ·{' '}
              {snapshot?.reading_level || 'grade 6'} · ~
              {snapshot?.target_summary_words || 60} words
              {article.auto_retried_complexity ? ' · Auto-simplified once' : ''}
            </DSText>
            <DSText variant="caption" tone="secondary">
              {summarizerStep?.summary ||
                `Rewrote story at ${snapshot?.reading_level || 'grade 6'} level in ${snapshot?.tone || 'calm_neutral'} tone.`}
            </DSText>
            {snapshot?.admin_instructions ? (
              <DSText variant="caption" tone="primary">
                Tier 2 instructions: {snapshot.admin_instructions}
              </DSText>
            ) : null}
            {snapshot?.editor_redirect ? (
              <DSText variant="caption" tone="accent">
                Editor redirect: {snapshot.editor_redirect}
              </DSText>
            ) : null}
            <DSText variant="micro" tone="tertiary">
              {snapshot?.locked_core_summary || LOCKED_CORE_SUMMARY}
            </DSText>
          </View>

          <DSDivider />

          {/* Judge */}
          <View style={{ gap: theme.spacing.xs }}>
            <DSText variant="caption" weight="semibold" tone="primary">
              3. Judge · {editorialState} ·{' '}
              {flags.length > 0 ? flags.map(getFlagShortLabel).join(', ') : 'No flags'}
            </DSText>

            <JudgeBreakdown
              judgeChecks={judgeChecks}
              extraNotes={extraJudgeNotes}
              hasPerDimensionReasons={hasPerDimensionReasons}
              snippetUnverified={snippetUnverified}
              fallbackText={
                judgeStep?.summary || 'Verified claims and rubric scores.'
              }
            />

            {flags.length > 0 ? (
              <View style={{ gap: theme.spacing.xxs }}>
                {flags.map((f: ArticleFlag) => (
                  <DSText key={f} variant="caption" tone="danger">
                    • {getFlagShortLabel(f)}: {getFlagPlainReason(f)}
                  </DSText>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </DSSurface>
    </View>
  );

  return (
    <View
      onLayout={(e) => {
        const nextWidth = Math.round(e.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== containerWidth) {
          setContainerWidth(nextWidth);
        }
      }}
      style={{ flex: 1, minHeight: 0, flexDirection: 'column' }}
    >
      {/* Top Toolbar & Editorial Action Items */}
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderBottomWidth: theme.layout.borderWidth,
          borderBottomColor: theme.colors.borderDefault,
          paddingHorizontal: theme.spacing.xxl,
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.sm,
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
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              flexWrap: 'wrap',
            }}
          >
            {onClose ? (
              <DSButton
                label={closeLabel}
                variant="secondary"
                size="sm"
                onPress={onClose}
              />
            ) : null}
            {onPrev && onNext ? (
              <>
                <DSButton
                  label="‹ Prev"
                  variant="secondary"
                  size="sm"
                  disabled={!hasPrev}
                  onPress={onPrev}
                />
                <DSButton
                  label="Next ›"
                  variant="secondary"
                  size="sm"
                  disabled={!hasNext}
                  onPress={onNext}
                />
              </>
            ) : null}
            <DSBadge label={statusBadge.label} tone={statusBadge.tone} />
            {article.sensitive ? (
              <DSBadge label="Sensitive" tone="neutral" />
            ) : null}
            {article.prompt_version ? (
              <DSBadge
                label={`Policy ${article.prompt_version}`}
                tone="neutral"
              />
            ) : null}
          </View>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <DSButton
              label={article.status === 'rejected' ? 'Rejected' : 'Reject'}
              variant="danger"
              size="sm"
              loading={busyAction === 'reject'}
              disabled={busyAction !== null || article.status === 'rejected'}
              onPress={handleReject}
            />

            {article.status === 'published' && onUnpublish ? (
              <DSButton
                label="Unpublish"
                variant="secondary"
                size="sm"
                loading={busyAction === 'unpublish'}
                disabled={busyAction !== null}
                onPress={handleUnpublish}
              />
            ) : null}

            {isDirty || editingDraftText ? (
              <DSButton
                label="Save Changes"
                variant="secondary"
                size="sm"
                loading={busyAction === 'save'}
                disabled={busyAction !== null}
                onPress={handleSave}
              />
            ) : null}

            <DSButton
              label={
                article.status === 'published'
                  ? 'Update Published'
                  : 'Approve & Publish'
              }
              variant="primary"
              size="sm"
              loading={busyAction === 'approve'}
              disabled={busyAction !== null || !canApproveNow}
              onPress={handleApprove}
            />
          </View>
        </View>

        {requiresPreFlightCheck && article.status !== 'published' ? (
          <Pressable
            onPress={() => void handleToggleSourceCheck()}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingTop: theme.spacing.xxs,
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: theme.radii.xs,
                borderWidth: 1.5,
                borderColor: localSourceChecked
                  ? theme.colors.accent
                  : theme.colors.tones.danger.text,
                backgroundColor: localSourceChecked
                  ? theme.colors.accent
                  : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {localSourceChecked ? (
                <DSText variant="micro" weight="bold" tone="inverse">
                  ✓
                </DSText>
              ) : null}
            </View>
            <DSText
              variant="caption"
              weight="semibold"
              tone={localSourceChecked ? 'primary' : 'danger'}
            >
              I checked this against the source (required to approve &ldquo;Could
              not verify&rdquo; stories)
            </DSText>
          </Pressable>
        ) : null}
      </View>

      {/* Main Editorial Workspace + Right Agent Trace Panel */}
      <View
        style={{
          flex: 1,
          minHeight: 0,
          flexDirection: isWideSplit ? 'row' : 'column',
        }}
      >
        <ScrollView
          style={{ flex: 1, minHeight: 0, minWidth: 0 }}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.xxl,
            paddingVertical: theme.spacing.xl,
            paddingBottom: theme.spacing.xxxl,
            gap: theme.spacing.xl,
          }}
        >
        {/* 1. Headline First (Editorial Hierarchy) */}
        <View style={{ gap: theme.spacing.xs }}>
          <DSText variant="caption" tone="tertiary">
            {article.date}
            {article.topic ? ` · ${article.topic}` : ''}
            {article.region ? ` · ${article.region}` : ''}
            {article.source_names?.length
              ? ` · ${article.source_names.join(', ')}`
              : ''}
          </DSText>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
            }}
          >
            <View style={{ flex: 1, minWidth: 260 }}>
              {editingDraftText ? (
                <DSInput
                  value={headline}
                  onChangeText={setHeadline}
                  multiline
                  style={[
                    theme.typography.title2,
                    { fontWeight: '600', minHeight: 52 },
                  ]}
                />
              ) : (
                <DSText variant="title2" weight="semibold" tone="primary">
                  {headline}
                </DSText>
              )}
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              {isDirty ? (
                <DSBadge label="Unsaved edits" tone="warning" />
              ) : null}
              <DSButton
                label={editingDraftText ? 'Done editing' : 'Edit text'}
                variant="secondary"
                size="sm"
                onPress={() => setEditingDraftText((v) => !v)}
              />
            </View>
          </View>
        </View>

        {/* 2. Editorial Review & AI Action Controls */}
        <View style={{ gap: theme.spacing.sm }}>
          <DSText variant="headline" weight="semibold" tone="primary">
            Editorial review
          </DSText>

          <DSSurface
            variant="muted"
            radius="md"
            bordered
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              gap: theme.spacing.md,
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
              <DSText
                variant="caption"
                weight="semibold"
                tone={getEditorialStateTone(whyNeedsYou.state)}
              >
                {whyNeedsYou.headline}
              </DSText>
              {triageNotes.map((note, idx) => (
                <DSText
                  key={`${idx}-${note.slice(0, 16)}`}
                  variant="body"
                  tone="primary"
                >
                  {triageNotes.length > 1 ? `• ${note}` : note}
                </DSText>
              ))}
            </View>

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              {snippetUnverified ? (
                <DSButton
                  label="Try another source"
                  variant="charcoal"
                  size="sm"
                  loading={busyAction === 'regen'}
                  disabled={busyAction !== null}
                  onPress={() =>
                    void handleRunAgentAction({
                      redirectInstructions:
                        'Re-extract from alternate outlet URL and verify all claims against full text.',
                      tryAlternateSource: true,
                    })
                  }
                />
              ) : null}

              {flags.includes('TOO_COMPLEX') ? (
                <DSButton
                  label="Simplify"
                  variant="charcoal"
                  size="sm"
                  loading={busyAction === 'regen'}
                  disabled={busyAction !== null}
                  onPress={() =>
                    void handleRunAgentAction({
                      readingLevel: 'grade 5',
                      redirectInstructions:
                        'Simplify reading level to Grade 5–6. Replace complex or technical terms with everyday words and shorten long sentences.',
                    })
                  }
                />
              ) : null}

              {flags.includes('ONE_SIDED') ? (
                <DSButton
                  label="Add other side"
                  variant="charcoal"
                  size="sm"
                  loading={busyAction === 'regen'}
                  disabled={busyAction !== null}
                  onPress={() =>
                    void handleRunAgentAction({
                      redirectInstructions:
                        'Present each side’s position in one calm, neutral attributed sentence so the summary is balanced.',
                    })
                  }
                />
              ) : null}

              {flags.includes('LOADED_LANGUAGE') ? (
                <DSButton
                  label="Neutralize tone"
                  variant="charcoal"
                  size="sm"
                  loading={busyAction === 'regen'}
                  disabled={busyAction !== null}
                  onPress={() =>
                    void handleRunAgentAction({
                      redirectInstructions:
                        'Replace any loaded or emotional adjectives with plain, neutral verbs and attributed statements.',
                    })
                  }
                />
              ) : null}

              {flags.includes('GRAPHIC_DETAIL') ? (
                <DSButton
                  label="Soften for G-rating"
                  variant="charcoal"
                  size="sm"
                  loading={busyAction === 'regen'}
                  disabled={busyAction !== null}
                  onPress={() =>
                    void handleRunAgentAction({
                      redirectInstructions:
                        'Remove all graphic or injury details and state what happened in one plain factual G-rated sentence.',
                    })
                  }
                />
              ) : null}

              <DSButton
                label={showCustomSteer ? 'Hide rewrite ▲' : 'Rewrite with AI ▼'}
                variant="secondary"
                size="sm"
                onPress={() => setShowCustomSteer((v) => !v)}
              />
            </View>
          </View>

          {showCustomSteer ? (
            <DSSurface
              variant="surface"
              radius="sm"
              bordered
              style={{ padding: theme.spacing.md, gap: theme.spacing.md }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: theme.spacing.lg,
                }}
              >
                <View style={{ gap: theme.spacing.xs }}>
                  <DSText variant="micro" weight="semibold" tone="tertiary">
                    Reading level
                  </DSText>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: theme.spacing.xs,
                    }}
                  >
                    {READING_LEVELS.map((lvl) => (
                      <DSChip
                        key={lvl}
                        label={lvl}
                        active={regenLevel === lvl}
                        onPress={() => setRegenLevel(lvl)}
                      />
                    ))}
                  </View>
                </View>

                <View style={{ gap: theme.spacing.xs }}>
                  <DSText variant="micro" weight="semibold" tone="tertiary">
                    Target length ({regenWords}w)
                  </DSText>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: theme.spacing.xs,
                    }}
                  >
                    {WORD_TARGETS.map((w) => (
                      <DSChip
                        key={w}
                        label={`~${w}w`}
                        active={regenWords === w}
                        onPress={() => setRegenWords(w)}
                      />
                    ))}
                  </View>
                </View>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: theme.spacing.sm,
                  alignItems: 'center',
                }}
              >
                <DSInput
                  value={regenRedirect}
                  onChangeText={setRegenRedirect}
                  placeholder="Instruction for AI rewrite (e.g., clarify timeline or simplify sentence 2)..."
                  compact
                  style={{ flex: 1, minWidth: 240 }}
                />
                <DSButton
                  label="Rewrite & Re-Judge"
                  variant="charcoal"
                  size="sm"
                  loading={busyAction === 'regen'}
                  disabled={busyAction !== null}
                  onPress={() =>
                    void handleRunAgentAction({
                      redirectInstructions: regenRedirect.trim(),
                    })
                  }
                />
              </View>
            </DSSurface>
          ) : null}

          {regenPreview ? (
            <DSSurface
              variant="surface"
              radius="sm"
              bordered
              style={{
                padding: theme.spacing.md,
                borderColor: theme.colors.accentBorder,
                gap: theme.spacing.sm,
              }}
            >
              <DSText variant="micro" weight="semibold" tone="accent">
                Candidate rewrite
              </DSText>
              <DSText variant="subhead" weight="bold" tone="primary">
                {regenPreview.after.ai_headline}
              </DSText>
              <DSText variant="body" tone="primary">
                {regenPreview.after.ai_summary}
              </DSText>
              <DSText variant="caption" tone="secondary">
                Judge check: {regenPreview.after.confidence_reasoning}
              </DSText>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  gap: theme.spacing.sm,
                }}
              >
                <DSButton
                  label="Discard"
                  variant="secondary"
                  size="sm"
                  onPress={() => setRegenPreview(null)}
                />
                <DSButton
                  label="Accept Rewrite"
                  variant="charcoal"
                  size="sm"
                  loading={busyAction === 'accept-regen'}
                  disabled={busyAction !== null}
                  onPress={handleAcceptRegenerated}
                />
              </View>
            </DSSurface>
          ) : null}
          </DSSurface>
        </View>

        {/* 3. Unified Split Reading Desk (40% Summary / 60% Source Text) */}
        <View style={{ gap: theme.spacing.sm }}>
          <DSText variant="headline" weight="semibold" tone="primary">
            Summary &amp; source
          </DSText>

          <DSSurface
            variant="surface"
            radius="md"
            bordered
            style={{
              overflow: 'hidden',
              ...theme.shadows.card,
            }}
          >
            <View
              style={{
                flexDirection: isWideSplit ? 'row' : 'column',
                alignItems: 'stretch',
              }}
            >
              {/* Left Column (40%): Clean Readable Summary */}
              <View
                style={{
                  ...(isWideSplit ? { flex: 4 } : { width: '100%' }),
                  padding: theme.spacing.xl,
                  gap: theme.spacing.md,
                  borderColor: theme.colors.borderDefault,
                  borderRightWidth: isWideSplit ? theme.layout.borderWidth : 0,
                  borderBottomWidth: isWideSplit ? 0 : theme.layout.borderWidth,
                }}
              >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <DSText variant="caption" weight="semibold" tone="secondary">
                  Summary
                </DSText>
                {!editingDraftText ? (
                  <DSText variant="micro" tone="tertiary">
                    Click a sentence to highlight its source quote
                  </DSText>
                ) : null}
              </View>

              {editingDraftText ? (
                <DSInput
                  value={summary}
                  onChangeText={setSummary}
                  multiline
                  textAlignVertical="top"
                  style={{ minHeight: 200 }}
                />
              ) : (
                <View style={{ gap: theme.spacing.xs }}>
                  {sentenceMappings.map((item) => {
                    const isSelected = selectedSentenceIdx === item.idx;
                    const isFlagged = item.status !== 'supported';
                    return (
                      <Pressable
                        key={item.idx}
                        onPress={() => setSelectedSentenceIdx(item.idx)}
                        style={({ pressed }) => ({
                          paddingHorizontal: theme.spacing.md,
                          paddingVertical: theme.spacing.sm,
                          borderRadius: theme.radii.sm,
                          borderLeftWidth: 2,
                          borderLeftColor: isSelected
                            ? item.status === 'unsupported'
                              ? theme.colors.tones.danger.text
                              : theme.colors.accent
                            : item.status === 'unsupported'
                              ? theme.colors.tones.danger.border
                              : 'transparent',
                          backgroundColor: isSelected
                            ? item.status === 'unsupported'
                              ? theme.colors.tones.danger.bg
                              : theme.colors.accentSoft
                            : pressed
                              ? theme.colors.surfaceHover
                              : 'transparent',
                          ...(Platform.OS === 'web'
                            ? ({ cursor: 'pointer' } as Record<string, unknown>)
                            : {}),
                        })}
                      >
                        <DSText
                          variant="body"
                          weight={isSelected ? 'medium' : 'regular'}
                          tone="primary"
                        >
                          {item.sentence}
                        </DSText>
                        {isFlagged ? (
                          <View style={{ marginTop: theme.spacing.xxs }}>
                            <DSBadge
                              label={
                                item.status === 'unsupported'
                                  ? 'Unsupported in source'
                                  : 'Snippet only'
                              }
                              tone={
                                item.status === 'unsupported'
                                  ? 'danger'
                                  : 'warning'
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
                  <DSDivider />
                  <View style={{ gap: theme.spacing.xxs }}>
                    <DSText variant="caption" weight="semibold" tone="secondary">
                      Why it matters
                    </DSText>
                    <DSText variant="footnote" tone="secondary">
                      {article.ai_explanation}
                    </DSText>
                  </View>
                </>
              ) : null}
            </View>

            {/* Right Column (60%): Source Text with Inline Highlighting */}
            <View
              style={{
                ...(isWideSplit ? { flex: 6 } : { width: '100%' }),
                padding: theme.spacing.xl,
                gap: theme.spacing.md,
                backgroundColor: theme.colors.surface,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <DSText variant="caption" weight="semibold" tone="secondary">
                  Source text
                </DSText>
                <DSText variant="micro" tone="tertiary">
                  {snippetUnverified
                    ? 'Fallback RSS snippet only'
                    : 'Extracted publisher text'}
                </DSText>
              </View>

              {activeMapping?.status === 'unsupported' ? (
                <DSSurface
                  radius="sm"
                  bordered
                  style={{
                    backgroundColor: theme.colors.tones.danger.bg,
                    borderColor: theme.colors.tones.danger.border,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                  }}
                >
                  <DSText variant="caption" weight="semibold" tone="danger">
                    No direct quote found in the source text for the selected sentence.
                  </DSText>
                </DSSurface>
              ) : null}

              <ScrollView
                showsVerticalScrollIndicator
                nestedScrollEnabled
                style={{ maxHeight: 440 }}
                contentContainerStyle={{ gap: theme.spacing.sm }}
              >
                {sourceSegments.length === 0 ? (
                  <DSText variant="footnote" tone="tertiary">
                    No source text stored for this story. Click &ldquo;Open source
                    ↗&rdquo; in Agent trace below to read the original article.
                  </DSText>
                ) : (
                  sourceSegments.map((seg, idx) => (
                    <View
                      key={idx}
                      style={{
                        paddingHorizontal: seg.highlighted
                          ? theme.spacing.md
                          : 0,
                        paddingVertical: seg.highlighted
                          ? theme.spacing.xs
                          : 0,
                        borderRadius: theme.radii.xs,
                        backgroundColor: seg.highlighted
                          ? theme.colors.accentSoft
                          : 'transparent',
                        borderLeftWidth: seg.highlighted ? 2 : 0,
                        borderLeftColor: seg.highlighted
                          ? theme.colors.accent
                          : 'transparent',
                      }}
                    >
                      <DSText
                        variant="footnote"
                        weight={seg.highlighted ? 'semibold' : 'regular'}
                        tone={seg.highlighted ? 'primary' : 'secondary'}
                      >
                        {seg.text}
                      </DSText>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </DSSurface>
        </View>

        {!isWideSplit ? agentTraceSection : null}

        {feedback ? (
          <DSSurface
            radius="md"
            bordered
            style={{
              backgroundColor: theme.colors.accentSoft,
              borderColor: theme.colors.accentBorder,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
            }}
          >
            <DSText variant="footnote" weight="medium" tone="accent">
              {feedback}
            </DSText>
          </DSSurface>
        ) : null}
        </ScrollView>

        {isWideSplit ? (
          <View
            style={{
              width: tracePanelWidth,
              borderLeftWidth: theme.layout.borderWidth,
              borderLeftColor: theme.colors.borderDefault,
              backgroundColor: theme.colors.canvas,
            }}
          >
            <ScrollView
              style={{ flex: 1, minHeight: 0 }}
              contentContainerStyle={{
                padding: theme.spacing.xl,
                paddingBottom: theme.spacing.xxxl,
              }}
            >
              {agentTraceSection}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </View>
  );
}
