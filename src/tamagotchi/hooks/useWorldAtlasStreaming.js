import { useEffect, useMemo, useRef, useState } from "react";
import {
  CHUNK_PREWARM_STEPS_PER_FRAME,
  SHOW_WORLD_STREAMING_DEBUG,
} from "../config/worldStreamingConfig";
import {
  getWorldAtlasLayout,
  getWorldAtlasLayoutKey,
  primeWorldAtlasWindow,
  resetWorldAtlasCaches,
} from "../utils/worldAtlasFamilies";
import { useWorldDebugStore } from "../store/worldDebugStore";

function scheduleBackgroundWork(callback) {
  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: 32 });
    return { type: "idle", id };
  }

  const id = requestAnimationFrame(() => callback());
  return { type: "raf", id };
}

function cancelBackgroundWork(handle) {
  if (!handle) return;

  if (handle.type === "idle" && typeof window !== "undefined") {
    window.cancelIdleCallback(handle.id);
    return;
  }

  cancelAnimationFrame(handle.id);
}

export default function useWorldAtlasStreaming(playerX, playerY, atlasData, viewport) {
  const [revision, setRevision] = useState(0);
  const [batchDebug, setBatchDebug] = useState(null);
  const runtimeRevision = useWorldDebugStore((state) => state.runtimeRevision);
  const cacheResetToken = useWorldDebugStore((state) => state.cacheResetToken);
  const layoutKey = getWorldAtlasLayoutKey(playerX, playerY, viewport);
  const previousPlayerRef = useRef({ x: playerX, y: playerY });
  const bootstrappedAtlasRef = useRef(null);
  const lastStableLayoutRef = useRef(null);

  // Tracks the latest pixel-accurate player position without triggering memo re-runs.
  // playerX/playerY only change when layoutKey changes (shouldResampleCamera guard in
  // WorldAtlasLayer), so they are redundant as direct memo deps — layoutKey covers them.
  const playerPositionRef = useRef({ x: playerX, y: playerY });
  playerPositionRef.current = { x: playerX, y: playerY };

  // Tracks which layoutKey we last synchronously primed active chunks for.
  // Re-priming on layoutKey change ensures buildCombinedWorldLayout never hits a
  // synchronous cache miss mid-render for the active window.
  const lastPrimedLayoutKeyRef = useRef(null);

  const layout = useMemo(() => {
    const { x: px, y: py } = playerPositionRef.current;

    const needsPrime =
      bootstrappedAtlasRef.current !== atlasData ||
      lastPrimedLayoutKeyRef.current !== layoutKey;

    if (needsPrime) {
      // Synchronously fill any missing active-window chunks before building the layout.
      // This prevents getChunkLayout from generating chunks synchronously inside
      // buildCombinedWorldLayout, which would stall the main thread mid-render.
      primeWorldAtlasWindow(px, py, atlasData, viewport, {
        includePreload: false,
        maxChunks: Number.POSITIVE_INFINITY,
      });
      bootstrappedAtlasRef.current = atlasData;
      lastPrimedLayoutKeyRef.current = layoutKey;
    }

    // getWorldAtlasLayout now caches the combined layout by layoutKey, so repeated
    // calls for the same chunk window (e.g. revision bumps for preload-only primes)
    // return instantly without re-running buildCombinedWorldLayout.
    const nextLayout = getWorldAtlasLayout(px, py, atlasData, viewport);
    if (
      nextLayout.renderItems.length > 0 ||
      nextLayout.tileChunks.length > 0 ||
      !lastStableLayoutRef.current
    ) {
      lastStableLayoutRef.current = nextLayout;
      return nextLayout;
    }

    return lastStableLayoutRef.current;
  }, [
    atlasData,
    cacheResetToken,
    layoutKey,   // chunk-boundary position — playerX/playerY only change with this
    revision,
    runtimeRevision,
    viewport,
  ]);

  useEffect(() => {
    if (!atlasData) return;

    resetWorldAtlasCaches(atlasData);
    bootstrappedAtlasRef.current = null;
    lastStableLayoutRef.current = null;
    lastPrimedLayoutKeyRef.current = null;
    setRevision((value) => value + 1);
  }, [atlasData, cacheResetToken]);

  useEffect(() => {
    let cancelled = false;
    let scheduledHandle = null;
    const previousPlayer = previousPlayerRef.current;
    const priority = {
      x: Math.sign(playerX - previousPlayer.x),
      y: Math.sign(playerY - previousPlayer.y),
    };

    previousPlayerRef.current = { x: playerX, y: playerY };

    const runBatch = () => {
      if (cancelled) return;

      const result = primeWorldAtlasWindow(playerX, playerY, atlasData, viewport, {
        includePreload: true,
        maxChunks: CHUNK_PREWARM_STEPS_PER_FRAME,
        priority,
      });

      if (SHOW_WORLD_STREAMING_DEBUG) {
        setBatchDebug(result);
      }

      if (result.generatedActiveCount > 0) {
        // primeWorldAtlasWindow already cleared the layout cache for this window.
        // Bump revision so the memo rebuilds the combined layout with the new chunks.
        setRevision((value) => value + 1);
      }

      if (result.remainingCount > 0) {
        scheduledHandle = scheduleBackgroundWork(runBatch);
      }
    };

    scheduledHandle = scheduleBackgroundWork(runBatch);

    return () => {
      cancelled = true;
      cancelBackgroundWork(scheduledHandle);
    };
  }, [atlasData, cacheResetToken, layoutKey, runtimeRevision]);

  return {
    layout,
    debug: batchDebug,
  };
}
