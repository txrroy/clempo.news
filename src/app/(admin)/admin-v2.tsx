import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdminLoginV2 } from '@/components/admin-v2/AdminLoginV2';
import { ArticleReviewModalV2 } from '@/components/admin-v2/ArticleReviewModalV2';
import { DesignSystemV2 } from '@/components/admin-v2/DesignSystemV2';
import { HowItWorksV2 } from '@/components/admin-v2/HowItWorksV2';
import {
  InboxV2,
  type InboxFolderV2,
} from '@/components/admin-v2/InboxV2';
import { OverviewV2 } from '@/components/admin-v2/OverviewV2';
import {
  V2InlineLink,
  V2Text,
} from '@/components/admin-v2/primitives';
import {
  SettingsV2,
  type SettingsSubTabV2,
} from '@/components/admin-v2/SettingsV2';
import {
  sortByLowestScoreThenOldest,
  V2_COLORS,
  V2_SPACE,
} from '@/components/admin-v2/tokens';
import { LivePipelineDrawer } from '@/components/admin/LivePipelineDrawer';
import { DSThemeProvider } from '@/design-system';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAdminArticles } from '@/hooks/useArticles';
import {
  useAgentPolicy,
  useLatestPipelineRun,
  useSourcesConfig,
} from '@/hooks/useGovernance';

type ViewId =
  | 'overview'
  | 'inbox'
  | 'how-it-works'
  | 'design-system'
  | 'settings';

const NAV_ITEMS: { id: ViewId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'inbox', label: 'Approval inbox' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'design-system', label: 'Design system' },
  { id: 'settings', label: 'Settings' },
];

export default function AdminV2Screen() {
  const {
    user,
    loading: authLoading,
    isAuthorized,
    isAdmin,
    authError,
    signIn,
    signInWithGoogle,
    logOut,
    getIdToken,
  } = useAdminAuth();

  const {
    articles,
    loading: articlesLoading,
    error: articlesError,
    saveChanges,
    approveArticle,
    rejectArticle,
    unpublishArticle,
  } = useAdminArticles(isAuthorized);

  const {
    activePolicy,
    versions,
    savePolicyVersion,
    rollbackToVersion,
  } = useAgentPolicy(isAuthorized);

  const {
    sources,
    toggleSource,
    addSource,
    removeSource,
    resetDefaults,
  } = useSourcesConfig(isAuthorized);

  const latestRunLog = useLatestPipelineRun(isAuthorized);

  const [activeView, setActiveView] = useState<ViewId>('overview');
  const [inboxFolder, setInboxFolder] = useState<InboxFolderV2>('pending');
  const [settingsSubTab, setSettingsSubTab] =
    useState<SettingsSubTabV2>('policy');
  const [livePipelineOpen, setLivePipelineOpen] = useState(false);

  const [reviewQueueIds, setReviewQueueIds] = useState<string[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    null
  );

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const effectiveEditionDate = useMemo(() => {
    if (articles.some((a) => a.date === today)) {
      return today;
    }
    let latest = '';
    for (const a of articles) {
      if (!latest || a.date > latest) {
        latest = a.date;
      }
    }
    return latest || today;
  }, [articles, today]);

  const pendingIds = useMemo(
    () =>
      articles
        .filter((a) => a.status === 'draft')
        .sort(sortByLowestScoreThenOldest)
        .map((a) => a.id),
    [articles]
  );

  const selectedArticle = useMemo(
    () => articles.find((a) => a.id === selectedArticleId) ?? null,
    [articles, selectedArticleId]
  );

  const activeQueue =
    reviewQueueIds.length > 0 ? reviewQueueIds : pendingIds;
  const currentIndex = selectedArticleId
    ? activeQueue.indexOf(selectedArticleId)
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext =
    currentIndex >= 0 && currentIndex < activeQueue.length - 1;
  const positionLabel =
    currentIndex >= 0
      ? `Story ${currentIndex + 1} of ${activeQueue.length}`
      : undefined;

  const userEmail = user?.email ?? '';
  const userUid = user?.uid ?? '';
  const handleQuickApprove = async (articleId: string) => {
    const found = articles.find((a) => a.id === articleId);
    if (!found) return;
    await approveArticle(
      found.id,
      found.ai_headline,
      found.ai_summary,
      userUid
    );
  };
  const userHandle = userEmail ? userEmail.split('@')[0] : 'editor';
  const enabledSourcesCount = useMemo(
    () => sources.filter((s) => s.enabled).length,
    [sources]
  );

  if (authLoading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: V2_COLORS.ground,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <V2Text variant="body" tone="muted">
          Loading session...
        </V2Text>
      </SafeAreaView>
    );
  }

  if (!user || !isAuthorized) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: V2_COLORS.ground }}>
        <AdminLoginV2
          authError={authError}
          unauthorizedEmail={user && !isAuthorized ? user.email ?? null : null}
          onSignIn={signIn}
          onGoogleSignIn={signInWithGoogle}
          onSignOut={logOut}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: V2_COLORS.ground }}>
      {/* Top Navigation */}
      <View
        style={{
          backgroundColor: V2_COLORS.ground,
          borderBottomWidth: 1,
          borderBottomColor: V2_COLORS.line,
        }}
      >
        <View
          style={{
            maxWidth: V2_SPACE.pageMaxWidth,
            width: '100%',
            alignSelf: 'center',
            paddingHorizontal: V2_SPACE.pageSidePadding,
            paddingTop: 14,
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: V2_SPACE.gapLg,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: V2_SPACE.gapLg,
            }}
          >
            <V2Text
              variant="body"
              weight="600"
              style={{ paddingBottom: 14 }}
            >
              SnappyLit Studio
            </V2Text>

            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: V2_SPACE.gapLg,
              }}
            >
              {NAV_ITEMS.map((item) => {
                const active = activeView === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setActiveView(item.id)}
                    style={{
                      paddingBottom: 12,
                      borderBottomWidth: 2,
                      borderBottomColor: active
                        ? V2_COLORS.ink
                        : 'transparent',
                    }}
                  >
                    <V2Text
                      variant="body"
                      weight={active ? '600' : '500'}
                      tone={active ? 'ink' : 'muted'}
                    >
                      {item.label}
                    </V2Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: V2_SPACE.gapMd,
              paddingBottom: 14,
            }}
          >
            <V2Text variant="meta">{userHandle}</V2Text>
            <V2InlineLink label="Sign out" onPress={logOut} />
          </View>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        style={{ flex: 1, backgroundColor: V2_COLORS.ground }}
        contentContainerStyle={{
          maxWidth: V2_SPACE.pageMaxWidth,
          width: '100%',
          alignSelf: 'center',
          paddingHorizontal: V2_SPACE.pageSidePadding,
          paddingVertical: 40,
        }}
      >
        {articlesError ? (
          <V2Text
            variant="body"
            tone="unverified"
            style={{ marginBottom: 24 }}
          >
            {articlesError}
          </V2Text>
        ) : null}

        {articlesLoading ? (
          <V2Text variant="body" tone="muted">
            Loading edition...
          </V2Text>
        ) : activeView === 'overview' ? (
          <OverviewV2
            articles={articles}
            today={effectiveEditionDate}
            activePolicy={activePolicy}
            latestRunLog={latestRunLog}
            enabledSourcesCount={enabledSourcesCount}
            onReviewArticle={(id) => {
              setReviewQueueIds(pendingIds);
              setSelectedArticleId(id);
            }}
            onReviewAllPending={() => {
              if (pendingIds.length > 0) {
                setReviewQueueIds(pendingIds);
                setSelectedArticleId(pendingIds[0]);
              }
            }}
            onViewAllPending={() => {
              setInboxFolder('pending');
              setActiveView('inbox');
            }}
            onApproveArticle={handleQuickApprove}
            onViewPublished={() => {
              setInboxFolder('published-today');
              setActiveView('inbox');
            }}
            onViewHistory={() => {
              setInboxFolder('all-published');
              setActiveView('inbox');
            }}
            onOpenLivePipeline={() => setLivePipelineOpen(true)}
            onOpenAutonomySettings={() => {
              setSettingsSubTab('policy');
              setActiveView('settings');
            }}
          />
        ) : activeView === 'inbox' ? (
          <InboxV2
            articles={articles}
            today={effectiveEditionDate}
            folder={inboxFolder}
            onChangeFolder={setInboxFolder}
            onReviewArticle={(id, orderedIds) => {
              setReviewQueueIds(orderedIds);
              setSelectedArticleId(id);
            }}
            onApproveArticle={handleQuickApprove}
            onUnpublishArticle={(id) => unpublishArticle(id)}
          />
        ) : activeView === 'how-it-works' ? (
          <HowItWorksV2
            activePolicy={activePolicy}
            enabledSourcesCount={enabledSourcesCount}
            onOpenSettings={() => {
              setSettingsSubTab('policy');
              setActiveView('settings');
            }}
          />
        ) : activeView === 'design-system' ? (
          <DesignSystemV2 />
        ) : (
          <SettingsV2
            key={activePolicy.active_version}
            subTab={settingsSubTab}
            onChangeSubTab={setSettingsSubTab}
            activePolicy={activePolicy}
            versions={versions}
            sources={sources}
            articles={articles}
            isAdmin={isAdmin}
            userEmail={userEmail}
            onSavePolicyVersion={savePolicyVersion}
            onRollbackPolicy={rollbackToVersion}
            onToggleSource={toggleSource}
            onAddSource={addSource}
            onRemoveSource={removeSource}
            onResetSources={resetDefaults}
          />
        )}
      </ScrollView>

      {/* Review & Edit Modal */}
      <ArticleReviewModalV2
        key={selectedArticle?.id ?? 'none'}
        article={selectedArticle}
        positionLabel={positionLabel}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={() => {
          if (hasPrev) setSelectedArticleId(activeQueue[currentIndex - 1]);
        }}
        onNext={() => {
          if (hasNext) setSelectedArticleId(activeQueue[currentIndex + 1]);
        }}
        onClose={() => setSelectedArticleId(null)}
        onSaveChanges={(id, nextHeadline, nextSummary) =>
          saveChanges(id, nextHeadline, nextSummary)
        }
        onApprove={(id, nextHeadline, nextSummary) =>
          approveArticle(id, nextHeadline, nextSummary, userUid)
        }
        onReject={(id) => rejectArticle(id)}
        onUnpublish={(id) => unpublishArticle(id)}
      />

      {/* Live Pipeline Runner */}
      {livePipelineOpen ? (
        <DSThemeProvider initialTheme="warm-editorial">
          <LivePipelineDrawer
            visible={livePipelineOpen}
            getIdToken={getIdToken}
            onClose={() => setLivePipelineOpen(false)}
            onOpenArticle={(id) => {
              setLivePipelineOpen(false);
              setReviewQueueIds(pendingIds);
              setSelectedArticleId(id);
            }}
          />
        </DSThemeProvider>
      ) : null}
    </SafeAreaView>
  );
}
