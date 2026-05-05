import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, type GestureResponderEvent } from 'react-native';

import {
  clampPacketExplorerPanelWidth,
  getDefaultPacketExplorerPanelWidth,
  getPacketExplorerPanelWidthFromPointer,
} from './nexus-packet-explorer-resize-math';

type UseNexusPacketExplorerResizeInput = {
  isDesktop: boolean;
  viewportWidth: number;
  sessionPanelWidth: number | null;
  onCommitPanelWidth: (panelWidth: number) => void;
};

type UseNexusPacketExplorerResizeResult = {
  isDragging: boolean;
  resolvedPanelWidth: number;
  handleResizePressIn: (event: GestureResponderEvent) => void;
};

function isBrowserEnvironment(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Inputs: desktop state, viewport width, persisted session width, and a commit callback.
 * Output: a resilient desktop-only Packet Explorer resize controller.
 */
export function useNexusPacketExplorerResize(
  input: UseNexusPacketExplorerResizeInput
): UseNexusPacketExplorerResizeResult {
  const {
    isDesktop,
    viewportWidth,
    sessionPanelWidth,
    onCommitPanelWidth,
  } = input;
  const [isDragging, setIsDragging] = useState(false);
  const [liveDragWidth, setLiveDragWidth] = useState<number | null>(null);
  const committedPanelWidth = useMemo(
    () =>
      clampPacketExplorerPanelWidth(
        sessionPanelWidth ?? getDefaultPacketExplorerPanelWidth(viewportWidth),
        viewportWidth
      ),
    [sessionPanelWidth, viewportWidth]
  );
  const resolvedPanelWidth = clampPacketExplorerPanelWidth(
    liveDragWidth ?? committedPanelWidth,
    viewportWidth
  );
  const committedWidthRef = useRef(committedPanelWidth);
  const viewportWidthRef = useRef(viewportWidth);
  const commitPanelWidthRef = useRef(onCommitPanelWidth);

  useEffect(() => {
    committedWidthRef.current = committedPanelWidth;
  }, [committedPanelWidth]);

  useEffect(() => {
    viewportWidthRef.current = viewportWidth;
  }, [viewportWidth]);

  useEffect(() => {
    commitPanelWidthRef.current = onCommitPanelWidth;
  }, [onCommitPanelWidth]);

  useEffect(() => {
    if (!isDesktop) {
      setIsDragging(false);
      setLiveDragWidth(null);
    }
  }, [isDesktop]);

  useEffect(() => {
    if (
      !isDesktop ||
      sessionPanelWidth === null ||
      sessionPanelWidth === committedPanelWidth
    ) {
      return;
    }

    onCommitPanelWidth(committedPanelWidth);
  }, [
    committedPanelWidth,
    isDesktop,
    onCommitPanelWidth,
    sessionPanelWidth,
  ]);

  useEffect(() => {
    if (!isDesktop || !isDragging || !isBrowserEnvironment()) {
      return;
    }

    const bodyStyle = document.body.style;
    const previousCursor = bodyStyle.cursor;
    const previousUserSelect = bodyStyle.userSelect;
    const previousWebkitUserSelect = bodyStyle.getPropertyValue('-webkit-user-select');

    bodyStyle.cursor = 'col-resize';
    bodyStyle.userSelect = 'none';
    bodyStyle.setProperty('-webkit-user-select', 'none');

    const getActiveViewportWidth = () =>
      Math.max(window.innerWidth, viewportWidthRef.current);

    const handleMove = (event: MouseEvent) => {
      const nextWidth = getPacketExplorerPanelWidthFromPointer(
        event.clientX,
        getActiveViewportWidth()
      );

      setLiveDragWidth(nextWidth);
    };

    const handleCommit = (event: MouseEvent) => {
      const nextWidth = getPacketExplorerPanelWidthFromPointer(
        event.clientX,
        getActiveViewportWidth()
      );

      setIsDragging(false);
      setLiveDragWidth(null);

      if (nextWidth !== committedWidthRef.current) {
        commitPanelWidthRef.current(nextWidth);
      }
    };

    const handleCancel = () => {
      setIsDragging(false);
      setLiveDragWidth(null);
    };

    window.addEventListener('mousemove', handleMove, true);
    window.addEventListener('mouseup', handleCommit, true);
    window.addEventListener('mouseleave', handleCancel, true);
    window.addEventListener('blur', handleCancel);

    return () => {
      window.removeEventListener('mousemove', handleMove, true);
      window.removeEventListener('mouseup', handleCommit, true);
      window.removeEventListener('mouseleave', handleCancel, true);
      window.removeEventListener('blur', handleCancel);
      bodyStyle.cursor = previousCursor;
      bodyStyle.userSelect = previousUserSelect;
      bodyStyle.setProperty('-webkit-user-select', previousWebkitUserSelect);
    };
  }, [isDesktop, isDragging]);

  const handleResizePressIn = useCallback(
    (event: GestureResponderEvent) => {
      if (!isDesktop || !isBrowserEnvironment()) {
        return;
      }

      const pointerClientX =
        typeof event.nativeEvent.pageX === 'number'
          ? event.nativeEvent.pageX
          : viewportWidth - committedWidthRef.current;
      const nextWidth = getPacketExplorerPanelWidthFromPointer(
        pointerClientX,
        viewportWidth
      );

      setLiveDragWidth(nextWidth);
      setIsDragging(true);
    },
    [isDesktop, viewportWidth]
  );

  return {
    isDragging,
    resolvedPanelWidth,
    handleResizePressIn,
  };
}
