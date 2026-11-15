import { getTopicVisual } from '@/config/topicConfig';
import {
  formatEditionDate,
  getSourceLabel,
  openArticleUrl,
  parseAnchorSegments,
  splitSummaryIntoPoints,
} from '@/lib/consumerUtils';
import { db } from '@/lib/firebase';
import { formatStreakLine } from '@/lib/readingStreak';
import {
  getArticleTags,
  type ArticlePreferenceVote,
} from '@/lib/topicPreferences';
import type { Article } from '@/types/article';
import {
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import { Image } from 'expo-image';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { BookmarkIcon } from './BookmarkIcon';
import { ThumbIcon } from './ThumbIcon';
import { TopicIcon } from './TopicIcon';
import { TopicPatternBanner } from './TopicPatternBanner';

interface SwipeCardDeckProps {
  articles: Article[];
  onIndexChange?: (index: number) => void;
  onRequestOlderNews?: () => void;
  activeTopic?: string | null;
  onSelectTopic?: (topic: string) => void;
  onClearTopic?: () => void;
  showOnboardingTips?: boolean;
  showImages?: boolean;
  fontScale?: number;
  savedArticleIds?: Record<string, boolean>;
  savedCount?: number;
  onOpenSavedForLater?: () => void;
  onToggleSaveArticle?: (article: Article) => void;
  articleVotes?: Record<string, ArticlePreferenceVote>;
  onVoteArticle?: (article: Article, vote: ArticlePreferenceVote) => void;
  streakDays?: number;
  nextEditionText?: string;
  resetToken?: number;
}

const FEEDBACK_EMOJIS = [
  { emoji: '😕', label: 'Not great' },
  { emoji: '🙂', label: 'Good' },
  { emoji: '😍', label: 'Loved it' },
] as const;

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

const SPRING_CONFIG = {
  damping: 22,
  stiffness: 260,
  mass: 0.85,
};

function canUseLiquidGlass(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

function GlassTagPill({
  children,
  borderColor,
  primary = true,
  interactive = false,
  useNativeGlass = true,
  style,
}: {
  children: ReactNode;
  borderColor?: string;
  primary?: boolean;
  interactive?: boolean;
  useNativeGlass?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const pillBorderColor =
    borderColor ??
    (primary ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.22)');

  if (useNativeGlass && canUseLiquidGlass()) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="dark"
        tintColor={
          primary ? 'rgba(28, 25, 23, 0.36)' : 'rgba(28, 25, 23, 0.24)'
        }
        isInteractive={interactive}
        style={[
          {
            borderRadius: 999,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: pillBorderColor,
          },
          style,
        ]}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        {
          borderRadius: 999,
          overflow: 'hidden',
          backgroundColor: primary
            ? 'rgba(28, 25, 23, 0.44)'
            : 'rgba(28, 25, 23, 0.32)',
          borderWidth: 1,
          borderColor: pillBorderColor,
          ...(Platform.OS === 'web'
            ? ({
                backdropFilter: 'blur(14px) saturate(160%)',
                WebkitBackdropFilter: 'blur(14px) saturate(160%)',
                boxShadow:
                  'inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 4px 12px rgba(0, 0, 0, 0.16)',
              } as Record<string, unknown>)
            : {}),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function ArticleSummaryPoints({
  article,
  fontScale,
}: {
  article: Article;
  fontScale: number;
}) {
  const points = splitSummaryIntoPoints(article.ai_summary);
  const summaryFontSize = Math.round(15 * fontScale * 10) / 10;
  const summaryLineHeight = Math.round(22 * fontScale * 10) / 10;
  const topicAccent = getTopicVisual(article.topic)?.color ?? '#0D9488';

  if (points.length <= 1) {
    const segments = parseAnchorSegments(points[0] ?? article.ai_summary);
    return (
      <Text
        style={{
          fontSize: summaryFontSize,
          lineHeight: summaryLineHeight,
          color: '#57534E',
        }}
      >
        {segments.map((seg, idx) => (
          <Text
            key={idx}
            style={
              seg.isAnchor
                ? {
                    fontWeight: '600',
                    color: '#1C1917',
                  }
                : undefined
            }
          >
            {seg.text}
          </Text>
        ))}
      </Text>
    );
  }

  return (
    <View style={{ gap: Math.round(7 * fontScale) }}>
      {points.map((point, ptIdx) => {
        const segments = parseAnchorSegments(point);
        return (
          <View
            key={ptIdx}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                backgroundColor: topicAccent,
                marginTop: Math.round(summaryLineHeight * 0.4),
                opacity: 0.85,
              }}
            />
            <Text
              style={{
                flex: 1,
                fontSize: summaryFontSize,
                lineHeight: summaryLineHeight,
                color: '#57534E',
              }}
            >
              {segments.map((seg, segIdx) => (
                <Text
                  key={segIdx}
                  style={
                    seg.isAnchor
                      ? {
                          fontWeight: '600',
                          color: '#1C1917',
                        }
                      : undefined
                  }
                >
                  {seg.text}
                </Text>
              ))}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function SwipeCardDeck({
  articles,
  onIndexChange,
  onRequestOlderNews,
  activeTopic,
  onSelectTopic,
  onClearTopic,
  showOnboardingTips = false,
  showImages = true,
  fontScale = 1,
  savedArticleIds: controlledSavedIds,
  savedCount,
  onOpenSavedForLater,
  onToggleSaveArticle,
  articleVotes: controlledArticleVotes,
  onVoteArticle,
  streakDays,
  nextEditionText,
  resetToken = 0,
}: SwipeCardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [feedbackStep, setFeedbackStep] = useState<'idle' | 'note' | 'sent'>('idle');
  const [feedbackDocId, setFeedbackDocId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [sendingNote, setSendingNote] = useState(false);
  const [localArticleVotes, setLocalArticleVotes] = useState<
    Record<string, ArticlePreferenceVote>
  >({});
  const effectiveArticleVotes = controlledArticleVotes ?? localArticleVotes;
  const [contextFeedbackByArticle, setContextFeedbackByArticle] = useState<
    Record<
      string,
      {
        sentiment: 'helpful' | 'not_helpful';
        step: 'note' | 'sent';
        docId?: string;
      }
    >
  >({});
  const [contextNoteText, setContextNoteText] = useState('');
  const [sendingContextNote, setSendingContextNote] = useState(false);
  const [localSavedIds, setLocalSavedIds] = useState<Record<string, boolean>>({});
  const effectiveSavedIds = controlledSavedIds ?? localSavedIds;
  const [imageTier, setImageTier] = useState<0 | 1 | 2>(0);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [nextImageLoadFailed, setNextImageLoadFailed] = useState(false);
  const [prevImageLoadFailed, setPrevImageLoadFailed] = useState(false);
  const [flipTipDismissed, setFlipTipDismissed] = useState(false);
  const [topicTipDismissed, setTopicTipDismissed] = useState(false);
  const textAreaHeightRef = useRef(0);
  const textContentHeightRef = useRef(0);
  const noteInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const contextNoteInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextFeedbackDocPromisesRef = useRef<
    Record<string, Promise<string | null>>
  >({});

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
      }
    };
  }, []);
  const { width, height } = useWindowDimensions();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const windowHeightSV = useSharedValue(height);
  const cardHeightSV = useSharedValue(Math.max(420, height * 0.72));
  const prevTranslateY = useSharedValue(-Math.max(height, 1000) - 200);
  const isPullingPrev = useSharedValue(false);
  const flipProgress = useSharedValue(0);
  const nextCardBlur = useSharedValue(6);
  const isAnimating = useSharedValue(false);
  const summaryFocusOpacity = useSharedValue(0.68);

  useEffect(() => {
    windowHeightSV.value = height;
  }, [height, windowHeightSV]);

  const prevArticle = currentIndex > 0 ? (articles[currentIndex - 1] ?? null) : null;
  const currentArticle = articles[currentIndex] ?? null;
  const nextArticle = articles[currentIndex + 1] ?? null;
  const thirdArticle = articles[currentIndex + 2] ?? null;

  const baseImageTier = useMemo<0 | 1 | 2>(() => {
    if (fontScale >= 1.2) return 2;
    if (fontScale >= 1.08) return 1;
    return 0;
  }, [fontScale]);

  useEffect(() => {
    setImageTier(baseImageTier);
    setImageLoadFailed(false);
    setNextImageLoadFailed(false);
    setPrevImageLoadFailed(false);
    textAreaHeightRef.current = 0;
    textContentHeightRef.current = 0;
    // Focus-assisted dimming: start summary gently dimmed so the eye lands on Topic + Headline first, then settle to full contrast
    summaryFocusOpacity.value = 0.66;
    summaryFocusOpacity.value = withTiming(1, { duration: 420 });
  }, [currentArticle?.id, baseImageTier, summaryFocusOpacity]);

  const checkTextOverflow = useCallback(() => {
    if (
      textAreaHeightRef.current > 0 &&
      textContentHeightRef.current > textAreaHeightRef.current + 2
    ) {
      setImageTier((prev) => (prev < 2 ? ((prev + 1) as 0 | 1 | 2) : 2));
    }
  }, []);

  const handleToggleSave = useCallback(
    (article: Article) => {
      if (onToggleSaveArticle) {
        onToggleSaveArticle(article);
        return;
      }
      setLocalSavedIds((prev) => {
        const next = { ...prev };
        if (next[article.id]) {
          delete next[article.id];
        } else {
          next[article.id] = true;
        }
        return next;
      });
    },
    [onToggleSaveArticle]
  );

  const savedArticlesList = useMemo(
    () =>
      articles.filter(
        (a) => a.id !== '__ftue_welcome__' && Boolean(effectiveSavedIds[a.id])
      ),
    [articles, effectiveSavedIds]
  );

  const summaryFocusStyle = useAnimatedStyle(() => ({
    opacity: summaryFocusOpacity.value,
  }));

  const horizontalThreshold = Math.min(width * 0.24, 100);
  const verticalThreshold = Math.min(height * 0.16, 100);

  const resetFlip = useCallback(() => {
    setIsFlipped(false);
    flipProgress.value = 0;
  }, [flipProgress]);

  const toggleFlip = useCallback(() => {
    if (currentIndex === 1) {
      setFlipTipDismissed(true);
    } else if (currentIndex === 2) {
      setTopicTipDismissed(true);
    }
    setIsFlipped((prev) => {
      const next = !prev;
      flipProgress.value = withTiming(next ? 1 : 0, { duration: 320 });
      return next;
    });
  }, [currentIndex, flipProgress]);

  // Reset deck to first card when the article list or resetToken changes
  useEffect(() => {
    setCurrentIndex(0);
    resetFlip();
    setFeedbackStep('idle');
    setFeedbackDocId(null);
    setNoteText('');
    setContextNoteText('');
    setSendingContextNote(false);
    translateX.value = 0;
    translateY.value = 0;
    prevTranslateY.value = -Math.max(
      cardHeightSV.value + 120,
      windowHeightSV.value + 200
    );
    isPullingPrev.value = false;
    onIndexChange?.(0);
  }, [articles, resetToken, cardHeightSV, isPullingPrev, onIndexChange, prevTranslateY, resetFlip, translateX, translateY, windowHeightSV]);

  const handleSelectEmoji = useCallback(async (emoji: string) => {
    setFeedbackStep('note');
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => {
      noteInputRef.current?.focus();
    }, 50);

    try {
      const docRef = await addDoc(collection(db, 'feedback'), {
        emoji,
        date: new Date().toISOString().split('T')[0],
        location: getCoarseLocation(),
      });
      setFeedbackDocId(docRef.id);
    } catch {
      // Fail silently so UI still lets reader continue
    }
  }, []);

  const handleSendNote = useCallback(async () => {
    const trimmed = noteText.trim();
    if (!trimmed) {
      setFeedbackStep('sent');
      return;
    }
    setSendingNote(true);
    try {
      if (feedbackDocId) {
        await updateDoc(doc(db, 'feedback', feedbackDocId), {
          note: trimmed,
        });
      }
    } catch {
      // ignore
    } finally {
      setSendingNote(false);
      setNoteText('');
      setFeedbackStep('sent');
    }
  }, [feedbackDocId, noteText]);

  const handleCancelNote = useCallback(() => {
    setNoteText('');
    setFeedbackStep('sent');
  }, []);

  const handleArticleVote = useCallback(
    async (article: Article, vote: ArticlePreferenceVote) => {
      if (onVoteArticle) {
        onVoteArticle(article, vote);
        return;
      }

      const wasSame = localArticleVotes[article.id] === vote;
      setLocalArticleVotes((prev) => {
        const next = { ...prev };
        if (wasSame) {
          delete next[article.id];
        } else {
          next[article.id] = vote;
        }
        return next;
      });
      if (wasSame) return;

      try {
        await addDoc(collection(db, 'feedback'), {
          type: 'article_feedback',
          article_id: article.id,
          topic: article.topic ?? null,
          vote: vote === 'like' ? 'important' : 'not_worth',
          preference_vote: vote,
          date: new Date().toISOString().split('T')[0],
          location: getCoarseLocation(),
        });
      } catch {
        // ignore network/rules errors so UI stays responsive
      }
    },
    [localArticleVotes, onVoteArticle]
  );

  const handleContextFeedback = useCallback(
    async (article: Article, sentiment: 'helpful' | 'not_helpful') => {
      if (contextFeedbackByArticle[article.id]) return;

      setContextNoteText('');
      setContextFeedbackByArticle((prev) => ({
        ...prev,
        [article.id]: { sentiment, step: 'note' },
      }));
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      focusTimerRef.current = setTimeout(() => {
        contextNoteInputRef.current?.focus();
      }, 50);

      const createPromise = (async (): Promise<string | null> => {
        try {
          const docRef = await addDoc(collection(db, 'feedback'), {
            type: 'context_feedback',
            article_id: article.id,
            topic: article.topic ?? null,
            helpful: sentiment === 'helpful',
            sentiment,
            date: new Date().toISOString().split('T')[0],
            location: getCoarseLocation(),
          });
          setContextFeedbackByArticle((prev) => {
            const existing = prev[article.id];
            if (!existing) return prev;
            return {
              ...prev,
              [article.id]: { ...existing, docId: docRef.id },
            };
          });
          return docRef.id;
        } catch {
          return null;
        }
      })();

      contextFeedbackDocPromisesRef.current[article.id] = createPromise;
      await createPromise;
    },
    [contextFeedbackByArticle]
  );

  const handleSendContextNote = useCallback(
    async (articleId: string) => {
      const trimmed = contextNoteText.trim();
      if (!trimmed) {
        setContextFeedbackByArticle((prev) => {
          const existing = prev[articleId];
          if (!existing) return prev;
          return { ...prev, [articleId]: { ...existing, step: 'sent' } };
        });
        return;
      }

      setSendingContextNote(true);
      try {
        const docId =
          contextFeedbackByArticle[articleId]?.docId ??
          (await contextFeedbackDocPromisesRef.current[articleId]);
        if (docId) {
          await updateDoc(doc(db, 'feedback', docId), {
            note: trimmed,
          });
        }
      } catch {
        // ignore
      } finally {
        setSendingContextNote(false);
        setContextNoteText('');
        setContextFeedbackByArticle((prev) => {
          const existing = prev[articleId];
          if (!existing) return prev;
          return { ...prev, [articleId]: { ...existing, step: 'sent' } };
        });
      }
    },
    [contextFeedbackByArticle, contextNoteText]
  );

  const handleCancelContextNote = useCallback((articleId: string) => {
    setContextNoteText('');
    setContextFeedbackByArticle((prev) => {
      const existing = prev[articleId];
      if (!existing) return prev;
      return { ...prev, [articleId]: { ...existing, step: 'sent' } };
    });
  }, []);

  useEffect(() => {
    onIndexChange?.(currentIndex);
  }, [currentIndex, onIndexChange]);

  // Prefetch upcoming article images for instant transitions
  useEffect(() => {
    const urls = [
      articles[currentIndex + 1]?.image_url,
      articles[currentIndex + 2]?.image_url,
    ].filter((u): u is string => Boolean(u));
    if (urls.length > 0) {
      Image.prefetch(urls).catch(() => { });
    }
  }, [currentIndex, articles]);

  const commitNext = useCallback(() => {
    resetFlip();
    setContextNoteText('');
    setSendingContextNote(false);
    setCurrentIndex((prev) => Math.min(prev + 1, articles.length));
    isPullingPrev.value = false;
    prevTranslateY.value = -Math.max(
      cardHeightSV.value + 120,
      windowHeightSV.value + 200
    );
    translateX.value = 0;
    translateY.value = 0;
    nextCardBlur.value = 6;
    isAnimating.value = false;
  }, [articles.length, cardHeightSV, isAnimating, isPullingPrev, nextCardBlur, prevTranslateY, resetFlip, translateX, translateY, windowHeightSV]);

  const commitPrevInstant = useCallback(() => {
    resetFlip();
    setContextNoteText('');
    setSendingContextNote(false);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
    prevTranslateY.value = -Math.max(
      cardHeightSV.value + 120,
      windowHeightSV.value + 200
    );
    translateX.value = 0;
    translateY.value = 0;
    isAnimating.value = false;
  }, [cardHeightSV, isAnimating, prevTranslateY, resetFlip, translateX, translateY, windowHeightSV]);

  // Left, Right, and Up move forward; Downward pull brings the previous card down from above
  const panGesture = Gesture.Pan()
    .minDistance(10)
    .onStart(() => {
      if (isAnimating.value) return;
      isPullingPrev.value = false;
    })
    .onUpdate((event) => {
      if (isAnimating.value) return;

      const isDownwardPull =
        currentIndex > 0 &&
        event.translationY > 10 &&
        event.translationY > Math.abs(event.translationX);

      if (isDownwardPull) {
        if (!isPullingPrev.value) {
          isPullingPrev.value = true;
          translateX.value = withSpring(0, SPRING_CONFIG);
          translateY.value = withSpring(0, SPRING_CONFIG);
        }
        const entryStart = -cardHeightSV.value;
        prevTranslateY.value = Math.min(0, entryStart + event.translationY * 1.15);
        return;
      }

      if (isPullingPrev.value && event.translationY <= 0) {
        isPullingPrev.value = false;
        prevTranslateY.value = withTiming(-(cardHeightSV.value + 120), {
          duration: 150,
        });
      }

      if (isPullingPrev.value) {
        const entryStart = -cardHeightSV.value;
        prevTranslateY.value = Math.min(
          0,
          entryStart + Math.max(0, event.translationY) * 1.15
        );
        return;
      }

      const draggingDownAtStart = currentIndex === 0 && event.translationY > 0;
      translateX.value = event.translationX;
      translateY.value = draggingDownAtStart
        ? event.translationY * 0.22
        : event.translationY;
    })
    .onEnd((event) => {
      if (isAnimating.value) return;

      if (isPullingPrev.value) {
        isPullingPrev.value = false;
        const pulledDownEnough =
          currentIndex > 0 &&
          (event.translationY > verticalThreshold || event.velocityY > 480);

        if (pulledDownEnough) {
          isAnimating.value = true;
          prevTranslateY.value = withTiming(
            0,
            { duration: 190 },
            (finished) => {
              if (finished) {
                runOnJS(commitPrevInstant)();
              } else {
                isAnimating.value = false;
              }
            }
          );
        } else {
          prevTranslateY.value = withTiming(-(cardHeightSV.value + 120), {
            duration: 180,
          });
          translateX.value = withSpring(0, SPRING_CONFIG);
          translateY.value = withSpring(0, SPRING_CONFIG);
        }
        return;
      }

      const absX = Math.abs(event.translationX);
      const absY = Math.abs(event.translationY);
      const horizontalDominant = absX >= absY;

      const swipedDown =
        currentIndex > 0 &&
        !horizontalDominant &&
        (event.translationY > verticalThreshold || event.velocityY > 480);

      if (swipedDown) {
        isAnimating.value = true;
        if (prevTranslateY.value < -cardHeightSV.value) {
          prevTranslateY.value = -cardHeightSV.value;
        }
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        prevTranslateY.value = withTiming(
          0,
          { duration: 210 },
          (finished) => {
            if (finished) {
              runOnJS(commitPrevInstant)();
            } else {
              isAnimating.value = false;
            }
          }
        );
        return;
      }

      const swipedRight =
        event.translationX > horizontalThreshold || event.velocityX > 480;
      const swipedLeft =
        event.translationX < -horizontalThreshold || event.velocityX < -480;
      const swipedUp =
        event.translationY < -verticalThreshold || event.velocityY < -480;

      if (
        (horizontalDominant && (swipedRight || swipedLeft)) ||
        (!horizontalDominant && swipedUp) ||
        swipedRight ||
        swipedLeft ||
        swipedUp
      ) {
        isAnimating.value = true;
        nextCardBlur.value = withTiming(0, { duration: 180 });
        if (swipedUp && (!horizontalDominant || (!swipedRight && !swipedLeft))) {
          translateY.value = withTiming(
            -height * 1.1,
            { duration: 210 },
            (finished) => {
              if (finished) {
                runOnJS(commitNext)();
              } else {
                isAnimating.value = false;
              }
            }
          );
        } else {
          const exitX =
            swipedLeft && (!swipedRight || event.translationX < 0)
              ? -width * 1.15
              : width * 1.15;
          translateX.value = withTiming(
            exitX,
            { duration: 200 },
            (finished) => {
              if (finished) {
                runOnJS(commitNext)();
              } else {
                isAnimating.value = false;
              }
            }
          );
        }
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    })
    .onFinalize((_, success) => {
      if (!success && !isAnimating.value) {
        if (isPullingPrev.value) {
          isPullingPrev.value = false;
          prevTranslateY.value = withTiming(-(cardHeightSV.value + 120), {
            duration: 150,
          });
        }
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  // Scope tap-to-flip strictly to the image and body areas so footer actions never flip the card
  const imageTapGesture = Gesture.Tap()
    .maxDuration(250)
    .maxDistance(10)
    .enabled(!isFlipped && currentArticle?.id !== '__ftue_welcome__')
    .onEnd(() => {
      if (isAnimating.value) return;
      runOnJS(toggleFlip)();
    });

  const bodyTapGesture = Gesture.Tap()
    .maxDuration(250)
    .maxDistance(10)
    .enabled(!isFlipped && currentArticle?.id !== '__ftue_welcome__')
    .onEnd(() => {
      if (isAnimating.value) return;
      runOnJS(toggleFlip)();
    });

  const activeCardStyle = useAnimatedStyle(() => {
    const rotateDeg = interpolate(
      translateX.value,
      [-width * 0.6, 0, width * 0.6],
      [-5.5, 0, 5.5],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotateDeg}deg` },
      ],
    };
  });

  const frontFaceStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 1], [0, 180]);
    const opacity = interpolate(flipProgress.value, [0, 0.49, 0.5, 1], [1, 1, 0, 0]);
    return {
      opacity,
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden' as const,
    };
  });

  const backFaceStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 1], [180, 360]);
    const opacity = interpolate(flipProgress.value, [0, 0.49, 0.5, 1], [0, 0, 1, 1]);
    return {
      opacity,
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden' as const,
    };
  });

  const nextCardStyle = useAnimatedStyle(() => {
    const forwardDist = Math.max(0, Math.abs(translateX.value), -translateY.value);
    const progress = interpolate(
      forwardDist,
      [0, width * 0.45],
      [0, 1],
      Extrapolation.CLAMP
    );
    const offsetY = interpolate(progress, [0, 1], [-6, 0]);
    const scaleX = interpolate(progress, [0, 1], [0.94, 1]);
    const opacity = interpolate(progress, [0, 1], [0.96, 1]);

    return {
      opacity,
      transform: [{ translateY: offsetY }, { scaleX }],
    };
  });

  const nextCardContentStyle = useAnimatedStyle(() => {
    const contentOpacity = interpolate(nextCardBlur.value, [6, 0], [0.68, 1]);
    if (Platform.OS === 'web') {
      return {
        opacity: contentOpacity,
        filter: `blur(${nextCardBlur.value.toFixed(2)}px)`,
      } as Record<string, unknown>;
    }
    return {
      opacity: contentOpacity,
    };
  });

  const prevCardStyle = useAnimatedStyle(() => {
    const offscreenY = -(cardHeightSV.value + 120);
    const isVisible = prevTranslateY.value > offscreenY + 8;
    const entryStart = -cardHeightSV.value;
    const opacity = interpolate(
      prevTranslateY.value,
      [offscreenY, entryStart - 16, entryStart + 18],
      [0, 0, 1],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      prevTranslateY.value,
      [entryStart, -56, 0],
      [1.018, 1.018, 1],
      Extrapolation.CLAMP
    );
    const shadowOpacity = interpolate(
      prevTranslateY.value,
      [entryStart, -36, 0],
      [0.24, 0.24, 0.12],
      Extrapolation.CLAMP
    );
    return {
      opacity: isVisible ? opacity : 0,
      zIndex: isVisible ? 10 : -1,
      elevation: isVisible ? 16 : 0,
      shadowOpacity: isVisible ? shadowOpacity : 0,
      transform: [{ translateY: prevTranslateY.value }, { scale }],
    };
  });

  const pullPrevScrimStyle = useAnimatedStyle(() => {
    const offscreenY = -(cardHeightSV.value + 120);
    const isVisible = prevTranslateY.value > offscreenY + 8;
    const progress = interpolate(
      prevTranslateY.value,
      [-cardHeightSV.value, 0],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: isVisible ? progress * 0.14 : 0,
    };
  });

  const caughtUpPanGesture = Gesture.Pan()
    .minDistance(10)
    .onStart(() => {
      if (isAnimating.value) return;
      isPullingPrev.value = false;
    })
    .onUpdate((event) => {
      if (isAnimating.value) return;

      const isDownwardPull =
        articles.length > 0 &&
        event.translationY > 10 &&
        event.translationY > Math.abs(event.translationX);

      if (isDownwardPull) {
        if (!isPullingPrev.value) {
          isPullingPrev.value = true;
          translateX.value = withSpring(0, SPRING_CONFIG);
          translateY.value = withSpring(0, SPRING_CONFIG);
        }
        const entryStart = -cardHeightSV.value;
        prevTranslateY.value = Math.min(0, entryStart + event.translationY * 1.15);
        return;
      }

      if (isPullingPrev.value && event.translationY <= 0) {
        isPullingPrev.value = false;
        prevTranslateY.value = withTiming(-(cardHeightSV.value + 120), {
          duration: 150,
        });
      }

      if (isPullingPrev.value) {
        const entryStart = -cardHeightSV.value;
        prevTranslateY.value = Math.min(
          0,
          entryStart + Math.max(0, event.translationY) * 1.15
        );
        return;
      }

      const resist = !onRequestOlderNews ? 0.22 : 1;
      const draggingDownEmpty = articles.length === 0 && event.translationY > 0;
      translateX.value = event.translationX * resist;
      translateY.value =
        draggingDownEmpty ? event.translationY * 0.22 : event.translationY * resist;
    })
    .onEnd((event) => {
      if (isAnimating.value) return;

      if (isPullingPrev.value) {
        isPullingPrev.value = false;
        const pulledDownEnough =
          articles.length > 0 &&
          (event.translationY > verticalThreshold || event.velocityY > 480);

        if (pulledDownEnough) {
          isAnimating.value = true;
          prevTranslateY.value = withTiming(
            0,
            { duration: 190 },
            (finished) => {
              if (finished) {
                runOnJS(commitPrevInstant)();
              } else {
                isAnimating.value = false;
              }
            }
          );
        } else {
          prevTranslateY.value = withTiming(-(cardHeightSV.value + 120), {
            duration: 180,
          });
          translateX.value = withSpring(0, SPRING_CONFIG);
          translateY.value = withSpring(0, SPRING_CONFIG);
        }
        return;
      }

      const absX = Math.abs(event.translationX);
      const absY = Math.abs(event.translationY);
      const horizontalDominant = absX >= absY;

      const swipedDown =
        articles.length > 0 &&
        !horizontalDominant &&
        (event.translationY > verticalThreshold || event.velocityY > 480);

      if (swipedDown) {
        isAnimating.value = true;
        if (prevTranslateY.value < -cardHeightSV.value) {
          prevTranslateY.value = -cardHeightSV.value;
        }
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        prevTranslateY.value = withTiming(
          0,
          { duration: 210 },
          (finished) => {
            if (finished) {
              runOnJS(commitPrevInstant)();
            } else {
              isAnimating.value = false;
            }
          }
        );
        return;
      }

      const swipedRight =
        event.translationX > horizontalThreshold || event.velocityX > 480;
      const swipedLeft =
        event.translationX < -horizontalThreshold || event.velocityX < -480;
      const swipedUp =
        event.translationY < -verticalThreshold || event.velocityY < -480;

      if (
        onRequestOlderNews &&
        ((horizontalDominant && (swipedRight || swipedLeft)) ||
          (!horizontalDominant && swipedUp) ||
          swipedRight ||
          swipedLeft ||
          swipedUp)
      ) {
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        runOnJS(onRequestOlderNews)();
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    })
    .onFinalize((_, success) => {
      if (!success && !isAnimating.value) {
        if (isPullingPrev.value) {
          isPullingPrev.value = false;
          prevTranslateY.value = withTiming(-(cardHeightSV.value + 120), {
            duration: 150,
          });
        }
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const prevOverlay = prevArticle ? (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          pullPrevScrimStyle,
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 5,
            borderRadius: 26,
            backgroundColor: '#1C1917',
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          prevCardStyle,
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 26,
            backgroundColor:
              prevArticle.id === '__ftue_welcome__' ? '#fefaef' : '#FFFFFF',
            borderWidth: Platform.OS === 'web' ? 0 : 1,
            borderColor: 'rgba(28, 25, 23, 0.08)',
            boxShadow:
              '0 20px 42px -4px rgba(28, 25, 23, 0.28), 0 8px 18px rgba(28, 25, 23, 0.14), 0 0 0 1px rgba(28, 25, 23, 0.08)',
            shadowColor: '#1C1917',
            shadowRadius: 26,
            shadowOffset: { width: 0, height: 14 },
          },
        ]}
      >
        <View
          style={{
            flex: 1,
            borderRadius: 26,
            overflow: 'hidden',
            ...(Platform.OS === 'web'
              ? ({
                  isolation: 'isolate',
                  WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                } as Record<string, unknown>)
              : {}),
          }}
        >
          {prevArticle.id === '__ftue_welcome__' ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 28,
              }}
            >
              <Image
                source={require('../../../assets/images/snappylit-logo-v2.png')}
                contentFit="contain"
                style={{ width: 96, height: 96, marginBottom: 20 }}
              />
              <Text className="text-[22px] font-bold text-ink text-center tracking-[-0.35px] mb-2 consumer-display">
                Welcome curious reader!
              </Text>
              <Text className="text-[15px] leading-[22px] text-stone-600 text-center">
                Swipe to start reading
              </Text>
            </View>
          ) : (
            <>
              <View
                style={{
                  position: 'relative',
                  width: '100%',
                  height:
                    baseImageTier === 0 ? 175 : baseImageTier === 1 ? 88 : 44,
                  overflow: 'hidden',
                }}
              >
                {showImages && prevArticle.image_url && !prevImageLoadFailed ? (
                  <Image
                    source={{ uri: prevArticle.image_url }}
                    contentFit="cover"
                    onError={() => setPrevImageLoadFailed(true)}
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#F1EFEA',
                    }}
                  />
                ) : (
                  <TopicPatternBanner topic={prevArticle.topic} />
                )}
                {prevArticle.topic ? (() => {
                  const prevVisual = getTopicVisual(prevArticle.topic);
                  return (
                    <GlassTagPill
                      borderColor={prevVisual?.pillBorder}
                      useNativeGlass={false}
                      style={{
                        position: 'absolute',
                        top: 12,
                        left: 12,
                        paddingHorizontal: 11,
                        paddingVertical: 4,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {prevVisual ? (
                        <TopicIcon
                          name={prevVisual.icon}
                          color={prevVisual.color}
                          size={12}
                        />
                      ) : null}
                      <Text className="text-[11.5px] font-medium text-white">
                        {prevArticle.topic}
                      </Text>
                    </GlassTagPill>
                  );
                })() : null}
              </View>

              <View style={{ flex: 1, padding: 20, overflow: 'hidden' }}>
                <View className="flex-row items-center gap-2 mb-2 min-w-0">
                  <Text
                    className="text-[11.5px] font-medium text-stone-400 flex-shrink"
                    numberOfLines={1}
                  >
                    {[
                      formatEditionDate(prevArticle.date, 'short'),
                      getSourceLabel(prevArticle),
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                </View>
                <Text
                  className="font-bold text-ink tracking-[-0.35px] mb-2.5 consumer-display"
                  style={{
                    fontSize: Math.round(20.5 * fontScale * 10) / 10,
                    lineHeight: Math.round(26 * fontScale * 10) / 10,
                  }}
                  numberOfLines={3}
                >
                  {prevArticle.ai_headline}
                </Text>
                <ArticleSummaryPoints
                  article={prevArticle}
                  fontScale={fontScale}
                />
              </View>
            </>
          )}
        </View>
      </Animated.View>
    </>
  ) : null;

  const handleCardContainerLayout = useCallback(
    (layoutHeight: number) => {
      if (layoutHeight <= 0) return;
      const oldOffscreen = -(cardHeightSV.value + 120);
      const nextOffscreen = -Math.max(layoutHeight + 120, height + 200);
      cardHeightSV.value = layoutHeight;
      if (
        !isPullingPrev.value &&
        !isAnimating.value &&
        prevTranslateY.value <= oldOffscreen + 8
      ) {
        prevTranslateY.value = nextOffscreen;
      }
    },
    [cardHeightSV, height, isAnimating, isPullingPrev, prevTranslateY]
  );

  if (!currentArticle) {
    const displaySavedCount = savedCount ?? savedArticlesList.length;
    const streakLine =
      !activeTopic && streakDays && streakDays > 0
        ? formatStreakLine(streakDays)
        : null;
    const subtitleText = activeTopic
      ? activeTopic === 'Saved for later'
        ? 'You’ve finished your saved stories.'
        : `You’ve read all stories in ${activeTopic}.`
      : (nextEditionText ?? 'You’ve caught up on older stories.');

    return (
      <View
        style={{
          flex: 1,
          paddingLeft: 20,
          paddingRight: 20,
          paddingTop: 22,
          paddingBottom: 20,
          alignItems: 'center',
        }}
      >
        <View
          onLayout={(e) => handleCardContainerLayout(e.nativeEvent.layout.height)}
          style={{
            flex: 1,
            width: '100%',
            maxWidth: 420,
            position: 'relative',
          }}
        >
          <GestureDetector gesture={caughtUpPanGesture}>
            <Animated.View
              style={[
                activeCardStyle,
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 26,
                  backgroundColor: '#FFFFFF',
                  borderWidth: Platform.OS === 'web' ? 0 : 1,
                  borderColor: 'rgba(28, 25, 23, 0.08)',
                  boxShadow:
                    '0 10px 26px -4px rgba(28, 25, 23, 0.18), 0 2px 6px rgba(28, 25, 23, 0.08), 0 0 0 1px rgba(28, 25, 23, 0.08)',
                  shadowColor: '#1C1917',
                  shadowOpacity: 0.1,
                  shadowRadius: 24,
                  shadowOffset: { width: 0, height: 10 },
                  padding: 28,
                  justifyContent: 'space-between',
                  ...(Platform.OS === 'web'
                    ? ({
                        touchAction: 'none',
                        userSelect: 'none',
                      } as Record<string, unknown>)
                    : {}),
                },
              ]}
            >
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingTop: 8,
                    paddingBottom: 16,
                  }}
                >
                  <Animated.View
                    entering={ZoomIn.springify().damping(14).stiffness(180)}
                    style={{
                      width: 92,
                      height: 92,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 14,
                      position: 'relative',
                    }}
                  >
                    {/* Subtle geometric celebration confetti */}
                    <View
                      style={{
                        position: 'absolute',
                        top: 6,
                        left: 14,
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        backgroundColor: '#2DD4BF',
                        opacity: 0.85,
                      }}
                    />
                    <View
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        width: 6,
                        height: 6,
                        borderRadius: 2,
                        backgroundColor: '#F59E0B',
                        transform: [{ rotate: '25deg' }],
                        opacity: 0.85,
                      }}
                    />
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 12,
                        left: 8,
                        width: 6,
                        height: 6,
                        borderRadius: 2,
                        backgroundColor: '#F59E0B',
                        transform: [{ rotate: '-20deg' }],
                        opacity: 0.75,
                      }}
                    />
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 14,
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        backgroundColor: '#0D9488',
                        opacity: 0.7,
                      }}
                    />
                    <View
                      style={{
                        position: 'absolute',
                        top: 38,
                        right: 2,
                        width: 5,
                        height: 5,
                        borderRadius: 999,
                        backgroundColor: '#34D399',
                        opacity: 0.8,
                      }}
                    />
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 999,
                        backgroundColor: '#F0FDFA',
                        borderWidth: 1.5,
                        borderColor: 'rgba(13, 148, 136, 0.18)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 999,
                          backgroundColor: '#CCFBF1',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 21,
                            fontWeight: '700',
                            color: '#0F766E',
                          }}
                        >
                          ✓
                        </Text>
                      </View>
                    </View>
                  </Animated.View>

                  <Text className="text-[24px] font-bold text-ink text-center tracking-[-0.4px] mb-2 consumer-display">
                    You&apos;re all caught up
                  </Text>
                  {streakLine ? (
                    <Text
                      className="text-[15px] leading-[22px] font-semibold text-center max-w-[270px]"
                      style={{ color: '#0F766E' }}
                    >
                      {streakLine}
                    </Text>
                  ) : null}
                  {subtitleText ? (
                    <Text
                      className="text-[14.5px] leading-[21px] text-stone-500 text-center max-w-[270px]"
                      style={streakLine ? { marginTop: 4 } : undefined}
                    >
                      {subtitleText}
                    </Text>
                  ) : null}
                </View>

                {(displaySavedCount > 0 && onOpenSavedForLater) ||
                onRequestOlderNews ? (
                  <View
                    style={{
                      alignItems: 'center',
                      gap: 12,
                      paddingBottom: 20,
                    }}
                  >
                    {displaySavedCount > 0 && onOpenSavedForLater ? (
                      <Pressable
                        onPress={onOpenSavedForLater}
                        accessibilityLabel={`Open saved for later (${displaySavedCount})`}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          paddingHorizontal: 18,
                          paddingVertical: 10,
                          borderRadius: 999,
                          backgroundColor: '#F0FDFA',
                          borderWidth: 1,
                          borderColor: 'rgba(13, 148, 136, 0.22)',
                          opacity: pressed ? 0.78 : 1,
                          transform: [{ scale: pressed ? 0.97 : 1 }],
                          ...(Platform.OS === 'web'
                            ? ({ cursor: 'pointer' } as Record<string, unknown>)
                            : {}),
                        })}
                      >
                        <BookmarkIcon filled color="#0D9488" size={14} />
                        <Text className="text-[14px] font-semibold text-accent">
                          Open saved for later ({displaySavedCount})
                        </Text>
                      </Pressable>
                    ) : null}

                    {onRequestOlderNews ? (
                      <Text className="text-[13px] font-medium text-stone-400 text-center">
                        Swipe to read older news
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View className="pt-5 border-t border-stone-100 items-center w-full">
                {feedbackStep === 'idle' ? (
                  <>
                    <Text className="text-[15px] font-medium text-ink text-center mb-4">
                      Did you enjoy reading today?
                    </Text>
                    <View className="flex-row items-center justify-center gap-5">
                      {FEEDBACK_EMOJIS.map((item) => (
                        <Pressable
                          key={item.emoji}
                          onPress={() => void handleSelectEmoji(item.emoji)}
                          accessibilityLabel={item.label}
                          className="w-12 h-12 rounded-full bg-[#F5F4F0] items-center justify-center active:scale-95 active:opacity-75"
                        >
                          <Text className="text-[24px]">{item.emoji}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : feedbackStep === 'note' ? (
                  <View className="w-full">
                    <Text className="text-[14.5px] font-medium text-ink text-center mb-3">
                      Thanks! Add another line?
                    </Text>
                    <TextInput
                      ref={noteInputRef}
                      value={noteText}
                      onChangeText={setNoteText}
                      placeholder="Write a quick note..."
                      placeholderTextColor="#A8A29E"
                      autoFocus
                      multiline
                      className="w-full bg-[#F5F4F0] border border-stone-200 rounded-2xl px-3.5 py-2.5 text-[14.5px] text-ink min-h-[72px] mb-3"
                    />
                    <View className="flex-row items-center justify-end gap-2.5">
                      <Pressable
                        onPress={handleCancelNote}
                        disabled={sendingNote}
                        className="px-4 py-2 rounded-full active:opacity-60"
                      >
                        <Text className="text-[13.5px] font-medium text-stone-500">
                          Cancel
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void handleSendNote()}
                        disabled={sendingNote}
                        className="px-5 py-2 rounded-full bg-ink active:opacity-80"
                      >
                        <Text className="text-[13.5px] font-semibold text-white">
                          {sendingNote ? 'Sending...' : 'Send'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Text className="text-[14.5px] font-medium text-accent text-center py-2">
                    Thanks for your feedback!
                  </Text>
                )}
              </View>
            </Animated.View>
          </GestureDetector>
          {prevOverlay}
        </View>
      </View>
    );
  }

  const sourceLabel = getSourceLabel(currentArticle);
  const shortDate = formatEditionDate(currentArticle.date, 'short');

  return (
    <View
      style={{
        flex: 1,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: 22,
        paddingBottom: 20,
        alignItems: 'center',
      }}
    >
      {/* Full-Height Floating Card Stack */}
      <View
        onLayout={(e) => handleCardContainerLayout(e.nativeEvent.layout.height)}
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 420,
          position: 'relative',
        }}
      >
        {/* Third card peeking 12px from top */}
        {thirdArticle || onRequestOlderNews ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 1,
              borderRadius: 26,
              backgroundColor: '#EAE8E2',
              borderWidth: Platform.OS === 'web' ? 0 : 1,
              borderColor: 'rgba(28, 25, 23, 0.08)',
              transform: [{ translateY: -12 }, { scaleX: 0.88 }],
              boxShadow:
                '0 2px 8px rgba(28, 25, 23, 0.05), 0 0 0 1px rgba(28, 25, 23, 0.08)',
              shadowColor: '#1C1917',
              shadowOpacity: 0.04,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
          />
        ) : null}

        {/* Second card animated preview peeking 6px from top */}
        {nextArticle || onRequestOlderNews ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 2,
                borderRadius: 26,
                overflow: 'hidden',
                backgroundColor: '#F4F3EF',
                borderWidth: Platform.OS === 'web' ? 0 : 1,
                borderColor: 'rgba(28, 25, 23, 0.08)',
                boxShadow:
                  '0 4px 12px rgba(28, 25, 23, 0.08), 0 0 0 1px rgba(28, 25, 23, 0.08)',
                shadowColor: '#1C1917',
                shadowOpacity: 0.06,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                ...(Platform.OS === 'web'
                  ? ({
                    isolation: 'isolate',
                    WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                  } as Record<string, unknown>)
                  : {}),
              },
              nextCardStyle,
            ]}
          >
            <Animated.View style={[{ flex: 1 }, nextCardContentStyle]}>
              {nextArticle ? (
                <View
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: 175,
                    borderTopLeftRadius: 26,
                    borderTopRightRadius: 26,
                    overflow: 'hidden',
                  }}
                >
                  {showImages && nextArticle.image_url && !nextImageLoadFailed ? (
                    <Image
                      source={{ uri: nextArticle.image_url }}
                      contentFit="cover"
                      blurRadius={Platform.OS === 'web' ? 0 : 6}
                      onError={() => setNextImageLoadFailed(true)}
                      style={{
                        width: '100%',
                        height: '100%',
                        backgroundColor: '#F1EFEA',
                        borderTopLeftRadius: 26,
                        borderTopRightRadius: 26,
                      }}
                    />
                  ) : (
                    <TopicPatternBanner topic={nextArticle.topic} />
                  )}
                  {nextArticle.topic ? (() => {
                    const nextVisual = getTopicVisual(nextArticle.topic);
                    return (
                      <GlassTagPill
                        borderColor={nextVisual?.pillBorder}
                        style={{
                          position: 'absolute',
                          top: 12,
                          left: 12,
                          paddingHorizontal: 11,
                          paddingVertical: 4,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {nextVisual ? (
                          <TopicIcon
                            name={nextVisual.icon}
                            color={nextVisual.color}
                            size={12}
                          />
                        ) : null}
                        <Text className="text-[11.5px] font-medium text-white">
                          {nextArticle.topic}
                        </Text>
                      </GlassTagPill>
                    );
                  })() : null}
                </View>
              ) : null}
              {nextArticle ? (
                <View
                  style={{
                    flex: 1,
                    padding: 20,
                    overflow: 'hidden',
                  }}
                >
                  <View style={{ flexShrink: 1 }}>
                    <View className="flex-row items-center gap-2 mb-2 min-w-0">
                      <Text
                        className="text-[11.5px] font-medium text-stone-400 flex-shrink"
                        numberOfLines={1}
                      >
                        {[
                          formatEditionDate(nextArticle.date, 'short'),
                          getSourceLabel(nextArticle),
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    </View>

                    <Text
                      className="font-bold text-ink tracking-[-0.35px] mb-2.5 consumer-display"
                      style={{
                        fontSize: Math.round(20.5 * fontScale * 10) / 10,
                        lineHeight: Math.round(26 * fontScale * 10) / 10,
                      }}
                      numberOfLines={3}
                    >
                      {nextArticle.ai_headline}
                    </Text>

                    <ArticleSummaryPoints
                      article={nextArticle}
                      fontScale={fontScale}
                    />
                  </View>
                </View>
              ) : null}
            </Animated.View>
          </Animated.View>
        ) : null}

        {/* Active Swipeable & Flippable Card */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              activeCardStyle,
              {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 3,
                ...(Platform.OS === 'web'
                  ? ({
                      touchAction: 'none',
                      userSelect: 'none',
                    } as Record<string, unknown>)
                  : {}),
              },
            ]}
          >
            {/* FRONT FACE */}
            <Animated.View
              pointerEvents={isFlipped ? 'none' : 'auto'}
              style={[
                frontFaceStyle,
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 26,
                  overflow: 'hidden',
                  backgroundColor:
                    currentArticle.id === '__ftue_welcome__'
                      ? '#fefaef'
                      : '#FFFFFF',
                  borderWidth: Platform.OS === 'web' ? 0 : 1,
                  borderColor: 'rgba(28, 25, 23, 0.08)',
                  boxShadow:
                    '0 10px 26px -4px rgba(28, 25, 23, 0.18), 0 2px 6px rgba(28, 25, 23, 0.08), 0 0 0 1px rgba(28, 25, 23, 0.08)',
                  shadowColor: '#1C1917',
                  shadowOpacity: 0.1,
                  shadowRadius: 24,
                  shadowOffset: { width: 0, height: 10 },
                },
              ]}
            >
              {currentArticle.id === '__ftue_welcome__' ? (
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 28,
                  }}
                >
                  <Image
                    source={require('../../../assets/images/snappylit-logo-v2.png')}
                    contentFit="contain"
                    style={{ width: 96, height: 96, marginBottom: 20 }}
                  />
                  <Text className="text-[22px] font-bold text-ink text-center tracking-[-0.35px] mb-2 consumer-display">
                    Welcome curious reader!
                  </Text>
                  <Text className="text-[15px] leading-[22px] text-stone-600 text-center">
                    Swipe to start reading
                  </Text>
                </View>
              ) : (
                <>
                  <View
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: imageTier === 0 ? 175 : imageTier === 1 ? 88 : 44,
                    }}
                  >
                    <GestureDetector gesture={imageTapGesture}>
                      <View style={{ width: '100%', height: '100%' }}>
                        {showImages &&
                          currentArticle.image_url &&
                          !imageLoadFailed ? (
                          <Image
                            source={{ uri: currentArticle.image_url }}
                            contentFit="cover"
                            transition={180}
                            onError={() => setImageLoadFailed(true)}
                            style={{
                              width: '100%',
                              height: '100%',
                              backgroundColor: '#F1EFEA',
                            }}
                          />
                        ) : (
                          <TopicPatternBanner topic={currentArticle.topic} />
                        )}
                      </View>
                    </GestureDetector>
                    {activeTopic ? (() => {
                      const activeVisual = getTopicVisual(activeTopic);
                      return (
                        <GlassTagPill
                          borderColor={activeVisual?.pillBorder}
                          interactive
                          style={{
                            position: 'absolute',
                            top: 12,
                            left: 12,
                            right: 12,
                            zIndex: 10,
                            paddingLeft: 14,
                            paddingRight: 8,
                            paddingVertical: 5,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              flexShrink: 1,
                            }}
                          >
                            {activeVisual ? (
                              <TopicIcon
                                name={activeVisual.icon}
                                color={activeVisual.color}
                                size={12}
                              />
                            ) : null}
                            <Text
                              className="text-[12px] font-medium text-white flex-shrink"
                              numberOfLines={1}
                            >
                              {activeTopic} ({Math.min(currentIndex + 1, articles.length)}/
                              {articles.length})
                            </Text>
                          </View>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation?.();
                              onClearTopic?.();
                            }}
                            accessibilityLabel="Clear topic filter"
                            hitSlop={8}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 999,
                              backgroundColor: 'rgba(255, 255, 255, 0.22)',
                              borderWidth: 1,
                              borderColor: 'rgba(255, 255, 255, 0.2)',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text className="text-[11px] font-bold text-white leading-none">
                              ✕
                            </Text>
                          </Pressable>
                        </GlassTagPill>
                      );
                    })() : (() => {
                      const cardTags = getArticleTags(currentArticle);
                      if (cardTags.length === 0) return null;
                      return (
                        <View
                          style={{
                            position: 'absolute',
                            top: 12,
                            left: 12,
                            right: 12,
                            zIndex: 10,
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {cardTags.map((tag, tagIdx) => {
                            const tagVisual = tagIdx === 0 ? getTopicVisual(tag) : null;
                            return (
                              <Pressable
                                key={tag}
                                onPress={(e) => {
                                  e.stopPropagation?.();
                                  onSelectTopic?.(tag);
                                }}
                                accessibilityLabel={`Filter by ${tag}`}
                                hitSlop={4}
                                style={({ pressed }) => ({
                                  opacity: pressed ? 0.78 : 1,
                                  transform: [{ scale: pressed ? 0.96 : 1 }],
                                  ...(Platform.OS === 'web'
                                    ? ({ cursor: 'pointer' } as Record<string, unknown>)
                                    : {}),
                                })}
                              >
                                <GlassTagPill
                                  primary={tagIdx === 0}
                                  borderColor={tagVisual?.pillBorder}
                                  interactive
                                  style={{
                                    paddingLeft: tagIdx === 0 ? 11 : 9,
                                    paddingRight: tagIdx === 0 ? 9 : 8,
                                    paddingVertical: 4,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 5,
                                  }}
                                >
                                  {tagVisual ? (
                                    <TopicIcon
                                      name={tagVisual.icon}
                                      color={tagVisual.color}
                                      size={12}
                                    />
                                  ) : null}
                                  <Text className="text-[11.5px] font-medium text-white">
                                    {tag}
                                  </Text>
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      lineHeight: 13,
                                      fontWeight: '600',
                                      color: 'rgba(255, 255, 255, 0.68)',
                                      marginLeft: -1,
                                    }}
                                  >
                                    ›
                                  </Text>
                                </GlassTagPill>
                              </Pressable>
                            );
                          })}
                        </View>
                      );
                    })()}
                  </View>

                  <GestureDetector gesture={bodyTapGesture}>
                    <View
                      onLayout={(e) => {
                        textAreaHeightRef.current = e.nativeEvent.layout.height - 40;
                        checkTextOverflow();
                      }}
                      style={{
                        flex: 1,
                        padding: 20,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        onLayout={(e) => {
                          textContentHeightRef.current = e.nativeEvent.layout.height;
                          checkTextOverflow();
                        }}
                      >
                        {/* Eyebrow: Date, Source */}
                        {shortDate || sourceLabel ? (
                          <View className="flex-row items-center gap-2 mb-2 min-w-0">
                            <Text
                              className="text-[11.5px] font-medium text-stone-400 flex-shrink"
                              numberOfLines={1}
                            >
                              {[shortDate, sourceLabel].filter(Boolean).join(', ')}
                            </Text>
                          </View>
                        ) : null}

                        {/* Headline */}
                        <Text
                          className="font-bold text-ink tracking-[-0.35px] mb-2.5 consumer-display"
                          style={{
                            fontSize: Math.round(20.5 * fontScale * 10) / 10,
                            lineHeight: Math.round(26 * fontScale * 10) / 10,
                          }}
                          numberOfLines={3}
                        >
                          {currentArticle.ai_headline}
                        </Text>

                        {/* Summary: Visual chunking (punchy points + anchor word highlights + focus-assisted fade-in) */}
                        <Animated.View style={summaryFocusStyle}>
                          <ArticleSummaryPoints
                            article={currentArticle}
                            fontScale={fontScale}
                          />
                        </Animated.View>
                      </View>
                    </View>
                  </GestureDetector>

                  {/* Card Front Footer: Dislike (left) + Save for later / Like (right) */}
                  <View
                    style={{
                      paddingHorizontal: 20,
                      paddingBottom: 14,
                      paddingTop: 8,
                      borderTopWidth: 1,
                      borderTopColor: 'rgba(28, 25, 23, 0.06)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    {(() => {
                      const currentVote = effectiveArticleVotes[currentArticle.id];
                      const isLiked = currentVote === 'like';
                      const isDisliked = currentVote === 'dislike';
                      const isSaved = Boolean(
                        effectiveSavedIds[currentArticle.id]
                      );
                      return (
                        <>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation?.();
                              void handleArticleVote(currentArticle, 'dislike');
                            }}
                            accessibilityLabel="Dislike this story"
                            accessibilityState={{ selected: isDisliked }}
                            hitSlop={10}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 999,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: isDisliked ? '#FEF2F2' : '#F5F5F4',
                              borderWidth: 1,
                              borderColor: isDisliked
                                ? 'rgba(220, 38, 38, 0.4)'
                                : 'rgba(28, 25, 23, 0.08)',
                              ...(Platform.OS === 'web'
                                ? ({ cursor: 'pointer' } as Record<string, unknown>)
                                : {}),
                            }}
                          >
                            <ThumbIcon
                              direction="down"
                              filled={isDisliked}
                              color={isDisliked ? '#DC2626' : '#78716C'}
                              size={15}
                            />
                          </Pressable>
                          <View className="flex-row items-center gap-2">
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation?.();
                                handleToggleSave(currentArticle);
                              }}
                              accessibilityLabel={
                                isSaved
                                  ? 'Remove from saved for later'
                                  : 'Save story for later'
                              }
                              accessibilityState={{ selected: isSaved }}
                              hitSlop={10}
                              style={{
                                height: 34,
                                paddingHorizontal: isSaved ? 11 : 9,
                                borderRadius: 999,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                                backgroundColor: isSaved ? '#F0FDFA' : '#F5F5F4',
                                borderWidth: 1,
                                borderColor: isSaved
                                  ? 'rgba(13, 148, 136, 0.45)'
                                  : 'rgba(28, 25, 23, 0.08)',
                                ...(Platform.OS === 'web'
                                  ? ({ cursor: 'pointer' } as Record<string, unknown>)
                                  : {}),
                              }}
                            >
                              <BookmarkIcon
                                filled={isSaved}
                                color={isSaved ? '#0D9488' : '#78716C'}
                                size={14}
                              />
                              {isSaved ? (
                                <Text className="text-[11px] font-semibold text-accent">
                                  Saved
                                </Text>
                              ) : null}
                            </Pressable>
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation?.();
                                void handleArticleVote(currentArticle, 'like');
                              }}
                              accessibilityLabel="Like this story"
                              accessibilityState={{ selected: isLiked }}
                              hitSlop={10}
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 999,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isLiked ? '#ECFDF5' : '#F5F5F4',
                                borderWidth: 1,
                                borderColor: isLiked
                                  ? 'rgba(13, 148, 136, 0.45)'
                                  : 'rgba(28, 25, 23, 0.08)',
                                ...(Platform.OS === 'web'
                                  ? ({ cursor: 'pointer' } as Record<string, unknown>)
                                  : {}),
                              }}
                            >
                              <ThumbIcon
                                direction="up"
                                filled={isLiked}
                                color={isLiked ? '#0D9488' : '#78716C'}
                                size={15}
                              />
                            </Pressable>
                          </View>
                        </>
                      );
                    })()}
                  </View>

                  {showOnboardingTips &&
                    currentIndex === 1 &&
                    !isFlipped &&
                    !flipTipDismissed ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        bottom: 66,
                        left: 20,
                        right: 20,
                        alignItems: 'center',
                        zIndex: 15,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: '#fefaef',
                          borderRadius: 999,
                          paddingHorizontal: 14,
                          paddingVertical: 7,
                          borderWidth: 1,
                          borderColor: 'rgba(28, 25, 23, 0.14)',
                          boxShadow: '0 6px 16px rgba(28, 25, 23, 0.14)',
                        }}
                      >
                        <Text className="text-[13px] font-medium text-ink">
                          👆 Tap to flip cards
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {showOnboardingTips &&
                    currentIndex === 2 &&
                    !activeTopic &&
                    currentArticle.topic &&
                    !isFlipped &&
                    !topicTipDismissed ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        top: !showImages || currentArticle.image_url ? 42 : 44,
                        left: 14,
                        zIndex: 15,
                        alignItems: 'flex-start',
                      }}
                    >
                      <View
                        style={{
                          marginLeft: 14,
                          width: 0,
                          height: 0,
                          borderLeftWidth: 7,
                          borderRightWidth: 7,
                          borderBottomWidth: 8,
                          borderLeftColor: 'transparent',
                          borderRightColor: 'transparent',
                          borderBottomColor: '#fefaef',
                        }}
                      />
                      <View
                        style={{
                          backgroundColor: '#fefaef',
                          borderRadius: 14,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderWidth: 1,
                          borderColor: 'rgba(28, 25, 23, 0.14)',
                          boxShadow: '0 6px 16px rgba(28, 25, 23, 0.16)',
                        }}
                      >
                        <Text className="text-[12.5px] font-medium text-ink">
                          Tap here to focus on a subject
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </>
              )}
            </Animated.View>

            {/* BACK FACE (Why it matters + Was it helpful? + Read Source) */}
            <Animated.View
              pointerEvents={isFlipped ? 'auto' : 'none'}
              style={[
                backFaceStyle,
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 26,
                  overflow: 'hidden',
                  backgroundColor: '#FAF9F6',
                  borderWidth: Platform.OS === 'web' ? 0 : 1,
                  borderColor: 'rgba(28, 25, 23, 0.08)',
                  boxShadow:
                    '0 10px 26px -4px rgba(28, 25, 23, 0.18), 0 2px 6px rgba(28, 25, 23, 0.08), 0 0 0 1px rgba(28, 25, 23, 0.08)',
                  shadowColor: '#1C1917',
                  shadowOpacity: 0.1,
                  shadowRadius: 24,
                  shadowOffset: { width: 0, height: 10 },
                  padding: 22,
                  justifyContent: 'space-between',
                },
              ]}
            >
              <View style={{ flex: 1, minHeight: 0 }}>
                <View className="flex-row items-center justify-between gap-2 mb-4">
                  <Pressable onPress={toggleFlip} className="active:opacity-70">
                    <Text
                      className="font-bold text-ink consumer-display"
                      style={{
                        fontSize: Math.round(17.5 * fontScale * 10) / 10,
                      }}
                    >
                      💡 Why it matters
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openArticleUrl(currentArticle.original_url)}
                    hitSlop={8}
                    className="py-1 active:opacity-60"
                  >
                    <Text className="text-[13px] font-normal text-accent">
                      Read source ↗
                    </Text>
                  </Pressable>
                </View>

                <ScrollView
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ flexGrow: 1, paddingBottom: 12 }}
                >
                  <Pressable onPress={toggleFlip} style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: Math.round(15.5 * fontScale * 10) / 10,
                        lineHeight: Math.round(24 * fontScale * 10) / 10,
                        color: '#44403C',
                      }}
                    >
                      {currentArticle.ai_explanation ||
                        'Tap to return to the story.'}
                    </Text>
                  </Pressable>
                </ScrollView>
              </View>

              <View className="gap-4">
                {/* Was it helpful? */}
                <View className="pt-3.5 border-t border-stone-200/80">
                  {(() => {
                    const contextFeedback =
                      contextFeedbackByArticle[currentArticle.id];
                    if (contextFeedback?.step === 'note') {
                      return (
                        <View className="w-full">
                          <Text className="text-[13px] font-medium text-ink mb-2">
                            Thanks! Add another line?
                          </Text>
                          <TextInput
                            ref={contextNoteInputRef}
                            value={contextNoteText}
                            onChangeText={setContextNoteText}
                            placeholder="Write a quick note..."
                            placeholderTextColor="#A8A29E"
                            multiline
                            className="w-full bg-[#F5F4F0] border border-stone-200 rounded-2xl px-3.5 py-2.5 text-[14px] text-ink min-h-[68px] mb-2.5"
                          />
                          <View className="flex-row items-center justify-end gap-2">
                            <Pressable
                              onPress={() =>
                                handleCancelContextNote(currentArticle.id)
                              }
                              disabled={sendingContextNote}
                              className="px-3.5 py-1.5 rounded-full active:opacity-60"
                            >
                              <Text className="text-[13px] font-medium text-stone-500">
                                Cancel
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() =>
                                void handleSendContextNote(currentArticle.id)
                              }
                              disabled={sendingContextNote}
                              className="px-4 py-1.5 rounded-full bg-ink active:opacity-80"
                            >
                              <Text className="text-[13px] font-semibold text-white">
                                {sendingContextNote ? 'Sending...' : 'Send'}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    }

                    return (
                      <>
                        <Text className="text-[13px] font-medium text-stone-500 mb-2.5">
                          Was it helpful?
                        </Text>
                        {contextFeedback ? (
                          <Text className="text-[13px] font-medium text-accent">
                            Thanks for your feedback! (
                            {contextFeedback.sentiment === 'helpful'
                              ? '😊 Yes, thanks'
                              : '😞 Not really'}
                            )
                          </Text>
                        ) : (
                          <View className="flex-row flex-wrap items-center gap-2">
                            <Pressable
                              onPress={() =>
                                void handleContextFeedback(
                                  currentArticle,
                                  'helpful'
                                )
                              }
                              className="px-3.5 py-2 rounded-full bg-white border border-stone-200 active:opacity-70"
                            >
                              <Text className="text-[13px] font-medium text-ink">
                                😊 Yes, thanks
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() =>
                                void handleContextFeedback(
                                  currentArticle,
                                  'not_helpful'
                                )
                              }
                              className="px-3.5 py-2 rounded-full bg-white border border-stone-200 active:opacity-70"
                            >
                              <Text className="text-[13px] font-medium text-ink">
                                😞 Not really
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      </>
                    );
                  })()}
                </View>
              </View>
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        {/* Previous (older) card pulled down from above when dragging downward */}
        {prevOverlay}
      </View>
    </View>
  );
}
