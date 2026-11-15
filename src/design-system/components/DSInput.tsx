import { useState } from 'react';
import { Platform, TextInput, type TextInputProps } from 'react-native';
import { useDSTheme } from '../ThemeContext';

export interface DSInputProps extends TextInputProps {
  compact?: boolean;
}

export function DSInput({ compact = false, style, onFocus, onBlur, ...rest }: DSInputProps) {
  const { theme } = useDSTheme();
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      placeholderTextColor={theme.colors.textTertiary}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        theme.typography.body,
        {
          fontFamily: theme.fontFamilies.sans,
          color: theme.colors.textPrimary,
          backgroundColor: theme.colors.surface,
          borderWidth: theme.layout.borderWidth,
          borderColor: focused ? theme.colors.accent : theme.colors.borderDefault,
          borderRadius: theme.radii.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: compact ? theme.spacing.xs + 3 : theme.spacing.sm + 2,
          ...(Platform.OS === 'web'
            ? ({
                outlineStyle: 'none',
                boxShadow: focused ? `0 0 0 3px ${theme.colors.accentSoft}` : undefined,
              } as Record<string, unknown>)
            : {}),
        },
        style,
      ]}
      {...rest}
    />
  );
}
