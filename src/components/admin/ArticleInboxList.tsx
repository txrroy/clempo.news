import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  type GestureResponderEvent,
} from 'react-native';
import {
  DSBadge,
  DSButton,
  DSCard,
  DSChip,
  DSInput,
  DSSurface,
  DSTableHeader,
  DSTableRow,
  DSText,
  useDSTheme,
  type DSTone,
} from '@/design-system';
import type { Article, ArticleStatus } from '@/types/article';
import {
  getEditorialState,
  getEditorialStateTone,
  getQueueReviewReason,
} from '@/lib/editorialLabels';

export type ArticleInboxView =
  | 'all'
  | 'ready'
  | 'needs-check'
  | 'unverified'
  | 'sensitive';

export interface ArticleFilterState {
  search: string;
  view: ArticleInboxView;
  status: ArticleStatus | 'all';
}

export const INITIAL_FILTERS: ArticleFilterState = {
  search: '',
  view: 'all',
  status: 'all',
};

const FOUR_VIEWS: {
  id: Exclude<ArticleInboxView, 'all'>;
  label: string;
}[] = [
  { id: 'ready', label: 'Ready' },
  { id: 'needs-check', label: 'Needs a check' },
  { id: 'unverified', label: 'Could not verify' },
  { id: 'sensitive', label: 'Sensitive' },
];

type BulkActionKind = 'approve' | 'reject' | 'unpublish';

interface ArticleInboxListProps {
  folderTitle: string;
  articles: Article[];
  filteredArticles: Article[];
  filters: ArticleFilterState;
  showStatusFilter: boolean;
  selectedArticleId: string | null;
  onChangeFilters: (next: ArticleFilterState) => void;
  onSelectArticle: (id: string) => void;
  onBatchApprove?: (ids: string[]) => Promise<void>;
  onBatchReject?: (ids: string[]) => Promise<void>;
  onUnpublish?: (id: string) => Promise<void>;
}

export function isHighConfidenceReady(article: Article): boolean {
  return (
    article.status === 'draft' &&
    getEditorialState(article) === 'Ready to approve'
  );
}

export function getArticleAccuracy(article: Article): number {
  return article.scores?.accuracy ?? article.confidence_score;
}

function getSourceLabel(article: Article): string {
  if (article.topic) return article.topic;
  if (article.source_names && article.source_names.length > 0) {
    return article.source_names[0];
  }
  try {
    return new URL(article.original_url).hostname.replace(/^www\./, '');
  } catch {
    return 'Source';
  }
}

function getRowTone(article: Article): DSTone {
  if (article.status === 'published') return 'success';
  if (article.status === 'rejected') return 'danger';
  return getEditorialStateTone(getEditorialState(article));
}

function getRowStateLabel(article: Article): string {
  if (article.status === 'published') return 'Published';
  if (article.status === 'rejected') return 'Rejected';
  return getEditorialState(article);
}

export function applyArticleFilters(
  articles: Article[],
  filters: ArticleFilterState
): Article[] {
  const q = filters.search.trim().toLowerCase();

  return articles.filter((article) => {
    if (filters.status !== 'all' && article.status !== filters.status) {
      return false;
    }

    const state = getEditorialState(article);
    if (filters.view === 'ready' && state !== 'Ready to approve') {
      return false;
    }
    if (filters.view === 'needs-check' && state !== 'Needs a check') {
      return false;
    }
    if (filters.view === 'unverified' && state !== 'Could not verify') {
      return false;
    }
    if (filters.view === 'sensitive' && !article.sensitive) {
      return false;
    }

    if (q) {
      const haystack = [
        article.ai_headline,
        article.ai_summary,
        article.topic ?? '',
        article.region ?? '',
        ...(article.source_names ?? []),
        article.original_url,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

interface InboxCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  accessibilityLabel: string;
  onPress: (e: GestureResponderEvent) => void;
}

function InboxCheckbox({
  checked,
  indeterminate = false,
  accessibilityLabel,
  onPress,
}: InboxCheckboxProps) {
  const { theme } = useDSTheme();
  const isActive = checked || indeterminate;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: indeterminate ? 'mixed' : checked }}
      onPress={(e) => {
        e.stopPropagation?.();
        onPress(e);
      }}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 18,
        height: 18,
        borderRadius: theme.radii.xs,
        borderWidth: 1.5,
        borderColor: isActive
          ? theme.colors.accent
          : theme.colors.borderDefault,
        backgroundColor: isActive ? theme.colors.accent : theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
        ...(Platform.OS === 'web'
          ? ({ cursor: 'pointer' } as Record<string, unknown>)
          : {}),
      })}
    >
      {isActive ? (
        <DSText
          variant="micro"
          weight="bold"
          tone="inverse"
          style={{ lineHeight: 13 }}
        >
          {indeterminate ? '—' : '✓'}
        </DSText>
      ) : null}
    </Pressable>
  );
}

export function ArticleInboxList({
  folderTitle,
  articles,
  filteredArticles,
  filters,
  showStatusFilter,
  selectedArticleId,
  onChangeFilters,
  onSelectArticle,
  onBatchApprove,
  onBatchReject,
  onUnpublish,
}: ArticleInboxListProps) {
  const { theme } = useDSTheme();
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [modalAction, setModalAction] = useState<{
    kind: BulkActionKind;
    items: Article[];
  } | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [unpublishingId, setUnpublishingId] = useState<string | null>(null);

  const viewCounts = useMemo(() => {
    let ready = 0;
    let needsCheck = 0;
    let unverified = 0;
    let sensitive = 0;

    for (const a of articles) {
      const st = getEditorialState(a);
      if (st === 'Ready to approve') ready += 1;
      else if (st === 'Needs a check') needsCheck += 1;
      else unverified += 1;
      if (a.sensitive) sensitive += 1;
    }

    return {
      ready,
      'needs-check': needsCheck,
      unverified,
      sensitive,
    };
  }, [articles]);

  const filteredIdSet = useMemo(
    () => new Set(filteredArticles.map((a) => a.id)),
    [filteredArticles]
  );

  const validCheckedIds = useMemo(
    () => checkedIds.filter((id) => filteredIdSet.has(id)),
    [checkedIds, filteredIdSet]
  );

  const validCheckedSet = useMemo(
    () => new Set(validCheckedIds),
    [validCheckedIds]
  );

  const selectedRows = useMemo(
    () => filteredArticles.filter((a) => validCheckedSet.has(a.id)),
    [filteredArticles, validCheckedSet]
  );

  const approvableSelected = useMemo(
    () => selectedRows.filter((a) => a.status !== 'published'),
    [selectedRows]
  );
  const rejectableSelected = useMemo(
    () => selectedRows.filter((a) => a.status !== 'rejected'),
    [selectedRows]
  );
  const unpublishableSelected = useMemo(
    () => selectedRows.filter((a) => a.status === 'published'),
    [selectedRows]
  );

  const allVisibleChecked =
    filteredArticles.length > 0 &&
    validCheckedIds.length === filteredArticles.length;
  const someVisibleChecked =
    validCheckedIds.length > 0 && !allVisibleChecked;

  const toggleRow = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleAllVisible = () => {
    if (allVisibleChecked) {
      setCheckedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const visibleIds = filteredArticles.map((a) => a.id);
      setCheckedIds(visibleIds);
    }
  };

  const readyDraftsInView = useMemo(
    () =>
      filteredArticles.filter(
        (a) =>
          a.status === 'draft' &&
          getEditorialState(a) === 'Ready to approve'
      ),
    [filteredArticles]
  );

  const canBulkApproveReady =
    selectedRows.length === 0 &&
    filters.view === 'ready' &&
    readyDraftsInView.length > 0 &&
    Boolean(onBatchApprove);

  const handleConfirmBulkAction = async () => {
    if (!modalAction || modalAction.items.length === 0) return;
    const ids = modalAction.items.map((a) => a.id);
    setBatchBusy(true);
    try {
      if (modalAction.kind === 'approve' && onBatchApprove) {
        await onBatchApprove(ids);
      } else if (modalAction.kind === 'reject' && onBatchReject) {
        await onBatchReject(ids);
      } else if (modalAction.kind === 'unpublish' && onUnpublish) {
        await Promise.all(ids.map((id) => onUnpublish(id)));
      }
      setCheckedIds((prev) => prev.filter((id) => !ids.includes(id)));
      setModalAction(null);
    } finally {
      setBatchBusy(false);
    }
  };

  const handleQuickUnpublish = async (id: string) => {
    if (!onUnpublish || unpublishingId) return;
    setUnpublishingId(id);
    try {
      await onUnpublish(id);
    } finally {
      setUnpublishingId(null);
    }
  };

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.view !== 'all' ||
    filters.status !== 'all';

  const nonReadyApproveCount =
    modalAction?.kind === 'approve'
      ? modalAction.items.filter(
          (a) => getEditorialState(a) !== 'Ready to approve'
        ).length
      : 0;

  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        backgroundColor: theme.colors.surface,
      }}
    >
      {/* Top Folder Header, Search & Filter Bar — flush inside the unified inbox */}
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.md,
          borderBottomWidth: theme.layout.borderWidth,
          borderBottomColor: theme.colors.borderDefault,
          backgroundColor: theme.colors.surface,
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
              alignItems: 'baseline',
              gap: theme.spacing.sm,
            }}
          >
            <DSText variant="title3" weight="semibold" tone="primary">
              {folderTitle}
            </DSText>
            <DSText variant="caption" tone="tertiary" tabularNums>
              {filteredArticles.length === articles.length
                ? `${articles.length} stories`
                : `${filteredArticles.length} of ${articles.length}`}
            </DSText>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              flex: 1,
              maxWidth: 420,
              minWidth: 200,
            }}
          >
            <View style={{ flex: 1, position: 'relative' }}>
              <DSInput
                value={filters.search}
                onChangeText={(text) =>
                  onChangeFilters({ ...filters, search: text })
                }
                placeholder="Search headline, summary, source..."
                compact
                style={{
                  paddingRight: filters.search
                    ? theme.spacing.xxxl
                    : theme.spacing.md,
                }}
              />
              {filters.search ? (
                <Pressable
                  onPress={() => onChangeFilters({ ...filters, search: '' })}
                  style={{
                    position: 'absolute',
                    right: theme.spacing.md,
                    top: 0,
                    bottom: 0,
                    justifyContent: 'center',
                  }}
                >
                  <DSText variant="caption" weight="bold" tone="tertiary">
                    ✕
                  </DSText>
                </Pressable>
              ) : null}
            </View>

            {hasActiveFilters ? (
              <DSButton
                label="Show all"
                variant="secondary"
                size="sm"
                onPress={() => onChangeFilters(INITIAL_FILTERS)}
              />
            ) : null}
          </View>
        </View>

        {articles.length > 0 ? (
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
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: theme.spacing.xs + 2,
              }}
            >
              <DSChip
                label={`All (${articles.length})`}
                active={filters.view === 'all'}
                onPress={() => onChangeFilters({ ...filters, view: 'all' })}
              />
              {FOUR_VIEWS.map((v) => {
                const count = viewCounts[v.id];
                return (
                  <DSChip
                    key={v.id}
                    label={`${v.label} (${count})`}
                    active={filters.view === v.id}
                    onPress={() =>
                      onChangeFilters({
                        ...filters,
                        view: filters.view === v.id ? 'all' : v.id,
                      })
                    }
                  />
                );
              })}

              {showStatusFilter ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                    marginLeft: theme.spacing.sm,
                  }}
                >
                  {(['draft', 'published', 'rejected'] as ArticleStatus[]).map(
                    (status) => (
                      <DSChip
                        key={status}
                        label={
                          status === 'draft'
                            ? 'In review'
                            : status === 'published'
                              ? 'Published'
                              : 'Rejected'
                        }
                        active={filters.status === status}
                        onPress={() =>
                          onChangeFilters({
                            ...filters,
                            status: filters.status === status ? 'all' : status,
                          })
                        }
                      />
                    )
                  )}
                </View>
              ) : null}
            </View>

            {canBulkApproveReady ? (
              <DSButton
                label={`Approve all Ready (${readyDraftsInView.length})`}
                variant="primary"
                size="sm"
                disabled={batchBusy}
                onPress={() =>
                  setModalAction({ kind: 'approve', items: readyDraftsInView })
                }
              />
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Contextual Bulk Actions Bar when rows are checked */}
      {selectedRows.length > 0 ? (
        <DSSurface
          style={{
            backgroundColor: theme.colors.accentSoft,
            borderBottomWidth: theme.layout.borderWidth,
            borderBottomColor: theme.colors.borderDefault,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
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
            <DSText variant="footnote" weight="semibold" tone="primary" tabularNums>
              {selectedRows.length}{' '}
              {selectedRows.length === 1 ? 'story' : 'stories'} selected
            </DSText>
            <DSButton
              label="Clear"
              variant="ghost"
              size="sm"
              disabled={batchBusy}
              onPress={() => setCheckedIds([])}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            {approvableSelected.length > 0 && onBatchApprove ? (
              <DSButton
                label={`Approve (${approvableSelected.length})`}
                variant="primary"
                size="sm"
                disabled={batchBusy}
                onPress={() =>
                  setModalAction({ kind: 'approve', items: approvableSelected })
                }
              />
            ) : null}
            {unpublishableSelected.length > 0 && onUnpublish ? (
              <DSButton
                label={`Unpublish (${unpublishableSelected.length})`}
                variant="secondary"
                size="sm"
                disabled={batchBusy}
                onPress={() =>
                  setModalAction({
                    kind: 'unpublish',
                    items: unpublishableSelected,
                  })
                }
              />
            ) : null}
            {rejectableSelected.length > 0 && onBatchReject ? (
              <DSButton
                label={`Reject (${rejectableSelected.length})`}
                variant="danger"
                size="sm"
                disabled={batchBusy}
                onPress={() =>
                  setModalAction({ kind: 'reject', items: rejectableSelected })
                }
              />
            ) : null}
          </View>
        </DSSurface>
      ) : null}

      {/* Table Header & Scrollable Rows — flush directly under filters/bulk bar */}
      <DSTableHeader>
        <InboxCheckbox
          checked={allVisibleChecked}
          indeterminate={someVisibleChecked}
          accessibilityLabel="Select all visible stories"
          onPress={toggleAllVisible}
        />
        <View className="w-24 md:w-32 shrink-0">
          <DSText variant="micro" weight="semibold" tone="tertiary">
            Source
          </DSText>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <DSText variant="micro" weight="semibold" tone="tertiary">
            Story & Review Note
          </DSText>
        </View>
        <View style={{ width: 150, alignItems: 'flex-end' }}>
          <DSText variant="micro" weight="semibold" tone="tertiary">
            Status
          </DSText>
        </View>
      </DSTableHeader>

      <ScrollView showsVerticalScrollIndicator style={{ flex: 1, minHeight: 0 }}>
        {filteredArticles.length === 0 ? (
          <View
            style={{
              paddingVertical: theme.spacing.xxxl * 2,
              paddingHorizontal: theme.spacing.xxl,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DSText variant="body" weight="medium" tone="secondary" center>
              {articles.length === 0
                ? 'No stories in this folder.'
                : 'No stories match this view.'}
            </DSText>
            {hasActiveFilters ? (
              <DSButton
                label="Show all stories"
                variant="secondary"
                size="sm"
                onPress={() => onChangeFilters(INITIAL_FILTERS)}
                style={{ marginTop: theme.spacing.md }}
              />
            ) : null}
          </View>
        ) : (
          filteredArticles.map((item, idx) => {
            const isActiveDrawerRow = item.id === selectedArticleId;
            const isChecked = validCheckedSet.has(item.id);
            const rowTone = getRowTone(item);
            const stateLabel = getRowStateLabel(item);
            const plainReason =
              item.status === 'published'
                ? 'Published live in reader edition.'
                : item.status === 'rejected'
                  ? item.rejection_reason
                    ? `Rejected: ${item.rejection_reason}`
                    : 'Rejected by editor.'
                  : getQueueReviewReason(item);

            return (
              <DSTableRow
                key={item.id}
                selected={isActiveDrawerRow || isChecked}
                isLast={idx === filteredArticles.length - 1}
                onPress={() => onSelectArticle(item.id)}
              >
                <InboxCheckbox
                  checked={isChecked}
                  accessibilityLabel={`Select ${item.ai_headline}`}
                  onPress={() => toggleRow(item.id)}
                />

                <View className="w-24 md:w-32 shrink-0">
                  <DSText
                    variant="caption"
                    weight="semibold"
                    tone="secondary"
                    numberOfLines={1}
                  >
                    {getSourceLabel(item)}
                  </DSText>
                </View>

                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    paddingRight: theme.spacing.sm,
                    gap: theme.spacing.xxs,
                  }}
                >
                  <DSText
                    variant="body"
                    weight="semibold"
                    tone="primary"
                    numberOfLines={1}
                  >
                    {item.ai_headline}
                  </DSText>
                  <DSText
                    variant="caption"
                    tone="tertiary"
                    numberOfLines={1}
                  >
                    {plainReason}
                  </DSText>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    flexShrink: 0,
                  }}
                >
                  {item.sensitive ? (
                    <DSBadge label="Sensitive" tone="neutral" />
                  ) : null}

                  <DSBadge label={stateLabel} tone={rowTone} />

                  {item.status === 'published' && onUnpublish ? (
                    <DSButton
                      label="Unpublish"
                      variant="secondary"
                      size="sm"
                      loading={unpublishingId === item.id}
                      disabled={unpublishingId !== null}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        void handleQuickUnpublish(item.id);
                      }}
                    />
                  ) : null}
                </View>
              </DSTableRow>
            );
          })
        )}
      </ScrollView>

      {/* Bulk Action Confirmation Modal */}
      <Modal
        visible={modalAction !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalAction(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.colors.backdrop,
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.spacing.xl,
          }}
        >
          {modalAction ? (
            <DSCard
              headerTitle={
                modalAction.kind === 'approve'
                  ? `Approve & Publish ${modalAction.items.length} ${modalAction.items.length === 1 ? 'Story' : 'Stories'}`
                  : modalAction.kind === 'reject'
                    ? `Reject ${modalAction.items.length} ${modalAction.items.length === 1 ? 'Story' : 'Stories'}`
                    : `Unpublish ${modalAction.items.length} ${modalAction.items.length === 1 ? 'Story' : 'Stories'}`
              }
              headerSubtitle={
                modalAction.kind === 'approve'
                  ? 'Selected stories will go live in the reader feed immediately.'
                  : modalAction.kind === 'reject'
                    ? 'Selected stories will be moved out of the live feed and review queue.'
                    : 'Selected stories will return to In Review as drafts.'
              }
              elevated
              padding="lg"
              style={{ width: '100%', maxWidth: 540 }}
            >
              {nonReadyApproveCount > 0 ? (
                <DSSurface
                  radius="sm"
                  bordered
                  style={{
                    backgroundColor: theme.colors.tones.warning.bg,
                    borderColor: theme.colors.tones.warning.border,
                    padding: theme.spacing.md,
                    marginBottom: theme.spacing.md,
                  }}
                >
                  <DSText variant="caption" weight="semibold" tone="warning">
                    {nonReadyApproveCount}{' '}
                    {nonReadyApproveCount === 1
                      ? 'selected story has'
                      : 'selected stories have'}{' '}
                    verification checks or flags. Confirm you want to publish them.
                  </DSText>
                </DSSurface>
              ) : null}

              <ScrollView
                style={{ maxHeight: 260, marginBottom: theme.spacing.lg }}
              >
                <View style={{ gap: theme.spacing.sm }}>
                  {modalAction.items.map((a) => (
                    <View
                      key={a.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: theme.spacing.sm,
                      }}
                    >
                      <DSText
                        variant="caption"
                        weight="medium"
                        tone="primary"
                        numberOfLines={1}
                        style={{ flex: 1 }}
                      >
                        • {a.ai_headline}
                      </DSText>
                      <DSBadge
                        label={getRowStateLabel(a)}
                        tone={getRowTone(a)}
                      />
                    </View>
                  ))}
                </View>
              </ScrollView>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'flex-end',
                  gap: theme.spacing.sm,
                }}
              >
                <DSButton
                  label="Cancel"
                  variant="secondary"
                  size="md"
                  disabled={batchBusy}
                  onPress={() => setModalAction(null)}
                />
                <DSButton
                  label={
                    modalAction.kind === 'approve'
                      ? `Confirm & Publish (${modalAction.items.length})`
                      : modalAction.kind === 'reject'
                        ? `Confirm Reject (${modalAction.items.length})`
                        : `Confirm Unpublish (${modalAction.items.length})`
                  }
                  variant={modalAction.kind === 'reject' ? 'danger' : 'primary'}
                  size="md"
                  loading={batchBusy}
                  onPress={handleConfirmBulkAction}
                />
              </View>
            </DSCard>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
