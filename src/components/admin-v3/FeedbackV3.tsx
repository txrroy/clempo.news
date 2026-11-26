import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  getFeedbackKind,
  type FeedbackItem,
} from '@/hooks/useFeedback';
import type { Article } from '@/types/article';
import {
  V3Badge,
  V3Button,
  V3Card,
  V3Rule,
  V3Tabs,
  V3Text,
  type V3BadgeTone,
} from './primitives';
import { V3_COLORS, V3_RADII, V3_SPACE } from './tokens';

type FeedbackFilter = 'all' | 'deck' | 'article_feedback' | 'context_feedback';

interface FeedbackV3Props {
  items: FeedbackItem[];
  loading: boolean;
  error: string | null;
  articles: Article[];
  onOpenArticle: (articleId: string) => void;
}

const FILTER_OPTIONS: { id: FeedbackFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'deck', label: 'Deck Ratings' },
  { id: 'article_feedback', label: 'Story Votes' },
  { id: 'context_feedback', label: 'Context' },
];

function getItemBadge(item: FeedbackItem): { label: string; tone: V3BadgeTone } {
  const kind = getFeedbackKind(item);
  if (kind === 'article_feedback') {
    const isLike =
      item.preference_vote === 'like' || item.vote === 'important';
    return {
      label: isLike ? 'Story Like' : 'Story Dislike',
      tone: isLike ? 'approved' : 'rejected',
    };
  }
  if (kind === 'context_feedback') {
    const isHelpful = item.helpful === true || item.sentiment === 'helpful';
    return {
      label: isHelpful ? 'Context Helpful' : 'Context Not Helpful',
      tone: isHelpful ? 'approved' : 'pending',
    };
  }
  return {
    label: item.emoji ? `Deck Rating ${item.emoji}` : 'Deck Rating',
    tone: 'neutral',
  };
}

export function FeedbackV3({
  items,
  loading,
  error,
  articles,
  onOpenArticle,
}: FeedbackV3Props) {
  const [filter, setFilter] = useState<FeedbackFilter>('all');
  const [notesOnly, setNotesOnly] = useState(false);

  const articleById = useMemo(() => {
    const map = new Map<string, Article>();
    for (const a of articles) {
      map.set(a.id, a);
    }
    return map;
  }, [articles]);

  const stats = useMemo(() => {
    let deckCount = 0;
    let likes = 0;
    let dislikes = 0;
    let contextHelpful = 0;
    let contextNotHelpful = 0;
    let notesCount = 0;

    for (const item of items) {
      if (item.note && item.note.trim().length > 0) {
        notesCount += 1;
      }
      const kind = getFeedbackKind(item);
      if (kind === 'deck') {
        deckCount += 1;
      } else if (kind === 'article_feedback') {
        if (item.preference_vote === 'like' || item.vote === 'important') {
          likes += 1;
        } else {
          dislikes += 1;
        }
      } else if (kind === 'context_feedback') {
        if (item.helpful === true || item.sentiment === 'helpful') {
          contextHelpful += 1;
        } else {
          contextNotHelpful += 1;
        }
      }
    }

    return {
      total: items.length,
      deckCount,
      likes,
      dislikes,
      contextHelpful,
      contextNotHelpful,
      notesCount,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filter !== 'all' && getFeedbackKind(item) !== filter) {
        return false;
      }
      if (notesOnly && !(item.note && item.note.trim().length > 0)) {
        return false;
      }
      return true;
    });
  }, [items, filter, notesOnly]);

  return (
    <View style={{ gap: V3_SPACE.xl }}>
      <View style={{ gap: V3_SPACE.xs }}>
        <V3Text role="kicker" tone="muted">
          Reader Signals
        </V3Text>
        <V3Text role="title">Feedback</V3Text>
        <V3Text role="body" tone="muted">
          All reader ratings, written notes, story votes, and background-context signals.
        </V3Text>
      </View>

      <V3Card variant="outlined" padding="lg">
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: V3_SPACE.xl,
          }}
        >
          <View style={{ gap: V3_SPACE.xs }}>
            <V3Text role="kicker" tone="muted">
              Total Entries
            </V3Text>
            <V3Text role="section" tabularNums>
              {stats.total}
            </V3Text>
          </View>
          <View style={{ gap: V3_SPACE.xs }}>
            <V3Text role="kicker" tone="muted">
              Written Notes
            </V3Text>
            <V3Text role="section" tabularNums>
              {stats.notesCount}
            </V3Text>
          </View>
          <View style={{ gap: V3_SPACE.xs }}>
            <V3Text role="kicker" tone="muted">
              Deck Ratings
            </V3Text>
            <V3Text role="section" tabularNums>
              {stats.deckCount}
            </V3Text>
          </View>
          <View style={{ gap: V3_SPACE.xs }}>
            <V3Text role="kicker" tone="muted">
              Story Votes
            </V3Text>
            <V3Text role="section" tabularNums>
              {stats.likes} like / {stats.dislikes} dislike
            </V3Text>
          </View>
          <View style={{ gap: V3_SPACE.xs }}>
            <V3Text role="kicker" tone="muted">
              Context Signals
            </V3Text>
            <V3Text role="section" tabularNums>
              {stats.contextHelpful} helpful / {stats.contextNotHelpful} not helpful
            </V3Text>
          </View>
        </View>
      </V3Card>

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
          options={FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
        />

        <Pressable
          onPress={() => setNotesOnly((prev) => !prev)}
          style={{
            paddingHorizontal: V3_SPACE.md,
            paddingVertical: V3_SPACE.xs + 2,
            borderRadius: V3_RADII.control,
            backgroundColor: notesOnly ? V3_COLORS.ink : 'transparent',
            borderWidth: notesOnly ? 0 : 1,
            borderColor: notesOnly ? 'transparent' : V3_COLORS.border,
          }}
        >
          <V3Text role="mono" tone={notesOnly ? 'inverse' : 'muted'}>
            {notesOnly ? 'Notes Only: ON' : 'Notes Only: OFF'}
          </V3Text>
        </Pressable>
      </View>

      <V3Rule />

      {error ? (
        <V3Text role="body" tone="danger">
          {error}
        </V3Text>
      ) : null}

      {loading ? (
        <V3Text role="mono">LOADING FEEDBACK...</V3Text>
      ) : filteredItems.length === 0 ? (
        <V3Card variant="outlined">
          <V3Text role="body" tone="muted">
            No feedback entries match the current filter.
          </V3Text>
        </V3Card>
      ) : (
        <View style={{ gap: V3_SPACE.md }}>
          {filteredItems.map((item) => {
            const badge = getItemBadge(item);
            const matchedArticle = item.article_id
              ? articleById.get(item.article_id)
              : undefined;
            const hasNote = Boolean(item.note && item.note.trim().length > 0);
            const metaParts = [
              item.date || 'No date',
              item.topic || null,
              item.location || null,
            ].filter(Boolean);

            return (
              <V3Card key={item.id} variant="filled" padding="lg">
                <View style={{ gap: V3_SPACE.sm }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: V3_SPACE.sm,
                    }}
                  >
                    <V3Badge label={badge.label} tone={badge.tone} />
                    <V3Text role="mono" tone="muted">
                      {metaParts.join(' · ')}
                    </V3Text>
                  </View>

                  {matchedArticle ? (
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: V3_SPACE.sm,
                      }}
                    >
                      <V3Text
                        role="headline"
                        style={{ flex: 1, minWidth: 200 }}
                      >
                        {matchedArticle.ai_headline}
                      </V3Text>
                      <V3Button
                        label="Open Story"
                        variant="outline"
                        size="sm"
                        onPress={() => onOpenArticle(matchedArticle.id)}
                      />
                    </View>
                  ) : item.article_id ? (
                    <V3Text role="mono" tone="subtle">
                      Article ID: {item.article_id}
                    </V3Text>
                  ) : null}

                  {hasNote ? (
                    <View
                      style={{
                        backgroundColor: V3_COLORS.surfaceWell,
                        paddingHorizontal: V3_SPACE.md,
                        paddingVertical: V3_SPACE.sm,
                        borderLeftWidth: 3,
                        borderLeftColor: V3_COLORS.accent,
                      }}
                    >
                      <V3Text role="body">{item.note}</V3Text>
                    </View>
                  ) : null}
                </View>
              </V3Card>
            );
          })}
        </View>
      )}
    </View>
  );
}

