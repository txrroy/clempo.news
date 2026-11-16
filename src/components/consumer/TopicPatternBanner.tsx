import { View } from 'react-native';

interface TopicTheme {
  variant: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  colors: [string, string, string, string, string];
}

const TOPIC_THEMES: Record<string, TopicTheme> = {
  politics: {
    variant: 0,
    colors: ['#1D4ED8', '#2563EB', '#60A5FA', '#93C5FD', '#FB923C'],
  },
  diplomacy: {
    variant: 0,
    colors: ['#0369A1', '#0284C7', '#38BDF8', '#7DD3FC', '#FBBF24'],
  },
  world: {
    variant: 0,
    colors: ['#2563EB', '#3B82F6', '#38BDF8', '#BAE6FD', '#34D399'],
  },
  technology: {
    variant: 1,
    colors: ['#10B981', '#0D9488', '#06B6D4', '#3B82F6', '#6366F1'],
  },
  ai: {
    variant: 1,
    colors: ['#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#A855F7'],
  },
  computing: {
    variant: 1,
    colors: ['#14B8A6', '#06B6D4', '#38BDF8', '#6366F1', '#8B5CF6'],
  },
  entertainment: {
    variant: 2,
    colors: ['#EC4899', '#8B5CF6', '#F472B6', '#C084FC', '#FBBF24'],
  },
  society: {
    variant: 2,
    colors: ['#F43F5E', '#A855F7', '#FB7185', '#C084FC', '#38BDF8'],
  },
  culture: {
    variant: 2,
    colors: ['#E11D48', '#7C3AED', '#F472B6', '#A78BFA', '#F59E0B'],
  },
  arts: {
    variant: 2,
    colors: ['#DB2777', '#9333EA', '#FB923C', '#C084FC', '#2DD4BF'],
  },
  environment: {
    variant: 3,
    colors: ['#10B981', '#34D399', '#2DD4BF', '#FBBF24', '#6EE7B7'],
  },
  climate: {
    variant: 3,
    colors: ['#0D9488', '#2DD4BF', '#38BDF8', '#FACC15', '#99F6E4'],
  },
  nature: {
    variant: 3,
    colors: ['#16A34A', '#4ADE80', '#2DD4BF', '#FDE047', '#38BDF8'],
  },
  economy: {
    variant: 4,
    colors: ['#FB7185', '#FBBF24', '#14B8A6', '#3B82F6', '#FB923C'],
  },
  markets: {
    variant: 4,
    colors: ['#F59E0B', '#10B981', '#38BDF8', '#FB7185', '#A78BFA'],
  },
  business: {
    variant: 4,
    colors: ['#2563EB', '#F59E0B', '#14B8A6', '#FB7185', '#60A5FA'],
  },
  science: {
    variant: 5,
    colors: ['#38BDF8', '#818CF8', '#34D399', '#F472B6', '#FBBF24'],
  },
  health: {
    variant: 5,
    colors: ['#2DD4BF', '#38BDF8', '#4ADE80', '#FB7185', '#A78BFA'],
  },
  conflict: {
    variant: 6,
    colors: ['#F43F5E', '#FB923C', '#3B82F6', '#14B8A6', '#FBBF24'],
  },
  defense: {
    variant: 6,
    colors: ['#EF4444', '#F59E0B', '#0EA5E9', '#2DD4BF', '#818CF8'],
  },
  security: {
    variant: 6,
    colors: ['#E11D48', '#8B5CF6', '#06B6D4', '#FBBF24', '#34D399'],
  },
  sports: {
    variant: 7,
    colors: ['#2563EB', '#FACC15', '#F43F5E', '#10B981', '#FB923C'],
  },
  lifestyle: {
    variant: 7,
    colors: ['#FB7185', '#FBBF24', '#34D399', '#60A5FA', '#A855F7'],
  },
};

const FALLBACK_THEMES = Object.values(TOPIC_THEMES);

function getThemeForTopic(topic?: string): TopicTheme {
  const key = topic?.trim().toLowerCase() ?? '';
  if (key && TOPIC_THEMES[key]) {
    return TOPIC_THEMES[key];
  }
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_THEMES[hash % FALLBACK_THEMES.length];
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Pure React Native regular flat-top hexagon built from 3 rotated solid rectangles.
 * Solid colors guarantee zero internal seam artifacts across iOS, Android, and Web.
 */
function SolidHexagon({
  radius,
  color,
  top,
  left,
  right,
  bottom,
}: {
  radius: number;
  color: string;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}) {
  const rectWidth = Math.round((2 * radius) / Math.sqrt(3));
  const rectHeight = radius * 2;
  const boxSize = Math.round(rectHeight * 1.18);

  return (
    <View
      style={{
        position: 'absolute',
        top,
        left,
        right,
        bottom,
        width: boxSize,
        height: boxSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          width: rectWidth,
          height: rectHeight,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: rectWidth,
          height: rectHeight,
          backgroundColor: color,
          transform: [{ rotate: '60deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: rectWidth,
          height: rectHeight,
          backgroundColor: color,
          transform: [{ rotate: '-60deg' }],
        }}
      />
    </View>
  );
}

export function TopicPatternBanner({
  topic,
  reverse = false,
}: {
  topic?: string;
  reverse?: boolean;
}) {
  const { variant, colors } = getThemeForTopic(topic);
  const [c1, c2, c3, c4, c5] = colors;

  return (
    <View
      pointerEvents="none"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
        overflow: 'hidden',
        position: 'relative',
        ...(reverse
          ? {
              opacity: 0.42,
              transform: [{ scaleX: -1 }],
            }
          : {}),
      }}
    >
      {/* Variant 0: Thin floating color rectangles of varied sizes descending from top */}
      {variant === 0 ? (
        <>
          <View
            style={{
              position: 'absolute',
              top: -10,
              left: 12,
              width: 14,
              height: 54,
              borderRadius: 7,
              backgroundColor: withAlpha(c1, 0.85),
              transform: [{ rotate: '14deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -12,
              left: 42,
              width: 24,
              height: 72,
              borderRadius: 9,
              backgroundColor: withAlpha(c2, 0.72),
              transform: [{ rotate: '14deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 6,
              left: 82,
              width: 11,
              height: 44,
              borderRadius: 6,
              backgroundColor: withAlpha(c3, 0.88),
              transform: [{ rotate: '14deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -10,
              left: 110,
              width: 20,
              height: 62,
              borderRadius: 8,
              backgroundColor: withAlpha(c4, 0.82),
              transform: [{ rotate: '14deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 10,
              left: 148,
              width: 12,
              height: 38,
              borderRadius: 6,
              backgroundColor: withAlpha(c5, 0.88),
              transform: [{ rotate: '14deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -12,
              right: 116,
              width: 22,
              height: 68,
              borderRadius: 8,
              backgroundColor: withAlpha(c2, 0.65),
              transform: [{ rotate: '14deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 8,
              right: 84,
              width: 11,
              height: 50,
              borderRadius: 6,
              backgroundColor: withAlpha(c1, 0.8),
              transform: [{ rotate: '14deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -10,
              right: 48,
              width: 18,
              height: 58,
              borderRadius: 8,
              backgroundColor: withAlpha(c3, 0.82),
              transform: [{ rotate: '14deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -8,
              right: 16,
              width: 13,
              height: 44,
              borderRadius: 7,
              backgroundColor: withAlpha(c5, 0.88),
              transform: [{ rotate: '14deg' }],
            }}
          />
        </>
      ) : null}

      {/* Variant 1: Radiant chromatic prism hexagons + joyful aqua orb */}
      {variant === 1 ? (
        <>
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 72,
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: withAlpha(c3, 0.24),
            }}
          />
          <SolidHexagon radius={30} color={c1} top={-14} left={-10} />
          <SolidHexagon radius={27} color={c2} top={-20} left={38} />
          <SolidHexagon radius={29} color={c3} top={-6} left={90} />
          <SolidHexagon radius={26} color={c4} top={-18} right={72} />
          <SolidHexagon radius={30} color={c5} top={-4} right={8} />
          <View
            style={{
              position: 'absolute',
              top: 52,
              right: 76,
              width: 13,
              height: 13,
              borderRadius: 7,
              backgroundColor: withAlpha(c3, 0.85),
            }}
          />
        </>
      ) : null}

      {/* Variant 2: Playful crisscrossing translucent ribbons & confetti dots */}
      {variant === 2 ? (
        <>
          <View
            style={{
              position: 'absolute',
              top: 20,
              left: -16,
              width: 190,
              height: 18,
              borderRadius: 9,
              backgroundColor: withAlpha(c1, 0.74),
              transform: [{ rotate: '-11deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 22,
              left: 74,
              width: 210,
              height: 16,
              borderRadius: 8,
              backgroundColor: withAlpha(c2, 0.74),
              transform: [{ rotate: '8deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: 34,
              width: 118,
              height: 15,
              borderRadius: 8,
              backgroundColor: withAlpha(c3, 0.78),
              transform: [{ rotate: '-15deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 12,
              right: 22,
              width: 12,
              height: 36,
              borderRadius: 6,
              backgroundColor: withAlpha(c5, 0.88),
              transform: [{ rotate: '14deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 50,
              left: 146,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: withAlpha(c4, 0.8),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 48,
              right: 68,
              width: 11,
              height: 11,
              borderRadius: 6,
              backgroundColor: withAlpha(c5, 0.85),
            }}
          />
        </>
      ) : null}

      {/* Variant 3: Golden hour morning sun & meadow domes */}
      {variant === 3 ? (
        <>
          <View
            style={{
              position: 'absolute',
              top: -36,
              left: -12,
              width: 150,
              height: 102,
              borderRadius: 75,
              backgroundColor: withAlpha(c2, 0.68),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -40,
              left: 108,
              width: 168,
              height: 104,
              borderRadius: 84,
              backgroundColor: withAlpha(c3, 0.64),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 6,
              right: 28,
              width: 54,
              height: 54,
              borderRadius: 27,
              backgroundColor: withAlpha(c4, 0.9),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -16,
              right: -16,
              width: 96,
              height: 78,
              borderTopLeftRadius: 56,
              borderBottomLeftRadius: 56,
              borderBottomRightRadius: 12,
              backgroundColor: withAlpha(c1, 0.78),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 56,
              left: 112,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: withAlpha(c4, 0.88),
            }}
          />
        </>
      ) : null}

      {/* Variant 4: Editorial modernist arches & sunlit cutouts */}
      {variant === 4 ? (
        <>
          <View
            style={{
              position: 'absolute',
              top: -14,
              left: -10,
              width: 104,
              height: 80,
              borderBottomRightRadius: 80,
              backgroundColor: withAlpha(c1, 0.82),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 14,
              left: 92,
              width: 72,
              height: 28,
              borderRadius: 14,
              backgroundColor: withAlpha(c2, 0.88),
              transform: [{ rotate: '-16deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -26,
              right: 72,
              width: 84,
              height: 84,
              borderRadius: 42,
              borderWidth: 14,
              borderColor: withAlpha(c3, 0.82),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -14,
              right: -8,
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: withAlpha(c4, 0.84),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 54,
              right: 62,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: withAlpha(c5, 0.9),
            }}
          />
        </>
      ) : null}

      {/* Variant 5: Weightless botanical petals & aurora bubbles */}
      {variant === 5 ? (
        <>
          <View
            style={{
              position: 'absolute',
              top: -20,
              left: 6,
              width: 84,
              height: 84,
              borderTopLeftRadius: 56,
              borderBottomRightRadius: 56,
              borderTopRightRadius: 10,
              borderBottomLeftRadius: 10,
              backgroundColor: withAlpha(c1, 0.72),
              transform: [{ rotate: '12deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -26,
              left: 84,
              width: 92,
              height: 92,
              borderRadius: 46,
              backgroundColor: withAlpha(c2, 0.66),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 164,
              width: 60,
              height: 60,
              borderTopLeftRadius: 42,
              borderBottomRightRadius: 42,
              borderTopRightRadius: 8,
              borderBottomLeftRadius: 8,
              backgroundColor: withAlpha(c3, 0.78),
              transform: [{ rotate: '-28deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -16,
              right: 16,
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: withAlpha(c4, 0.72),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 48,
              right: 88,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: withAlpha(c5, 0.88),
            }}
          />
        </>
      ) : null}

      {/* Variant 6: Crisp joyful confetti capsules & balance arcs */}
      {variant === 6 ? (
        <>
          <View
            style={{
              position: 'absolute',
              top: -12,
              left: -8,
              width: 96,
              height: 52,
              borderRadius: 26,
              backgroundColor: withAlpha(c1, 0.82),
              transform: [{ rotate: '-18deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 10,
              left: 92,
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: withAlpha(c2, 0.84),
              transform: [{ rotate: '34deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -34,
              right: 88,
              width: 98,
              height: 98,
              borderRadius: 49,
              borderWidth: 14,
              borderColor: withAlpha(c3, 0.8),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -10,
              right: 10,
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: withAlpha(c4, 0.76),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 52,
              right: 92,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: withAlpha(c5, 0.9),
            }}
          />
        </>
      ) : null}

      {/* Variant 7: Mediterranean citrus & cobalt Matisse collage */}
      {variant === 7 ? (
        <>
          <View
            style={{
              position: 'absolute',
              top: -22,
              left: -10,
              width: 112,
              height: 96,
              borderRadius: 56,
              backgroundColor: withAlpha(c1, 0.82),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 16,
              left: 82,
              width: 94,
              height: 46,
              borderRadius: 23,
              backgroundColor: withAlpha(c2, 0.9),
              transform: [{ rotate: '14deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -16,
              right: 86,
              width: 78,
              height: 78,
              borderRadius: 39,
              backgroundColor: withAlpha(c3, 0.78),
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: -10,
              right: -14,
              width: 94,
              height: 76,
              borderTopLeftRadius: 40,
              borderBottomLeftRadius: 40,
              backgroundColor: withAlpha(c4, 0.84),
              transform: [{ rotate: '-16deg' }],
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 52,
              right: 68,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: withAlpha(c5, 0.88),
            }}
          />
        </>
      ) : null}
    </View>
  );
}

/**
 * Joyful pastel abstract frame for the daily edition cover card,
 * matching the colorful floating geometric shapes used across story banners.
 */
export function CoverPatternArt() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
      {/* Top playful pastel shapes descending from the top edge */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 82,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: -10,
            left: 16,
            width: 14,
            height: 48,
            borderRadius: 7,
            backgroundColor: withAlpha('#93C5FD', 0.78),
            transform: [{ rotate: '14deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: -14,
            left: 44,
            width: 22,
            height: 60,
            borderRadius: 9,
            backgroundColor: withAlpha('#99F6E4', 0.8),
            transform: [{ rotate: '14deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 8,
            left: 80,
            width: 11,
            height: 36,
            borderRadius: 6,
            backgroundColor: withAlpha('#FDE68A', 0.88),
            transform: [{ rotate: '14deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 16,
            left: 112,
            width: 13,
            height: 13,
            borderRadius: 7,
            backgroundColor: withAlpha('#A5B4FC', 0.78),
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: -18,
            right: 54,
            width: 54,
            height: 54,
            borderRadius: 27,
            backgroundColor: withAlpha('#FBCFE8', 0.78),
          }}
        />
        <SolidHexagon
          radius={20}
          color={withAlpha('#DDD6FE', 0.82)}
          top={-10}
          right={8}
        />
        <View
          style={{
            position: 'absolute',
            top: 18,
            right: 118,
            width: 11,
            height: 34,
            borderRadius: 6,
            backgroundColor: withAlpha('#A7F3D0', 0.85),
            transform: [{ rotate: '-14deg' }],
          }}
        />
      </View>

      {/* Bottom pastel corner accents */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 76,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            bottom: -22,
            left: 14,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: withAlpha('#FDE68A', 0.76),
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -10,
            left: 62,
            width: 14,
            height: 44,
            borderRadius: 7,
            backgroundColor: withAlpha('#C4B5FD', 0.74),
            transform: [{ rotate: '-14deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 22,
            left: 94,
            width: 11,
            height: 11,
            borderRadius: 6,
            backgroundColor: withAlpha('#6EE7B7', 0.82),
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -14,
            right: 54,
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: withAlpha('#BAE6FD', 0.76),
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -12,
            right: 26,
            width: 17,
            height: 52,
            borderRadius: 9,
            backgroundColor: withAlpha('#FBCFE8', 0.84),
            transform: [{ rotate: '14deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 6,
            right: 8,
            width: 11,
            height: 36,
            borderRadius: 6,
            backgroundColor: withAlpha('#FED7AA', 0.88),
            transform: [{ rotate: '14deg' }],
          }}
        />
      </View>
    </View>
  );
}
