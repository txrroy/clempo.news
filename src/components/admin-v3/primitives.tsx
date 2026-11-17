import type { ReactNode } from 'react';
import {
  Image,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { V3_COLORS, V3_RADII, V3_SPACE, V3_TYPE } from './tokens';

type V3TextRole = keyof typeof V3_TYPE;
type V3TextTone = 'ink' | 'muted' | 'subtle' | 'inverse' | 'green' | 'orange' | 'red';

interface V3TextProps extends Omit<TextProps, 'role'> {
  role?: V3TextRole;
  tone?: V3TextTone;
  weight?: '400' | '500' | '600' | '700';
  tabularNums?: boolean;
}

const TONE_MAP: Record<V3TextTone, string> = {
  ink: V3_COLORS.ink,
  muted: V3_COLORS.inkMuted,
  subtle: V3_COLORS.inkSubtle,
  inverse: V3_COLORS.inkInverse,
  green: V3_COLORS.green,
  orange: V3_COLORS.orange,
  red: V3_COLORS.red,
};

export function V3Text({
  role = 'body',
  tone,
  weight,
  tabularNums = false,
  style,
  children,
  ...rest
}: V3TextProps) {
  return (
    <Text
      style={[
        V3_TYPE[role],
        tone ? { color: TONE_MAP[tone] } : undefined,
        weight ? { fontWeight: weight } : undefined,
        tabularNums ? { fontVariant: ['tabular-nums'] } : undefined,
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

/**
 * Full-bleed structural divider line.
 */
export function V3Rule({ strong = false }: { strong?: boolean }) {
  return (
    <View
      style={{
        width: '100%',
        height: strong ? 2 : 1,
        backgroundColor: strong ? V3_COLORS.ruleStrong : V3_COLORS.border,
      }}
    />
  );
}

/**
 * Strict v3 Card rule:
 * Sharp architectural corners (0px) + EITHER a background fill OR a border — NEVER both, and never nested.
 */
interface V3CardProps {
  variant?: 'filled' | 'outlined';
  padding?: keyof typeof V3_SPACE;
  style?: ViewStyle;
  children: ReactNode;
}

export function V3Card({
  variant = 'filled',
  padding = 'xl',
  style,
  children,
}: V3CardProps) {
  const isFilled = variant === 'filled';
  return (
    <View
      style={[
        {
          borderRadius: V3_RADII.sharp,
          padding: V3_SPACE[padding],
          backgroundColor: isFilled ? V3_COLORS.surface : 'transparent',
          borderWidth: isFilled ? 0 : 1,
          borderColor: isFilled ? 'transparent' : V3_COLORS.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type V3ButtonVariant = 'primary' | 'dark' | 'outline' | 'danger';

interface V3ButtonProps {
  label: string;
  variant?: V3ButtonVariant;
  size?: 'sm' | 'md';
  disabled?: boolean;
  onPress: () => void;
}

export function V3Button({
  label,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onPress,
}: V3ButtonProps) {
  const bgMap: Record<V3ButtonVariant, string> = {
    primary: V3_COLORS.green,
    dark: V3_COLORS.ink,
    outline: 'transparent',
    danger: V3_COLORS.redSoft,
  };
  const inkMap: Record<V3ButtonVariant, V3TextTone> = {
    primary: 'inverse',
    dark: 'inverse',
    outline: 'ink',
    danger: 'red',
  };

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        height: size === 'sm' ? 32 : 40,
        paddingHorizontal: size === 'sm' ? V3_SPACE.md : V3_SPACE.lg,
        borderRadius: V3_RADII.control,
        backgroundColor: disabled ? V3_COLORS.disabledBg : bgMap[variant],
        borderWidth: variant === 'outline' && !disabled ? 1 : 0,
        borderColor: variant === 'outline' ? V3_COLORS.ink : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed && !disabled ? 0.85 : 1,
        ...(Platform.OS === 'web'
          ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as Record<
              string,
              unknown
            >)
          : {}),
      })}
    >
      <V3Text
        role={size === 'sm' ? 'mono' : 'body'}
        weight="600"
        tone={disabled ? 'subtle' : inkMap[variant]}
      >
        {label}
      </V3Text>
    </Pressable>
  );
}

export type V3BadgeTone = 'approved' | 'pending' | 'rejected' | 'neutral';

export function V3Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: V3BadgeTone;
}) {
  const map: Record<V3BadgeTone, { bg: string; ink: V3TextTone }> = {
    approved: { bg: V3_COLORS.greenSoft, ink: 'green' },
    pending: { bg: V3_COLORS.orangeSoft, ink: 'orange' },
    rejected: { bg: V3_COLORS.redSoft, ink: 'red' },
    neutral: { bg: V3_COLORS.surfaceWell, ink: 'muted' },
  };

  return (
    <View
      style={{
        paddingHorizontal: V3_SPACE.md,
        paddingVertical: V3_SPACE.xs,
        borderRadius: V3_RADII.control,
        backgroundColor: map[tone].bg,
        alignSelf: 'flex-start',
      }}
    >
      <V3Text role="kicker" tone={map[tone].ink}>
        {label}
      </V3Text>
    </View>
  );
}

export function V3Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignSelf: 'flex-start',
        backgroundColor: V3_COLORS.surfaceWell,
        padding: V3_SPACE.xs,
        borderRadius: V3_RADII.control,
        gap: V3_SPACE.xs,
      }}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={{
              paddingHorizontal: V3_SPACE.lg,
              paddingVertical: V3_SPACE.xs + 2,
              borderRadius: V3_RADII.control,
              backgroundColor: active ? V3_COLORS.ink : 'transparent',
              ...(Platform.OS === 'web'
                ? ({ cursor: 'pointer' } as Record<string, unknown>)
                : {}),
            }}
          >
            <V3Text
              role="kicker"
              tone={active ? 'inverse' : 'muted'}
            >
              {opt.label}
            </V3Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface V3AccordionItemProps {
  title: string;
  meta: string;
  expanded: boolean;
  decision?: 'approved' | 'rejected' | null;
  onToggle: () => void;
  children?: ReactNode;
}

export function V3AccordionItem({
  title,
  meta,
  expanded,
  decision = null,
  onToggle,
  children,
}: V3AccordionItemProps) {
  const isDecided = decision !== null;
  return (
    <View
      style={{
        borderRadius: V3_RADII.sharp,
        backgroundColor: expanded ? V3_COLORS.surface : 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: V3_COLORS.border,
        paddingHorizontal: V3_SPACE.lg,
        paddingVertical: V3_SPACE.md,
        opacity: isDecided && !expanded ? 0.52 : 1,
        gap: V3_SPACE.md,
      }}
    >
      <Pressable
        onPress={onToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: V3_SPACE.md,
          ...(Platform.OS === 'web'
            ? ({ cursor: 'pointer' } as Record<string, unknown>)
            : {}),
        }}
      >
        <View style={{ flex: 1, minWidth: 0, gap: V3_SPACE.xs }}>
          <V3Text role="headline" numberOfLines={1}>
            {title}
          </V3Text>
          <V3Text role="mono" tone="muted" numberOfLines={1}>
            {meta}
          </V3Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: V3_SPACE.sm,
          }}
        >
          {decision === 'approved' ? (
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: V3_RADII.control,
                backgroundColor: V3_COLORS.greenSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <V3Text role="mono" weight="700" tone="green">
                ✓
              </V3Text>
            </View>
          ) : decision === 'rejected' ? (
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: V3_RADII.control,
                backgroundColor: V3_COLORS.redSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <V3Text role="mono" weight="700" tone="red">
                ✕
              </V3Text>
            </View>
          ) : null}

          <V3Text role="mono" tone="subtle">
            {expanded ? '▴' : '▾'}
          </V3Text>
        </View>
      </Pressable>

      {expanded && children ? <View>{children}</View> : null}
    </View>
  );
}

export function V3UserAvatar({
  photoURL,
  fallbackName,
}: {
  photoURL?: string | null;
  fallbackName: string;
}) {
  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={{
          width: 30,
          height: 30,
          borderRadius: V3_RADII.control,
          backgroundColor: V3_COLORS.surfaceWell,
        }}
      />
    );
  }
  const initial = (fallbackName.trim()[0] || 'E').toUpperCase();
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: V3_RADII.control,
        backgroundColor: V3_COLORS.ink,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <V3Text role="mono" weight="700" tone="inverse">
        {initial}
      </V3Text>
    </View>
  );
}

export function V3Input({ style, ...rest }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={V3_COLORS.inkSubtle}
      style={[
        {
          borderRadius: V3_RADII.sharp,
          borderWidth: 1,
          borderColor: V3_COLORS.border,
          backgroundColor: V3_COLORS.surface,
          paddingHorizontal: V3_SPACE.md,
          paddingVertical: V3_SPACE.sm + 2,
          color: V3_COLORS.ink,
          ...V3_TYPE.body,
        },
        style,
      ]}
      {...rest}
    />
  );
}
