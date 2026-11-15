import { useState } from 'react';
import { View } from 'react-native';
import {
  DSBadge,
  DSButton,
  DSCard,
  DSChip,
  DSDivider,
  DSInput,
  DSPage,
  DSSegmentedControl,
  DSStatTile,
  DSTable,
  DSTableHeader,
  DSTableRow,
  DSText,
  DSWell,
  useDSTheme,
  type DSTextWeight,
  type DSTone,
  type DSTypographyKey,
} from '../../design-system';

const TYPE_ROLES: {
  variant: DSTypographyKey;
  weight: DSTextWeight;
  role: string;
  spec: string;
  sample: string;
}[] = [
  {
    variant: 'title2',
    weight: 'semibold',
    role: 'Page Title',
    spec: '24px · Semibold',
    sample: 'Approval Inbox',
  },
  {
    variant: 'title3',
    weight: 'semibold',
    role: 'Section Title',
    spec: '18px · Semibold',
    sample: 'Editorial Pipeline Overview',
  },
  {
    variant: 'headline',
    weight: 'semibold',
    role: 'Card Title',
    spec: '16px · Semibold',
    sample: 'Scoring Policy & Thresholds',
  },
  {
    variant: 'body',
    weight: 'regular',
    role: 'Body / Row',
    spec: '14px · Regular',
    sample: 'Financial Times · Central banks hold corridor steady',
  },
  {
    variant: 'caption',
    weight: 'regular',
    role: 'Metadata',
    spec: '12px · Regular',
    sample: 'Updated 2m ago · 48 articles indexed',
  },
  {
    variant: 'micro',
    weight: 'semibold',
    role: 'Labels',
    spec: '11px · Semibold',
    sample: 'Published today',
  },
];

const SAMPLE_ROWS = [
  {
    id: 'row-1',
    title: 'Central banks signal coordinated pause on tightening',
    source: 'Financial Times',
    score: '9.1',
    status: 'Approved',
    tone: 'success' as DSTone,
    updated: '2m ago',
  },
  {
    id: 'row-2',
    title: 'Grid-scale sodium batteries clear utility benchmarks',
    source: 'Canary Media',
    score: '7.8',
    status: 'Pending',
    tone: 'warning' as DSTone,
    updated: '11m ago',
  },
  {
    id: 'row-3',
    title: 'Duplicate wire summary flagged by dedup gate',
    source: 'Wire Aggregator',
    score: '4.2',
    status: 'Rejected',
    tone: 'danger' as DSTone,
    updated: '41m ago',
  },
];

export function DesignSystemPane() {
  const { theme } = useDSTheme();
  const [segmentValue, setSegmentValue] = useState<'all' | 'pending' | 'approved'>('all');
  const [selectedChip, setSelectedChip] = useState<'markets' | 'energy'>('markets');
  const [sampleInput, setSampleInput] = useState('threshold >= 7.2');
  const [selectedRowId, setSelectedRowId] = useState<string>('row-1');

  const coreColors = [
    { name: 'Canvas', hex: theme.colors.canvas, border: true },
    { name: 'Surface Well', hex: theme.colors.surfaceMuted, border: true },
    { name: 'Card Surface', hex: theme.colors.surface, border: true },
    { name: 'Border', hex: theme.colors.borderDefault, border: true },
    { name: 'Primary Ink', hex: theme.colors.textPrimary },
    { name: 'Secondary Ink', hex: theme.colors.textSecondary },
    { name: 'Muted Ink', hex: theme.colors.textTertiary },
    { name: 'Primary Accent', hex: theme.colors.accent },
    { name: 'Accent Light', hex: theme.colors.accentSoft, border: true },
    { name: 'Disabled', hex: theme.colors.disabledBg },
  ];

  const spacingTokens = [
    { label: '4px', value: theme.spacing.xs },
    { label: '8px', value: theme.spacing.sm },
    { label: '12px', value: theme.spacing.md },
    { label: '16px', value: theme.spacing.lg },
    { label: '24px', value: theme.spacing.xxl },
  ];

  const cornerTokens = [
    { label: 'Controls · 6px', radius: theme.radii.sm },
    { label: 'Cards · 10px', radius: theme.radii.md },
    { label: 'Pills', radius: theme.radii.pill },
  ];

  return (
    <DSPage
      title="Design System"
      headerRight={
        <DSBadge label={`Theme: ${theme.name}`} tone="accent" />
      }
    >
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          gap: theme.spacing.lg,
        }}
      >
        {/* Well 1: Tokens (Colors + Spacing & Corners) */}
        <DSWell title="Tokens">
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'stretch',
              gap: theme.spacing.md,
            }}
          >
            <DSCard>
              <View style={{ gap: theme.spacing.sm }}>
                <DSText variant="caption" weight="semibold" tone="secondary">
                  Colors
                </DSText>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: theme.spacing.md,
                    maxWidth: 300,
                  }}
                >
                  {coreColors.map((item) => (
                    <View
                      key={item.name}
                      style={{
                        width: 142,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: theme.spacing.sm,
                      }}
                    >
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: theme.radii.sm,
                          backgroundColor: item.hex,
                          borderWidth: item.border ? 1 : 0,
                          borderColor: theme.colors.borderDefault,
                        }}
                      />
                      <View>
                        <DSText variant="caption" weight="medium" tone="primary">
                          {item.name}
                        </DSText>
                        <DSText variant="micro" tone="tertiary" tabularNums>
                          {item.hex}
                        </DSText>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </DSCard>

            <DSCard>
              <View style={{ gap: theme.spacing.md }}>
                <View style={{ gap: theme.spacing.sm }}>
                  <DSText variant="caption" weight="semibold" tone="secondary">
                    Spacing
                  </DSText>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-end',
                      gap: theme.spacing.md,
                    }}
                  >
                    {spacingTokens.map((item) => (
                      <View key={item.label} style={{ alignItems: 'center', gap: theme.spacing.xs }}>
                        <View
                          style={{
                            width: item.value,
                            height: item.value,
                            backgroundColor: theme.colors.textPrimary,
                            borderRadius: theme.radii.xs,
                          }}
                        />
                        <DSText variant="micro" tone="secondary" tabularNums>
                          {item.label}
                        </DSText>
                      </View>
                    ))}
                  </View>
                </View>

                <DSDivider />

                <View style={{ gap: theme.spacing.sm }}>
                  <DSText variant="caption" weight="semibold" tone="secondary">
                    Corners
                  </DSText>
                  <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
                    {cornerTokens.map((item) => (
                      <View key={item.label} style={{ alignItems: 'center', gap: theme.spacing.xs }}>
                        <View
                          style={{
                            width: 44,
                            height: 24,
                            borderRadius: item.radius,
                            backgroundColor: theme.colors.surfaceMuted,
                            borderWidth: 1,
                            borderColor: theme.colors.borderDefault,
                          }}
                        />
                        <DSText variant="micro" tone="secondary">
                          {item.label}
                        </DSText>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </DSCard>
          </View>
        </DSWell>

        {/* Well 2: Typography */}
        <DSWell title="Typography">
          <DSCard>
            <View style={{ gap: theme.spacing.sm, maxWidth: 380 }}>
              {TYPE_ROLES.map((item, idx) => (
                <View
                  key={item.role}
                  style={{
                    paddingBottom: idx === TYPE_ROLES.length - 1 ? 0 : theme.spacing.sm,
                    borderBottomWidth:
                      idx === TYPE_ROLES.length - 1 ? 0 : theme.layout.borderWidth,
                    borderBottomColor: theme.colors.borderSubtle,
                    gap: theme.spacing.xxs,
                  }}
                >
                  <DSText variant="micro" tone="tertiary">
                    {item.role} · {item.spec}
                  </DSText>
                  <DSText
                    variant={item.variant}
                    weight={item.weight}
                    tone="primary"
                    numberOfLines={1}
                  >
                    {item.sample}
                  </DSText>
                </View>
              ))}
            </View>
          </DSCard>
        </DSWell>

        {/* Well 3: Controls */}
        <DSWell title="Controls">
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'stretch',
              gap: theme.spacing.md,
            }}
          >
            <DSCard>
              <View style={{ gap: theme.spacing.sm }}>
                <DSText variant="caption" weight="semibold" tone="secondary">
                  Buttons
                </DSText>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                    maxWidth: 340,
                  }}
                >
                  <DSButton label="Primary" variant="primary" onPress={() => {}} />
                  <DSButton label="Charcoal" variant="charcoal" onPress={() => {}} />
                  <DSButton label="Secondary" variant="secondary" onPress={() => {}} />
                  <DSButton label="Ghost" variant="ghost" onPress={() => {}} />
                  <DSButton label="Danger" variant="danger" onPress={() => {}} />
                  <DSButton label="Small" size="sm" variant="secondary" onPress={() => {}} />
                  <DSButton label="Disabled" variant="primary" disabled onPress={() => {}} />
                </View>
              </View>
            </DSCard>

            <DSCard>
              <View style={{ gap: theme.spacing.md }}>
                <View style={{ gap: theme.spacing.xs }}>
                  <DSText variant="caption" weight="semibold" tone="secondary">
                    Status Badges
                  </DSText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                    <DSBadge label="Neutral" tone="neutral" />
                    <DSBadge label="Approved" tone="success" />
                    <DSBadge label="Pending" tone="warning" />
                    <DSBadge label="Rejected" tone="danger" />
                  </View>
                </View>

                <DSDivider />

                <View style={{ gap: theme.spacing.xs }}>
                  <DSText variant="caption" weight="semibold" tone="secondary">
                    Filter Chips
                  </DSText>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                    <DSChip
                      label="Markets (18)"
                      active={selectedChip === 'markets'}
                      onPress={() => setSelectedChip('markets')}
                    />
                    <DSChip
                      label="Energy (9)"
                      active={selectedChip === 'energy'}
                      onPress={() => setSelectedChip('energy')}
                    />
                  </View>
                </View>
              </View>
            </DSCard>

            <DSCard>
              <View style={{ gap: theme.spacing.md, width: 260 }}>
                <View style={{ gap: theme.spacing.xs }}>
                  <DSText variant="caption" weight="semibold" tone="secondary">
                    Input (click to focus)
                  </DSText>
                  <DSInput
                    value={sampleInput}
                    onChangeText={setSampleInput}
                    placeholder="Filter..."
                  />
                </View>

                <View style={{ gap: theme.spacing.xs }}>
                  <DSText variant="caption" weight="semibold" tone="secondary">
                    Segmented Control
                  </DSText>
                  <DSSegmentedControl
                    value={segmentValue}
                    onChange={setSegmentValue}
                    options={[
                      { id: 'all', label: 'All' },
                      { id: 'pending', label: 'Pending' },
                      { id: 'approved', label: 'Approved' },
                    ]}
                  />
                </View>
              </View>
            </DSCard>
          </View>
        </DSWell>

        {/* Well 4: Cards & Metrics */}
        <DSWell title="Cards & Metrics">
          <View style={{ gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
              <DSStatTile
                label="Published"
                value={14}
                hint="Cap: 15"
                right={<DSBadge label="On Track" tone="success" />}
                style={{ flex: 0, minWidth: 165 }}
              />
              <DSStatTile
                label="Pending"
                value={6}
                hint="Avg 8.1"
                right={<DSBadge label="Queue" tone="warning" />}
                style={{ flex: 0, minWidth: 165 }}
              />
              <DSStatTile
                label="Feeds"
                value={28}
                hint="0 errors"
                style={{ flex: 0, minWidth: 140 }}
              />
            </View>

            <DSCard
              headerTitle="Section Card"
              headerSubtitle="10px corners · 1px warm border · 16px padding"
              headerRight={<DSButton label="Edit" size="sm" variant="secondary" onPress={() => {}} />}
            >
              <DSText variant="footnote" tone="secondary">
                Clean white card surface framed on the warm ivory canvas or cream well.
              </DSText>
            </DSCard>
          </View>
        </DSWell>

        {/* Well 5: Table */}
        <DSWell
          title="Table"
          right={
            <DSText variant="caption" tone="tertiary">
              Selected: {selectedRowId}
            </DSText>
          }
        >
          <DSTable style={{ width: undefined, maxWidth: '100%' }}>
            <DSTableHeader>
              <View style={{ width: 260, flexShrink: 1 }}>
                <DSText variant="micro" weight="semibold" tone="tertiary">
                  Headline
                </DSText>
              </View>
              <View style={{ width: 112 }}>
                <DSText variant="micro" weight="semibold" tone="tertiary">
                  Source
                </DSText>
              </View>
              <View style={{ width: 48 }}>
                <DSText variant="micro" weight="semibold" tone="tertiary">
                  Score
                </DSText>
              </View>
              <View style={{ width: 88 }}>
                <DSText variant="micro" weight="semibold" tone="tertiary">
                  Status
                </DSText>
              </View>
              <View style={{ width: 60, alignItems: 'flex-end' }}>
                <DSText variant="micro" weight="semibold" tone="tertiary">
                  Updated
                </DSText>
              </View>
            </DSTableHeader>
            {SAMPLE_ROWS.map((row, idx) => (
              <DSTableRow
                key={row.id}
                selected={selectedRowId === row.id}
                isLast={idx === SAMPLE_ROWS.length - 1}
                onPress={() => setSelectedRowId(row.id)}
              >
                <View style={{ width: 260, flexShrink: 1 }}>
                  <DSText variant="body" weight="semibold" tone="primary" numberOfLines={1}>
                    {row.title}
                  </DSText>
                </View>
                <View style={{ width: 112 }}>
                  <DSText variant="caption" tone="secondary" numberOfLines={1}>
                    {row.source}
                  </DSText>
                </View>
                <View style={{ width: 48 }}>
                  <DSText variant="body" weight="semibold" tone="primary" tabularNums>
                    {row.score}
                  </DSText>
                </View>
                <View style={{ width: 88 }}>
                  <DSBadge label={row.status} tone={row.tone} />
                </View>
                <View style={{ width: 60, alignItems: 'flex-end' }}>
                  <DSText variant="caption" tone="tertiary" tabularNums>
                    {row.updated}
                  </DSText>
                </View>
              </DSTableRow>
            ))}
          </DSTable>
        </DSWell>
      </View>
    </DSPage>
  );
}
