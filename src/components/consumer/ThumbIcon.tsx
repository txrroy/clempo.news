import { SymbolView } from 'expo-symbols';
import { Platform, Text, View } from 'react-native';

interface ThumbIconProps {
  direction: 'up' | 'down';
  filled?: boolean;
  color?: string;
  size?: number;
}

/**
 * Crisp thumbs-up / thumbs-down icon across web, iOS, and Android.
 */
export function ThumbIcon({
  direction,
  filled = false,
  color = '#57534E',
  size = 16,
}: ThumbIconProps) {
  if (Platform.OS === 'web') {
    const rotation = direction === 'down' ? 'rotate(180deg)' : undefined;
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          transform: direction === 'down' ? [{ rotate: '180deg' }] : undefined,
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={filled ? color : 'none'}
          stroke={color}
          strokeWidth={filled ? 1.8 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={rotation ? { display: 'block' } : { display: 'block' }}
        >
          <path d="M7 10v12" />
          <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
        </svg>
      </View>
    );
  }

  const iosName =
    direction === 'up'
      ? filled
        ? 'hand.thumbsup.fill'
        : 'hand.thumbsup'
      : filled
        ? 'hand.thumbsdown.fill'
        : 'hand.thumbsdown';

  return (
    <SymbolView
      name={{ ios: iosName, android: direction === 'up' ? 'thumb_up' : 'thumb_down', web: 'thumb_up' }}
      size={size}
      tintColor={color}
      fallback={
        <Text style={{ fontSize: Math.round(size * 0.9), color }}>
          {direction === 'up' ? '👍' : '👎'}
        </Text>
      }
    />
  );
}
