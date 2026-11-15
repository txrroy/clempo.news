import { Platform } from 'react-native';

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 12,
  xl: 20,
  pill: 9999,
} as const;

export const typography = {
  micro: { fontSize: 11, lineHeight: 15, letterSpacing: 0.2 },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  footnote: { fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  body: { fontSize: 14, lineHeight: 21, letterSpacing: -0.05 },
  subhead: { fontSize: 14, lineHeight: 20, letterSpacing: -0.05 },
  headline: { fontSize: 16, lineHeight: 22, letterSpacing: -0.15 },
  title3: { fontSize: 18, lineHeight: 24, letterSpacing: -0.25 },
  title2: { fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  metric: { fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  display: { fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
} as const;

export const fontFamilies = {
  sans: Platform.select({
    ios: 'Inter',
    web: "'Inter', 'Geist', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    default: 'sans-serif',
  }),
  serif: Platform.select({
    ios: 'Inter',
    web: "'Inter', 'Geist', 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
    default: 'sans-serif',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    web: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    default: 'monospace',
  }),
} as const;

export const layout = {
  topBarHeight: 56,
  sidebarWidth: 248,
  drawerMaxWidth: 9999,
  contentMaxWidth: 9999,
  borderWidth: 1,
} as const;

export type DSSpacingKey = keyof typeof spacing;
export type DSRadiiKey = keyof typeof radii;
export type DSTypographyKey = keyof typeof typography;
