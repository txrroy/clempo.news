import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { hierarchy, tree } from 'd3-hierarchy';
import Svg, { Path } from 'react-native-svg';
import { DSButton, DSText, useDSTheme, type DSTextTone, type DSTone } from '@/design-system';

export type PipelineStepId = '1' | '2' | '3' | '4' | '5';

export interface PipelineTreeNode {
  id: string;
  stepId: PipelineStepId;
  title: string;
  metric: string;
  sublabel?: string;
  tone?: DSTone;
  muted?: boolean;
  children?: PipelineTreeNode[];
}

interface PipelineTreeProps {
  rootData: PipelineTreeNode;
  selectedStep: PipelineStepId | null;
  onSelectStep: (stepId: PipelineStepId | null) => void;
}

const NODE_WIDTH = 188;
const NODE_HEIGHT = 70;
const HORIZONTAL_GAP = 48;
const VERTICAL_GAP = 14;
const CANVAS_PAD = 12;

function collectExpandableIds(node: PipelineTreeNode): string[] {
  const ids: string[] = [];
  if (node.children && node.children.length > 0) {
    ids.push(node.id);
    for (const child of node.children) {
      ids.push(...collectExpandableIds(child));
    }
  }
  return ids;
}

function pruneCollapsed(
  node: PipelineTreeNode,
  expandedIds: Set<string>
): PipelineTreeNode {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  if (!hasChildren || !expandedIds.has(node.id)) {
    return { ...node, children: undefined };
  }
  return {
    ...node,
    children: node.children!.map((c) => pruneCollapsed(c, expandedIds)),
  };
}

export function PipelineTree({
  rootData,
  selectedStep,
  onSelectStep,
}: PipelineTreeProps) {
  const { theme } = useDSTheme();
  const allExpandableIds = useMemo(
    () => collectExpandableIds(rootData),
    [rootData]
  );

  // Start collapsed so the editor intentionally expands each stage to inspect branches & stories
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set()
  );

  const visibleTreeData = useMemo(
    () => pruneCollapsed(rootData, expandedIds),
    [rootData, expandedIds]
  );

  const layout = useMemo(() => {
    const root = hierarchy<PipelineTreeNode>(visibleTreeData);
    const treeLayout = tree<PipelineTreeNode>().nodeSize([
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
      // Transpose: tree().y is horizontal depth, tree().x is vertical position
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
  }, [visibleTreeData]);

  // Map original node IDs -> child counts so collapsed nodes show how many branches exist inside
  const childCountMap = useMemo(() => {
    const map = new Map<string, number>();
    const walk = (n: PipelineTreeNode) => {
      if (n.children && n.children.length > 0) {
        map.set(n.id, n.children.length);
        n.children.forEach(walk);
      }
    };
    walk(rootData);
    return map;
  }, [rootData]);

  const toggleNodeExpand = (nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
    onSelectStep(null);
  };

  const handleExpandAll = () => {
    setExpandedIds(new Set(allExpandableIds));
  };

  const isFullyCollapsed = expandedIds.size === 0 && selectedStep === null;
  const isFullyExpanded =
    allExpandableIds.length > 0 &&
    allExpandableIds.every((id) => expandedIds.has(id));

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {/* Tree Controls */}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        }}
      >
        <DSText variant="caption" tone="tertiary">
          Click + to expand branches · Click any node to inspect selected stories
        </DSText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <DSButton
            label="Collapse all"
            variant="ghost"
            size="sm"
            disabled={isFullyCollapsed}
            onPress={handleCollapseAll}
          />
          <DSButton
            label="Expand all"
            variant="secondary"
            size="sm"
            disabled={isFullyExpanded}
            onPress={handleExpandAll}
          />
        </View>
      </View>

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
          {/* Curved d3-hierarchy links */}
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
              const isHighlighted =
                selectedStep !== null &&
                (link.target.data.stepId === selectedStep ||
                  link.source.data.stepId === selectedStep);

              return (
                <Path
                  key={`${link.source.data.id}->${link.target.data.id}`}
                  d={d}
                  fill="none"
                  stroke={
                    isHighlighted
                      ? theme.colors.accentBorder
                      : theme.colors.borderDefault
                  }
                  strokeWidth={isHighlighted ? 2 : 1.5}
                />
              );
            })}
          </Svg>

          {/* Interactive pipeline stage & branch nodes */}
          {layout.descendants.map((node) => {
            const item = node.data;
            const left = node.y + layout.offsetX;
            const top = node.x + layout.offsetY - NODE_HEIGHT / 2;
            const isSelected = selectedStep === item.stepId && !item.muted;
            const childCount = childCountMap.get(item.id) ?? 0;
            const isNodeExpanded = expandedIds.has(item.id);
            const toneStyle = item.tone ? theme.colors.tones[item.tone] : null;
            const semanticTextTone: DSTextTone | undefined =
              item.tone && item.tone !== 'neutral' && item.tone !== 'info'
                ? item.tone
                : undefined;

            const bgColor = isSelected
              ? theme.colors.accentSoft
              : toneStyle
                ? toneStyle.bg
                : item.muted
                  ? theme.colors.surfaceMuted
                  : theme.colors.surface;

            const borderColor = isSelected
              ? theme.colors.accent
              : toneStyle
                ? toneStyle.border
                : theme.colors.borderDefault;

            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (childCount > 0 && !isNodeExpanded) {
                    toggleNodeExpand(item.id);
                  }
                  onSelectStep(selectedStep === item.stepId ? null : item.stepId);
                }}
                style={({ pressed }) => ({
                  position: 'absolute',
                  left,
                  top,
                  width: NODE_WIDTH,
                  height: NODE_HEIGHT,
                  borderRadius: theme.radii.md,
                  borderWidth: theme.layout.borderWidth,
                  borderColor,
                  backgroundColor: pressed
                    ? theme.colors.surfaceHover
                    : bgColor,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: theme.spacing.xs,
                  ...(Platform.OS === 'web'
                    ? ({ cursor: 'pointer' } as Record<string, unknown>)
                    : {}),
                })}
              >
                <View style={{ flex: 1, minWidth: 0, gap: theme.spacing.xxs }}>
                  <DSText
                    variant="micro"
                    weight="semibold"
                    tone={
                      isSelected
                        ? 'accent'
                        : semanticTextTone ??
                          (item.muted ? 'tertiary' : 'secondary')
                    }
                    numberOfLines={1}
                  >
                    {item.title}
                  </DSText>
                  <DSText
                    variant="footnote"
                    weight="bold"
                    tone={semanticTextTone ?? 'primary'}
                    tabularNums
                    numberOfLines={1}
                  >
                    {item.metric}
                  </DSText>
                  {item.sublabel ? (
                    <DSText variant="micro" tone="tertiary" numberOfLines={1}>
                      {item.sublabel}
                    </DSText>
                  ) : null}
                </View>

                {childCount > 0 ? (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      toggleNodeExpand(item.id);
                    }}
                    accessibilityLabel={
                      isNodeExpanded
                        ? `Collapse ${item.title} branches`
                        : `Expand ${item.title} branches`
                    }
                    hitSlop={6}
                    style={({ pressed }) => ({
                      minWidth: 24,
                      height: 24,
                      paddingHorizontal: theme.spacing.xs,
                      borderRadius: theme.radii.pill,
                      borderWidth: theme.layout.borderWidth,
                      borderColor: isNodeExpanded
                        ? theme.colors.borderDefault
                        : theme.colors.accentBorder,
                      backgroundColor: pressed
                        ? theme.colors.surfaceHover
                        : isNodeExpanded
                          ? theme.colors.surfaceMuted
                          : theme.colors.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    })}
                  >
                    <DSText
                      variant="micro"
                      weight="bold"
                      tone={isNodeExpanded ? 'secondary' : 'accent'}
                      tabularNums
                    >
                      {isNodeExpanded ? '−' : `+${childCount}`}
                    </DSText>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
