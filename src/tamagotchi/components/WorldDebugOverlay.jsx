import React, { useEffect, useMemo, useState } from "react";
import {
  WORLD_DECOR_LABEL_RENDER_LIMIT,
  WORLD_DECOR_MAX_ANIMATIONS_PER_CHUNK,
  WORLD_DECOR_MAX_ITEMS_PER_CHUNK,
  WORLD_DECOR_MAX_VISIBLE_ANIMATIONS,
  WORLD_DECOR_MAX_VISIBLE_ITEMS,
} from "../config/worldDecorConfig";
import {
  WORLD_ACTIVE_BUFFER_TILES,
  WORLD_DESPAWN_BUFFER_TILES,
} from "../config/worldStreamingConfig";
import {
  createDefaultWorldDecorRuntimeSettings,
  useWorldDebugStore,
} from "../store/worldDebugStore";
import { recordWorldPerfRender } from "../utils/worldPerfMetrics";

const PANEL_STYLE = {
  position: "absolute",
  top: 12,
  right: 12,
  width: 340,
  maxHeight: "calc(100vh - 24px)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 10,
  background: "rgba(10, 12, 18, 0.88)",
  border: "2px solid rgba(255,255,255,0.18)",
  boxShadow: "0 16px 42px rgba(0,0,0,0.45)",
  color: "#fff",
  fontSize: 11,
  lineHeight: 1.35,
  pointerEvents: "auto",
  zIndex: 18,
  borderRadius: 12,
};

const SECTION_STYLE = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: 8,
  background: "rgba(255,255,255,0.06)",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.08)",
};

const INPUT_STYLE = {
  width: "100%",
  padding: "4px 6px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(0,0,0,0.28)",
  color: "#fff",
  fontSize: 11,
};

const BUTTON_STYLE = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  fontSize: 11,
  cursor: "pointer",
};

const FAMILY_KEYS = [
  "fountain_loop",
  "water_idle_sparkle_loop_a",
  "water_idle_sparkle_loop_b",
  "small_flowers",
  "small_herbs_light",
  "small_herbs_dark",
  "shroom_green",
  "light_small_rock",
  "dark_small_rock",
  "small_water_rock",
  "variation_on_grass_light",
  "variation_on_grass_dark",
  "variation_on_sand",
  "variation_around_sand",
  "variation_on_road",
  "variation_around_road",
  "trees",
  "rocks",
];

function useFrameStats(enabled) {
  const [frameStats, setFrameStats] = useState({ fps: 0, frameMs: 0 });

  useEffect(() => {
    if (!enabled) return undefined;

    let rafId = 0;
    let frameCount = 0;
    let lastSampleAt = performance.now();
    let lastFrameAt = performance.now();
    let deltaTotal = 0;

    const loop = (timestamp) => {
      frameCount += 1;
      deltaTotal += timestamp - lastFrameAt;
      lastFrameAt = timestamp;

      if (timestamp - lastSampleAt >= 750) {
        const elapsed = timestamp - lastSampleAt;
        setFrameStats({
          fps: frameCount / (elapsed / 1000),
          frameMs: frameCount > 0 ? deltaTotal / frameCount : 0,
        });
        frameCount = 0;
        deltaTotal = 0;
        lastSampleAt = timestamp;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [enabled]);

  return frameStats;
}

function coerceNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function FieldRow({ label, children }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "1fr 88px", gap: 8, alignItems: "center" }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function WorldDebugOverlay({
  layoutDebug,
  visibleWorldDecorSummary,
  renderPerf,
  canvasPerf,
  onRegenerateNearbyChunks,
}) {
  const flags = useWorldDebugStore((state) => state.flags);
  const decorSettings = useWorldDebugStore((state) => state.decorSettings);
  const setFlag = useWorldDebugStore((state) => state.setFlag);
  const applyDecorSettings = useWorldDebugStore((state) => state.applyDecorSettings);
  const resetDecorSettings = useWorldDebugStore((state) => state.resetDecorSettings);
  const clearDebugOverlay = useWorldDebugStore((state) => state.clearDebugOverlay);
  const requestWorldRegenerate = useWorldDebugStore(
    (state) => state.requestWorldRegenerate
  );
  const [draft, setDraft] = useState(decorSettings);
  const frameStats = useFrameStats(flags.showWorldDebugOverlay);

  useEffect(() => {
    setDraft(decorSettings);
  }, [decorSettings]);

  const familyCountsText = useMemo(() => {
    const entries = Object.entries(visibleWorldDecorSummary?.familyCounts || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return entries.length
      ? entries.map(([familyId, count]) => `${familyId}:${count}`).join(" | ")
      : "none";
  }, [visibleWorldDecorSummary?.familyCounts]);

  if (
    !import.meta.env.DEV ||
    !flags.showWorldDebugOverlay ||
    flags.showCollisionRectsOnly
  ) {
    return null;
  }

  recordWorldPerfRender("worldDebugOverlay");

  const visibleBudget = layoutDebug?.visibleDecorBudget || null;
  const worldDecorStats = layoutDebug?.worldDecorStats || null;
  const poolSizesText = Object.entries(worldDecorStats?.eligiblePoolSizes || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([poolKey, count]) => `${poolKey}:${count}`)
    .join(" | ");

  return (
    <div style={PANEL_STYLE}>
      <div style={SECTION_STYLE}>
        <strong style={{ fontSize: 12 }}>World Debug</strong>
        <div>{`decor ${visibleWorldDecorSummary?.metadataDecorCount || 0} | anim ${
          visibleWorldDecorSummary?.animationCount || 0
        } | objects ${visibleWorldDecorSummary?.objectCount || 0} | collision ${
          visibleWorldDecorSummary?.collisionCount || 0
        }`}</div>
        <div>{`chunks active ${layoutDebug?.activeChunkCount || 0} | player ${
          layoutDebug?.playerChunk
            ? `${layoutDebug.playerChunk.x},${layoutDebug.playerChunk.y}`
            : "?"
        }`}</div>
        <div>{`viewport ${
          layoutDebug?.viewportBounds
            ? `${Math.round(layoutDebug.viewportBounds.left)},${Math.round(layoutDebug.viewportBounds.top)} -> ${Math.round(layoutDebug.viewportBounds.right)},${Math.round(layoutDebug.viewportBounds.bottom)}`
            : "?"
        }`}</div>
        <div>{`active ${
          layoutDebug?.activeBounds
            ? `${Math.round(layoutDebug.activeBounds.left)},${Math.round(layoutDebug.activeBounds.top)} -> ${Math.round(layoutDebug.activeBounds.right)},${Math.round(layoutDebug.activeBounds.bottom)}`
            : "?"
        }`}</div>
        <div>{`despawn ${
          layoutDebug?.despawnBounds
            ? `${Math.round(layoutDebug.despawnBounds.left)},${Math.round(layoutDebug.despawnBounds.top)} -> ${Math.round(layoutDebug.despawnBounds.right)},${Math.round(layoutDebug.despawnBounds.bottom)}`
            : "?"
        }`}</div>
        <div>{`chunk range ${
          layoutDebug?.activeChunkRange
            ? `${layoutDebug.activeChunkRange.minChunkX},${layoutDebug.activeChunkRange.minChunkY} -> ${layoutDebug.activeChunkRange.maxChunkX},${layoutDebug.activeChunkRange.maxChunkY}`
            : "?"
        }`}</div>
        <div>{`budget skip distance ${visibleBudget?.skippedByDistance || 0} | budget ${
          visibleBudget?.skippedByBudget || 0
        } | family ${visibleBudget?.skippedByFamilyCap || 0} | nearby ${
          visibleBudget?.skippedByNearby || 0
        }`}</div>
        <div>{`candidates ${worldDecorStats?.candidateAttempts || 0} | exact overlap ${
          worldDecorStats?.exactOverlapChecks || 0
        } | occupied cells ${worldDecorStats?.occupiedCellCount || 0}`}</div>
        <div>{`viewport items ${visibleBudget?.viewportItemCount || 0} | buffer ${
          visibleBudget?.bufferItemCount || 0
        } | culled ${visibleBudget?.culledItemCount || 0}`}</div>
        <div>{`skip empty ${worldDecorStats?.skipped?.empty_pool || 0} | occupied ${
          worldDecorStats?.skipped?.occupied_pool || 0
        } | budget ${worldDecorStats?.skipped?.budget || 0}`}</div>
        <div>{`rejected terrain ${worldDecorStats?.rejected?.forbidden_terrain || 0} | non_full ${
          worldDecorStats?.rejected?.non_full_autotile || 0
        } | overlap ${worldDecorStats?.rejected?.overlap || 0}`}</div>
        <div>{`fps ${frameStats.fps.toFixed(1)} | frame ${frameStats.frameMs.toFixed(1)}ms`}</div>
        {flags.showWorldPerfDebug ? (
          <>
            <div>{`render r/s world ${renderPerf?.worldAtlasLayerRendersPerSecond?.toFixed?.(1) || "0.0"} | chunks ${
              renderPerf?.chunkTileLayerRendersPerSecond?.toFixed?.(1) || "0.0"
            } | debug ${renderPerf?.worldDebugOverlayRendersPerSecond?.toFixed?.(1) || "0.0"}`}</div>
            <div>{`cache layout h/m ${layoutDebug?.perf?.layoutCacheHits || 0}/${
              layoutDebug?.perf?.layoutCacheMisses || 0
            } | chunk ${layoutDebug?.perf?.chunkCacheHits || 0}/${
              layoutDebug?.perf?.chunkCacheMisses || 0
            }`}</div>
            <div>{`ms chunk ${layoutDebug?.perf?.lastChunkDurationMs?.toFixed?.(1) || "0.0"} | terrain ${
              layoutDebug?.perf?.lastTerrainDurationMs?.toFixed?.(1) || "0.0"
            } | object ${layoutDebug?.perf?.lastObjectDurationMs?.toFixed?.(1) || "0.0"}`}</div>
            <div>{`ms decor ${layoutDebug?.perf?.lastDecorDurationMs?.toFixed?.(1) || "0.0"} | sort ${
              layoutDebug?.perf?.lastSortDurationMs?.toFixed?.(1) || "0.0"
            } | visible ${layoutDebug?.perf?.lastVisibleBudgetDurationMs?.toFixed?.(1) || "0.0"}`}</div>
            <div>{`canvas r/s back ${canvasPerf?.backDrawsPerSecond?.toFixed?.(1) || "0.0"} | front ${
              canvasPerf?.frontDrawsPerSecond?.toFixed?.(1) || "0.0"
            } | ms ${canvasPerf?.backDrawDurationMs?.toFixed?.(2) || "0.00"}/${
              canvasPerf?.frontDrawDurationMs?.toFixed?.(2) || "0.00"
            }`}</div>
            <div>{`rendered items ${layoutDebug?.renderedItemCount || 0} | tiles ${
              layoutDebug?.renderedTileItemCount || 0
            } | floating ${layoutDebug?.renderedFloatingItemCount || 0}`}</div>
          </>
        ) : null}
        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{familyCountsText}</div>
        {poolSizesText ? (
          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{poolSizesText}</div>
        ) : null}
      </div>

      <div style={SECTION_STYLE}>
        <strong style={{ fontSize: 12 }}>Overlay Flags</strong>
        {[
          ["showWorldDecorDebug", "Debug Summary"],
          ["showWorldItemBoundsDebug", "Item Bounds"],
          ["showWorldCollisionBoundsDebug", "Collision Bounds"],
          ["showWorldDecorLabelsDebug", "Labels"],
          ["showViewportCullingDebug", "Viewport Bounds"],
          ["showSpawnDespawnBufferDebug", "Spawn Buffers"],
          ["showWaterCollisionDebug", "Water Collision"],
          ["showWorldPerfDebug", "Perf Stats"],
          ["showWorldDecorTweakPanel", "Tweak Panel"],
        ].map(([flagKey, label]) => (
          <label key={flagKey} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={Boolean(flags[flagKey])}
              onChange={(event) => setFlag(flagKey, event.target.checked)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      {flags.showWorldDecorTweakPanel ? (
        <div style={{ ...SECTION_STYLE, overflow: "auto", maxHeight: "54vh" }}>
          <strong style={{ fontSize: 12 }}>Live Tweaks</strong>

          <FieldRow label="Active buffer">
            <input
              style={INPUT_STYLE}
              value={draft.activeBufferTiles}
              onChange={(event) =>
                setDraft((state) => ({
                  ...state,
                  activeBufferTiles: event.target.value,
                }))
              }
            />
          </FieldRow>
          <FieldRow label="Despawn buffer">
            <input
              style={INPUT_STYLE}
              value={draft.despawnBufferTiles}
              onChange={(event) =>
                setDraft((state) => ({
                  ...state,
                  despawnBufferTiles: event.target.value,
                }))
              }
            />
          </FieldRow>
          <FieldRow label="Max visible decor">
            <input
              style={INPUT_STYLE}
              value={draft.maxVisibleItems}
              onChange={(event) =>
                setDraft((state) => ({
                  ...state,
                  maxVisibleItems: event.target.value,
                }))
              }
            />
          </FieldRow>
          <FieldRow label="Max visible anim">
            <input
              style={INPUT_STYLE}
              value={draft.maxVisibleAnimations}
              onChange={(event) =>
                setDraft((state) => ({
                  ...state,
                  maxVisibleAnimations: event.target.value,
                }))
              }
            />
          </FieldRow>
          <FieldRow label="Max items/chunk">
            <input
              style={INPUT_STYLE}
              value={draft.maxItemsPerChunk}
              onChange={(event) =>
                setDraft((state) => ({
                  ...state,
                  maxItemsPerChunk: event.target.value,
                }))
              }
            />
          </FieldRow>
          <FieldRow label="Max anim/chunk">
            <input
              style={INPUT_STYLE}
              value={draft.maxAnimationsPerChunk}
              onChange={(event) =>
                setDraft((state) => ({
                  ...state,
                  maxAnimationsPerChunk: event.target.value,
                }))
              }
            />
          </FieldRow>
          <FieldRow label="Label limit">
            <input
              style={INPUT_STYLE}
              value={draft.labelRenderLimit}
              onChange={(event) =>
                setDraft((state) => ({
                  ...state,
                  labelRenderLimit: event.target.value,
                }))
              }
            />
          </FieldRow>

          {FAMILY_KEYS.map((familyId) => {
            const familyDraft = draft.familyConfig?.[familyId] || {};
            return (
              <div
                key={familyId}
                style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  display: "grid",
                  gap: 6,
                }}
              >
                <strong>{familyId}</strong>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={familyDraft.enabled !== false}
                    onChange={(event) =>
                      setDraft((state) => ({
                        ...state,
                        familyConfig: {
                          ...state.familyConfig,
                          [familyId]: {
                            ...state.familyConfig[familyId],
                            enabled: event.target.checked,
                          },
                        },
                      }))
                    }
                  />
                  <span>Enabled</span>
                </label>
                {[
                  ["density", "Density"],
                  ["minDistanceTiles", "Min dist"],
                  ["maxPerChunk", "Max/chunk"],
                  ["maxVisible", "Max visible"],
                  ["priority", "Priority"],
                ].map(([fieldKey, label]) => (
                  <FieldRow key={`${familyId}:${fieldKey}`} label={label}>
                    <input
                      style={INPUT_STYLE}
                      value={familyDraft[fieldKey] ?? ""}
                      onChange={(event) =>
                        setDraft((state) => ({
                          ...state,
                          familyConfig: {
                            ...state.familyConfig,
                            [familyId]: {
                              ...state.familyConfig[familyId],
                              [fieldKey]: event.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </FieldRow>
                ))}
              </div>
            );
          })}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            <button
              style={BUTTON_STYLE}
              onClick={() => {
                const nextFamilyConfig = Object.fromEntries(
                  Object.entries(draft.familyConfig || {}).map(([familyId, config]) => [
                    familyId,
                    {
                      ...config,
                      density: coerceNumber(config.density, 0),
                      minDistanceTiles: coerceNumber(config.minDistanceTiles, 0),
                      maxPerChunk: coerceNumber(config.maxPerChunk, 0),
                      maxVisible: coerceNumber(config.maxVisible, 0),
                      priority: coerceNumber(config.priority, 0),
                    },
                  ])
                );

                applyDecorSettings({
                  activeBufferTiles: coerceNumber(
                    draft.activeBufferTiles,
                    WORLD_ACTIVE_BUFFER_TILES
                  ),
                  despawnBufferTiles: coerceNumber(
                    draft.despawnBufferTiles,
                    WORLD_DESPAWN_BUFFER_TILES
                  ),
                  maxVisibleItems: coerceNumber(
                    draft.maxVisibleItems,
                    WORLD_DECOR_MAX_VISIBLE_ITEMS
                  ),
                  maxVisibleAnimations: coerceNumber(
                    draft.maxVisibleAnimations,
                    WORLD_DECOR_MAX_VISIBLE_ANIMATIONS
                  ),
                  maxItemsPerChunk: coerceNumber(
                    draft.maxItemsPerChunk,
                    WORLD_DECOR_MAX_ITEMS_PER_CHUNK
                  ),
                  maxAnimationsPerChunk: coerceNumber(
                    draft.maxAnimationsPerChunk,
                    WORLD_DECOR_MAX_ANIMATIONS_PER_CHUNK
                  ),
                  labelRenderLimit: coerceNumber(
                    draft.labelRenderLimit,
                    WORLD_DECOR_LABEL_RENDER_LIMIT
                  ),
                  familyConfig: nextFamilyConfig,
                });
              }}
            >
              Apply
            </button>
            <button
              style={BUTTON_STYLE}
              onClick={() => {
                resetDecorSettings();
                setDraft(createDefaultWorldDecorRuntimeSettings());
              }}
            >
              Reset Defaults
            </button>
            <button
              style={BUTTON_STYLE}
              onClick={() => {
                requestWorldRegenerate();
                onRegenerateNearbyChunks?.();
              }}
            >
              Regenerate Nearby Chunks
            </button>
            <button
              style={BUTTON_STYLE}
              onClick={() => clearDebugOverlay()}
            >
              Clear Debug Overlay
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
