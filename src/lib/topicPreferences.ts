import type { Article } from '@/types/article';

export type ArticlePreferenceVote = 'like' | 'dislike';
export type TopicSignalStatus = 'boosted' | 'normal' | 'reduced' | 'off';

export interface TopicPreferenceRecord {
  likes: number;
  dislikes: number;
  mutedForever: boolean;
  displayName?: string;
}

export interface TopicPreferencesState {
  topics: Record<string, TopicPreferenceRecord>;
  articleVotes: Record<string, ArticlePreferenceVote>;
}

export interface TopicSignalExplanation {
  status: TopicSignalStatus;
  headline: string;
  description: string;
  likes: number;
  dislikes: number;
  isMuted: boolean;
  canReset: boolean;
}

const STORAGE_KEY = 'snappylit_topic_preferences_v1';

const EMPTY_RECORD: TopicPreferenceRecord = {
  likes: 0,
  dislikes: 0,
  mutedForever: false,
};

let inMemoryFallback: TopicPreferencesState = {
  topics: {},
  articleVotes: {},
};

export function createEmptyTopicPreferences(): TopicPreferencesState {
  return {
    topics: {},
    articleVotes: {},
  };
}

export function normalizeTopicKey(topic?: string | null): string | null {
  const trimmed = topic?.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

/**
 * Returns 1-3 deduplicated display tags for an article, preferring `article.tags`
 * and falling back to `[article.topic, article.region]`.
 */
export function getArticleTags(
  article: Pick<Article, 'topic' | 'region' | 'tags'>
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const add = (value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  };

  if (article.tags && article.tags.length > 0) {
    for (const tag of article.tags) {
      add(tag);
      if (result.length >= 3) break;
    }
    return result;
  }

  add(article.topic);
  if (
    article.region &&
    article.region.trim().toLowerCase() !== 'global'
  ) {
    add(article.region);
  }
  return result.slice(0, 3);
}

export function getTopicRecord(
  state: TopicPreferencesState,
  topic?: string | null
): TopicPreferenceRecord {
  const key = normalizeTopicKey(topic);
  if (!key) return EMPTY_RECORD;
  return state.topics[key] ?? EMPTY_RECORD;
}

/**
 * Computes the topic/tag's feed status:
 * - 'off': turned off completely
 * - 'reduced': user disliked >= 2 more stories than liked
 * - 'boosted': user liked >= 2 more stories than disliked
 * - 'normal': default state
 */
export function getTopicSignalStatus(
  record: TopicPreferenceRecord
): TopicSignalStatus {
  if (record.mutedForever) return 'off';
  const net = record.likes - record.dislikes;
  if (net <= -2) return 'reduced';
  if (net >= 2) return 'boosted';
  return 'normal';
}

export function getTopicSignalExplanation(
  topic: string,
  record: TopicPreferenceRecord
): TopicSignalExplanation {
  const status = getTopicSignalStatus(record);
  const { likes, dislikes, mutedForever } = record;
  const hasActivity = likes > 0 || dislikes > 0 || mutedForever;

  if (status === 'off') {
    return {
      status,
      headline: `${topic} is turned off`,
      description: `You won't see ${topic} stories in your main feed anymore.`,
      likes,
      dislikes,
      isMuted: true,
      canReset: true,
    };
  }

  if (status === 'reduced') {
    return {
      status,
      headline: `You are seeing less of ${topic}`,
      description: `You've disliked ${dislikes} ${dislikes === 1 ? 'story' : 'stories'} here${likes > 0 ? ` and liked ${likes}` : ''}, so we're showing it less often.`,
      likes,
      dislikes,
      isMuted: false,
      canReset: true,
    };
  }

  if (status === 'boosted') {
    return {
      status,
      headline: `You are seeing more of ${topic}`,
      description: `You've liked ${likes} ${likes === 1 ? 'story' : 'stories'} here${dislikes > 0 ? ` and disliked ${dislikes}` : ''}, so we're prioritizing it in your feed.`,
      likes,
      dislikes,
      isMuted: false,
      canReset: true,
    };
  }

  return {
    status,
    headline: `You are seeing normal ${topic} coverage`,
    description: hasActivity
      ? `So far you've liked ${likes} and disliked ${dislikes} in ${topic}.`
      : `Like or dislike cards to see more or less of ${topic} over time.`,
    likes,
    dislikes,
    isMuted: false,
    canReset: hasActivity,
  };
}

/**
 * Records or toggles a like/dislike vote on an article and updates all of its tags.
 */
export function voteOnArticlePreference(
  state: TopicPreferencesState,
  articleId: string,
  tagsOrTopic: string | string[] | null | undefined,
  vote: ArticlePreferenceVote
): TopicPreferencesState {
  const prevVote = state.articleVotes[articleId];
  const nextVote = prevVote === vote ? undefined : vote;

  const nextArticleVotes = { ...state.articleVotes };
  if (nextVote) {
    nextArticleVotes[articleId] = nextVote;
  } else {
    delete nextArticleVotes[articleId];
  }

  const rawList = Array.isArray(tagsOrTopic)
    ? tagsOrTopic
    : tagsOrTopic
      ? [tagsOrTopic]
      : [];

  const uniqueTags = new Map<string, string>();
  for (const tag of rawList) {
    const key = normalizeTopicKey(tag);
    if (key && !uniqueTags.has(key)) {
      uniqueTags.set(key, tag.trim());
    }
  }

  if (uniqueTags.size === 0) {
    return {
      ...state,
      articleVotes: nextArticleVotes,
    };
  }

  const nextTopics = { ...state.topics };
  for (const [key, displayName] of uniqueTags.entries()) {
    const prevRecord = nextTopics[key] ?? EMPTY_RECORD;
    let likes = prevRecord.likes;
    let dislikes = prevRecord.dislikes;

    if (prevVote === 'like') likes = Math.max(0, likes - 1);
    if (prevVote === 'dislike') dislikes = Math.max(0, dislikes - 1);

    if (nextVote === 'like') likes += 1;
    if (nextVote === 'dislike') dislikes += 1;

    nextTopics[key] = {
      ...prevRecord,
      likes,
      dislikes,
      displayName: prevRecord.displayName ?? displayName,
    };
  }

  return {
    topics: nextTopics,
    articleVotes: nextArticleVotes,
  };
}

export function resetTopicPreference(
  state: TopicPreferencesState,
  topic: string
): TopicPreferencesState {
  const key = normalizeTopicKey(topic);
  if (!key) return state;

  const nextTopics = { ...state.topics };
  delete nextTopics[key];

  return {
    ...state,
    topics: nextTopics,
  };
}

export function muteTopicForever(
  state: TopicPreferencesState,
  topic: string
): TopicPreferencesState {
  const key = normalizeTopicKey(topic);
  if (!key) return state;

  const prevRecord = state.topics[key] ?? EMPTY_RECORD;
  return {
    ...state,
    topics: {
      ...state.topics,
      [key]: {
        ...prevRecord,
        mutedForever: true,
        displayName: prevRecord.displayName ?? topic.trim(),
      },
    },
  };
}

/**
 * Shapes the general "All Topics" article feed based on all tags on each article:
 * - 'off' on any tag: excluded from the feed
 * - 'reduced' on any tag: keep 1 in 2 stories (or 1 in 4 if net dislikes >= 4) and move lower
 * - 'boosted' on any tag (and none reduced): prioritize earlier in the feed
 * - 'normal': keep all stories in normal order
 */
export function applyTopicPreferences(
  articles: Article[],
  state: TopicPreferencesState
): Article[] {
  const tagOccurrences = new Map<string, number>();
  const welcomeCards: Article[] = [];
  const tiered: { article: Article; tier: number }[] = [];

  for (const article of articles) {
    if (article.id === '__ftue_welcome__') {
      welcomeCards.push(article);
      continue;
    }

    const tags = getArticleTags(article);
    if (tags.length === 0) {
      tiered.push({ article, tier: 0 });
      continue;
    }

    let isOff = false;
    let isBoosted = false;
    let maxReducedDislikes = 0;
    let reducedKey: string | null = null;

    for (const tag of tags) {
      const key = normalizeTopicKey(tag);
      if (!key) continue;
      const record = state.topics[key] ?? EMPTY_RECORD;
      const status = getTopicSignalStatus(record);

      if (status === 'off') {
        isOff = true;
        break;
      }
      if (status === 'reduced') {
        const netDislikes = record.dislikes - record.likes;
        if (netDislikes > maxReducedDislikes) {
          maxReducedDislikes = netDislikes;
          reducedKey = key;
        }
      } else if (status === 'boosted') {
        isBoosted = true;
      }
    }

    if (isOff) {
      continue;
    }

    if (reducedKey) {
      const count = tagOccurrences.get(reducedKey) ?? 0;
      tagOccurrences.set(reducedKey, count + 1);
      const keepEvery = maxReducedDislikes >= 4 ? 4 : 2;
      if (count % keepEvery !== 0) continue;
      tiered.push({ article, tier: maxReducedDislikes >= 4 ? 2 : 1 });
      continue;
    }

    tiered.push({ article, tier: isBoosted ? -1 : 0 });
  }

  tiered.sort((a, b) => a.tier - b.tier);
  return [...welcomeCards, ...tiered.map((item) => item.article)];
}

export function loadTopicPreferences(): TopicPreferencesState {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return createEmptyTopicPreferences();
      const parsed = JSON.parse(raw) as Partial<TopicPreferencesState>;
      return {
        topics: parsed.topics && typeof parsed.topics === 'object' ? parsed.topics : {},
        articleVotes:
          parsed.articleVotes && typeof parsed.articleVotes === 'object'
            ? parsed.articleVotes
            : {},
      };
    }
  } catch {
    // ignore storage errors
  }
  return inMemoryFallback;
}

export function saveTopicPreferences(state: TopicPreferencesState): void {
  inMemoryFallback = state;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // ignore storage errors
  }
}
