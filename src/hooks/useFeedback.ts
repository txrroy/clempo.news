import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type FeedbackKind = 'deck' | 'article_feedback' | 'context_feedback';

export interface FeedbackItem {
  id: string;
  type?: 'article_feedback' | 'context_feedback' | string;
  emoji?: string;
  note?: string;
  article_id?: string;
  topic?: string | null;
  tags?: string[];
  vote?: string;
  preference_vote?: 'like' | 'dislike' | string;
  helpful?: boolean;
  sentiment?: 'helpful' | 'not_helpful' | string;
  date?: string;
  location?: string;
}

export function getFeedbackKind(item: FeedbackItem): FeedbackKind {
  if (item.type === 'article_feedback') return 'article_feedback';
  if (item.type === 'context_feedback') return 'context_feedback';
  return 'deck';
}

export function useFeedback(enabled: boolean) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const q = query(collection(db, 'feedback'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const next: FeedbackItem[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FeedbackItem, 'id'>),
        }));
        setItems(next);
        setLoaded(true);
        setError(null);
      },
      (err) => {
        setError(err.message || 'Failed to load feedback.');
        setLoaded(true);
      }
    );

    return () => unsubscribe();
  }, [enabled]);

  if (!enabled) {
    return { items: [] as FeedbackItem[], loading: false, error: null };
  }

  return { items, loading: !loaded, error };
}
