import { useCallback, useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  getArticleTags,
  getTopicRecord,
  getTopicSignalExplanation,
  getTopicSignalStatus,
  loadTopicPreferences,
  muteTopicForever,
  resetTopicPreference,
  saveTopicPreferences,
  voteOnArticlePreference,
  type ArticlePreferenceVote,
  type TopicPreferencesState,
  type TopicSignalExplanation,
  type TopicSignalStatus,
} from '@/lib/topicPreferences';
import type { Article } from '@/types/article';

function getCoarseLocation(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) return tz;
  } catch {
    // ignore
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'Unknown';
}

export function useTopicPreferences() {
  const [preferences, setPreferences] = useState<TopicPreferencesState>(() =>
    loadTopicPreferences()
  );

  const updatePreferences = useCallback(
    (updater: (prev: TopicPreferencesState) => TopicPreferencesState) => {
      setPreferences((prev) => {
        const next = updater(prev);
        saveTopicPreferences(next);
        return next;
      });
    },
    []
  );

  const voteArticle = useCallback(
    (
      article: Pick<Article, 'id' | 'topic' | 'region' | 'tags'>,
      vote: ArticlePreferenceVote
    ) => {
      const wasSameVote = preferences.articleVotes[article.id] === vote;
      const tags = getArticleTags(article);

      updatePreferences((prev) =>
        voteOnArticlePreference(prev, article.id, tags, vote)
      );

      if (!wasSameVote) {
        void addDoc(collection(db, 'feedback'), {
          type: 'article_feedback',
          article_id: article.id,
          topic: article.topic ?? null,
          tags,
          vote: vote === 'like' ? 'important' : 'not_worth',
          preference_vote: vote,
          date: new Date().toISOString().split('T')[0],
          location: getCoarseLocation(),
        }).catch(() => {
          // ignore network/rules errors so UI stays responsive
        });
      }
    },
    [preferences.articleVotes, updatePreferences]
  );

  const resetTopic = useCallback(
    (topic: string) => {
      updatePreferences((prev) => resetTopicPreference(prev, topic));
    },
    [updatePreferences]
  );

  const muteTopic = useCallback(
    (topic: string) => {
      updatePreferences((prev) => muteTopicForever(prev, topic));
    },
    [updatePreferences]
  );

  const getSignalStatus = useCallback(
    (topic?: string | null): TopicSignalStatus => {
      return getTopicSignalStatus(getTopicRecord(preferences, topic));
    },
    [preferences]
  );

  const getExplanation = useCallback(
    (topic: string): TopicSignalExplanation => {
      return getTopicSignalExplanation(topic, getTopicRecord(preferences, topic));
    },
    [preferences]
  );

  return {
    preferences,
    articleVotes: preferences.articleVotes,
    voteArticle,
    resetTopic,
    muteTopic,
    getSignalStatus,
    getExplanation,
  };
}
