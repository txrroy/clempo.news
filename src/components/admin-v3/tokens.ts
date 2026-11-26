import { Platform, type TextStyle } from 'react-native';

export const V3_COLORS = {
  // Ocean-Ser Semantic Canvas & Surfaces
  canvas: '#FCFDF9',
  surface: '#FFFFFF',
  surfaceWell: '#EFF6E0',

  // Deep Ocean Ink Hierarchy
  ink: '#01161E',
  inkMuted: '#01161ECC',
  inkSubtle: '#01161E99',
  inkInverse: '#FFFFFF',

  // Structural Hairlines & Strong Dividers
  border: '#AEC3B0',
  ruleStrong: '#01161E',

  // Semantic Accent (Deep Teal)
  accent: '#124559',
  accentVibrant: '#1A5E78',
  accentSoft: '#AEC3B0',

  // Semantic Warning (Amber)
  warning: '#FFBA08',
  warningInk: '#8A5A00',
  warningSoft: '#FDECE4',

  // Semantic Danger (Crimson)
  danger: '#D00000',
  dangerSoft: '#FEE2E2',

  // Disabled
  disabledBg: '#DDDDDD',
  disabledInk: '#8A877F',
} as const;

const ADMIN_FONT = Platform.select({
  web: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  default: 'Plus Jakarta Sans',
});

export const V3_FONTS = {
  sans: ADMIN_FONT,
  display: ADMIN_FONT,
  mono: ADMIN_FONT,
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
    letterSpacing: 0,
    color: V3_COLORS.ink,
  },
  body: {
    fontFamily: V3_FONTS.sans,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 21,
    letterSpacing: 0,
    color: V3_COLORS.ink,
  },
  kicker: {
    fontFamily: V3_FONTS.sans,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: V3_COLORS.inkMuted,
  },
  mono: {
    fontFamily: V3_FONTS.mono,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: 0,
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
  // Sharp structural cards (0px) vs. 8px rounded controls
  sharp: 0,
  control: 8,
} as const;
