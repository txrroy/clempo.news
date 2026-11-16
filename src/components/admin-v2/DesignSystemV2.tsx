import { ScrollView, View } from 'react-native';
import {
  StatusLabel,
  V2Button,
  V2Divider,
  V2InlineLink,
  V2Input,
  V2Text,
} from './primitives';
import { V2_COLORS, V2_SPACE } from './tokens';

const COLOR_TOKENS = [
  { name: 'ink', hex: V2_COLORS.ink, role: 'Text, primary button, active nav' },
  { name: 'muted', hex: V2_COLORS.muted, role: 'Secondary text' },
  { name: 'line', hex: V2_COLORS.line, role: 'Row dividers' },
  {
    name: 'line-strong',
    hex: V2_COLORS.lineStrong,
    role: 'Table header rule, low-priority button border',
  },
  { name: 'ground', hex: V2_COLORS.ground, role: 'Only background' },
  { name: 'status-ready', hex: V2_COLORS.statusReady, role: 'Ready status label' },
  { name: 'status-check', hex: V2_COLORS.statusCheck, role: 'Check status label' },
  {
    name: 'status-unverified',
    hex: V2_COLORS.statusUnverified,
    role: 'Unverified status label',
  },
] as const;

export function DesignSystemV2() {
  return (
    <View style={{ gap: V2_SPACE.sectionGap }}>
      <View style={{ gap: 4 }}>
        <V2Text variant="pageTitle">Design system</V2Text>
        <V2Text variant="meta">
          V2 tokens: Inter 400/500/600, 1px hairline rules, 44px controls, zero cards or shadows.
        </V2Text>
      </View>

      {/* Color tokens */}
      <View>
        <V2Text
          variant="sectionTitle"
          style={{ paddingBottom: V2_SPACE.gapMd }}
        >
          Color tokens
        </V2Text>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View style={{ minWidth: 640, width: '100%' }}>
            <View
              style={{
                flexDirection: 'row',
                paddingVertical: V2_SPACE.tableRowPadY,
                gap: V2_SPACE.gapLg,
                borderBottomWidth: 1,
                borderBottomColor: V2_COLORS.lineStrong,
              }}
            >
              <V2Text variant="meta" style={{ width: 140 }}>
                Token
              </V2Text>
              <V2Text variant="meta" style={{ width: 120 }}>
                Value
              </V2Text>
              <V2Text variant="meta" style={{ flex: 1 }}>
                Usage
              </V2Text>
            </View>

            {COLOR_TOKENS.map((t) => (
              <View key={t.name}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: V2_SPACE.tableRowPadY,
                    gap: V2_SPACE.gapLg,
                  }}
                >
                  <View
                    style={{
                      width: 140,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: V2_SPACE.gapSm,
                    }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        backgroundColor: t.hex,
                        borderWidth: 1,
                        borderColor: V2_COLORS.lineStrong,
                      }}
                    />
                    <V2Text variant="body" weight="500">
                      {t.name}
                    </V2Text>
                  </View>
                  <V2Text variant="body" tabular style={{ width: 120 }}>
                    {t.hex}
                  </V2Text>
                  <V2Text variant="body" tone="muted" style={{ flex: 1 }}>
                    {t.role}
                  </V2Text>
                </View>
                <V2Divider />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Type scale */}
      <View>
        <V2Text
          variant="sectionTitle"
          style={{ paddingBottom: V2_SPACE.gapMd }}
        >
          Typography (Inter)
        </V2Text>
        <V2Divider />
        <View style={{ paddingVertical: V2_SPACE.listRowPadY, gap: 4 }}>
          <V2Text variant="pageTitle">Page title — 24px / 600</V2Text>
          <V2Text variant="meta">Used once at the top of a page.</V2Text>
        </View>
        <V2Divider />
        <View style={{ paddingVertical: V2_SPACE.listRowPadY, gap: 4 }}>
          <V2Text variant="sectionTitle">
            Section title and item headline — 16px / 600
          </V2Text>
          <V2Text variant="meta">Used for section headers and story headlines.</V2Text>
        </View>
        <V2Divider />
        <View style={{ paddingVertical: V2_SPACE.listRowPadY, gap: 4 }}>
          <V2Text variant="body">
            Body copy — 14px / 400, line-height 1.45. Used for summaries, notes, and table cells.
          </V2Text>
        </View>
        <V2Divider />
        <View style={{ paddingVertical: V2_SPACE.listRowPadY, gap: 4 }}>
          <V2Text variant="meta">
            Meta and table headers — 13px / 400. Minimum text size across the console.
          </V2Text>
        </View>
        <V2Divider />
      </View>

      {/* Status labels */}
      <View style={{ gap: V2_SPACE.gapMd }}>
        <V2Text variant="sectionTitle">Status labels</V2Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: V2_SPACE.gapLg,
          }}
        >
          <StatusLabel kind="ready" />
          <StatusLabel kind="check" />
          <StatusLabel kind="unverified" />
        </View>
      </View>

      {/* Buttons & inputs */}
      <View style={{ gap: V2_SPACE.gapMd }}>
        <V2Text variant="sectionTitle">Buttons and inputs (44px, 6px radius)</V2Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: V2_SPACE.gapMd,
          }}
        >
          <V2Button variant="primary" label="Primary action" />
          <V2Button variant="secondary" label="Secondary action" />
          <V2Button variant="low" label="Low priority" />
          <V2InlineLink label="Underlined link" />
        </View>
        <View style={{ maxWidth: 360, width: '100%' }}>
          <V2Input value="" placeholder="Input field (6px radius)" editable={false} />
        </View>
      </View>
    </View>
  );
}
