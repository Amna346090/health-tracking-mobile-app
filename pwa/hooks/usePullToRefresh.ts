import { useCallback, useRef, useState } from 'react';
import type { GestureResponderEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/**
 * react-native-web's RefreshControl is a no-op (it renders a plain View and discards
 * onRefresh/refreshing entirely) — there is no built-in pull-to-refresh gesture on web.
 * This tracks a downward touch-drag while the list is scrolled to the top and fires
 * onRefresh once the drag passes PULL_THRESHOLD, for use with PullToRefreshIndicator.
 */

const PULL_THRESHOLD = 64;
const MAX_PULL = 90;
const DAMPING = 0.5;

/**
 * On native RN, GestureResponderEvent.nativeEvent.pageY is set directly. On web,
 * View's onTouchStart/onTouchMove just forward the raw browser TouchEvent instead —
 * that has no top-level pageY, only nested Touch objects in touches/changedTouches.
 */
function extractPageY(e: GestureResponderEvent): number {
  const native = e.nativeEvent as unknown as {
    pageY?: number;
    touches?: { pageY: number }[];
    changedTouches?: { pageY: number }[];
  };
  if (typeof native.pageY === 'number') return native.pageY;
  return native.touches?.[0]?.pageY ?? native.changedTouches?.[0]?.pageY ?? 0;
}

export function usePullToRefresh(onRefresh: () => void) {
  const [pullDistance, setPullDistance] = useState(0);
  const scrollY = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
  }, []);

  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    tracking.current = scrollY.current <= 0;
    startY.current = extractPageY(e);
  }, []);

  const onTouchMove = useCallback((e: GestureResponderEvent) => {
    if (!tracking.current) return;
    const delta = extractPageY(e) - startY.current;
    if (delta > 0 && scrollY.current <= 0) {
      setPullDistance(Math.min(delta * DAMPING, MAX_PULL));
    } else {
      tracking.current = false;
      setPullDistance(0);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (tracking.current && pullDistance >= PULL_THRESHOLD) {
      onRefresh();
    }
    tracking.current = false;
    setPullDistance(0);
  }, [pullDistance, onRefresh]);

  return {
    pullProgress: Math.min(pullDistance / PULL_THRESHOLD, 1),
    scrollHandlers: {
      onScroll,
      scrollEventThrottle: 16 as const,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
