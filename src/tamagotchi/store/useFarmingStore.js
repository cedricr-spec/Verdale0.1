import { create } from "zustand"

const MAX_GROWTH_STAGE = 4
const MATURE_GRACE_TICKS = 3

// Tile key: "${tileX}_${tileY}" in world grid coordinates
// World position = tileX * WORLD_ATLAS_TILE_SIZE, tileY * WORLD_ATLAS_TILE_SIZE

export const useFarmingStore = create((set, get) => ({
  // farmTiles: { [tileKey]: FarmTileState }
  farmTiles: {},
  growthTickCount: 0,
  // Bumped on any mutation — MainScene uses this for dirty tracking
  growthTickRevision: 0,

  getTile(tileKey) {
    return get().farmTiles[tileKey] || null
  },

  tillTile(tileKey) {
    set((state) => {
      const existing = state.farmTiles[tileKey]
      if (existing?.tilled) return state
      return {
        farmTiles: {
          ...state.farmTiles,
          [tileKey]: {
            tilled: true,
            watered: false,
            holed: false,
            seeded: false,
            cropId: null,
            growthStage: 0,
            isDead: false,
            maturedAtTick: null,
            witherRecoveryWaterCount: 0,
            witherRecoveryStartedAt: null,
            plantedAtDay: null,
          },
        },
        growthTickRevision: state.growthTickRevision + 1,
      }
    })
  },

  digHole(tileKey) {
    set((state) => {
      const tile = state.farmTiles[tileKey]
      if (!tile?.tilled || tile.holed) return state
      return {
        farmTiles: {
          ...state.farmTiles,
          [tileKey]: { ...tile, holed: true },
        },
        growthTickRevision: state.growthTickRevision + 1,
      }
    })
  },

  waterTile(tileKey) {
    const tile = get().farmTiles[tileKey]
    if (!tile?.tilled || tile.watered) return null

    if (tile.seeded && tile.cropId && tile.isDead) {
      const nextRecoveryCount = (tile.witherRecoveryWaterCount || 0) + 1
      const revived = nextRecoveryCount >= 2

      set((state) => ({
        farmTiles: {
          ...state.farmTiles,
          [tileKey]: revived
            ? {
                ...tile,
                isDead: false,
                growthStage: MAX_GROWTH_STAGE,
                watered: false,
                maturedAtTick: state.growthTickCount,
                witherRecoveryWaterCount: 0,
                witherRecoveryStartedAt: null,
              }
            : {
                ...tile,
                watered: true,
                witherRecoveryWaterCount: nextRecoveryCount,
                witherRecoveryStartedAt: tile.witherRecoveryStartedAt || Date.now(),
              },
        },
        growthTickRevision: state.growthTickRevision + 1,
      }))

      return {
        recovery: true,
        revived,
        waterCount: revived ? 2 : nextRecoveryCount,
      }
    }

    set((state) => ({
      farmTiles: {
        ...state.farmTiles,
        [tileKey]: { ...tile, watered: true },
      },
      growthTickRevision: state.growthTickRevision + 1,
    }))

    return {
      recovery: false,
      revived: false,
      waterCount: 0,
    }
  },

  plantSeed(tileKey, cropId) {
    set((state) => {
      const tile = state.farmTiles[tileKey]
      if (!tile?.tilled || !tile.holed || tile.seeded) return state
      return {
        farmTiles: {
          ...state.farmTiles,
          [tileKey]: {
            ...tile,
            seeded: true,
            cropId,
            growthStage: 0,
            isDead: false,
            maturedAtTick: null,
            witherRecoveryWaterCount: 0,
            witherRecoveryStartedAt: null,
            plantedAtDay: Date.now(),
          },
        },
        growthTickRevision: state.growthTickRevision + 1,
      }
    })
  },

  harvestCrop(tileKey) {
    const tile = get().farmTiles[tileKey]
    if (!tile?.seeded || !tile.cropId || tile.isDead || tile.growthStage < MAX_GROWTH_STAGE) return null
    const harvestedCropId = tile.cropId
    set((state) => ({
      farmTiles: {
        ...state.farmTiles,
        [tileKey]: {
          tilled: true,
          watered: false,
          holed: false,
          seeded: false,
          cropId: null,
          growthStage: 0,
          isDead: false,
          maturedAtTick: null,
          witherRecoveryWaterCount: 0,
          witherRecoveryStartedAt: null,
          plantedAtDay: null,
        },
      },
      growthTickRevision: state.growthTickRevision + 1,
    }))
    return harvestedCropId
  },

  // Advance growth for all watered seeded tiles; resets watered after advancing
  advanceGrowth() {
    set((state) => {
      const updated = {}
      const nextGrowthTickCount = state.growthTickCount + 1
      let changed = false

      for (const [key, tile] of Object.entries(state.farmTiles)) {
        if (!tile?.seeded || !tile.cropId) continue

        if (tile.isDead) {
          if (tile.watered) {
            updated[key] = {
              ...tile,
              watered: false,
            }
            changed = true
          }
          continue
        }

        if (tile.watered && tile.growthStage < MAX_GROWTH_STAGE) {
          const nextGrowthStage = Math.min(MAX_GROWTH_STAGE, tile.growthStage + 1)
          updated[key] = {
            ...tile,
            growthStage: nextGrowthStage,
            watered: false,
            maturedAtTick:
              nextGrowthStage >= MAX_GROWTH_STAGE
                ? tile.maturedAtTick ?? nextGrowthTickCount
                : null,
          }
          changed = true
          continue
        }

        if (
          tile.growthStage >= MAX_GROWTH_STAGE &&
          tile.maturedAtTick != null &&
          nextGrowthTickCount - tile.maturedAtTick >= MATURE_GRACE_TICKS
        ) {
          updated[key] = {
            ...tile,
            isDead: true,
            watered: false,
          }
          changed = true
        }
      }

      return {
        farmTiles: { ...state.farmTiles, ...updated },
        growthTickCount: nextGrowthTickCount,
        growthTickRevision: changed
          ? state.growthTickRevision + 1
          : state.growthTickRevision,
      }
    })
  },
}))
