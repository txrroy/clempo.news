import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdminLoginV3 } from '@/components/admin-v3/AdminLoginV3';
import { NewsCollectorDrawerV3 } from '@/components/admin-v3/NewsCollectorDrawerV3';
import {
  V3Button,
  V3Text,
  V3UserAvatar,
} from '@/components/admin-v3/primitives';
import {
  SettingsV3,
  type V3SettingsTab,
} from '@/components/admin-v3/SettingsV3';
import { StoryDetailDrawerV3 } from '@/components/admin-v3/StoryDetailDrawerV3';
import { SystemV3 } from '@/components/admin-v3/SystemV3';
import { V3_COLORS, V3_SPACE } from '@/components/admin-v3/tokens';
import { WorkbenchV3 } from '@/components/admin-v3/WorkbenchV3';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useAdminArticles } from '@/hooks/useArticles';
import {
  useAgentPolicy,
  useLatestPipelineRun,
  useSourcesConfig,
} from '@/hooks/useGovernance';

type V3NavId = 'workbench' | 'system' | 'settings';

const V3_NAV_ITEMS: { id: V3NavId; label: string }[] = [
  { id: 'workbench', label: 'Workbench' },
  { id: 'system', label: 'System' },
  { id: 'settings', label: 'Settings' },
];

export default function AdminDashboardScreen() {
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
    confirmSourceChecked,
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

  const [activeNav, setActiveNav] = useState<V3NavId>('workbench');
  const [settingsTab, setSettingsTab] = useState<V3SettingsTab>('sources');
  const [collectionTimeUtc, setCollectionTimeUtc] = useState('06:00 UTC');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    null
  );
  const [collectorOpen, setCollectorOpen] = useState(false);

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

  const editionArticles = useMemo(
    () => articles.filter((a) => a.date === effectiveEditionDate),
    [articles, effectiveEditionDate]
  );

  const selectedArticle = useMemo(
    () => articles.find((a) => a.id === selectedArticleId) ?? null,
    [articles, selectedArticleId]
  );

  const selectedIdx = selectedArticleId
    ? editionArticles.findIndex((a) => a.id === selectedArticleId)
    : -1;

  if (authLoading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: V3_COLORS.canvas,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <V3Text role="mono">LOADING SESSION...</V3Text>
      </SafeAreaView>
    );
  }

  if (!user || !isAuthorized) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: V3_COLORS.canvas }}>
        <AdminLoginV3
          authError={authError}
          unauthorizedEmail={user && !isAuthorized ? user.email ?? null : null}
          onSignIn={signIn}
          onGoogleSignIn={signInWithGoogle}
          onSignOut={logOut}
        />
      </SafeAreaView>
    );
  }

  const userEmail = user.email ?? '';
  const enabledSourcesCount = sources.filter((s) => s.enabled).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: V3_COLORS.canvas }}>
      {/* Minimal 3-Item Top Nav + Google Photo Avatar */}
      <View
        style={{
          backgroundColor: V3_COLORS.surface,
          borderBottomWidth: 1,
          borderBottomColor: V3_COLORS.border,
          paddingHorizontal: V3_SPACE.xxl,
          paddingVertical: V3_SPACE.md,
        }}
      >
        <View
          style={{
            maxWidth: 1180,
            width: '100%',
            alignSelf: 'center',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: V3_SPACE.md,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: V3_SPACE.xl,
              flexWrap: 'wrap',
            }}
          >
            <V3Text role="headline" weight="700">
              SnappyLit
            </V3Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: V3_SPACE.lg,
              }}
            >
              {V3_NAV_ITEMS.map((item) => {
                const active = activeNav === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setActiveNav(item.id)}
                    style={{
                      paddingVertical: V3_SPACE.xs,
                      borderBottomWidth: 2,
                      borderBottomColor: active
                        ? V3_COLORS.green
                        : 'transparent',
                    }}
                  >
                    <V3Text role="kicker" tone={active ? 'ink' : 'muted'}>
                      {item.label}
                    </V3Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: V3_SPACE.md,
            }}
          >
            <V3UserAvatar
              photoURL={user.photoURL}
              fallbackName={user.displayName || userEmail}
            />
            <V3Button
              label="Sign out"
              variant="outline"
              size="sm"
              onPress={logOut}
            />
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: V3_COLORS.canvas }}
        contentContainerStyle={{
          maxWidth: 1180,
          width: '100%',
          alignSelf: 'center',
          paddingHorizontal: V3_SPACE.xxl,
          paddingVertical: V3_SPACE.xl,
          paddingBottom: V3_SPACE.xxl * 2,
        }}
      >
        {articlesError ? (
          <V3Text role="body" tone="red" style={{ marginBottom: V3_SPACE.lg }}>
            {articlesError}
          </V3Text>
        ) : null}

        {articlesLoading ? (
          <V3Text role="mono">LOADING EDITION...</V3Text>
        ) : activeNav === 'workbench' ? (
          <WorkbenchV3
            articles={articles}
            today={effectiveEditionDate}
            activePolicy={activePolicy}
            latestRunLog={latestRunLog}
            enabledSourcesCount={enabledSourcesCount}
            collectionScheduleLabel={collectionTimeUtc}
            onStartCollecting={() => setCollectorOpen(true)}
            onViewDetails={(id) => setSelectedArticleId(id)}
            onApproveArticle={(a) =>
              approveArticle(a.id, a.ai_headline, a.ai_summary, user.uid)
            }
            onRejectArticle={(a) => rejectArticle(a.id)}
          />
        ) : activeNav === 'system' ? (
          <SystemV3
            activePolicy={activePolicy}
            sources={sources}
            articles={articles}
            isAdmin={isAdmin}
            userEmail={userEmail}
            onSaveVersion={savePolicyVersion}
            onOpenSettingsTab={(tab) => {
              setSettingsTab(tab);
              setActiveNav('settings');
            }}
          />
        ) : (
          <SettingsV3
            activeTab={settingsTab}
            onChangeTab={setSettingsTab}
            activePolicy={activePolicy}
            versions={versions}
            isAdmin={isAdmin}
            userEmail={userEmail}
            onRollback={rollbackToVersion}
            sources={sources}
            onToggleSource={toggleSource}
            onAddSource={addSource}
            onRemoveSource={removeSource}
            onResetDefaults={resetDefaults}
            collectionTimeUtc={collectionTimeUtc}
            onChangeCollectionTimeUtc={setCollectionTimeUtc}
          />
        )}
      </ScrollView>

      <StoryDetailDrawerV3
        article={selectedArticle}
        adminUid={user.uid}
        hasPrev={selectedIdx > 0}
        hasNext={
          selectedIdx >= 0 && selectedIdx < editionArticles.length - 1
        }
        getIdToken={getIdToken}
        onPrev={() => {
          if (selectedIdx > 0) {
            setSelectedArticleId(editionArticles[selectedIdx - 1].id);
          }
        }}
        onNext={() => {
          if (
            selectedIdx >= 0 &&
            selectedIdx < editionArticles.length - 1
          ) {
            setSelectedArticleId(editionArticles[selectedIdx + 1].id);
          }
        }}
        onClose={() => setSelectedArticleId(null)}
        onSaveChanges={saveChanges}
        onApprove={approveArticle}
        onReject={rejectArticle}
        onUnpublish={unpublishArticle}
        onConfirmSourceChecked={confirmSourceChecked}
      />

      <NewsCollectorDrawerV3
        visible={collectorOpen}
        getIdToken={getIdToken}
        onClose={() => setCollectorOpen(false)}
        onOpenArticle={(id) => {
          setCollectorOpen(false);
          setSelectedArticleId(id);
        }}
      />
    </SafeAreaView>
  );
}
