import { useMemo } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { hierarchy, tree } from 'd3-hierarchy';
import Svg, { Path } from 'react-native-svg';
import { V3Text } from './primitives';
import { V3_COLORS, V3_RADII, V3_SPACE } from './tokens';

export type V3TraceNodeId =
  | 'scan'
  | 'seen'
  | 'rank'
  | 'filtered'
  | 'draft'
  | 'snippets'
  | 'judge'
  | 'flagged'
  | 'unverified'
  | 'signoff';

export interface V3TraceNode {
  id: V3TraceNodeId;
  title: string;
  metric: string;
  sublabel?: string;
  tone?: 'green' | 'orange' | 'red';
  children?: V3TraceNode[];
}

interface TreeV3Props {
  rootData: V3TraceNode;
  selectedNodeId: V3TraceNodeId | null;
  onSelectNode: (id: V3TraceNodeId) => void;
}

const NODE_WIDTH = 184;
const NODE_HEIGHT = 70;
const HORIZONTAL_GAP = 44;
const VERTICAL_GAP = 14;
const CANVAS_PAD = 12;

export function TreeV3({
  rootData,
  selectedNodeId,
  onSelectNode,
}: TreeV3Props) {
  const layout = useMemo(() => {
    const root = hierarchy<V3TraceNode>(rootData);
    const treeLayout = tree<V3TraceNode>().nodeSize([
      NODE_HEIGHT + VERTICAL_GAP,
      NODE_WIDTH + HORIZONTAL_GAP,
    ]);
    const laidOut = treeLayout(root);
    const descendants = laidOut.descendants();
    const links = laidOut.links();

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const node of descendants) {
      const px = node.y;
      const py = node.x;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }

    const offsetX = CANVAS_PAD - minX;
    const offsetY = CANVAS_PAD - minY + NODE_HEIGHT / 2;
    const width = maxX - minX + NODE_WIDTH + CANVAS_PAD * 2;
    const height = maxY - minY + NODE_HEIGHT + CANVAS_PAD * 2;

    return { descendants, links, offsetX, offsetY, width, height };
  }, [rootData]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      contentContainerStyle={{ minWidth: '100%' }}
    >
      <View
        style={{
          width: layout.width,
          height: layout.height,
          position: 'relative',
        }}
      >
        <Svg
          width={layout.width}
          height={layout.height}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {layout.links.map((link) => {
            const sx = link.source.y + layout.offsetX + NODE_WIDTH;
            const sy = link.source.x + layout.offsetY;
            const tx = link.target.y + layout.offsetX;
            const ty = link.target.x + layout.offsetY;
            const mx = (sx + tx) / 2;
            const d = `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;
            const active =
              selectedNodeId !== null &&
              (link.target.data.id === selectedNodeId ||
                link.source.data.id === selectedNodeId);

            return (
              <Path
                key={`${link.source.data.id}->${link.target.data.id}`}
                d={d}
                fill="none"
                stroke={active ? V3_COLORS.green : V3_COLORS.border}
                strokeWidth={active ? 2 : 1.5}
              />
            );
          })}
        </Svg>

        {layout.descendants.map((node) => {
          const item = node.data;
          const left = node.y + layout.offsetX;
          const top = node.x + layout.offsetY - NODE_HEIGHT / 2;
          const isSelected = selectedNodeId === item.id;

          const bg = isSelected
            ? V3_COLORS.ink
            : item.tone === 'green'
              ? V3_COLORS.greenSoft
              : item.tone === 'orange'
                ? V3_COLORS.orangeSoft
                : item.tone === 'red'
                  ? V3_COLORS.redSoft
                  : V3_COLORS.surface;

          // Strictly background OR border (never both!)
          const hasFill = bg !== V3_COLORS.surface;

          return (
            <Pressable
              key={item.id}
              onPress={() => onSelectNode(item.id)}
              style={{
                position: 'absolute',
                left,
                top,
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
                borderRadius: V3_RADII.sharp,
                backgroundColor: bg,
                borderWidth: hasFill ? 0 : 1,
                borderColor: hasFill ? 'transparent' : V3_COLORS.border,
                paddingHorizontal: V3_SPACE.md,
                paddingVertical: V3_SPACE.sm,
                justifyContent: 'center',
                gap: 2,
                ...(Platform.OS === 'web'
                  ? ({ cursor: 'pointer' } as Record<string, unknown>)
                  : {}),
              }}
            >
              <V3Text
                role="kicker"
                tone={
                  isSelected
                    ? 'inverse'
                    : item.tone
                      ? item.tone
                      : 'muted'
                }
                numberOfLines={1}
              >
                {item.title}
              </V3Text>
              <V3Text
                role="headline"
                tone={
                  isSelected
                    ? 'inverse'
                    : item.tone
                      ? item.tone
                      : 'ink'
                }
                tabularNums
                numberOfLines={1}
              >
                {item.metric}
              </V3Text>
              {item.sublabel ? (
                <V3Text
                  role="mono"
                  tone={isSelected ? 'inverse' : 'subtle'}
                  numberOfLines={1}
                >
                  {item.sublabel}
                </V3Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

