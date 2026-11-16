import type { ReactNode } from 'react';
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import {
  V2_COLORS,
  V2_FONT,
  V2_SHAPE,
  V2_SPACE,
  V2_TYPE,
} from './tokens';

interface V2TextProps extends TextProps {
  variant?: keyof typeof V2_TYPE;
  tone?: 'ink' | 'muted' | 'ready' | 'check' | 'unverified' | 'white';
  weight?: '400' | '500' | '600';
  tabular?: boolean;
  children: ReactNode;
}

export function V2Text({
  variant = 'body',
  tone = variant === 'meta' ? 'muted' : 'ink',
  weight,
  tabular = false,
  style,
  children,
  ...rest
}: V2TextProps) {
  const colorMap: Record<NonNullable<V2TextProps['tone']>, string> = {
    ink: V2_COLORS.ink,
    muted: V2_COLORS.muted,
    ready: V2_COLORS.statusReady,
    check: V2_COLORS.statusCheck,
    unverified: V2_COLORS.statusUnverified,
    white: V2_COLORS.ground,
  };

  const baseStyle = V2_TYPE[variant];
  const combined: TextStyle = {
    ...baseStyle,
    color: colorMap[tone],
    ...(weight ? { fontWeight: weight } : null),
    ...(tabular ? { fontVariant: ['tabular-nums'] } : null),
  };

  return (
    <Text style={[combined, style]} {...rest}>
      {children}
    </Text>
  );
}

export type V2ButtonVariant = 'primary' | 'secondary' | 'low' | 'link';

interface V2ButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  variant?: V2ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
}

export function V2Button({
  label,
  variant = 'low',
  disabled = false,
  style,
  ...rest
}: V2ButtonProps) {
  if (variant === 'link') {
    return (
      <Pressable
        disabled={disabled}
        accessibilityRole="button"
        style={({ pressed }) => [
          {
            minHeight: V2_SHAPE.buttonHeight,
            justifyContent: 'center',
            opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
          },
          style,
        ]}
        {...rest}
      >
        <Text
          style={{
            fontFamily: V2_FONT,
            fontSize: 14,
            fontWeight: '600',
            color: V2_COLORS.ink,
            textDecorationLine: 'underline',
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  const bg =
    variant === 'primary' ? V2_COLORS.ink : V2_COLORS.ground;
  const borderColor =
    variant === 'primary'
      ? V2_COLORS.ink
      : variant === 'secondary'
        ? V2_COLORS.ink
        : V2_COLORS.lineStrong;
  const textColor =
    variant === 'primary' ? V2_COLORS.ground : V2_COLORS.ink;

  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          height: V2_SHAPE.buttonHeight,
          paddingHorizontal: 16,
          borderRadius: V2_SHAPE.controlRadius,
          borderWidth: 1,
          borderColor,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <Text
        style={{
          fontFamily: V2_FONT,
          fontSize: 14,
          fontWeight: '600',
          color: textColor,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface V2InlineLinkProps extends Omit<PressableProps, 'style'> {
  label: string;
  style?: TextStyle;
}

export function V2InlineLink({ label, style, ...rest }: V2InlineLinkProps) {
  return (
    <Pressable
      accessibilityRole="link"
      style={({ pressed }) => ({
        opacity: pressed ? 0.65 : 1,
      })}
      {...rest}
    >
      <Text
        style={[
          {
            fontFamily: V2_FONT,
            fontSize: 14,
            fontWeight: '400',
            color: V2_COLORS.ink,
            textDecorationLine: 'underline',
          },
          style,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

interface V2InputProps extends TextInputProps {
  multiline?: boolean;
}

export function V2Input({
  multiline = false,
  style,
  ...rest
}: V2InputProps) {
  return (
    <TextInput
      placeholderTextColor={V2_COLORS.muted}
      multiline={multiline}
      style={[
        {
          fontFamily: V2_FONT,
          fontSize: 14,
          fontWeight: '400',
          lineHeight: 20,
          color: V2_COLORS.ink,
          backgroundColor: V2_COLORS.ground,
          borderWidth: 1,
          borderColor: V2_COLORS.lineStrong,
          borderRadius: V2_SHAPE.controlRadius,
          paddingHorizontal: 12,
          paddingVertical: multiline ? 10 : 0,
          minHeight: multiline ? 96 : V2_SHAPE.buttonHeight,
        },
        style,
      ]}
      {...rest}
    />
  );
}

export type StatusKind = 'ready' | 'check' | 'unverified' | 'published' | 'rejected';

const STATUS_META: Record<
  StatusKind,
  { label: string; color: string; symbol: 'checkmark.circle' | 'exclamationmark.triangle' | 'xmark.circle' }
> = {
  ready: {
    label: 'Ready',
    color: V2_COLORS.statusReady,
    symbol: 'checkmark.circle',
  },
  published: {
    label: 'Published',
    color: V2_COLORS.statusReady,
    symbol: 'checkmark.circle',
  },
  check: {
    label: 'Check',
    color: V2_COLORS.statusCheck,
    symbol: 'exclamationmark.triangle',
  },
  unverified: {
    label: 'Unverified',
    color: V2_COLORS.statusUnverified,
    symbol: 'xmark.circle',
  },
  rejected: {
    label: 'Rejected',
    color: V2_COLORS.statusUnverified,
    symbol: 'xmark.circle',
  },
};

function StatusSvg({ kind, color }: { kind: StatusKind; color: string }) {
  if (kind === 'ready' || kind === 'published') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.4" />
        <path
          d="M5.2 8.2L7.1 10.1L10.9 6.1"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === 'check') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 2.2L14.2 13.2H1.8L8 2.2Z"
          stroke={color}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M8 6.4V9.4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="8" cy="11.3" r="0.8" fill={color} />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.4" />
      <path
        d="M5.8 5.8L10.2 10.2M10.2 5.8L5.8 10.2"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StatusLabel({ kind }: { kind: StatusKind }) {
  const meta = STATUS_META[kind];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: V2_SPACE.gapSm,
      }}
    >
      {Platform.OS === 'web' ? (
        <StatusSvg kind={kind} color={meta.color} />
      ) : (
        <SymbolView
          name={meta.symbol}
          size={16}
          tintColor={meta.color}
        />
      )}
      <Text
        style={{
          fontFamily: V2_FONT,
          fontSize: 14,
          fontWeight: '500',
          color: meta.color,
        }}
      >
        {meta.label}
      </Text>
    </View>
  );
}

export function V2Divider({ strong = false }: { strong?: boolean }) {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: strong ? V2_COLORS.lineStrong : V2_COLORS.line,
        width: '100%',
      }}
    />
  );
}
