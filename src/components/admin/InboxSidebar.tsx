import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { DSDivider, DSText, useDSTheme } from '@/design-system';

export type InboxFolder =
  | { type: 'all-pending' }
  | { type: 'all-published' }
  | { type: 'today-published' }
  | { type: 'today-pending' }
  | { type: 'older-date'; date: string };

export interface OlderDateEntry {
  date: string;
  count: number;
}

interface InboxSidebarProps {
  allPendingCount: number;
  allPublishedCount: number;
  todayPublishedCount: number;
  todayPendingCount: number;
  olderDates: OlderDateEntry[];
  selectedFolder: InboxFolder;
  onSelectFolder: (folder: InboxFolder) => void;
}

type SectionKey = 'all' | 'today' | 'older';

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatEditionDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const month = MONTH_NAMES[monthIdx];
  if (!month || Number.isNaN(day)) return dateStr;
  return `${month} ${day}, ${year}`;
}

function isSameFolder(a: InboxFolder, b: InboxFolder): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'older-date' && b.type === 'older-date') {
    return a.date === b.date;
  }
  return true;
}

interface SidebarItemProps {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}

function SidebarItem({ label, count, active, onPress }: SidebarItemProps) {
  const { theme } = useDSTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          marginBottom: theme.spacing.xxs,
          borderRadius: theme.radii.sm,
          backgroundColor: active
            ? theme.colors.accentSoft
            : pressed
              ? theme.colors.surfaceHover
              : 'transparent',
          borderWidth: theme.layout.borderWidth,
          borderColor: active ? theme.colors.accentBorder : 'transparent',
          ...(Platform.OS === 'web'
            ? ({ cursor: 'pointer' } as Record<string, unknown>)
            : {}),
        },
      ]}
    >
      <DSText
        variant="footnote"
        weight={active ? 'semibold' : 'medium'}
        tone={active ? 'accent' : 'primary'}
        numberOfLines={1}
        style={{ flex: 1, minWidth: 0 }}
      >
        {label}
      </DSText>

      <DSText
        variant="caption"
        weight={active ? 'semibold' : 'medium'}
        tone={active ? 'accent' : 'tertiary'}
        tabularNums
        style={{ marginLeft: theme.spacing.sm }}
      >
        {count}
      </DSText>
    </Pressable>
  );
}

interface CollapsibleSectionProps {
  title: string;
  countLabel?: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function CollapsibleSection({
  title,
  countLabel,
  collapsed,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  const { theme } = useDSTheme();

  return (
    <View style={{ gap: theme.spacing.xxs }}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.xs,
          borderRadius: theme.radii.sm,
          backgroundColor: pressed ? theme.colors.surfaceHover : 'transparent',
          ...(Platform.OS === 'web'
            ? ({ cursor: 'pointer' } as Record<string, unknown>)
            : {}),
        })}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            flex: 1,
            minWidth: 0,
          }}
        >
          <DSText variant="micro" weight="semibold" tone="tertiary">
            {collapsed ? '▸' : '▾'}
          </DSText>
          <DSText
            variant="micro"
            weight="semibold"
            tone="tertiary"
            numberOfLines={1}
          >
            {title}
          </DSText>
        </View>
        {countLabel ? (
          <DSText variant="micro" tone="tertiary" tabularNums>
            {countLabel}
          </DSText>
        ) : null}
      </Pressable>

      {!collapsed ? <View style={{ paddingTop: theme.spacing.xxs }}>{children}</View> : null}
    </View>
  );
}

export function InboxSidebar({
  allPendingCount,
  allPublishedCount,
  todayPublishedCount,
  todayPendingCount,
  olderDates,
  selectedFolder,
  onSelectFolder,
}: InboxSidebarProps) {
  const { theme } = useDSTheme();
  const [collapsedSections, setCollapsedSections] = useState<
    Record<SectionKey, boolean>
  >({
    all: false,
    today: false,
    older: false,
  });

  const toggleSection = (key: SectionKey) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View
      className="w-full md:w-[236px] md:shrink-0 max-h-60 md:max-h-none border-b md:border-b-0 md:border-r"
      style={{
        backgroundColor: theme.colors.surfaceMuted,
        borderColor: theme.colors.borderDefault,
        minHeight: 0,
      }}
    >
      <ScrollView
        showsVerticalScrollIndicator
        style={{
          flex: 1,
          minHeight: 0,
          ...(Platform.OS === 'web'
            ? ({ scrollbarGutter: 'stable' } as Record<string, unknown>)
            : {}),
        }}
        contentContainerStyle={{
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        }}
      >
        <CollapsibleSection
          title="All Editions"
          countLabel={String(allPendingCount + allPublishedCount)}
          collapsed={collapsedSections.all}
          onToggle={() => toggleSection('all')}
        >
          <SidebarItem
            label="In Review"
            count={allPendingCount}
            active={isSameFolder(selectedFolder, { type: 'all-pending' })}
            onPress={() => onSelectFolder({ type: 'all-pending' })}
          />
          <SidebarItem
            label="All Published"
            count={allPublishedCount}
            active={isSameFolder(selectedFolder, { type: 'all-published' })}
            onPress={() => onSelectFolder({ type: 'all-published' })}
          />
        </CollapsibleSection>

        <DSDivider />

        <CollapsibleSection
          title="Today"
          countLabel={String(todayPendingCount + todayPublishedCount)}
          collapsed={collapsedSections.today}
          onToggle={() => toggleSection('today')}
        >
          <SidebarItem
            label="Published"
            count={todayPublishedCount}
            active={isSameFolder(selectedFolder, { type: 'today-published' })}
            onPress={() => onSelectFolder({ type: 'today-published' })}
          />
          <SidebarItem
            label="In Review"
            count={todayPendingCount}
            active={isSameFolder(selectedFolder, { type: 'today-pending' })}
            onPress={() => onSelectFolder({ type: 'today-pending' })}
          />
        </CollapsibleSection>

        <DSDivider />

        <CollapsibleSection
          title="Older Editions"
          countLabel={String(olderDates.length)}
          collapsed={collapsedSections.older}
          onToggle={() => toggleSection('older')}
        >
          {olderDates.length === 0 ? (
            <DSText
              variant="caption"
              tone="tertiary"
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
              }}
            >
              No older dates
            </DSText>
          ) : (
            olderDates.map((entry) => (
              <SidebarItem
                key={entry.date}
                label={formatEditionDate(entry.date)}
                count={entry.count}
                active={isSameFolder(selectedFolder, {
                  type: 'older-date',
                  date: entry.date,
                })}
                onPress={() =>
                  onSelectFolder({ type: 'older-date', date: entry.date })
                }
              />
            ))
          )}
        </CollapsibleSection>
      </ScrollView>
    </View>
  );
}
