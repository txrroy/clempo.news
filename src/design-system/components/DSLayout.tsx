import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useDSTheme } from '../ThemeContext';
import { DSCard } from './DSCard';
import { DSText } from './DSText';

export interface DSPageProps {
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  children: ReactNode;
}

/**
 * Standard full-width admin page container.
 * Enforces identical horizontal padding (24px), vertical rhythm (20px),
 * and clean monochrome canvas background across every admin view.
 */
export function DSPage({
  title,
  subtitle,
  headerRight,
  scrollable = true,
  style,
  children,
}: DSPageProps) {
  const { theme } = useDSTheme();

  const headerBlock =
    title || subtitle || headerRight ? (
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.md,
        }}
      >
        <View style={{ flex: 1, minWidth: 220, gap: theme.spacing.xs }}>
          {title ? (
            <DSText variant="title2" weight="semibold" tone="primary">
              {title}
            </DSText>
          ) : null}
          {subtitle ? (
            <DSText variant="footnote" tone="secondary">
              {subtitle}
            </DSText>
          ) : null}
        </View>
        {headerRight ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            {headerRight}
          </View>
        ) : null}
      </View>
    ) : null;

  if (!scrollable) {
    return (
      <View
        style={[
          {
            flex: 1,
            minHeight: 0,
            width: '100%',
            backgroundColor: theme.colors.canvas,
            paddingHorizontal: theme.spacing.xxl,
            paddingVertical: theme.spacing.xl,
            gap: theme.spacing.xl,
          },
          style,
        ]}
      >
        {headerBlock}
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, width: '100%', backgroundColor: theme.colors.canvas }}
      contentContainerStyle={[
        {
          width: '100%',
          paddingHorizontal: theme.spacing.xxl,
          paddingVertical: theme.spacing.xl,
          paddingBottom: theme.spacing.xxxl,
          gap: theme.spacing.xl,
        },
        style,
      ]}
    >
      {headerBlock}
      {children}
    </ScrollView>
  );
}

export interface DSSectionHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

/**
 * Consistent section label + optional subtitle/action row.
 */
export function DSSectionHeader({ title, subtitle, right }: DSSectionHeaderProps) {
  const { theme } = useDSTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
      }}
    >
      <View style={{ flex: 1, minWidth: 200, gap: theme.spacing.xxs }}>
        <DSText variant="title3" weight="semibold" tone="primary">
          {title}
        </DSText>
        {subtitle ? (
          <DSText variant="caption" tone="tertiary">
            {subtitle}
          </DSText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export interface DSStatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  right?: ReactNode;
  style?: ViewStyle;
}

/**
 * Standard summary metric card built directly on DSCard.
 */
export function DSStatTile({ label, value, hint, right, style }: DSStatTileProps) {
  const { theme } = useDSTheme();
  return (
    <DSCard padding="lg" style={[{ flex: 1, minWidth: 180 }, style]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        }}
      >
        <DSText variant="micro" weight="semibold" tone="tertiary">
          {label}
        </DSText>
        {right}
      </View>
      <DSText
        variant="metric"
        weight="semibold"
        tone="primary"
        tabularNums
        style={{ marginTop: theme.spacing.sm }}
      >
        {value}
      </DSText>
      {hint ? (
        <DSText
          variant="caption"
          tone="secondary"
          style={{ marginTop: theme.spacing.xs }}
        >
          {hint}
        </DSText>
      ) : null}
    </DSCard>
  );
}

export interface DSWellProps {
  title?: string;
  right?: ReactNode;
  style?: ViewStyle;
  children: ReactNode;
}

/**
 * Auto-width muted container well (#F3F3F3, 8px radius, 16px padding)
 * for grouping related cards or controls compactly on wide viewports.
 */
export function DSWell({ title, right, style, children }: DSWellProps) {
  const { theme } = useDSTheme();
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          maxWidth: '100%',
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radii.md,
          borderWidth: theme.layout.borderWidth,
          borderColor: theme.colors.borderDefault,
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        style,
      ]}
    >
      {title || right ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
          }}
        >
          {title ? (
            <DSText variant="headline" weight="semibold" tone="primary">
              {title}
            </DSText>
          ) : (
            <View />
          )}
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}
