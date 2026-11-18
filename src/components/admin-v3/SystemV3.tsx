import { useMemo, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { DEFAULT_FLAG_AUTONOMY } from '@/hooks/useGovernance';
import { getFlagShortLabel } from '@/lib/editorialLabels';
import type {
  ActivePolicyDoc,
  Article,
  ArticleFlag,
  AutonomyLevel,
  PolicySettings,
  PolicyTone,
  ReadingLevel,
  RssSourceConfig,
} from '@/types/article';
import { diffPolicyVersions } from './policyDiff';
import { computeTrustLoopStats } from './trustLoops';
import {
  V3Badge,
  V3Button,
  V3Card,
  V3Input,
  V3Rule,
  V3Tabs,
  V3Text,
} from './primitives';
import { V3_COLORS, V3_RADII, V3_SPACE } from './tokens';

interface SystemV3Props {
  activePolicy: ActivePolicyDoc;
  sources: RssSourceConfig[];
  articles: Article[];
  isAdmin: boolean;
  userEmail: string;
  onSaveVersion: (params: {
    settings: PolicySettings;
    adminInstructions: string;
    changeNote: string;
    userEmail: string;
    isAdmin: boolean;
  }) => Promise<string>;
  onOpenSettingsTab: (tab: 'sources' | 'history' | 'schedule') => void;
}

const READING_LEVELS: ReadingLevel[] = [
  'grade 4',
  'grade 5',
  'grade 6',
  'grade 7',
  'grade 8',
];

const TONES: { value: PolicyTone; label: string }[] = [
  { value: 'calm_neutral', label: 'Calm Neutral' },
  { value: 'curious_educator', label: 'Curious Educator' },
  { value: 'concise_wire', label: 'Concise Wire' },
];

const AUTONOMY_FLAGS: ArticleFlag[] = [
  'TOO_COMPLEX',
  'LOADED_LANGUAGE',
  'GRAPHIC_DETAIL',
  'ONE_SIDED',
  'SNIPPET_ONLY',
];

function PillOption({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: V3_SPACE.md,
        paddingVertical: V3_SPACE.xs + 2,
        borderRadius: V3_RADII.control,
        backgroundColor: active ? V3_COLORS.ink : 'transparent',
        borderWidth: active ? 0 : 1,
        borderColor: active ? 'transparent' : V3_COLORS.border,
      }}
    >
      <V3Text role="mono" tone={active ? 'inverse' : 'muted'}>
        {label}
      </V3Text>
    </Pressable>
  );
}

function StepperControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (next: number) => void;
}) {
  return (
    <View style={{ gap: V3_SPACE.xs, minWidth: 140 }}>
      <V3Text role="kicker" tone="subtle">
        {label}
      </V3Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: V3_SPACE.sm }}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - step))}
          style={{
            width: 28,
            height: 28,
            borderRadius: V3_RADII.control,
            borderWidth: 1,
            borderColor: V3_COLORS.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <V3Text role="mono" weight="700">
            -
          </V3Text>
        </Pressable>
        <V3Text role="mono" weight="700" tone="ink" tabularNums>
          {value}
          {unit}
        </V3Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + step))}
          style={{
            width: 28,
            height: 28,
            borderRadius: V3_RADII.control,
            borderWidth: 1,
            borderColor: V3_COLORS.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <V3Text role="mono" weight="700">
            +
          </V3Text>
        </Pressable>
      </View>
    </View>
  );
}

export function SystemV3({
  activePolicy,
  sources,
  articles,
  isAdmin,
  userEmail,
  onSaveVersion,
  onOpenSettingsTab,
}: SystemV3Props) {
  const [subTab, setSubTab] = useState<'agents' | 'metrics'>('agents');
  const [draftSettings, setDraftSettings] = useState<PolicySettings>(
    activePolicy.settings
  );
  const [draftInstructions, setDraftInstructions] = useState(
    activePolicy.admin_instructions
  );
  const [changeNote, setChangeNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const enabledSourcesCount = sources.filter((s) => s.enabled).length;
  const autonomyMap = useMemo(
    () => ({
      ...DEFAULT_FLAG_AUTONOMY,
      ...(draftSettings.flag_autonomy || {}),
    }),
    [draftSettings.flag_autonomy]
  );

  const trustLoop = useMemo(
    () => computeTrustLoopStats(articles, autonomyMap),
    [articles, autonomyMap]
  );
  const trustStatByFlag = useMemo(() => {
    const m = new Map(trustLoop.stats.map((s) => [s.flag, s]));
    return m;
  }, [trustLoop.stats]);
  const suggestionByFlag = useMemo(() => {
    const m = new Map(trustLoop.suggestions.map((s) => [s.flag, s]));
    return m;
  }, [trustLoop.suggestions]);

  const pendingDiffs = useMemo(
    () =>
      diffPolicyVersions(
        {
          settings: activePolicy.settings,
          admin_instructions: activePolicy.admin_instructions,
        },
        {
          settings: draftSettings,
          admin_instructions: draftInstructions,
        }
      ),
    [
      activePolicy.admin_instructions,
      activePolicy.settings,
      draftInstructions,
      draftSettings,
    ]
  );

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const autoNote =
        pendingDiffs.length > 0
          ? pendingDiffs.slice(0, 3).join('; ')
          : 'Updated agent rules';
      const nextVer = await onSaveVersion({
        settings: draftSettings,
        adminInstructions: draftInstructions,
        changeNote: changeNote.trim() || autoNote,
        userEmail,
        isAdmin,
      });
      setChangeNote('');
      setFeedback(`Saved policy ${nextVer}. Applies on the next collection.`);
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : 'Failed to save agent rules.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraftSettings(activePolicy.settings);
    setDraftInstructions(activePolicy.admin_instructions);
    setChangeNote('');
  };

  const versionRows = useMemo(() => {
    const map = new Map<
      string,
      { total: number; published: number; rejected: number }
    >();
    for (const a of articles) {
      const ver =
        a.prompt_version ||
        a.instructions_snapshot?.prompt_version ||
        'unversioned';
      const entry = map.get(ver) ?? { total: 0, published: 0, rejected: 0 };
      entry.total += 1;
      if (a.status === 'published') entry.published += 1;
      else if (a.status === 'rejected') entry.rejected += 1;
      map.set(ver, entry);
    }
    return Array.from(map.entries()).map(([version, stats]) => {
      const decided = stats.published + stats.rejected;
      const rate =
        decided > 0 ? Math.round((stats.published / decided) * 100) : null;
      return { version, ...stats, rate };
    });
  }, [articles]);

  return (
    <View style={{ gap: V3_SPACE.xl }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: V3_SPACE.md,
        }}
      >
        <View style={{ gap: 2 }}>
          <V3Text role="kicker" tone="accent">
            SYSTEM · POLICY {activePolicy.active_version.toUpperCase()}
          </V3Text>
          <V3Text role="title">Editorial Agents &amp; Rules</V3Text>
        </View>

        <V3Tabs
          options={[
            { id: 'agents', label: 'Agents' },
            { id: 'metrics', label: 'Approval Metrics' },
          ]}
          value={subTab}
          onChange={setSubTab}
        />
      </View>

      <V3Rule strong />

      {feedback ? (
        <V3Card
          variant="filled"
          padding="md"
          style={{ backgroundColor: V3_COLORS.accentSoft }}
        >
          <V3Text role="body" tone="accent" weight="600">
            {feedback}
          </V3Text>
        </V3Card>
      ) : null}

      {subTab === 'agents' ? (
        <View style={{ gap: V3_SPACE.lg }}>
          {/* Agent 1: Collector & Selector */}
          <V3Card variant="filled" style={{ gap: V3_SPACE.md }}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: V3_SPACE.md,
              }}
            >
              <View style={{ gap: V3_SPACE.xs, flex: 1, minWidth: 240 }}>
                <V3Badge label="INGESTION" tone="neutral" />
                <V3Text role="section">Agent 1 · Collector &amp; Selector</V3Text>
              </View>
              <V3Button
                label={`Manage RSS sources (${enabledSourcesCount}/${sources.length})`}
                variant="outline"
                size="sm"
                onPress={() => onOpenSettingsTab('sources')}
              />
            </View>

            <V3Text role="body" tone="muted">
              Scan active RSS feeds, merge duplicate coverage of the same event,
              and pick high-impact stories within topic and region caps.
            </V3Text>

            <V3Rule />

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: V3_SPACE.xl }}>
              <StepperControl
                label="MAX PER TOPIC"
                value={draftSettings.max_per_topic ?? 4}
                min={1}
                max={10}
                onChange={(v) =>
                  setDraftSettings({ ...draftSettings, max_per_topic: v })
                }
              />
              <StepperControl
                label="MAX PER REGION"
                value={draftSettings.max_per_region ?? 5}
                min={1}
                max={10}
                onChange={(v) =>
                  setDraftSettings({ ...draftSettings, max_per_region: v })
                }
              />
              <StepperControl
                label="MAX MARKETS"
                value={draftSettings.max_market_stories ?? 1}
                min={0}
                max={5}
                onChange={(v) =>
                  setDraftSettings({ ...draftSettings, max_market_stories: v })
                }
              />
            </View>
          </V3Card>

          {/* Agent 2: Editorial Summarizer */}
          <V3Card variant="filled" style={{ gap: V3_SPACE.md }}>
            <View style={{ gap: V3_SPACE.xs }}>
              <V3Badge label="DRAFTING" tone="neutral" />
              <V3Text role="section">Agent 2 · Editorial Summarizer</V3Text>
            </View>

            <V3Text role="body" tone="muted">
              Draft calm, neutral, G-rated summaries grounded strictly in scraped
              source text at the configured reading level and length.
            </V3Text>

            <V3Rule />

            <View style={{ gap: V3_SPACE.xs }}>
              <V3Text role="kicker" tone="subtle">
                READING LEVEL
              </V3Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: V3_SPACE.sm }}>
                {READING_LEVELS.map((lvl) => (
                  <PillOption
                    key={lvl}
                    label={lvl}
                    active={draftSettings.reading_level === lvl}
                    onPress={() =>
                      setDraftSettings({ ...draftSettings, reading_level: lvl })
                    }
                  />
                ))}
              </View>
            </View>

            <View style={{ gap: V3_SPACE.xs }}>
              <V3Text role="kicker" tone="subtle">
                EDITORIAL TONE
              </V3Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: V3_SPACE.sm }}>
                {TONES.map((t) => (
                  <PillOption
                    key={t.value}
                    label={t.label}
                    active={draftSettings.tone === t.value}
                    onPress={() =>
                      setDraftSettings({ ...draftSettings, tone: t.value })
                    }
                  />
                ))}
              </View>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: V3_SPACE.xl }}>
              <StepperControl
                label="HEADLINE TARGET"
                value={draftSettings.target_headline_words}
                min={6}
                max={16}
                unit="w"
                onChange={(v) =>
                  setDraftSettings({
                    ...draftSettings,
                    target_headline_words: v,
                  })
                }
              />
              <StepperControl
                label="SUMMARY TARGET"
                value={draftSettings.target_summary_words}
                min={40}
                max={90}
                step={5}
                unit="w"
                onChange={(v) =>
                  setDraftSettings({
                    ...draftSettings,
                    target_summary_words: v,
                  })
                }
              />
            </View>

            <View style={{ gap: V3_SPACE.xs }}>
              <V3Text role="kicker" tone="subtle">
                CUSTOM INSTRUCTIONS {!isAdmin ? '(ADMIN ONLY)' : ''}
              </V3Text>
              <V3Input
                value={draftInstructions}
                onChangeText={setDraftInstructions}
                editable={isAdmin}
                multiline
                placeholder="Optional editorial guidance appended to summarizer prompt..."
                style={{ minHeight: 72, textAlignVertical: 'top' }}
              />
            </View>
          </V3Card>

          {/* Agent 3: Quality Judge */}
          <V3Card variant="filled" style={{ gap: V3_SPACE.md }}>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: V3_SPACE.md,
              }}
            >
              <View style={{ gap: V3_SPACE.xs, flex: 1, minWidth: 240 }}>
                <V3Badge label="VERIFICATION" tone="neutral" />
                <V3Text role="section">Agent 3 · Quality Judge</V3Text>
              </View>
              <V3Button
                label="View version history"
                variant="outline"
                size="sm"
                onPress={() => onOpenSettingsTab('history')}
              />
            </View>

            <V3Text role="body" tone="muted">
              Verify every factual claim against source quotes, check G-rated
              safety, and route drafts to Ready, Needs Check, or Unverified.
            </V3Text>

            <V3Rule />

            <View style={{ gap: V3_SPACE.sm }}>
              <V3Text role="kicker" tone="subtle">
                AUTONOMY &amp; TRUST LOOP BY FLAG TYPE
              </V3Text>
              {AUTONOMY_FLAGS.map((flag) => {
                const level = autonomyMap[flag] ?? 'ask_me';
                const stat = trustStatByFlag.get(flag);
                const sug = suggestionByFlag.get(flag);
                const isPromote = sug?.kind === 'promote';
                const trustLabel =
                  !stat || stat.total === 0
                    ? 'NO DECIDED STORIES YET'
                    : `${stat.accepted}/${stat.total} ACCEPTED UNEDITED (${stat.rate}%)`;
                return (
                  <View key={flag} style={{ gap: V3_SPACE.xs }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: V3_SPACE.sm,
                        paddingVertical: V3_SPACE.xs,
                      }}
                    >
                      <View style={{ gap: 2 }}>
                        <V3Text role="body" weight="600">
                          {getFlagShortLabel(flag)}
                        </V3Text>
                        <V3Text role="mono" tone="subtle">
                          {trustLabel}
                        </V3Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: V3_SPACE.xs }}>
                        {(
                          [
                            { v: 'ask_me' as AutonomyLevel, l: 'Ask editor' },
                            {
                              v: 'fix_then_show' as AutonomyLevel,
                              l: 'Fix & show',
                            },
                            {
                              v: 'fix_automatically' as AutonomyLevel,
                              l: 'Auto-fix',
                            },
                          ] as const
                        ).map((opt) => (
                          <PillOption
                            key={opt.v}
                            label={opt.l}
                            active={level === opt.v}
                            onPress={() =>
                              setDraftSettings({
                                ...draftSettings,
                                flag_autonomy: {
                                  ...autonomyMap,
                                  [flag]: opt.v,
                                },
                              })
                            }
                          />
                        ))}
                      </View>
                    </View>
                    {sug ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: V3_SPACE.sm,
                          paddingHorizontal: V3_SPACE.md,
                          paddingVertical: V3_SPACE.sm,
                          backgroundColor: isPromote
                            ? V3_COLORS.accentSoft
                            : V3_COLORS.warningSoft,
                          borderLeftWidth: 3,
                          borderLeftColor: isPromote
                            ? V3_COLORS.accent
                            : V3_COLORS.warning,
                          borderRadius: V3_RADII.sharp,
                        }}
                      >
                        <View style={{ flex: 1, minWidth: 220, gap: 4 }}>
                          <V3Badge
                            label={
                              isPromote
                                ? 'TRUST LOOP SUGGESTION'
                                : 'QUALITY SAFEGUARD'
                            }
                            tone={isPromote ? 'approved' : 'pending'}
                          />
                          <V3Text role="body">{sug.message}</V3Text>
                        </View>
                        <V3Button
                          label={sug.actionLabel}
                          variant="outline"
                          size="sm"
                          onPress={() =>
                            setDraftSettings({
                              ...draftSettings,
                              flag_autonomy: {
                                ...autonomyMap,
                                [sug.flag]: sug.targetLevel,
                              },
                            })
                          }
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <V3Rule />

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: V3_SPACE.md,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <V3Text role="body" weight="600">
                  Auto-publish Ready stories
                </V3Text>
                <V3Text role="mono" tone="muted">
                  Only stories passing full verification with zero flags
                </V3Text>
              </View>
              <Switch
                value={Boolean(draftSettings.auto_publish_ready)}
                onValueChange={(next) =>
                  setDraftSettings({
                    ...draftSettings,
                    auto_publish_ready: next,
                  })
                }
                trackColor={{
                  false: V3_COLORS.border,
                  true: V3_COLORS.accent,
                }}
              />
            </View>
          </V3Card>

          {/* Shared Atomic Policy Save Bar */}
          {pendingDiffs.length > 0 ? (
            <V3Card
              variant="filled"
              style={{
                backgroundColor: V3_COLORS.surfaceWell,
                gap: V3_SPACE.md,
              }}
            >
              <View style={{ gap: 4 }}>
                <V3Text role="kicker" tone="accent">
                  UNSAVED CHANGES ({pendingDiffs.length})
                </V3Text>
                <V3Text role="mono" tone="ink">
                  {pendingDiffs.join(' · ')}
                </V3Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: V3_SPACE.sm,
                  alignItems: 'center',
                }}
              >
                <V3Input
                  value={changeNote}
                  onChangeText={setChangeNote}
                  placeholder="Optional change note (auto-filled from diff if blank)..."
                  style={{ flex: 1, minWidth: 220 }}
                />
                <V3Button
                  label="Discard"
                  variant="outline"
                  disabled={saving}
                  onPress={handleDiscard}
                />
                <V3Button
                  label={saving ? 'Saving...' : 'Save Policy Version'}
                  variant="primary"
                  disabled={saving}
                  onPress={() => void handleSave()}
                />
              </View>
            </V3Card>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: V3_SPACE.md }}>
          {versionRows.map((row) => (
            <V3Card
              key={row.version}
              variant="outlined"
              padding="lg"
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: V3_SPACE.md,
              }}
            >
              <View style={{ gap: 2 }}>
                <V3Text role="headline">{row.version}</V3Text>
                <V3Text role="mono" tone="muted">
                  {row.total} TOTAL · {row.published} APPROVED · {row.rejected}{' '}
                  REJECTED
                </V3Text>
              </View>
              <V3Badge
                label={
                  row.rate !== null ? `${row.rate}% APPROVAL` : 'NO DECISIONS'
                }
                tone={
                  row.rate === null
                    ? 'neutral'
                    : row.rate >= 75
                      ? 'approved'
                      : 'pending'
                }
              />
            </V3Card>
          ))}
        </View>
      )}
    </View>
  );
}
