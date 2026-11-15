import { SymbolView } from 'expo-symbols';
import { Platform, Text, View } from 'react-native';
import type { TopicSignalStatus } from '@/lib/topicPreferences';

interface TopicSignalIconProps {
  status: TopicSignalStatus;
  size?: number;
  boostedColor?: string;
  reducedColor?: string;
  normalColor?: string;
  offColor?: string;
}

/**
 * Topic frequency indicator on menu items:
 * - boosted: up arrow
 * - reduced: down arrow
 * - normal: neutral dash
 * - off: cross
 */
export function TopicSignalIcon({
  status,
  size = 15,
  boostedColor = '#34D399',
  reducedColor = '#FBBF24',
  normalColor = 'rgba(250, 249, 246, 0.48)',
  offColor = 'rgba(250, 249, 246, 0.36)',
}: TopicSignalIconProps) {
  const color =
    status === 'boosted'
      ? boostedColor
      : status === 'reduced'
        ? reducedColor
        : status === 'off'
          ? offColor
          : normalColor;

  if (status === 'normal') {
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: Math.max(8, Math.round(size * 0.65)),
            height: 2,
            borderRadius: 999,
            backgroundColor: color,
          }}
        />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {status === 'boosted' ? (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: 'block' }}
          >
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        ) : status === 'reduced' ? (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: 'block' }}
          >
            <path d="M12 5v14" />
            <path d="m19 12-7 7-7-7" />
          </svg>
        ) : (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: 'block' }}
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        )}
      </View>
    );
  }

  const iosName =
    status === 'boosted'
      ? 'arrow.up'
      : status === 'reduced'
        ? 'arrow.down'
        : 'xmark';
  const materialName =
    status === 'boosted'
      ? 'arrow_upward'
      : status === 'reduced'
        ? 'arrow_downward'
        : 'close';
  const fallbackChar =
    status === 'boosted' ? '↑' : status === 'reduced' ? '↓' : '✕';

  return (
    <SymbolView
      name={{ ios: iosName, android: materialName, web: materialName }}
      size={size}
      weight="semibold"
      tintColor={color}
      fallback={
        <Text
          style={{
            fontSize: size,
            fontWeight: '700',
            color,
            lineHeight: size + 2,
          }}
        >
          {fallbackChar}
        </Text>
      }
    />
  );
}
