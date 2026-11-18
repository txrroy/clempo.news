import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import type {
  ActivePolicyDoc,
  PolicyVersion,
  RssSourceConfig,
} from '@/types/article';
import { diffPolicyVersions } from './policyDiff';
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

export type V3SettingsTab = 'sources' | 'history' | 'schedule';

interface SettingsV3Props {
  activeTab: V3SettingsTab;
  onChangeTab: (tab: V3SettingsTab) => void;
  activePolicy: ActivePolicyDoc;
  versions: PolicyVersion[];
  isAdmin: boolean;
  userEmail: string;
  onRollback: (
    version: PolicyVersion,
    userEmail: string,
    isAdmin: boolean
  ) => Promise<string>;
  sources: RssSourceConfig[];
  onToggleSource: (name: string, userEmail: string) => Promise<void>;
  onAddSource: (name: string, url: string, userEmail: string) => Promise<void>;
  onRemoveSource: (name: string, userEmail: string) => Promise<void>;
  onResetDefaults: (userEmail: string) => Promise<void>;
  collectionTimeUtc: string;
  onChangeCollectionTimeUtc: (time: string) => void;
}

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

export function SettingsV3({
  activeTab,
  onChangeTab,
  activePolicy,
  versions,
  isAdmin,
  userEmail,
  onRollback,
  sources,
  onToggleSource,
  onAddSource,
  onRemoveSource,
  onResetDefaults,
  collectionTimeUtc,
  onChangeCollectionTimeUtc,
}: SettingsV3Props) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');

  const handleAddRss = async () => {
    setFeedback(null);
    try {
      await onAddSource(newSourceName, newSourceUrl, userEmail);
      setNewSourceName('');
      setNewSourceUrl('');
      setFeedback('Source added.');
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : 'Failed to add source.'
      );
    }
  };

  const handleRollback = async (ver: PolicyVersion) => {
    setBusy(true);
    setFeedback(null);
    try {
      const nextVer = await onRollback(ver, userEmail, isAdmin);
      setFeedback(`Rolled back to ${ver.version} as ${nextVer}.`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Rollback failed.');
    } finally {
      setBusy(false);
    }
  };

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
            SETTINGS
          </V3Text>
          <V3Text role="title">Sources, History &amp; Schedule</V3Text>
        </View>

        <V3Tabs
          options={[
            { id: 'sources', label: 'RSS Sources' },
            { id: 'history', label: 'Version History' },
            { id: 'schedule', label: 'Schedule' },
          ]}
          value={activeTab}
          onChange={onChangeTab}
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

      {activeTab === 'sources' ? (
        <View style={{ gap: V3_SPACE.xl }}>
          <V3Card variant="filled" style={{ gap: V3_SPACE.md }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: V3_SPACE.sm,
              }}
            >
              <V3Text role="kicker">ADD CUSTOM RSS SOURCE</V3Text>
              <V3Button
                label="Reset Defaults"
                variant="outline"
                size="sm"
                onPress={() => void onResetDefaults(userEmail)}
              />
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
                value={newSourceName}
                onChangeText={setNewSourceName}
                placeholder="Outlet name (e.g. NPR World)"
                style={{ flex: 1, minWidth: 180 }}
              />
              <V3Input
                value={newSourceUrl}
                onChangeText={setNewSourceUrl}
                placeholder="https://..."
                style={{ flex: 2, minWidth: 240 }}
              />
              <V3Button
                label="Add Source"
                variant="primary"
                onPress={() => void handleAddRss()}
              />
            </View>
          </V3Card>

          <View>
            <V3Rule strong />
            {sources.map((src) => (
              <View
                key={src.name}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: V3_SPACE.md,
                  paddingVertical: V3_SPACE.md,
                  borderBottomWidth: 1,
                  borderBottomColor: V3_COLORS.border,
                }}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <V3Text role="headline">{src.name}</V3Text>
                  <V3Text role="mono" tone="muted" numberOfLines={1}>
                    {src.url}
                  </V3Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: V3_SPACE.sm,
                  }}
                >
                  <Switch
                    value={src.enabled}
                    onValueChange={() => void onToggleSource(src.name, userEmail)}
                    trackColor={{
                      false: V3_COLORS.border,
                      true: V3_COLORS.accent,
                    }}
                  />
                  <V3Button
                    label="Remove"
                    variant="outline"
                    size="sm"
                    onPress={() => void onRemoveSource(src.name, userEmail)}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : activeTab === 'history' ? (
        <View>
          <V3Rule strong />
          {versions.map((ver, idx) => {
            const isCurrent = ver.version === activePolicy.active_version;
            const prevVer = versions[idx + 1];
            const diffs = prevVer
              ? diffPolicyVersions(prevVer, ver)
              : ['Initial baseline policy'];

            return (
              <View
                key={ver.version}
                style={{
                  paddingVertical: V3_SPACE.lg,
                  borderBottomWidth: 1,
                  borderBottomColor: V3_COLORS.border,
                  gap: V3_SPACE.sm,
                }}
              >
                <View
                  style={{
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
                      gap: V3_SPACE.sm,
                    }}
                  >
                    <V3Text role="section">{ver.version}</V3Text>
                    {isCurrent ? (
                      <V3Badge label="ACTIVE" tone="approved" />
                    ) : null}
                    <V3Text role="mono" tone="subtle">
                      {ver.created_at.slice(0, 16).replace('T', ' ')} UTC ·{' '}
                      {ver.created_by}
                    </V3Text>
                  </View>

                  {!isCurrent ? (
                    <V3Button
                      label="Rollback"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onPress={() => void handleRollback(ver)}
                    />
                  ) : null}
                </View>

                {ver.change_note ? (
                  <V3Text role="body">{ver.change_note}</V3Text>
                ) : null}

                {/* Exact field-level diff vs previous version */}
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: V3_SPACE.xs,
                  }}
                >
                  {(diffs.length > 0
                    ? diffs
                    : ['No rule field changes vs previous version']
                  ).map((line) => (
                    <V3Badge key={line} label={line} tone="neutral" />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <V3Card variant="filled" style={{ gap: V3_SPACE.md }}>
          <V3Text role="kicker">DAILY COLLECTION SCHEDULE</V3Text>
          <V3Text role="body" tone="muted">
            Expected daily news collection time (UTC). Workbench shows a Missed
            Run alert if today&apos;s edition has not been collected past this
            window.
          </V3Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: V3_SPACE.sm,
            }}
          >
            {['05:00 UTC', '06:00 UTC', '07:00 UTC', '12:00 UTC'].map((slot) => (
              <PillOption
                key={slot}
                label={slot}
                active={collectionTimeUtc === slot}
                onPress={() => onChangeCollectionTimeUtc(slot)}
              />
            ))}
          </View>
        </V3Card>
      )}
    </View>
  );
}
