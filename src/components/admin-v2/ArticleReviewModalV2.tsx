import { useState } from 'react';
import { Linking, Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFlagPlainReason, getFlagShortLabel } from '@/lib/editorialLabels';
import { computeWordDiff } from '@/lib/textDiff';
import type { Article } from '@/types/article';
import {
  StatusLabel,
  V2Button,
  V2Divider,
  V2InlineLink,
  V2Input,
  V2Text,
  type StatusKind,
} from './primitives';
import {
  formatArticleFlagsPlain,
  formatUtcDateOnly,
  getArticleVerdict,
  V2_COLORS,
  V2_SPACE,
} from './tokens';

interface ArticleReviewModalV2Props {
  article: Article | null;
  positionLabel?: string;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onSaveChanges: (
    id: string,
    headline: string,
    summary: string
  ) => Promise<void>;
  onApprove: (id: string, headline: string, summary: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onUnpublish: (id: string) => Promise<void>;
}

export function ArticleReviewModalV2({
  article,
  positionLabel,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
  onSaveChanges,
  onApprove,
  onReject,
  onUnpublish,
}: ArticleReviewModalV2Props) {
  const [headline, setHeadline] = useState(article?.ai_headline ?? '');
  const [summary, setSummary] = useState(article?.ai_summary ?? '');
  const [explanation, setExplanation] = useState(
    article?.ai_explanation ?? ''
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showRetryDiff, setShowRetryDiff] = useState(true);

  if (!article) return null;

  const verdict = getArticleVerdict(article);
  const statusKind: StatusKind =
    article.status === 'published'
      ? 'published'
      : article.status === 'rejected'
        ? 'rejected'
        : verdict;

  const isDirty =
    headline !== (article.ai_headline ?? '') ||
    summary !== (article.ai_summary ?? '');

  const handleSave = async () => {
    setBusy('save');
    setNotice(null);
    try {
      await onSaveChanges(article.id, headline.trim(), summary.trim());
      setNotice('Edits saved.');
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = async () => {
    setBusy('publish');
    setNotice(null);
    try {
      await onApprove(article.id, headline.trim(), summary.trim());
      if (hasNext) {
        onNext();
      } else {
        onClose();
      }
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    setBusy('reject');
    setNotice(null);
    try {
      await onReject(article.id);
      if (hasNext) {
        onNext();
      } else {
        onClose();
      }
    } finally {
      setBusy(null);
    }
  };

  const handleUnpublish = async () => {
    setBusy('unpublish');
    setNotice(null);
    try {
      await onUnpublish(article.id);
      setNotice('Moved back to drafts.');
    } finally {
      setBusy(null);
    }
  };

  const sourceList =
    article.source_names && article.source_names.length > 0
      ? article.source_names.join(', ')
      : 'Source unavailable';

  const flagsText = formatArticleFlagsPlain(article.flags);
  const overallConfidence = Math.round(article.confidence_score ?? 0);

  const scoreSummary = article.scores
    ? `Confidence ${overallConfidence}/100 · Accuracy ${Math.round(article.scores.accuracy)}, Neutrality ${Math.round(article.scores.neutrality)}, Safety ${Math.round(article.scores.safety)}, Readability ${Math.round(article.scores.readability)}`
    : `Confidence ${overallConfidence}/100`;

  const retryHistory = article.retry_history ?? [];
  const traceSteps = article.pipeline_trace ?? [];

  return (
    <Modal
      visible={Boolean(article)}
      animationType="none"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: V2_COLORS.ground }}>
        {/* Top bar */}
        <View
          style={{
            borderBottomWidth: 1,
            borderBottomColor: V2_COLORS.line,
            backgroundColor: V2_COLORS.ground,
          }}
        >
          <View
            style={{
              maxWidth: 1120,
              width: '100%',
              alignSelf: 'center',
              paddingHorizontal: V2_SPACE.pageSidePadding,
              paddingVertical: 12,
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: V2_SPACE.gapMd,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: V2_SPACE.gapMd,
              }}
            >
              <V2Button variant="low" label="Back" onPress={onClose} />
              {positionLabel ? (
                <V2Text variant="meta" tabular>
                  {positionLabel}
                </V2Text>
              ) : null}
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: V2_SPACE.gapSm,
              }}
            >
              <V2Button
                variant="low"
                label="Previous"
                disabled={!hasPrev || busy !== null}
                onPress={onPrev}
              />
              <V2Button
                variant="low"
                label="Next"
                disabled={!hasNext || busy !== null}
                onPress={onNext}
              />
            </View>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1, backgroundColor: V2_COLORS.ground }}
          contentContainerStyle={{
            maxWidth: 1120,
            width: '100%',
            alignSelf: 'center',
            paddingHorizontal: V2_SPACE.pageSidePadding,
            paddingVertical: 32,
            gap: V2_SPACE.sectionGap,
          }}
        >
          {/* Status + Primary Actions */}
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: V2_SPACE.gapLg,
            }}
          >
            <View style={{ flex: 1, minWidth: 240, gap: 8 }}>
              <StatusLabel kind={statusKind} />
              <V2Text variant="pageTitle">{headline || article.ai_headline}</V2Text>
              <V2Text variant="meta" tabular>
                Edition {formatUtcDateOnly(article.date)} · {scoreSummary} · Issues: {flagsText}
              </V2Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: V2_SPACE.gapSm,
              }}
            >
              {isDirty ? (
                <V2Button
                  variant="secondary"
                  label={busy === 'save' ? 'Saving...' : 'Save edits'}
                  disabled={busy !== null}
                  onPress={handleSave}
                />
              ) : null}

              {article.status === 'published' ? (
                <V2Button
                  variant="secondary"
                  label={busy === 'unpublish' ? 'Saving...' : 'Unpublish'}
                  disabled={busy !== null}
                  onPress={handleUnpublish}
                />
              ) : (
                <>
                  <V2Button
                    variant="low"
                    label={busy === 'reject' ? 'Rejecting...' : 'Reject'}
                    disabled={busy !== null}
                    onPress={handleReject}
                  />
                  <V2Button
                    variant="primary"
                    label={busy === 'publish' ? 'Publishing...' : 'Publish'}
                    disabled={busy !== null}
                    onPress={handlePublish}
                  />
                </>
              )}
            </View>
          </View>

          {notice ? (
            <V2Text variant="body" tone="ready">
              {notice}
            </V2Text>
          ) : null}

          <V2Divider />

          {/* Editor fields */}
          <View style={{ gap: V2_SPACE.gapLg }}>
            <View style={{ gap: 8 }}>
              <V2Text variant="sectionTitle">Headline</V2Text>
              <V2Input value={headline} onChangeText={setHeadline} />
            </View>

            <View style={{ gap: 8 }}>
              <V2Text variant="sectionTitle">Summary</V2Text>
              <V2Input
                multiline
                value={summary}
                onChangeText={setSummary}
                style={{ minHeight: 120 }}
              />
            </View>

            <View style={{ gap: 8 }}>
              <V2Text variant="sectionTitle">Why this matters</V2Text>
              <V2Input
                multiline
                value={explanation}
                onChangeText={setExplanation}
                style={{ minHeight: 88 }}
              />
            </View>
          </View>

          <V2Divider />

          {/* Fact-check & Sources (Judge confidence, reasoning, flags & claims) */}
          <View style={{ gap: V2_SPACE.gapMd }}>
            <V2Text variant="sectionTitle">Fact check and sources</V2Text>
            <V2Text variant="meta" tabular>
              {scoreSummary}
            </V2Text>
            {article.flags && article.flags.length > 0 ? (
              <View style={{ gap: 4 }}>
                {article.flags.map((flag) => (
                  <V2Text key={flag} variant="body" tone="check">
                    • {getFlagShortLabel(flag)}: {getFlagPlainReason(flag)}
                  </V2Text>
                ))}
              </View>
            ) : (
              <V2Text variant="meta">Flags: None</V2Text>
            )}
            <V2Text variant="body" tone="muted">
              {article.confidence_reasoning || 'No additional review notes recorded.'}
            </V2Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: V2_SPACE.gapMd,
              }}
            >
              <V2Text variant="meta">Sources: {sourceList}</V2Text>
              {article.original_url ? (
                <V2InlineLink
                  label="Open original article"
                  onPress={() => Linking.openURL(article.original_url)}
                />
              ) : null}
            </View>

            {article.claims && article.claims.length > 0 ? (
              <View style={{ paddingTop: 8 }}>
                <V2Divider strong />
                {article.claims.map((c, idx) => (
                  <View key={idx}>
                    <View
                      style={{
                        paddingVertical: V2_SPACE.tableRowPadY,
                        gap: 4,
                      }}
                    >
                      <V2Text variant="body" weight="500">
                        {c.claim}
                      </V2Text>
                      <V2Text variant="meta">Evidence: {c.evidence}</V2Text>
                    </View>
                    <V2Divider />
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <V2Divider />

          {/* Agent action history & Draft 1 vs Draft 2 Diff */}
          <View style={{ gap: V2_SPACE.gapMd }}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: V2_SPACE.gapSm,
              }}
            >
              <V2Text variant="sectionTitle">
                Agent action history
                {article.auto_retried_complexity ? ' · Auto-retried once' : ''}
              </V2Text>
              {retryHistory.length > 0 ? (
                <V2InlineLink
                  label={
                    showRetryDiff
                      ? 'Hide Draft 1 → Draft 2 diff'
                      : 'Show Draft 1 → Draft 2 diff'
                  }
                  onPress={() => setShowRetryDiff((v) => !v)}
                />
              ) : null}
            </View>

            {retryHistory.length > 0 ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: V2_COLORS.lineStrong,
                  borderRadius: 6,
                  padding: 16,
                  gap: V2_SPACE.gapMd,
                }}
              >
                {retryHistory.map((entry, rIdx) => {
                  const beforeRead = Math.round(
                    entry.before.scores?.readability ?? entry.before.confidence_score
                  );
                  const afterRead = Math.round(
                    entry.after.scores?.readability ?? entry.after.confidence_score
                  );
                  const beforeConf = Math.round(entry.before.confidence_score);
                  const afterConf = Math.round(entry.after.confidence_score);
                  const headlineDiff = computeWordDiff(
                    entry.before.ai_headline,
                    entry.after.ai_headline
                  );
                  const summaryDiff = computeWordDiff(
                    entry.before.ai_summary,
                    entry.after.ai_summary
                  );

                  return (
                    <View key={`v2-retry-${rIdx}`} style={{ gap: 8 }}>
                      <V2Text variant="body" weight="600">
                        Autonomous self-correction (Attempt {entry.attempt})
                      </V2Text>
                      <V2Text variant="meta" tabular>
                        Trigger: {entry.trigger} · Readability {beforeRead} →{' '}
                        {afterRead}/100 · Confidence {beforeConf} → {afterConf}
                        /100
                      </V2Text>
                      <V2Text variant="meta">
                        Flags: {(entry.before.flags ?? []).join(', ') || 'None'} →{' '}
                        {(entry.after.flags ?? []).join(', ') || 'None'}
                      </V2Text>

                      {showRetryDiff ? (
                        <View style={{ gap: 8, paddingTop: 4 }}>
                          <V2Text variant="meta" weight="600">
                            Headline diff (Draft 1 → Draft 2)
                          </V2Text>
                          <V2Text variant="body">
                            {headlineDiff.map((tok, tIdx) => (
                              <V2Text
                                key={`v2-hd-${tIdx}`}
                                variant="body"
                                weight={tok.type === 'added' ? '600' : '400'}
                                tone={
                                  tok.type === 'removed'
                                    ? 'muted'
                                    : tok.type === 'added'
                                      ? 'ready'
                                      : 'ink'
                                }
                                style={
                                  tok.type === 'removed'
                                    ? { textDecorationLine: 'line-through' }
                                    : tok.type === 'added'
                                      ? { textDecorationLine: 'underline' }
                                      : undefined
                                }
                              >
                                {tIdx > 0 ? ' ' : ''}
                                {tok.text}
                              </V2Text>
                            ))}
                          </V2Text>

                          <V2Text variant="meta" weight="600">
                            Summary diff (Draft 1 → Draft 2)
                          </V2Text>
                          <V2Text variant="body">
                            {summaryDiff.map((tok, tIdx) => (
                              <V2Text
                                key={`v2-sd-${tIdx}`}
                                variant="body"
                                weight={tok.type === 'added' ? '600' : '400'}
                                tone={
                                  tok.type === 'removed'
                                    ? 'muted'
                                    : tok.type === 'added'
                                      ? 'ready'
                                      : 'ink'
                                }
                                style={
                                  tok.type === 'removed'
                                    ? { textDecorationLine: 'line-through' }
                                    : tok.type === 'added'
                                      ? { textDecorationLine: 'underline' }
                                      : undefined
                                }
                              >
                                {tIdx > 0 ? ' ' : ''}
                                {tok.text}
                              </V2Text>
                            ))}
                          </V2Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : article.auto_retried_complexity ? (
              <V2Text variant="meta">
                Auto-simplified once during pipeline run (before/after snapshot not recorded for this earlier draft).
              </V2Text>
            ) : null}

            {traceSteps.length > 0 ? (
              <View>
                <V2Divider strong />
                {traceSteps.map((step, sIdx) => (
                  <View key={`${step.step}-${sIdx}`}>
                    <View
                      style={{
                        paddingVertical: V2_SPACE.tableRowPadY,
                        gap: 4,
                      }}
                    >
                      <V2Text variant="body" weight="500">
                        {step.agent}
                        {step.duration_ms ? ` · ${step.duration_ms}ms` : ''}
                      </V2Text>
                      <V2Text variant="meta">{step.summary}</V2Text>
                    </View>
                    <V2Divider />
                  </View>
                ))}
              </View>
            ) : (
              <V2Text variant="meta">
                No per-step agent trace recorded for this article.
              </V2Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
