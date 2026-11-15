import type { ReactNode } from 'react';
import { Platform, Pressable, View, type ViewStyle } from 'react-native';
import { useDSTheme } from '../ThemeContext';

export interface DSTableProps {
  style?: ViewStyle;
  children: ReactNode;
}

/**
 * Standard elevated bordered table container matching DSCard geometry (8px radius, #E5E7EB border, subtle card shadow).
 */
export function DSTable({ style, children }: DSTableProps) {
  const { theme } = useDSTheme();
  return (
    <View
      style={[
        {
          width: '100%',
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.md,
          borderWidth: theme.cardBorderWidth,
          borderColor: theme.colors.borderDefault,
          overflow: 'hidden',
          ...theme.shadows.card,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface DSTableHeaderProps {
  style?: ViewStyle;
  children: ReactNode;
}

/**
 * Muted #F3F3F3 column header row at the top of DSTable.
 */
export function DSTableHeader({ style, children }: DSTableHeaderProps) {
  const { theme } = useDSTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm + 2,
          backgroundColor: theme.colors.surfaceMuted,
          borderBottomWidth: theme.layout.borderWidth,
          borderBottomColor: theme.colors.borderDefault,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface DSTableRowProps {
  selected?: boolean;
  isLast?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  children: ReactNode;
}

/**
 * Standard horizontal row inside DSTable with consistent padding and #F3F3F3 hover/selected surface.
 */
export function DSTableRow({
  selected = false,
  isLast = false,
  onPress,
  style,
  children,
}: DSTableRowProps) {
  const { theme } = useDSTheme();

  const baseStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: selected ? theme.colors.surfaceSelected : theme.colors.surface,
    borderBottomWidth: isLast ? 0 : theme.layout.borderWidth,
    borderBottomColor: theme.colors.borderSubtle,
  };

  if (!onPress) {
    return <View style={[baseStyle, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        baseStyle,
        {
          backgroundColor: selected
            ? theme.colors.surfaceSelected
            : pressed
              ? theme.colors.surfaceHover
              : theme.colors.surface,
          ...(Platform.OS === 'web'
            ? ({ cursor: 'pointer' } as Record<string, unknown>)
            : {}),
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
