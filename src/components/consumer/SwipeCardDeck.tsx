import { getTopicVisual } from '@/config/topicConfig';
import { Fonts, getNewsFontStyle } from '@/constants/theme';
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
import { Image } from 'expo-image';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import {
  memo,
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
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { BookmarkIcon } from './BookmarkIcon';
import { ThumbIcon } from './ThumbIcon';
import { CoverPatternArt, TopicPatternBanner } from './TopicPatternBanner';

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
  damping: 24,
  stiffness: 360,
  mass: 0.75,
};

const EXIT_EASING = Easing.out(Easing.cubic);

function scaleFont(baseSize: number, fontScale: number): number {
  return Math.round(baseSize * fontScale * 10) / 10;
}

function ArticleSummaryPoints({
  article,
  fontScale,
  compact = false,
}: {
  article: Article;
  fontScale: number;
  compact?: boolean;
}) {
  const points = splitSummaryIntoPoints(article.ai_summary);
  const sansStyle = Fonts?.sans
    ? ({ fontFamily: Fonts.sans } as Record<string, unknown>)
    : {};
  const sectionLabelSize = scaleFont(13.5, fontScale);
  const sectionLabelLine = scaleFont(compact ? 17 : 18, fontScale);
  const leadFontSize = scaleFont(15, fontScale);
  const leadLineHeight = scaleFont(compact ? 20.5 : 22, fontScale);
  const bulletFontSize = scaleFont(14.5, fontScale);
  const bulletLineHeight = scaleFont(compact ? 19.5 : 21, fontScale);

  const leadText = (points[0] ?? article.ai_summary ?? '').trim();
  const keyPoints = points.slice(1);

  if (!leadText) return null;

  return (
    <View>
      <Text
        style={{
          ...sansStyle,
          fontSize: sectionLabelSize,
          lineHeight: sectionLabelLine,
          fontWeight: '700',
          color: '#1C1917',
          marginBottom: Math.round((compact ? 3 : 4) * fontScale),
        }}
      >
        What happened
      </Text>
      <Text
        style={{
          ...getNewsFontStyle('400'),
          fontSize: leadFontSize,
          lineHeight: leadLineHeight,
          color: '#44403C',
        }}
      >
        {leadText}
      </Text>

      {keyPoints.length > 0 ? (
        <View
          style={{
            marginTop: Math.round((compact ? 9 : 13) * fontScale),
          }}
        >
          <Text
            style={{
              ...sansStyle,
              fontSize: sectionLabelSize,
              lineHeight: sectionLabelLine,
              fontWeight: '700',
              color: '#1C1917',
              marginBottom: Math.round((compact ? 4 : 6) * fontScale),
            }}
          >
            Key developments
          </Text>
          <View style={{ gap: Math.round((compact ? 4.5 : 6) * fontScale) }}>
            {keyPoints.map((point, ptIdx) => (
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
                    width: 4,
                    height: 4,
                    borderRadius: 999,
                    backgroundColor: '#78716C',
                    marginTop: Math.round(bulletLineHeight * 0.43),
                  }}
                />
                <Text
                  style={{
                    flex: 1,
                    ...getNewsFontStyle('400'),
                    fontSize: bulletFontSize,
                    lineHeight: bulletLineHeight,
                    color: '#44403C',
                  }}
                >
                  {point}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Shared editorial card body used across active, next-peek, and previous-pull cards
 * so transitions never shift typography or metadata placement.
 */
function EditorialCardContent({
  article,
  fontScale,
  compact = false,
  activeTopic,
  activePositionLabel,
  onSelectTopic,
  onClearTopic,
  onPressWhyItMatters,
  wrapSummary,
}: {
  article: Article;
  fontScale: number;
  compact?: boolean;
  activeTopic?: string | null;
  activePositionLabel?: string;
  onSelectTopic?: (topic: string) => void;
  onClearTopic?: () => void;
  onPressWhyItMatters?: () => void;
  wrapSummary?: (node: ReactNode) => ReactNode;
}) {
  const sansStyle = Fonts?.sans
    ? ({ fontFamily: Fonts.sans } as Record<string, unknown>)
    : {};
  const cardTags = getArticleTags(article);
  const shortDate = formatEditionDate(article.date, 'short');
  const sourceLabel = getSourceLabel(article);
  const metaLine = [shortDate, sourceLabel]
    .filter(Boolean)
    .map((part) => String(part).toUpperCase())
    .join(' · ');
  const kickerFontSize = scaleFont(11, fontScale);
  const summaryNode = (
    <ArticleSummaryPoints
      article={article}
      fontScale={fontScale}
      compact={compact}
    />
  );

  return (
    <View
      style={{
        flexGrow: 1,
        justifyContent: 'space-between',
      }}
    >
      <View>
        {/* Editorial Uppercase Topic Metadata Line */}
        {activeTopic ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              marginBottom: Math.round((compact ? 5 : 7) * fontScale),
            }}
          >
            <Text
              style={{
                ...sansStyle,
                flexShrink: 1,
                fontSize: kickerFontSize,
                fontWeight: '600',
                letterSpacing: 0.85,
                color: '#78716C',
              }}
              numberOfLines={1}
            >
              {activeTopic.toUpperCase()}
              {activePositionLabel ? ` · ${activePositionLabel}` : ''}
            </Text>
            {onClearTopic ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  onClearTopic();
                }}
                accessibilityLabel="Clear topic filter"
                hitSlop={8}
                style={{
                  ...(Platform.OS === 'web'
                    ? ({ cursor: 'pointer' } as Record<string, unknown>)
                    : {}),
                }}
              >
                <Text
                  style={{
                    ...sansStyle,
                    fontSize: kickerFontSize,
                    fontWeight: '600',
                    color: '#57534E',
                  }}
                >
                  Clear ✕
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : cardTags.length > 0 ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: Math.round((compact ? 5 : 7) * fontScale),
            }}
          >
            {cardTags.map((tag, tagIdx) => {
              const label = (
                <Text
                  style={{
                    ...sansStyle,
                    fontSize: kickerFontSize,
                    fontWeight: '600',
                    letterSpacing: 0.85,
                    color: '#78716C',
                  }}
                >
                  {tag.toUpperCase()}
                </Text>
              );
              return (
                <View
                  key={tag}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  {tagIdx > 0 ? (
                    <Text
                      style={{
                        ...sansStyle,
                        fontSize: kickerFontSize,
                        fontWeight: '600',
                        color: '#A8A29E',
                        marginHorizontal: 5,
                      }}
                    >
                      ·
                    </Text>
                  ) : null}
                  {onSelectTopic ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        onSelectTopic(tag);
                      }}
                      accessibilityLabel={`Filter by ${tag}`}
                      hitSlop={4}
                      style={{
                        ...(Platform.OS === 'web'
                          ? ({ cursor: 'pointer' } as Record<string, unknown>)
                          : {}),
                      }}
                    >
                      {label}
                    </Pressable>
                  ) : (
                    label
                  )}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Headline */}
        <Text
          className="text-ink tracking-[-0.35px]"
          style={{
            ...getNewsFontStyle('700'),
            fontSize: scaleFont(compact ? 19.5 : 21, fontScale),
            lineHeight: scaleFont(compact ? 25 : 27, fontScale),
          }}
        >
          {article.ai_headline}
        </Text>

        {/* Date · Source underneath headline with clean vertical space */}
        {metaLine ? (
          <Text
            style={{
              ...sansStyle,
              fontSize: kickerFontSize,
              fontWeight: '500',
              letterSpacing: 0.6,
              color: '#A8A29E',
              marginTop: Math.round((compact ? 5 : 7) * fontScale),
              marginBottom: Math.round((compact ? 11 : 16) * fontScale),
            }}
            numberOfLines={1}
          >
            {metaLine}
          </Text>
        ) : (
          <View style={{ height: Math.round((compact ? 10 : 14) * fontScale) }} />
        )}

        {/* Two-part scannable summary */}
        {wrapSummary ? wrapSummary(summaryNode) : summaryNode}
      </View>

      {/* Bottom card utility: Why it matters */}
      <View
        style={{
          marginTop: Math.round((compact ? 10 : 14) * fontScale),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        {onPressWhyItMatters ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onPressWhyItMatters();
            }}
            accessibilityLabel="Flip card to see why it matters"
            hitSlop={8}
            className="active:opacity-60"
            style={{
              ...(Platform.OS === 'web'
                ? ({ cursor: 'pointer' } as Record<string, unknown>)
                : {}),
            }}
          >
            <Text
              style={{
                ...sansStyle,
                fontSize: scaleFont(12.5, fontScale),
                fontWeight: '500',
                color: '#78716C',
              }}
            >
              Why it matters ↻
            </Text>
          </Pressable>
        ) : (
          <Text
            style={{
              ...sansStyle,
              fontSize: scaleFont(12.5, fontScale),
              fontWeight: '500',
              color: '#78716C',
            }}
          >
            Why it matters ↻
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * Calm opening cover card for Today's Edition that anchors the date, finite swipe count,
 * and anti-doomscrolling boundary before entering the headlines.
 */
interface EditionCoverMeta {
  storyCount: number;
  readMinutes: number;
  topics: string[];
  editedAgoText: string | null;
}

/**
 * Calm pastel opening cover card for Today's Edition showing a readable date,
 * time estimate, anti-doomscrolling boundary, prominent swipe-up cue, and editor credit.
 */
function EditionCoverContent({
  article,
  editionMeta,
  fontScale,
  compact = false,
  onStart,
}: {
  article: Article;
  editionMeta: EditionCoverMeta;
  fontScale: number;
  compact?: boolean;
  onStart?: () => void;
}) {
  const sansStyle = Fonts?.sans
    ? ({ fontFamily: Fonts.sans } as Record<string, unknown>)
    : {};
  const fullDate = formatEditionDate(article.date, 'full');
  const { storyCount, readMinutes, editedAgoText } = editionMeta;
  const estimateLine = `${storyCount} ${storyCount === 1 ? 'story' : 'stories'} today. About ${readMinutes} ${readMinutes === 1 ? 'minute' : 'minutes'}.`;
  const editorCredit = editedAgoText
    ? `Today's News Edited by Tushar Roy, ${editedAgoText}`
    : "Today's News Edited by Tushar Roy";

  const swipeCueContent = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#1C1917',
        paddingVertical: compact ? 13 : 15,
        paddingHorizontal: compact ? 24 : 28,
        borderRadius: 999,
        shadowColor: '#1C1917',
        shadowOpacity: 0.16,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      }}
    >
      <Text
        style={{
          ...sansStyle,
          fontSize: scaleFont(17, fontScale),
          fontWeight: '700',
          color: '#FAF9F6',
          lineHeight: scaleFont(20, fontScale),
        }}
      >
        ↑
      </Text>
      <Text
        style={{
          ...sansStyle,
          fontSize: scaleFont(16, fontScale),
          fontWeight: '600',
          color: '#FAF9F6',
          letterSpacing: -0.1,
        }}
      >
        Swipe up to read
      </Text>
    </View>
  );

  return (
    <View
      style={{
        flex: 1,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: compact ? 22 : 26,
        paddingTop: compact ? 44 : 58,
        paddingBottom: compact ? 28 : 38,
      }}
    >
      <CoverPatternArt />

      {/* High-contrast Readable Date + Greeting + Time Estimate */}
      <View style={{ alignItems: 'center', width: '100%', maxWidth: 320 }}>
        {fullDate ? (
          <Text
            style={{
              ...sansStyle,
              fontSize: scaleFont(14, fontScale),
              fontWeight: '600',
              letterSpacing: 0.1,
              color: '#292524',
              textAlign: 'center',
              marginBottom: Math.round(12 * fontScale),
            }}
          >
            {fullDate}
          </Text>
        ) : null}

        <Text
          className="text-ink text-center tracking-[-0.45px]"
          style={{
            ...getNewsFontStyle('700'),
            fontSize: scaleFont(25.5, fontScale),
            lineHeight: scaleFont(31, fontScale),
            marginBottom: Math.round(10 * fontScale),
          }}
        >
          Welcome curious reader!
        </Text>

        {storyCount > 0 ? (
          <View style={{ alignItems: 'center' }}>
            <Text
              className="text-center"
              style={{
                ...getNewsFontStyle('500'),
                fontSize: scaleFont(15.5, fontScale),
                lineHeight: scaleFont(22, fontScale),
                color: '#57534E',
              }}
            >
              {estimateLine}
            </Text>
            <Text
              className="text-center"
              style={{
                ...getNewsFontStyle('600'),
                fontSize: scaleFont(15.5, fontScale),
                lineHeight: scaleFont(22, fontScale),
                color: '#0F766E',
                marginTop: Math.round(4 * fontScale),
              }}
            >
              No doomscrolling.
            </Text>
          </View>
        ) : (
          <Text
            className="text-center"
            style={{
              ...getNewsFontStyle('500'),
              fontSize: scaleFont(15.5, fontScale),
              lineHeight: scaleFont(22, fontScale),
              color: '#0F766E',
            }}
          >
            No doomscrolling.
          </Text>
        )}
      </View>

      {/* Center Swipe Up Cue */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        {onStart ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onStart();
            }}
            accessibilityLabel="Swipe up or tap to start today's edition"
            hitSlop={12}
            className="active:opacity-75"
            style={{
              ...(Platform.OS === 'web'
                ? ({ cursor: 'pointer' } as Record<string, unknown>)
                : {}),
            }}
          >
            {swipeCueContent}
          </Pressable>
        ) : (
          swipeCueContent
        )}
      </View>

      {/* Editor Credit Footer */}
      <View style={{ alignItems: 'center' }}>
        <Text
          style={{
            ...sansStyle,
            fontSize: scaleFont(11.5, fontScale),
            color: '#78716C',
            textAlign: 'center',
          }}
        >
          {editorCredit}
        </Text>
      </View>
    </View>
  );
}

function ArticleContextPoints({
  article,
  fontScale,
}: {
  article: Article;
  fontScale: number;
}) {
  const explanation = article.ai_explanation?.trim();
  const points = explanation ? splitSummaryIntoPoints(explanation) : [];
  const topicVisual = getTopicVisual(article.topic);
  const topicAccent = topicVisual?.color ?? '#0D9488';
  const bodyFontSize = scaleFont(15, fontScale);
  const bodyLineHeight = scaleFont(22, fontScale);

  if (points.length === 0) {
    return (
      <Text
        style={{
          ...getNewsFontStyle('400'),
          fontSize: bodyFontSize,
          lineHeight: bodyLineHeight,
          color: '#57534E',
        }}
      >
        Tap anywhere to return to the story.
      </Text>
    );
  }

  return (
    <View style={{ gap: Math.round(11 * fontScale) }}>
      {points.map((point, ptIdx) => {
        const segments = parseAnchorSegments(point);
        return (
          <View
            key={ptIdx}
            style={{
              flexDirection: 'row',
              alignItems: 'stretch',
              gap: 10,
              paddingVertical: 1,
            }}
          >
            <View
              style={{
                width: 3,
                borderRadius: 999,
                backgroundColor: topicAccent,
                opacity: ptIdx === 0 ? 0.95 : 0.42,
              }}
            />
            <Text
              style={{
                flex: 1,
                ...getNewsFontStyle('400'),
                fontSize: bodyFontSize,
                lineHeight: bodyLineHeight,
                color: '#44403C',
              }}
            >
              {segments.map((seg, segIdx) => (
                <Text
                  key={segIdx}
                  style={
                    seg.isAnchor
                      ? {
                        ...getNewsFontStyle('600'),
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

interface DeckPanSharedState {
  activeIdxSV: SharedValue<number>;
  articlesLenSV: SharedValue<number>;
  hasOlderNewsSV: SharedValue<boolean>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  prevTranslateY: SharedValue<number>;
  isAnimating: SharedValue<boolean>;
  isPullingPrev: SharedValue<boolean>;
  flipProgress: SharedValue<number>;
  isFlippedSV: SharedValue<boolean>;
  dragModeSV: SharedValue<0 | 1 | 2>;
  touchStartedInScrollSV: SharedValue<boolean>;
  activeScrollOffsetSV: SharedValue<number>;
  activeMaxScrollSV: SharedValue<number>;
  cardHeightSV: SharedValue<number>;
  windowWidthSV: SharedValue<number>;
  windowHeightSV: SharedValue<number>;
  horizontalThresholdSV: SharedValue<number>;
  verticalThresholdSV: SharedValue<number>;
  syncCurrentIndexFromWorklet: (nextIdx: number) => void;
  triggerOlderNews: () => void;
}

/**
 * Per-card memoized pan gesture bound directly to one card's root view.
 * Keeping each Pan and its simultaneous Native scroll gestures immutable for the card's
 * lifetime prevents RNGH handlerTag rebinding races (`No handler for tag N`).
 */
function useDeckCardPanGesture(
  cardIndex: number,
  panShared: DeckPanSharedState,
  frontScrollGesture?: ReturnType<typeof Gesture.Native>,
  backScrollGesture?: ReturnType<typeof Gesture.Native>
) {
  const cardIndexSV = useSharedValue(cardIndex);
  useEffect(() => {
    cardIndexSV.set(cardIndex);
  }, [cardIndex, cardIndexSV]);

  return useMemo(() => {
    const {
      activeIdxSV,
      articlesLenSV,
      hasOlderNewsSV,
      translateX,
      translateY,
      prevTranslateY,
      isAnimating,
      isPullingPrev,
      flipProgress,
      isFlippedSV,
      dragModeSV,
      touchStartedInScrollSV,
      activeScrollOffsetSV,
      activeMaxScrollSV,
      cardHeightSV,
      windowWidthSV,
      windowHeightSV,
      horizontalThresholdSV,
      verticalThresholdSV,
      syncCurrentIndexFromWorklet,
      triggerOlderNews,
    } = panShared;

    let pan = Gesture.Pan();
    if (frontScrollGesture && backScrollGesture) {
      pan = pan.simultaneousWithExternalGesture(
        frontScrollGesture,
        backScrollGesture
      );
    }

    return pan
      .minDistance(4)
      .onStart(() => {
        if (isAnimating.value || cardIndexSV.value !== activeIdxSV.value) {
          return;
        }
        isPullingPrev.set(false);
        dragModeSV.set(0);
      })
      .onUpdate((event) => {
        if (isAnimating.value || cardIndexSV.value !== activeIdxSV.value) {
          return;
        }
        const activeIdx = activeIdxSV.value;
        const isCaughtUpCard = activeIdx >= articlesLenSV.value;

        if (dragModeSV.value === 0) {
          const absX = Math.abs(event.translationX);
          const absY = Math.abs(event.translationY);
          if (absX < 4 && absY < 4) return;

          const canScrollActive =
            !isCaughtUpCard &&
            activeMaxScrollSV.value > 3 &&
            touchStartedInScrollSV.value;

          if (!canScrollActive || absX >= absY) {
            dragModeSV.set(1);
          } else if (event.translationY < 0) {
            dragModeSV.set(
              activeScrollOffsetSV.value >= activeMaxScrollSV.value - 3 ? 1 : 2
            );
          } else {
            dragModeSV.set(activeScrollOffsetSV.value <= 3 ? 1 : 2);
          }
        }

        if (dragModeSV.value === 2) {
          return;
        }

        const isDownwardPull =
          activeIdx > 0 &&
          event.translationY > 10 &&
          event.translationY > Math.abs(event.translationX);

        if (isDownwardPull) {
          if (!isPullingPrev.value) {
            isPullingPrev.set(true);
            translateX.set(withSpring(0, SPRING_CONFIG));
            translateY.set(withSpring(0, SPRING_CONFIG));
          }
          const entryStart = -cardHeightSV.value;
          prevTranslateY.set(Math.min(0, entryStart + event.translationY * 1.15));
          return;
        }

        if (isPullingPrev.value && event.translationY <= 0) {
          isPullingPrev.set(false);
          prevTranslateY.set(
            withTiming(-(cardHeightSV.value + 120), {
              duration: 150,
            })
          );
        }

        if (isPullingPrev.value) {
          const entryStart = -cardHeightSV.value;
          prevTranslateY.set(
            Math.min(0, entryStart + Math.max(0, event.translationY) * 1.15)
          );
          return;
        }

        if (isCaughtUpCard) {
          const resist = !hasOlderNewsSV.value ? 0.22 : 1;
          const draggingDownEmpty =
            articlesLenSV.value === 0 && event.translationY > 0;
          translateX.set(event.translationX * resist);
          translateY.set(
            draggingDownEmpty
              ? event.translationY * 0.22
              : event.translationY * resist
          );
          return;
        }

        const draggingDownAtStart = activeIdx === 0 && event.translationY > 0;
        translateX.set(event.translationX);
        translateY.set(
          draggingDownAtStart ? event.translationY * 0.22 : event.translationY
        );
      })
      .onEnd((event) => {
        if (cardIndexSV.value !== activeIdxSV.value) {
          return;
        }
        if (dragModeSV.value === 2) {
          dragModeSV.set(0);
          touchStartedInScrollSV.set(false);
          return;
        }
        dragModeSV.set(0);
        touchStartedInScrollSV.set(false);

        if (isAnimating.value) return;
        const activeIdx = activeIdxSV.value;
        const isCaughtUpCard = activeIdx >= articlesLenSV.value;

        if (isPullingPrev.value) {
          isPullingPrev.set(false);
          const pulledDownEnough =
            activeIdx > 0 &&
            (event.translationY > verticalThresholdSV.value ||
              event.velocityY > 340);

          if (pulledDownEnough) {
            isAnimating.set(true);
            prevTranslateY.set(
              withTiming(0, { duration: 150, easing: EXIT_EASING }, (finished) => {
                if (finished) {
                  const prevIdx = Math.max(0, activeIdxSV.value - 1);
                  activeIdxSV.set(prevIdx);
                  prevTranslateY.set(
                    -Math.max(
                      cardHeightSV.value + 120,
                      windowHeightSV.value + 200
                    )
                  );
                  isPullingPrev.set(false);
                  translateX.set(0);
                  translateY.set(0);
                  flipProgress.set(0);
                  isFlippedSV.set(false);
                  isAnimating.set(false);
                  runOnJS(syncCurrentIndexFromWorklet)(prevIdx);
                } else {
                  isAnimating.set(false);
                }
              })
            );
          } else {
            prevTranslateY.set(
              withTiming(-(cardHeightSV.value + 120), {
                duration: 140,
                easing: EXIT_EASING,
              })
            );
            translateX.set(withSpring(0, SPRING_CONFIG));
            translateY.set(withSpring(0, SPRING_CONFIG));
          }
          return;
        }

        const absX = Math.abs(event.translationX);
        const absY = Math.abs(event.translationY);
        const horizontalDominant = absX >= absY;

        const swipedDown =
          activeIdx > 0 &&
          !horizontalDominant &&
          (event.translationY > verticalThresholdSV.value ||
            event.velocityY > 340);

        if (swipedDown) {
          isAnimating.set(true);
          if (prevTranslateY.value < -cardHeightSV.value) {
            prevTranslateY.set(-cardHeightSV.value);
          }
          translateX.set(withSpring(0, SPRING_CONFIG));
          translateY.set(withSpring(0, SPRING_CONFIG));
          prevTranslateY.set(
            withTiming(0, { duration: 150, easing: EXIT_EASING }, (finished) => {
              if (finished) {
                const prevIdx = Math.max(0, activeIdxSV.value - 1);
                activeIdxSV.set(prevIdx);
                prevTranslateY.set(
                  -Math.max(
                    cardHeightSV.value + 120,
                    windowHeightSV.value + 200
                  )
                );
                isPullingPrev.set(false);
                translateX.set(0);
                translateY.set(0);
                flipProgress.set(0);
                isFlippedSV.set(false);
                isAnimating.set(false);
                runOnJS(syncCurrentIndexFromWorklet)(prevIdx);
              } else {
                isAnimating.set(false);
              }
            })
          );
          return;
        }

        const swipedRight =
          event.translationX > horizontalThresholdSV.value ||
          event.velocityX > 340;
        const swipedLeft =
          event.translationX < -horizontalThresholdSV.value ||
          event.velocityX < -340;
        const swipedUp =
          event.translationY < -verticalThresholdSV.value ||
          event.velocityY < -340;

        const isForwardSwipe =
          (horizontalDominant && (swipedRight || swipedLeft)) ||
          (!horizontalDominant && swipedUp) ||
          swipedRight ||
          swipedLeft ||
          swipedUp;

        if (isCaughtUpCard) {
          translateX.set(withSpring(0, SPRING_CONFIG));
          translateY.set(withSpring(0, SPRING_CONFIG));
          if (isForwardSwipe && hasOlderNewsSV.value) {
            runOnJS(triggerOlderNews)();
          }
          return;
        }

        if (isForwardSwipe) {
          isAnimating.set(true);
          const completeForwardSwipe = (finished?: boolean) => {
            'worklet';
            if (finished) {
              const nextIdx = Math.min(
                activeIdxSV.value + 1,
                articlesLenSV.value
              );
              activeIdxSV.set(nextIdx);
              translateX.set(0);
              translateY.set(0);
              flipProgress.set(0);
              isFlippedSV.set(false);
              isAnimating.set(false);
              runOnJS(syncCurrentIndexFromWorklet)(nextIdx);
            } else {
              isAnimating.set(false);
            }
          };

          if (
            swipedUp &&
            (!horizontalDominant || (!swipedRight && !swipedLeft))
          ) {
            translateY.set(
              withTiming(
                -windowHeightSV.value * 1.1,
                { duration: 145, easing: EXIT_EASING },
                completeForwardSwipe
              )
            );
          } else {
            const exitX =
              swipedLeft && (!swipedRight || event.translationX < 0)
                ? -windowWidthSV.value * 1.15
                : windowWidthSV.value * 1.15;
            translateX.set(
              withTiming(
                exitX,
                { duration: 135, easing: EXIT_EASING },
                completeForwardSwipe
              )
            );
          }
        } else {
          translateX.set(withSpring(0, SPRING_CONFIG));
          translateY.set(withSpring(0, SPRING_CONFIG));
        }
      })
      .onFinalize((_, success) => {
        if (cardIndexSV.value !== activeIdxSV.value) {
          return;
        }
        dragModeSV.set(0);
        touchStartedInScrollSV.set(false);
        if (!success && !isAnimating.value) {
          if (isPullingPrev.value) {
            isPullingPrev.set(false);
            prevTranslateY.set(
              withTiming(-(cardHeightSV.value + 120), {
                duration: 150,
              })
            );
          }
          translateX.set(withSpring(0, SPRING_CONFIG));
          translateY.set(withSpring(0, SPRING_CONFIG));
        }
      });
  }, [backScrollGesture, cardIndexSV, frontScrollGesture, panShared]);
}

function PanCardWrapper({
  cardIndex,
  panShared,
  children,
}: {
  cardIndex: number;
  panShared: DeckPanSharedState;
  children: ReactNode;
}) {
  const cardPanGesture = useDeckCardPanGesture(cardIndex, panShared);
  return (
    <GestureDetector gesture={cardPanGesture}>
      <View style={{ flex: 1 }}>{children}</View>
    </GestureDetector>
  );
}

/**
 * Keyed card slot whose position, scale, shadow, and opacity are driven solely on the UI thread
 * by `activeIdxSV` so swiping forward or pulling backward never flashes or unmounts mid-transition.
 */
function DeckSlotCard({
  cardIndex,
  activeIdxSV,
  translateX,
  translateY,
  prevTranslateY,
  cardHeightSV,
  width,
  isInteractive,
  children,
}: {
  cardIndex: number;
  activeIdxSV: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  prevTranslateY: SharedValue<number>;
  cardHeightSV: SharedValue<number>;
  width: number;
  isInteractive: boolean;
  children: ReactNode;
}) {
  const slotStyle = useAnimatedStyle(() => {
    const activeIdx = activeIdxSV.value;
    const offscreenY = -(cardHeightSV.value + 120);

    if (cardIndex === activeIdx) {
      const rotateDeg = interpolate(
        translateX.value,
        [-width * 0.6, 0, width * 0.6],
        [-5.5, 0, 5.5],
        Extrapolation.CLAMP
      );
      return {
        opacity: 1,
        zIndex: 4,
        elevation: 4,
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { rotate: `${rotateDeg}deg` },
          { scaleX: 1 },
        ],
      };
    }

    if (cardIndex === activeIdx - 1) {
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
      return {
        opacity: isVisible ? opacity : 0,
        zIndex: isVisible ? 10 : -1,
        elevation: isVisible ? 16 : 0,
        transform: [
          { translateX: 0 },
          { translateY: prevTranslateY.value },
          { rotate: '0deg' },
          { scaleX: scale },
        ],
      };
    }

    if (cardIndex === activeIdx + 1) {
      if (Platform.OS === 'web') {
        return {
          opacity: 0.96,
          zIndex: 2,
          elevation: 2,
          transform: [
            { translateX: 0 },
            { translateY: -6 },
            { rotate: '0deg' },
            { scaleX: 0.94 },
          ],
        };
      }
      const forwardDist = Math.max(
        0,
        Math.abs(translateX.value),
        -translateY.value
      );
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
        zIndex: 2,
        elevation: 2,
        transform: [
          { translateX: 0 },
          { translateY: offsetY },
          { rotate: '0deg' },
          { scaleX },
        ],
      };
    }

    if (cardIndex === activeIdx + 2) {
      if (Platform.OS === 'web') {
        return {
          opacity: 0.92,
          zIndex: 1,
          elevation: 1,
          transform: [
            { translateX: 0 },
            { translateY: -12 },
            { rotate: '0deg' },
            { scaleX: 0.88 },
          ],
        };
      }
      const forwardDist = Math.max(
        0,
        Math.abs(translateX.value),
        -translateY.value
      );
      const progress = interpolate(
        forwardDist,
        [0, width * 0.45],
        [0, 1],
        Extrapolation.CLAMP
      );
      const offsetY = interpolate(progress, [0, 1], [-12, -6]);
      const scaleX = interpolate(progress, [0, 1], [0.88, 0.94]);
      const opacity = interpolate(progress, [0, 1], [0.92, 0.96]);
      return {
        opacity,
        zIndex: 1,
        elevation: 1,
        transform: [
          { translateX: 0 },
          { translateY: offsetY },
          { rotate: '0deg' },
          { scaleX },
        ],
      };
    }

    return {
      opacity: 0,
      zIndex: -2,
      elevation: 0,
      transform: [
        { translateX: 0 },
        { translateY: offscreenY },
        { rotate: '0deg' },
        { scaleX: 1 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents={isInteractive ? 'auto' : 'none'}
      style={[
        slotStyle,
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          ...(Platform.OS === 'web'
            ? ({
              touchAction: 'none',
              userSelect: 'none',
              willChange: 'transform, opacity',
            } as Record<string, unknown>)
            : {}),
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Self-contained front + back faces for a single article card inside a `DeckSlotCard`.
 * Keeping per-card `imageTier` and `imageLoadFailed` local prevents layout shifts when a
 * peeking card promotes to the active slot.
 */
const ArticleDeckCard = memo(function ArticleDeckCard({
  article,
  cardIndex,
  totalArticles,
  isActive,
  isFlipped,
  compact,
  activeIdxSV,
  flipProgress,
  isFlippedSV,
  activeScrollOffsetSV,
  activeMaxScrollSV,
  touchStartedInScrollSV,
  panShared,
  editionMeta,
  showImages,
  baseImageTier,
  fontScale,
  activeTopic,
  onSelectTopic,
  onClearTopic,
  onStartEdition,
  toggleFlip,
  currentVote,
  isSaved,
  onVote,
  onToggleSave,
  contextFeedback,
  contextNoteText,
  onChangeContextNoteText,
  contextNoteInputRef,
  sendingContextNote,
  onCancelContextNote,
  onSendContextNote,
  onContextFeedback,
  showFlipTip,
  showTopicTip,
}: {
  article: Article;
  cardIndex: number;
  totalArticles: number;
  isActive: boolean;
  isFlipped: boolean;
  compact: boolean;
  activeIdxSV: SharedValue<number>;
  flipProgress: SharedValue<number>;
  isFlippedSV: SharedValue<boolean>;
  activeScrollOffsetSV: SharedValue<number>;
  activeMaxScrollSV: SharedValue<number>;
  touchStartedInScrollSV: SharedValue<boolean>;
  panShared: DeckPanSharedState;
  editionMeta: EditionCoverMeta;
  showImages: boolean;
  baseImageTier: 0 | 1 | 2;
  fontScale: number;
  activeTopic?: string | null;
  onSelectTopic?: (topic: string) => void;
  onClearTopic?: () => void;
  onStartEdition: () => void;
  toggleFlip: () => void;
  currentVote?: ArticlePreferenceVote;
  isSaved: boolean;
  onVote: (article: Article, vote: ArticlePreferenceVote) => Promise<void>;
  onToggleSave: (article: Article) => void;
  contextFeedback?: {
    sentiment: 'helpful' | 'not_helpful';
    step: 'note' | 'sent';
    docId?: string;
  };
  contextNoteText: string;
  onChangeContextNoteText: (text: string) => void;
  contextNoteInputRef: React.RefObject<ComponentRef<typeof TextInput> | null>;
  sendingContextNote: boolean;
  onCancelContextNote: (articleId: string) => void;
  onSendContextNote: (articleId: string) => Promise<void>;
  onContextFeedback: (
    article: Article,
    sentiment: 'helpful' | 'not_helpful'
  ) => Promise<void>;
  showFlipTip: boolean;
  showTopicTip: boolean;
}) {
  const [overflowTier, setOverflowTier] = useState<0 | 1 | 2>(0);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [frontMaxScroll, setFrontMaxScroll] = useState(0);
  const [backMaxScroll, setBackMaxScroll] = useState(0);
  const [isFrontAtBottom, setIsFrontAtBottom] = useState(true);

  const frontViewportHRef = useRef(0);
  const frontContentHRef = useRef(0);
  const frontScrollYRef = useRef(0);
  const backViewportHRef = useRef(0);
  const backContentHRef = useRef(0);
  const backScrollYRef = useRef(0);

  const imageTier = Math.max(baseImageTier, overflowTier) as 0 | 1 | 2;
  const isCover = article.id === '__ftue_welcome__';
  const isFrontScrollable = !isCover && frontMaxScroll > 3;
  const isBackScrollable = !isCover && backMaxScroll > 3;

  useEffect(() => {
    if (!isActive) return;
    if (isCover) {
      activeMaxScrollSV.set(0);
      activeScrollOffsetSV.set(0);
      return;
    }
    const maxScroll = isFlipped ? backMaxScroll : frontMaxScroll;
    const offset = isFlipped ? backScrollYRef.current : frontScrollYRef.current;
    activeMaxScrollSV.set(maxScroll);
    activeScrollOffsetSV.set(offset);
  }, [
    isActive,
    isCover,
    isFlipped,
    frontMaxScroll,
    backMaxScroll,
    activeMaxScrollSV,
    activeScrollOffsetSV,
  ]);

  const frontScrollGesture = useMemo(() => Gesture.Native(), []);
  const backScrollGesture = useMemo(() => Gesture.Native(), []);
  const cardPanGesture = useDeckCardPanGesture(
    cardIndex,
    panShared,
    isCover ? undefined : frontScrollGesture,
    isCover ? undefined : backScrollGesture
  );

  const bannerFlipTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .maxDistance(10)
        .onEnd(() => {
          if (isCover) return;
          if (cardIndex !== activeIdxSV.value || isFlippedSV.value) return;
          runOnJS(toggleFlip)();
        }),
    [activeIdxSV, cardIndex, isCover, isFlippedSV, toggleFlip]
  );

  const bodyFlipTapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .maxDistance(10)
        .onEnd(() => {
          if (isCover) return;
          if (cardIndex !== activeIdxSV.value || isFlippedSV.value) return;
          runOnJS(toggleFlip)();
        }),
    [activeIdxSV, cardIndex, isCover, isFlippedSV, toggleFlip]
  );

  const cardFrontFaceStyle = useAnimatedStyle(() => {
    if (cardIndex !== activeIdxSV.value || flipProgress.value === 0) {
      return {
        opacity: 1,
        transform: [],
      };
    }
    const rotateY = interpolate(flipProgress.value, [0, 1], [0, 180]);
    const opacity = interpolate(
      flipProgress.value,
      [0, 0.49, 0.5, 1],
      [1, 1, 0, 0]
    );
    return {
      opacity,
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden' as const,
    };
  });

  const cardBackFaceStyle = useAnimatedStyle(() => {
    if (cardIndex !== activeIdxSV.value) {
      return {
        opacity: 0,
        transform: [{ perspective: 1200 }, { rotateY: '180deg' }],
        backfaceVisibility: 'hidden' as const,
      };
    }
    const rotateY = interpolate(flipProgress.value, [0, 1], [180, 360]);
    const opacity = interpolate(
      flipProgress.value,
      [0, 0.49, 0.5, 1],
      [0, 0, 1, 1]
    );
    return {
      opacity,
      transform: [{ perspective: 1200 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden' as const,
    };
  });

  const recomputeFrontMetrics = useCallback(() => {
    const viewportH = frontViewportHRef.current;
    const contentH = frontContentHRef.current;
    if (viewportH <= 0 || contentH <= 0) return;

    const overflow = contentH - viewportH;
    if (overflow > 2) {
      setOverflowTier((prev) => (prev < 2 ? ((prev + 1) as 0 | 1 | 2) : 2));
    }
    const nextMax = Math.max(0, overflow);
    setFrontMaxScroll(nextMax);
    setIsFrontAtBottom(nextMax <= 3 || frontScrollYRef.current >= nextMax - 4);
  }, []);

  const handleFrontScrollViewportLayout = useCallback(
    (layoutHeight: number) => {
      frontViewportHRef.current = layoutHeight;
      recomputeFrontMetrics();
    },
    [recomputeFrontMetrics]
  );

  const handleFrontScrollContentSize = useCallback(
    (contentHeight: number) => {
      frontContentHRef.current = contentHeight;
      recomputeFrontMetrics();
    },
    [recomputeFrontMetrics]
  );

  const handleFrontScroll = useCallback(
    (offsetY: number) => {
      frontScrollYRef.current = offsetY;
      if (isActive && !isFlipped) {
        activeScrollOffsetSV.set(offsetY);
      }
      setIsFrontAtBottom(
        frontMaxScroll <= 3 || offsetY >= frontMaxScroll - 4
      );
    },
    [activeScrollOffsetSV, frontMaxScroll, isActive, isFlipped]
  );

  const recomputeBackMetrics = useCallback(() => {
    const viewportH = backViewportHRef.current;
    const contentH = backContentHRef.current;
    if (viewportH <= 0 || contentH <= 0) return;
    setBackMaxScroll(Math.max(0, contentH - viewportH));
  }, []);

  const handleBackScrollViewportLayout = useCallback(
    (layoutHeight: number) => {
      backViewportHRef.current = layoutHeight;
      recomputeBackMetrics();
    },
    [recomputeBackMetrics]
  );

  const handleBackScrollContentSize = useCallback(
    (contentHeight: number) => {
      backContentHRef.current = contentHeight;
      recomputeBackMetrics();
    },
    [recomputeBackMetrics]
  );

  const handleBackScroll = useCallback(
    (offsetY: number) => {
      backScrollYRef.current = offsetY;
      if (isActive && isFlipped) {
        activeScrollOffsetSV.set(offsetY);
      }
    },
    [activeScrollOffsetSV, isActive, isFlipped]
  );

  const showingPhoto = Boolean(showImages && article.image_url && !imageLoadFailed);
  const bannerHeight = showingPhoto
    ? compact
      ? imageTier === 0
        ? 132
        : imageTier === 1
          ? 72
          : 38
      : imageTier === 0
        ? 175
        : imageTier === 1
          ? 88
          : 44
    : compact
      ? imageTier === 0
        ? 74
        : imageTier === 1
          ? 52
          : 34
      : imageTier === 0
        ? 92
        : imageTier === 1
          ? 64
          : 40;

  const isLiked = currentVote === 'like';
  const isDisliked = currentVote === 'dislike';

  const frontContent = isCover ? (
    <EditionCoverContent
      article={article}
      editionMeta={editionMeta}
      fontScale={fontScale}
      compact={compact}
      onStart={onStartEdition}
    />
  ) : (
    <>
      <View
        onTouchStart={() => {
          touchStartedInScrollSV.set(false);
        }}
        style={{
          position: 'relative',
          width: '100%',
          height: bannerHeight,
          overflow: 'hidden',
        }}
      >
        <GestureDetector gesture={bannerFlipTapGesture}>
          <View style={{ width: '100%', height: '100%' }}>
            {showingPhoto && article.image_url ? (
              <Image
                source={{ uri: article.image_url }}
                recyclingKey={article.id}
                contentFit="cover"
                transition={0}
                onError={() => setImageLoadFailed(true)}
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: '#F1EFEA',
                }}
              />
            ) : (
              <TopicPatternBanner topic={article.topic} />
            )}
          </View>
        </GestureDetector>
      </View>

      <View style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <GestureDetector gesture={frontScrollGesture}>
          <ScrollView
            style={{
              flex: 1,
              ...(Platform.OS === 'web'
                ? ({
                    touchAction:
                      isActive && isFrontScrollable ? 'pan-y' : 'none',
                  } as Record<string, unknown>)
                : {}),
            }}
            scrollEnabled={isActive && isFrontScrollable}
            bounces={false}
            overScrollMode="never"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onTouchStart={() => {
              touchStartedInScrollSV.set(true);
            }}
            onLayout={(e) =>
              handleFrontScrollViewportLayout(e.nativeEvent.layout.height)
            }
            onContentSizeChange={(_w, contentH) =>
              handleFrontScrollContentSize(contentH)
            }
            onScroll={(e) =>
              handleFrontScroll(e.nativeEvent.contentOffset.y)
            }
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: compact ? 18 : 20,
              paddingTop: compact ? 12 : 16,
              paddingBottom: compact ? 12 : 14,
            }}
          >
            <GestureDetector gesture={bodyFlipTapGesture}>
              <View style={{ flexGrow: 1 }}>
                <EditorialCardContent
                  article={article}
                  fontScale={fontScale}
                  compact={compact}
                  activeTopic={activeTopic}
                  activePositionLabel={
                    activeTopic
                      ? `${Math.min(cardIndex + 1, totalArticles)} of ${totalArticles}`
                      : undefined
                  }
                  onSelectTopic={onSelectTopic}
                  onClearTopic={onClearTopic}
                  onPressWhyItMatters={toggleFlip}
                />
              </View>
            </GestureDetector>
          </ScrollView>
        </GestureDetector>

        {isActive && isFrontScrollable && !isFrontAtBottom ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: 6,
              left: 0,
              right: 0,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: 'rgba(255, 255, 255, 0.92)',
                borderWidth: 1,
                borderColor: 'rgba(28, 25, 23, 0.08)',
              }}
            >
              <Text
                style={{
                  ...(Fonts?.sans
                    ? ({ fontFamily: Fonts.sans } as Record<string, unknown>)
                    : {}),
                  fontSize: scaleFont(10.5, fontScale),
                  fontWeight: '600',
                  color: '#78716C',
                }}
              >
                Scroll ↓
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Quieter Card Front Footer: Dislike (left) + Save for later / Like (right) */}
      <View
        onTouchStart={() => {
          touchStartedInScrollSV.set(false);
        }}
        style={{
          paddingHorizontal: compact ? 20 : 22,
          paddingBottom: compact ? 11 : 14,
          paddingTop: compact ? 8 : 10,
          borderTopWidth: 1,
          borderTopColor: 'rgba(28, 25, 23, 0.05)',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            void onVote(article, 'dislike');
          }}
          accessibilityLabel="Dislike this story"
          accessibilityState={{ selected: isDisliked }}
          hitSlop={10}
          className="active:opacity-60"
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDisliked
              ? 'rgba(220, 38, 38, 0.08)'
              : 'transparent',
            ...(Platform.OS === 'web'
              ? ({ cursor: 'pointer' } as Record<string, unknown>)
              : {}),
          }}
        >
          <ThumbIcon
            direction="down"
            filled={isDisliked}
            color={isDisliked ? '#DC2626' : '#78716C'}
            size={16}
          />
        </Pressable>
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleSave(article);
            }}
            accessibilityLabel={
              isSaved ? 'Remove from saved for later' : 'Save story for later'
            }
            accessibilityState={{ selected: isSaved }}
            hitSlop={10}
            className="active:opacity-60"
            style={{
              height: 34,
              paddingHorizontal: isSaved ? 10 : 6,
              borderRadius: 999,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              backgroundColor: isSaved
                ? 'rgba(13, 148, 136, 0.08)'
                : 'transparent',
              ...(Platform.OS === 'web'
                ? ({ cursor: 'pointer' } as Record<string, unknown>)
                : {}),
            }}
          >
            <BookmarkIcon
              filled={isSaved}
              color={isSaved ? '#0D9488' : '#78716C'}
              size={15}
            />
            {isSaved ? (
              <Text
                className="font-semibold text-accent"
                style={{ fontSize: scaleFont(11, fontScale) }}
              >
                Saved
              </Text>
            ) : null}
          </Pressable>
          <Pressable
            onPress={(e) => {
              e.stopPropagation?.();
              void onVote(article, 'like');
            }}
            accessibilityLabel="Like this story"
            accessibilityState={{ selected: isLiked }}
            hitSlop={10}
            className="active:opacity-60"
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isLiked
                ? 'rgba(13, 148, 136, 0.08)'
                : 'transparent',
              ...(Platform.OS === 'web'
                ? ({ cursor: 'pointer' } as Record<string, unknown>)
                : {}),
            }}
          >
            <ThumbIcon
              direction="up"
              filled={isLiked}
              color={isLiked ? '#0D9488' : '#78716C'}
              size={16}
            />
          </Pressable>
        </View>
      </View>

      {isActive && showFlipTip ? (
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
            <Text
              className="font-medium text-ink"
              style={{ fontSize: scaleFont(13, fontScale) }}
            >
              👆 Tap to flip cards
            </Text>
          </View>
        </View>
      ) : null}

      {isActive && showTopicTip ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: bannerHeight + 38,
            left: 20,
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
            <Text
              className="font-medium text-ink"
              style={{ fontSize: scaleFont(12.5, fontScale) }}
            >
              Tap here to focus on a subject
            </Text>
          </View>
        </View>
      ) : null}
    </>
  );

  return (
    <GestureDetector gesture={cardPanGesture}>
      <View style={{ flex: 1 }}>
        {/* FRONT FACE */}
      <Animated.View
        pointerEvents={!isActive || isFlipped ? 'none' : 'auto'}
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 26,
            overflow: 'hidden',
            backgroundColor: isCover ? '#fefaef' : '#FFFFFF',
            borderWidth: Platform.OS === 'web' ? 0 : 1,
            borderColor: 'rgba(28, 25, 23, 0.08)',
            boxShadow:
              Platform.OS === 'web'
                ? isActive
                  ? '0 8px 20px -4px rgba(28, 25, 23, 0.15), 0 0 0 1px rgba(28, 25, 23, 0.08)'
                  : '0 0 0 1px rgba(28, 25, 23, 0.08)'
                : '0 10px 26px -4px rgba(28, 25, 23, 0.18), 0 2px 6px rgba(28, 25, 23, 0.08), 0 0 0 1px rgba(28, 25, 23, 0.08)',
            shadowColor: '#1C1917',
            shadowOpacity: 0.1,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
          },
          cardFrontFaceStyle,
        ]}
      >
        {frontContent}
      </Animated.View>

      {/* BACK FACE (mounted only on active non-cover card so peeking cards avoid duplicate 3D DOM/shadow layers) */}
      {!isCover && isActive ? (
        <Animated.View
          pointerEvents={isActive && isFlipped ? 'auto' : 'none'}
          style={[
            {
              opacity: 0,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 26,
              overflow: 'hidden',
              backgroundColor: '#FAF8F4',
              borderWidth: Platform.OS === 'web' ? 0 : 1,
              borderColor: 'rgba(28, 25, 23, 0.08)',
              boxShadow:
                '0 10px 26px -4px rgba(28, 25, 23, 0.18), 0 2px 6px rgba(28, 25, 23, 0.08), 0 0 0 1px rgba(28, 25, 23, 0.08)',
              shadowColor: '#1C1917',
              shadowOpacity: 0.1,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 10 },
              justifyContent: 'space-between',
            },
            cardBackFaceStyle,
          ]}
        >
          <View style={{ flex: 1, minHeight: 0 }}>
            <View
              onTouchStart={() => {
                touchStartedInScrollSV.set(false);
              }}
              style={{
                position: 'relative',
                width: '100%',
                height: bannerHeight,
                overflow: 'hidden',
              }}
            >
              <Pressable onPress={toggleFlip} style={{ flex: 1 }}>
                <TopicPatternBanner topic={article.topic} reverse />
              </Pressable>
            </View>

            <GestureDetector gesture={backScrollGesture}>
              <ScrollView
                style={{
                  flex: 1,
                  ...(Platform.OS === 'web'
                    ? ({
                        touchAction:
                          isActive && isBackScrollable ? 'pan-y' : 'none',
                      } as Record<string, unknown>)
                    : {}),
                }}
                scrollEnabled={isActive && isBackScrollable}
                bounces={false}
                overScrollMode="never"
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onTouchStart={() => {
                  touchStartedInScrollSV.set(true);
                }}
                onLayout={(e) =>
                  handleBackScrollViewportLayout(e.nativeEvent.layout.height)
                }
                onContentSizeChange={(_w, contentH) =>
                  handleBackScrollContentSize(contentH)
                }
                onScroll={(e) =>
                  handleBackScroll(e.nativeEvent.contentOffset.y)
                }
                contentContainerStyle={{
                  flexGrow: 1,
                  paddingHorizontal: compact ? 18 : 20,
                  paddingTop: compact ? 14 : 20,
                  paddingBottom: compact ? 12 : 16,
                }}
              >
                <Pressable
                  onPress={toggleFlip}
                  style={{ flexGrow: 1, justifyContent: 'space-between' }}
                >
                <View>
                  <View className="flex-row items-center gap-2 mb-2 min-w-0">
                    <Text
                      className="flex-shrink"
                      style={{
                        ...(Fonts?.sans
                          ? ({ fontFamily: Fonts.sans } as Record<
                              string,
                              unknown
                            >)
                          : {}),
                        fontSize: scaleFont(12, fontScale),
                        fontWeight: '600',
                        letterSpacing: 0.5,
                        color: '#78716C',
                      }}
                      numberOfLines={1}
                    >
                      Why it matters
                    </Text>
                  </View>

                  <Text
                    className="tracking-[-0.25px]"
                    style={{
                      ...getNewsFontStyle('600'),
                      fontSize: scaleFont(16.5, fontScale),
                      lineHeight: scaleFont(22, fontScale),
                      color: '#57534E',
                      marginBottom: Math.round(14 * fontScale),
                    }}
                    numberOfLines={2}
                  >
                    {article.ai_headline}
                  </Text>

                  <ArticleContextPoints
                    article={article}
                    fontScale={fontScale}
                  />
                </View>

                <View
                  style={{
                    marginTop: Math.round(16 * fontScale),
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      toggleFlip();
                    }}
                    accessibilityLabel="Flip back to story"
                    hitSlop={8}
                    className="active:opacity-60"
                    style={{
                      ...(Platform.OS === 'web'
                        ? ({ cursor: 'pointer' } as Record<string, unknown>)
                        : {}),
                    }}
                  >
                    <Text
                      style={{
                        ...(Fonts?.sans
                          ? ({ fontFamily: Fonts.sans } as Record<
                              string,
                              unknown
                            >)
                          : {}),
                        fontSize: scaleFont(12.5, fontScale),
                        fontWeight: '500',
                        color: '#78716C',
                      }}
                    >
                      ↻ Story
                    </Text>
                  </Pressable>

                  {article.original_url ? (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        void openArticleUrl(article.original_url);
                      }}
                      accessibilityLabel="Read source article"
                      hitSlop={6}
                      className="active:opacity-75"
                      style={{
                        paddingHorizontal: 13,
                        paddingVertical: 6.5,
                        borderRadius: 999,
                        backgroundColor: '#F0FDFA',
                        borderWidth: 1,
                        borderColor: 'rgba(13, 148, 136, 0.28)',
                        ...(Platform.OS === 'web'
                          ? ({ cursor: 'pointer' } as Record<string, unknown>)
                          : {}),
                      }}
                    >
                      <Text
                        className="font-semibold"
                        style={{
                          ...(Fonts?.sans
                            ? ({ fontFamily: Fonts.sans } as Record<
                                string,
                                unknown
                              >)
                            : {}),
                          fontSize: scaleFont(12.5, fontScale),
                          color: '#0F766E',
                        }}
                      >
                        Read source ↗
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </Pressable>
              </ScrollView>
            </GestureDetector>
          </View>

          <View
            onTouchStart={() => {
              touchStartedInScrollSV.set(false);
            }}
            style={{
              paddingHorizontal: compact ? 18 : 20,
              paddingTop: compact ? 10 : 12,
              paddingBottom: compact ? 12 : 16,
              borderTopWidth: 1,
              borderTopColor: 'rgba(28, 25, 23, 0.07)',
              backgroundColor: '#F4F1EA',
            }}
          >
            <View>
              {contextFeedback?.step === 'note' ? (
                <View className="w-full">
                  <Text
                    className="font-medium text-ink mb-2"
                    style={{ fontSize: scaleFont(13, fontScale) }}
                  >
                    Thanks! Add another line?
                  </Text>
                  <TextInput
                    ref={isActive ? contextNoteInputRef : undefined}
                    value={contextNoteText}
                    onChangeText={onChangeContextNoteText}
                    placeholder="Write a quick note..."
                    placeholderTextColor="#A8A29E"
                    multiline
                    style={{ fontSize: scaleFont(14, fontScale) }}
                    className="w-full bg-[#F5F4F0] border border-stone-200 rounded-2xl px-3.5 py-2.5 text-ink min-h-[68px] mb-2.5"
                  />
                  <View className="flex-row items-center justify-end gap-2">
                    <Pressable
                      onPress={() => onCancelContextNote(article.id)}
                      disabled={sendingContextNote}
                      className="px-3.5 py-1.5 rounded-full active:opacity-60"
                    >
                      <Text
                        className="font-medium text-stone-500"
                        style={{ fontSize: scaleFont(13, fontScale) }}
                      >
                        Cancel
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void onSendContextNote(article.id)}
                      disabled={sendingContextNote}
                      className="px-4 py-1.5 rounded-full bg-ink active:opacity-80"
                    >
                      <Text
                        className="font-semibold text-white"
                        style={{ fontSize: scaleFont(13, fontScale) }}
                      >
                        {sendingContextNote ? 'Sending...' : 'Send'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <Text
                    className="font-medium text-stone-500 mb-2.5"
                    style={{ fontSize: scaleFont(13, fontScale) }}
                  >
                    Was it helpful?
                  </Text>
                  {contextFeedback ? (
                    <Text
                      className="font-medium text-accent"
                      style={{ fontSize: scaleFont(13, fontScale) }}
                    >
                      Thanks for your feedback! (
                      {contextFeedback.sentiment === 'helpful'
                        ? '😊 Yes, thanks'
                        : '😞 Not really'}
                      )
                    </Text>
                  ) : (
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Pressable
                        onPress={() => void onContextFeedback(article, 'helpful')}
                        className="px-3.5 py-2 rounded-full bg-white border border-stone-200 active:opacity-70"
                      >
                        <Text
                          className="font-medium text-ink"
                          style={{ fontSize: scaleFont(13, fontScale) }}
                        >
                          😊 Yes, thanks
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          void onContextFeedback(article, 'not_helpful')
                        }
                        className="px-3.5 py-2 rounded-full bg-white border border-stone-200 active:opacity-70"
                      >
                        <Text
                          className="font-medium text-ink"
                          style={{ fontSize: scaleFont(13, fontScale) }}
                        >
                          😞 Not really
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </Animated.View>
      ) : null}
      </View>
    </GestureDetector>
  );
});

export function SwipeCardDeck({
  articles,
  onIndexChange,
  onRequestOlderNews,
  activeTopic,
  onSelectTopic,
  onClearTopic,
  showOnboardingTips = false,
  showImages = false,
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
  const [flipTipDismissed, setFlipTipDismissed] = useState(false);
  const [topicTipDismissed, setTopicTipDismissed] = useState(false);
  const noteInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const contextNoteInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextFeedbackDocPromisesRef = useRef<
    Record<string, Promise<string | null>>
  >({});
  const onIndexChangeRef = useRef(onIndexChange);
  useEffect(() => {
    onIndexChangeRef.current = onIndexChange;
  }, [onIndexChange]);

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
      }
    };
  }, []);
  const { width, height } = useWindowDimensions();
  const [cardAreaHeight, setCardAreaHeight] = useState(() =>
    Math.round(height * 0.72)
  );
  const isCompactHeight = cardAreaHeight < 560;

  const activeIdxSV = useSharedValue(0);
  const articlesLenSV = useSharedValue(articles.length);
  const hasOlderNewsSV = useSharedValue(Boolean(onRequestOlderNews));
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const windowWidthSV = useSharedValue(width);
  const windowHeightSV = useSharedValue(height);
  const horizontalThresholdSV = useSharedValue(Math.min(width * 0.18, 72));
  const verticalThresholdSV = useSharedValue(Math.min(height * 0.12, 72));
  const cardHeightSV = useSharedValue(Math.max(420, height * 0.72));
  const prevTranslateY = useSharedValue(-Math.max(height, 1000) - 200);
  const isPullingPrev = useSharedValue(false);
  const flipProgress = useSharedValue(0);
  const isFlippedSV = useSharedValue(false);
  const isAnimating = useSharedValue(false);
  const activeScrollOffsetSV = useSharedValue(0);
  const activeMaxScrollSV = useSharedValue(0);
  const touchStartedInScrollSV = useSharedValue(false);
  const dragModeSV = useSharedValue<0 | 1 | 2>(0);

  useEffect(() => {
    windowWidthSV.value = width;
    windowHeightSV.value = height;
    horizontalThresholdSV.value = Math.min(width * 0.18, 72);
    verticalThresholdSV.value = Math.min(height * 0.12, 72);
  }, [
    height,
    horizontalThresholdSV,
    verticalThresholdSV,
    width,
    windowHeightSV,
    windowWidthSV,
  ]);

  useEffect(() => {
    articlesLenSV.set(articles.length);
  }, [articles.length, articlesLenSV]);

  useEffect(() => {
    hasOlderNewsSV.set(Boolean(onRequestOlderNews));
  }, [onRequestOlderNews, hasOlderNewsSV]);

  const baseImageTier = useMemo<0 | 1 | 2>(() => {
    if (fontScale >= 1.2) return 2;
    if (fontScale >= 1.08) return 1;
    return 0;
  }, [fontScale]);

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

  const [mountNowMs] = useState(() => Date.now());

  const editionMeta = useMemo<EditionCoverMeta>(() => {
    const storyArticles = articles.filter((a) => a.id !== '__ftue_welcome__');
    const seenTopics = new Set<string>();
    const topics: string[] = [];
    let totalWords = 0;
    let latestTimestampMs = 0;

    for (const item of storyArticles) {
      const topicName = item.topic?.trim();
      if (topicName) {
        const key = topicName.toLowerCase();
        if (!seenTopics.has(key)) {
          seenTopics.add(key);
          topics.push(topicName);
        }
      }
      const chunk = `${item.ai_headline ?? ''} ${item.ai_summary ?? ''}`.trim();
      if (chunk) {
        totalWords += chunk.split(/\s+/).length;
      }
      const ts = item.edited_at ?? item.approved_at;
      if (ts) {
        const parsed = Date.parse(ts);
        if (!Number.isNaN(parsed) && parsed > latestTimestampMs) {
          latestTimestampMs = parsed;
        }
      }
    }

    const readMinutes =
      storyArticles.length > 0
        ? Math.max(
            1,
            Math.round(Math.max(totalWords / 160, storyArticles.length * 0.42))
          )
        : 0;

    let editedAgoText: string | null = null;
    if (latestTimestampMs > 0) {
      const diffMs = Math.max(0, mountNowMs - latestTimestampMs);
      const diffMins = Math.round(diffMs / 60000);
      if (diffMins < 2) {
        editedAgoText = 'just now';
      } else if (diffMins < 60) {
        editedAgoText = `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
      } else if (diffMins < 60 * 24) {
        const hrs = Math.max(1, Math.round(diffMins / 60));
        editedAgoText = `${hrs} ${hrs === 1 ? 'hour' : 'hours'} ago`;
      } else {
        const days = Math.max(1, Math.round(diffMins / (60 * 24)));
        editedAgoText = `${days} ${days === 1 ? 'day' : 'days'} ago`;
      }
    }

    return {
      storyCount: storyArticles.length,
      topics,
      readMinutes,
      editedAgoText,
    };
  }, [articles, mountNowMs]);

  const resetFlip = useCallback(() => {
    setIsFlipped(false);
    isFlippedSV.set(false);
    flipProgress.set(0);
  }, [flipProgress, isFlippedSV]);

  const toggleFlip = useCallback(() => {
    const idx = activeIdxSV.get();
    if (idx === 1) {
      setFlipTipDismissed(true);
    } else if (idx === 2) {
      setTopicTipDismissed(true);
    }
    setIsFlipped((prev) => {
      const next = !prev;
      isFlippedSV.set(next);
      flipProgress.set(withTiming(next ? 1 : 0, { duration: 320 }));
      return next;
    });
  }, [activeIdxSV, flipProgress, isFlippedSV]);

  const prevResetTokenRef = useRef(resetToken);
  const prevArticleIdsRef = useRef<string[]>(articles.map((a) => a.id));

  // Reset deck to first card only when resetToken changes or the feed is replaced,
  // preserving the reader's position when articles are saved/liked or an item is removed.
  useEffect(() => {
    const nextIds = articles.map((a) => a.id);
    const prevIds = prevArticleIdsRef.current;
    const tokenChanged = resetToken !== prevResetTokenRef.current;
    const sameIds =
      prevIds.length === nextIds.length &&
      prevIds.every((id, idx) => id === nextIds[idx]);

    prevResetTokenRef.current = resetToken;
    prevArticleIdsRef.current = nextIds;
    articlesLenSV.set(articles.length);

    if (!tokenChanged && sameIds) {
      return;
    }

    const nextIdSet = new Set(nextIds);
    const isInPlaceRemoval =
      !tokenChanged &&
      prevIds.length > 0 &&
      nextIds.length > 0 &&
      nextIds.every((id) => prevIds.includes(id));

    if (isInPlaceRemoval) {
      setCurrentIndex((prevIdx) => {
        const clamped = Math.min(prevIdx, nextIds.length);
        if (clamped !== prevIdx) {
          activeIdxSV.set(clamped);
          onIndexChangeRef.current?.(clamped);
        }
        return clamped;
      });
      return;
    }

    if (!tokenChanged && prevIds.length > 0 && nextIdSet.size > 0) {
      // Check if the current active article still exists in the updated list
      // (e.g. preference re-ranking while reading); if so, keep the reader on it.
      setCurrentIndex((prevIdx) => {
        const activeId = prevIds[prevIdx];
        if (activeId) {
          const newIdx = nextIds.indexOf(activeId);
          if (newIdx !== -1) {
            if (newIdx !== prevIdx) {
              activeIdxSV.set(newIdx);
              onIndexChangeRef.current?.(newIdx);
            }
            return newIdx;
          }
        }
        activeIdxSV.set(0);
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
        onIndexChangeRef.current?.(0);
        return 0;
      });
      return;
    }

    activeIdxSV.set(0);
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
    onIndexChangeRef.current?.(0);
  }, [articles, resetToken, activeIdxSV, articlesLenSV, cardHeightSV, isPullingPrev, prevTranslateY, resetFlip, translateX, translateY, windowHeightSV]);

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
    onIndexChangeRef.current?.(currentIndex);
  }, [currentIndex]);

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

  const syncCurrentIndexFromWorklet = useCallback((nextIdx: number) => {
    setIsFlipped(false);
    setContextNoteText('');
    setSendingContextNote(false);
    setCurrentIndex(nextIdx);
  }, []);

  const triggerOlderNews = useCallback(() => {
    onRequestOlderNews?.();
  }, [onRequestOlderNews]);

  const handleStartEdition = useCallback(() => {
    if (isAnimating.get()) return;
    isAnimating.set(true);
    translateY.set(
      withTiming(
        -Math.max(cardHeightSV.get() + 120, windowHeightSV.get() + 200),
        { duration: 160, easing: EXIT_EASING },
        (finished) => {
          if (finished) {
            const nextIdx = Math.min(activeIdxSV.value + 1, articlesLenSV.value);
            activeIdxSV.value = nextIdx;
            translateX.value = 0;
            translateY.value = 0;
            flipProgress.value = 0;
            isFlippedSV.value = false;
            isAnimating.value = false;
            runOnJS(syncCurrentIndexFromWorklet)(nextIdx);
          } else {
            isAnimating.set(false);
          }
        }
      )
    );
  }, [
    activeIdxSV,
    articlesLenSV,
    cardHeightSV,
    flipProgress,
    isAnimating,
    isFlippedSV,
    syncCurrentIndexFromWorklet,
    translateX,
    translateY,
    windowHeightSV,
  ]);

  const panShared = useMemo<DeckPanSharedState>(
    () => ({
      activeIdxSV,
      articlesLenSV,
      hasOlderNewsSV,
      translateX,
      translateY,
      prevTranslateY,
      isAnimating,
      isPullingPrev,
      flipProgress,
      isFlippedSV,
      dragModeSV,
      touchStartedInScrollSV,
      activeScrollOffsetSV,
      activeMaxScrollSV,
      cardHeightSV,
      windowWidthSV,
      windowHeightSV,
      horizontalThresholdSV,
      verticalThresholdSV,
      syncCurrentIndexFromWorklet,
      triggerOlderNews,
    }),
    [
      activeIdxSV,
      activeMaxScrollSV,
      activeScrollOffsetSV,
      articlesLenSV,
      cardHeightSV,
      dragModeSV,
      flipProgress,
      hasOlderNewsSV,
      horizontalThresholdSV,
      isAnimating,
      isFlippedSV,
      isPullingPrev,
      prevTranslateY,
      syncCurrentIndexFromWorklet,
      touchStartedInScrollSV,
      translateX,
      translateY,
      triggerOlderNews,
      verticalThresholdSV,
      windowHeightSV,
      windowWidthSV,
    ]
  );

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

  const handleCardContainerLayout = useCallback(
    (layoutHeight: number) => {
      if (layoutHeight <= 0) return;
      const rounded = Math.round(layoutHeight);
      setCardAreaHeight((prev) =>
        Math.abs(rounded - prev) > 8 ? rounded : prev
      );
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

  const startVisibleIdx = Math.max(0, currentIndex - 1);
  const endVisibleIdx = Math.min(articles.length - 1, currentIndex + 2);
  const visibleArticleEntries: { article: Article; index: number }[] = [];
  for (let i = startVisibleIdx; i <= endVisibleIdx; i += 1) {
    const item = articles[i];
    if (item) {
      visibleArticleEntries.push({ article: item, index: i });
    }
  }
  const showCaughtUpSlot = currentIndex >= Math.max(0, articles.length - 2);
  const isCaughtUpActive = currentIndex >= articles.length;

  return (
    <View
      style={{
        flex: 1,
        paddingLeft: 20,
        paddingRight: 20,
        paddingTop: isCompactHeight ? 12 : 22,
        paddingBottom: isCompactHeight ? 12 : 20,
        alignItems: 'center',
      }}
    >
      {/* Unified Keyed Floating Card Stack */}
      <View
        onLayout={(e) => handleCardContainerLayout(e.nativeEvent.layout.height)}
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 420,
          position: 'relative',
        }}
      >
          {/* Scrim cast over active card when pulling the previous card down */}
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

          {/* Keyed story cards (prev, active, next, third) stay mounted across transitions */}
          {visibleArticleEntries.map(({ article, index }) => {
            const isActiveCard = index === currentIndex;
            const isShowFlipTip =
              isActiveCard &&
              showOnboardingTips &&
              index === 1 &&
              !isFlipped &&
              !flipTipDismissed;
            const isShowTopicTip =
              isActiveCard &&
              showOnboardingTips &&
              index === 2 &&
              !activeTopic &&
              Boolean(article.topic) &&
              !isFlipped &&
              !topicTipDismissed;

            return (
              <DeckSlotCard
                key={article.id}
                cardIndex={index}
                activeIdxSV={activeIdxSV}
                translateX={translateX}
                translateY={translateY}
                prevTranslateY={prevTranslateY}
                cardHeightSV={cardHeightSV}
                width={width}
                isInteractive={isActiveCard}
              >
                <ArticleDeckCard
                  article={article}
                  cardIndex={index}
                  totalArticles={articles.length}
                  isActive={isActiveCard}
                  isFlipped={isActiveCard ? isFlipped : false}
                  compact={isCompactHeight}
                  activeIdxSV={activeIdxSV}
                  flipProgress={flipProgress}
                  isFlippedSV={isFlippedSV}
                  activeScrollOffsetSV={activeScrollOffsetSV}
                  activeMaxScrollSV={activeMaxScrollSV}
                  touchStartedInScrollSV={touchStartedInScrollSV}
                  panShared={panShared}
                  editionMeta={editionMeta}
                  showImages={showImages}
                  baseImageTier={baseImageTier}
                  fontScale={fontScale}
                  activeTopic={activeTopic}
                  onSelectTopic={onSelectTopic}
                  onClearTopic={onClearTopic}
                  onStartEdition={handleStartEdition}
                  toggleFlip={toggleFlip}
                  currentVote={effectiveArticleVotes[article.id]}
                  isSaved={Boolean(effectiveSavedIds[article.id])}
                  onVote={handleArticleVote}
                  onToggleSave={handleToggleSave}
                  contextFeedback={contextFeedbackByArticle[article.id]}
                  contextNoteText={isActiveCard ? contextNoteText : ''}
                  onChangeContextNoteText={setContextNoteText}
                  contextNoteInputRef={contextNoteInputRef}
                  sendingContextNote={sendingContextNote}
                  onCancelContextNote={handleCancelContextNote}
                  onSendContextNote={handleSendContextNote}
                  onContextFeedback={handleContextFeedback}
                  showFlipTip={isShowFlipTip}
                  showTopicTip={isShowTopicTip}
                />
              </DeckSlotCard>
            );
          })}

          {/* End-of-edition Caught Up card inside the same keyed deck */}
          {showCaughtUpSlot ? (
            <DeckSlotCard
              key="__caught_up__"
              cardIndex={articles.length}
              activeIdxSV={activeIdxSV}
              translateX={translateX}
              translateY={translateY}
              prevTranslateY={prevTranslateY}
              cardHeightSV={cardHeightSV}
              width={width}
              isInteractive={isCaughtUpActive}
            >
              <PanCardWrapper cardIndex={articles.length} panShared={panShared}>
                <View
                style={{
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
                    Platform.OS === 'web'
                      ? isCaughtUpActive
                        ? '0 8px 20px -4px rgba(28, 25, 23, 0.15), 0 0 0 1px rgba(28, 25, 23, 0.08)'
                        : '0 0 0 1px rgba(28, 25, 23, 0.08)'
                      : '0 10px 26px -4px rgba(28, 25, 23, 0.18), 0 2px 6px rgba(28, 25, 23, 0.08), 0 0 0 1px rgba(28, 25, 23, 0.08)',
                  shadowColor: '#1C1917',
                  shadowOpacity: 0.1,
                  shadowRadius: 24,
                  shadowOffset: { width: 0, height: 10 },
                  padding: 28,
                  justifyContent: 'space-between',
                }}
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
                    <View
                      style={{
                        width: 92,
                        height: 92,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: 14,
                        position: 'relative',
                      }}
                    >
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
                    </View>

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
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                            paddingHorizontal: 18,
                            paddingVertical: 10,
                            borderRadius: 999,
                            backgroundColor: '#F0FDFA',
                            borderWidth: 1,
                            borderColor: 'rgba(13, 148, 136, 0.22)',
                            ...(Platform.OS === 'web'
                              ? ({ cursor: 'pointer' } as Record<
                                  string,
                                  unknown
                                >)
                              : {}),
                          }}
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
                </View>
              </PanCardWrapper>
            </DeckSlotCard>
          ) : null}
      </View>
    </View>
  );
}
