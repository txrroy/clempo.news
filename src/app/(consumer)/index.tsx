import { BookmarkIcon } from '@/components/consumer/BookmarkIcon';
import { NewspaperFrontPage } from '@/components/consumer/NewspaperFrontPage';
import { SwipeCardDeck } from '@/components/consumer/SwipeCardDeck';
import { TopicIcon } from '@/components/consumer/TopicIcon';
import { TopicSignalIcon } from '@/components/consumer/TopicSignalIcon';
import { TopicSignalModal } from '@/components/consumer/TopicSignalModal';
import { APP_CONFIG } from '@/config/appConfig';
import { getAllTopicsVisual, getTopicVisual } from '@/config/topicConfig';
import { Fonts } from '@/constants/theme';
import { usePublishedArticles } from '@/hooks/useArticles';
import { useTopicPreferences } from '@/hooks/useTopicPreferences';
import { formatEditionDate } from '@/lib/consumerUtils';
import {
  getCurrentStreak,
  getLocalDateKey,
  getNextEditionLocalTimeText,
  loadReadingStreak,
  recordCaughtUpDay,
  saveReadingStreak,
  type ReadingStreakState,
} from '@/lib/readingStreak';
import {
  applyTopicPreferences,
  getArticleTags,
  getTopicSignalStatus,
  normalizeTopicKey,
} from '@/lib/topicPreferences';
import type { Article } from '@/types/article';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

type ViewMode = 'today' | 'older';

const SANS_MEDIUM =
  Platform.OS === 'web'
    ? "'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    : 'BricolageGrotesque_500Medium';
const SANS_SEMIBOLD =
  Platform.OS === 'web'
    ? "'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    : 'BricolageGrotesque_600SemiBold';
const SANS_BOLD =
  Platform.OS === 'web'
    ? "'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    : 'BricolageGrotesque_700Bold';

const FTUE_STORAGE_KEY = 'snappylit_ftue_seen';
let hasSeenFtueInSession = false;

function hasCompletedOnboarding(): boolean {
  if (hasSeenFtueInSession) return true;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(FTUE_STORAGE_KEY) === '1';
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

function markOnboardingComplete(): void {
  hasSeenFtueInSession = true;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(FTUE_STORAGE_KEY, '1');
    }
  } catch {
    // ignore storage errors
  }
}

const SHOW_IMAGES_STORAGE_KEY = 'snappylit_show_images';
const FONT_SCALE_STORAGE_KEY = 'snappylit_font_scale';
const SAVED_ARTICLES_STORAGE_KEY = 'snappylit_saved_articles_v1';
const SAVED_TOPIC_KEY = '__saved_for_later__';

const FONT_SCALE_STEPS = [
  { scale: 0.9, label: 'Small' },
  { scale: 1.0, label: 'Default' },
  { scale: 1.12, label: 'Large' },
  { scale: 1.24, label: 'Extra Large' },
] as const;

function readShowImagesPreference(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(SHOW_IMAGES_STORAGE_KEY);
      if (saved === '1') return true;
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

function writeShowImagesPreference(value: boolean): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SHOW_IMAGES_STORAGE_KEY, value ? '1' : '0');
    }
  } catch {
    // ignore storage errors
  }
}

function readFontScalePreference(): number {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(FONT_SCALE_STORAGE_KEY);
      if (saved) {
        const parsed = Number(saved);
        if (!Number.isNaN(parsed) && parsed >= 0.85 && parsed <= 1.35) {
          return parsed;
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return 1.0;
}

function writeFontScalePreference(value: number): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(value));
    }
  } catch {
    // ignore storage errors
  }
}

function readSavedArticleIds(): Record<string, boolean> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(SAVED_ARTICLES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>;
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return {};
}

function writeSavedArticleIds(value: Record<string, boolean>): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        SAVED_ARTICLES_STORAGE_KEY,
        JSON.stringify(value)
      );
    }
  } catch {
    // ignore storage errors
  }
}

export default function ConsumerHomeScreen() {
  const {
    articles,
    olderArticles,
    loading,
    loadingOlder,
    hasMoreOlder,
    error,
    isShowingFallback,
    loadOlderArticles,
    loadMoreOlderArticles,
  } = usePublishedArticles();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [inspectedTopic, setInspectedTopic] = useState<string | null>(null);
  const {
    preferences,
    articleVotes,
    voteArticle,
    resetTopic,
    muteTopic,
    getSignalStatus,
    getExplanation,
  } = useTopicPreferences();
  const [showOnboardingTips, setShowOnboardingTips] = useState(
    () => !hasCompletedOnboarding()
  );
  const [showImages, setShowImages] = useState(() =>
    readShowImagesPreference()
  );
  const [fontScale, setFontScale] = useState(() =>
    readFontScalePreference()
  );
  const [savedArticleIds, setSavedArticleIds] = useState<Record<string, boolean>>(
    () => readSavedArticleIds()
  );
  const [readingStreak, setReadingStreak] = useState<ReadingStreakState>(() =>
    loadReadingStreak()
  );
  const [deckResetToken, setDeckResetToken] = useState(0);

  const handleToggleImages = () => {
    setShowImages((prev) => {
      const next = !prev;
      writeShowImagesPreference(next);
      return next;
    });
  };

  const handleChangeFontScale = (scale: number) => {
    setFontScale(scale);
    writeFontScalePreference(scale);
  };

  const handleToggleSaveArticle = (article: Article) => {
    setSavedArticleIds((prev) => {
      const next = { ...prev };
      if (next[article.id]) {
        delete next[article.id];
      } else {
        next[article.id] = true;
      }
      writeSavedArticleIds(next);
      return next;
    });
  };

  const drawerWidth = Math.round(Math.min(310, Math.max(248, width * 0.68)));
  const drawerProgress = useSharedValue(0);

  useEffect(() => {
    drawerProgress.value = withTiming(menuOpen ? 1 : 0, { duration: 240 });
  }, [menuOpen, drawerProgress]);

  const mainPushStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drawerProgress.value * drawerWidth }],
  }));

  const drawerSlideStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drawerProgress.value, [0, 0.4, 1], [0, 0.6, 1]),
    transform: [{ translateX: (drawerProgress.value - 1) * 28 }],
  }));

  const useNewspaperLayout = Platform.OS === 'web' && width >= 768;

  const displayedArticles = viewMode === 'today' ? articles : olderArticles;

  const allLoadedArticles = useMemo(() => articles, [articles]);

  const allLoadedWithOlder = useMemo(() => {
    if (olderArticles.length === 0) return articles;
    const seen = new Set(articles.map((a) => a.id));
    return [...articles, ...olderArticles.filter((a) => !seen.has(a.id))];
  }, [articles, olderArticles]);

  const availableTopics = useMemo(() => {
    const seen = new Set<string>();
    for (const article of allLoadedArticles) {
      const topic = article.topic?.trim();
      if (topic) seen.add(topic);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [allLoadedArticles]);

  const tunedSecondaryTags = useMemo(() => {
    const topicKeys = new Set(
      availableTopics.map((t) => normalizeTopicKey(t)).filter(Boolean)
    );
    const result: string[] = [];
    for (const [key, record] of Object.entries(preferences.topics)) {
      if (topicKeys.has(key)) continue;
      if (getTopicSignalStatus(record) === 'normal') continue;
      result.push(record.displayName || key);
    }
    return result;
  }, [availableTopics, preferences.topics]);

  const savedCount = useMemo(
    () =>
      allLoadedWithOlder.filter((article) => Boolean(savedArticleIds[article.id]))
        .length,
    [allLoadedWithOlder, savedArticleIds]
  );

  const savedArticles = useMemo(
    () =>
      allLoadedWithOlder.filter((article) => Boolean(savedArticleIds[article.id])),
    [allLoadedWithOlder, savedArticleIds]
  );

  const nonSavedFilteredArticles = useMemo(() => {
    if (selectedTopic) {
      const selectedKey = normalizeTopicKey(selectedTopic);
      return allLoadedArticles.filter((article) =>
        getArticleTags(article).some(
          (tag) => normalizeTopicKey(tag) === selectedKey
        )
      );
    }

    const personalizedArticles = applyTopicPreferences(
      displayedArticles,
      preferences
    );

    if (viewMode === 'today' && personalizedArticles.length > 0) {
      const welcomeCard: Article = {
        id: '__ftue_welcome__',
        date: personalizedArticles[0].date,
        original_url: '',
        image_url: null,
        ai_headline: 'Welcome curious reader!',
        ai_summary: 'No doomscrolling.',
        confidence_score: 1,
        confidence_reasoning: '',
        status: 'published',
        approved_by: null,
      };
      return [welcomeCard, ...personalizedArticles];
    }

    return personalizedArticles;
  }, [
    allLoadedArticles,
    displayedArticles,
    preferences,
    selectedTopic,
    viewMode,
  ]);

  const filteredArticles =
    selectedTopic === SAVED_TOPIC_KEY ? savedArticles : nonSavedFilteredArticles;

  const newspaperArticles = useMemo(
    () => applyTopicPreferences(articles, preferences),
    [articles, preferences]
  );

  const isTodayEdition = viewMode === 'today' && !selectedTopic;
  const hasWelcomePrefix =
    filteredArticles[0]?.id === '__ftue_welcome__';
  const storyCount = filteredArticles.filter(
    (article) => article.id !== '__ftue_welcome__'
  ).length;
  const currentStoryNumber = hasWelcomePrefix
    ? Math.max(0, Math.min(currentIndex, storyCount))
    : Math.min(currentIndex + 1, storyCount);
  const isCaughtUp =
    storyCount > 0 && currentIndex >= filteredArticles.length;
  const progressFraction =
    storyCount > 0
      ? isCaughtUp
        ? 1
        : Math.min(1, Math.max(0, currentStoryNumber / storyCount))
      : 0;
  const progressAnim = useSharedValue(progressFraction);

  useEffect(() => {
    progressAnim.value = withTiming(progressFraction, { duration: 280 });
  }, [progressFraction, progressAnim]);

  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${Math.round(progressAnim.value * 1000) / 10}%`,
  }));

  const effectiveStreakDays = useMemo(() => {
    const todayKey = getLocalDateKey();
    const effectiveState =
      isTodayEdition && isCaughtUp
        ? recordCaughtUpDay(readingStreak, todayKey)
        : readingStreak;
    return getCurrentStreak(effectiveState, todayKey);
  }, [isCaughtUp, isTodayEdition, readingStreak]);

  const latestEditionDate = articles[0]?.date ?? null;
  const nextEditionText = useMemo(() => {
    if (!isTodayEdition || !isCaughtUp) return undefined;
    return getNextEditionLocalTimeText({ latestEditionDate });
  }, [isCaughtUp, isTodayEdition, latestEditionDate]);

  const handleIndexChange = (index: number) => {
    setCurrentIndex(index);
    if (index > 0 && showOnboardingTips) {
      markOnboardingComplete();
    }
    if (
      isTodayEdition &&
      storyCount > 0 &&
      index >= filteredArticles.length
    ) {
      const todayKey = getLocalDateKey();
      setReadingStreak((prev) => {
        if (prev.completedDates.includes(todayKey)) return prev;
        const next = recordCaughtUpDay(prev, todayKey);
        saveReadingStreak(next);
        return next;
      });
    }
  };

  const handleSelectTopic = (topic: string | null) => {
    if (showOnboardingTips) {
      markOnboardingComplete();
      setShowOnboardingTips(false);
    }
    setSelectedTopic(topic);
    setCurrentIndex(0);
    setDeckResetToken((prev) => prev + 1);
    setMenuOpen(false);
  };

  const handleReturnToToday = () => {
    setViewMode('today');
    setSelectedTopic(null);
    setCurrentIndex(0);
    setDeckResetToken((prev) => prev + 1);
    setMenuOpen(false);
  };

  const handleSelectOlderNews = async () => {
    setViewMode('older');
    setSelectedTopic(null);
    setCurrentIndex(0);
    setDeckResetToken((prev) => prev + 1);
    await loadOlderArticles();
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-paper items-center justify-center p-6">
        <ActivityIndicator size="large" color="#0D9488" />
        <Text className="text-[16px] text-stone-500 mt-3.5">
          Loading today&apos;s edition...
        </Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-paper items-center justify-center p-6">
        <View className="bg-white border border-red-200/80 rounded-3xl p-6 max-w-md w-full">
          <Text className="text-[18px] font-semibold text-red-800 mb-1.5">
            Unable to load stories
          </Text>
          <Text className="text-[15px] leading-[22px] text-red-700/85">
            {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (articles.length === 0 && viewMode === 'today') {
    return (
      <SafeAreaView className="flex-1 bg-paper items-center justify-center p-6">
        <View className="bg-white border border-stone-200/80 rounded-[28px] p-8 max-w-md w-full items-center">
          <Text className="text-[22px] font-bold text-ink text-center tracking-[-0.3px] mb-2">
            {APP_CONFIG.preparingBanner}
          </Text>
          <Text className="text-[15.5px] leading-[23px] text-stone-500 text-center">
            Our editors are reviewing today&apos;s stories. Please check back
            shortly.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (useNewspaperLayout) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <NewspaperFrontPage
          articles={newspaperArticles}
          isShowingFallback={isShowingFallback}
          olderArticles={olderArticles}
          loadingOlder={loadingOlder}
          hasMoreOlder={hasMoreOlder}
          onLoadOlder={loadMoreOlderArticles}
          articleVotes={articleVotes}
          onVoteArticle={voteArticle}
        />
      </SafeAreaView>
    );
  }

  const headerTitle =
    selectedTopic === SAVED_TOPIC_KEY
      ? 'Saved for later'
      : selectedTopic
        ? `What's up, ${selectedTopic}?`
        : viewMode === 'today'
          ? "What's up, today?"
          : "What's up?";
  const activeArticle = filteredArticles[currentIndex];
  const activeBgImage = showImages
    ? (activeArticle?.image_url ?? null)
    : null;
  const activeBgTint = getTopicVisual(activeArticle?.topic)?.color ?? null;
  const showHeaderProgress = isTodayEdition && storyCount > 0;
  const progressAccentColor = isCaughtUp ? '#2DD4BF' : (activeBgTint ?? '#2DD4BF');
  const editionDateLabel = articles[0]?.date
    ? formatEditionDate(articles[0].date, 'full')
    : new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <View
      className="consumer-mobile-reader"
      style={{
        flex: 1,
        backgroundColor: '#141821',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Unified Ambient Blurred Header-Image Glass Background */}
      {activeBgImage ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            zIndex: 0,
          }}
        >
          <Image
            source={{ uri: activeBgImage }}
            recyclingKey={activeBgImage}
            contentFit="cover"
            blurRadius={Platform.OS === 'web' ? 0 : 12}
            transition={Platform.OS === 'web' ? 250 : 0}
            style={{
              position: 'absolute',
              top: -24,
              left: -24,
              right: -24,
              bottom: -24,
              ...(Platform.OS === 'web'
                ? ({
                  filter: 'blur(22px) saturate(1.45) contrast(1.06)',
                  transform: 'scale(1.1)',
                } as Record<string, unknown>)
                : {}),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(20, 24, 33, 0.54)',
            }}
          />
        </View>
      ) : activeBgTint ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
            zIndex: 0,
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: -80,
              right: -60,
              width: 320,
              height: 320,
              borderRadius: 999,
              backgroundColor: activeBgTint,
              opacity: 0.16,
              ...(Platform.OS === 'web'
                ? ({ filter: 'blur(72px)' } as Record<string, unknown>)
                : {}),
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: -80,
              left: -60,
              width: 280,
              height: 280,
              borderRadius: 999,
              backgroundColor: activeBgTint,
              opacity: 0.12,
              ...(Platform.OS === 'web'
                ? ({ filter: 'blur(80px)' } as Record<string, unknown>)
                : {}),
            }}
          />
        </View>
      ) : null}

      {/* Left Push Drawer */}
      <Animated.View
        pointerEvents={menuOpen ? 'auto' : 'none'}
        style={[
          drawerSlideStyle,
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: drawerWidth,
            backgroundColor: 'transparent',
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 36,
            zIndex: 1,
            justifyContent: 'space-between',
          },
        ]}
      >
        {/* Top Area: Wordmark + Date */}
        <Pressable
          onPress={handleReturnToToday}
          accessibilityRole="button"
          accessibilityLabel="Restart today's news"
          style={{
            paddingHorizontal: 30,
            paddingBottom: 24,
            ...(Platform.OS === 'web'
              ? ({ cursor: 'pointer' } as Record<string, unknown>)
              : {}),
          }}
        >
          <View
            style={{
              minHeight: 36,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Image
              source={require('@/assets/images/clempo-logo.png')}
              contentFit="contain"
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                gap: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  color: '#fefaef',
                  letterSpacing: -0.45,
                  fontFamily: SANS_BOLD,
                }}
                numberOfLines={1}
              >
                Clempo
              </Text>
              <View style={{ alignItems: 'center' }}>
                <Text
                  style={{
                    color: '#2DD4BF',
                    fontSize: 18,
                    fontWeight: '500',
                    letterSpacing: -0.1,
                    fontFamily: SANS_MEDIUM,
                  }}
                  numberOfLines={1}
                >
                  News
                </Text>
                <Svg
                  width={44}
                  height={6}
                  viewBox="0 0 44 6"
                  style={{ marginTop: -2 }}
                >
                  <Path
                    d="M 1.5 4.4 Q 15 1.1, 27 3.0 T 42.5 2.0"
                    stroke="#2DD4BF"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    fill="none"
                  />
                </Svg>
              </View>
            </View>
          </View>
          <Text
            style={{
              marginTop: 4,
              fontSize: 11,
              fontWeight: '400',
              fontFamily: SANS_MEDIUM,
              color: 'rgba(250, 249, 246, 0.52)',
            }}
            numberOfLines={1}
          >
            {editionDateLabel}
          </Text>
        </Pressable>

        {/* Middle Area: Scrollable Topic List with bottom fade */}
        <View
          style={{
            flex: 1,
            ...(Platform.OS === 'web'
              ? ({
                maskImage:
                  'linear-gradient(to bottom, black 0%, black calc(100% - 28px), transparent 100%)',
                WebkitMaskImage:
                  'linear-gradient(to bottom, black 0%, black calc(100% - 28px), transparent 100%)',
              } as Record<string, unknown>)
              : {}),
          }}
        >
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 4,
              paddingBottom: 28,
              gap: 6,
            }}
          >
            <Pressable
              onPress={() => handleSelectTopic(null)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 11,
                paddingHorizontal: 14,
                borderRadius: 999,
                backgroundColor:
                  selectedTopic === null
                    ? 'rgba(255, 255, 255, 0.16)'
                    : 'transparent',
                ...(Platform.OS === 'web'
                  ? ({ cursor: 'pointer' } as Record<string, unknown>)
                  : {}),
              }}
            >
              {(() => {
                const allVisual = getAllTopicsVisual();
                return allVisual ? (
                  <View style={{ marginRight: 11 }}>
                    <TopicIcon
                      name={allVisual.icon}
                      color={
                        selectedTopic === null
                          ? allVisual.color
                          : 'rgba(250, 249, 246, 0.72)'
                      }
                      size={15}
                    />
                  </View>
                ) : null;
              })()}
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: selectedTopic === null ? '700' : '500',
                  fontFamily:
                    selectedTopic === null ? SANS_BOLD : SANS_MEDIUM,
                  color:
                    selectedTopic === null
                      ? '#FFFFFF'
                      : 'rgba(250, 249, 246, 0.85)',
                }}
              >
                All Topics
              </Text>
            </Pressable>

            {savedCount > 0 || selectedTopic === SAVED_TOPIC_KEY ? (
              <Pressable
                onPress={() => handleSelectTopic(SAVED_TOPIC_KEY)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor:
                    selectedTopic === SAVED_TOPIC_KEY
                      ? 'rgba(255, 255, 255, 0.16)'
                      : 'transparent',
                  ...(Platform.OS === 'web'
                    ? ({ cursor: 'pointer' } as Record<string, unknown>)
                    : {}),
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ marginRight: 11 }}>
                    <BookmarkIcon
                      filled={selectedTopic === SAVED_TOPIC_KEY}
                      color={
                        selectedTopic === SAVED_TOPIC_KEY
                          ? '#2DD4BF'
                          : 'rgba(250, 249, 246, 0.72)'
                      }
                      size={15}
                    />
                  </View>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight:
                        selectedTopic === SAVED_TOPIC_KEY ? '700' : '500',
                      fontFamily:
                        selectedTopic === SAVED_TOPIC_KEY
                          ? SANS_BOLD
                          : SANS_MEDIUM,
                      color:
                        selectedTopic === SAVED_TOPIC_KEY
                          ? '#FFFFFF'
                          : 'rgba(250, 249, 246, 0.85)',
                    }}
                  >
                    Saved for later
                  </Text>
                </View>
                <View
                  style={{
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                    borderRadius: 999,
                    backgroundColor: 'rgba(45, 212, 191, 0.18)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      fontFamily: SANS_BOLD,
                      color: '#2DD4BF',
                    }}
                  >
                    {savedCount}
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {availableTopics.map((topic) => {
              const isSelected = selectedTopic === topic;
              const visual = getTopicVisual(topic);
              const signalStatus = getSignalStatus(topic);
              const isMuted = signalStatus === 'off';
              return (
                <View
                  key={topic}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderRadius: 999,
                    backgroundColor: isSelected
                      ? 'rgba(255, 255, 255, 0.16)'
                      : 'transparent',
                  }}
                >
                  <Pressable
                    onPress={() => handleSelectTopic(topic)}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingLeft: 14,
                      paddingRight: 8,
                      minWidth: 0,
                      opacity: isMuted ? 0.55 : 1,
                      ...(Platform.OS === 'web'
                        ? ({ cursor: 'pointer' } as Record<string, unknown>)
                        : {}),
                    }}
                  >
                    {visual ? (
                      <View style={{ marginRight: 11 }}>
                        <TopicIcon
                          name={visual.icon}
                          color={isMuted ? 'rgba(250, 249, 246, 0.45)' : visual.color}
                          size={15}
                        />
                      </View>
                    ) : null}
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: isSelected ? '700' : '500',
                        fontFamily: isSelected ? SANS_BOLD : SANS_MEDIUM,
                        color: isSelected
                          ? '#FFFFFF'
                          : 'rgba(250, 249, 246, 0.85)',
                        flexShrink: 1,
                      }}
                      numberOfLines={1}
                    >
                      {topic}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setInspectedTopic(topic)}
                    accessibilityLabel={`${topic} topic signal`}
                    hitSlop={8}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      marginRight: 8,
                      justifyContent: 'center',
                      alignItems: 'center',
                      ...(Platform.OS === 'web'
                        ? ({ cursor: 'pointer' } as Record<string, unknown>)
                        : {}),
                    }}
                  >
                    <TopicSignalIcon
                      status={signalStatus}
                      size={14}
                      boostedColor={visual?.color ?? '#34D399'}
                    />
                  </Pressable>
                </View>
              );
            })}

            {tunedSecondaryTags.length > 0 ? (
              <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: '600',
                    fontFamily: SANS_SEMIBOLD,
                    letterSpacing: 0.7,
                    color: 'rgba(250, 249, 246, 0.65)',
                    paddingHorizontal: 14,
                    marginBottom: 6,
                  }}
                >
                  Tuned tags
                </Text>
                {tunedSecondaryTags.map((tag) => {
                  const isSelected = selectedTopic === tag;
                  const signalStatus = getSignalStatus(tag);
                  const isMuted = signalStatus === 'off';
                  return (
                    <View
                      key={tag}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderRadius: 14,
                        backgroundColor: isSelected
                          ? 'rgba(255, 255, 255, 0.14)'
                          : 'transparent',
                      }}
                    >
                      <Pressable
                        onPress={() => handleSelectTopic(tag)}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 10,
                          paddingLeft: 14,
                          paddingRight: 8,
                          minWidth: 0,
                          opacity: isMuted ? 0.55 : 1,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14.5,
                            fontWeight: isSelected ? '700' : '500',
                            fontFamily: isSelected ? SANS_BOLD : SANS_MEDIUM,
                            color: isSelected
                              ? '#FFFFFF'
                              : 'rgba(250, 249, 246, 0.8)',
                            flexShrink: 1,
                          }}
                          numberOfLines={1}
                        >
                          #{tag}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setInspectedTopic(tag)}
                        accessibilityLabel={`${tag} tag signal`}
                        hitSlop={8}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 999,
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          marginRight: 8,
                          justifyContent: 'center',
                          alignItems: 'center',
                          ...(Platform.OS === 'web'
                            ? ({ cursor: 'pointer' } as Record<string, unknown>)
                            : {}),
                        }}
                      >
                        <TopicSignalIcon status={signalStatus} size={13} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>
        </View>

        <View
          style={{
            height: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            marginHorizontal: 30,
          }}
        />

        {/* Bottom Area: Settings Group (Font Size Control + Image Toggle + Support) */}
        <View
          style={{
            paddingTop: 18,
            paddingHorizontal: 30,
            gap: 18,
          }}
        >
          <Text
            style={{
              fontSize: 11.5,
              fontWeight: '600',
              fontFamily: SANS_SEMIBOLD,
              letterSpacing: 0.7,
              color: 'rgba(250, 249, 246, 0.56)',
              marginBottom: -6,
            }}
          >
            Settings
          </Text>
          {/* Font Size Slider / Stepper */}
          <View style={{ gap: 10 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  fontSize: 14.5,
                  fontWeight: '500',
                  fontFamily: SANS_MEDIUM,
                  color: 'rgba(250, 249, 246, 0.88)',
                }}
              >
                Text size
              </Text>
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '600',
                  fontFamily: SANS_SEMIBOLD,
                  color: 'rgba(250, 249, 246, 0.7)',
                }}
              >
                {FONT_SCALE_STEPS.find((s) => Math.abs(s.scale - fontScale) < 0.03)
                  ?.label ?? 'Default'}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 7,
              }}
            >
              <Pressable
                onPress={() => {
                  const idx = FONT_SCALE_STEPS.findIndex(
                    (s) => Math.abs(s.scale - fontScale) < 0.03
                  );
                  const nextIdx = Math.max(0, (idx === -1 ? 1 : idx) - 1);
                  handleChangeFontScale(FONT_SCALE_STEPS[nextIdx].scale);
                }}
                accessibilityLabel="Decrease text size"
                hitSlop={8}
              >
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '700',
                    fontFamily: SANS_BOLD,
                    color: 'rgba(250, 249, 246, 0.85)',
                  }}
                >
                  A-
                </Text>
              </Pressable>

              <View
                style={{
                  flex: 1,
                  height: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'relative',
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    left: 4,
                    right: 4,
                    height: 3,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  }}
                />
                {FONT_SCALE_STEPS.map((step) => {
                  const isActive = Math.abs(step.scale - fontScale) < 0.03;
                  return (
                    <Pressable
                      key={step.label}
                      onPress={() => handleChangeFontScale(step.scale)}
                      accessibilityLabel={`Text size ${step.label}`}
                      accessibilityState={{ selected: isActive }}
                      hitSlop={10}
                      style={{
                        width: 20,
                        height: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: isActive ? 14 : 8,
                          height: isActive ? 14 : 8,
                          borderRadius: 999,
                          backgroundColor: isActive
                            ? '#fefaef'
                            : 'rgba(250, 249, 246, 0.45)',
                          borderWidth: isActive ? 2 : 0,
                          borderColor: '#141821',
                        }}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => {
                  const idx = FONT_SCALE_STEPS.findIndex(
                    (s) => Math.abs(s.scale - fontScale) < 0.03
                  );
                  const nextIdx = Math.min(
                    FONT_SCALE_STEPS.length - 1,
                    (idx === -1 ? 1 : idx) + 1
                  );
                  handleChangeFontScale(FONT_SCALE_STEPS[nextIdx].scale);
                }}
                accessibilityLabel="Increase text size"
                hitSlop={8}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    fontFamily: SANS_BOLD,
                    color: 'rgba(250, 249, 246, 0.92)',
                  }}
                >
                  A+
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            onPress={handleToggleImages}
            accessibilityRole="switch"
            accessibilityState={{ checked: showImages }}
            accessibilityLabel="Show images"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontSize: 14.5,
                fontWeight: '500',
                fontFamily: SANS_MEDIUM,
                color: 'rgba(250, 249, 246, 0.88)',
              }}
            >
              Show images
            </Text>
            <View
              style={{
                width: 40,
                height: 22,
                borderRadius: 999,
                backgroundColor: showImages
                  ? '#fefaef'
                  : 'rgba(255, 255, 255, 0.2)',
                padding: 2,
                justifyContent: 'center',
                alignItems: showImages ? 'flex-end' : 'flex-start',
              }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  backgroundColor: showImages ? '#1C1917' : '#FAF9F6',
                }}
              />
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              setMenuOpen(false);
              Linking.openURL(
                `mailto:${APP_CONFIG.adminEmails[0]}?subject=Clempo%20Support`
              );
            }}
          >
            <Text
              style={{
                fontSize: 14.5,
                fontWeight: '500',
                fontFamily: SANS_MEDIUM,
                color: 'rgba(250, 249, 246, 0.88)',
                textDecorationLine: 'underline',
              }}
            >
              Support
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Main Screen (pushes right when menu opens) */}
      <Animated.View
        style={[
          mainPushStyle,
          {
            flex: 1,
            backgroundColor: 'transparent',
            zIndex: 2,
          },
        ]}
      >
        <SafeAreaView
          className="flex-1 consumer-mobile-reader"
          style={{
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: 'transparent',
          }}
          edges={['top', 'left', 'right']}
        >
          {/* Slim Editorial Header + Integrated Progress Line */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 10,
              paddingBottom: 0,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: '100%',
                maxWidth: 420,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 4,
                  paddingBottom: showHeaderProgress ? 8 : 6,
                  gap: 10,
                }}
              >
                <View className="flex-row items-center gap-3 flex-1 min-w-0">
                  <Pressable
                    onPress={() => setMenuOpen((prev) => !prev)}
                    accessibilityLabel="Open topics menu"
                    hitSlop={12}
                    pointerEvents={menuOpen ? 'none' : 'auto'}
                    style={{
                      paddingVertical: 4,
                      paddingRight: 4,
                      justifyContent: 'center',
                      alignItems: 'center',
                      opacity: menuOpen ? 0 : 1,
                    }}
                  >
                    <View
                      style={{
                        width: 17,
                        gap: 4.5,
                      }}
                    >
                      <View className="h-[1.75px] w-full bg-white rounded-full" />
                      <View className="h-[1.75px] w-full bg-white rounded-full" />
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={handleReturnToToday}
                    accessibilityLabel="Back to today's news"
                    className="flex-1 min-w-0 active:opacity-70"
                  >
                    <Text
                      className="text-[15.5px] font-semibold tracking-[-0.2px]"
                      style={{
                        color: '#FAF9F6',
                        ...(Fonts?.sans
                          ? ({ fontFamily: Fonts.sans } as Record<
                              string,
                              unknown
                            >)
                          : {}),
                      }}
                      numberOfLines={1}
                    >
                      {headerTitle}
                    </Text>
                  </Pressable>
                </View>

                {/* Minimal Tabular Progress Count */}
                {showHeaderProgress ? (
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: isCaughtUp ? '600' : '500',
                      color: isCaughtUp
                        ? '#5EEAD4'
                        : 'rgba(250, 249, 246, 0.78)',
                      fontVariant: ['tabular-nums'],
                      ...(Fonts?.sans
                        ? ({ fontFamily: Fonts.sans } as Record<
                            string,
                            unknown
                          >)
                        : {}),
                    }}
                  >
                    {isCaughtUp
                      ? `✓ Done (${storyCount})`
                      : currentStoryNumber > 0
                        ? `${currentStoryNumber} / ${storyCount}`
                        : `${storyCount} ${storyCount === 1 ? 'story' : 'stories'}`}
                  </Text>
                ) : null}
              </View>

              {/* Hairline Progress Track */}
              {showHeaderProgress ? (
                <View
                  pointerEvents="none"
                  style={{
                    width: '100%',
                    height: 2,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255, 255, 255, 0.16)',
                    overflow: 'hidden',
                  }}
                >
                  <Animated.View
                    style={[
                      progressFillStyle,
                      {
                        height: '100%',
                        borderRadius: 999,
                        backgroundColor: progressAccentColor,
                      },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          </View>

          {/* Main Content */}
          {loadingOlder && viewMode === 'older' ? (
            <View className="flex-1 items-center justify-center p-6">
              <ActivityIndicator size="large" color="#0D9488" />
              <Text className="text-[15px] text-stone-500 mt-3">
                Loading older editions...
              </Text>
            </View>
          ) : filteredArticles.length === 0 ? (
            <View className="flex-1 items-center justify-center px-6">
              <View className="bg-white border border-stone-200/80 rounded-[26px] p-7 max-w-sm w-full items-center">
                <Text className="text-[18px] font-bold text-ink text-center mb-1.5">
                  {selectedTopic === SAVED_TOPIC_KEY
                    ? 'No saved stories yet'
                    : selectedTopic
                      ? `No stories in ${selectedTopic}`
                      : 'No older news yet'}
                </Text>
                <Text className="text-[14.5px] leading-[21px] text-stone-500 text-center mb-5">
                  {selectedTopic === SAVED_TOPIC_KEY
                    ? 'Tap the bookmark icon on any card to save stories for the end of your briefing.'
                    : selectedTopic
                      ? 'Clear the topic filter to return to all news.'
                      : 'Previous editions will appear here once published.'}
                </Text>
                <Pressable
                  onPress={
                    selectedTopic
                      ? () => handleSelectTopic(null)
                      : handleReturnToToday
                  }
                  className="bg-ink rounded-full px-6 py-2.5 active:opacity-80"
                >
                  <Text className="text-white text-[14px] font-semibold">
                    {selectedTopic ? 'Show all topics' : "Back to today's news"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <SwipeCardDeck
              articles={filteredArticles}
              onIndexChange={handleIndexChange}
              activeTopic={
                selectedTopic === SAVED_TOPIC_KEY
                  ? 'Saved for later'
                  : selectedTopic
              }
              onSelectTopic={(topic) => handleSelectTopic(topic)}
              onClearTopic={() => handleSelectTopic(null)}
              showOnboardingTips={
                showOnboardingTips && !selectedTopic && viewMode === 'today'
              }
              showImages={showImages}
              fontScale={fontScale}
              savedArticleIds={savedArticleIds}
              savedCount={savedCount}
              onOpenSavedForLater={
                selectedTopic !== SAVED_TOPIC_KEY && savedCount > 0
                  ? () => handleSelectTopic(SAVED_TOPIC_KEY)
                  : undefined
              }
              onToggleSaveArticle={handleToggleSaveArticle}
              articleVotes={articleVotes}
              onVoteArticle={voteArticle}
              onRequestOlderNews={
                viewMode === 'today' && !selectedTopic
                  ? handleSelectOlderNews
                  : undefined
              }
              streakDays={isTodayEdition ? effectiveStreakDays : undefined}
              nextEditionText={nextEditionText}
              resetToken={deckResetToken}
            />
          )}
        </SafeAreaView>

        {menuOpen ? (
          <Pressable
            onPress={() => setMenuOpen(false)}
            accessibilityLabel="Close topics menu"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 50,
            }}
          />
        ) : null}
      </Animated.View>

      <TopicSignalModal
        topic={inspectedTopic}
        explanation={inspectedTopic ? getExplanation(inspectedTopic) : null}
        onClose={() => setInspectedTopic(null)}
        onResetToNormal={resetTopic}
        onTurnOffCompletely={muteTopic}
      />
    </View>
  );
}
