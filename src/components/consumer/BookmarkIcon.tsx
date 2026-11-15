import { SymbolView } from 'expo-symbols';
import { Platform, Text, View } from 'react-native';

interface BookmarkIconProps {
  filled?: boolean;
  color?: string;
  size?: number;
}

/**
 * Crisp bookmark icon across web, iOS, and Android.
 */
export function BookmarkIcon({
  filled = false,
  color = '#57534E',
  size = 16,
}: BookmarkIconProps) {
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
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={filled ? color : 'none'}
          stroke={color}
          strokeWidth={filled ? 1.8 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'block' }}
        >
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </svg>
      </View>
    );
  }

  return (
    <SymbolView
      name={{
        ios: filled ? 'bookmark.fill' : 'bookmark',
        android: filled ? 'bookmark' : 'bookmark_border',
        web: 'bookmark',
      }}
      size={size}
      tintColor={color}
      fallback={
        <Text style={{ fontSize: Math.round(size * 0.9), color }}>
          {filled ? '🔖' : '📑'}
        </Text>
      }
    />
  );
}
