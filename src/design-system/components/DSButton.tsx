import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableProps,
  type ViewStyle,
} from 'react-native';
import { useDSTheme } from '../ThemeContext';
import { DSText, type DSTextTone } from './DSText';

export type DSButtonVariant =
  | 'primary'
  | 'charcoal'
  | 'accent'
  | 'secondary'
  | 'tinted'
  | 'ghost'
  | 'danger'
  | 'success';

export type DSButtonSize = 'sm' | 'md' | 'lg';

export interface DSButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: DSButtonVariant;
  size?: DSButtonSize;
  pill?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function DSButton({
  label,
  variant = 'primary',
  size = 'md',
  pill = false,
  loading = false,
  disabled = false,
  style,
  ...rest
}: DSButtonProps) {
  const { theme } = useDSTheme();
  const isDisabled = disabled || loading;

  const sizeMap: Record<
    DSButtonSize,
    { px: number; py: number; textVariant: 'caption' | 'footnote' | 'body' }
  > = {
    sm: { px: theme.spacing.md, py: theme.spacing.xs + 2, textVariant: 'caption' },
    md: { px: theme.spacing.lg, py: theme.spacing.sm + 2, textVariant: 'footnote' },
    lg: { px: theme.spacing.xl, py: theme.spacing.md, textVariant: 'body' },
  };

  const orangePrimary = {
    bg: theme.colors.accent,
    border: theme.colors.accent,
    textTone: 'inverse' as DSTextTone,
    spinnerColor: theme.colors.textInverse,
  };

  const charcoalPrimary = {
    bg: theme.colors.surfaceInk,
    border: theme.colors.surfaceInk,
    textTone: 'inverse' as DSTextTone,
    spinnerColor: theme.colors.textInverse,
  };

  const secondaryStyle = {
    bg: theme.colors.surface,
    border: theme.colors.borderDefault,
    textTone: 'primary' as DSTextTone,
    spinnerColor: theme.colors.textPrimary,
  };

  const variantStyles: Record<
    DSButtonVariant,
    { bg: string; border: string; textTone: DSTextTone; spinnerColor: string }
  > = {
    primary: orangePrimary,
    accent: orangePrimary,
    charcoal: charcoalPrimary,
    success: {
      bg: theme.colors.tones.success.bg,
      border: theme.colors.tones.success.border,
      textTone: 'success',
      spinnerColor: theme.colors.tones.success.text,
    },
    secondary: secondaryStyle,
    tinted: {
      bg: theme.colors.accentSoft,
      border: theme.colors.accentBorder,
      textTone: 'accent',
      spinnerColor: theme.colors.accentText,
    },
    ghost: {
      bg: 'transparent',
      border: 'transparent',
      textTone: 'primary',
      spinnerColor: theme.colors.textPrimary,
    },
    danger: {
      bg: theme.colors.tones.danger.bg,
      border: theme.colors.tones.danger.border,
      textTone: 'danger',
      spinnerColor: theme.colors.tones.danger.text,
    },
  };

  const v = variantStyles[variant];
  const s = sizeMap[size];

  return (
    <Pressable
      disabled={isDisabled}
      accessibilityRole="button"
      style={(state) => {
        const { pressed } = state;
        const hovered = (state as { hovered?: boolean }).hovered;
        const focused = (state as { focused?: boolean }).focused;
        return [
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: s.px,
            paddingVertical: s.py,
            borderRadius: pill ? theme.radii.pill : theme.radii.sm,
            backgroundColor: isDisabled ? theme.colors.disabledBg : v.bg,
            borderWidth: theme.layout.borderWidth,
            borderColor: isDisabled
              ? theme.colors.disabledBg
              : focused
                ? theme.colors.accent
                : v.border,
            opacity: isDisabled ? 0.85 : pressed ? 0.86 : hovered ? 0.94 : 1,
            ...(Platform.OS === 'web'
              ? ({
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  outlineWidth: focused ? 2 : 0,
                  outlineColor: theme.colors.accentSoft,
                  outlineStyle: 'solid',
                } as Record<string, unknown>)
              : {}),
          },
          style,
        ];
      }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isDisabled ? theme.colors.disabledText : v.spinnerColor}
        />
      ) : (
        <DSText
          variant={s.textVariant}
          weight="semibold"
          tone={isDisabled ? 'tertiary' : v.textTone}
          style={isDisabled ? { color: theme.colors.disabledText } : undefined}
        >
          {label}
        </DSText>
      )}
    </Pressable>
  );
}
