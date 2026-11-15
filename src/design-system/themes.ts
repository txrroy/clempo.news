import { fontFamilies, layout, radii, spacing, typography } from './tokens';

export type ThemeId = 'warm-editorial' | 'dark';

export interface SemanticTone {
  bg: string;
  border: string;
  text: string;
  dot: string;
}

export interface DSColors {
  canvas: string;
  canvasSubtle: string;
  surface: string;
  surfaceHeader: string;
  surfaceElevated: string;
  surfaceMuted: string;
  surfaceHover: string;
  surfaceSelected: string;
  surfaceInk: string;
  topBar: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  inkText: string;

  borderSubtle: string;
  borderDefault: string;
  borderStrong: string;

  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentText: string;

  disabledBg: string;
  disabledText: string;

  backdrop: string;
  shadowColor: string;

  tones: {
    neutral: SemanticTone;
    accent: SemanticTone;
    success: SemanticTone;
    warning: SemanticTone;
    danger: SemanticTone;
    info: SemanticTone;
  };
}

export interface DSShadow {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
}

export interface DSTheme {
  id: ThemeId;
  name: string;
  isDark: boolean;
  cardBorderWidth: number;
  colors: DSColors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  fontFamilies: typeof fontFamilies;
  layout: typeof layout;
  shadows: {
    card: DSShadow;
    elevated: DSShadow;
    popover: DSShadow;
    pill: DSShadow;
  };
}

export const warmEditorialTheme: DSTheme = {
  id: 'warm-editorial',
  name: 'Warm Editorial',
  isDark: false,
  cardBorderWidth: 1,
  colors: {
    canvas: '#FFFBF7',
    canvasSubtle: '#F8F2EB',
    surface: '#FFFFFF',
    surfaceHeader: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceMuted: '#F8F2EB',
    surfaceHover: '#F3ECE3',
    surfaceSelected: '#FFF0E2',
    surfaceInk: '#1F2937',
    topBar: '#FFFBF7',

    textPrimary: '#1F2937',
    textSecondary: '#4B5563',
    textTertiary: '#6B7280',
    textInverse: '#FFFFFF',
    inkText: '#FFFFFF',

    borderSubtle: '#EFE9E1',
    borderDefault: '#E8E1D9',
    borderStrong: '#D6CEC5',

    accent: '#E97316',
    accentSoft: '#FFF0E2',
    accentBorder: '#F7C59F',
    accentText: '#B54D09',

    disabledBg: '#D6CEC5',
    disabledText: '#6B7280',

    backdrop: 'rgba(31, 41, 55, 0.34)',
    shadowColor: '#1F2937',

    tones: {
      neutral: {
        bg: '#F1EFEC',
        border: '#E8E1D9',
        text: '#4B5563',
        dot: '#6B7280',
      },
      accent: {
        bg: '#FFF0E2',
        border: '#F7C59F',
        text: '#B54D09',
        dot: '#E97316',
      },
      success: {
        bg: '#EAF4EC',
        border: '#CBE3D0',
        text: '#237A45',
        dot: '#237A45',
      },
      warning: {
        bg: '#FFF1DC',
        border: '#F4D4A4',
        text: '#A85B12',
        dot: '#A85B12',
      },
      danger: {
        bg: '#FDECEC',
        border: '#F6CCCA',
        text: '#B42318',
        dot: '#B42318',
      },
      info: {
        bg: '#F1EFEC',
        border: '#E8E1D9',
        text: '#4B5563',
        dot: '#6B7280',
      },
    },
  },
  spacing,
  radii,
  typography,
  fontFamilies,
  layout,
  shadows: {
    card: {
      shadowColor: '#1F2937',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    elevated: {
      shadowColor: '#1F2937',
      shadowOpacity: 0.07,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    popover: {
      shadowColor: '#1F2937',
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    pill: {
      shadowColor: '#1F2937',
      shadowOpacity: 0.04,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
  },
};

export const darkTheme: DSTheme = {
  id: 'dark',
  name: 'Charcoal',
  isDark: true,
  cardBorderWidth: 1,
  colors: {
    canvas: '#131312',
    canvasSubtle: '#191917',
    surface: '#1D1D1B',
    surfaceHeader: '#232220',
    surfaceElevated: '#252422',
    surfaceMuted: '#292825',
    surfaceHover: '#31302C',
    surfaceSelected: 'rgba(224, 108, 79, 0.16)',
    surfaceInk: '#2B2A27',
    topBar: 'rgba(19, 19, 18, 0.92)',

    textPrimary: '#F3F1EC',
    textSecondary: '#A8A49B',
    textTertiary: '#78746D',
    textInverse: '#181817',
    inkText: '#F3F1EC',

    borderSubtle: 'rgba(243, 241, 236, 0.07)',
    borderDefault: 'rgba(243, 241, 236, 0.12)',
    borderStrong: 'rgba(243, 241, 236, 0.22)',

    accent: '#E06C4F',
    accentSoft: 'rgba(224, 108, 79, 0.16)',
    accentBorder: 'rgba(224, 108, 79, 0.34)',
    accentText: '#F08A70',

    disabledBg: '#3A3834',
    disabledText: '#78746D',

    backdrop: 'rgba(0, 0, 0, 0.62)',
    shadowColor: '#000000',

    tones: {
      neutral: {
        bg: '#292825',
        border: 'rgba(243, 241, 236, 0.10)',
        text: '#C7C3BA',
        dot: '#8C887F',
      },
      accent: {
        bg: 'rgba(224, 108, 79, 0.18)',
        border: 'rgba(224, 108, 79, 0.34)',
        text: '#F08A70',
        dot: '#E06C4F',
      },
      success: {
        bg: 'rgba(72, 168, 118, 0.16)',
        border: 'rgba(72, 168, 118, 0.32)',
        text: '#7FD4A6',
        dot: '#48A876',
      },
      warning: {
        bg: 'rgba(224, 158, 62, 0.16)',
        border: 'rgba(224, 158, 62, 0.32)',
        text: '#F3BE72',
        dot: '#E09E3E',
      },
      danger: {
        bg: 'rgba(224, 92, 82, 0.16)',
        border: 'rgba(224, 92, 82, 0.32)',
        text: '#F59890',
        dot: '#E05C52',
      },
      info: {
        bg: 'rgba(148, 163, 184, 0.16)',
        border: 'rgba(148, 163, 184, 0.30)',
        text: '#CBD5E1',
        dot: '#94A3B8',
      },
    },
  },
  spacing,
  radii,
  typography,
  fontFamilies,
  layout,
  shadows: {
    card: {
      shadowColor: '#000000',
      shadowOpacity: 0.22,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    elevated: {
      shadowColor: '#000000',
      shadowOpacity: 0.32,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    popover: {
      shadowColor: '#000000',
      shadowOpacity: 0.50,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 12 },
      elevation: 10,
    },
    pill: {
      shadowColor: '#000000',
      shadowOpacity: 0.20,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
  },
};

export const THEMES: Record<ThemeId, DSTheme> = {
  'warm-editorial': warmEditorialTheme,
  dark: darkTheme,
};
