import {
  DECOR_JITTER,
  DECOR_MIN_DISTANCE,
  FLOWER_DENSITY,
  TREE_MAX_PER_CHUNK,
  TREE_CLUSTER_CHANCE,
} from "./worldStreamingConfig";
import { getWorldDecorRuntimeSettings } from "../store/worldDebugStore";

const DEFAULT_PROFILE = {
  scaleRange: [1.08, 1.22],
  placement: {
    mode: "scatter",
    sectorSizeTiles: 2.2,
    samplesPerSector: 2,
    density: 0.2,
    minDistanceTiles: 0.45,
    xJitterTiles: 0.45,
    yBand: [0.64, 0.95],
    pocketScale: 0.1,
    pocketBoost: 1,
  },
  collision: {
    widthRatio: 0.28,
    heightRatio: 0.13,
    offsetYRatio: 0.84,
  },
};

const COLLISION_PRESETS = {
  trees: {
    widthRatio: 1,
    heightRatio: 0.94,
    offsetXRatio: 0,
    offsetYRatio: 0.06,
  },
  treeStump: {
    widthRatio: 0.28,
    heightRatio: 0.14,
    offsetYRatio: 0.82,
  },
  bushes: {
    widthRatio: 0.36,
    heightRatio: 0.16,
    offsetYRatio: 0.8,
  },
  flowers: {
    widthRatio: 0.2,
    heightRatio: 0.08,
    offsetYRatio: 0.89,
  },
  mushrooms: {
    widthRatio: 0.18,
    heightRatio: 0.08,
    offsetYRatio: 0.89,
  },
  pebbles: {
    widthRatio: 0.2,
    heightRatio: 0.08,
    offsetYRatio: 0.89,
  },
  rocks: {
    widthRatio: 0.36,
    heightRatio: 0.15,
    offsetYRatio: 0.8,
  },
  pottedTrees: {
    widthRatio: 0.28,
    heightRatio: 0.16,
    offsetYRatio: 0.8,
  },
  logs: {
    widthRatio: 0.42,
    heightRatio: 0.12,
    offsetYRatio: 0.82,
  },
  landmarks: {
    widthRatio: 0.34,
    heightRatio: 0.18,
    offsetYRatio: 0.79,
  },
};

const PROFILE_BY_GROUP = {
  trees: {
    scaleRange: [2.4, 2.96],
    placement: {
      mode: "cluster",
      sectorSizeTiles: 14,
      clusterChance: 0.08 * TREE_CLUSTER_CHANCE,
      minCount: 1,
      maxCount: 2,
      maxPerChunk: TREE_MAX_PER_CHUNK,
      radiusTiles: 2.8,
      minDistanceTiles: 4.8 * DECOR_MIN_DISTANCE,
      xJitterTiles: 0.38 * DECOR_JITTER,
      yBand: [0.74, 0.94],
    },
    collision: COLLISION_PRESETS.trees,
  },
  bushes: {
    scaleRange: [1.12, 1.28],
    placement: {
      mode: "cluster",
      sectorSizeTiles: 8.5,
      clusterChance: 0.16,
      minCount: 1,
      maxCount: 3,
      radiusTiles: 1.8,
      minDistanceTiles: 0.95 * DECOR_MIN_DISTANCE,
      xJitterTiles: 0.46 * DECOR_JITTER,
      yBand: [0.74, 0.96],
    },
    collision: COLLISION_PRESETS.bushes,
  },
  flowers: {
    scaleRange: [1.02, 1.18],
    placement: {
      mode: "scatter",
      sectorSizeTiles: 1.45,
      samplesPerSector: 4,
      density: 0.5 * FLOWER_DENSITY,
      minDistanceTiles: 0.24 * DECOR_MIN_DISTANCE,
      xJitterTiles: 0.62 * DECOR_JITTER,
      yBand: [0.6, 0.98],
      pocketScale: 0.14,
      pocketBoost: 1.8,
    },
    collision: COLLISION_PRESETS.flowers,
  },
  mushrooms: {
    scaleRange: [1.04, 1.16],
    placement: {
      mode: "scatter",
      sectorSizeTiles: 1.65,
      samplesPerSector: 3,
      density: 0.24,
      minDistanceTiles: 0.3 * DECOR_MIN_DISTANCE,
      xJitterTiles: 0.56 * DECOR_JITTER,
      yBand: [0.62, 0.97],
      pocketScale: 0.12,
      pocketBoost: 1.25,
    },
    collision: COLLISION_PRESETS.mushrooms,
  },
  pebbles: {
    scaleRange: [1.02, 1.14],
    placement: {
      mode: "scatter",
      sectorSizeTiles: 1.8,
      samplesPerSector: 3,
      density: 0.18,
      minDistanceTiles: 0.28 * DECOR_MIN_DISTANCE,
      xJitterTiles: 0.6 * DECOR_JITTER,
      yBand: [0.6, 0.98],
      pocketScale: 0.1,
      pocketBoost: 1.1,
    },
    collision: COLLISION_PRESETS.pebbles,
  },
  water_pebbles: {
    scaleRange: [1.02, 1.14],
    placement: {
      mode: "scatter",
      sectorSizeTiles: 2,
      samplesPerSector: 2,
      density: 0.14,
      minDistanceTiles: 0.34 * DECOR_MIN_DISTANCE,
      xJitterTiles: 0.56 * DECOR_JITTER,
      yBand: [0.62, 0.98],
      pocketScale: 0.08,
      pocketBoost: 1.08,
    },
    collision: COLLISION_PRESETS.pebbles,
  },
  rocks: {
    scaleRange: [1.12, 1.34],
    placement: {
      mode: "scatter",
      sectorSizeTiles: 2.8,
      samplesPerSector: 2,
      density: 0.12,
      minDistanceTiles: 0.86 * DECOR_MIN_DISTANCE,
      xJitterTiles: 0.48 * DECOR_JITTER,
      yBand: [0.68, 0.96],
      pocketScale: 0.06,
      pocketBoost: 1,
    },
    collision: COLLISION_PRESETS.rocks,
  },
  potted_trees: {
    scaleRange: [1.08, 1.24],
    placement: {
      mode: "scatter",
      sectorSizeTiles: 5.4,
      samplesPerSector: 2,
      density: 0.06,
      minDistanceTiles: 1.5 * DECOR_MIN_DISTANCE,
      xJitterTiles: 0.4 * DECOR_JITTER,
      yBand: [0.72, 0.96],
      pocketScale: 0.04,
      pocketBoost: 1,
    },
    collision: COLLISION_PRESETS.pottedTrees,
  },
  logs: {
    scaleRange: [1.08, 1.22],
    placement: {
      mode: "scatter",
      sectorSizeTiles: 4.8,
      samplesPerSector: 2,
      density: 0.07,
      minDistanceTiles: 1.1 * DECOR_MIN_DISTANCE,
      xJitterTiles: 0.42 * DECOR_JITTER,
      yBand: [0.72, 0.95],
      pocketScale: 0.04,
      pocketBoost: 1,
    },
    collision: COLLISION_PRESETS.logs,
  },
  landmarks: {
    scaleRange: [1.36, 1.54],
    placement: {
      mode: "accent",
      sectorSizeTiles: 10,
      density: 0.04,
      minDistanceTiles: 2.1,
      xJitterTiles: 0.35,
      yBand: [0.74, 0.94],
    },
    collision: COLLISION_PRESETS.landmarks,
  },
};

let cachedRuntimeFamilyConfigRef = null;
const cachedResolvedProfilesByGroup = new Map();

function getResolvedGroupProfile(group) {
  const runtimeFamilyConfigRef =
    getWorldDecorRuntimeSettings().familyConfig || null;

  if (cachedRuntimeFamilyConfigRef !== runtimeFamilyConfigRef) {
    cachedRuntimeFamilyConfigRef = runtimeFamilyConfigRef;
    cachedResolvedProfilesByGroup.clear();
  }

  const cacheKey = group || "__default__";
  const cached = cachedResolvedProfilesByGroup.get(cacheKey);
  if (cached) {
    return cached;
  }

  const baseProfile = PROFILE_BY_GROUP[group] || DEFAULT_PROFILE;
  const runtimeFamilyConfig = runtimeFamilyConfigRef?.[group] || null;
  const runtimeDensity = Number(runtimeFamilyConfig?.density);
  const runtimeMinDistanceTiles = Number(runtimeFamilyConfig?.minDistanceTiles);
  const runtimeMaxPerChunk = Number(runtimeFamilyConfig?.maxPerChunk);

  const resolvedProfile = !runtimeFamilyConfig
    ? baseProfile
    : {
        ...baseProfile,
        placement: {
          ...baseProfile.placement,
          density: Number.isFinite(runtimeDensity)
            ? runtimeDensity
            : baseProfile.placement?.density,
          clusterChance:
            group === "trees" && Number.isFinite(runtimeDensity)
              ? runtimeDensity
              : baseProfile.placement?.clusterChance,
          minDistanceTiles: Number.isFinite(runtimeMinDistanceTiles)
            ? runtimeMinDistanceTiles
            : baseProfile.placement?.minDistanceTiles,
          maxPerChunk: Number.isFinite(runtimeMaxPerChunk)
            ? runtimeMaxPerChunk
            : baseProfile.placement?.maxPerChunk,
        },
      };

  cachedResolvedProfilesByGroup.set(cacheKey, resolvedProfile);
  return resolvedProfile;
}

function getProfile(entry) {
  return getResolvedGroupProfile(entry?.group);
}

export function getObjectPlacementProfile(entry) {
  return getProfile(entry).placement || DEFAULT_PROFILE.placement;
}

export function getObjectCollisionProfile(entry) {
  const baseProfile = getProfile(entry).collision || DEFAULT_PROFILE.collision;

  if (entry.group === "trees" && entry.tags?.includes("tall_tree")) {
    return COLLISION_PRESETS.trees;
  }

  if (
    entry.group === "trees" &&
    (entry.family?.includes("stump") || entry.tags?.includes("stump"))
  ) {
    return COLLISION_PRESETS.treeStump;
  }

  if (entry.group === "potted_trees" && entry.family?.includes("stump")) {
    return COLLISION_PRESETS.treeStump;
  }

  return baseProfile;
}

export function getObjectScaleRange(entry) {
  return getProfile(entry).scaleRange || DEFAULT_PROFILE.scaleRange;
}
