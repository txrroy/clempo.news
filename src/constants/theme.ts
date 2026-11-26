/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** Bricolage Grotesque sans */
    sans: 'BricolageGrotesque_400Regular',
    /** News editorial serif */
    serif: 'Newsreader_400Regular',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    /** Bricolage Grotesque sans */
    sans: 'BricolageGrotesque_400Regular',
    /** News editorial serif */
    serif: 'Newsreader_400Regular',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    serif: "'Newsreader', Georgia, Cambria, 'Times New Roman', serif",
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export type NewsFontWeight = '400' | '500' | '600' | '700';

const NEWSREADER_NATIVE_BY_WEIGHT: Record<NewsFontWeight, string> = {
  '400': 'Newsreader_400Regular',
  '500': 'Newsreader_500Medium',
  '600': 'Newsreader_600SemiBold',
  '700': 'Newsreader_700Bold',
};

/**
 * Returns cross-platform Newsreader text style.
 * On native, omits fontWeight so Android/iOS use the exact loaded face without fallback.
 */
export function getNewsFontStyle(weight: NewsFontWeight = '400'): {
  fontFamily: string;
  fontWeight?: NewsFontWeight;
} {
  if (Platform.OS === 'web') {
    return {
      fontFamily: "'Newsreader', Georgia, Cambria, 'Times New Roman', serif",
      fontWeight: weight,
    };
  }
  return {
    fontFamily: NEWSREADER_NATIVE_BY_WEIGHT[weight],
  };
}

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
