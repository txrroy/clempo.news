import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type {
  ActivePolicyDoc,
  Article,
  PolicySettings,
  PolicyTone,
  PolicyVersion,
  ReadingLevel,
  RssSourceConfig,
} from '@/types/article';
import {
  V2Button,
  V2Divider,
  V2InlineLink,
  V2Input,
  V2Text,
} from './primitives';
import { formatUtcTimestamp, V2_COLORS, V2_SPACE } from './tokens';

export type SettingsSubTabV2 = 'policy' | 'sources' | 'analytics';

interface SettingsV2Props {
  subTab: SettingsSubTabV2;
  onChangeSubTab: (tab: SettingsSubTabV2) => void;
  activePolicy: ActivePolicyDoc;
  versions: PolicyVersion[];
  sources: RssSourceConfig[];
  articles: Article[];
  isAdmin: boolean;
  userEmail: string;
  onSavePolicyVersion: (params: {
    settings: PolicySettings;
    adminInstructions: string;
    changeNote: string;
    userEmail: string;
    isAdmin: boolean;
  }) => Promise<string | void>;
  onRollbackPolicy: (
    targetVersion: PolicyVersion,
    userEmail: string,
    isAdmin: boolean
  ) => Promise<string | void>;
  onToggleSource: (name: string, userEmail: string) => Promise<void>;
  onAddSource: (
    name: string,
    url: string,
    userEmail: string
  ) => Promise<void>;
  onRemoveSource: (name: string, userEmail: string) => Promise<void>;
  onResetSources: (userEmail: string) => Promise<void>;
}

const READING_LEVELS: ReadingLevel[] = [
  'grade 4',
  'grade 5',
  'grade 6',
  'grade 7',
  'grade 8',
];

const TONES: { value: PolicyTone; label: string }[] = [
  { value: 'calm_neutral', label: 'Calm neutral' },
  { value: 'curious_educator', label: 'Curious educator' },
  { value: 'concise_wire', label: 'Concise wire' },
];

export function SettingsV2({
  subTab,
  onChangeSubTab,
  activePolicy,
  versions,
  sources,
  articles,
  isAdmin,
  userEmail,
  onSavePolicyVersion,
  onRollbackPolicy,
  onToggleSource,
  onAddSource,
  onRemoveSource,
  onResetSources,
}: SettingsV2Props) {
  const [draftSettings, setDraftSettings] = useState<PolicySettings>(
    activePolicy.settings
  );
  const [instructions, setInstructions] = useState(
    activePolicy.admin_instructions
  );
  const [changeNote, setChangeNote] = useState('');
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyNotice, setPolicyNotice] = useState<string | null>(null);

  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [sourceNotice, setSourceNotice] = useState<string | null>(null);

  const analyticsRows = useMemo(() => {
    const map = new Map<
      string,
      {
        version: string;
        total: number;
        published: number;
        rejected: number;
        confidenceSum: number;
        flagged: number;
      }
    >();

    for (const a of articles) {
      const ver = a.prompt_version || 'unversioned';
      const entry = map.get(ver) ?? {
        version: ver,
        total: 0,
        published: 0,
        rejected: 0,
        confidenceSum: 0,
        flagged: 0,
      };
      entry.total += 1;
      if (a.status === 'published') entry.published += 1;
      if (a.status === 'rejected') entry.rejected += 1;
      entry.confidenceSum += a.confidence_score ?? 0;
      if ((a.flags?.length ?? 0) > 0) entry.flagged += 1;
      map.set(ver, entry);
    }

    return Array.from(map.values()).sort((a, b) =>
      b.version.localeCompare(a.version)
    );
  }, [articles]);

  const handleSavePolicy = async () => {
    setSavingPolicy(true);
    setPolicyNotice(null);
    try {
      await onSavePolicyVersion({
        settings: draftSettings,
        adminInstructions: instructions,
        changeNote: changeNote.trim() || 'Updated editorial settings',
        userEmail,
        isAdmin,
      });
      setChangeNote('');
      setPolicyNotice('Saved new policy version.');
    } catch (err) {
      setPolicyNotice(
        err instanceof Error ? err.message : 'Failed to save policy.'
      );
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleAddSource = async () => {
    if (!newSourceName.trim() || !newSourceUrl.trim()) return;
    setSourceNotice(null);
    try {
      await onAddSource(newSourceName.trim(), newSourceUrl.trim(), userEmail);
      setNewSourceName('');
      setNewSourceUrl('');
      setSourceNotice('Added RSS source.');
    } catch (err) {
      setSourceNotice(
        err instanceof Error ? err.message : 'Failed to add source.'
      );
    }
  };

  const subTabs: { id: SettingsSubTabV2; label: string }[] = [
    { id: 'policy', label: 'Rules and policies' },
    { id: 'sources', label: 'RSS sources' },
    { id: 'analytics', label: 'Version analytics' },
  ];

  return (
    <View style={{ gap: V2_SPACE.sectionGap }}>
      <View style={{ gap: 4 }}>
        <V2Text variant="pageTitle">Settings</V2Text>
        <V2Text variant="meta">
          Manage editorial rules, autonomy, RSS feeds, and version metrics.
        </V2Text>
      </View>

      {/* Sub-navigation */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: V2_SPACE.gapLg,
          borderBottomWidth: 1,
          borderBottomColor: V2_COLORS.line,
        }}
      >
        {subTabs.map((t) => {
          const active = subTab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => onChangeSubTab(t.id)}
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
              >
                {t.label}
              </V2Text>
            </Pressable>
          );
        })}
      </View>

      {subTab === 'policy' ? (
        <View style={{ gap: V2_SPACE.sectionGap }}>
          {/* Policy settings form */}
          <View style={{ gap: V2_SPACE.gapLg }}>
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
                <V2Text variant="sectionTitle">
                  Active policy {activePolicy.active_version}
                </V2Text>
                <V2Text variant="meta">
                  Last updated {formatUtcTimestamp(activePolicy.updated_at)} by{' '}
                  {activePolicy.updated_by || 'system'}.
                </V2Text>
              </View>
              <V2Button
                variant="primary"
                label={savingPolicy ? 'Saving...' : 'Save policy version'}
                disabled={savingPolicy || !isAdmin}
                onPress={handleSavePolicy}
              />
            </View>

            {!isAdmin ? (
              <V2Text variant="body" tone="unverified">
                Read-only access. Sign in with an admin account to save policy changes.
              </V2Text>
            ) : null}

            {policyNotice ? (
              <V2Text variant="body" tone="muted">
                {policyNotice}
              </V2Text>
            ) : null}

            <V2Divider />

            {/* Auto-publish row */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: V2_SPACE.gapMd,
              }}
            >
              <View style={{ flex: 1, minWidth: 220, gap: 4 }}>
                <V2Text variant="body" weight="600">
                  {draftSettings.auto_publish_ready
                    ? 'Auto-publish is on'
                    : 'Auto-publish is off'}
                </V2Text>
                <V2Text variant="meta">
                  When on, stories marked Ready publish automatically after fact-checking.
                </V2Text>
              </View>
              <V2Button
                variant="secondary"
                label={
                  draftSettings.auto_publish_ready
                    ? 'Turn off auto-publish'
                    : 'Turn on auto-publish'
                }
                disabled={!isAdmin}
                onPress={() =>
                  setDraftSettings((prev) => ({
                    ...prev,
                    auto_publish_ready: !prev.auto_publish_ready,
                  }))
                }
              />
            </View>

            <V2Divider />

            {/* Reading level */}
            <View style={{ gap: 8 }}>
              <V2Text variant="body" weight="600">
                Reading level
              </V2Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: V2_SPACE.gapSm,
                }}
              >
                {READING_LEVELS.map((lvl) => {
                  const selected = draftSettings.reading_level === lvl;
                  return (
                    <V2Button
                      key={lvl}
                      variant={selected ? 'secondary' : 'low'}
                      label={lvl}
                      disabled={!isAdmin}
                      onPress={() =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          reading_level: lvl,
                        }))
                      }
                    />
                  );
                })}
              </View>
            </View>

            {/* Tone */}
            <View style={{ gap: 8 }}>
              <V2Text variant="body" weight="600">
                Editorial tone
              </V2Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: V2_SPACE.gapSm,
                }}
              >
                {TONES.map((t) => {
                  const selected = draftSettings.tone === t.value;
                  return (
                    <V2Button
                      key={t.value}
                      variant={selected ? 'secondary' : 'low'}
                      label={t.label}
                      disabled={!isAdmin}
                      onPress={() =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          tone: t.value,
                        }))
                      }
                    />
                  );
                })}
              </View>
            </View>

            {/* Numeric targets */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: V2_SPACE.gapLg,
              }}
            >
              <View style={{ width: 180, gap: 8 }}>
                <V2Text variant="meta">Target headline words</V2Text>
                <V2Input
                  keyboardType="numeric"
                  value={String(draftSettings.target_headline_words)}
                  editable={isAdmin}
                  onChangeText={(v) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      target_headline_words: Number(v) || 6,
                    }))
                  }
                />
              </View>
              <View style={{ width: 180, gap: 8 }}>
                <V2Text variant="meta">Target summary words</V2Text>
                <V2Input
                  keyboardType="numeric"
                  value={String(draftSettings.target_summary_words)}
                  editable={isAdmin}
                  onChangeText={(v) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      target_summary_words: Number(v) || 60,
                    }))
                  }
                />
              </View>
              <View style={{ width: 150, gap: 8 }}>
                <V2Text variant="meta">Max per topic</V2Text>
                <V2Input
                  keyboardType="numeric"
                  value={String(draftSettings.max_per_topic)}
                  editable={isAdmin}
                  onChangeText={(v) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      max_per_topic: Number(v) || 4,
                    }))
                  }
                />
              </View>
              <View style={{ width: 150, gap: 8 }}>
                <V2Text variant="meta">Max per region</V2Text>
                <V2Input
                  keyboardType="numeric"
                  value={String(draftSettings.max_per_region)}
                  editable={isAdmin}
                  onChangeText={(v) =>
                    setDraftSettings((prev) => ({
                      ...prev,
                      max_per_region: Number(v) || 5,
                    }))
                  }
                />
              </View>
            </View>

            {/* Admin instructions */}
            <View style={{ gap: 8 }}>
              <V2Text variant="body" weight="600">
                Editorial instructions
              </V2Text>
              <V2Input
                multiline
                value={instructions}
                editable={isAdmin}
                onChangeText={setInstructions}
                placeholder="Additional guidance for story selection and drafting"
              />
            </View>

            <View style={{ gap: 8, maxWidth: 520 }}>
              <V2Text variant="meta">Change note</V2Text>
              <V2Input
                value={changeNote}
                editable={isAdmin}
                onChangeText={setChangeNote}
                placeholder="Brief reason for this policy change"
              />
            </View>
          </View>

          {/* Version history table */}
          <View>
            <V2Text
              variant="sectionTitle"
              style={{ paddingBottom: V2_SPACE.gapMd }}
            >
              Policy history
            </V2Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={{ minWidth: 680, width: '100%' }}>
                <View
                  style={{
                    flexDirection: 'row',
                    paddingVertical: V2_SPACE.tableRowPadY,
                    gap: V2_SPACE.gapLg,
                    borderBottomWidth: 1,
                    borderBottomColor: V2_COLORS.lineStrong,
                  }}
                >
                  <V2Text variant="meta" style={{ width: 90 }}>
                    Version
                  </V2Text>
                  <V2Text variant="meta" style={{ width: 190 }}>
                    Created
                  </V2Text>
                  <V2Text variant="meta" style={{ width: 180 }}>
                    Author
                  </V2Text>
                  <V2Text variant="meta" style={{ flex: 1 }}>
                    Change note
                  </V2Text>
                  <V2Text variant="meta" style={{ width: 90 }}>
                    Action
                  </V2Text>
                </View>

                {versions.map((v) => {
                  const isCurrent = v.version === activePolicy.active_version;
                  return (
                    <View key={v.id}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: V2_SPACE.tableRowPadY,
                          gap: V2_SPACE.gapLg,
                        }}
                      >
                        <V2Text
                          variant="body"
                          weight={isCurrent ? '600' : '400'}
                          tabular
                          style={{ width: 90 }}
                        >
                          {v.version}
                        </V2Text>
                        <V2Text
                          variant="body"
                          tone="muted"
                          tabular
                          style={{ width: 190 }}
                        >
                          {formatUtcTimestamp(v.created_at)}
                        </V2Text>
                        <V2Text
                          variant="body"
                          tone="muted"
                          style={{ width: 180 }}
                        >
                          {v.created_by}
                        </V2Text>
                        <V2Text variant="body" style={{ flex: 1 }}>
                          {v.change_note}
                        </V2Text>
                        <View style={{ width: 90 }}>
                          {isCurrent ? (
                            <V2Text variant="meta">Active</V2Text>
                          ) : (
                            <V2InlineLink
                              label="Restore"
                              onPress={() =>
                                onRollbackPolicy(v, userEmail, isAdmin)
                              }
                            />
                          )}
                        </View>
                      </View>
                      <V2Divider />
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      ) : subTab === 'sources' ? (
        <View style={{ gap: V2_SPACE.sectionGap }}>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: V2_SPACE.gapMd,
            }}
          >
            <View style={{ flex: 1, minWidth: 200, gap: 8 }}>
              <V2Text variant="meta">Source name</V2Text>
              <V2Input
                value={newSourceName}
                onChangeText={setNewSourceName}
                placeholder="e.g. Associated Press"
              />
            </View>
            <View style={{ flex: 2, minWidth: 240, gap: 8 }}>
              <V2Text variant="meta">RSS feed URL</V2Text>
              <V2Input
                value={newSourceUrl}
                onChangeText={setNewSourceUrl}
                placeholder="https://..."
                autoCapitalize="none"
              />
            </View>
            <V2Button
              variant="primary"
              label="Add source"
              onPress={handleAddSource}
            />
            <V2Button
              variant="low"
              label="Reset defaults"
              onPress={() => onResetSources(userEmail)}
            />
          </View>

          {sourceNotice ? (
            <V2Text variant="body" tone="muted">
              {sourceNotice}
            </V2Text>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ minWidth: 680, width: '100%' }}>
              <View
                style={{
                  flexDirection: 'row',
                  paddingVertical: V2_SPACE.tableRowPadY,
                  gap: V2_SPACE.gapLg,
                  borderBottomWidth: 1,
                  borderBottomColor: V2_COLORS.lineStrong,
                }}
              >
                <V2Text variant="meta" style={{ width: 180 }}>
                  Source
                </V2Text>
                <V2Text variant="meta" style={{ width: 100 }}>
                  State
                </V2Text>
                <V2Text variant="meta" style={{ flex: 1 }}>
                  Feed URL
                </V2Text>
                <V2Text variant="meta" style={{ width: 170 }}>
                  Actions
                </V2Text>
              </View>

              {sources.map((src) => (
                <View key={src.name}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: V2_SPACE.tableRowPadY,
                      gap: V2_SPACE.gapLg,
                    }}
                  >
                    <V2Text
                      variant="body"
                      weight="500"
                      style={{ width: 180 }}
                    >
                      {src.name}
                    </V2Text>
                    <V2Text
                      variant="body"
                      tone={src.enabled ? 'ink' : 'muted'}
                      style={{ width: 100 }}
                    >
                      {src.enabled ? 'Enabled' : 'Paused'}
                    </V2Text>
                    <V2Text
                      variant="meta"
                      numberOfLines={1}
                      style={{ flex: 1 }}
                    >
                      {src.url}
                    </V2Text>
                    <View
                      style={{
                        width: 170,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: V2_SPACE.gapMd,
                      }}
                    >
                      <V2Button
                        variant="low"
                        label={src.enabled ? 'Pause' : 'Enable'}
                        onPress={() => onToggleSource(src.name, userEmail)}
                      />
                      <V2InlineLink
                        label="Remove"
                        onPress={() => onRemoveSource(src.name, userEmail)}
                      />
                    </View>
                  </View>
                  <V2Divider />
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : (
        /* Version analytics table */
        <View>
          <V2Text
            variant="sectionTitle"
            style={{ paddingBottom: V2_SPACE.gapMd }}
          >
            Performance by policy version
          </V2Text>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ minWidth: 680, width: '100%' }}>
              <View
                style={{
                  flexDirection: 'row',
                  paddingVertical: V2_SPACE.tableRowPadY,
                  gap: V2_SPACE.gapLg,
                  borderBottomWidth: 1,
                  borderBottomColor: V2_COLORS.lineStrong,
                }}
              >
                <V2Text variant="meta" style={{ width: 130 }}>
                  Policy version
                </V2Text>
                <V2Text variant="meta" style={{ width: 110 }}>
                  Stories
                </V2Text>
                <V2Text variant="meta" style={{ width: 110 }}>
                  Published
                </V2Text>
                <V2Text variant="meta" style={{ width: 110 }}>
                  Rejected
                </V2Text>
                <V2Text variant="meta" style={{ width: 130 }}>
                  Avg confidence
                </V2Text>
                <V2Text variant="meta" style={{ flex: 1 }}>
                  Flagged
                </V2Text>
              </View>

              {analyticsRows.map((row) => {
                const avg =
                  row.total > 0
                    ? Math.round(row.confidenceSum / row.total)
                    : 0;
                return (
                  <View key={row.version}>
                    <View
                      style={{
                        flexDirection: 'row',
                        paddingVertical: V2_SPACE.tableRowPadY,
                        gap: V2_SPACE.gapLg,
                      }}
                    >
                      <V2Text
                        variant="body"
                        weight="500"
                        tabular
                        style={{ width: 130 }}
                      >
                        {row.version}
                      </V2Text>
                      <V2Text variant="body" tabular style={{ width: 110 }}>
                        {row.total} stories
                      </V2Text>
                      <V2Text variant="body" tabular style={{ width: 110 }}>
                        {row.published} published
                      </V2Text>
                      <V2Text variant="body" tabular style={{ width: 110 }}>
                        {row.rejected} rejected
                      </V2Text>
                      <V2Text variant="body" tabular style={{ width: 130 }}>
                        {avg}%
                      </V2Text>
                      <V2Text
                        variant="body"
                        tone="muted"
                        tabular
                        style={{ flex: 1 }}
                      >
                        {row.flagged} flagged
                      </V2Text>
                    </View>
                    <V2Divider />
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}
