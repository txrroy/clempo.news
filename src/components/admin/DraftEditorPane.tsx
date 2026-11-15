import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import {
  DSBadge,
  DSButton,
  DSCard,
  DSDivider,
  DSInput,
  DSSurface,
  DSText,
  useDSTheme,
  type DSTone,
} from '@/design-system';
import type { Article } from '@/types/article';

interface DraftEditorPaneProps {
  article: Article | null;
  adminUid: string;
  onSaveChanges: (id: string, headline: string, summary: string) => Promise<void>;
  onApprove: (
    id: string,
    headline: string,
    summary: string,
    adminUid: string
  ) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

function getScoreTone(score: number): DSTone {
  if (score >= 85) return 'success';
  if (score >= 65) return 'warning';
  return 'danger';
}

function DraftEditorForm({
  article,
  adminUid,
  onSaveChanges,
  onApprove,
  onReject,
}: Omit<DraftEditorPaneProps, 'article'> & { article: Article }) {
  const { theme } = useDSTheme();
  const [headline, setHeadline] = useState(article.ai_headline);
  const [summary, setSummary] = useState(article.ai_summary);
  const [busyAction, setBusyAction] = useState<'save' | 'approve' | 'reject' | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isDirty =
    headline.trim() !== article.ai_headline.trim() ||
    summary.trim() !== article.ai_summary.trim();

  const handleSave = async () => {
    setBusyAction('save');
    setFeedback(null);
    try {
      await onSaveChanges(article.id, headline, summary);
      setFeedback('Changes saved.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleApprove = async () => {
    setBusyAction('approve');
    setFeedback(null);
    try {
      await onApprove(article.id, headline, summary, adminUid);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to approve article.');
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
      setFeedback(err instanceof Error ? err.message : 'Failed to reject article.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.xxl,
          paddingVertical: theme.spacing.xl,
          gap: theme.spacing.lg,
        }}
      >
        {/* Top: Source link & Judge metadata */}
        <DSCard
          headerTitle={`${article.date}${article.topic ? ` · ${article.topic}` : ''}${article.region ? ` · ${article.region}` : ''}${article.source_count ? ` · ${article.source_count} outlets` : ''}`}
          headerSubtitle={article.original_url}
          headerRight={
            <DSButton
              label="Open Original Source ↗"
              variant="secondary"
              size="sm"
              onPress={() => Linking.openURL(article.original_url)}
            />
          }
          padding="lg"
        >
          <View style={{ gap: theme.spacing.md }}>
            {/* Four Judge Scores */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {(
                [
                  ['Accuracy', article.scores?.accuracy ?? article.confidence_score],
                  ['Neutrality', article.scores?.neutrality ?? article.confidence_score],
                  ['Safety (G)', article.scores?.safety ?? article.confidence_score],
                  ['Readability (Gr 6)', article.scores?.readability ?? article.confidence_score],
                ] as const
              ).map(([label, score]) => (
                <DSBadge
                  key={label}
                  label={`${label}: ${score}/100`}
                  tone={getScoreTone(score)}
                />
              ))}
            </View>

            {/* Flags & Judge Pass */}
            {(article.flags && article.flags.length > 0) ||
            article.sensitive ||
            article.judge_pass !== undefined ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
                {article.judge_pass !== undefined ? (
                  <DSBadge
                    label={article.judge_pass ? 'Auto-pass' : 'Needs review'}
                    tone={article.judge_pass ? 'success' : 'warning'}
                  />
                ) : null}
                {article.sensitive ? <DSBadge label="Sensitive" tone="warning" /> : null}
                {(article.flags ?? []).map((flag) => (
                  <DSBadge key={flag} label={flag} tone="danger" />
                ))}
              </View>
            ) : null}

            {article.selection_reason ? (
              <DSSurface
                variant="muted"
                radius="md"
                bordered
                style={{ padding: theme.spacing.md, gap: theme.spacing.xs }}
              >
                <DSText variant="micro" weight="semibold" tone="tertiary">
                  Selection Rationale
                </DSText>
                <DSText variant="body" tone="secondary">
                  {article.selection_reason}
                </DSText>
              </DSSurface>
            ) : null}

            {article.ai_explanation ? (
              <DSSurface
                variant="muted"
                radius="md"
                bordered
                style={{ padding: theme.spacing.md, gap: theme.spacing.xs }}
              >
                <DSText variant="micro" weight="semibold" tone="tertiary">
                  Background Explanation (“What’s this about?”)
                </DSText>
                <DSText variant="body" tone="secondary">
                  {article.ai_explanation}
                </DSText>
              </DSSurface>
            ) : null}

            <DSSurface
              variant="muted"
              radius="md"
              bordered
              style={{ padding: theme.spacing.md, gap: theme.spacing.xs }}
            >
              <DSText variant="micro" weight="semibold" tone="tertiary">
                Judge Reasoning
              </DSText>
              <DSText variant="body" tone="secondary">
                {article.confidence_reasoning || 'No reasoning recorded.'}
              </DSText>
            </DSSurface>

            {/* Claim-by-Claim Evidence */}
            {article.claims && article.claims.length > 0 ? (
              <DSSurface
                variant="muted"
                radius="md"
                bordered
                style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}
              >
                <DSText variant="micro" weight="semibold" tone="tertiary">
                  Claims & Source Evidence
                </DSText>
                <View style={{ gap: theme.spacing.sm }}>
                  {article.claims.map((item, idx) => {
                    const isUnsupported =
                      item.evidence.trim().toLowerCase() === 'unsupported';
                    return (
                      <View
                        key={`${idx}-${item.claim.slice(0, 20)}`}
                        style={{ gap: theme.spacing.xs }}
                      >
                        {idx > 0 ? <DSDivider /> : null}
                        <DSText variant="body" weight="semibold" tone="primary">
                          Claim: {item.claim}
                        </DSText>
                        <DSText
                          variant="caption"
                          weight={isUnsupported ? 'semibold' : 'regular'}
                          tone={isUnsupported ? 'danger' : 'secondary'}
                        >
                          Evidence: {item.evidence}
                        </DSText>
                      </View>
                    );
                  })}
                </View>
              </DSSurface>
            ) : null}
          </View>
        </DSCard>

        {/* Middle: Headline & Summary Textareas */}
        <DSCard headerTitle="Editorial Copy" padding="lg">
          <View style={{ gap: theme.spacing.md }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <DSText variant="micro" weight="semibold" tone="tertiary">
                Headline
              </DSText>
              {isDirty ? (
                <DSText variant="caption" weight="semibold" tone="warning">
                  Unsaved edits
                </DSText>
              ) : null}
            </View>
            <DSInput
              value={headline}
              onChangeText={setHeadline}
              multiline
              style={[
                theme.typography.headline,
                { fontWeight: '600', minHeight: 68 },
              ]}
            />

            <DSText variant="micro" weight="semibold" tone="tertiary">
              Summary
            </DSText>
            <DSInput
              value={summary}
              onChangeText={setSummary}
              multiline
              textAlignVertical="top"
              style={{ minHeight: 168 }}
            />
          </View>
        </DSCard>

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

      {/* Bottom Action Bar */}
      <View
        style={{
          borderTopWidth: theme.layout.borderWidth,
          borderTopColor: theme.colors.borderDefault,
          backgroundColor: theme.colors.surface,
          paddingHorizontal: theme.spacing.xxl,
          paddingVertical: theme.spacing.md,
        }}
      >
        <View
          style={{
            width: '100%',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
          }}
        >
          <DSButton
            label="Reject"
            variant="danger"
            size="md"
            loading={busyAction === 'reject'}
            disabled={busyAction !== null}
            onPress={handleReject}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <DSButton
              label="Save Changes"
              variant="secondary"
              size="md"
              loading={busyAction === 'save'}
              disabled={busyAction !== null}
              onPress={handleSave}
            />
            <DSButton
              label="Approve & Publish"
              variant="primary"
              size="md"
              loading={busyAction === 'approve'}
              disabled={busyAction !== null}
              onPress={handleApprove}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

export function DraftEditorPane({
  article,
  adminUid,
  onSaveChanges,
  onApprove,
  onReject,
}: DraftEditorPaneProps) {
  const { theme } = useDSTheme();

  if (!article) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.canvas,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.xxxl,
        }}
      >
        <DSText variant="title3" weight="semibold" tone="secondary" center>
          Select a draft from the queue to review and edit.
        </DSText>
      </View>
    );
  }

  return (
    <DraftEditorForm
      key={article.id}
      article={article}
      adminUid={adminUid}
      onSaveChanges={onSaveChanges}
      onApprove={onApprove}
      onReject={onReject}
    />
  );
}
