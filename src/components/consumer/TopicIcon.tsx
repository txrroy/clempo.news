import { Text, View } from 'react-native';
import type { TopicIconName } from '@/config/topicConfig';

interface TopicIconProps {
  name: TopicIconName;
  color: string;
  size?: number;
}

/**
 * Flat, minimalist geometric topic icon rendered with pure React Native views
 * so it stays crisp across web, iOS, and Android with zero extra dependencies.
 */
export function TopicIcon({ name, color, size = 14 }: TopicIconProps) {
  const s = size;

  switch (name) {
    case 'all': {
      const tile = Math.max(4, Math.round(s * 0.36));
      const gap = Math.max(2, Math.round(s * 0.14));
      return (
        <View
          style={{
            width: s,
            height: s,
            alignItems: 'center',
            justifyContent: 'center',
            gap,
          }}
        >
          <View style={{ flexDirection: 'row', gap }}>
            <View
              style={{
                width: tile,
                height: tile,
                borderRadius: 1.5,
                backgroundColor: color,
              }}
            />
            <View
              style={{
                width: tile,
                height: tile,
                borderRadius: 1.5,
                backgroundColor: color,
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap }}>
            <View
              style={{
                width: tile,
                height: tile,
                borderRadius: 1.5,
                backgroundColor: color,
              }}
            />
            <View
              style={{
                width: tile,
                height: tile,
                borderRadius: 1.5,
                backgroundColor: color,
              }}
            />
          </View>
        </View>
      );
    }

    case 'politics': {
      // Flat civic building: roof bar, 3 columns, base bar
      const barH = Math.max(2, Math.round(s * 0.15));
      const colW = Math.max(2, Math.round(s * 0.16));
      const colH = Math.max(4, Math.round(s * 0.44));
      return (
        <View
          style={{
            width: s,
            height: s,
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: Math.max(1, Math.round(s * 0.08)),
          }}
        >
          <View
            style={{
              width: Math.round(s * 0.72),
              height: barH,
              borderRadius: 1,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              width: Math.round(s * 0.78),
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ width: colW, height: colH, borderRadius: 0.5, backgroundColor: color }} />
            <View style={{ width: colW, height: colH, borderRadius: 0.5, backgroundColor: color }} />
            <View style={{ width: colW, height: colH, borderRadius: 0.5, backgroundColor: color }} />
          </View>
          <View
            style={{
              width: Math.round(s * 0.92),
              height: barH,
              borderRadius: 1,
              backgroundColor: color,
            }}
          />
        </View>
      );
    }

    case 'climate': {
      // Flat leaf silhouette
      const leafSize = Math.round(s * 0.74);
      return (
        <View
          style={{
            width: s,
            height: s,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: leafSize,
              height: leafSize,
              borderTopLeftRadius: leafSize,
              borderBottomRightRadius: leafSize,
              borderTopRightRadius: Math.max(2, Math.round(leafSize * 0.2)),
              borderBottomLeftRadius: Math.max(2, Math.round(leafSize * 0.2)),
              backgroundColor: color,
            }}
          />
        </View>
      );
    }

    case 'society': {
      // Flat two-person silhouette
      const head = Math.max(3, Math.round(s * 0.28));
      const bodyW = Math.max(5, Math.round(s * 0.44));
      const bodyH = Math.max(4, Math.round(s * 0.34));
      return (
        <View
          style={{
            width: s,
            height: s,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Math.max(1, Math.round(s * 0.08)),
          }}
        >
          <View style={{ alignItems: 'center', gap: 1.5 }}>
            <View
              style={{
                width: head,
                height: head,
                borderRadius: 999,
                backgroundColor: color,
              }}
            />
            <View
              style={{
                width: bodyW,
                height: bodyH,
                borderTopLeftRadius: bodyW,
                borderTopRightRadius: bodyW,
                borderBottomLeftRadius: 1.5,
                borderBottomRightRadius: 1.5,
                backgroundColor: color,
              }}
            />
          </View>
          <View style={{ alignItems: 'center', gap: 1.5, opacity: 0.78 }}>
            <View
              style={{
                width: Math.max(3, Math.round(head * 0.85)),
                height: Math.max(3, Math.round(head * 0.85)),
                borderRadius: 999,
                backgroundColor: color,
              }}
            />
            <View
              style={{
                width: Math.max(4, Math.round(bodyW * 0.82)),
                height: Math.max(3, Math.round(bodyH * 0.88)),
                borderTopLeftRadius: bodyW,
                borderTopRightRadius: bodyW,
                borderBottomLeftRadius: 1.5,
                borderBottomRightRadius: 1.5,
                backgroundColor: color,
              }}
            />
          </View>
        </View>
      );
    }

    case 'conflict': {
      // Flat shield
      const w = Math.round(s * 0.74);
      const h = Math.round(s * 0.82);
      return (
        <View
          style={{
            width: s,
            height: s,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: w,
              height: h,
              borderTopLeftRadius: 2.5,
              borderTopRightRadius: 2.5,
              borderBottomLeftRadius: w,
              borderBottomRightRadius: w,
              backgroundColor: color,
            }}
          />
        </View>
      );
    }

    case 'markets': {
      // Flat 3-bar ascending chart
      const barW = Math.max(2, Math.round(s * 0.2));
      return (
        <View
          style={{
            width: s,
            height: s,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            paddingHorizontal: Math.max(1, Math.round(s * 0.08)),
            paddingBottom: Math.max(1, Math.round(s * 0.1)),
          }}
        >
          <View
            style={{
              width: barW,
              height: Math.round(s * 0.36),
              borderRadius: 1,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              width: barW,
              height: Math.round(s * 0.58),
              borderRadius: 1,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              width: barW,
              height: Math.round(s * 0.8),
              borderRadius: 1,
              backgroundColor: color,
            }}
          />
        </View>
      );
    }

    case 'economy': {
      // Flat dollar sign
      return (
        <View
          style={{
            width: s,
            height: s,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontSize: Math.round(s * 0.95),
              lineHeight: Math.round(s * 1.05),
              fontWeight: '800',
              color,
              includeFontPadding: false,
            }}
          >
            $
          </Text>
        </View>
      );
    }

    case 'health': {
      // Flat medical cross
      const thick = Math.max(3, Math.round(s * 0.28));
      const len = Math.round(s * 0.82);
      return (
        <View
          style={{
            width: s,
            height: s,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              position: 'absolute',
              width: thick,
              height: len,
              borderRadius: 1.5,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: len,
              height: thick,
              borderRadius: 1.5,
              backgroundColor: color,
            }}
          />
        </View>
      );
    }

    case 'science': {
      // Flat planet/atom ring + core dot
      const ring = Math.round(s * 0.84);
      const core = Math.max(4, Math.round(s * 0.34));
      return (
        <View
          style={{
            width: s,
            height: s,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: ring,
              height: ring,
              borderRadius: 999,
              borderWidth: Math.max(1.5, Math.round(s * 0.12)),
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: core,
                height: core,
                borderRadius: 999,
                backgroundColor: color,
              }}
            />
          </View>
        </View>
      );
    }

    case 'technology': {
      // Flat microchip / square node
      const outer = Math.round(s * 0.72);
      const inner = Math.max(3, Math.round(s * 0.3));
      return (
        <View
          style={{
            width: s,
            height: s,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: outer,
              height: outer,
              borderRadius: 2.5,
              borderWidth: Math.max(1.5, Math.round(s * 0.13)),
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: inner,
                height: inner,
                borderRadius: 1,
                backgroundColor: color,
              }}
            />
          </View>
        </View>
      );
    }

    case 'world': {
      // Flat globe: circle with equator bar
      const d = Math.round(s * 0.84);
      const stroke = Math.max(1.5, Math.round(s * 0.12));
      return (
        <View
          style={{
            width: s,
            height: s,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: d,
              height: d,
              borderRadius: 999,
              borderWidth: stroke,
              borderColor: color,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                position: 'absolute',
                width: d,
                height: stroke,
                backgroundColor: color,
              }}
            />
            <View
              style={{
                width: Math.round(d * 0.45),
                height: d,
                borderRadius: 999,
                borderWidth: stroke,
                borderColor: color,
              }}
            />
          </View>
        </View>
      );
    }

    default: {
      const dot = Math.round(s * 0.56);
      return (
        <View
          style={{
            width: s,
            height: s,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: dot,
              height: dot,
              borderRadius: 999,
              backgroundColor: color,
            }}
          />
        </View>
      );
    }
  }
}
