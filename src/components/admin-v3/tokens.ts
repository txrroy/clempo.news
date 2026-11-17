import { Platform, type TextStyle } from 'react-native';

export const V3_COLORS = {
  // High-Contrast Architectural Canvas & Surfaces
  canvas: '#F5F4EF',
  surface: '#FFFFFF',
  surfaceWell: '#ECEAE2',

  // Stark Dark Anchor & Text Hierarchy
  ink: '#121814',
  inkMuted: '#4A524D',
  inkSubtle: '#767E79',
  inkInverse: '#FFFFFF',

  // Structural Hairlines & Strong Dividers
  border: '#C8C4BA',
  ruleStrong: '#121814',

  // Vibrant Botanical Green (Primary Punch Accent)
  green: '#1F7A3E',
  greenVibrant: '#258F49',
  greenSoft: '#E3F3E8',

  // Vivid Signal Orange (Alert / Missed Run / Attention)
  orange: '#D9531E',
  orangeSoft: '#FDECE4',

  // Stark Danger
  red: '#B91C1C',
  redSoft: '#FEE2E2',

  // Disabled
  disabledBg: '#DDDAD2',
  disabledInk: '#8A877F',
} as const;

export const V3_FONTS = {
  sans: Platform.select({
    web: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    default: 'Inter',
  }),
  display: Platform.select({
    web: 'Newsreader, Georgia, "Times New Roman", serif',
    default: 'Georgia',
  }),
  mono: Platform.select({
    web: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    default: 'Courier',
  }),
} as const;

export const V3_TYPE: Record<
  'title' | 'section' | 'headline' | 'body' | 'kicker' | 'mono',
  TextStyle
> = {
  title: {
    fontFamily: V3_FONTS.display,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 34,
    letterSpacing: -0.4,
    color: V3_COLORS.ink,
  },
  section: {
    fontFamily: V3_FONTS.sans,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.2,
    color: V3_COLORS.ink,
  },
  headline: {
    fontFamily: V3_FONTS.sans,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    color: V3_COLORS.ink,
  },
  body: {
    fontFamily: V3_FONTS.sans,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    color: V3_COLORS.ink,
  },
  kicker: {
    fontFamily: V3_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: V3_COLORS.inkMuted,
  },
  mono: {
    fontFamily: V3_FONTS.mono,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: V3_COLORS.inkMuted,
  },
};

export const V3_SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const V3_RADII = {
  // Sharp structural corners vs. pill controls for architectural contrast
  sharp: 0,
  control: 9999,
} as const;
