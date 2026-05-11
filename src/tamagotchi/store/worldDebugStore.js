import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEV_START_WORLD_DEBUG,
  SHOW_SPAWN_DESPAWN_BUFFER_DEBUG,
  SHOW_COLLISION_RECTS_ONLY,
  SHOW_VIEWPORT_CULLING_DEBUG,
  SHOW_WATER_COLLISION_DEBUG,
  SHOW_WORLD_COLLISION_BOUNDS_DEBUG,
  SHOW_WORLD_DEBUG_OVERLAY,
  SHOW_WORLD_DECOR_BOUNDS_DEBUG,
  SHOW_WORLD_DECOR_DEBUG,
  SHOW_WORLD_DECOR_LABELS_DEBUG,
  SHOW_WORLD_DECOR_TWEAK_PANEL,
  SHOW_WORLD_ITEM_BOUNDS_DEBUG,
  SHOW_WORLD_PERF_DEBUG,
  SHOW_WORLD_SPAWN_RADIUS_DEBUG,
  WORLD_ACTIVE_BUFFER_TILES,
  WORLD_DESPAWN_BUFFER_TILES,
} from "../config/worldStreamingConfig";
import {
  WORLD_DECOR_FAMILY_CONFIG,
  WORLD_DECOR_LABEL_RENDER_LIMIT,
  WORLD_DECOR_MAX_ANIMATIONS_PER_CHUNK,
  WORLD_DECOR_MAX_ITEMS_PER_CHUNK,
  WORLD_DECOR_MAX_VISIBLE_ANIMATIONS,
  WORLD_DECOR_MAX_VISIBLE_ITEMS,
} from "../config/worldDecorConfig";

function cloneFamilyConfig(familyConfig = WORLD_DECOR_FAMILY_CONFIG) {
  return Object.fromEntries(
    Object.entries(familyConfig).map(([familyId, config]) => [
      familyId,
      { ...config },
    ])
  );
}

export const DEFAULT_WORLD_DEBUG_FLAGS = Object.freeze({
  showWorldDebugOverlay: SHOW_WORLD_DEBUG_OVERLAY,
  showWorldDecorDebug: SHOW_WORLD_DECOR_DEBUG,
  showWorldDecorBoundsDebug: SHOW_WORLD_DECOR_BOUNDS_DEBUG,
  showWorldItemBoundsDebug: SHOW_WORLD_ITEM_BOUNDS_DEBUG,
  showWorldCollisionBoundsDebug: SHOW_WORLD_COLLISION_BOUNDS_DEBUG,
  showCollisionRectsOnly: SHOW_COLLISION_RECTS_ONLY,
  showWorldDecorLabelsDebug: SHOW_WORLD_DECOR_LABELS_DEBUG,
  showWorldSpawnRadiusDebug: SHOW_WORLD_SPAWN_RADIUS_DEBUG,
  showViewportCullingDebug: SHOW_VIEWPORT_CULLING_DEBUG,
  showSpawnDespawnBufferDebug: SHOW_SPAWN_DESPAWN_BUFFER_DEBUG,
  showWorldDecorTweakPanel: SHOW_WORLD_DECOR_TWEAK_PANEL,
  showWaterCollisionDebug: SHOW_WATER_COLLISION_DEBUG,
  showWorldPerfDebug: SHOW_WORLD_PERF_DEBUG,
  devStartWorldDebug: DEV_START_WORLD_DEBUG,
});

export function createDefaultWorldDecorRuntimeSettings() {
  return {
    activeBufferTiles: WORLD_ACTIVE_BUFFER_TILES,
    despawnBufferTiles: WORLD_DESPAWN_BUFFER_TILES,
    maxVisibleItems: WORLD_DECOR_MAX_VISIBLE_ITEMS,
    maxVisibleAnimations: WORLD_DECOR_MAX_VISIBLE_ANIMATIONS,
    maxItemsPerChunk: WORLD_DECOR_MAX_ITEMS_PER_CHUNK,
    maxAnimationsPerChunk: WORLD_DECOR_MAX_ANIMATIONS_PER_CHUNK,
    labelRenderLimit: WORLD_DECOR_LABEL_RENDER_LIMIT,
    familyConfig: cloneFamilyConfig(),
  };
}

export const useWorldDebugStore = create(
  persist(
    (set) => ({
      flags: { ...DEFAULT_WORLD_DEBUG_FLAGS },
      decorSettings: createDefaultWorldDecorRuntimeSettings(),
      runtimeRevision: 0,
      cacheResetToken: 0,

      setFlag: (flagKey, value) =>
        set((state) => ({
          flags: {
            ...state.flags,
            [flagKey]: Boolean(value),
          },
        })),

      setFlags: (nextFlags) =>
        set((state) => ({
          flags: {
            ...state.flags,
            ...nextFlags,
          },
        })),

      applyDecorSettings: (nextSettings, options = {}) =>
        set((state) => ({
          decorSettings: {
            ...state.decorSettings,
            ...nextSettings,
            familyConfig: {
              ...state.decorSettings.familyConfig,
              ...(nextSettings.familyConfig || {}),
            },
          },
          runtimeRevision: state.runtimeRevision + 1,
          cacheResetToken:
            state.cacheResetToken + (options.skipRegenerate ? 0 : 1),
        })),

      resetDecorSettings: () =>
        set((state) => ({
          flags: { ...DEFAULT_WORLD_DEBUG_FLAGS },
          decorSettings: createDefaultWorldDecorRuntimeSettings(),
          runtimeRevision: state.runtimeRevision + 1,
          cacheResetToken: state.cacheResetToken + 1,
        })),

      requestWorldRegenerate: () =>
        set((state) => ({
          runtimeRevision: state.runtimeRevision + 1,
          cacheResetToken: state.cacheResetToken + 1,
        })),

      clearDebugOverlay: () =>
        set((state) => ({
          flags: {
            ...state.flags,
            showWorldDecorBoundsDebug: false,
            showWorldItemBoundsDebug: false,
            showWorldCollisionBoundsDebug: false,
            showCollisionRectsOnly: false,
            showWorldDecorLabelsDebug: false,
            showWorldSpawnRadiusDebug: false,
            showViewportCullingDebug: false,
            showSpawnDespawnBufferDebug: false,
            showWaterCollisionDebug: false,
          },
        })),
    }),
    {
      name: "world-debug-store-v3",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        flags: state.flags,
        decorSettings: state.decorSettings,
      }),
      version: 3,
      merge: (persistedState, currentState) => {
        const nextState = {
          ...currentState,
          ...(persistedState || {}),
        };

        if (!DEV_START_WORLD_DEBUG) {
          return {
            ...nextState,
            flags: { ...DEFAULT_WORLD_DEBUG_FLAGS },
            decorSettings: createDefaultWorldDecorRuntimeSettings(),
          };
        }

        return nextState;
      },
    }
  )
);

export function getWorldDebugFlags() {
  return useWorldDebugStore.getState().flags;
}

export function getWorldDecorRuntimeSettings() {
  return useWorldDebugStore.getState().decorSettings;
}
