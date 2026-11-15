import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  runOnJS,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useDSTheme } from '@/design-system';

const DEFAULT_STORAGE_KEY = 'snappylit_admin_bottom_drawer_height_ratio_v1';
const cachedRatios = new Map<string, number>();

export function clampHeightRatio(
  ratio: number,
  minRatio: number,
  maxRatio: number,
  fallback: number
): number {
  if (!Number.isFinite(ratio)) return fallback;
  return Math.min(maxRatio, Math.max(minRatio, ratio));
}

/**
 * Loads a previously persisted vertical height ratio from memory or localStorage.
 */
export function loadSavedHeightRatio(
  storageKey: string,
  defaultRatio: number,
  minRatio: number,
  maxRatio: number
): number {
  const cached = cachedRatios.get(storageKey);
  if (cached !== undefined) return cached;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(storageKey);
      if (raw !== null) {
        const parsed = Number.parseFloat(raw);
        if (Number.isFinite(parsed)) {
          const clamped = clampHeightRatio(
            parsed,
            minRatio,
            maxRatio,
            defaultRatio
          );
          cachedRatios.set(storageKey, clamped);
          return clamped;
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return defaultRatio;
}

/**
 * Persists a vertical height ratio to module memory and localStorage.
 */
export function saveHeightRatio(
  storageKey: string,
  ratio: number,
  minRatio: number,
  maxRatio: number,
  defaultRatio: number
): void {
  const clamped = clampHeightRatio(ratio, minRatio, maxRatio, defaultRatio);
  cachedRatios.set(storageKey, clamped);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(storageKey, String(clamped));
    }
  } catch {
    // ignore storage errors
  }
}

interface UseResizableHeightOptions {
  storageKey: string;
  defaultRatio: number;
  minRatio: number;
  maxRatio: number;
  effectiveContainerHeight: number;
}

function useResizableHeightRatio({
  storageKey,
  defaultRatio,
  minRatio,
  maxRatio,
  effectiveContainerHeight,
}: UseResizableHeightOptions) {
  const ratioSv = useSharedValue(
    loadSavedHeightRatio(storageKey, defaultRatio, minRatio, maxRatio)
  );
  const dragStartRatioSv = useSharedValue(defaultRatio);
  const isResizingSv = useSharedValue(0);

  const persistRatio = (nextRatio: number) => {
    saveHeightRatio(storageKey, nextRatio, minRatio, maxRatio, defaultRatio);
  };

  const resizePanGesture = Gesture.Pan()
    .minDistance(2)
    .onStart(() => {
      dragStartRatioSv.value = ratioSv.value;
      isResizingSv.value = 1;
    })
    .onUpdate((e) => {
      if (effectiveContainerHeight <= 0) return;
      const nextRatio = Math.min(
        maxRatio,
        Math.max(
          minRatio,
          dragStartRatioSv.value - e.translationY / effectiveContainerHeight
        )
      );
      ratioSv.value = nextRatio;
    })
    .onFinalize(() => {
      isResizingSv.value = 0;
      runOnJS(persistRatio)(ratioSv.value);
    });

  return { ratioSv, isResizingSv, resizePanGesture };
}

export interface ResizeHandleBarProps {
  gesture: ReturnType<typeof Gesture.Pan>;
  isResizingSv: SharedValue<number>;
  backgroundColor: string;
  showBottomBorder?: boolean;
  showTopBorder?: boolean;
}

/**
 * Horizontal drag bar with centered pill for adjusting bottom drawer or split panel height.
 */
export function ResizeHandleBar({
  gesture,
  isResizingSv,
  backgroundColor,
  showBottomBorder = false,
  showTopBorder = false,
}: ResizeHandleBarProps) {
  const { theme } = useDSTheme();

  const handlePillAnimatedStyle = useAnimatedStyle(() => ({
    width: isResizingSv.value === 1 ? 56 : 40,
    opacity: isResizingSv.value === 1 ? 1 : 0.75,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{
          backgroundColor,
          alignItems: 'center',
          paddingTop: theme.spacing.sm + 2,
          paddingBottom: theme.spacing.xs + 2,
          borderTopWidth: showTopBorder ? theme.layout.borderWidth : 0,
          borderBottomWidth: showBottomBorder ? theme.layout.borderWidth : 0,
          borderColor: theme.colors.borderDefault,
          ...(Platform.OS === 'web'
            ? ({
                cursor: 'ns-resize',
                userSelect: 'none',
              } as Record<string, unknown>)
            : {}),
        }}
      >
        <Animated.View
          style={[
            {
              height: 4,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.borderStrong,
            },
            handlePillAnimatedStyle,
          ]}
        />
      </View>
    </GestureDetector>
  );
}

export interface BottomDrawerProps {
  visible: boolean;
  onClose: () => void;
  storageKey?: string;
  defaultHeightRatio?: number;
  minHeightRatio?: number;
  maxHeightRatio?: number;
  minHeightPx?: number;
  accessibilityLabel?: string;
  children: ReactNode;
}

/**
 * Reusable bottom sheet container with backdrop dismissal, slide-in animation,
 * and draggable/persisted vertical height.
 */
export function BottomDrawer({
  visible,
  onClose,
  storageKey = DEFAULT_STORAGE_KEY,
  defaultHeightRatio = 0.9,
  minHeightRatio = 0.45,
  maxHeightRatio = 0.97,
  minHeightPx = 280,
  accessibilityLabel = 'Close drawer',
  children,
}: BottomDrawerProps) {
  const { theme } = useDSTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [layoutHeight, setLayoutHeight] = useState(0);
  const effectiveContainerHeight =
    layoutHeight > 0 ? layoutHeight : windowHeight;

  const { ratioSv, isResizingSv, resizePanGesture } = useResizableHeightRatio({
    storageKey,
    defaultRatio: defaultHeightRatio,
    minRatio: minHeightRatio,
    maxRatio: maxHeightRatio,
    effectiveContainerHeight,
  });

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    height: Math.max(
      minHeightPx,
      Math.round(effectiveContainerHeight * ratioSv.value)
    ),
  }));

  if (!visible) return null;

  return (
    <View
      onLayout={(e) => {
        const nextHeight = Math.round(e.nativeEvent.layout.height);
        if (nextHeight > 0 && nextHeight !== layoutHeight) {
          setLayoutHeight(nextHeight);
        }
      }}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        justifyContent: 'flex-end',
      }}
    >
      <Animated.View
        entering={FadeIn.duration(160)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: theme.colors.backdrop,
        }}
      >
        <Pressable
          accessibilityLabel={accessibilityLabel}
          onPress={onClose}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.duration(240)}
        style={[
          theme.shadows.popover,
          {
            width: '100%',
            backgroundColor: theme.colors.canvas,
            borderTopLeftRadius: theme.radii.xl,
            borderTopRightRadius: theme.radii.xl,
            borderTopWidth: theme.layout.borderWidth,
            borderColor: theme.colors.borderDefault,
            overflow: 'hidden',
          },
          sheetAnimatedStyle,
        ]}
      >
        <ResizeHandleBar
          gesture={resizePanGesture}
          isResizingSv={isResizingSv}
          backgroundColor={theme.colors.surface}
        />
        {children}
      </Animated.View>
    </View>
  );
}

export interface VerticalSplitPaneProps {
  topContent: ReactNode;
  bottomContent: ReactNode | null;
  storageKey?: string;
  defaultBottomRatio?: number;
  minBottomRatio?: number;
  maxBottomRatio?: number;
  minBottomPx?: number;
}

/**
 * Top/bottom split container (mailbox-style list on top, adjustable detail pane below).
 */
export function VerticalSplitPane({
  topContent,
  bottomContent,
  storageKey = 'snappylit_admin_vertical_split_ratio_v1',
  defaultBottomRatio = 0.62,
  minBottomRatio = 0.35,
  maxBottomRatio = 0.8,
  minBottomPx = 260,
}: VerticalSplitPaneProps) {
  const { theme } = useDSTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [layoutHeight, setLayoutHeight] = useState(0);
  const effectiveContainerHeight =
    layoutHeight > 0 ? layoutHeight : Math.max(400, windowHeight - 140);

  const { ratioSv, isResizingSv, resizePanGesture } = useResizableHeightRatio({
    storageKey,
    defaultRatio: defaultBottomRatio,
    minRatio: minBottomRatio,
    maxRatio: maxBottomRatio,
    effectiveContainerHeight,
  });

  const bottomAnimatedStyle = useAnimatedStyle(() => ({
    height: Math.max(
      minBottomPx,
      Math.round(effectiveContainerHeight * ratioSv.value)
    ),
  }));

  return (
    <View
      onLayout={(e) => {
        const nextHeight = Math.round(e.nativeEvent.layout.height);
        if (nextHeight > 0 && nextHeight !== layoutHeight) {
          setLayoutHeight(nextHeight);
        }
      }}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        flexDirection: 'column',
      }}
    >
      <View style={{ flex: 1, minHeight: 140 }}>{topContent}</View>

      {bottomContent ? (
        <Animated.View
          style={[
            {
              width: '100%',
              minHeight: 0,
              backgroundColor: theme.colors.canvas,
            },
            bottomAnimatedStyle,
          ]}
        >
          <ResizeHandleBar
            gesture={resizePanGesture}
            isResizingSv={isResizingSv}
            backgroundColor={theme.colors.surface}
            showTopBorder
            showBottomBorder
          />
          <View style={{ flex: 1, minHeight: 0 }}>{bottomContent}</View>
        </Animated.View>
      ) : null}
    </View>
  );
}
