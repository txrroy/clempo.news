import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { Article } from '@/types/article';
import {
  StatusLabel,
  V2Button,
  V2Divider,
  V2Input,
  V2Text,
  type StatusKind,
} from './primitives';
import {
  formatArticleIssueLine,
  formatStoryAge,
  getArticleVerdict,
  sortByLowestScoreThenOldest,
  V2_COLORS,
  V2_SPACE,
} from './tokens';

export type InboxFolderV2 =
  | 'pending'
  | 'published-today'
  | 'all-published'
  | 'rejected';

interface InboxV2Props {
  articles: Article[];
  today: string;
  folder: InboxFolderV2;
  onChangeFolder: (folder: InboxFolderV2) => void;
  onReviewArticle: (articleId: string, orderedIds: string[]) => void;
  onApproveArticle: (articleId: string) => Promise<void>;
  onUnpublishArticle: (articleId: string) => Promise<void>;
}

export function InboxV2({
  articles,
  today,
  folder,
  onChangeFolder,
  onReviewArticle,
  onApproveArticle,
  onUnpublishArticle,
}: InboxV2Props) {
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => {
    let pending = 0;
    let publishedToday = 0;
    let allPublished = 0;
    let rejected = 0;
    for (const a of articles) {
      if (a.status === 'draft') pending += 1;
      if (a.status === 'published') {
        allPublished += 1;
        if (a.date === today) publishedToday += 1;
      }
      if (a.status === 'rejected') rejected += 1;
    }
    return { pending, publishedToday, allPublished, rejected };
  }, [articles, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = articles.filter((a) => {
      if (folder === 'pending') return a.status === 'draft';
      if (folder === 'published-today') {
        return a.status === 'published' && a.date === today;
      }
      if (folder === 'all-published') return a.status === 'published';
      return a.status === 'rejected';
    });

    const searched = q
      ? base.filter(
          (a) =>
            a.ai_headline.toLowerCase().includes(q) ||
            a.ai_summary.toLowerCase().includes(q) ||
            (a.source_names ?? []).some((s) => s.toLowerCase().includes(q))
        )
      : base;

    return [...searched].sort(sortByLowestScoreThenOldest);
  }, [articles, folder, search, today]);

  const uniformStatusKind = useMemo(() => {
    if (filtered.length === 0) return null;
    const getKind = (a: Article): StatusKind =>
      a.status === 'published'
        ? 'published'
        : a.status === 'rejected'
          ? 'rejected'
          : getArticleVerdict(a);
    const first = getKind(filtered[0]);
    for (let i = 1; i < filtered.length; i += 1) {
      if (getKind(filtered[i]) !== first) return null;
    }
    return first;
  }, [filtered]);

  const orderedIds = useMemo(() => filtered.map((a) => a.id), [filtered]);

  const tabs: { id: InboxFolderV2; label: string }[] = [
    { id: 'pending', label: `To review ${counts.pending}` },
    { id: 'published-today', label: `Published today ${counts.publishedToday}` },
    { id: 'all-published', label: `All published ${counts.allPublished}` },
    { id: 'rejected', label: `Rejected ${counts.rejected}` },
  ];

  const handleAction = async (fn: () => Promise<void>, id: string) => {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={{ gap: V2_SPACE.sectionGap }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: V2_SPACE.gapMd,
        }}
      >
        <View style={{ gap: 4 }}>
          <V2Text variant="pageTitle">Approval inbox</V2Text>
          <V2Text variant="meta">
            Review, edit, and publish stories for each edition.
          </V2Text>
        </View>

        {folder === 'pending' && filtered.length > 0 ? (
          <V2Button
            variant="primary"
            label={`Review all ${filtered.length}`}
            onPress={() => onReviewArticle(filtered[0].id, orderedIds)}
          />
        ) : null}
      </View>

      {/* Folder tabs + Search */}
      <View style={{ gap: V2_SPACE.gapMd }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: V2_SPACE.gapLg,
            borderBottomWidth: 1,
            borderBottomColor: V2_COLORS.line,
          }}
        >
          {tabs.map((tab) => {
            const active = folder === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => onChangeFolder(tab.id)}
                style={{
                  paddingBottom: 12,
                  borderBottomWidth: 2,
                  borderBottomColor: active ? V2_COLORS.ink : 'transparent',
                }}
              >
                <V2Text
                  variant="body"
                  weight={active ? '600' : '500'}
                  tone={active ? 'ink' : 'muted'}
                  tabular
                >
                  {tab.label}
                </V2Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ maxWidth: 420, width: '100%' }}>
          <V2Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search headlines, summaries, or sources"
          />
        </View>
      </View>

      {/* Story list */}
      <View>
        {uniformStatusKind ? (
          <V2Text
            variant="sectionTitle"
            tabular
            style={{ paddingBottom: V2_SPACE.gapMd }}
          >
            {`${filtered.length} ${filtered.length === 1 ? 'story' : 'stories'}, all ${uniformStatusKind}`}
          </V2Text>
        ) : null}
        <V2Divider />
        {filtered.length === 0 ? (
          <View style={{ paddingVertical: V2_SPACE.listRowPadY }}>
            <V2Text variant="body" tone="muted">
              No stories match this view.
            </V2Text>
          </View>
        ) : (
          filtered.map((article) => {
            const verdict = getArticleVerdict(article);
            const statusKind: StatusKind =
              article.status === 'published'
                ? 'published'
                : article.status === 'rejected'
                  ? 'rejected'
                  : verdict;
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
                  {!uniformStatusKind ? (
                    <View style={{ width: 112, paddingTop: 2 }}>
                      <StatusLabel kind={statusKind} />
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
                      {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}:{' '}
                      {sourceList} · {storyAge}
                    </V2Text>
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: V2_SPACE.gapSm,
                    }}
                  >
                    {article.status === 'draft' && verdict === 'ready' ? (
                      <V2Button
                        variant="low"
                        label={busyId === article.id ? 'Publishing...' : 'Publish'}
                        disabled={busyId === article.id}
                        onPress={() =>
                          handleAction(() => onApproveArticle(article.id), article.id)
                        }
                      />
                    ) : null}
                    {article.status === 'published' ? (
                      <V2Button
                        variant="low"
                        label={busyId === article.id ? 'Saving...' : 'Unpublish'}
                        disabled={busyId === article.id}
                        onPress={() =>
                          handleAction(() => onUnpublishArticle(article.id), article.id)
                        }
                      />
                    ) : null}
                    <V2Button
                      variant="low"
                      label="Review"
                      onPress={() => onReviewArticle(article.id, orderedIds)}
                    />
                  </View>
                </View>
                <V2Divider />
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}
