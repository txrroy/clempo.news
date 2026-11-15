import { APP_CONFIG } from './appConfig';

export type TopicIconName =
  | 'all'
  | 'politics'
  | 'climate'
  | 'society'
  | 'conflict'
  | 'markets'
  | 'economy'
  | 'health'
  | 'science'
  | 'technology'
  | 'world'
  | 'default';

export interface TopicVisualConfig {
  /** Accent color for the flat icon and subtle highlights */
  color: string;
  /** Translucent tint for dark glass pills and active indicators */
  pillBorder: string;
  /** Soft tint for light-surface pills */
  lightBg: string;
  /** Flat geometric icon identifier */
  icon: TopicIconName;
}

export const ALL_TOPICS_VISUAL: TopicVisualConfig = {
  color: '#FAF9F6',
  pillBorder: 'rgba(250, 249, 246, 0.25)',
  lightBg: '#F5F5F4',
  icon: 'all',
};

export const TOPIC_VISUALS: Record<string, TopicVisualConfig> = {
  politics: {
    color: '#FB923C', // Warm orange
    pillBorder: 'rgba(251, 146, 60, 0.45)',
    lightBg: '#FFF7ED',
    icon: 'politics',
  },
  climate: {
    color: '#2DD4BF', // Teal
    pillBorder: 'rgba(45, 212, 191, 0.45)',
    lightBg: '#F0FDFA',
    icon: 'climate',
  },
  environment: {
    color: '#34D399', // Emerald
    pillBorder: 'rgba(52, 211, 153, 0.45)',
    lightBg: '#ECFDF5',
    icon: 'climate',
  },
  society: {
    color: '#F472B6', // Pink
    pillBorder: 'rgba(244, 114, 182, 0.45)',
    lightBg: '#FDF2F8',
    icon: 'society',
  },
  culture: {
    color: '#F472B6',
    pillBorder: 'rgba(244, 114, 182, 0.45)',
    lightBg: '#FDF2F8',
    icon: 'society',
  },
  conflict: {
    color: '#F87171', // Coral red
    pillBorder: 'rgba(248, 113, 113, 0.45)',
    lightBg: '#FEF2F2',
    icon: 'conflict',
  },
  defense: {
    color: '#F87171',
    pillBorder: 'rgba(248, 113, 113, 0.45)',
    lightBg: '#FEF2F2',
    icon: 'conflict',
  },
  security: {
    color: '#FB7185', // Rose
    pillBorder: 'rgba(251, 113, 133, 0.45)',
    lightBg: '#FFF1F2',
    icon: 'conflict',
  },
  markets: {
    color: '#FBBF24', // Amber gold
    pillBorder: 'rgba(251, 191, 36, 0.45)',
    lightBg: '#FFFBEB',
    icon: 'markets',
  },
  economy: {
    color: '#A3E635', // Crisp lime
    pillBorder: 'rgba(163, 230, 53, 0.45)',
    lightBg: '#F7FEE7',
    icon: 'economy',
  },
  health: {
    color: '#38BDF8', // Sky blue
    pillBorder: 'rgba(56, 189, 248, 0.45)',
    lightBg: '#F0F9FF',
    icon: 'health',
  },
  science: {
    color: '#818CF8', // Indigo
    pillBorder: 'rgba(129, 140, 248, 0.45)',
    lightBg: '#EEF2FF',
    icon: 'science',
  },
  technology: {
    color: '#22D3EE', // Cyan
    pillBorder: 'rgba(34, 211, 238, 0.45)',
    lightBg: '#ECFEFF',
    icon: 'technology',
  },
  diplomacy: {
    color: '#60A5FA', // Blue
    pillBorder: 'rgba(96, 165, 250, 0.45)',
    lightBg: '#EFF6FF',
    icon: 'world',
  },
  world: {
    color: '#A78BFA', // Soft violet
    pillBorder: 'rgba(167, 139, 250, 0.45)',
    lightBg: '#F5F3FF',
    icon: 'world',
  },
};

const FALLBACK_VISUALS: TopicVisualConfig[] = [
  {
    color: '#60A5FA',
    pillBorder: 'rgba(96, 165, 250, 0.45)',
    lightBg: '#EFF6FF',
    icon: 'default',
  },
  {
    color: '#34D399',
    pillBorder: 'rgba(52, 211, 153, 0.45)',
    lightBg: '#ECFDF5',
    icon: 'default',
  },
  {
    color: '#FBBF24',
    pillBorder: 'rgba(251, 191, 36, 0.45)',
    lightBg: '#FFFBEB',
    icon: 'default',
  },
  {
    color: '#F472B6',
    pillBorder: 'rgba(244, 114, 182, 0.45)',
    lightBg: '#FDF2F8',
    icon: 'default',
  },
];

/**
 * Returns the topic's color and flat icon config, or `null` when
 * `APP_CONFIG.showTopicColorsAndIcons` is turned off.
 */
export function getTopicVisual(topic?: string | null): TopicVisualConfig | null {
  if (!APP_CONFIG.showTopicColorsAndIcons) {
    return null;
  }

  const key = topic?.trim().toLowerCase() ?? '';
  if (!key) {
    return null;
  }

  if (TOPIC_VISUALS[key]) {
    return TOPIC_VISUALS[key];
  }

  for (const [knownKey, visual] of Object.entries(TOPIC_VISUALS)) {
    if (key.includes(knownKey) || knownKey.includes(key)) {
      return visual;
    }
  }

  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_VISUALS[hash % FALLBACK_VISUALS.length];
}

export function getAllTopicsVisual(): TopicVisualConfig | null {
  if (!APP_CONFIG.showTopicColorsAndIcons) {
    return null;
  }
  return ALL_TOPICS_VISUAL;
}
