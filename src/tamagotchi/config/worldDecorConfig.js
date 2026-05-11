export const WORLD_DECOR_ACTIVE_RADIUS_TILES = 32;
export const WORLD_DECOR_DESPAWN_RADIUS_TILES = 12;
export const WORLD_DECOR_MAX_VISIBLE_ITEMS = 60;
export const WORLD_DECOR_MAX_VISIBLE_ANIMATIONS = 12;
export const WORLD_DECOR_MAX_ITEMS_PER_CHUNK = 4;
export const WORLD_DECOR_MAX_ANIMATIONS_PER_CHUNK = 3;
export const WORLD_DECOR_LABEL_RENDER_LIMIT = 0;
export const FOUNTAIN_MAX_PER_CHUNK = 1;
export const FOUNTAIN_MIN_DISTANCE_TILES = 16;

export const WORLD_DECOR_DENSITY_BY_KEY = {
  very_low: 0.01,
  low: 0.025,
  low_to_medium: 0.035,
  medium_low: 0.05,
  medium: 0.07,
  medium_high: 0.09,
};

export const WORLD_DECOR_FAMILY_CONFIG = {
  trees: {
    enabled: false,
    density: 0.045,
    minDistanceTiles: 8,
    maxVisible: 10,
    maxPerChunk: 1,
    priority: 95,
  },
  atlas_trees: {
    enabled: true,
    density: 0.16,
    minDistanceTiles: 4.5,
    maxVisible: 40,
    maxPerChunk: 4,
    priority: 140,
  },
  rocks: {
    enabled: false,
    density: 0.025,
    minDistanceTiles: 4,
    maxVisible: 6,
    maxPerChunk: 1,
    priority: 30,
  },
  light_small_rock: {
    enabled: true,
    density: 0.003,
    minDistanceTiles: 2.4,
    maxVisible: 8,
    maxPerChunk: 1,
    priority: 10,
    placementJitterTiles: 0.18,
    placementNoiseScale: 0.16,
    placementClusterWeight: 0.42,
  },
  dark_small_rock: {
    enabled: true,
    density: 0.003,
    minDistanceTiles: 2.4,
    maxVisible: 8,
    maxPerChunk: 1,
    priority: 10,
    placementJitterTiles: 0.18,
    placementNoiseScale: 0.16,
    placementClusterWeight: 0.42,
  },
  small_water_rock: {
    enabled: true,
    density: 0.002,
    minDistanceTiles: 2.8,
    maxVisible: 6,
    maxPerChunk: 1,
    priority: 10,
    placementJitterTiles: 0.16,
    placementNoiseScale: 0.14,
    placementClusterWeight: 0.38,
  },
  shroom_green: {
    enabled: true,
    density: 0.015,
    minDistanceTiles: 0.6,
    maxVisible: 26,
    maxPerChunk: 6,
    priority: 40,
    placementJitterTiles: 0.24,
    placementNoiseScale: 0.2,
    placementClusterWeight: 0.72,
  },
  small_flowers: {
    enabled: true,
    density: 0.02,
    minDistanceTiles: 0.52,
    maxVisible: 42,
    maxPerChunk: 8,
    priority: 40,
    placementJitterTiles: 0.32,
    placementNoiseScale: 0.24,
    placementClusterWeight: 0.8,
  },
  small_herbs_light: {
    enabled: true,
    density: 0.026,
    minDistanceTiles: 0.6,
    maxVisible: 34,
    maxPerChunk: 8,
    priority: 40,
    placementJitterTiles: 0.28,
    placementNoiseScale: 0.22,
    placementClusterWeight: 0.72,
  },
  small_herbs_dark: {
    enabled: true,
    density: 0.024,
    minDistanceTiles: 0.6,
    maxVisible: 30,
    maxPerChunk: 8,
    priority: 40,
    placementJitterTiles: 0.28,
    placementNoiseScale: 0.22,
    placementClusterWeight: 0.72,
  },
  variation_on_grass_light: {
    enabled: true,
    density: 0.04,
    minDistanceTiles: 0,
    maxVisible: 24,
    maxPerChunk: 6,
    priority: 50,
  },
  variation_on_grass_dark: {
    enabled: true,
    density: 0.04,
    minDistanceTiles: 0,
    maxVisible: 22,
    maxPerChunk: 6,
    priority: 50,
  },
  variation_on_sand: {
    enabled: true,
    density: 0.035,
    minDistanceTiles: 0,
    maxVisible: 18,
    maxPerChunk: 5,
    priority: 50,
  },
  variation_around_sand: {
    enabled: true,
    density: 0.022,
    minDistanceTiles: 0,
    maxVisible: 14,
    maxPerChunk: 4,
    priority: 50,
  },
  variation_on_road: {
    enabled: true,
    density: 0.035,
    minDistanceTiles: 0,
    maxVisible: 18,
    maxPerChunk: 5,
    priority: 50,
  },
  variation_around_road: {
    enabled: true,
    density: 0.022,
    minDistanceTiles: 0,
    maxVisible: 14,
    maxPerChunk: 4,
    priority: 50,
  },
  water_idle_sparkle_loop_a: {
    enabled: true,
    density: 0.4,
    minDistanceTiles: 1.5,
    maxVisible: 16,
    maxPerChunk: 2,
    priority: 90,
    placementJitterTiles: 0.2,
    placementNoiseScale: 0.18,
    placementClusterWeight: 0.52,
  },
  water_idle_sparkle_loop_b: {
    enabled: true,
    density: 0.35,
    minDistanceTiles: 1.5,
    maxVisible: 16,
    maxPerChunk: 2,
    priority: 90,
    placementJitterTiles: 0.2,
    placementNoiseScale: 0.18,
    placementClusterWeight: 0.52,
  },
  fountain_loop: {
    enabled: true,
    density: 0.9,
    minDistanceTiles: 6,
    maxVisible: 10,
    maxPerChunk: 2,
    priority: 80,
    placementJitterTiles: 0.08,
    placementNoiseScale: 0.12,
    placementClusterWeight: 0.4,
  },
};

export const WORLD_DECOR_FAMILY_PRIORITY = Object.fromEntries(
  Object.entries(WORLD_DECOR_FAMILY_CONFIG).map(([familyId, config]) => [
    familyId,
    config.priority ?? 0,
  ])
);

export const WORLD_DECOR_FAMILY_ENABLED = Object.fromEntries(
  Object.entries(WORLD_DECOR_FAMILY_CONFIG).map(([familyId, config]) => [
    familyId,
    config.enabled !== false,
  ])
);

export const WORLD_DECOR_FAMILY_MAX_VISIBLE = Object.fromEntries(
  Object.entries(WORLD_DECOR_FAMILY_CONFIG).map(([familyId, config]) => [
    familyId,
    Number.isFinite(config.maxVisible) ? config.maxVisible : Number.POSITIVE_INFINITY,
  ])
);

export const WORLD_DECOR_DENSITY = Object.fromEntries(
  Object.entries(WORLD_DECOR_FAMILY_CONFIG).map(([familyId, config]) => [
    familyId,
    config.enabled === false ? 0 : config.density ?? 0,
  ])
);

export const WORLD_DECOR_MIN_DISTANCE_TILES = Object.fromEntries(
  Object.entries(WORLD_DECOR_FAMILY_CONFIG).map(([familyId, config]) => [
    familyId,
    config.minDistanceTiles ?? 0,
  ])
);

export const WORLD_DECOR_MAX_PER_CHUNK = Object.fromEntries(
  Object.entries(WORLD_DECOR_FAMILY_CONFIG).map(([familyId, config]) => [
    familyId,
    Number.isFinite(config.maxPerChunk) ? config.maxPerChunk : Number.POSITIVE_INFINITY,
  ])
);

export const WORLD_DECOR_CLUSTER_CONFIG = {
  shroom_green: {
    sectorSizeTiles: 6,
    minCount: 2,
    maxCount: 5,
    radiusTiles: 2.1,
  },
};

export const WORLD_DECOR_MAX_METADATA_ITEMS_PER_CHUNK =
  WORLD_DECOR_MAX_ITEMS_PER_CHUNK;
export const WORLD_DECOR_MAX_ANIMATED_ITEMS_PER_CHUNK =
  WORLD_DECOR_MAX_ANIMATIONS_PER_CHUNK;
export const WORLD_DECOR_MAX_TOTAL_VISIBLE_ITEMS = WORLD_DECOR_MAX_VISIBLE_ITEMS;
