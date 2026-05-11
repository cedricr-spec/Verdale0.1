import {
  getAtlasEntry,
  getAtlasRules,
  getGroupEntries,
  hasAtlasTag,
  hashUnit,
} from "./atlasRegionUtils";
import { resolveTerrainAutotile } from "./autotileResolver";
import {
  createTerrainSampler,
  generateLogicalTerrainGrid,
  isTerrainWalkable,
  TERRAIN_TYPES,
} from "./worldTerrainGenerator";
import { AUTOTILE_PATTERN_CATEGORY_KEYS } from "./worldAutotileTemplates";
import {
  ACTIVE_RADIUS_X,
  ACTIVE_RADIUS_Y,
  CHUNK_GENERATION_PADDING_TILES,
  CHUNK_PREWARM_STEPS_PER_FRAME,
  CHUNK_TILE_SIZE,
  COLLISION_OVERSCAN_TILES,
  DESPAWN_MARGIN,
  MAX_CACHED_WORLD_CHUNKS,
  MAX_CACHED_WORLD_WINDOWS,
  PRELOAD_RADIUS_X,
  PRELOAD_RADIUS_Y,
  RENDER_OVERSCAN_TILES,
  TREE_MAX_PER_CHUNK,
  TREE_OVERLAP_PADDING_TILES,
  SHOW_TERRAIN_AUTOTILE_DEBUG,
  SHOW_AUTOTILE_CATEGORY_DEBUG,
  SHOW_OBJECT_SPAWN_DEBUG,
  SHOW_TERRAIN_TYPE_DEBUG,
  SHOW_WATER_COLLISION_DEBUG,
  SHOW_WORLD_DECOR_DEBUG,
  SHOW_VIEWPORT_CULLING_DEBUG,
  SHOW_WORLD_PERF_DEBUG,
  WORLD_ACTIVE_BUFFER_TILES,
  WORLD_DESPAWN_BUFFER_TILES,
  DEBUG_TREE_COLLISION_SOURCE,
  DEBUG_CHUNK_PERFORMANCE,
  DEBUG_CHUNK_SLOW_THRESHOLD_MS,
} from "../config/worldStreamingConfig";
import {
  getObjectCollisionProfile,
  getObjectPlacementProfile,
  getObjectScaleRange,
} from "../config/worldObjectProfiles";
import {
  WORLD_DECOR_CLUSTER_CONFIG,
  WORLD_DECOR_DENSITY,
  WORLD_DECOR_DENSITY_BY_KEY,
  WORLD_DECOR_FAMILY_CONFIG,
  WORLD_DECOR_FAMILY_ENABLED,
  WORLD_DECOR_FAMILY_MAX_VISIBLE,
  WORLD_DECOR_FAMILY_PRIORITY,
  WORLD_DECOR_MAX_ANIMATIONS_PER_CHUNK,
  WORLD_DECOR_MAX_ANIMATED_ITEMS_PER_CHUNK,
  WORLD_DECOR_MAX_ITEMS_PER_CHUNK,
  WORLD_DECOR_MAX_VISIBLE_ANIMATIONS,
  WORLD_DECOR_MAX_VISIBLE_ITEMS,
  WORLD_DECOR_MAX_METADATA_ITEMS_PER_CHUNK,
  WORLD_DECOR_MAX_PER_CHUNK,
  WORLD_DECOR_MAX_TOTAL_VISIBLE_ITEMS,
  WORLD_DECOR_MIN_DISTANCE_TILES,
} from "../config/worldDecorConfig";
import {
  WORLD_TILE_METADATA,
  WORLD_TILE_METADATA_ANIMATIONS,
  WORLD_TILE_METADATA_FAMILIES,
  WORLD_TILE_METADATA_TILES_BY_ALLOWED_TERRAIN,
  WORLD_TILE_METADATA_TILES_BY_FAMILY,
} from "./worldTileMetadata";
import {
  getWorldDebugFlags,
  getWorldDecorRuntimeSettings,
} from "../store/worldDebugStore";
import {
  getWorldAtlasEntryCollisionBox,
  WORLD_ATLAS_PRIMARY_TREE_TAG,
  WORLD_ATLAS_TREE_OBJECTS,
} from "./worldAtlasData";
import {
  DEBUG_VILLAGE_DECOR_OCCUPANCY,
  getVillageDecorExclusionInfo,
  getVillageInstanceBounds,
  isWorldBoundsExcludedByVillageDecor,
  isWorldTileExcludedByVillageDecor,
  isWorldTileInsideVillage,
  VILLAGE_OCCUPIED_DECOR_PADDING_TILES,
  WORLD_VILLAGE_INSTANCES,
} from "./worldVillage";

export const WORLD_ATLAS_TILE_SCALE = 2;
export const WORLD_ATLAS_TILE_SIZE = 16 * WORLD_ATLAS_TILE_SCALE;
export const WORLD_ATLAS_VIEW_PADDING =
  CHUNK_GENERATION_PADDING_TILES * WORLD_ATLAS_TILE_SIZE;
export const WORLD_ATLAS_COLLISION_VIEWPORT = { width: 960, height: 720 };

const DEFAULT_VIEWPORT = { width: 500, height: 500 };
const layoutCacheByAtlas = new WeakMap();
const chunkCacheByAtlas = new WeakMap();
const chunkStatsByAtlas = new WeakMap();
const contentCache = new WeakMap();
const decorVisibilityStateByAtlas = new WeakMap();
let sharedTerrainSampler = null;

// ─── Village chunk exclusion mask cache ──────────────────────────────────────
// Per-chunk Uint8Array bitmask caching which cells are in the village exclusion
// zone.  Computed once on first access; far-from-village chunks get a null mask
// and skip all village checks in O(1).  Keyed by packed integer chunk coord.
const _chunkExclusionCache = new Map();
let _villageTileBoundsUnion = undefined; // undefined = not yet computed

const LAYER_ORDER = {
  ground: 0,
  terrain_variation: 1,
  feature: 2,
  path: 3,
  water: 4,
  bridge: 5,
  decor_ground: 6,
  decor: 7,
  landmark: 8,
  water_overlay: 9,
  overlay: 10,
};

const SEEDS = {
  groundDark: 101,
  groundPatch: 103,
  path: 201,
  waterStream: 301,
  waterPond: 303,
  bridge: 401,
  terrainOverlay: 501,
  terrainFeature: 503,
  roadPatch: 601,
  largeWaterPatch: 701,
  trees: 801,
  bushes: 803,
  landmarks: 805,
  flowers: 901,
  pebbles: 903,
  waterPebbles: 905,
  mushrooms: 907,
  rocks: 909,
  pottedTrees: 911,
  logs: 913,
  leaves: 915,
};

const WEIGHT_BY_FREQUENCY = {
  very_common: 10,
  common: 7,
  uncommon: 4,
  rare: 1.6,
  very_rare: 0.8,
};

const SCATTER_CHANCE_BY_FREQUENCY = {
  very_common: 0.05,
  common: 0.03,
  uncommon: 0.018,
  rare: 0.01,
  very_rare: 0.005,
};

const CLUSTER_CHANCE_BY_FREQUENCY = {
  very_common: 0.34,
  common: 0.28,
  uncommon: 0.18,
  rare: 0.08,
  very_rare: 0.04,
};

const PATCH_CHANCE_BY_FREQUENCY = {
  very_common: 0.2,
  common: 0.12,
  uncommon: 0.08,
  rare: 0.045,
  very_rare: 0.02,
};

const SCATTER_MULTIPLIER_BY_GROUP = {
  flowers: 1.35,
  pebbles: 1.1,
  mushrooms: 1.15,
  water_pebbles: 0.75,
  rocks: 0.5,
  potted_trees: 0.28,
  logs: 0.2,
};

const FULL_NEIGHBOR_RING_OFFSETS = Object.freeze([
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
]);

const FORBIDDEN_NEARBY_TERRAIN_RADIUS_TILES = 2;

const AUTOTILE_TEMPLATE_EXCLUSIONS_BY_TERRAIN = Object.freeze({
  [TERRAIN_TYPES.GRASS_LIGHT]: Object.freeze(["grass_light_on_grass_dark"]),
});

const STRONG_METADATA_JITTER_FAMILY_IDS = new Set([
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
  "variation_on_road",
]);

const LIGHT_OBJECT_JITTER_FAMILY_IDS = new Set(["fountain_loop"]);

const NO_METADATA_JITTER_FAMILY_IDS = new Set([
  "water_idle_sparkle_loop_a",
  "water_idle_sparkle_loop_b",
]);

const LEGACY_ROCK_EXCLUDED_NAME_PATTERN = /^(?:fence_post_|gate_piece_)/i;

let lastTerrainAutotileLogKey = null;
let lastObjectSpawnLogKey = null;
let lastWorldDecorLogKey = null;
let lastWorldDecorLogAt = 0;

function createAutotileCategoryCounts() {
  return Object.fromEntries(
    AUTOTILE_PATTERN_CATEGORY_KEYS.map((category) => [category, 0])
  );
}

function createTerrainAutotileStats() {
  return {
    totalResolved: 0,
    fallbackCount: 0,
    byCategory: createAutotileCategoryCounts(),
    byTemplate: {},
  };
}

function getTemplateAutotileStats(stats, templateId = "fallback") {
  if (!stats.byTemplate[templateId]) {
    stats.byTemplate[templateId] = {
      totalResolved: 0,
      fallbackCount: 0,
      byCategory: createAutotileCategoryCounts(),
    };
  }

  return stats.byTemplate[templateId];
}

function recordTerrainAutotileResolution(stats, resolvedTile) {
  const category = resolvedTile?.category || "full";
  const templateId = resolvedTile?.templateId || "fallback";
  const templateStats = getTemplateAutotileStats(stats, templateId);

  stats.totalResolved += 1;
  templateStats.totalResolved += 1;

  if (stats.byCategory[category] === undefined) {
    stats.byCategory[category] = 0;
  }
  if (templateStats.byCategory[category] === undefined) {
    templateStats.byCategory[category] = 0;
  }

  stats.byCategory[category] += 1;
  templateStats.byCategory[category] += 1;

  if (resolvedTile?.usedFallback) {
    stats.fallbackCount += 1;
    templateStats.fallbackCount += 1;
  }
}

function mergeTerrainAutotileStats(targetStats, sourceStats) {
  if (!sourceStats) return targetStats;

  targetStats.totalResolved += sourceStats.totalResolved || 0;
  targetStats.fallbackCount += sourceStats.fallbackCount || 0;

  Object.entries(sourceStats.byCategory || {}).forEach(([category, count]) => {
    if (targetStats.byCategory[category] === undefined) {
      targetStats.byCategory[category] = 0;
    }
    targetStats.byCategory[category] += count || 0;
  });

  Object.entries(sourceStats.byTemplate || {}).forEach(([templateId, templateStats]) => {
    const nextTemplateStats = getTemplateAutotileStats(targetStats, templateId);
    nextTemplateStats.totalResolved += templateStats.totalResolved || 0;
    nextTemplateStats.fallbackCount += templateStats.fallbackCount || 0;

    Object.entries(templateStats.byCategory || {}).forEach(([category, count]) => {
      if (nextTemplateStats.byCategory[category] === undefined) {
        nextTemplateStats.byCategory[category] = 0;
      }
      nextTemplateStats.byCategory[category] += count || 0;
    });
  });

  return targetStats;
}

function maybeLogTerrainAutotileStats(stats) {
  if (!import.meta.env.DEV || !SHOW_TERRAIN_AUTOTILE_DEBUG) return;

  const nextLogKey = JSON.stringify({
    totalResolved: stats.totalResolved,
    fallbackCount: stats.fallbackCount,
    byCategory: stats.byCategory,
    byTemplate: stats.byTemplate,
  });

  if (nextLogKey === lastTerrainAutotileLogKey) return;

  lastTerrainAutotileLogKey = nextLogKey;
  console.debug("[terrain-autotile-summary]", stats);
}

function getSharedTerrainSampler() {
  if (!sharedTerrainSampler) {
    sharedTerrainSampler = createTerrainSampler();
  }

  return sharedTerrainSampler;
}

function createObjectSpawnStats() {
  return {
    attempted: 0,
    placed: 0,
    rejected: {
      invalid_terrain: 0,
      water: 0,
      non_full_autotile: 0,
      spawn_rule: 0,
      collision_overlap: 0,
    },
  };
}

function recordObjectSpawnAttempt(stats) {
  if (!stats) return;
  stats.attempted += 1;
}

function recordObjectSpawnPlaced(stats) {
  if (!stats) return;
  stats.placed += 1;
}

function recordObjectSpawnRejected(stats, reason) {
  if (!stats || !reason) return;
  if (stats.rejected[reason] === undefined) {
    stats.rejected[reason] = 0;
  }
  stats.rejected[reason] += 1;
}

function mergeObjectSpawnStats(targetStats, sourceStats) {
  if (!sourceStats) return targetStats;

  targetStats.attempted += sourceStats.attempted || 0;
  targetStats.placed += sourceStats.placed || 0;

  Object.entries(sourceStats.rejected || {}).forEach(([reason, count]) => {
    if (targetStats.rejected[reason] === undefined) {
      targetStats.rejected[reason] = 0;
    }
    targetStats.rejected[reason] += count || 0;
  });

  return targetStats;
}

function maybeLogObjectSpawnStats(stats) {
  if (!import.meta.env.DEV || !SHOW_OBJECT_SPAWN_DEBUG) return;

  const nextLogKey = JSON.stringify(stats);
  if (nextLogKey === lastObjectSpawnLogKey) return;

  lastObjectSpawnLogKey = nextLogKey;
  console.debug("[world-object-spawn-summary]", stats);
}

function createWorldDecorStats() {
  return {
    totalPlaced: 0,
    animationPlaced: 0,
    candidateAttempts: 0,
    exactOverlapChecks: 0,
    occupiedCellCount: 0,
    eligiblePoolSizes: {},
    waterCellCount: 0,
    fullWaterCellCount: 0,
    waterPatchCount: 0,
    treeCount: 0,
    treeScaleTotal: 0,
    treeScaleMin: null,
    treeScaleMax: null,
    byFamily: {},
    rejected: {
      forbidden_terrain: 0,
      non_full_autotile: 0,
      too_close: 0,
      chunk_cap: 0,
      chunk_total_cap: 0,
      chunk_animation_cap: 0,
      overlap: 0,
      near_requirement: 0,
      window_cap: 0,
      disabled: 0,
    },
    skipped: {
      empty_pool: 0,
      occupied_pool: 0,
      budget: 0,
    },
    sampleIds: [],
    // Village exclusion counters
    villageExcludedCells: 0,
    metadataCellsSkippedByVillage: 0,
    placementCallsAvoided: 0,
    villageChunkEarlyOut: false,
  };
}

function getWorldDecorFamilyStats(stats, familyId) {
  if (!stats.byFamily[familyId]) {
    stats.byFamily[familyId] = {
      placed: 0,
      rejected: {},
    };
  }

  return stats.byFamily[familyId];
}

function recordWorldDecorPlaced(stats, familyId, itemId) {
  let options = {};
  if (typeof itemId === "object" && itemId !== null) {
    options = itemId;
    itemId = options.itemId || null;
  }
  if (!stats || !familyId) return;

  stats.totalPlaced += 1;
  if (options.isAnimation) {
    stats.animationPlaced += 1;
  }
  getWorldDecorFamilyStats(stats, familyId).placed += 1;

  if (itemId && stats.sampleIds.length < 12) {
    stats.sampleIds.push(itemId);
  }
}

function recordWorldDecorRejected(stats, familyId, reason) {
  if (!stats || !familyId || !reason) return;

  if (stats.rejected[reason] === undefined) {
    stats.rejected[reason] = 0;
  }
  stats.rejected[reason] += 1;

  const familyStats = getWorldDecorFamilyStats(stats, familyId);
  if (familyStats.rejected[reason] === undefined) {
    familyStats.rejected[reason] = 0;
  }
  familyStats.rejected[reason] += 1;
}

function recordWorldDecorSkipped(stats, familyId, reason, amount = 1) {
  if (!stats || !reason || amount <= 0) return;

  if (stats.skipped[reason] === undefined) {
    stats.skipped[reason] = 0;
  }
  stats.skipped[reason] += amount;

  if (!familyId) return;

  const familyStats = getWorldDecorFamilyStats(stats, familyId);
  if (!familyStats.skipped) {
    familyStats.skipped = {};
  }
  if (familyStats.skipped[reason] === undefined) {
    familyStats.skipped[reason] = 0;
  }
  familyStats.skipped[reason] += amount;
}

function recordWorldDecorCandidateAttempt(stats, count = 1) {
  if (!stats || !Number.isFinite(count) || count <= 0) return;
  stats.candidateAttempts += count;
}

function recordWorldDecorExactOverlapCheck(stats, count = 1) {
  if (!stats || !Number.isFinite(count) || count <= 0) return;
  stats.exactOverlapChecks += count;
}

function recordWorldDecorEligiblePoolSize(stats, poolKey, count) {
  if (!stats || !poolKey || !Number.isFinite(count) || count < 0) return;
  if (stats.eligiblePoolSizes[poolKey] === undefined) {
    stats.eligiblePoolSizes[poolKey] = 0;
  }
  stats.eligiblePoolSizes[poolKey] += count;
}

function recordWorldDecorOccupiedCells(stats, count) {
  if (!stats || !Number.isFinite(count) || count <= 0) return;
  stats.occupiedCellCount += count;
}

function recordWorldDecorFullWaterCells(stats, count) {
  if (!stats || !Number.isFinite(count) || count <= 0) return;
  stats.fullWaterCellCount += count;
}

function recordWorldDecorTerrainStats(stats, cells) {
  if (!stats || !cells?.size) return;

  const visited = new Set();
  let waterCellCount = 0;
  let waterPatchCount = 0;

  const enqueueNeighbors = (queue, gridX, gridY) => {
    queue.push([gridX - 1, gridY]);
    queue.push([gridX + 1, gridY]);
    queue.push([gridX, gridY - 1]);
    queue.push([gridX, gridY + 1]);
  };

  cells.forEach((cell) => {
    if (cell.terrainType === TERRAIN_TYPES.WATER) {
      waterCellCount += 1;
    }
  });

  cells.forEach((cell) => {
    if (cell.terrainType !== TERRAIN_TYPES.WATER) return;

    const startKey = getCellKey(cell.gridX, cell.gridY);
    if (visited.has(startKey)) return;

    waterPatchCount += 1;
    const queue = [[cell.gridX, cell.gridY]];

    while (queue.length) {
      const [gridX, gridY] = queue.pop();
      const key = getCellKey(gridX, gridY);
      if (visited.has(key)) continue;

      const nextCell = getCell(cells, gridX, gridY);
      if (!nextCell || nextCell.terrainType !== TERRAIN_TYPES.WATER) {
        continue;
      }

      visited.add(key);
      enqueueNeighbors(queue, gridX, gridY);
    }
  });

  stats.waterCellCount += waterCellCount;
  stats.waterPatchCount += waterPatchCount;
}

function recordWorldDecorTreeStats(stats, treeItems) {
  if (!stats || !Array.isArray(treeItems) || !treeItems.length) return;

  treeItems.forEach((treeItem) => {
    stats.treeCount += 1;
    stats.treeScaleTotal += treeItem.scale || 0;
    stats.treeScaleMin =
      stats.treeScaleMin === null
        ? treeItem.scale || 0
        : Math.min(stats.treeScaleMin, treeItem.scale || 0);
    stats.treeScaleMax =
      stats.treeScaleMax === null
        ? treeItem.scale || 0
        : Math.max(stats.treeScaleMax, treeItem.scale || 0);
  });
}

function mergeWorldDecorStats(targetStats, sourceStats) {
  if (!sourceStats) return targetStats;

  targetStats.totalPlaced += sourceStats.totalPlaced || 0;
  targetStats.animationPlaced += sourceStats.animationPlaced || 0;
  targetStats.candidateAttempts += sourceStats.candidateAttempts || 0;
  targetStats.exactOverlapChecks += sourceStats.exactOverlapChecks || 0;
  targetStats.occupiedCellCount += sourceStats.occupiedCellCount || 0;
  targetStats.waterCellCount += sourceStats.waterCellCount || 0;
  targetStats.fullWaterCellCount += sourceStats.fullWaterCellCount || 0;
  targetStats.waterPatchCount += sourceStats.waterPatchCount || 0;
  targetStats.treeCount += sourceStats.treeCount || 0;
  targetStats.treeScaleTotal += sourceStats.treeScaleTotal || 0;
  targetStats.treeScaleMin =
    targetStats.treeScaleMin === null
      ? sourceStats.treeScaleMin
      : sourceStats.treeScaleMin === null
        ? targetStats.treeScaleMin
        : Math.min(targetStats.treeScaleMin, sourceStats.treeScaleMin);
  targetStats.treeScaleMax =
    targetStats.treeScaleMax === null
      ? sourceStats.treeScaleMax
      : sourceStats.treeScaleMax === null
        ? targetStats.treeScaleMax
        : Math.max(targetStats.treeScaleMax, sourceStats.treeScaleMax);

  Object.entries(sourceStats.rejected || {}).forEach(([reason, count]) => {
    if (targetStats.rejected[reason] === undefined) {
      targetStats.rejected[reason] = 0;
    }
    targetStats.rejected[reason] += count || 0;
  });

  Object.entries(sourceStats.skipped || {}).forEach(([reason, count]) => {
    if (targetStats.skipped[reason] === undefined) {
      targetStats.skipped[reason] = 0;
    }
    targetStats.skipped[reason] += count || 0;
  });

  Object.entries(sourceStats.eligiblePoolSizes || {}).forEach(([poolKey, count]) => {
    if (targetStats.eligiblePoolSizes[poolKey] === undefined) {
      targetStats.eligiblePoolSizes[poolKey] = 0;
    }
    targetStats.eligiblePoolSizes[poolKey] += count || 0;
  });

  Object.entries(sourceStats.byFamily || {}).forEach(([familyId, familyStats]) => {
    const nextFamilyStats = getWorldDecorFamilyStats(targetStats, familyId);
    nextFamilyStats.placed += familyStats.placed || 0;

    Object.entries(familyStats.rejected || {}).forEach(([reason, count]) => {
      if (nextFamilyStats.rejected[reason] === undefined) {
        nextFamilyStats.rejected[reason] = 0;
      }
      nextFamilyStats.rejected[reason] += count || 0;
    });

    Object.entries(familyStats.skipped || {}).forEach(([reason, count]) => {
      if (!nextFamilyStats.skipped) {
        nextFamilyStats.skipped = {};
      }
      if (nextFamilyStats.skipped[reason] === undefined) {
        nextFamilyStats.skipped[reason] = 0;
      }
      nextFamilyStats.skipped[reason] += count || 0;
    });
  });

  sourceStats.sampleIds?.forEach((itemId) => {
    if (targetStats.sampleIds.length < 12 && !targetStats.sampleIds.includes(itemId)) {
      targetStats.sampleIds.push(itemId);
    }
  });

  return targetStats;
}

function maybeLogWorldDecorStats(stats) {
  if (!import.meta.env.DEV || !getWorldDebugFlags().showWorldDecorDebug) return;

  const now =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();

  const debugSummary = {
    ...stats,
    animationFamilies: Object.fromEntries(
      Object.entries(stats.byFamily || {})
        .filter(([familyId]) => familyId.includes("loop") || familyId.includes("sparkle"))
        .map(([familyId, familyStats]) => [familyId, familyStats.placed || 0])
    ),
    treeScaleAverage:
      stats.treeCount > 0 ? stats.treeScaleTotal / stats.treeCount : 0,
  };
  const nextLogKey = JSON.stringify(debugSummary);
  if (nextLogKey === lastWorldDecorLogKey && now - lastWorldDecorLogAt < 1000) return;

  lastWorldDecorLogKey = nextLogKey;
  lastWorldDecorLogAt = now;
  console.debug("[world-decor-summary]", debugSummary);
}

function normalizeViewport(viewport = DEFAULT_VIEWPORT) {
  return {
    width: Math.max(1, Math.ceil(viewport.width || DEFAULT_VIEWPORT.width)),
    height: Math.max(1, Math.ceil(viewport.height || DEFAULT_VIEWPORT.height)),
  };
}

function trimCache(cache, maxEntries = 20) {
  if (cache.size <= maxEntries) return;

  const oldestKey = cache.keys().next().value;
  cache.delete(oldestKey);
}

function getLayoutCache(atlasData) {
  const cached = layoutCacheByAtlas.get(atlasData);
  if (cached) return cached;

  const nextCache = new Map();
  layoutCacheByAtlas.set(atlasData, nextCache);

  return nextCache;
}

function getChunkCache(atlasData) {
  const cached = chunkCacheByAtlas.get(atlasData);
  if (cached) return cached;

  const nextCache = new Map();
  chunkCacheByAtlas.set(atlasData, nextCache);

  return nextCache;
}

function getChunkStats(atlasData) {
  const cached = chunkStatsByAtlas.get(atlasData);
  if (cached) return cached;

  const nextStats = {
    generatedChunks: 0,
    chunkCacheHits: 0,
    chunkCacheMisses: 0,
    layoutCacheHits: 0,
    layoutCacheMisses: 0,
    lastChunkDurationMs: 0,
    lastBatchDurationMs: 0,
    lastBatchGeneratedCount: 0,
    lastTerrainDurationMs: 0,
    lastObjectDurationMs: 0,
    lastDecorDurationMs: 0,
    lastSortDurationMs: 0,
    lastCombinedLayoutDurationMs: 0,
    lastVisibleBudgetDurationMs: 0,
  };
  chunkStatsByAtlas.set(atlasData, nextStats);

  return nextStats;
}

export function resetWorldAtlasCaches(atlasData) {
  if (!atlasData) return;

  layoutCacheByAtlas.delete(atlasData);
  chunkCacheByAtlas.delete(atlasData);
  chunkStatsByAtlas.delete(atlasData);
  contentCache.delete(atlasData);
  decorVisibilityStateByAtlas.delete(atlasData);
}

function getChunkPixelSize() {
  return CHUNK_TILE_SIZE * WORLD_ATLAS_TILE_SIZE;
}

function getChunkBounds(chunkX, chunkY) {
  const size = getChunkPixelSize();
  const left = chunkX * size;
  const top = chunkY * size;

  return {
    left,
    right: left + size,
    top,
    bottom: top + size,
  };
}

function getChunkKey(chunkX, chunkY) {
  return `${chunkX},${chunkY}`;
}

function getAtlasContent(atlasData) {
  const cached = contentCache.get(atlasData);
  if (cached) return cached;

  const rules = getAtlasRules(atlasData);
  const allTreeEntries = getGroupEntries(atlasData, "trees");
  const primaryWorldTreeEntries = allTreeEntries.filter((entry) =>
    hasAtlasTag(entry, WORLD_ATLAS_PRIMARY_TREE_TAG)
  );

  const terrainEntries = getGroupEntries(atlasData, "terrain");
  const terrainFeatureEntries = getGroupEntries(atlasData, "terrain_features");
  const waterEntries = getGroupEntries(atlasData, "water");
  const bridgeEntries = getGroupEntries(atlasData, "bridges");
  const landmarkEntries = getGroupEntries(atlasData, "landmarks");

  const dominantGroundEntries = (rules.dominantGround || [])
    .map((name) => getAtlasEntry(atlasData, name))
    .filter(Boolean);

  const baseGroundEntries =
    dominantGroundEntries.length > 0
      ? dominantGroundEntries
      : terrainEntries.filter((entry) => entry.category === "ground_base");

  const singleCellTerrain = terrainEntries.filter(
    (entry) => getEntryCellWidth(entry) === 1 && getEntryCellHeight(entry) === 1
  );

  const darkGroundEntries = singleCellTerrain.filter(
    (entry) =>
      hasAtlasTag(entry, "grass_dark") || entry.family === "grass_base_dark"
  );

  const terrainOverlayEntries = terrainEntries.filter(
    (entry) =>
      !baseGroundEntries.some((baseEntry) => baseEntry.name === entry.name) &&
      (getEntryCellWidth(entry) > 1 ||
        getEntryCellHeight(entry) > 1 ||
        entry.category === "terrain_variation")
  );

  const waterPriorityEntries = (rules.waterPriority || [])
    .map((name) => getAtlasEntry(atlasData, name))
    .filter(Boolean);

  const waterFlowTopEntry =
    waterPriorityEntries[0] || getAtlasEntry(atlasData, "water_flow_strip_05");

  const highPriorityWaterEntries = waterPriorityEntries.slice(1);

  const largeWaterEntries = waterEntries.filter(
    (entry) =>
      entry.name !== waterFlowTopEntry?.name &&
      (entry.render?.layer === "water" || entry.render?.layer === "feature") &&
      (getEntryCellWidth(entry) > 1 || getEntryCellHeight(entry) > 1)
  );

  const regularWaterEntries = waterEntries.filter(
    (entry) =>
      entry.name !== waterFlowTopEntry?.name &&
      !highPriorityWaterEntries.some((priorityEntry) => priorityEntry.name === entry.name) &&
      entry.render?.layer === "water" &&
      getEntryCellWidth(entry) === 1 &&
      getEntryCellHeight(entry) === 1
  );

  const content = {
    rules,
    baseGroundEntries,
    darkGroundEntries,
    terrainOverlayEntries,
    terrainFeaturesWalkable: terrainFeatureEntries.filter(
      (entry) => !entry.collision?.blocksMovement
    ),
    terrainFeaturesBlocking: terrainFeatureEntries.filter((entry) =>
      entry.collision?.blocksMovement
    ),
    pathTiles: getGroupEntries(atlasData, "paths"),
    roadPatches: getGroupEntries(atlasData, "roads"),
    regularWaterEntries,
    highPriorityWaterEntries,
    largeWaterEntries,
    waterFlowTopEntry,
    bridgeHorizontalEntry:
      bridgeEntries.find((entry) => getEntryCellWidth(entry) > getEntryCellHeight(entry)) ||
      bridgeEntries[0] ||
      null,
    bridgeVerticalEntry:
      bridgeEntries.find((entry) => getEntryCellHeight(entry) > getEntryCellWidth(entry)) ||
      bridgeEntries[0] ||
      null,
    trees: primaryWorldTreeEntries.length ? primaryWorldTreeEntries : allTreeEntries,
    bushes: getGroupEntries(atlasData, "bushes"),
    flowers: getGroupEntries(atlasData, "flowers"),
    pebbles: getGroupEntries(atlasData, "pebbles"),
    waterPebbles: getGroupEntries(atlasData, "water_pebbles"),
    mushrooms: getGroupEntries(atlasData, "mushrooms"),
    rocks: getGroupEntries(atlasData, "rocks").filter(isLegacyRockSpawnEntry),
    pottedTrees: getGroupEntries(atlasData, "potted_trees"),
    logs: getGroupEntries(atlasData, "logs"),
    landmarkObjects: landmarkEntries.filter(
      (entry) => entry.render?.layer === "landmark"
    ),
    landmarkOverlays: landmarkEntries.filter(
      (entry) => entry.render?.layer === "overlay"
    ),
    leaves: getGroupEntries(atlasData, "leaves"),
  };

  contentCache.set(atlasData, content);
  return content;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, y, seed = 0, scale = 0.08) {
  const nx = x * scale;
  const ny = y * scale;

  const x0 = Math.floor(nx);
  const x1 = x0 + 1;
  const y0 = Math.floor(ny);
  const y1 = y0 + 1;

  const sx = smoothstep(nx - x0);
  const sy = smoothstep(ny - y0);

  const n00 = hashUnit(seed, x0, y0);
  const n10 = hashUnit(seed, x1, y0);
  const n01 = hashUnit(seed, x0, y1);
  const n11 = hashUnit(seed, x1, y1);

  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy);
}

function getViewportBounds(playerX, playerY, viewport, padding = WORLD_ATLAS_VIEW_PADDING) {
  const { width, height } = normalizeViewport(viewport);
  const halfWidth = width / 2 + padding;
  const halfHeight = height / 2 + padding;

  return {
    left: playerX - halfWidth,
    right: playerX + halfWidth,
    top: playerY - halfHeight,
    bottom: playerY + halfHeight,
  };
}

function isLegacyRockSpawnEntry(entry) {
  const entryName = String(entry?.name || entry?.originalName || "").trim();
  if (!entryName) {
    return false;
  }

  return !LEGACY_ROCK_EXCLUDED_NAME_PATTERN.test(entryName);
}

function pointInBounds(x, y, bounds) {
  return (
    x >= bounds.left &&
    x <= bounds.right &&
    y >= bounds.top &&
    y <= bounds.bottom
  );
}

function createCellBounds(bounds, cellSize) {
  return {
    startX: Math.floor(bounds.left / cellSize),
    endX: Math.ceil(bounds.right / cellSize),
    startY: Math.floor(bounds.top / cellSize),
    endY: Math.ceil(bounds.bottom / cellSize),
  };
}

function getChunkRangeFromBounds(bounds) {
  const chunkPixelSize = getChunkPixelSize();

  return {
    minChunkX: Math.floor(bounds.left / chunkPixelSize),
    maxChunkX: Math.floor((bounds.right - 1) / chunkPixelSize),
    minChunkY: Math.floor(bounds.top / chunkPixelSize),
    maxChunkY: Math.floor((bounds.bottom - 1) / chunkPixelSize),
  };
}

function expandChunkRange(range, radiusX, radiusY) {
  return {
    minChunkX: range.minChunkX - radiusX,
    maxChunkX: range.maxChunkX + radiusX,
    minChunkY: range.minChunkY - radiusY,
    maxChunkY: range.maxChunkY + radiusY,
  };
}

function forEachChunkInRange(range, iteratee) {
  for (let chunkX = range.minChunkX; chunkX <= range.maxChunkX; chunkX += 1) {
    for (let chunkY = range.minChunkY; chunkY <= range.maxChunkY; chunkY += 1) {
      iteratee(chunkX, chunkY);
    }
  }
}

function chunkInRange(range, chunkX, chunkY) {
  return (
    chunkX >= range.minChunkX &&
    chunkX <= range.maxChunkX &&
    chunkY >= range.minChunkY &&
    chunkY <= range.maxChunkY
  );
}

function getChunkWindow(playerX, playerY, viewport = DEFAULT_VIEWPORT) {
  const viewportBounds = getViewportBounds(playerX, playerY, viewport, 0);
  const activePadding =
    (WORLD_ACTIVE_BUFFER_TILES + RENDER_OVERSCAN_TILES) * WORLD_ATLAS_TILE_SIZE;
  const despawnPadding =
    (WORLD_DESPAWN_BUFFER_TILES + RENDER_OVERSCAN_TILES) * WORLD_ATLAS_TILE_SIZE;
  const activeBounds = getViewportBounds(playerX, playerY, viewport, activePadding);
  const despawnBounds = getViewportBounds(playerX, playerY, viewport, despawnPadding);
  const collisionBounds = getViewportBounds(
    playerX,
    playerY,
    viewport,
    Math.max(activePadding, COLLISION_OVERSCAN_TILES * WORLD_ATLAS_TILE_SIZE)
  );
  const visibleChunkRange = getChunkRangeFromBounds(viewportBounds);
  const activeChunkRange = expandChunkRange(
    getChunkRangeFromBounds(activeBounds),
    ACTIVE_RADIUS_X,
    ACTIVE_RADIUS_Y
  );
  const preloadChunkRange = expandChunkRange(
    getChunkRangeFromBounds(despawnBounds),
    PRELOAD_RADIUS_X,
    PRELOAD_RADIUS_Y
  );
  const despawnChunkRange = expandChunkRange(
    preloadChunkRange,
    DESPAWN_MARGIN,
    DESPAWN_MARGIN
  );

  return {
    viewportBounds,
    activeBounds,
    despawnBounds,
    collisionBounds,
    visibleChunkRange,
    activeChunkRange,
    preloadChunkRange,
    despawnChunkRange,
  };
}

export function getWorldAtlasLayoutKey(playerX, playerY, viewport = DEFAULT_VIEWPORT) {
  const normalizedViewport = normalizeViewport(viewport);
  const chunkWindow = getChunkWindow(playerX, playerY, normalizedViewport);

  return [
    normalizedViewport.width,
    normalizedViewport.height,
    chunkWindow.activeChunkRange.minChunkX,
    chunkWindow.activeChunkRange.maxChunkX,
    chunkWindow.activeChunkRange.minChunkY,
    chunkWindow.activeChunkRange.maxChunkY,
  ].join("|");
}

function getCellKey(gridX, gridY) {
  // Integer packing — matches worldTerrainGeneratorCore.js getCellKey exactly.
  return gridX * 100003 + gridY;
}

function getRenderableAnimation(entry) {
  if (!entry.special?.animation) return null;

  const animation = entry.special.animation;
  const frameCount = animation.frameCount || animation.frames?.length || 1;
  const frameWidth =
    animation.frameWidth || Math.max(1, Math.floor(entry.width / frameCount));
  const frameHeight = animation.frameHeight || entry.height;

  return {
    frameCount,
    frameWidth,
    frameHeight,
    frames: Array.isArray(animation.frames) ? animation.frames : null,
    loop: animation.loop !== false,
    playOnce: Boolean(animation.playOnce),
    verticalDrift: Boolean(animation.verticalDrift),
    fps: Number.isFinite(animation.fps) && animation.fps > 0 ? animation.fps : 8,
    ticksPerFrame:
      Number.isFinite(animation.ticksPerFrame) && animation.ticksPerFrame > 0
        ? animation.ticksPerFrame
        : Math.max(
            1,
            Math.round((1000 / (animation.fps || 8)) / 125)
          ),
  };
}

function getRenderableWidth(entry) {
  return getRenderableAnimation(entry)?.frameWidth || entry.width;
}

function getRenderableHeight(entry) {
  return getRenderableAnimation(entry)?.frameHeight || entry.height;
}

function getEntryCellWidth(entry) {
  return entry.tileW || Math.max(1, Math.round(getRenderableWidth(entry) / 16));
}

function getEntryCellHeight(entry) {
  return entry.tileH || Math.max(1, Math.round(getRenderableHeight(entry) / 16));
}

function getSelectionWeight(entry) {
  return WEIGHT_BY_FREQUENCY[entry.spawn?.frequency] || 1;
}

function chooseWeightedEntry(entries, ...seedParts) {
  if (!entries.length) return null;

  const totalWeight = entries.reduce(
    (sum, entry) => sum + getSelectionWeight(entry),
    0
  );

  let cursor = hashUnit(...seedParts) * totalWeight;

  for (const entry of entries) {
    cursor -= getSelectionWeight(entry);
    if (cursor <= 0) return entry;
  }

  return entries[entries.length - 1];
}

function getBasePlacementChance(entry, lookupTable, multiplier = 1) {
  const frequency = entry.spawn?.frequency || "common";
  return (lookupTable[frequency] || 0.01) * multiplier;
}

function getSectorSizePixels(entry) {
  return Math.max(
    WORLD_ATLAS_TILE_SIZE,
    Math.round(getObjectPlacementProfile(entry).sectorSizeTiles * WORLD_ATLAS_TILE_SIZE)
  );
}

function createPlacementState() {
  return {
    bucketSize: WORLD_ATLAS_TILE_SIZE,
    buckets: new Map(),
  };
}

function getPlacementBucketKey(bucketX, bucketY) {
  return bucketX * 100003 + bucketY;
}

function getPlacementBucketCoords(state, worldX, worldY) {
  return {
    bucketX: Math.floor(worldX / state.bucketSize),
    bucketY: Math.floor(worldY / state.bucketSize),
  };
}

function isPlacementReserved(state, worldX, worldY, radius) {
  const { bucketX, bucketY } = getPlacementBucketCoords(state, worldX, worldY);
  const bucketRadius = Math.max(1, Math.ceil(radius / state.bucketSize));

  for (let x = bucketX - bucketRadius; x <= bucketX + bucketRadius; x += 1) {
    for (let y = bucketY - bucketRadius; y <= bucketY + bucketRadius; y += 1) {
      const bucket = state.buckets.get(getPlacementBucketKey(x, y));
      if (!bucket) continue;

      for (const placement of bucket) {
        const minDistance = radius + placement.radius;
        const dx = placement.x - worldX;
        const dy = placement.y - worldY;
        if (dx * dx + dy * dy < minDistance * minDistance) {
          return true;
        }
      }
    }
  }

  return false;
}

function reservePlacement(state, worldX, worldY, radius) {
  const { bucketX, bucketY } = getPlacementBucketCoords(state, worldX, worldY);
  const key = getPlacementBucketKey(bucketX, bucketY);
  const bucket = state.buckets.get(key);

  if (bucket) {
    bucket.push({ x: worldX, y: worldY, radius });
    return;
  }

  state.buckets.set(key, [{ x: worldX, y: worldY, radius }]);
}

function getPlacementRadius(entry) {
  return (
    getObjectPlacementProfile(entry).minDistanceTiles *
    WORLD_ATLAS_TILE_SIZE
  );
}

function getCellCoordinatesForBasePoint(baseX, baseY) {
  return {
    gridX: Math.floor(baseX / WORLD_ATLAS_TILE_SIZE),
    gridY: Math.floor((baseY - 1) / WORLD_ATLAS_TILE_SIZE),
  };
}

function canPlaceEntryAtBasePoint(entry, cells, baseX, baseY, spawnStats = null) {
  const { gridX, gridY } = getCellCoordinatesForBasePoint(baseX, baseY);
  return canPlaceEntryOnCell(entry, cells, gridX, gridY, spawnStats);
}

function getSectorBounds(cellBounds, sectorSizePixels) {
  const tileSize = WORLD_ATLAS_TILE_SIZE;
  const bounds = {
    left: cellBounds.startX * tileSize,
    right: (cellBounds.endX + 1) * tileSize,
    top: cellBounds.startY * tileSize,
    bottom: (cellBounds.endY + 1) * tileSize,
  };

  return {
    startX: Math.floor(bounds.left / sectorSizePixels) - 1,
    endX: Math.ceil(bounds.right / sectorSizePixels) + 1,
    startY: Math.floor(bounds.top / sectorSizePixels) - 1,
    endY: Math.ceil(bounds.bottom / sectorSizePixels) + 1,
    pixelBounds: bounds,
  };
}

function getClusterCenterFromSector(entry, sectorX, sectorY, seedKey) {
  const sectorSizePixels = getSectorSizePixels(entry);
  const x =
    sectorX * sectorSizePixels +
    hashUnit(seedKey, "cluster-cx", entry.name, sectorX, sectorY) * sectorSizePixels;
  const y =
    sectorY * sectorSizePixels +
    hashUnit(seedKey, "cluster-cy", entry.name, sectorX, sectorY) * sectorSizePixels;

  return { x, y };
}

function clampBasePointToBounds(point, cellBounds) {
  const minX = cellBounds.startX * WORLD_ATLAS_TILE_SIZE + 2;
  const maxX = (cellBounds.endX + 1) * WORLD_ATLAS_TILE_SIZE - 2;
  const minY = cellBounds.startY * WORLD_ATLAS_TILE_SIZE + 2;
  const maxY = (cellBounds.endY + 1) * WORLD_ATLAS_TILE_SIZE - 2;

  return {
    x: Math.max(minX, Math.min(maxX, point.x)),
    y: Math.max(minY, Math.min(maxY, point.y)),
  };
}

function projectRawPointToDecorBase(entry, rawX, rawY, seedKey, salt = 0) {
  const profile = getObjectPlacementProfile(entry);
  const gridX = Math.floor(rawX / WORLD_ATLAS_TILE_SIZE);
  const gridY = Math.floor(rawY / WORLD_ATLAS_TILE_SIZE);
  const cellX = gridX * WORLD_ATLAS_TILE_SIZE;
  const cellY = gridY * WORLD_ATLAS_TILE_SIZE;
  const [yBandStart = 0.64, yBandEnd = 0.95] = profile.yBand || [];
  const xJitter = Math.min(0.92, profile.xJitterTiles || 0.45);

  return {
    x:
      cellX +
      WORLD_ATLAS_TILE_SIZE *
        (0.5 +
          (hashUnit(seedKey, "base-x", entry.name, gridX, gridY, salt) - 0.5) *
            xJitter *
            2),
    y:
      cellY +
      WORLD_ATLAS_TILE_SIZE *
        (yBandStart +
          hashUnit(seedKey, "base-y", entry.name, gridX, gridY, salt) *
            Math.max(0.05, yBandEnd - yBandStart)),
  };
}

function getScatterPointInSector(entry, sectorX, sectorY, seedKey, index = 0) {
  const sectorSizePixels = getSectorSizePixels(entry);
  const rawX =
    sectorX * sectorSizePixels +
    hashUnit(seedKey, "raw-x", entry.name, sectorX, sectorY, index) * sectorSizePixels;
  const rawY =
    sectorY * sectorSizePixels +
    hashUnit(seedKey, "raw-y", entry.name, sectorX, sectorY, index) * sectorSizePixels;

  return projectRawPointToDecorBase(entry, rawX, rawY, seedKey, index);
}

function getClusterPointAroundCenter(entry, centerX, centerY, seedKey, index, radiusPixels) {
  const angle =
    hashUnit(seedKey, "cluster-angle", entry.name, Math.round(centerX), Math.round(centerY), index) *
    Math.PI *
    2;
  const radius =
    Math.sqrt(
      hashUnit(
        seedKey,
        "cluster-radius",
        entry.name,
        Math.round(centerX),
        Math.round(centerY),
        index
      )
    ) * radiusPixels;

  return projectRawPointToDecorBase(
    entry,
    centerX + Math.cos(angle) * radius,
    centerY + Math.sin(angle) * radius,
    seedKey,
    index
  );
}

function getScatterDensityMultiplier(entry, seedKey, sectorX, sectorY) {
  const profile = getObjectPlacementProfile(entry);
  const noiseScale = profile.pocketScale || 0.08;
  const noiseValue = valueNoise(sectorX, sectorY, seedKey, noiseScale);
  const pocketBoost = profile.pocketBoost || 1;

  return 0.65 + noiseValue * pocketBoost;
}

function markContextAroundBasePoint(cells, baseX, baseY, context, radius = 3) {
  const { gridX, gridY } = getCellCoordinatesForBasePoint(baseX, baseY);

  for (let x = gridX - radius; x <= gridX + radius; x += 1) {
    for (let y = gridY - radius; y <= gridY + radius; y += 1) {
      const nearbyCell = getCell(cells, x, y);
      if (!nearbyCell) continue;
      addCellContext(nearbyCell, context);
    }
  }
}

function getTreeSplitDepth(entry) {
  if (!hasAtlasTag(entry, "tree")) return 0;
  if (hasAtlasTag(entry, "stump")) return 0;
  // Atlas trees render as a single unsplit sprite in the front layer.
  if (hasAtlasTag(entry, WORLD_ATLAS_PRIMARY_TREE_TAG)) return 0;
  return hasAtlasTag(entry, "tall_tree") ? 58 : 64;
}

function createBaseCell(gridX, gridY, baseEntry) {
  return {
    id: getCellKey(gridX, gridY),
    gridX,
    gridY,
    x: gridX * WORLD_ATLAS_TILE_SIZE,
    y: gridY * WORLD_ATLAS_TILE_SIZE,
    surface: "grass",
    contexts: new Set(["grass", "ground"]),
    baseEntry,
    pathIntent: false,
    blocked: false,
    walkableOverride: false,
    bridge: false,
  };
}

function createTerrainCell(gridX, gridY, terrainType) {
  const walkable = isTerrainWalkable(terrainType);
  const surface = walkable ? "grass" : "water";
  const contexts = new Set([terrainType, surface]);

  if (walkable) {
    contexts.add("ground");
  } else {
    contexts.add("contains_water");
  }

  return {
    id: getCellKey(gridX, gridY),
    gridX,
    gridY,
    x: gridX * WORLD_ATLAS_TILE_SIZE,
    y: gridY * WORLD_ATLAS_TILE_SIZE,
    surface,
    terrainType,
    terrainWalkable: walkable,
    contexts,
    baseEntry: null,
    pathIntent: false,
    blocked: !walkable,
    walkableOverride: false,
    bridge: false,
    autotile: null,
  };
}

function setPrimarySurface(cell, surface) {
  ["grass", "path", "road", "water", "bridge"].forEach((value) =>
    cell.contexts.delete(value)
  );

  cell.surface = surface;
  cell.contexts.add(surface);

  if (surface === "grass") {
    cell.contexts.add("ground");
  }
}

function addCellContext(cell, context) {
  cell.contexts.add(context);
}

function hasCellContext(cell, context) {
  return Boolean(cell && (cell.surface === context || cell.contexts.has(context)));
}

function getCell(cells, gridX, gridY) {
  return cells.get(getCellKey(gridX, gridY)) || null;
}

function getFootprintCells(entry, anchorX, anchorY) {
  const cellWidth = getEntryCellWidth(entry);
  const cellHeight = getEntryCellHeight(entry);
  const cells = [];

  for (let offsetX = 0; offsetX < cellWidth; offsetX += 1) {
    for (let offsetY = 0; offsetY < cellHeight; offsetY += 1) {
      cells.push([anchorX + offsetX, anchorY + offsetY]);
    }
  }

  return cells;
}

function matchesSurfaceRule(entry, cell) {
  const surfaces = entry.spawn?.surfaces || [];
  if (!surfaces.length) return true;

  return surfaces.some((surface) => hasCellContext(cell, surface));
}

function matchesAvoidRule(entry, cell) {
  const avoid = entry.spawn?.avoid || [];
  return !avoid.some((avoidContext) => hasCellContext(cell, avoidContext));
}

function hasNearbyContext(cells, gridX, gridY, context, radius = 2) {
  for (let x = gridX - radius; x <= gridX + radius; x += 1) {
    for (let y = gridY - radius; y <= gridY + radius; y += 1) {
      if (x === gridX && y === gridY) continue;
      if (hasCellContext(getCell(cells, x, y), context)) return true;
    }
  }

  return false;
}

function matchesNearRule(entry, cells, gridX, gridY) {
  const near = entry.spawn?.near || [];
  if (!near.length) return true;

  const currentCell = getCell(cells, gridX, gridY);

  return near.some((nearContext) => {
    if (hasCellContext(currentCell, nearContext)) return true;

    return hasNearbyContext(
      cells,
      gridX,
      gridY,
      nearContext,
      nearContext === "tree" || nearContext === "fountain" ? 3 : 2
    );
  });
}

function canPlaceEntryOnCell(entry, cells, gridX, gridY, spawnStats = null) {
  const rejectionReason = getObjectPlacementTerrainIssue(entry, cells, gridX, gridY);

  if (rejectionReason) {
    recordObjectSpawnRejected(spawnStats, rejectionReason);
    return false;
  }

  return true;
}

function canPlaceFootprint(entry, cells, anchorX, anchorY, spawnStats = null) {
  const footprint = getFootprintCells(entry, anchorX, anchorY);

  if (
    footprint.some(
      ([gridX, gridY]) =>
        !canPlaceEntryOnCell(entry, cells, gridX, gridY, spawnStats) ||
        !getCell(cells, gridX, gridY)
    )
  ) {
    return false;
  }

  return matchesNearRule(entry, cells, anchorX, anchorY);
}

function createRenderItem(entry, config) {
  const animation = getRenderableAnimation(entry);
  const renderWidth = animation?.frameWidth || entry.width;
  const renderHeight = animation?.frameHeight || entry.height;

  return {
    id: config.id,
    entry,
    x: config.x,
    y: config.y,
    baseX: config.baseX ?? config.x,
    baseY: config.baseY ?? config.y,
    scale: config.scale,
    anchorMode: config.anchorMode,
    anchorX: config.anchorX ?? 0.5,
    anchorY: config.anchorY ?? 1,
    renderLayer: entry.render?.layer || "decor",
    renderPriority: entry.render?.priority ?? 0,
    blocksMovement: Boolean(config.blocksMovement ?? entry.collision?.blocksMovement),
    walkableOverride: Boolean(
      config.walkableOverride ?? entry.collision?.walkableOverride
    ),
    animation,
    renderWidth,
    renderHeight,
    splitDepth: config.splitDepth || 0,
    parentObjectId: config.parentObjectId || null,
    collisionProfile: config.collisionProfile || null,
    collisionBox: config.collisionBox || null,
    zSortY:
      config.anchorMode === "tile"
        ? config.y + renderHeight * config.scale
        : config.baseY ?? config.y,
  };
}

function createCollisionBoxForObject(renderWidth, renderHeight, scale, collisionProfile = {}) {
  const scaledWidth = renderWidth * scale;
  const scaledHeight = renderHeight * scale;
  const width = Math.max(
    1,
    scaledWidth * (collisionProfile.widthRatio ?? 0.3)
  );
  const height = Math.max(
    1,
    scaledHeight * (collisionProfile.heightRatio ?? 0.14)
  );
  const offsetX = Number.isFinite(collisionProfile.offsetX)
    ? collisionProfile.offsetX
    : Number.isFinite(collisionProfile.offsetXRatio)
      ? scaledWidth * collisionProfile.offsetXRatio
      : (scaledWidth - width) * 0.5;
  const offsetY = Number.isFinite(collisionProfile.offsetY)
    ? collisionProfile.offsetY
    : Number.isFinite(collisionProfile.offsetYRatio)
      ? scaledHeight * collisionProfile.offsetYRatio
      : scaledHeight - height - scaledHeight * (collisionProfile.baseInsetRatio || 0);

  return {
    offsetX,
    offsetY,
    width,
    height,
  };
}

const TREE_COLLISION_SHIFT_UP_PX = 6;
const ROCK_COLLISION_EXTRA_HEIGHT_PX = 4;
const THIN_TREE_COLLISION_VARIANTS = new Set([
  "tall_tree_green_03",
  "tall_tree_green_04",
  "tall_tree_green_07",
  "tall_tree_green_08",
  "tall_tree_green_11",
  "tall_tree_green_12",
  "tall_tree_green_15",
  "tall_tree_green_16",
  "tall_tree_pink_03",
  "tall_tree_pink_04",
  "tall_tree_pink_07",
  "tall_tree_pink_08",
  "tall_tree_pink_11",
  "tall_tree_pink_12",
  "tall_tree_pink_15",
  "tall_tree_pink_16",
  "tree_green_05",
  "tree_green_07",
  "tree_green_13",
  "tree_green_15",
  "tree_green_21",
  "tree_green_23",
  "tree_green_29",
  "tree_green_31",
  "tree_pink_05",
  "tree_pink_07",
  "tree_pink_13",
  "tree_pink_15",
  "tree_pink_21",
  "tree_pink_23",
  "tree_pink_29",
  "tree_pink_31",
]);

function tuneCollisionBoxForObject(entry, collisionBox, scaledWidth, scaledHeight) {
  if (!collisionBox) {
    return collisionBox;
  }

  const nextBox = { ...collisionBox };

  if (entry?.group === "trees") {
    const shiftUp = Math.min(TREE_COLLISION_SHIFT_UP_PX, nextBox.offsetY);
    nextBox.offsetY -= shiftUp;

    if (THIN_TREE_COLLISION_VARIANTS.has(entry?.name)) {
      nextBox.width *= 0.6;
      nextBox.offsetX = (scaledWidth - nextBox.width) * 0.5;
    }
  }

  if (entry?.group === "rocks") {
    const extraHeight = Math.min(ROCK_COLLISION_EXTRA_HEIGHT_PX, nextBox.offsetY);
    nextBox.offsetY -= extraHeight;
    nextBox.height = Math.min(
      scaledHeight - nextBox.offsetY,
      nextBox.height + extraHeight
    );
  }

  return nextBox;
}

function createTileItem(entry, gridX, gridY, overrides = {}) {
  const item = createRenderItem(entry, {
    id: overrides.id || `${entry.name}_${gridX}_${gridY}`,
    x: overrides.x ?? gridX * WORLD_ATLAS_TILE_SIZE,
    y: overrides.y ?? gridY * WORLD_ATLAS_TILE_SIZE,
    scale: overrides.scale ?? WORLD_ATLAS_TILE_SCALE,
    anchorMode: "tile",
    blocksMovement: overrides.blocksMovement,
    walkableOverride: overrides.walkableOverride,
  });

  item.gridX = gridX;
  item.gridY = gridY;

  return item;
}

function createObjectItem(entry, baseX, baseY, seedKey, overrides = {}) {
  const [minScale, maxScale] = getObjectScaleRange(entry);
  const scale =
    overrides.scale ??
    (minScale + hashUnit(seedKey, "scale", entry.name, baseX, baseY) * (maxScale - minScale));
  const collisionProfile = getObjectCollisionProfile(entry);
  const item = createRenderItem(entry, {
    id:
      overrides.id ||
      `${entry.name}_${Math.round(baseX * 10)}_${Math.round(baseY * 10)}`,
    x: baseX,
    y: baseY,
    baseX,
    baseY,
    scale,
    anchorMode: "object",
    anchorX: 0.5,
    anchorY: 1,
    blocksMovement: overrides.blocksMovement,
    walkableOverride: overrides.walkableOverride,
    splitDepth: overrides.splitDepth ?? getTreeSplitDepth(entry),
    collisionProfile,
  });

  let explicitCollisionBox = getWorldAtlasEntryCollisionBox(entry, item.scale);
  if (!explicitCollisionBox) {
    // Metadata tile entries (created by createMetadataTileEntry) have no collisionBox on
    // the entry itself. Look up the full tree entry from JSON to get the correct trunk box.
    const lookupId = entry.id || entry.name;
    const treeEntry = lookupId ? WORLD_ATLAS_TREE_OBJECTS[lookupId] : null;
    if (treeEntry) {
      explicitCollisionBox = getWorldAtlasEntryCollisionBox(treeEntry, item.scale);
    }
  }
  if (explicitCollisionBox) {
    item.collisionBox = explicitCollisionBox;
    item.collisionBoxSource = "json";
  } else {
    item.collisionBox = tuneCollisionBoxForObject(
      entry,
      createCollisionBoxForObject(
        item.renderWidth,
        item.renderHeight,
        item.scale,
        collisionProfile
      ),
      item.renderWidth * item.scale,
      item.renderHeight * item.scale
    );
    item.collisionBoxSource = "fallback";
  }

  return item;
}

function getWorldDecorDensityValue(familyId, densityKey = "low") {
  const runtimeFamilyConfig =
    getWorldDecorRuntimeSettings().familyConfig?.[familyId] || null;

  if (runtimeFamilyConfig?.density !== undefined) {
    return getFiniteRuntimeNumber(runtimeFamilyConfig.density, 0);
  }

  if (WORLD_DECOR_DENSITY[familyId] !== undefined) {
    return WORLD_DECOR_DENSITY[familyId];
  }

  return WORLD_DECOR_DENSITY_BY_KEY[densityKey] || 0;
}

function getWorldDecorFamilyConfig(familyId) {
  return (
    getWorldDecorRuntimeSettings().familyConfig?.[familyId] ||
    WORLD_DECOR_FAMILY_CONFIG[familyId] ||
    null
  );
}

function isWorldDecorFamilyEnabled(familyId) {
  const runtimeFamilyConfig = getWorldDecorFamilyConfig(familyId);
  if (runtimeFamilyConfig?.enabled !== undefined) {
    return runtimeFamilyConfig.enabled !== false;
  }

  if (WORLD_DECOR_FAMILY_ENABLED[familyId] !== undefined) {
    return WORLD_DECOR_FAMILY_ENABLED[familyId];
  }

  return true;
}

function getWorldDecorMinDistancePixels(familyId) {
  const runtimeFamilyConfig = getWorldDecorFamilyConfig(familyId);
  const minDistanceTiles = getFiniteRuntimeNumber(
    runtimeFamilyConfig?.minDistanceTiles,
    WORLD_DECOR_MIN_DISTANCE_TILES[familyId] ?? 0
  );

  return minDistanceTiles * WORLD_ATLAS_TILE_SIZE;
}

function getWorldDecorChunkCap(familyId) {
  const runtimeFamilyConfig = getWorldDecorFamilyConfig(familyId);
  return getFiniteRuntimeNumber(
    runtimeFamilyConfig?.maxPerChunk,
    WORLD_DECOR_MAX_PER_CHUNK[familyId] ?? Number.POSITIVE_INFINITY
  );
}

function getWorldDecorVisibleCap(familyId) {
  const runtimeFamilyConfig = getWorldDecorFamilyConfig(familyId);
  return getFiniteRuntimeNumber(
    runtimeFamilyConfig?.maxVisible,
    WORLD_DECOR_FAMILY_MAX_VISIBLE[familyId] ?? Number.POSITIVE_INFINITY
  );
}

function getWorldDecorPriority(familyId, isAnimation = false) {
  const runtimeFamilyConfig = getWorldDecorFamilyConfig(familyId);
  if (runtimeFamilyConfig?.priority !== undefined) {
    return getFiniteRuntimeNumber(runtimeFamilyConfig.priority, 0);
  }

  const explicitPriority = WORLD_DECOR_FAMILY_PRIORITY[familyId];
  if (Number.isFinite(explicitPriority)) {
    return explicitPriority;
  }

  return isAnimation ? 60 : 30;
}

function getWorldDecorPlacementState(states, familyId) {
  if (!states.has(familyId)) {
    states.set(familyId, createPlacementState());
  }

  return states.get(familyId);
}

function getWorldDecorChunkCountKey(gridX, gridY, familyId) {
  return [
    Math.floor(gridX / CHUNK_TILE_SIZE),
    Math.floor(gridY / CHUNK_TILE_SIZE),
    familyId,
  ].join("|");
}

function getWorldDecorChunkKey(gridX, gridY) {
  return [
    Math.floor(gridX / CHUNK_TILE_SIZE),
    Math.floor(gridY / CHUNK_TILE_SIZE),
  ].join("|");
}

function getWorldDecorChunkCount(chunkCounts, gridX, gridY, familyId) {
  return chunkCounts.get(getWorldDecorChunkCountKey(gridX, gridY, familyId)) || 0;
}

function incrementWorldDecorChunkCount(chunkCounts, gridX, gridY, familyId) {
  const key = getWorldDecorChunkCountKey(gridX, gridY, familyId);
  chunkCounts.set(key, (chunkCounts.get(key) || 0) + 1);
}

function getScopedWorldDecorCount(scopedCounts, gridX, gridY) {
  return scopedCounts.get(getWorldDecorChunkKey(gridX, gridY)) || 0;
}

function incrementScopedWorldDecorCount(scopedCounts, gridX, gridY) {
  const key = getWorldDecorChunkKey(gridX, gridY);
  scopedCounts.set(key, (scopedCounts.get(key) || 0) + 1);
}

function createWorldDecorPlacementBudget() {
  return {
    totalCount: 0,
    chunkMetadataCounts: new Map(),
    chunkAnimationCounts: new Map(),
  };
}

function getWorldDecorBudgetRejectionReason(
  placementBudget,
  cell,
  isAnimation = false,
  familyId = null
) {
  if (!placementBudget || !cell) return null;

  if (familyId && !isWorldDecorFamilyEnabled(familyId)) {
    return "disabled";
  }

  return null;
}

function consumeWorldDecorPlacementBudget(placementBudget, cell, isAnimation = false) {
  if (!placementBudget || !cell) return;

  placementBudget.totalCount += 1;

  if (isAnimation) {
    incrementScopedWorldDecorCount(
      placementBudget.chunkAnimationCounts,
      cell.gridX,
      cell.gridY
    );
    return;
  }

  incrementScopedWorldDecorCount(
    placementBudget.chunkMetadataCounts,
    cell.gridX,
    cell.gridY
  );
}

function getMetadataReservationKey(gridX, gridY) {
  return `${gridX},${gridY}`;
}

function getMetadataPlacementSeedId(familyId, definition = null) {
  return definition?.id || definition?.family || familyId || "world_metadata";
}

function isStrongMetadataJitterFamily(familyId, definition = null) {
  const normalizedFamilyId = normalizePlacementRuleFamilyId(familyId);

  if (STRONG_METADATA_JITTER_FAMILY_IDS.has(normalizedFamilyId)) {
    return true;
  }

  return String(definition?.id || definition?.family || "")
    .toLowerCase()
    .includes("variation_on_");
}

function isLightObjectJitterFamily(familyId) {
  return LIGHT_OBJECT_JITTER_FAMILY_IDS.has(normalizePlacementRuleFamilyId(familyId));
}

function isMetadataJitterDisabled(familyId) {
  return NO_METADATA_JITTER_FAMILY_IDS.has(normalizePlacementRuleFamilyId(familyId));
}

function getMetadataJitterFloorTiles(familyId, definition = null, anchorMode = "tile") {
  if (isMetadataJitterDisabled(familyId)) {
    return 0;
  }

  if (anchorMode === "object") {
    if (isLightObjectJitterFamily(familyId)) {
      return 0.22;
    }

    return 0.14;
  }

  if (isStrongMetadataJitterFamily(familyId, definition)) {
    const definitionId = String(definition?.id || definition?.family || "");
    if (definitionId.includes("variation_on_")) {
      return 0.26;
    }

    if (definitionId.includes("rock")) {
      return 0.34;
    }

    return 0.42;
  }

  return 0;
}

function getMetadataPlacementJitterTiles(familyId, definition = null, anchorMode = "tile") {
  const familyConfig = getWorldDecorFamilyConfig(familyId);
  const fallback = anchorMode === "object" ? 0.18 : 0;
  const configured = getFiniteRuntimeNumber(familyConfig?.placementJitterTiles, fallback);
  const floor = getMetadataJitterFloorTiles(familyId, definition, anchorMode);
  return clampNumber(
    Math.max(configured, floor),
    0,
    anchorMode === "object" ? 0.28 : 0.48
  );
}

function getMetadataPlacementNoiseScale(familyId) {
  const familyConfig = getWorldDecorFamilyConfig(familyId);
  const floor = isStrongMetadataJitterFamily(familyId) ? 0.28 : isLightObjectJitterFamily(familyId) ? 0.2 : 0.12;
  return clampNumber(
    Math.max(getFiniteRuntimeNumber(familyConfig?.placementNoiseScale, floor), floor),
    0.08,
    0.58
  );
}

function getMetadataPlacementClusterWeight(familyId) {
  const familyConfig = getWorldDecorFamilyConfig(familyId);
  const floor = isStrongMetadataJitterFamily(familyId)
    ? 0.72
    : isLightObjectJitterFamily(familyId)
      ? 0.46
      : 0.28;
  return clampNumber(
    Math.max(getFiniteRuntimeNumber(familyConfig?.placementClusterWeight, floor), floor),
    0.12,
    0.92
  );
}

function getMetadataPlacementPoint(
  cell,
  familyId,
  definition = null,
  { anchorMode = "tile" } = {}
) {
  const cellLeft = cell.gridX * WORLD_ATLAS_TILE_SIZE;
  const cellTop = cell.gridY * WORLD_ATLAS_TILE_SIZE;
  const baseX = cellLeft + WORLD_ATLAS_TILE_SIZE * 0.5;
  const baseY =
    cellTop + WORLD_ATLAS_TILE_SIZE * (anchorMode === "object" ? 1 : 0.75);
  const jitterTiles = getMetadataPlacementJitterTiles(familyId, definition, anchorMode);

  if (jitterTiles <= 0) {
    return { x: baseX, y: baseY };
  }

  const seedId = getMetadataPlacementSeedId(familyId, definition);
  const chunkX = Math.floor(cell.gridX / CHUNK_TILE_SIZE);
  const chunkY = Math.floor(cell.gridY / CHUNK_TILE_SIZE);
  const noiseScale = getMetadataPlacementNoiseScale(familyId);
  const clusterWeight = getMetadataPlacementClusterWeight(familyId);
  const jitterPixels = jitterTiles * WORLD_ATLAS_TILE_SIZE;
  const familyPhaseX = hashUnit("metadata-family-phase-x", seedId, familyId) - 0.5;
  const familyPhaseY = hashUnit("metadata-family-phase-y", seedId, familyId) - 0.5;
  const orbitAngle =
    hashUnit(
      "metadata-jitter-angle",
      seedId,
      familyId,
      definition?.id || "default",
      chunkX,
      chunkY,
      cell.gridX,
      cell.gridY
    ) *
    Math.PI *
    2;
  const orbitRadius =
    (0.18 +
      Math.pow(
        hashUnit(
          "metadata-jitter-radius",
          seedId,
          familyId,
          definition?.id || "default",
          cell.gridX,
          cell.gridY
        ),
        0.78
      ) *
        0.82) *
    jitterPixels;
  const warpX =
    (valueNoise(
      cell.gridX + familyPhaseX * 13.7 + chunkX * 2.9,
      cell.gridY - familyPhaseY * 8.1 - chunkY * 3.7,
      `metadata-warp-x:${seedId}`,
      noiseScale
    ) -
      0.5) *
    jitterPixels *
    1.08;
  const warpY =
    (valueNoise(
      cell.gridX - familyPhaseY * 10.3 - chunkY * 2.3,
      cell.gridY + familyPhaseX * 9.1 + chunkX * 4.1,
      `metadata-warp-y:${seedId}`,
      Math.min(0.58, noiseScale * 1.14)
    ) -
      0.5) *
    jitterPixels *
    1.02;
  const microX =
    (hashUnit(
      "metadata-jitter-x",
      seedId,
      familyId,
      definition?.id || "default",
      chunkX,
      chunkY,
      cell.gridX,
      cell.gridY
    ) -
      0.5) *
    jitterPixels *
    0.74;
  const microY =
    (hashUnit(
      "metadata-jitter-y",
      seedId,
      familyId,
      definition?.id || "default",
      chunkY,
      chunkX,
      cell.gridY,
      cell.gridX
    ) -
      0.5) *
    jitterPixels *
    0.68;
  const laneBreakX =
    (hashUnit(
      "metadata-lane-break-x",
      seedId,
      familyId,
      definition?.id || "default",
      cell.gridY,
      chunkX
    ) -
      0.5) *
    jitterPixels *
    0.3;
  const laneBreakY =
    (hashUnit(
      "metadata-lane-break-y",
      seedId,
      familyId,
      definition?.id || "default",
      cell.gridX,
      chunkY
    ) -
      0.5) *
    jitterPixels *
    0.26;
  const projectedX =
    baseX +
    Math.cos(orbitAngle) * orbitRadius * 0.74 +
    warpX * 0.58 +
    microX +
    laneBreakX;
  const projectedY =
    baseY +
    Math.sin(orbitAngle) * orbitRadius * (anchorMode === "object" ? 0.42 : 0.56) +
    warpY * 0.54 +
    microY +
    laneBreakY;
  const minX = cellLeft + WORLD_ATLAS_TILE_SIZE * 0.12;
  const maxX = cellLeft + WORLD_ATLAS_TILE_SIZE * 0.88;
  const minY =
    cellTop + WORLD_ATLAS_TILE_SIZE * (anchorMode === "object" ? 0.72 : 0.48);
  const maxY =
    cellTop + WORLD_ATLAS_TILE_SIZE * (anchorMode === "object" ? 0.98 : 0.92);

  return {
    x: clampNumber(projectedX, minX, maxX),
    y: clampNumber(
      projectedY + (clusterWeight - 0.5) * jitterPixels * (anchorMode === "object" ? 0.08 : 0.14),
      minY,
      maxY
    ),
  };
}

function getMetadataTileRenderPosition(cell, placementPoint) {
  const defaultX = cell.gridX * WORLD_ATLAS_TILE_SIZE;
  const defaultY = cell.gridY * WORLD_ATLAS_TILE_SIZE;
  const defaultBaseX = defaultX + WORLD_ATLAS_TILE_SIZE * 0.5;
  const defaultBaseY = defaultY + WORLD_ATLAS_TILE_SIZE * 0.75;

  return {
    x: defaultX + (placementPoint.x - defaultBaseX),
    y: defaultY + (placementPoint.y - defaultBaseY),
  };
}

function isWaterSparkleAnimationId(animationId) {
  return (
    animationId === "water_idle_sparkle_loop_a" ||
    animationId === "water_idle_sparkle_loop_b"
  );
}

function getWaterSparkleVariantIndex(animationId) {
  if (animationId === "water_idle_sparkle_loop_a") return 0;
  if (animationId === "water_idle_sparkle_loop_b") return 1;
  return -1;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getFiniteRuntimeNumber(value, fallback) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function getMetadataFamilyVariantPlacements(states, familyId) {
  if (!states.has(familyId)) {
    states.set(familyId, []);
  }

  return states.get(familyId);
}

function registerMetadataFamilyVariantPlacement(states, familyId, cell, definition) {
  if (!states || !familyId || !cell || !definition) return;

  getMetadataFamilyVariantPlacements(states, familyId).push({
    gridX: cell.gridX,
    gridY: cell.gridY,
    variantId: definition.id,
  });
}

function getNearbyMetadataVariantIds(states, familyId, cell, radius = 1) {
  if (!states || !familyId || !cell) {
    return new Set();
  }

  return new Set(
    getMetadataFamilyVariantPlacements(states, familyId).flatMap((placement) =>
      Math.abs(placement.gridX - cell.gridX) <= radius &&
      Math.abs(placement.gridY - cell.gridY) <= radius
        ? [placement.variantId]
        : []
    )
  );
}

function chooseMetadataVariantForCell(
  definitions,
  familyId,
  cell,
  familyVariantPlacements,
  ...seedParts
) {
  if (!definitions.length) return null;
  if (definitions.length === 1) return definitions[0];

  const nearbyVariantIds = getNearbyMetadataVariantIds(
    familyVariantPlacements,
    familyId,
    cell
  );

  // Linear O(N) scan replaces [...definitions].sort() + find():
  // finds the lowest-score definition not in nearbyVariantIds,
  // falling back to the lowest-score overall — identical output.
  let bestDef = null;
  let bestScore = Infinity;
  let firstDef = null;
  let firstScore = Infinity;

  for (let i = 0; i < definitions.length; i++) {
    const def = definitions[i];
    const score = hashUnit(...seedParts, def.id);
    if (score < firstScore || (score === firstScore && def.id < (firstDef?.id ?? "￿"))) {
      firstScore = score;
      firstDef = def;
    }
    if (!nearbyVariantIds.has(def.id)) {
      if (score < bestScore || (score === bestScore && def.id < (bestDef?.id ?? "￿"))) {
        bestScore = score;
        bestDef = def;
      }
    }
  }

  return bestDef ?? firstDef;
}

function getMetadataScatterPlan(familyId, density, kind = "decor") {
  const safeDensity = Math.max(0.008, density || 0.01);
  const densityDrivenSize = Math.sqrt(1 / safeDensity) * 1.08;
  const sectorSizeTiles =
    kind === "terrain_variation"
      ? clampNumber(densityDrivenSize, 3.1, 5.4)
      : kind === "animated_object"
        ? clampNumber(densityDrivenSize * 1.18, 12, 18)
        : clampNumber(densityDrivenSize, 4.1, 6.8);
  const expectedScale =
    kind === "terrain_variation"
      ? 0.94
      : kind === "animated_object"
        ? 0.34
        : 0.82;
  const expectedCount = clampNumber(
    density * sectorSizeTiles * sectorSizeTiles * expectedScale,
    0.05,
    kind === "animated_object" ? 1.4 : 2.9
  );
  const slotCount = Math.max(
    1,
    Math.min(kind === "terrain_variation" ? 6 : 5, Math.ceil(expectedCount + 1.25))
  );
  const sectorSizePixels = Math.max(
    WORLD_ATLAS_TILE_SIZE * 2,
    Math.round(sectorSizeTiles * WORLD_ATLAS_TILE_SIZE)
  );
  const overflowPixels = Math.round(
    Math.max(
      WORLD_ATLAS_TILE_SIZE * (kind === "animated_object" ? 1.25 : 0.9),
      sectorSizePixels * (kind === "terrain_variation" ? 0.3 : 0.38)
    )
  );

  return {
    familyId,
    kind,
    density,
    sectorSizeTiles,
    sectorSizePixels,
    overflowPixels,
    slotCount,
    expectedCount,
    searchRadiusTiles: Math.max(
      1,
      Math.min(
        kind === "animated_object" ? 4 : 3,
        Math.ceil(sectorSizeTiles * (kind === "animated_object" ? 0.28 : 0.46))
      )
    ),
  };
}

function getMetadataScatterSectorBounds(cellBounds, plan) {
  const left = cellBounds.startX * WORLD_ATLAS_TILE_SIZE - plan.overflowPixels;
  const right = (cellBounds.endX + 1) * WORLD_ATLAS_TILE_SIZE + plan.overflowPixels;
  const top = cellBounds.startY * WORLD_ATLAS_TILE_SIZE - plan.overflowPixels;
  const bottom = (cellBounds.endY + 1) * WORLD_ATLAS_TILE_SIZE + plan.overflowPixels;

  return {
    startX: Math.floor(left / plan.sectorSizePixels) - 1,
    endX: Math.ceil(right / plan.sectorSizePixels) + 1,
    startY: Math.floor(top / plan.sectorSizePixels) - 1,
    endY: Math.ceil(bottom / plan.sectorSizePixels) + 1,
  };
}

function getMetadataScatterSlotChance(plan, sectorX, sectorY, slotIndex) {
  const pocketNoise = valueNoise(
    sectorX + slotIndex * 4.1,
    sectorY - slotIndex * 3.7,
    `metadata-scatter-pocket:${plan.familyId}`,
    0.31
  );
  const slotBias = Math.max(0.52, 1 - slotIndex * 0.08);
  const localExpected = plan.expectedCount * (0.72 + pocketNoise * 0.9) * slotBias;

  return Math.min(0.98, Math.max(0.04, localExpected / plan.slotCount));
}

function createMetadataScatterCandidatePoint(plan, sectorX, sectorY, slotIndex) {
  const sectorLeft = sectorX * plan.sectorSizePixels;
  const sectorTop = sectorY * plan.sectorSizePixels;
  const rawSpan = plan.sectorSizePixels + plan.overflowPixels * 2;
  const warpX =
    (valueNoise(
      sectorX * 1.7 + slotIndex * 6.3,
      sectorY * 0.9 - slotIndex * 2.1,
      `metadata-scatter-warp-x:${plan.familyId}`,
      0.22
    ) -
      0.5) *
    plan.overflowPixels *
    1.2;
  const warpY =
    (valueNoise(
      sectorX * 0.8 - slotIndex * 3.4,
      sectorY * 1.6 + slotIndex * 5.2,
      `metadata-scatter-warp-y:${plan.familyId}`,
      0.22
    ) -
      0.5) *
    plan.overflowPixels *
    1.2;

  return {
    x:
      sectorLeft -
      plan.overflowPixels +
      hashUnit("world-metadata-candidate", plan.familyId, "x", sectorX, sectorY, slotIndex) *
        rawSpan +
      warpX,
    y:
      sectorTop -
      plan.overflowPixels +
      hashUnit("world-metadata-candidate", plan.familyId, "y", sectorX, sectorY, slotIndex) *
        rawSpan +
      warpY,
  };
}

function chooseMetadataVariant(definitions, ...seedParts) {
  if (!definitions.length) return null;

  const index = Math.min(
    definitions.length - 1,
    Math.floor(hashUnit(...seedParts) * definitions.length)
  );

  return definitions[index];
}

function mapMetadataRenderLayer(renderLayer, fallbackLayer = "decor_ground") {
  switch (renderLayer) {
    case "terrain_variation":
      return "terrain_variation";
    case "decor_ground":
      return "decor_ground";
    case "landmark":
      return "landmark";
    case "decor":
      return "decor";
    case "water_overlay":
      return "water_overlay";
    case "overlay":
      return "overlay";
    default:
      return fallbackLayer;
  }
}

function createMetadataTileEntry(definition) {
  return {
    name: definition.name,
    type: "tile",
    group: definition.group || "world_metadata",
    category: definition.category,
    family: definition.family,
    description: definition.description,
    x: definition.atlas.x,
    y: definition.atlas.y,
    width: definition.atlas.width,
    height: definition.atlas.height,
    tileW: definition.grid.width,
    tileH: definition.grid.height,
    tags: [
      "world_metadata",
      definition.family,
      definition.category,
      ...(Array.isArray(definition.tags) ? definition.tags : []),
      ...definition.allowedTerrains,
    ],
    collision: {
  blocksMovement: definition.collisionType === "bottom_footprint",
  walkableOverride: false,
},
    render: {
      layer: mapMetadataRenderLayer(
        definition.renderLayer,
        definition.category === "terrain_variation" ? "terrain_variation" : "decor_ground"
      ),
      priority: definition.category === "terrain_variation" ? 1 : 2,
    },
    interaction: definition.interaction || null,
  };
}

function createMetadataStaticObjectItem(definition, cell, placementPoint) {
  const entry = createMetadataTileEntry(definition);
  const baseX = placementPoint.x;
  const baseY = placementPoint.y;

  return createObjectItem(entry, baseX, baseY, `metadata:${definition.id}`, {
    id: `metadata_${definition.id}_${cell.gridX}_${cell.gridY}`,
  });
}

function createMetadataAnimationEntry(animation) {
  const firstFrame = animation.frames[0];
  const allowedTerrains = Array.isArray(animation.allowedTerrains)
    ? animation.allowedTerrains
    : [];
  const forbiddenTerrains = Array.isArray(animation.forbiddenTerrains)
    ? animation.forbiddenTerrains
    : [];
  const requiresAutotileCategory = Array.isArray(animation.requiresAutotileCategory)
    ? animation.requiresAutotileCategory
    : [];
  const avoidAutotileCategories = Array.isArray(animation.avoidAutotileCategories)
    ? animation.avoidAutotileCategories
    : [];
  const nearTerrain = Array.isArray(animation.nearTerrain) ? animation.nearTerrain : [];
  const nearObjectFamilies = Array.isArray(animation.nearObjectFamilies)
    ? animation.nearObjectFamilies
    : [];

  const integrationRule =
    WORLD_TILE_METADATA?.raw?.integrationRules?.animationPlacement?.[animation.id] || {};

  const rawCollisionBox =
    animation.raw?.collisionBox ||
    integrationRule.collisionBox ||
    null;

  const collisionBox = rawCollisionBox
    ? {
        offsetX: Number(rawCollisionBox.offsetX ?? rawCollisionBox.x ?? 0),
        offsetY: Number(rawCollisionBox.offsetY ?? rawCollisionBox.y ?? 0),
        width: Number(rawCollisionBox.width),
        height: Number(rawCollisionBox.height),
      }
    : null;

  const collisionConfig = animation.raw?.collision || integrationRule.collision || null;

  return {
    id: animation.id,
    name: animation.name,
    type: "tile",
    group: "world_metadata_animation",
    category: animation.category,
    family: animation.id,
    description: animation.description,
    x: firstFrame.atlas.x,
    y: firstFrame.atlas.y,
    width: animation.frameWidth,
    height: animation.frameHeight,
    tileW: Math.max(1, Math.round(animation.frameWidth / 16)),
    tileH: Math.max(1, Math.round(animation.frameHeight / 16)),
    enabled: animation.enabled !== false,
    spawnable: animation.spawnable !== false,
    allowedTerrains,
    forbiddenTerrains,
    requiresAutotileCategory,
    avoidAutotileCategories,
    nearTerrain,
    nearObjectFamilies,
    nearTerrainRadiusTiles: Number.isFinite(animation.nearTerrainRadiusTiles)
      ? animation.nearTerrainRadiusTiles
      : 2,
    avoidWaterNearby: Boolean(animation.avoidWaterNearby),
    walkable: animation.walkable !== false,
    tags: ["world_metadata_animation", animation.id, ...allowedTerrains],
    depthSplit: (animation.raw?.depthSplit || integrationRule.depthSplit || null)
      ? { frontY: Number((animation.raw?.depthSplit || integrationRule.depthSplit).frontY || 0) }
      : null,
    collisionBox,
    collision: {
      blocksMovement:
        animation.walkable === false ||
        animation.collisionType === "bottom_footprint" ||
        collisionConfig?.blocksMovement === true ||
        collisionConfig?.walkable === false ||
        Boolean(collisionBox),
      walkableOverride: collisionConfig?.walkableOverride ?? false,
    },
    render: {
      layer: mapMetadataRenderLayer(
        animation.placementType === "random_sparse_overlay"
          ? "water_overlay"
          : animation.placementType === "rare_object_spawn"
            ? "landmark"
            : "overlay"
      ),
      priority: animation.placementType === "rare_object_spawn" ? 4 : 3,
    },
    special: {
      animation: {
        frameCount: animation.frameCount,
        frameWidth: animation.frameWidth,
        frameHeight: animation.frameHeight,
        loop: animation.loop,
        fps: animation.fps,
        ticksPerFrame: Math.max(1, Math.round((1000 / animation.fps) / 125)),
        frames: animation.frames,
      },
    },
  };
}

function normalizeMetadataListField(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return [value];
  }

  return [];
}

function hasNearbyTerrainType(cells, gridX, gridY, terrainType, radius = 2) {
  if (!cells) {
    return false;
  }

  for (let x = gridX - radius; x <= gridX + radius; x += 1) {
    for (let y = gridY - radius; y <= gridY + radius; y += 1) {
      if (x === gridX && y === gridY) continue;
      if (getCell(cells, x, y)?.terrainType === terrainType) {
        return true;
      }
    }
  }

  return false;
}

function hasNearbyAnyTerrain(cells, gridX, gridY, terrains = [], radius = 2) {
  return terrains.some((terrainType) =>
    hasNearbyTerrainType(cells, gridX, gridY, terrainType, radius)
  );
}

function hasRequiredNearbyObjectContext(cells, gridX, gridY, contexts = []) {
  if (!contexts.length) return true;

  return contexts.some((context) => {
    if (context === "tree" || context === "tall_tree" || context === "stump") {
      return hasNearbyContext(cells, gridX, gridY, "tree", 3);
    }

    return hasNearbyContext(cells, gridX, gridY, context, 3);
  });
}

function uniquePlacementValues(...lists) {
  return [...new Set(lists.flatMap((list) => normalizeMetadataListField(list)))];
}

function normalizePlacementRuleFamilyId(familyId) {
  if (typeof familyId !== "string" || !familyId.trim()) {
    return null;
  }

  if (familyId === "shroom_green_01" || familyId === "shroom_green") {
    return "shroom_green";
  }

  if (familyId.startsWith("tall_tree")) {
    return "tall_tree";
  }

  if (familyId.startsWith("tree_green_birch")) {
    return "tree_green_birch";
  }

  if (familyId.startsWith("tree_green")) {
    return "tree_green";
  }

  if (familyId.startsWith("tree_pink")) {
    return "tree_pink";
  }

  return familyId;
}

function mergePlacementRules(rules = []) {
  return {
    allowedTerrains: uniquePlacementValues(...rules.map((rule) => rule?.allowedTerrains)),
    requiresAutotileCategory: uniquePlacementValues(
      ...rules.map((rule) => rule?.requiresAutotileCategory)
    ),
    forbiddenNearbyTerrains: uniquePlacementValues(
      ...rules.map((rule) => rule?.forbiddenNearbyTerrains)
    ),
    requiresFullNeighborRing: rules.some((rule) => rule?.requiresFullNeighborRing),
  };
}

function getWorldTileGlobalPlacementRules() {
  return WORLD_TILE_METADATA?.integrationRules?.globalPlacement || {};
}

function getWorldTileFamilyPlacementRuleMap() {
  return WORLD_TILE_METADATA?.integrationRules?.familyPlacementRules || {};
}

function getPlacementRuleFamilyIdsForDefinition(definition) {
  return [
    ...new Set(
      [definition?.family, definition?.id]
        .map(normalizePlacementRuleFamilyId)
        .filter(Boolean)
    ),
  ];
}

function getPlacementRuleFamilyIdsForEntry(entry) {
  const familyIds = [
    entry?.family,
    entry?.group,
  ]
    .map(normalizePlacementRuleFamilyId)
    .filter(Boolean);

  if (hasAtlasTag(entry, "tall_tree")) {
    familyIds.push("tall_tree");
  }

  if (hasAtlasTag(entry, "tree")) {
    familyIds.push("trees");
  }

  return [...new Set(familyIds)];
}

function getFamilyPlacementRulesForIds(familyIds = []) {
  const ruleMap = getWorldTileFamilyPlacementRuleMap();
  return mergePlacementRules(
    familyIds.map((familyId) => ruleMap[normalizePlacementRuleFamilyId(familyId)]).filter(Boolean)
  );
}

function getMetadataPlacementRules(definition) {
  return getFamilyPlacementRulesForIds(getPlacementRuleFamilyIdsForDefinition(definition));
}

function getObjectPlacementRules(entry) {
  return getFamilyPlacementRulesForIds(getPlacementRuleFamilyIdsForEntry(entry));
}

function isCellResolvedFullAutotile(cell) {
  return Boolean(cell && cell.autotile && cell.autotile.category === "full" && !cell.bridge);
}

function hasRequiredFullNeighborRing(cells, cell) {
  if (!cell || !cells) return false;

  return FULL_NEIGHBOR_RING_OFFSETS.every(([offsetX, offsetY]) => {
    const neighbor = getCell(cells, cell.gridX + offsetX, cell.gridY + offsetY);
    return Boolean(
      neighbor &&
        neighbor.terrainType === cell.terrainType &&
        isCellResolvedFullAutotile(neighbor)
    );
  });
}

function getPlacementRuleRejectionReason({
  cell,
  cells,
  allowedTerrains = [],
  forbiddenTerrains = [],
  requiresAutotileCategory = [],
  forbiddenAutotileCategories = [],
  requiresResolvedFullAutotile = false,
  requiresFullNeighborRing = false,
  forbiddenNearbyTerrains = [],
}) {
  if (!cell || !cell.autotile) {
    return "non_full_autotile";
  }

  if (allowedTerrains.length > 0 && !allowedTerrains.includes(cell.terrainType)) {
    return "forbidden_terrain";
  }

  if (forbiddenTerrains.includes(cell.terrainType)) {
    return "forbidden_terrain";
  }

  if (requiresResolvedFullAutotile && !isCellResolvedFullAutotile(cell)) {
    return "non_full_autotile";
  }

  if (
    requiresAutotileCategory.length > 0 &&
    !requiresAutotileCategory.includes(cell.autotile.category)
  ) {
    return "forbidden_autotile";
  }

  if (forbiddenAutotileCategories.includes(cell.autotile.category)) {
    return "forbidden_autotile";
  }

  if (requiresFullNeighborRing && !hasRequiredFullNeighborRing(cells, cell)) {
    return "non_full_neighbor_ring";
  }

  if (
    forbiddenNearbyTerrains.length > 0 &&
    hasNearbyAnyTerrain(
      cells,
      cell.gridX,
      cell.gridY,
      forbiddenNearbyTerrains,
      FORBIDDEN_NEARBY_TERRAIN_RADIUS_TILES
    )
  ) {
    return "near_forbidden_terrain";
  }

  return null;
}

function getMetadataAutotileRejectionReason(definition, cell, cells) {
  const globalPlacement = getWorldTileGlobalPlacementRules();
  const placementRules = getMetadataPlacementRules(definition);

  return getPlacementRuleRejectionReason({
    cell,
    cells,
    allowedTerrains: uniquePlacementValues(
      definition?.allowedTerrains,
      placementRules.allowedTerrains
    ),
    forbiddenTerrains: normalizeMetadataListField(definition?.forbiddenTerrains),
    requiresAutotileCategory: uniquePlacementValues(
      definition?.requiresAutotileCategory,
      placementRules.requiresAutotileCategory
    ),
    forbiddenAutotileCategories: uniquePlacementValues(
      definition?.avoidAutotileCategories,
      globalPlacement.doNotPlaceOnTransitions
        ? globalPlacement.forbiddenAutotileCategories
        : []
    ),
    requiresResolvedFullAutotile: Boolean(globalPlacement.onlyOnResolvedFullAutotiles),
    requiresFullNeighborRing: Boolean(placementRules.requiresFullNeighborRing),
    forbiddenNearbyTerrains: placementRules.forbiddenNearbyTerrains,
  });
}

function isMetadataAllowedOnCell(definition, cell, cells) {
  try {
    return !getMetadataAutotileRejectionReason(definition, cell, cells);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[world-metadata-allowed-cell-error]", {
        family: definition?.family || definition?.id || definition?.name || "unknown",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return false;
  }
}

function getMetadataStaticCellRejectionReason(definition, cell, cells) {
  try {
    const nearTerrain = normalizeMetadataListField(definition?.nearTerrain);
    const nearObjectFamilies = normalizeMetadataListField(definition?.nearObjectFamilies);

    if (!definition?.spawnable) {
      return "disabled";
    }

    const autotileRejectionReason = getMetadataAutotileRejectionReason(
      definition,
      cell,
      cells
    );
    if (autotileRejectionReason) {
      return autotileRejectionReason;
    }

    if (
      nearTerrain.length > 0 &&
      !hasNearbyAnyTerrain(
        cells,
        cell.gridX,
        cell.gridY,
        nearTerrain,
        definition.nearTerrainRadiusTiles || 2
      )
    ) {
      return "near_requirement";
    }

    if (
      nearObjectFamilies.length > 0 &&
      !hasRequiredNearbyObjectContext(
        cells,
        cell.gridX,
        cell.gridY,
        nearObjectFamilies
      )
    ) {
      return "near_requirement";
    }

    if (
      definition.avoidWaterNearby &&
      hasNearbyTerrainType(cells, cell.gridX, cell.gridY, TERRAIN_TYPES.WATER, 2)
    ) {
      return "near_requirement";
    }

    return null;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[world-metadata-rejection-error]", {
        family: definition?.family || definition?.id || definition?.name || "unknown",
        cell: cell ? `${cell.gridX},${cell.gridY}` : null,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return "disabled";
  }
}

function getMetadataCellRejectionReason({
  definition,
  cell,
  cells,
  placementPoint,
  occupancy,
  worldDecorOccupancy,
  metadataOccupancyGrid,
  familyPlacementStates,
  chunkCounts,
  reservedCells,
  stats,
}) {
  const staticRejectionReason = getMetadataStaticCellRejectionReason(
    definition,
    cell,
    cells
  );
  if (staticRejectionReason) {
    return staticRejectionReason;
  }

  const familyId = definition.family || definition.id;
  if (
    getWorldDecorChunkCount(chunkCounts, cell.gridX, cell.gridY, familyId) >=
    getWorldDecorChunkCap(familyId)
  ) {
    return "chunk_cap";
  }

  const reservationKey = getMetadataReservationKey(cell.gridX, cell.gridY);
  if (reservedCells.has(reservationKey)) {
    return "overlap";
  }

  if (
    isMetadataGridCellOccupied(
      metadataOccupancyGrid,
      cell,
      definition,
      definition.family || definition.id
    )
  ) {
    return "occupied_pool";
  }

  const minDistancePixels = getWorldDecorMinDistancePixels(familyId);

  if (
    minDistancePixels > 0 &&
    isOccupied(
      getWorldDecorPlacementState(familyPlacementStates, familyId),
      placementPoint.x,
      placementPoint.y,
      minDistancePixels
    )
  ) {
    return "too_close";
  }

  recordWorldDecorExactOverlapCheck(stats);
  if (
    isOccupied(
      occupancy,
      placementPoint.x,
      placementPoint.y,
      WORLD_ATLAS_TILE_SIZE * 0.3
    ) ||
    isOccupied(
      worldDecorOccupancy,
      placementPoint.x,
      placementPoint.y,
      Math.max(WORLD_ATLAS_TILE_SIZE * 0.2, minDistancePixels)
    )
  ) {
    return "overlap";
  }

  return null;
}

function placeMetadataTileItem({
  cells,
  definition,
  cell,
  renderItems,
  occupancy,
  worldDecorOccupancy,
  metadataOccupancyGrid,
  familyPlacementStates,
  familyVariantPlacements,
  chunkCounts,
  placementBudget,
  reservedCells,
  stats,
  idPrefix = "metadata",
  isAnimation = false,
}) {
  const familyId = definition.family || definition.id;
  const useObjectPlacement =
    definition.collisionType === "bottom_footprint" || definition.group === "trees";
  const placementPoint = getMetadataPlacementPoint(cell, familyId, definition, {
    anchorMode: useObjectPlacement ? "object" : "tile",
  });
  const rejectionReason = getMetadataCellRejectionReason({
    definition,
    cell,
    cells,
    placementPoint,
    occupancy,
    worldDecorOccupancy,
    metadataOccupancyGrid,
    familyPlacementStates,
    chunkCounts,
    reservedCells,
    stats,
  });

  if (rejectionReason) {
    recordWorldDecorRejected(stats, definition.family || definition.id, rejectionReason);
    return null;
  }

  const budgetRejectionReason = getWorldDecorBudgetRejectionReason(
    placementBudget,
    cell,
    isAnimation,
    definition.family || definition.id
  );
  if (budgetRejectionReason) {
    recordWorldDecorRejected(
      stats,
      familyId,
      budgetRejectionReason
    );
    return null;
  }

  const item = useObjectPlacement
    ? createMetadataStaticObjectItem(definition, cell, placementPoint)
    : createTileItem(createMetadataTileEntry(definition), cell.gridX, cell.gridY, {
        id: `${idPrefix}_${definition.id}_${cell.gridX}_${cell.gridY}`,
        x: getMetadataTileRenderPosition(cell, placementPoint).x,
        y: getMetadataTileRenderPosition(cell, placementPoint).y,
      });

  renderItems.push(item);
  reservedCells.add(getMetadataReservationKey(cell.gridX, cell.gridY));
  incrementWorldDecorChunkCount(chunkCounts, cell.gridX, cell.gridY, familyId);
  reserveOccupancy(
    worldDecorOccupancy,
    placementPoint.x,
    placementPoint.y,
    Math.max(
      WORLD_ATLAS_TILE_SIZE * 0.2,
      getWorldDecorMinDistancePixels(familyId)
    )
  );

  const familyPlacementState = getWorldDecorPlacementState(
    familyPlacementStates,
    familyId
  );
  const minDistancePixels = getWorldDecorMinDistancePixels(familyId);
  if (minDistancePixels > 0) {
    reservePlacement(
      familyPlacementState,
      placementPoint.x,
      placementPoint.y,
      minDistancePixels
    );
  }

  reserveMetadataGridCell(metadataOccupancyGrid, cell, definition, familyId);
  registerMetadataFamilyVariantPlacement(
    familyVariantPlacements,
    familyId,
    cell,
    definition
  );
  item.worldDecorFamily = familyId;
  item.isWorldMetadata = true;
  item.isWorldMetadataAnimation = isAnimation;
  item.sourceTerrainType = cell.terrainType;
  if (item.entry?.group === "trees") {
    markContextAroundBasePoint(cells, placementPoint.x, placementPoint.y, "tree", 3);
    recordWorldDecorTreeStats(stats, [item]);
  }
  consumeWorldDecorPlacementBudget(placementBudget, cell, isAnimation);
  recordWorldDecorPlaced(stats, familyId, {
    itemId: item.id,
    isAnimation,
  });
  return item;
}

function createMetadataAnimatedObjectItem(animation, cell, placementPoint) {
  const entry = createMetadataAnimationEntry(animation);
  const baseX = placementPoint.x;
  const baseY = placementPoint.y;
  const collisionBox = getWorldAtlasEntryCollisionBox(entry, WORLD_ATLAS_TILE_SCALE);
  const blocksMovement = Boolean(entry.collision?.blocksMovement || collisionBox);

  const item = createRenderItem(entry, {
    id: `metadata_animation_${animation.id}_${cell.gridX}_${cell.gridY}`,
    x: baseX,
    y: baseY,
    baseX,
    baseY,
    scale: WORLD_ATLAS_TILE_SCALE,
    anchorMode: "object",
    anchorX: 0.5,
    anchorY: 1,
    blocksMovement,
collisionBox,
splitDepth: Number(entry.depthSplit?.frontY || 0),
  });

  if (collisionBox) {
    item.collisionBox = collisionBox;
    item.collisionBoxSource = "json";
  }

  return item;
}

function compareRenderItems(a, b) {
  const layerDelta =
    (LAYER_ORDER[a.renderLayer] ?? 0) - (LAYER_ORDER[b.renderLayer] ?? 0);
  if (layerDelta !== 0) return layerDelta;

  const priorityDelta = (a.renderPriority || 0) - (b.renderPriority || 0);
  if (priorityDelta !== 0) return priorityDelta;

  const yDelta = a.zSortY - b.zSortY;
  if (yDelta !== 0) return yDelta;

  return a.id.localeCompare(b.id);
}

function getItemOwnershipPoint(item) {
  if (item.anchorMode === "tile") {
    const gridX = Number.isFinite(item.gridX)
      ? item.gridX
      : Math.floor(item.x / WORLD_ATLAS_TILE_SIZE);
    const gridY = Number.isFinite(item.gridY)
      ? item.gridY
      : Math.floor(item.y / WORLD_ATLAS_TILE_SIZE);

    return {
      x: gridX * WORLD_ATLAS_TILE_SIZE,
      y: gridY * WORLD_ATLAS_TILE_SIZE,
    };
  }

  return {
    x: item.baseX ?? item.x,
    y: (item.baseY ?? item.y) - 1,
  };
}

function getItemChunkCoordinates(item) {
  const point = getItemOwnershipPoint(item);
  const chunkSize = getChunkPixelSize();

  return {
    chunkX: Math.floor(point.x / chunkSize),
    chunkY: Math.floor(point.y / chunkSize),
  };
}

function itemBelongsToChunk(item, chunkX, chunkY) {
  const owner = getItemChunkCoordinates(item);
  return owner.chunkX === chunkX && owner.chunkY === chunkY;
}

function getTreeKeepScore(item, chunkX, chunkY) {
  const baseX = item.baseX ?? item.x;
  const baseY = item.baseY ?? item.y;

  return hashUnit("tree-budget", chunkX, chunkY, item.id, baseX, baseY);
}

function applyPerChunkTreeBudget(renderItems, chunkX, chunkY) {
  if (!Number.isFinite(TREE_MAX_PER_CHUNK) || TREE_MAX_PER_CHUNK <= 0) {
    return renderItems;
  }

  const treeItems = renderItems.filter((item) => item.entry.group === "trees");
  if (treeItems.length <= TREE_MAX_PER_CHUNK) {
    return renderItems;
  }

  const keptTreeIds = new Set(
    [...treeItems]
      .sort((a, b) => getTreeKeepScore(a, chunkX, chunkY) - getTreeKeepScore(b, chunkX, chunkY))
      .slice(0, TREE_MAX_PER_CHUNK)
      .map((item) => item.id)
  );

  return renderItems.filter(
    (item) => item.entry.group !== "trees" || keptTreeIds.has(item.id)
  );
}

function splitChunkTileLayers(renderItems) {
  const tileBackItems = [];
  const tileFrontItems = [];
  const animatedTileBackItems = [];
  const animatedTileFrontItems = [];
  const floatingItems = [];

  renderItems.forEach((item) => {
    if (item.anchorMode !== "tile") {
      floatingItems.push(item);
      return;
    }

    const target =
      item.renderLayer === "overlay"
        ? item.animation
          ? animatedTileFrontItems
          : tileFrontItems
        : item.animation
          ? animatedTileBackItems
          : tileBackItems;

    target.push(item);
  });

  return {
    tileBackItems,
    tileFrontItems,
    animatedTileBackItems,
    animatedTileFrontItems,
    floatingItems,
  };
}

function getRenderItemWorldBounds(item) {
  if (!item) {
    return null;
  }

  if (item.blocksMovement || item.collisionBox || item.entry?.collisionBox) {
    return getWorldAtlasCollisionBounds(item);
  }

  const scale = item.scale || 1;
  const renderWidth = (item.renderWidth || item.entry?.width || 0) * scale;
  const renderHeight = (item.renderHeight || item.entry?.height || 0) * scale;
  const anchorX = item.anchorMode === "tile" ? 0 : item.anchorX || 0.5;
  const anchorY = item.anchorMode === "tile" ? 0 : item.anchorY || 1;
  const left = item.x - renderWidth * anchorX;
  const top = item.y - renderHeight * anchorY;

  return {
    left,
    top,
    right: left + renderWidth,
    bottom: top + renderHeight,
  };
}

function shouldExcludeRenderItemByVillageDecor(item) {
  if (!item || item.isTerrainTile) {
    return false;
  }

  return isWorldBoundsExcludedByVillageDecor(getRenderItemWorldBounds(item));
}

function filterChunkVillageDecorItems(chunk) {
  if (!chunk?.renderItems?.length) {
    return chunk;
  }

  const filteredRenderItems = chunk.renderItems.filter(
    (item) => !shouldExcludeRenderItemByVillageDecor(item)
  );

  if (filteredRenderItems.length === chunk.renderItems.length) {
    return chunk;
  }

  const split = splitChunkTileLayers(filteredRenderItems);

  return {
    ...chunk,
    renderItems: filteredRenderItems,
    floatingItems: split.floatingItems,
    collisionItems: createCollisionItems(filteredRenderItems),
    tileBackItems: split.tileBackItems,
    tileFrontItems: split.tileFrontItems,
    animatedTileBackItems: split.animatedTileBackItems,
    animatedTileFrontItems: split.animatedTileFrontItems,
  };
}

function finalizeChunkLayout(chunkX, chunkY, layout) {
  const ownedRenderItems = layout.renderItems.filter((item) =>
    itemBelongsToChunk(item, chunkX, chunkY)
  );
  const budgetedRenderItems = applyPerChunkTreeBudget(ownedRenderItems, chunkX, chunkY).sort(
    compareRenderItems
  );
  const split = splitChunkTileLayers(budgetedRenderItems);

  return {
    chunkX,
    chunkY,
    key: getChunkKey(chunkX, chunkY),
    bounds: getChunkBounds(chunkX, chunkY),
    renderItems: budgetedRenderItems,
    floatingItems: split.floatingItems,
    collisionItems: createCollisionItems(budgetedRenderItems),
    tileBackItems: split.tileBackItems,
    tileFrontItems: split.tileFrontItems,
    animatedTileBackItems: split.animatedTileBackItems,
    animatedTileFrontItems: split.animatedTileFrontItems,
    terrainAutotileStats: layout.terrainAutotileStats || createTerrainAutotileStats(),
    objectSpawnStats: layout.objectSpawnStats || createObjectSpawnStats(),
    worldDecorStats: layout.worldDecorStats || createWorldDecorStats(),
    perf: layout.perf || null,
  };
}

function filterParentBoundTileItems(items, keptRenderIds) {
  return items.filter(
    (item) => !item.parentObjectId || keptRenderIds.has(item.parentObjectId)
  );
}

function filterChunkTileItemsByVisibleParents(chunk, keptRenderIds) {
  const tileBackItems = filterParentBoundTileItems(chunk.tileBackItems, keptRenderIds);
  const tileFrontItems = filterParentBoundTileItems(chunk.tileFrontItems, keptRenderIds);
  const animatedTileBackItems = filterParentBoundTileItems(
    chunk.animatedTileBackItems,
    keptRenderIds
  );
  const animatedTileFrontItems = filterParentBoundTileItems(
    chunk.animatedTileFrontItems,
    keptRenderIds
  );

  if (
    tileBackItems.length === chunk.tileBackItems.length &&
    tileFrontItems.length === chunk.tileFrontItems.length &&
    animatedTileBackItems.length === chunk.animatedTileBackItems.length &&
    animatedTileFrontItems.length === chunk.animatedTileFrontItems.length
  ) {
    return chunk;
  }

  return {
    ...chunk,
    tileBackItems,
    tileFrontItems,
    animatedTileBackItems,
    animatedTileFrontItems,
  };
}

function isWorldMetadataDebugItem(item) {
  return Boolean(
    item?.isWorldMetadata ||
      item?.entry?.group === "world_metadata" ||
      item?.entry?.group === "world_metadata_animation"
  );
}

function getDecorVisibilityState(atlasData) {
  const cached = decorVisibilityStateByAtlas.get(atlasData);
  if (cached) return cached;

  const nextState = {
    activeIds: new Set(),
  };
  decorVisibilityStateByAtlas.set(atlasData, nextState);

  return nextState;
}

function getMetadataItemChunkKey(item) {
  const ownershipPoint = getItemOwnershipPoint(item);
  const gridX = Math.floor(ownershipPoint.x / WORLD_ATLAS_TILE_SIZE);
  const gridY = Math.floor(ownershipPoint.y / WORLD_ATLAS_TILE_SIZE);
  return getWorldDecorChunkKey(gridX, gridY);
}

function applyVisibleMetadataBudget(
  tileChunks,
  floatingItems,
  atlasData,
  playerX,
  playerY,
  chunkWindow,
  viewport
) {
  // TEMP FIX: disable metadata/decor culling entirely
  // This restores all decor visibility (trees, mushrooms, rocks, water animations, etc.)

  return {
    tileChunks,
    floatingItems,
    debugStats: {
      disabled: true,
    },
  };
}

function createOccupancyState() {
  return createPlacementState();
}

function isOccupied(state, worldX, worldY, radius) {
  return isPlacementReserved(state, worldX, worldY, radius);
}

function reserveOccupancy(state, worldX, worldY, radius) {
  reservePlacement(state, worldX, worldY, radius);
}

function createMetadataOccupancyGrid() {
  return new Set();
}

function getMetadataGridCellKey(gridX, gridY) {
  return gridX * 100003 + gridY;
}

function isMetadataGridCellOccupied(metadataOccupancyGrid, cell) {
  if (!metadataOccupancyGrid || !cell) return false;
  return metadataOccupancyGrid.has(getMetadataGridCellKey(cell.gridX, cell.gridY));
}

function reserveMetadataGridCell(metadataOccupancyGrid, cell) {
  if (!metadataOccupancyGrid || !cell) return;
  metadataOccupancyGrid.add(getMetadataGridCellKey(cell.gridX, cell.gridY));
}

function isCellBaseFullTerrain(cell) {
  return Boolean(cell && isCellResolvedFullAutotile(cell) && cell.terrainWalkable !== false);
}

function getObjectPlacementTerrainIssue(entry, cells, gridX, gridY) {
  const cell = getCell(cells, gridX, gridY);
  const globalPlacement = getWorldTileGlobalPlacementRules();
  const placementRules = getObjectPlacementRules(entry);
  const ROAD_ONLY_TREE_IDS = new Set([
  "tree_16x32_05",
  "tree_16x32_06",
  "tree_16x32_07",
  "tree_16x32_08",
]);

if (ROAD_ONLY_TREE_IDS.has(entry?.name || entry?.id)) {
  const cell = getCell(cells, gridX, gridY);
  if (!cell) return "invalid_terrain";
  if (cell.terrainType !== "road") return "invalid_terrain";
  if (cell.autotile?.category !== "full") return "non_full_autotile";
}
  if (!cell) {
    return "invalid_terrain";
  }

  if (cell.terrainType === TERRAIN_TYPES.WATER) {
    return "water";
  }

  if (!cell.terrainWalkable || !isCellBaseFullTerrain(cell)) {
    return "non_full_autotile";
  }

  const placementRuleRejection = getPlacementRuleRejectionReason({
    cell,
    cells,
    allowedTerrains: placementRules.allowedTerrains,
    requiresAutotileCategory: placementRules.requiresAutotileCategory,
    forbiddenAutotileCategories: globalPlacement.doNotPlaceOnTransitions
      ? normalizeMetadataListField(globalPlacement.forbiddenAutotileCategories)
      : [],
    requiresResolvedFullAutotile: Boolean(globalPlacement.onlyOnResolvedFullAutotiles),
    requiresFullNeighborRing: Boolean(placementRules.requiresFullNeighborRing),
    forbiddenNearbyTerrains: placementRules.forbiddenNearbyTerrains,
  });
  if (placementRuleRejection) {
    return placementRuleRejection === "forbidden_terrain"
      ? "invalid_terrain"
      : placementRuleRejection;
  }

  if (!matchesSurfaceRule(entry, cell) || !matchesAvoidRule(entry, cell)) {
    return "spawn_rule";
  }

  if (entry.group === "trees" && cell.terrainType !== TERRAIN_TYPES.GRASS_LIGHT) {
    return "invalid_terrain";
  }

  if (
    entry.group === "rocks" &&
    cell.terrainType !== TERRAIN_TYPES.GRASS_LIGHT &&
    cell.terrainType !== TERRAIN_TYPES.GRASS_DARK
  ) {
    return "invalid_terrain";
  }

  return null;
}

function createCollisionItems(renderItems) {
  return renderItems.filter(
    (item) => item.blocksMovement && item.collisionBox
  );
}

function getCellBoundsForChunk(chunkX, chunkY, padding = 0) {
  const startX = chunkX * CHUNK_TILE_SIZE - padding;
  const startY = chunkY * CHUNK_TILE_SIZE - padding;
  const endX = chunkX * CHUNK_TILE_SIZE + CHUNK_TILE_SIZE - 1 + padding;
  const endY = chunkY * CHUNK_TILE_SIZE + CHUNK_TILE_SIZE - 1 + padding;

  return { startX, endX, startY, endY };
}

// ─── Village exclusion mask helpers ──────────────────────────────────────────

// Returns the union bounding box (in village/atlas tile coords) of all village
// exclusion zones, padded by the exclusion padding.  Computed once and cached.
function _getVillageTileBoundsUnion() {
  if (_villageTileBoundsUnion !== undefined) return _villageTileBoundsUnion;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let any = false;

  for (const instance of WORLD_VILLAGE_INSTANCES) {
    const b = getVillageInstanceBounds(instance);
    if (!b) continue;
    // +1 extra so the padding ring around the village edge is covered.
    const pad = (VILLAGE_OCCUPIED_DECOR_PADDING_TILES || 1) + 1;
    minX = Math.min(minX, b.leftTile  - pad);
    minY = Math.min(minY, b.topTile   - pad);
    maxX = Math.max(maxX, b.rightTile  + pad);
    maxY = Math.max(maxY, b.bottomTile + pad);
    any = true;
  }

  _villageTileBoundsUnion = any ? { minX, minY, maxX, maxY } : null;
  return _villageTileBoundsUnion;
}

/**
 * Returns a per-chunk village exclusion descriptor, computed once and cached.
 * { mask: Uint8Array|null, hasAny: boolean, allExcluded: boolean, count: number }
 *
 * mask — flat Uint8Array(S²) where 1 = cell is village-excluded.
 *         null when hasAny is false (chunk entirely outside village bbox).
 * hasAny — false for every chunk that doesn't touch the village exclusion region.
 * allExcluded — true when every cell in the chunk is village-excluded.
 */
function getChunkVillageExclusionMask(chunkX, chunkY) {
  const cacheKey = chunkX * 100003 + chunkY;
  const cached = _chunkExclusionCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const vb = _getVillageTileBoundsUnion();
  const csx = chunkX * CHUNK_TILE_SIZE;
  const csy = chunkY * CHUNK_TILE_SIZE;

  // Quick AABB test — most chunks in the world are outside village range.
  if (
    !vb ||
    csx + CHUNK_TILE_SIZE - 1 < vb.minX || csx > vb.maxX ||
    csy + CHUNK_TILE_SIZE - 1 < vb.minY || csy > vb.maxY
  ) {
    const result = { mask: null, hasAny: false, allExcluded: false, count: 0 };
    _chunkExclusionCache.set(cacheKey, result);
    return result;
  }

  const S = CHUNK_TILE_SIZE;
  const mask = new Uint8Array(S * S);
  let count = 0;

  for (let lx = 0; lx < S; lx += 1) {
    for (let ly = 0; ly < S; ly += 1) {
      if (isWorldTileExcludedByVillageDecor(csx + lx, csy + ly)) {
        mask[lx * S + ly] = 1;
        count += 1;
      }
    }
  }

  const result = {
    mask: count > 0 ? mask : null,
    hasAny: count > 0,
    allExcluded: count === S * S,
    count,
  };
  _chunkExclusionCache.set(cacheKey, result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────

function createDecorEligibilityCache(cells, chunkX, chunkY, worldDecorStats = null) {
  const EMPTY_POOLS = Object.freeze({
    grass_light_full: [],
    grass_dark_full: [],
    sand_full: [],
    road_full: [],
    water_full: [],
    water_all: [],
    near_sand_grass_light_full: [],
    near_road_grass_light_full: [],
  });

  // Fetch the cached per-chunk village exclusion mask (O(1) after first call per chunk).
  const villageExcl = getChunkVillageExclusionMask(chunkX, chunkY);

  if (villageExcl.allExcluded) {
    // Every cell in the chunk is village-occupied → all pools stay empty.
    // placeMetadataTileFamilies will short-circuit without any pool scoring.
    if (worldDecorStats) {
      worldDecorStats.villageExcludedCells += villageExcl.count;
      worldDecorStats.villageChunkEarlyOut = true;
    }
    return EMPTY_POOLS;
  }

  const pools = {
    grass_light_full: [],
    grass_dark_full: [],
    sand_full: [],
    road_full: [],
    water_full: [],
    water_all: [],
    near_sand_grass_light_full: [],
    near_road_grass_light_full: [],
  };

  const ownedBounds = getCellBoundsForChunk(chunkX, chunkY, 0);

  // Precompute sand/road adjacency via flat-array dilation.
  const ADJ_RADIUS = 2;
  const padStartX = ownedBounds.startX - ADJ_RADIUS;
  const padStartY = ownedBounds.startY - ADJ_RADIUS;
  const spanX = ownedBounds.endX - ownedBounds.startX + 1 + ADJ_RADIUS * 2;
  const spanY = ownedBounds.endY - ownedBounds.startY + 1 + ADJ_RADIUS * 2;
  const nearSand = new Uint8Array(spanX * spanY);
  const nearRoad = new Uint8Array(spanX * spanY);

  for (let gx = padStartX; gx < padStartX + spanX; gx += 1) {
    for (let gy = padStartY; gy < padStartY + spanY; gy += 1) {
      const c = getCell(cells, gx, gy);
      if (!c) continue;
      const isSand = c.terrainType === TERRAIN_TYPES.SAND;
      const isRoad = c.terrainType === TERRAIN_TYPES.ROAD;
      if (!isSand && !isRoad) continue;

      for (let dx = -ADJ_RADIUS; dx <= ADJ_RADIUS; dx += 1) {
        for (let dy = -ADJ_RADIUS; dy <= ADJ_RADIUS; dy += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = gx + dx - padStartX;
          const ny = gy + dy - padStartY;
          if (nx < 0 || ny < 0 || nx >= spanX || ny >= spanY) continue;
          const idx = nx * spanY + ny;
          if (isSand) nearSand[idx] = 1;
          if (isRoad) nearRoad[idx] = 1;
        }
      }
    }
  }

  const S = CHUNK_TILE_SIZE;
  const exclMask = villageExcl.mask; // null when no village cells in this chunk
  let villageSkipped = 0;

  for (let gridX = ownedBounds.startX; gridX <= ownedBounds.endX; gridX += 1) {
    for (let gridY = ownedBounds.startY; gridY <= ownedBounds.endY; gridY += 1) {
      // Village exclusion: O(1) flat-array lookup when there are exclusions in
      // this chunk; zero-cost (no branch taken) when mask is null.
      if (exclMask) {
        const lx = gridX - ownedBounds.startX;
        const ly = gridY - ownedBounds.startY;
        if (exclMask[lx * S + ly]) {
          villageSkipped += 1;
          continue;
        }
      }

      const cell = getCell(cells, gridX, gridY);
      if (!cell || !cell.autotile) continue;
      if (!isCellBaseFullTerrain(cell) && cell.terrainType !== TERRAIN_TYPES.WATER) {
        continue;
      }

      if (cell.terrainType === TERRAIN_TYPES.GRASS_LIGHT && isCellBaseFullTerrain(cell)) {
        pools.grass_light_full.push(cell);
        const cx = gridX - padStartX;
        const cy = gridY - padStartY;
        const idx = cx * spanY + cy;
        if (nearSand[idx]) pools.near_sand_grass_light_full.push(cell);
        if (nearRoad[idx]) pools.near_road_grass_light_full.push(cell);
      } else if (
        cell.terrainType === TERRAIN_TYPES.GRASS_DARK &&
        isCellBaseFullTerrain(cell)
      ) {
        pools.grass_dark_full.push(cell);
      } else if (cell.terrainType === TERRAIN_TYPES.SAND && isCellBaseFullTerrain(cell)) {
        pools.sand_full.push(cell);
      } else if (cell.terrainType === TERRAIN_TYPES.ROAD && isCellBaseFullTerrain(cell)) {
        pools.road_full.push(cell);
      } else if (cell.terrainType === TERRAIN_TYPES.WATER) {
        pools.water_all.push(cell);
        if (cell.autotile.category === "full") {
          pools.water_full.push(cell);
        }
      }
    }
  }

  if (worldDecorStats && villageSkipped > 0) {
    worldDecorStats.villageExcludedCells += villageSkipped;
  }

  return pools;
}

function getDeterministicTargetCount(poolLength, density, cap, ...seedParts) {
  if (!poolLength || !Number.isFinite(density) || density <= 0) return 0;
  if (!Number.isFinite(cap) || cap <= 0) return 0;

  const rawCount = density * poolLength;
  let count = Math.floor(rawCount);
  const fractional = rawCount - count;

  if (fractional > 0 && hashUnit("world-target-count", ...seedParts) < fractional) {
    count += 1;
  }

  return Math.max(0, Math.min(cap, count));
}

function getDeterministicPoolOrder(pool, ...seedParts) {
  return [...pool].sort((a, b) => {
    const scoreA = hashUnit("world-pool-order", ...seedParts, a.gridX, a.gridY);
    const scoreB = hashUnit("world-pool-order", ...seedParts, b.gridX, b.gridY);
    if (scoreA !== scoreB) return scoreA - scoreB;
    if (a.gridY !== b.gridY) return a.gridY - b.gridY;
    return a.gridX - b.gridX;
  });
}

function getMetadataPoolScore(cell, familyId, chunkX, chunkY, definition = null) {
  const seedId = getMetadataPlacementSeedId(familyId, definition);
  const noiseScale = getMetadataPlacementNoiseScale(familyId);
  const clusterWeight = getMetadataPlacementClusterWeight(familyId);
  const familyPhase = hashUnit("metadata-pool-phase", seedId, familyId);
  const pocket =
    valueNoise(
      cell.gridX + chunkX * 7.3 + familyPhase * 9.1,
      cell.gridY - chunkY * 6.1 - familyPhase * 7.7,
      `metadata-pocket:${seedId}`,
      noiseScale
    ) * clusterWeight;
  const drift =
    valueNoise(
      cell.gridX * 0.82 + chunkY * 5.7 - familyPhase * 6.3,
      cell.gridY * 0.74 - chunkX * 4.9 + familyPhase * 5.1,
      `metadata-drift:${seedId}`,
      Math.max(0.05, noiseScale * 0.5)
    ) *
    (1 - clusterWeight * 0.38);
  const micro = hashUnit(
    "metadata-pool-order",
    familyId,
    seedId,
    chunkX,
    chunkY,
    cell.gridX,
    cell.gridY
  );
  const laneBreak =
    Math.abs(
      (hashUnit("metadata-pool-lane-x", familyId, seedId, chunkX, cell.gridY, cell.gridX) - 0.5) -
        (hashUnit("metadata-pool-lane-y", familyId, seedId, chunkY, cell.gridX, cell.gridY) - 0.5)
    ) * 2;
  const stagger =
    hashUnit(
      "metadata-pool-stagger",
      familyId,
      seedId,
      definition?.id || "default",
      cell.gridX + cell.gridY,
      cell.gridY - cell.gridX
    );
  const chunkCenterX = chunkX * CHUNK_TILE_SIZE + CHUNK_TILE_SIZE * 0.5;
  const chunkCenterY = chunkY * CHUNK_TILE_SIZE + CHUNK_TILE_SIZE * 0.5;
  const centerDistance =
    (Math.abs(cell.gridX - chunkCenterX) + Math.abs(cell.gridY - chunkCenterY)) /
    CHUNK_TILE_SIZE;
  const centerBias =
    normalizePlacementRuleFamilyId(familyId) === "atlas_trees"
      ? Math.max(0, 1 - centerDistance) * 0.42
      : 0;

  return (
    pocket * 0.36 +
    drift * 0.18 +
    laneBreak * 0.24 +
    stagger * 0.14 +
    micro * 0.08 +
    centerBias
  );
}

// ─── Fast integer-only hashing helpers ───────────────────────────────────────
// These allow valueNoiseFast() to skip String() allocation for integer corners.

// Append integer n's decimal digits into a running FNV-1a hash state.
function _hashIntDigits(h, n) {
  if (n === 0) {
    h ^= 48; // '0'
    return Math.imul(h, 16777619);
  }
  if (n < 0) {
    h ^= 45; // '-'
    h = Math.imul(h, 16777619);
    n = -n;
  }
  let d = 1;
  while (d * 10 <= n) d *= 10;
  while (d >= 1) {
    h ^= ((n / d | 0) % 10) + 48;
    h = Math.imul(h, 16777619);
    d = d / 10 | 0;
  }
  return h;
}

// Pre-hash a seed string and its trailing separator so the per-corner call
// only processes two small integers — no String() allocation for coordinates.
function _hashSeedPart(seed) {
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= 124; // '|' separator between seed and first integer arg
  return Math.imul(h, 16777619);
}

// hashUnit(seed, x, y) equivalent but allocation-free for integer x/y.
function _hashCornerFast(seedH, x, y) {
  let h = _hashIntDigits(seedH, x);
  h ^= 124; // separator between x and y
  h = Math.imul(h, 16777619);
  h = _hashIntDigits(h, y);
  return (h >>> 0) / 4294967295;
}

// valueNoise() variant that takes a pre-hashed seed (from _hashSeedPart).
function _valueNoiseFast(x, y, seedH, scale) {
  const nx = x * scale;
  const ny = y * scale;
  const x0 = Math.floor(nx);
  const y0 = Math.floor(ny);
  const sx = smoothstep(nx - x0);
  const sy = smoothstep(ny - y0);
  return lerp(
    lerp(_hashCornerFast(seedH, x0,     y0),     _hashCornerFast(seedH, x0 + 1, y0),     sx),
    lerp(_hashCornerFast(seedH, x0,     y0 + 1), _hashCornerFast(seedH, x0 + 1, y0 + 1), sx),
    sy
  );
}

// Module-level scratch arrays reused across getDeterministicMetadataPoolOrder calls
// to avoid allocating N {cell, score, tie} objects per chunk family.
let _mdScores = [];
let _mdTies = [];
let _mdIndices = [];

function getDeterministicMetadataPoolOrder(pool, familyId, chunkX, chunkY, definition = null) {
  const n = pool.length;
  if (n <= 1) return pool;

  const seedId = getMetadataPlacementSeedId(familyId, definition);
  const noiseScale = getMetadataPlacementNoiseScale(familyId);
  const clusterWeight = getMetadataPlacementClusterWeight(familyId);
  const familyPhase = hashUnit("metadata-pool-phase", seedId, familyId);
  const driftNoiseScale = Math.max(0.05, noiseScale * 0.5);
  const definitionId = definition?.id || "default";
  const pocketBaseX = chunkX * 7.3 + familyPhase * 9.1;
  const pocketBaseY = -chunkY * 6.1 - familyPhase * 7.7;
  const driftBaseX = chunkY * 5.7 - familyPhase * 6.3;
  const driftBaseY = -chunkX * 4.9 + familyPhase * 5.1;
  const chunkCenterX = chunkX * CHUNK_TILE_SIZE + CHUNK_TILE_SIZE * 0.5;
  const chunkCenterY = chunkY * CHUNK_TILE_SIZE + CHUNK_TILE_SIZE * 0.5;
  const isAtlasTrees = normalizePlacementRuleFamilyId(familyId) === "atlas_trees";

  // Pre-hash seed strings once; _valueNoiseFast reuses them per corner without String().
  const pocketSeedH = _hashSeedPart(`metadata-pocket:${seedId}`);
  const driftSeedH  = _hashSeedPart(`metadata-drift:${seedId}`);

  // Grow scratch arrays on demand (never shrink — amortised O(1)).
  while (_mdScores.length < n) {
    _mdScores.push(0);
    _mdTies.push(0);
    _mdIndices.push(0);
  }

  for (let i = 0; i < n; i++) {
    const cell = pool[i];
    const pocket =
      _valueNoiseFast(cell.gridX + pocketBaseX, cell.gridY + pocketBaseY, pocketSeedH, noiseScale) *
      clusterWeight;
    const drift =
      _valueNoiseFast(cell.gridX * 0.82 + driftBaseX, cell.gridY * 0.74 + driftBaseY, driftSeedH, driftNoiseScale) *
      (1 - clusterWeight * 0.38);
    const micro    = hashUnit("metadata-pool-order",   familyId, seedId, chunkX, chunkY, cell.gridX, cell.gridY);
    const laneBreak =
      Math.abs(
        (hashUnit("metadata-pool-lane-x", familyId, seedId, chunkX, cell.gridY, cell.gridX) - 0.5) -
        (hashUnit("metadata-pool-lane-y", familyId, seedId, chunkY, cell.gridX, cell.gridY) - 0.5)
      ) * 2;
    const stagger = hashUnit("metadata-pool-stagger", familyId, seedId, definitionId, cell.gridX + cell.gridY, cell.gridY - cell.gridX);
    let centerBias = 0;
    if (isAtlasTrees) {
      const d = (Math.abs(cell.gridX - chunkCenterX) + Math.abs(cell.gridY - chunkCenterY)) / CHUNK_TILE_SIZE;
      centerBias = Math.max(0, 1 - d) * 0.42;
    }
    _mdScores[i]  = pocket * 0.36 + drift * 0.18 + laneBreak * 0.24 + stagger * 0.14 + micro * 0.08 + centerBias;
    _mdTies[i]    = hashUnit("metadata-pool-tie", familyId, chunkX, chunkY, cell.gridX, cell.gridY);
    _mdIndices[i] = i;
  }

  // Sort the index array in-place — avoids the pool.map + scored.map allocations.
  const indices = _mdIndices;
  const scores  = _mdScores;
  const ties    = _mdTies;
  indices.length = n;
  indices.sort((a, b) => {
    const ds = scores[b] - scores[a];
    if (ds !== 0) return ds;
    const dt = ties[a] - ties[b];
    if (dt !== 0) return dt;
    const dy = pool[a].gridY - pool[b].gridY;
    if (dy !== 0) return dy;
    return pool[a].gridX - pool[b].gridX;
  });

  const result = new Array(n);
  for (let i = 0; i < n; i++) result[i] = pool[indices[i]];
  return result;
}

function getMetadataPoolForDefinition(definition, eligibility) {
  const allowedTerrains = normalizeMetadataListField(definition.allowedTerrains);
  const nearTerrain = normalizeMetadataListField(definition.nearTerrain);

  if (
    allowedTerrains.length === 1 &&
    allowedTerrains[0] === TERRAIN_TYPES.GRASS_LIGHT &&
    nearTerrain.includes(TERRAIN_TYPES.SAND)
  ) {
    return eligibility.near_sand_grass_light_full;
  }

  if (
    allowedTerrains.length === 1 &&
    allowedTerrains[0] === TERRAIN_TYPES.GRASS_LIGHT &&
    nearTerrain.includes(TERRAIN_TYPES.ROAD)
  ) {
    return eligibility.near_road_grass_light_full;
  }

  if (allowedTerrains.length === 1) {
    switch (allowedTerrains[0]) {
      case TERRAIN_TYPES.GRASS_LIGHT:
        return eligibility.grass_light_full;
      case TERRAIN_TYPES.GRASS_DARK:
        return eligibility.grass_dark_full;
      case TERRAIN_TYPES.SAND:
        return eligibility.sand_full;
      case TERRAIN_TYPES.ROAD:
        return eligibility.road_full;
      case TERRAIN_TYPES.WATER:
        return eligibility.water_full;
      default:
        break;
    }
  }

  if (
    allowedTerrains.includes(TERRAIN_TYPES.GRASS_LIGHT) &&
    allowedTerrains.includes(TERRAIN_TYPES.GRASS_DARK)
  ) {
    return [...eligibility.grass_light_full, ...eligibility.grass_dark_full];
  }

  if (allowedTerrains.includes(TERRAIN_TYPES.GRASS_LIGHT)) {
    return eligibility.grass_light_full;
  }

  return [];
}

function getMetadataAnimationPool(animation, eligibility) {
  if (isWaterSparkleAnimationId(animation.id)) {
  return eligibility.water_full;
}

  return getMetadataPoolForDefinition(animation, eligibility);
}

function getTerrainAutotileResolveOptions(terrainType) {
  const excludedTemplateIds = AUTOTILE_TEMPLATE_EXCLUSIONS_BY_TERRAIN[terrainType] || null;
  if (!excludedTemplateIds?.length) {
    return undefined;
  }

  return {
    excludedTemplateIds,
  };
}

function buildTerrainCellsForChunk(chunkX, chunkY) {
  const sampler = getSharedTerrainSampler();
  const sampledBounds = getCellBoundsForChunk(
    chunkX,
    chunkY,
    CHUNK_GENERATION_PADDING_TILES
  );
  const { terrainByCell } = generateLogicalTerrainGrid(sampledBounds, { sampler });
  const cells = new Map();
  const getTerrainAt = (gridX, gridY) =>
    terrainByCell.get(getCellKey(gridX, gridY)) || sampler.getTerrainType(gridX, gridY);

  for (let gridX = sampledBounds.startX; gridX <= sampledBounds.endX; gridX += 1) {
    for (let gridY = sampledBounds.startY; gridY <= sampledBounds.endY; gridY += 1) {
      const terrainType = getTerrainAt(gridX, gridY);
      const cell = createTerrainCell(gridX, gridY, terrainType);
      const resolved = resolveTerrainAutotile(
        getTerrainAt,
        gridX,
        gridY,
        getTerrainAutotileResolveOptions(terrainType)
      );
      cell.autotile = resolved;
      cell.baseEntry = resolved.entry;

      if (terrainType === TERRAIN_TYPES.ROAD) {
        setPrimarySurface(cell, "road");
      } else if (terrainType === TERRAIN_TYPES.WATER) {
        setPrimarySurface(cell, "water");
      } else if (terrainType === TERRAIN_TYPES.GRASS_LIGHT || terrainType === TERRAIN_TYPES.GRASS_DARK) {
        setPrimarySurface(cell, "grass");
      }

      cells.set(cell.id, cell);
    }
  }

  return { cells, sampler };
}

function createTerrainTileItemsForChunk(cells, chunkX, chunkY, terrainAutotileStats) {
  const ownedBounds = getCellBoundsForChunk(chunkX, chunkY, 0);
  const renderItems = [];

  for (let gridX = ownedBounds.startX; gridX <= ownedBounds.endX; gridX += 1) {
    for (let gridY = ownedBounds.startY; gridY <= ownedBounds.endY; gridY += 1) {
      const cell = getCell(cells, gridX, gridY);
      if (!cell?.autotile?.entry) continue;

      recordTerrainAutotileResolution(terrainAutotileStats, cell.autotile);
      const item = createTileItem(cell.autotile.entry, gridX, gridY, {
        id: `terrain_${gridX}_${gridY}`,
      });
      item.terrainType = cell.terrainType;
      item.sourceTerrainType = cell.terrainType;
      item.isTerrainTile = true;
      renderItems.push(item);
    }
  }

  return renderItems;
}

function placeLegacyObjects({
  atlasData,
  content,
  chunkX,
  chunkY,
  cells,
  eligibility,
  renderItems,
  occupancy,
  worldDecorStats,
  objectSpawnStats,
}) {
  const familyPlans = [];

  familyPlans.forEach((plan) => {
    if (!plan.entries.length || !plan.pool.length || !isWorldDecorFamilyEnabled(plan.familyId)) {
      return;
    }

    const density = getWorldDecorDensityValue(plan.familyId, "very_low");
    const cap = getWorldDecorChunkCap(plan.familyId);
    const targetCount = getDeterministicTargetCount(
      plan.pool.length,
      density,
      cap,
      atlasData?.meta?.name || "atlas",
      plan.familyId,
      chunkX,
      chunkY
    );

    if (targetCount <= 0) return;

    const orderedPool = getDeterministicPoolOrder(
      plan.pool,
      plan.familyId,
      chunkX,
      chunkY
    );
    let placedCount = 0;

    for (const cell of orderedPool) {
      if (placedCount >= targetCount) break;

      const entry = chooseWeightedEntry(
        plan.entries,
        plan.familyId,
        chunkX,
        chunkY,
        cell.gridX,
        cell.gridY
      );

      if (!entry) continue;

      recordObjectSpawnAttempt(objectSpawnStats);
      if (!canPlaceEntryOnCell(entry, cells, cell.gridX, cell.gridY, objectSpawnStats)) {
        continue;
      }

      const point = projectRawPointToDecorBase(
        entry,
        cell.x + WORLD_ATLAS_TILE_SIZE * 0.5,
        cell.y + WORLD_ATLAS_TILE_SIZE * 0.75,
        `${plan.familyId}:${chunkX}:${chunkY}`,
        cell.gridX * 31 + cell.gridY
      );
      const occupancyRadius = Math.max(
        getPlacementRadius(entry),
        getWorldDecorMinDistancePixels(plan.familyId)
      );

      if (isOccupied(occupancy, point.x, point.y, occupancyRadius)) {
        recordObjectSpawnRejected(objectSpawnStats, "collision_overlap");
        continue;
      }

      const item = createObjectItem(
        entry,
        point.x,
        point.y,
        `${plan.familyId}:${chunkX}:${chunkY}`,
        {
          id: `${plan.familyId}_${chunkX}_${chunkY}_${cell.gridX}_${cell.gridY}`,
        }
      );

      item.worldDecorFamily = plan.familyId;
      item.sourceTerrainType = cell.terrainType;
      renderItems.push(item);
      reserveOccupancy(occupancy, point.x, point.y, occupancyRadius);
      markContextAroundBasePoint(cells, point.x, point.y, plan.context, 3);
      recordObjectSpawnPlaced(objectSpawnStats);
      placedCount += 1;
    }
  });

  recordWorldDecorTreeStats(
    worldDecorStats,
    renderItems.filter((item) => item.worldDecorFamily === "trees")
  );
}

function placeMetadataTileFamilies({
  chunkX,
  chunkY,
  cells,
  eligibility,
  renderItems,
  occupancy,
  worldDecorOccupancy,
  metadataOccupancyGrid,
  worldDecorStats,
}) {
  // Skip the entire family sort + scoring pipeline when all eligibility pools
  // are empty (typical for fully village-covered chunks).
  if (
    !eligibility.grass_light_full.length &&
    !eligibility.grass_dark_full.length &&
    !eligibility.sand_full.length &&
    !eligibility.road_full.length &&
    !eligibility.water_full.length &&
    !eligibility.water_all.length &&
    !eligibility.near_sand_grass_light_full.length &&
    !eligibility.near_road_grass_light_full.length
  ) {
    if (worldDecorStats) worldDecorStats.placementCallsAvoided += 1;
    return;
  }

  const familyPlacementStates = new Map();
  const familyVariantPlacements = new Map();
  const chunkCounts = new Map();
  const reservedCells = new Set();
  const placementBudget = createWorldDecorPlacementBudget();

  const orderedMetadataFamilies = Object.entries(WORLD_TILE_METADATA_TILES_BY_FAMILY).sort(
    ([familyIdA], [familyIdB]) => {
      const priorityDelta =
        getWorldDecorPriority(familyIdB) - getWorldDecorPriority(familyIdA);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return familyIdA.localeCompare(familyIdB);
    }
  );

  orderedMetadataFamilies.forEach(([familyId, definitions]) => {
    if (!definitions?.length || !isWorldDecorFamilyEnabled(familyId)) {
      return;
    }

    const pool = getMetadataPoolForDefinition(definitions[0], eligibility);
    recordWorldDecorEligiblePoolSize(worldDecorStats, familyId, pool.length);

    if (!pool.length) {
      recordWorldDecorSkipped(worldDecorStats, familyId, "empty_pool");
      return;
    }

    const density = getWorldDecorDensityValue(
      familyId,
      definitions[0].densityKey || "low"
    );
    const cap = getWorldDecorChunkCap(familyId);
    const targetCount = getDeterministicTargetCount(
      pool.length,
      density,
      cap,
      familyId,
      chunkX,
      chunkY
    );

    if (targetCount <= 0) return;

    const orderedPool = getDeterministicMetadataPoolOrder(
      pool,
      familyId,
      chunkX,
      chunkY,
      definitions[0]
    );
    let placedCount = 0;

    for (const cell of orderedPool) {
      if (placedCount >= targetCount) break;

      const definition = chooseMetadataVariantForCell(
        definitions,
        familyId,
        cell,
        familyVariantPlacements,
        familyId,
        chunkX,
        chunkY,
        cell.gridX,
        cell.gridY
      );

      if (!definition) continue;
      recordWorldDecorCandidateAttempt(worldDecorStats);

      const item = placeMetadataTileItem({
        cells,
        definition,
        cell,
        renderItems,
        occupancy,
        worldDecorOccupancy,
        metadataOccupancyGrid,
        familyPlacementStates,
        familyVariantPlacements,
        chunkCounts,
        placementBudget,
        reservedCells,
        stats: worldDecorStats,
      });

      if (item) {
        placedCount += 1;
      }
    }
  });
}

function placeMetadataAnimations({
  chunkX,
  chunkY,
  cells,
  eligibility,
  renderItems,
  occupancy,
  worldDecorOccupancy,
  metadataOccupancyGrid,
  worldDecorStats,
}) {
  // Animations only spawn on water tiles; skip if the water pool is empty.
  if (!eligibility.water_all.length && !eligibility.water_full.length) {
    if (worldDecorStats) worldDecorStats.placementCallsAvoided += 1;
    return;
  }

  const familyPlacementStates = new Map();
  const familyVariantPlacements = new Map();
  const chunkCounts = new Map();
  const reservedCells = new Set();
  const placementBudget = createWorldDecorPlacementBudget();

  const devWaterLog = import.meta.env.DEV
    ? { placedA: 0, placedB: 0, poolA: 0, poolB: 0, rejectedReasons: {} }
    : null;

  Object.values(WORLD_TILE_METADATA_ANIMATIONS).forEach((animation) => {
    const familyId = animation.id;
    if (!animation?.enabled || !animation.spawnable || !isWorldDecorFamilyEnabled(familyId)) {
      return;
    }

    const pool = getMetadataAnimationPool(animation, eligibility);
    recordWorldDecorEligiblePoolSize(worldDecorStats, familyId, pool.length);

    if (devWaterLog) {
      if (familyId === "water_idle_sparkle_loop_a") devWaterLog.poolA = pool.length;
      if (familyId === "water_idle_sparkle_loop_b") devWaterLog.poolB = pool.length;
    }

    if (!pool.length) {
      recordWorldDecorSkipped(worldDecorStats, familyId, "empty_pool");
      return;
    }

    const density = getWorldDecorDensityValue(familyId, animation.densityKey || "low");
    const cap = getWorldDecorChunkCap(familyId);
    const targetCount = getDeterministicTargetCount(
      pool.length,
      density,
      cap,
      familyId,
      chunkX,
      chunkY
    );

    if (targetCount <= 0) return;

    const isWaterSparkle = isWaterSparkleAnimationId(familyId);
    const orderedPool = getDeterministicMetadataPoolOrder(
      pool,
      familyId,
      chunkX,
      chunkY,
      animation
    );
    let placedCount = 0;

    for (const cell of orderedPool) {
      if (placedCount >= targetCount) break;
      recordWorldDecorCandidateAttempt(worldDecorStats);

      // Water sparkles bypass the global full-autotile restriction — they look fine
      // on any water cell (including edges), and small ponds have no full-category cells.
      const staticRejection = getMetadataStaticCellRejectionReason(animation, cell, cells);
      if (staticRejection) {
        recordWorldDecorRejected(worldDecorStats, familyId, staticRejection);
        if (devWaterLog && isWaterSparkle) {
          devWaterLog.rejectedReasons[staticRejection] = (devWaterLog.rejectedReasons[staticRejection] || 0) + 1;
        }
        continue;
      }

      const chunkCapReason = getWorldDecorBudgetRejectionReason(
        placementBudget,
        cell,
        true,
        familyId
      );
      if (chunkCapReason) {
        recordWorldDecorRejected(worldDecorStats, familyId, chunkCapReason);
        continue;
      }

      if (reservedCells.has(getMetadataReservationKey(cell.gridX, cell.gridY))) {
        recordWorldDecorRejected(worldDecorStats, familyId, "overlap");
        continue;
      }

      const minDistancePixels = getWorldDecorMinDistancePixels(familyId);
      const placementPoint = getMetadataPlacementPoint(cell, familyId, animation, {
        anchorMode: "object",
      });
      if (
        minDistancePixels > 0 &&
        isOccupied(
          getWorldDecorPlacementState(familyPlacementStates, familyId),
          placementPoint.x,
          placementPoint.y,
          minDistancePixels
        )
      ) {
        recordWorldDecorRejected(worldDecorStats, familyId, "too_close");
        continue;
      }

      recordWorldDecorExactOverlapCheck(worldDecorStats);
      if (
        isOccupied(occupancy, placementPoint.x, placementPoint.y, WORLD_ATLAS_TILE_SIZE * 0.3) ||
        isOccupied(
          worldDecorOccupancy,
          placementPoint.x,
          placementPoint.y,
          Math.max(WORLD_ATLAS_TILE_SIZE * 0.2, minDistancePixels)
        )
      ) {
        recordWorldDecorRejected(worldDecorStats, familyId, "overlap");
        continue;
      }

      const item = createMetadataAnimatedObjectItem(animation, cell, placementPoint);
      item.worldDecorFamily = familyId;
      item.isWorldMetadata = true;
      item.isWorldMetadataAnimation = true;
      item.sourceTerrainType = cell.terrainType;
      renderItems.push(item);

      reservedCells.add(getMetadataReservationKey(cell.gridX, cell.gridY));
      incrementWorldDecorChunkCount(chunkCounts, cell.gridX, cell.gridY, familyId);
      reserveOccupancy(
        worldDecorOccupancy,
        placementPoint.x,
        placementPoint.y,
        Math.max(WORLD_ATLAS_TILE_SIZE * 0.2, minDistancePixels)
      );
      reserveMetadataGridCell(metadataOccupancyGrid, cell);
      if (minDistancePixels > 0) {
        reservePlacement(
          getWorldDecorPlacementState(familyPlacementStates, familyId),
          placementPoint.x,
          placementPoint.y,
          minDistancePixels
        );
      }
      consumeWorldDecorPlacementBudget(placementBudget, cell, true);
      recordWorldDecorPlaced(worldDecorStats, familyId, {
        itemId: item.id,
        isAnimation: true,
      });
      placedCount += 1;

      if (devWaterLog) {
        if (familyId === "water_idle_sparkle_loop_a") devWaterLog.placedA += 1;
        if (familyId === "water_idle_sparkle_loop_b") devWaterLog.placedB += 1;
      }
    }
  });

  if (
    import.meta.env.DEV &&
    SHOW_WORLD_PERF_DEBUG &&
    devWaterLog &&
    (devWaterLog.poolA > 0 ||
      devWaterLog.poolB > 0 ||
      devWaterLog.placedA > 0 ||
      devWaterLog.placedB > 0)
  ) {
    console.debug(`[water-animations] chunk=(${chunkX},${chunkY})`, {
      placedA: devWaterLog.placedA,
      placedB: devWaterLog.placedB,
      poolA: devWaterLog.poolA,
      poolB: devWaterLog.poolB,
      rejectedReasons: devWaterLog.rejectedReasons,
    });
  }
}

function buildChunkLayout(chunkX, chunkY, atlasData) {
  const startedAt =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  const perf = {
    lastTerrainDurationMs: 0,
    lastObjectDurationMs: 0,
    lastDecorDurationMs: 0,
  };

  const terrainAutotileStats = createTerrainAutotileStats();
  const objectSpawnStats = createObjectSpawnStats();
  const worldDecorStats = createWorldDecorStats();
  const terrainStartedAt = performance.now();
  const { cells } = buildTerrainCellsForChunk(chunkX, chunkY);
  const renderItems = createTerrainTileItemsForChunk(
    cells,
    chunkX,
    chunkY,
    terrainAutotileStats
  );
  perf.lastTerrainDurationMs = performance.now() - terrainStartedAt;

  const occupancy = createOccupancyState();
  const worldDecorOccupancy = createOccupancyState();
  const metadataOccupancyGrid = createMetadataOccupancyGrid();
  const content = getAtlasContent(atlasData);
  const eligibility = createDecorEligibilityCache(cells, chunkX, chunkY, worldDecorStats);

  Object.entries(eligibility).forEach(([poolKey, pool]) => {
    recordWorldDecorEligiblePoolSize(worldDecorStats, poolKey, pool.length);
  });
  recordWorldDecorTerrainStats(worldDecorStats, cells);
  recordWorldDecorFullWaterCells(worldDecorStats, eligibility.water_full.length);

  const objectStartedAt = performance.now();
  placeLegacyObjects({
    atlasData,
    content,
    chunkX,
    chunkY,
    cells,
    eligibility,
    renderItems,
    occupancy,
    worldDecorStats,
    objectSpawnStats,
  });
  perf.lastObjectDurationMs = performance.now() - objectStartedAt;

  const decorStartedAt = performance.now();
  placeMetadataTileFamilies({
    chunkX,
    chunkY,
    cells,
    eligibility,
    renderItems,
    occupancy,
    worldDecorOccupancy,
    metadataOccupancyGrid,
    worldDecorStats,
  });
  placeMetadataAnimations({
    chunkX,
    chunkY,
    cells,
    eligibility,
    renderItems,
    occupancy,
    worldDecorOccupancy,
    metadataOccupancyGrid,
    worldDecorStats,
  });
  perf.lastDecorDurationMs = performance.now() - decorStartedAt;

  const finalized = finalizeChunkLayout(chunkX, chunkY, {
    renderItems,
    terrainAutotileStats,
    objectSpawnStats,
    worldDecorStats,
    perf: {
      lastChunkDurationMs:
        (typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now()) - startedAt,
      ...perf,
    },
  });

  if (import.meta.env.DEV && SHOW_WORLD_PERF_DEBUG) {
    const p = finalized.perf;
    // eslint-disable-next-line no-console
    console.log(
      `[buildChunkLayout] (${chunkX},${chunkY}) total=${p.lastChunkDurationMs.toFixed(1)}ms` +
        ` terrain=${p.lastTerrainDurationMs.toFixed(1)} obj=${p.lastObjectDurationMs.toFixed(1)}` +
        ` decor=${p.lastDecorDurationMs.toFixed(1)}`
    );
  }

  if (import.meta.env.DEV && DEBUG_CHUNK_PERFORMANCE) {
    const p = finalized.perf;
    if (p.lastChunkDurationMs > DEBUG_CHUNK_SLOW_THRESHOLD_MS) {
      const wds = worldDecorStats;
      // eslint-disable-next-line no-console
      console.warn(
        `[ChunkGen] SLOW (${chunkX},${chunkY}) total=${p.lastChunkDurationMs.toFixed(1)}ms` +
          ` terrain=${p.lastTerrainDurationMs.toFixed(1)} obj=${p.lastObjectDurationMs.toFixed(1)}` +
          ` decor=${p.lastDecorDurationMs.toFixed(1)}` +
          (wds.villageExcludedCells > 0 ? ` villageExcl=${wds.villageExcludedCells}` : "") +
          (wds.villageChunkEarlyOut ? " [villageEarlyOut]" : "") +
          (wds.placementCallsAvoided > 0 ? ` placementAvoided=${wds.placementCallsAvoided}` : "")
      );
    }
  }

  return finalized;
}

function getChunkLayout(atlasData, chunkX, chunkY) {
  const chunkCache = getChunkCache(atlasData);
  const stats = getChunkStats(atlasData);
  const chunkKey = getChunkKey(chunkX, chunkY);
  const cached = chunkCache.get(chunkKey);

  if (cached) {
    stats.chunkCacheHits += 1;
    return cached;
  }

  stats.chunkCacheMisses += 1;
  const chunk = buildChunkLayout(chunkX, chunkY, atlasData);
  chunkCache.set(chunkKey, chunk);
  trimCache(chunkCache, MAX_CACHED_WORLD_CHUNKS);
  stats.generatedChunks += 1;
  stats.lastChunkDurationMs = chunk.perf?.lastChunkDurationMs || 0;
  stats.lastTerrainDurationMs = chunk.perf?.lastTerrainDurationMs || 0;
  stats.lastObjectDurationMs = chunk.perf?.lastObjectDurationMs || 0;
  stats.lastDecorDurationMs = chunk.perf?.lastDecorDurationMs || 0;

  return chunk;
}

/** Prewarm a single chunk — no-op if already cached. */
export function prewarmChunk(atlasData, chunkX, chunkY) {
  if (atlasData) getChunkLayout(atlasData, chunkX, chunkY);
}

/**
 * Returns every chunk coordinate that primeWorldAtlasWindow(includePreload:true)
 * would target for the given player position + viewport, sorted center-out
 * (same order as the runtime prewarm uses).  Use this to build the startup
 * prewarm queue so startup and runtime prewarm cover exactly the same window.
 *
 * Also returns the preloadChunkRange for debug/logging purposes.
 */
export function getStartupPreloadChunks(playerX, playerY, atlasData, viewport) {
  const normalizedViewport = normalizeViewport(viewport);
  const chunkWindow        = getChunkWindow(playerX, playerY, normalizedViewport);
  const chunkCache         = getChunkCache(atlasData);
  const { preloadChunkRange, activeChunkRange } = chunkWindow;

  const all = [];
  forEachChunkInRange(preloadChunkRange, (chunkX, chunkY) => {
    all.push({ chunkX, chunkY });
  });

  // Sort exactly as sortChunkCoordinatesForPrime does so the innermost
  // (active-range) chunks are generated first and survive any cache trim.
  const sorted = sortChunkCoordinatesForPrime(all, activeChunkRange);

  const missing = sorted.filter(({ chunkX, chunkY }) => {
    const key = getChunkKey(chunkX, chunkY);
    return !chunkCache.has(key);
  });

  return {
    chunks:           sorted,   // full preload range (all, including cached)
    missingChunks:    missing,  // only the ones that actually need generation
    preloadChunkRange,
    activeChunkRange,
    totalCount:       sorted.length,
    missingCount:     missing.length,
  };
}

function sortChunkCoordinatesForPrime(coords, activeRange, priority = { x: 0, y: 0 }) {
  const centerX = (activeRange.minChunkX + activeRange.maxChunkX) * 0.5;
  const centerY = (activeRange.minChunkY + activeRange.maxChunkY) * 0.5;

  return [...coords].sort((a, b) => {
    const distA = Math.abs(a.chunkX - centerX) + Math.abs(a.chunkY - centerY);
    const distB = Math.abs(b.chunkX - centerX) + Math.abs(b.chunkY - centerY);
    if (distA !== distB) return distA - distB;

    const dirA = a.chunkX * (priority.x || 0) + a.chunkY * (priority.y || 0);
    const dirB = b.chunkX * (priority.x || 0) + b.chunkY * (priority.y || 0);
    if (dirA !== dirB) return dirB - dirA;

    if (a.chunkY !== b.chunkY) return a.chunkY - b.chunkY;
    return a.chunkX - b.chunkX;
  });
}

export function primeWorldAtlasWindow(
  playerX,
  playerY,
  atlasData,
  viewport = DEFAULT_VIEWPORT,
  options = {}
) {
  if (!atlasData) {
    return {
      generatedCount: 0,
      generatedActiveCount: 0,
      missingCount: 0,
      remainingCount: 0,
      durationMs: 0,
    };
  }

  const startedAt = performance.now();
  const normalizedViewport = normalizeViewport(viewport);
  const chunkWindow = getChunkWindow(playerX, playerY, normalizedViewport);
  const targetRange = options.includePreload
    ? chunkWindow.preloadChunkRange
    : chunkWindow.activeChunkRange;
  const chunkCache = getChunkCache(atlasData);
  const missing = [];

  forEachChunkInRange(targetRange, (chunkX, chunkY) => {
    const key = getChunkKey(chunkX, chunkY);
    if (!chunkCache.has(key)) {
      missing.push({ chunkX, chunkY });
    }
  });

  const orderedMissing = sortChunkCoordinatesForPrime(
    missing,
    chunkWindow.activeChunkRange,
    options.priority
  );
  const maxChunks = Number.isFinite(options.maxChunks)
    ? Math.max(0, options.maxChunks)
    : orderedMissing.length;
  let generatedCount = 0;
  let generatedActiveCount = 0;

  for (const { chunkX, chunkY } of orderedMissing.slice(0, maxChunks)) {
    getChunkLayout(atlasData, chunkX, chunkY);
    generatedCount += 1;
    if (chunkInRange(chunkWindow.activeChunkRange, chunkX, chunkY)) {
      generatedActiveCount += 1;
    }
  }

  const durationMs = performance.now() - startedAt;
  const stats = getChunkStats(atlasData);
  stats.lastBatchDurationMs = durationMs;
  stats.lastBatchGeneratedCount = generatedCount;

  if (generatedActiveCount > 0) {
    // Active chunks changed — the cached combined layout for this window is stale.
    getLayoutCache(atlasData).clear();
  }

  return {
    generatedCount,
    generatedActiveCount,
    missingCount: orderedMissing.length,
    remainingCount: Math.max(0, orderedMissing.length - generatedCount),
    durationMs,
  };
}

function buildCombinedWorldLayout(playerX, playerY, atlasData, viewport = DEFAULT_VIEWPORT) {
  const normalizedViewport = normalizeViewport(viewport);
  const chunkWindow = getChunkWindow(playerX, playerY, normalizedViewport);
  const tileChunks = [];
  const collisionItems = [];
  const floatingItems = [];
  const terrainAutotileStats = createTerrainAutotileStats();
  const objectSpawnStats = createObjectSpawnStats();
  const worldDecorStats = createWorldDecorStats();
  const stats = getChunkStats(atlasData);

  forEachChunkInRange(chunkWindow.activeChunkRange, (chunkX, chunkY) => {
    const chunk = filterChunkVillageDecorItems(
      getChunkLayout(atlasData, chunkX, chunkY)
    );
    tileChunks.push(chunk);
    collisionItems.push(...chunk.collisionItems);
    floatingItems.push(...chunk.floatingItems);
    mergeTerrainAutotileStats(terrainAutotileStats, chunk.terrainAutotileStats);
    mergeObjectSpawnStats(objectSpawnStats, chunk.objectSpawnStats);
    mergeWorldDecorStats(worldDecorStats, chunk.worldDecorStats);
  });

  const budgeted = applyVisibleMetadataBudget(
    tileChunks,
    floatingItems,
    atlasData,
    playerX,
    playerY,
    chunkWindow,
    normalizedViewport
  );

  const keptRenderIds = new Set(budgeted.floatingItems.map((item) => item.id));
  const filteredChunks = budgeted.tileChunks.map((chunk) =>
    filterChunkTileItemsByVisibleParents(chunk, keptRenderIds)
  );
  const tileItemCount = filteredChunks.reduce(
    (total, chunk) =>
      total +
      chunk.tileBackItems.length +
      chunk.tileFrontItems.length +
      chunk.animatedTileBackItems.length +
      chunk.animatedTileFrontItems.length,
    0
  );

  maybeLogTerrainAutotileStats(terrainAutotileStats);
  maybeLogObjectSpawnStats(objectSpawnStats);
  maybeLogWorldDecorStats(worldDecorStats);

  if (
    DEBUG_VILLAGE_DECOR_OCCUPANCY &&
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    !window.__VILLAGE_DECOR_EXCLUSION_SAMPLE_LOGGED__
  ) {
    const playerTileX = Math.floor(playerX / WORLD_ATLAS_TILE_SIZE);
    const playerTileY = Math.floor(playerY / WORLD_ATLAS_TILE_SIZE);
    console.info(
      "[Solaria Village] decor exclusion sample:",
      getVillageDecorExclusionInfo(playerTileX, playerTileY)
    );
    window.__VILLAGE_DECOR_EXCLUSION_SAMPLE_LOGGED__ = true;
  }

  return {
    tileChunks: filteredChunks,
    renderItems: budgeted.floatingItems.sort(compareRenderItems),
    collisionItems,
    debug: {
      viewportBounds: chunkWindow.viewportBounds,
      activeBounds: chunkWindow.activeBounds,
      despawnBounds: chunkWindow.despawnBounds,
      collisionBounds: chunkWindow.collisionBounds,
      visibleChunkRange: chunkWindow.visibleChunkRange,
      activeChunkRange: chunkWindow.activeChunkRange,
      preloadChunkRange: chunkWindow.preloadChunkRange,
      despawnChunkRange: chunkWindow.despawnChunkRange,
      playerChunk: {
        x: Math.floor(playerX / getChunkPixelSize()),
        y: Math.floor(playerY / getChunkPixelSize()),
      },
      playerTerrain: getSharedTerrainSampler().getTerrainType(
        Math.floor(playerX / WORLD_ATLAS_TILE_SIZE),
        Math.floor(playerY / WORLD_ATLAS_TILE_SIZE)
      ),
      activeChunkCount: filteredChunks.length,
      preloadChunkCount:
        (chunkWindow.preloadChunkRange.maxChunkX - chunkWindow.preloadChunkRange.minChunkX + 1) *
        (chunkWindow.preloadChunkRange.maxChunkY - chunkWindow.preloadChunkRange.minChunkY + 1),
      cachedChunkCount: getChunkCache(atlasData).size,
      chunkTileSize: CHUNK_TILE_SIZE,
      renderedItemCount: budgeted.floatingItems.length + tileItemCount,
      renderedTileItemCount: tileItemCount,
      renderedFloatingItemCount: budgeted.floatingItems.length,
      collisionItemCount: collisionItems.length,
      terrainAutotileStats,
      objectSpawnStats,
      worldDecorStats,
      visibleDecorBudget: budgeted.debugStats || null,
      perf: { ...stats },
    },
  };
}

export function getWorldAtlasLayout(
  playerX,
  playerY,
  atlasData,
  viewport = DEFAULT_VIEWPORT
) {
  if (!atlasData) {
    return {
      tileChunks: [],
      renderItems: [],
      collisionItems: [],
      debug: null,
    };
  }

  const layoutKey = getWorldAtlasLayoutKey(playerX, playerY, viewport);
  const layoutCache = getLayoutCache(atlasData);
  const stats = getChunkStats(atlasData);

  const cached = layoutCache.get(layoutKey);
  if (cached) {
    stats.layoutCacheHits += 1;
    if (import.meta.env.DEV && SHOW_WORLD_PERF_DEBUG) {
      // eslint-disable-next-line no-console
      console.log(`[getWorldAtlasLayout] cache HIT key=${layoutKey}`);
    }
    return cached;
  }

  stats.layoutCacheMisses += 1;
  if (import.meta.env.DEV && SHOW_WORLD_PERF_DEBUG) {
    // eslint-disable-next-line no-console
    console.log(`[getWorldAtlasLayout] cache MISS key=${layoutKey}`);
  }

  const result = buildCombinedWorldLayout(playerX, playerY, atlasData, viewport);
  layoutCache.set(layoutKey, result);
  trimCache(layoutCache, MAX_CACHED_WORLD_WINDOWS);
  return result;
}

const _treeCollisionSourceLogged =
  import.meta.env.DEV && DEBUG_TREE_COLLISION_SOURCE ? new Set() : null;

export function getWorldAtlasCollisionBounds(item) {
  if (!item) {
    return { left: 0, top: 0, right: 0, bottom: 0 };
  }

  const scale = item.scale || 1;
  const renderWidth = (item.renderWidth || item.entry?.width || 0) * scale;
  const renderHeight = (item.renderHeight || item.entry?.height || 0) * scale;
  const anchorX = item.anchorMode === "tile" ? 0 : item.anchorX || 0.5;
  const anchorY = item.anchorMode === "tile" ? 0 : item.anchorY || 1;
  const spriteLeft = item.x - renderWidth * anchorX;
  const spriteTop = item.y - renderHeight * anchorY;

  // Priority 1: entry.collisionBox from JSON (unscaled — apply scale here).
  // This always wins over item.collisionBox, which may be a stale generic box.
  const entryBox = item.entry?.collisionBox;
  if (
    entryBox &&
    Number.isFinite(entryBox.offsetX) &&
    Number.isFinite(entryBox.offsetY) &&
    Number.isFinite(entryBox.width) &&
    entryBox.width > 0
  ) {
    const result = {
      left: spriteLeft + entryBox.offsetX * scale,
      top: spriteTop + entryBox.offsetY * scale,
      right: spriteLeft + (entryBox.offsetX + entryBox.width) * scale,
      bottom: spriteTop + (entryBox.offsetY + entryBox.height) * scale,
    };
    if (import.meta.env.DEV && DEBUG_TREE_COLLISION_SOURCE && item.entry?.group === "trees") {
      const entryId = item.entry?.id || item.entry?.name || item.id || null;
      if (entryId && !_treeCollisionSourceLogged.has(entryId)) {
        _treeCollisionSourceLogged.add(entryId);
        console.log("[tree-collision-source]", {
          entryId,
          entryCollisionBox: entryBox,
          appliedCollisionBox: result,
          source: "json",
        });
      }
    }
    return result;
  }

  // Priority 2: item.collisionBox explicitly tagged as JSON-normalized (pre-scaled).
  if (item.collisionBox && item.collisionBoxSource === "json") {
    const result = {
      left: spriteLeft + item.collisionBox.offsetX,
      top: spriteTop + item.collisionBox.offsetY,
      right: spriteLeft + item.collisionBox.offsetX + item.collisionBox.width,
      bottom: spriteTop + item.collisionBox.offsetY + item.collisionBox.height,
    };
    if (import.meta.env.DEV && DEBUG_TREE_COLLISION_SOURCE && item.entry?.group === "trees") {
      const entryId = item.entry?.id || item.entry?.name || item.id || null;
      if (entryId && !_treeCollisionSourceLogged.has(entryId)) {
        _treeCollisionSourceLogged.add(entryId);
        console.log("[tree-collision-source]", {
          entryId,
          entryCollisionBox: item.entry?.collisionBox || null,
          appliedCollisionBox: result,
          source: "json",
        });
      }
    }
    return result;
  }

  // Priority 3: generic fallback collision box.
  if (item.collisionBox) {
    const result = {
      left: spriteLeft + item.collisionBox.offsetX,
      top: spriteTop + item.collisionBox.offsetY,
      right: spriteLeft + item.collisionBox.offsetX + item.collisionBox.width,
      bottom: spriteTop + item.collisionBox.offsetY + item.collisionBox.height,
    };
    if (import.meta.env.DEV && DEBUG_TREE_COLLISION_SOURCE && item.entry?.group === "trees") {
      const entryId = item.entry?.id || item.entry?.name || item.id || null;
      if (entryId && !_treeCollisionSourceLogged.has(entryId)) {
        _treeCollisionSourceLogged.add(entryId);
        console.log("[tree-collision-source]", {
          entryId,
          entryCollisionBox: item.entry?.collisionBox || null,
          appliedCollisionBox: result,
          source: "fallback",
        });
      }
    }
    return result;
  }

  return {
    left: spriteLeft,
    top: spriteTop,
    right: spriteLeft + renderWidth,
    bottom: spriteTop + renderHeight,
  };
}

export function getWorldAtlasCollisionObjects(
  playerX,
  playerY,
  atlasData,
  viewport = WORLD_ATLAS_COLLISION_VIEWPORT
) {
  if (!atlasData) return [];
  const layout = getWorldAtlasLayout(playerX, playerY, atlasData, viewport);
  return layout.collisionItems || [];
}

export function isWorldTerrainBoundsWalkable(bounds) {
  if (!bounds) return true;

  const sampler = getSharedTerrainSampler();
  const startX = Math.floor(bounds.left / WORLD_ATLAS_TILE_SIZE);
  const endX = Math.floor((bounds.right - 1) / WORLD_ATLAS_TILE_SIZE);
  const startY = Math.floor(bounds.top / WORLD_ATLAS_TILE_SIZE);
  const endY = Math.floor((bounds.bottom - 1) / WORLD_ATLAS_TILE_SIZE);

  for (let gridX = startX; gridX <= endX; gridX += 1) {
    for (let gridY = startY; gridY <= endY; gridY += 1) {
      if (isWorldTileInsideVillage(gridX, gridY)) {
        continue;
      }

      if (!isTerrainWalkable(sampler.getTerrainType(gridX, gridY))) {
        return false;
      }
    }
  }

  return true;
}
