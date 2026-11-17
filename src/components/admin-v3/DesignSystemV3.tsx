import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  V3AccordionItem,
  V3Badge,
  V3Button,
  V3Card,
  V3Rule,
  V3Tabs,
  V3Text,
  V3UserAvatar,
} from './primitives';
import { V3_COLORS, V3_RADII, V3_SPACE } from './tokens';

const COLOR_TOKENS = [
  { name: 'CANVAS', hex: V3_COLORS.canvas },
  { name: 'SURFACE', hex: V3_COLORS.surface },
  { name: 'WELL', hex: V3_COLORS.surfaceWell },
  { name: 'STARK INK', hex: V3_COLORS.ink },
  { name: 'PUNCH GREEN', hex: V3_COLORS.green },
  { name: 'SIGNAL ORANGE', hex: V3_COLORS.orange },
  { name: 'RULE', hex: V3_COLORS.border },
  { name: 'DANGER', hex: V3_COLORS.red },
] as const;

export function DesignSystemV3() {
  const [sampleTab, setSampleTab] = useState<'stories' | 'trace'>('stories');
  const [openIdx, setOpenIdx] = useState<number>(0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: V3_COLORS.canvas }}
      contentContainerStyle={{
        padding: V3_SPACE.xxl,
        gap: V3_SPACE.xl,
        maxWidth: 1120,
        width: '100%',
        alignSelf: 'center',
      }}
    >
      {/* Masthead anchored with strong structural rule */}
      <View style={{ gap: V3_SPACE.sm }}>
        <V3Text role="kicker" tone="green">
          DESIGN SYSTEM · V3
        </V3Text>
        <V3Text role="title">Architectural Editorial · High-Contrast Green</V3Text>
        <V3Text role="mono" tone="muted">
          SHARP STRUCTURAL CARDS (0PX) · PILL CONTROLS (9999PX) · NEVER NESTED · FILL OR BORDER ONLY
        </V3Text>
      </View>

      <V3Rule strong />

      {/* Section 1: Palette & Typography */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: V3_SPACE.lg,
          alignItems: 'stretch',
        }}
      >
        <V3Card variant="filled" style={{ flex: 1, minWidth: 300, gap: V3_SPACE.md }}>
          <V3Text role="kicker">01 · COLOR SYSTEM</V3Text>
          <V3Rule />
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: V3_SPACE.md,
            }}
          >
            {COLOR_TOKENS.map((c) => (
              <View
                key={c.name}
                style={{
                  width: 132,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: V3_SPACE.sm,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: V3_RADII.sharp,
                    backgroundColor: c.hex,
                    borderWidth: c.hex === V3_COLORS.surface ? 1 : 0,
                    borderColor: V3_COLORS.border,
                  }}
                />
                <View>
                  <V3Text role="kicker" tone="ink">
                    {c.name}
                  </V3Text>
                  <V3Text role="mono" tone="subtle">
                    {c.hex}
                  </V3Text>
                </View>
              </View>
            ))}
          </View>
        </V3Card>

        <V3Card variant="outlined" style={{ flex: 1, minWidth: 300, gap: V3_SPACE.md }}>
          <V3Text role="kicker">02 · TYPOGRAPHIC CONTRAST</V3Text>
          <V3Rule />
          <View style={{ gap: V3_SPACE.sm }}>
            <V3Text role="title">Display Serif Headline (Newsreader 28)</V3Text>
            <V3Text role="section">Section Sans Bold (18px)</V3Text>
            <V3Text role="headline">Story Headline Semibold (16px)</V3Text>
            <V3Text role="body">
              Body prose in crisp 14px sans for fast editorial reading.
            </V3Text>
            <V3Text role="kicker" tone="green">
              ALL-CAPS TRACKED KICKER (11PX / +1.1 TRACKING)
            </V3Text>
            <V3Text role="mono">
              2026-11-16 · UTC 07:24 · SCORE 94 · MONOSPACE META
            </V3Text>
          </View>
        </V3Card>
      </View>

      <V3Rule />

      {/* Section 2: Card Variants (Sharp 0px corners, Fill OR Border) */}
      <View style={{ gap: V3_SPACE.md }}>
        <V3Text role="kicker">03 · STRUCTURAL CARDS (0PX CORNERS · FILL OR BORDER ONLY)</V3Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: V3_SPACE.lg,
          }}
        >
          <V3Card variant="filled" style={{ flex: 1, minWidth: 260, gap: V3_SPACE.sm }}>
            <V3Text role="kicker" tone="green">
              FILLED VARIANT
            </V3Text>
            <V3Text role="headline">Sharp Background Surface</V3Text>
            <V3Text role="body" tone="muted">
              0px sharp corners with pure white fill and zero border.
            </V3Text>
          </V3Card>

          <V3Card variant="outlined" style={{ flex: 1, minWidth: 260, gap: V3_SPACE.sm }}>
            <V3Text role="kicker" tone="muted">
              OUTLINED VARIANT
            </V3Text>
            <V3Text role="headline">Sharp Bordered Container</V3Text>
            <V3Text role="body" tone="muted">
              0px sharp corners with 1px structural border and transparent background.
            </V3Text>
          </V3Card>
        </View>
      </View>

      <V3Rule />

      {/* Section 3: Pill Controls vs Sharp Grid */}
      <V3Card variant="filled" style={{ gap: V3_SPACE.lg }}>
        <V3Text role="kicker">04 · PILL CONTROLS &amp; STATUS PILLS</V3Text>
        <V3Rule />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: V3_SPACE.md,
          }}
        >
          <V3Button label="Approve & Publish" variant="primary" onPress={() => {}} />
          <V3Button label="Start Collecting News" variant="dark" onPress={() => {}} />
          <V3Button label="View Details" variant="outline" onPress={() => {}} />
          <V3Button label="Reject" variant="danger" onPress={() => {}} />
          <V3Button label="Disabled" disabled onPress={() => {}} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: V3_SPACE.lg,
          }}
        >
          <V3Tabs
            options={[
              { id: 'stories', label: 'Stories' },
              { id: 'trace', label: 'Trace' },
            ]}
            value={sampleTab}
            onChange={setSampleTab}
          />
          <V3Badge label="Approved" tone="approved" />
          <V3Badge label="Needs Check" tone="pending" />
          <V3Badge label="Rejected" tone="rejected" />
          <V3Badge label="Policy v1" tone="neutral" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: V3_SPACE.sm }}>
            <V3UserAvatar fallbackName="Tushar" />
            <V3Text role="mono">GOOGLE AVATAR</V3Text>
          </View>
        </View>
      </V3Card>

      <V3Rule />

      {/* Section 4: Sharp Ruled Accordion (Direct on Canvas) */}
      <View style={{ gap: V3_SPACE.sm }}>
        <V3Text role="kicker">05 · RULED REVIEW ACCORDION (DIRECT ON CANVAS)</V3Text>
        <V3Rule strong />

        <V3AccordionItem
          title="Solar grid storage reaches record capacity across Europe"
          meta="REUTERS · WORLD · SCORE 94"
          expanded={openIdx === 0}
          onToggle={() => setOpenIdx(openIdx === 0 ? -1 : 0)}
        >
          <View style={{ gap: V3_SPACE.md }}>
            <V3Text role="body">
              Battery installations doubled across major grids this quarter, lowering peak evening curtailment.
            </V3Text>
            <View style={{ flexDirection: 'row', gap: V3_SPACE.sm, flexWrap: 'wrap' }}>
              <V3Button label="Approve" variant="primary" size="sm" onPress={() => {}} />
              <V3Button label="Reject" variant="danger" size="sm" onPress={() => {}} />
              <V3Button label="View details" variant="outline" size="sm" onPress={() => {}} />
            </View>
          </View>
        </V3AccordionItem>

        <V3AccordionItem
          title="Central banks hold steady on benchmark overnight rates"
          meta="AP · ECONOMY · APPROVED"
          expanded={openIdx === 1}
          decision="approved"
          onToggle={() => setOpenIdx(openIdx === 1 ? -1 : 1)}
        />

        <V3AccordionItem
          title="Unverified rumor about regional port closure"
          meta="RSS SNIPPET · REJECTED"
          expanded={openIdx === 2}
          decision="rejected"
          onToggle={() => setOpenIdx(openIdx === 2 ? -1 : 2)}
        />
      </View>
    </ScrollView>
  );
}
