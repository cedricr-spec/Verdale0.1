export const TERRAIN_TYPES = {
  GRASS_LIGHT: "grass_light",
  GRASS_DARK: "grass_dark",
  WATER: "water",
  SAND: "sand",
  ROAD: "road",
};

export const WORLD_TERRAIN_SEED = "world-terrain-v6-ponds";
const SPECIAL_TERRAIN_BUFFER_TILES = 1;
const PATCH_FIELD_SEARCH_PADDING_TILES = SPECIAL_TERRAIN_BUFFER_TILES + 1;
const EDGE_BLEND_THRESHOLD = 0.18;

const DARK_PATCH_CONFIGS = [
  {
    id: "dark_primary",
    sectorSize: 15,
    spawnChance: 0.18,
    patchSlots: 2,
    slotChanceDecay: 0.54,
    centerOverflow: 0.42,
    radiusX: [2.2, 6.8],
    radiusY: [2.1, 6.4],
    secondaryLobeChance: 0.82,
    tertiaryLobeChance: 0.42,
    quaternaryLobeChance: 0.16,
    secondaryOffset: [0.32, 0.96],
    tertiaryOffset: [0.22, 0.76],
    quaternaryOffset: [0.14, 0.48],
    secondaryScale: [0.44, 0.88],
    tertiaryScale: [0.24, 0.58],
    quaternaryScale: [0.18, 0.34],
    edgeNoiseScale: [0.32, 0.68],
    edgeNoiseAmplitude: [0.06, 0.16],
    edgeNoiseBias: [-0.04, 0.06],
    warpScale: [0.18, 0.32],
    warpAmplitudeX: [0.55, 1.35],
    warpAmplitudeY: [0.55, 1.3],
    maxInfluenceRadius: 15,
  },
  {
    id: "dark_wide",
    sectorSize: 21,
    spawnChance: 0.12,
    patchSlots: 2,
    slotChanceDecay: 0.5,
    centerOverflow: 0.52,
    radiusX: [3.8, 9.6],
    radiusY: [2.2, 5.6],
    secondaryLobeChance: 0.68,
    tertiaryLobeChance: 0.28,
    quaternaryLobeChance: 0.14,
    secondaryOffset: [0.38, 1.08],
    tertiaryOffset: [0.26, 0.62],
    quaternaryOffset: [0.18, 0.42],
    secondaryScale: [0.36, 0.76],
    tertiaryScale: [0.24, 0.52],
    quaternaryScale: [0.18, 0.3],
    edgeNoiseScale: [0.28, 0.62],
    edgeNoiseAmplitude: [0.08, 0.18],
    edgeNoiseBias: [-0.02, 0.08],
    warpScale: [0.15, 0.28],
    warpAmplitudeX: [0.8, 1.8],
    warpAmplitudeY: [0.45, 1.15],
    maxInfluenceRadius: 18,
  },
  {
    id: "dark_compact",
    sectorSize: 11,
    spawnChance: 0.1,
    patchSlots: 2,
    slotChanceDecay: 0.46,
    centerOverflow: 0.34,
    radiusX: [1.8, 4.8],
    radiusY: [1.8, 4.5],
    secondaryLobeChance: 0.64,
    tertiaryLobeChance: 0.24,
    quaternaryLobeChance: 0.08,
    secondaryOffset: [0.24, 0.74],
    tertiaryOffset: [0.18, 0.5],
    quaternaryOffset: [0.14, 0.32],
    secondaryScale: [0.38, 0.7],
    tertiaryScale: [0.2, 0.44],
    quaternaryScale: [0.16, 0.28],
    edgeNoiseScale: [0.38, 0.78],
    edgeNoiseAmplitude: [0.04, 0.12],
    edgeNoiseBias: [-0.06, 0.04],
    warpScale: [0.22, 0.38],
    warpAmplitudeX: [0.4, 0.95],
    warpAmplitudeY: [0.4, 0.95],
    maxInfluenceRadius: 12,
  },
];

const WATER_PATCH_CONFIGS = [
  {
    id: "water_primary",
    sectorSize: 18,
    spawnChance: 0.36,
    patchSlots: 4,
    slotChanceDecay: 0.68,
    centerOverflow: 0.74,
    radiusX: [7.0, 14.0],
    radiusY: [6.5, 13.0],
    secondaryLobeChance: 0.9,
    tertiaryLobeChance: 0.58,
    quaternaryLobeChance: 0.28,
    secondaryOffset: [0.34, 0.98],
    tertiaryOffset: [0.22, 0.68],
    quaternaryOffset: [0.18, 0.48],
    secondaryScale: [0.5, 0.88],
    tertiaryScale: [0.32, 0.62],
    quaternaryScale: [0.22, 0.42],
    edgeNoiseScale: [0.22, 0.5],
    edgeNoiseAmplitude: [0.1, 0.22],
    edgeNoiseBias: [0.02, 0.14],
    warpScale: [0.12, 0.22],
    warpAmplitudeX: [1.2, 2.6],
    warpAmplitudeY: [1.1, 2.5],
    maxInfluenceRadius: 26,
  },
  {
    id: "water_lake",
    sectorSize: 28,
    spawnChance: 0.22,
    patchSlots: 4,
    slotChanceDecay: 0.52,
    centerOverflow: 0.94,
    radiusX: [11.5, 23.0],
    radiusY: [10.0, 20.0],
    secondaryLobeChance: 0.96,
    tertiaryLobeChance: 0.68,
    quaternaryLobeChance: 0.38,
    secondaryOffset: [0.42, 1.18],
    tertiaryOffset: [0.3, 0.84],
    quaternaryOffset: [0.2, 0.54],
    secondaryScale: [0.56, 0.94],
    tertiaryScale: [0.34, 0.68],
    quaternaryScale: [0.24, 0.44],
    edgeNoiseScale: [0.18, 0.42],
    edgeNoiseAmplitude: [0.12, 0.26],
    edgeNoiseBias: [0.05, 0.16],
    warpScale: [0.08, 0.18],
    warpAmplitudeX: [1.8, 4.0],
    warpAmplitudeY: [1.5, 3.8],
    maxInfluenceRadius: 40,
  },
];

const SAND_PATCH_CONFIGS = [
  {
    id: "sand_shore",
    sectorSize: 24,
    spawnChance: 0.1,
    patchSlots: 2,
    slotChanceDecay: 0.46,
    centerOverflow: 0.58,
    radiusX: [4.4, 9.2],
    radiusY: [3.8, 8.2],
    secondaryLobeChance: 0.82,
    tertiaryLobeChance: 0.42,
    quaternaryLobeChance: 0.16,
    secondaryOffset: [0.3, 0.9],
    tertiaryOffset: [0.22, 0.62],
    quaternaryOffset: [0.16, 0.36],
    secondaryScale: [0.44, 0.82],
    tertiaryScale: [0.26, 0.54],
    quaternaryScale: [0.18, 0.32],
    edgeNoiseScale: [0.26, 0.52],
    edgeNoiseAmplitude: [0.06, 0.14],
    edgeNoiseBias: [-0.02, 0.08],
    warpScale: [0.14, 0.26],
    warpAmplitudeX: [0.8, 1.9],
    warpAmplitudeY: [0.8, 1.8],
    maxInfluenceRadius: 17,
  },
  {
    id: "sand_compact",
    sectorSize: 15,
    spawnChance: 0.08,
    patchSlots: 2,
    slotChanceDecay: 0.42,
    centerOverflow: 0.44,
    radiusX: [2.8, 6.4],
    radiusY: [2.6, 5.8],
    secondaryLobeChance: 0.68,
    tertiaryLobeChance: 0.26,
    quaternaryLobeChance: 0.08,
    secondaryOffset: [0.26, 0.74],
    tertiaryOffset: [0.18, 0.44],
    quaternaryOffset: [0.14, 0.28],
    secondaryScale: [0.38, 0.72],
    tertiaryScale: [0.22, 0.48],
    quaternaryScale: [0.16, 0.28],
    edgeNoiseScale: [0.34, 0.68],
    edgeNoiseAmplitude: [0.04, 0.1],
    edgeNoiseBias: [-0.04, 0.04],
    warpScale: [0.2, 0.34],
    warpAmplitudeX: [0.5, 1.2],
    warpAmplitudeY: [0.5, 1.1],
    maxInfluenceRadius: 12,
  },
];

const ROAD_PATCH_CONFIGS = [
  {
    id: "road_square",
    sectorSize: 20,
    spawnChance: 0.11,
    patchSlots: 3,
    slotChanceDecay: 0.48,
    centerOverflow: 0.56,
    radiusX: [4.2, 9.4],
    radiusY: [3.8, 8.2],
    secondaryLobeChance: 0.62,
    tertiaryLobeChance: 0.24,
    quaternaryLobeChance: 0.08,
    secondaryOffset: [0.24, 0.66],
    tertiaryOffset: [0.16, 0.4],
    quaternaryOffset: [0.12, 0.24],
    secondaryScale: [0.42, 0.78],
    tertiaryScale: [0.24, 0.52],
    quaternaryScale: [0.16, 0.28],
    edgeNoiseScale: [0.28, 0.56],
    edgeNoiseAmplitude: [0.03, 0.08],
    edgeNoiseBias: [-0.02, 0.03],
    warpScale: [0.16, 0.26],
    warpAmplitudeX: [0.4, 0.9],
    warpAmplitudeY: [0.4, 0.9],
    maxInfluenceRadius: 15,
  },
  {
    id: "road_clearing",
    sectorSize: 15,
    spawnChance: 0.085,
    patchSlots: 2,
    slotChanceDecay: 0.42,
    centerOverflow: 0.48,
    radiusX: [3.2, 6.4],
    radiusY: [3.0, 5.8],
    secondaryLobeChance: 0.48,
    tertiaryLobeChance: 0.18,
    quaternaryLobeChance: 0.06,
    secondaryOffset: [0.18, 0.48],
    tertiaryOffset: [0.14, 0.3],
    quaternaryOffset: [0.1, 0.2],
    secondaryScale: [0.4, 0.68],
    tertiaryScale: [0.22, 0.42],
    quaternaryScale: [0.15, 0.24],
    edgeNoiseScale: [0.32, 0.64],
    edgeNoiseAmplitude: [0.02, 0.06],
    edgeNoiseBias: [-0.03, 0.02],
    warpScale: [0.18, 0.3],
    warpAmplitudeX: [0.35, 0.75],
    warpAmplitudeY: [0.35, 0.75],
    maxInfluenceRadius: 11,
  },
];

function hashUnit(...parts) {
  let hash = 2166136261;

  for (let partIndex = 0; partIndex < parts.length; partIndex += 1) {
    const value = String(parts[partIndex]);

    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    if (partIndex < parts.length - 1) {
      hash ^= 124;
      hash = Math.imul(hash, 16777619);
    }
  }

  return (hash >>> 0) / 4294967295;
}

function getCellKey(gridX, gridY) {
  // Integer packing — avoids string allocation on every Map lookup.
  // Safe for |coord| < 50 000 tiles (≈ 800 000 world-pixels), well beyond any chunk.
  // Must match the formula in worldAtlasFamilies.js getCellKey.
  return gridX * 100003 + gridY;
}

function getSectorKey(sectorX, sectorY) {
  return `${sectorX},${sectorY}`;
}

function randomBetween(min, max, ...seedParts) {
  return min + hashUnit(...seedParts) * (max - min);
}

function createLobe(centerX, centerY, radiusX, radiusY, angle) {
  return {
    centerX,
    centerY,
    radiusX,
    radiusY,
    angle,
    cos: Math.cos(angle),
    sin: Math.sin(angle),
  };
}

function getLobeOffsetDistance(radiusX, radiusY, range, ...seedParts) {
  return (
    Math.max(radiusX, radiusY) * randomBetween(range[0], range[1], ...seedParts)
  );
}

function getPatchSlotCount(config) {
  return Math.max(1, Math.floor(config.patchSlots || 1));
}

function getPatchSlotSpawnChance(config, slotIndex) {
  return config.spawnChance * Math.pow(config.slotChanceDecay || 0.5, slotIndex);
}

function maybeCreateOptionalLobe(
  seed,
  config,
  sectorX,
  sectorY,
  baseLobe,
  id,
  chanceKey,
  offsetKey,
  scaleKey,
  patchSeed = 0,
  slotIndex = 0
) {
  const chance = config[chanceKey];
  const offsetRange = config[offsetKey];
  const scaleRange = config[scaleKey];

  if (!chance || !offsetRange || !scaleRange) {
    return null;
  }

  if (
    hashUnit(seed, config.id, `${id}-present`, sectorX, sectorY, slotIndex, patchSeed) >
    chance
  ) {
    return null;
  }

  const angle =
    hashUnit(seed, config.id, `${id}-angle`, sectorX, sectorY, slotIndex, patchSeed) *
    Math.PI *
    2;
  const offsetDistance = getLobeOffsetDistance(
    baseLobe.radiusX,
    baseLobe.radiusY,
    offsetRange,
    seed,
    config.id,
    `${id}-offset`,
    sectorX,
    sectorY,
    slotIndex,
    patchSeed
  );
  const scale = randomBetween(
    scaleRange[0],
    scaleRange[1],
    seed,
    config.id,
    `${id}-scale`,
    sectorX,
    sectorY,
    slotIndex,
    patchSeed
  );

  return createLobe(
    baseLobe.centerX + Math.cos(angle) * offsetDistance,
    baseLobe.centerY + Math.sin(angle) * offsetDistance,
    Math.max(1, baseLobe.radiusX * scale),
    Math.max(1, baseLobe.radiusY * scale),
    angle
  );
}

function createPatchCandidate(seed, config, sectorX, sectorY, slotIndex = 0) {
  const slotSpawnChance = getPatchSlotSpawnChance(config, slotIndex);

  if (
    hashUnit(seed, config.id, "present", sectorX, sectorY, slotIndex) > slotSpawnChance
  ) {
    return null;
  }

  const patchSeed = Math.floor(
    hashUnit(seed, config.id, "variant", sectorX, sectorY, slotIndex) * 1000000000
  );
  const baseLeft = sectorX * config.sectorSize;
  const baseTop = sectorY * config.sectorSize;
  const centerOverflow = config.centerOverflow || 0;
  const centerX = randomBetween(
    baseLeft - config.sectorSize * centerOverflow,
    baseLeft + config.sectorSize * (1 + centerOverflow),
    seed,
    config.id,
    "center-x",
    sectorX,
    sectorY,
    slotIndex,
    patchSeed
  );
  const centerY = randomBetween(
    baseTop - config.sectorSize * centerOverflow,
    baseTop + config.sectorSize * (1 + centerOverflow),
    seed,
    config.id,
    "center-y",
    sectorX,
    sectorY,
    slotIndex,
    patchSeed
  );
  const radiusX = randomBetween(
    config.radiusX[0],
    config.radiusX[1],
    seed,
    config.id,
    "radius-x",
    sectorX,
    sectorY,
    slotIndex,
    patchSeed
  );
  const radiusY = randomBetween(
    config.radiusY[0],
    config.radiusY[1],
    seed,
    config.id,
    "radius-y",
    sectorX,
    sectorY,
    slotIndex,
    patchSeed
  );
  const angle =
    hashUnit(seed, config.id, "angle", sectorX, sectorY, slotIndex, patchSeed) *
    Math.PI *
    2;
  const primaryLobe = createLobe(centerX, centerY, radiusX, radiusY, angle);
  const lobes = [primaryLobe];
  const optionalLobes = [
    maybeCreateOptionalLobe(
      seed,
      config,
      sectorX,
      sectorY,
      primaryLobe,
      "secondary",
      "secondaryLobeChance",
      "secondaryOffset",
      "secondaryScale",
      patchSeed,
      slotIndex
    ),
    maybeCreateOptionalLobe(
      seed,
      config,
      sectorX,
      sectorY,
      primaryLobe,
      "tertiary",
      "tertiaryLobeChance",
      "tertiaryOffset",
      "tertiaryScale",
      patchSeed,
      slotIndex
    ),
    maybeCreateOptionalLobe(
      seed,
      config,
      sectorX,
      sectorY,
      primaryLobe,
      "quaternary",
      "quaternaryLobeChance",
      "quaternaryOffset",
      "quaternaryScale",
      patchSeed,
      slotIndex
    ),
  ].filter(Boolean);

  lobes.push(...optionalLobes);

  const warpScale = randomBetween(
    config.warpScale?.[0] ?? 0.18,
    config.warpScale?.[1] ?? 0.32,
    seed,
    config.id,
    "warp-scale",
    sectorX,
    sectorY,
    slotIndex,
    patchSeed
  );
  const warpAmplitudeX = randomBetween(
    config.warpAmplitudeX?.[0] ?? 0,
    config.warpAmplitudeX?.[1] ?? 0,
    seed,
    config.id,
    "warp-amplitude-x",
    sectorX,
    sectorY,
    slotIndex,
    patchSeed
  );
  const warpAmplitudeY = randomBetween(
    config.warpAmplitudeY?.[0] ?? 0,
    config.warpAmplitudeY?.[1] ?? 0,
    seed,
    config.id,
    "warp-amplitude-y",
    sectorX,
    sectorY,
    slotIndex,
    patchSeed
  );

  const maxInfluenceRadius = lobes.reduce((largest, lobe) => {
    const distance = Math.hypot(lobe.centerX - centerX, lobe.centerY - centerY);
    return Math.max(largest, distance + Math.max(lobe.radiusX, lobe.radiusY));
  }, 0) + Math.max(warpAmplitudeX, warpAmplitudeY);

  return {
    id: `${config.id}:${sectorX}:${sectorY}:${slotIndex}:${patchSeed}`,
    sectorX,
    sectorY,
    slotIndex,
    patchSeed,
    centerX,
    centerY,
    lobes,
    edgeNoiseScale: randomBetween(
      config.edgeNoiseScale?.[0] ?? 0.42,
      config.edgeNoiseScale?.[1] ?? 0.72,
      seed,
      config.id,
      "edge-noise-scale",
      sectorX,
      sectorY,
      slotIndex,
      patchSeed
    ),
    edgeNoiseAmplitude: randomBetween(
      config.edgeNoiseAmplitude?.[0] ?? 0,
      config.edgeNoiseAmplitude?.[1] ?? 0,
      seed,
      config.id,
      "edge-noise-amplitude",
      sectorX,
      sectorY,
      slotIndex,
      patchSeed
    ),
    edgeNoiseBias: randomBetween(
      config.edgeNoiseBias?.[0] ?? 0,
      config.edgeNoiseBias?.[1] ?? 0,
      seed,
      config.id,
      "edge-noise-bias",
      sectorX,
      sectorY,
      slotIndex,
      patchSeed
    ),
    warpScale,
    warpAmplitudeX,
    warpAmplitudeY,
    maxInfluenceRadius,
  };
}

function getLobeInfluence(gridX, gridY, lobe, padding = 0) {
  const dx = gridX - lobe.centerX;
  const dy = gridY - lobe.centerY;
  const localX = dx * lobe.cos + dy * lobe.sin;
  const localY = -dx * lobe.sin + dy * lobe.cos;
  const radiusX = Math.max(0.5, lobe.radiusX + padding);
  const radiusY = Math.max(0.5, lobe.radiusY + padding);

  return 1 - (localX * localX) / (radiusX * radiusX) - (localY * localY) / (radiusY * radiusY);
}

function getPatchEdgeNoise(patch, gridX, gridY) {
  if (!patch.edgeNoiseAmplitude) return 0;

  const sampleX = Math.floor(gridX * patch.edgeNoiseScale);
  const sampleY = Math.floor(gridY * patch.edgeNoiseScale);
  const noiseA = hashUnit(patch.id, "edge-a", sampleX, sampleY);
  const noiseB = hashUnit(patch.id, "edge-b", sampleX + patch.sectorX * 3, sampleY - patch.sectorY * 5);
  const combined = noiseA * 0.65 + noiseB * 0.35;

  return ((combined - 0.5) * 2 + patch.edgeNoiseBias) * patch.edgeNoiseAmplitude;
}

function getPatchWarpedPoint(patch, gridX, gridY) {
  if (!patch.warpScale || (!patch.warpAmplitudeX && !patch.warpAmplitudeY)) {
    return { x: gridX, y: gridY };
  }

  const sampleX = Math.floor(gridX * patch.warpScale);
  const sampleY = Math.floor(gridY * patch.warpScale);
  const warpXPrimary = hashUnit(patch.id, "warp-x-primary", sampleX, sampleY);
  const warpXSecondary = hashUnit(
    patch.id,
    "warp-x-secondary",
    sampleX + patch.slotIndex * 7,
    sampleY - patch.sectorY * 5
  );
  const warpYPrimary = hashUnit(patch.id, "warp-y-primary", sampleX, sampleY);
  const warpYSecondary = hashUnit(
    patch.id,
    "warp-y-secondary",
    sampleX - patch.sectorX * 4,
    sampleY + patch.slotIndex * 9
  );

  return {
    x:
      gridX +
      ((warpXPrimary * 0.62 + warpXSecondary * 0.38 - 0.5) * 2) * patch.warpAmplitudeX,
    y:
      gridY +
      ((warpYPrimary * 0.58 + warpYSecondary * 0.42 - 0.5) * 2) * patch.warpAmplitudeY,
  };
}

function pointInsidePatch(gridX, gridY, patch, padding = 0) {
  let maxInfluence = Number.NEGATIVE_INFINITY;
  const warpedPoint = getPatchWarpedPoint(patch, gridX, gridY);

  for (const lobe of patch.lobes) {
    maxInfluence = Math.max(
      maxInfluence,
      getLobeInfluence(warpedPoint.x, warpedPoint.y, lobe, padding)
    );
  }

  if (maxInfluence >= EDGE_BLEND_THRESHOLD) {
    return true;
  }

  if (maxInfluence <= -EDGE_BLEND_THRESHOLD) {
    return false;
  }

  return maxInfluence + getPatchEdgeNoise(patch, gridX, gridY) >= 0;
}

function createPatchField(seed, config, validatePatch = null) {
  const patchCache = new Map();

  function getPatches(sectorX, sectorY) {
    const key = getSectorKey(sectorX, sectorY);
    if (patchCache.has(key)) {
      return patchCache.get(key);
    }

    const acceptedPatches = [];

    for (let slotIndex = 0; slotIndex < getPatchSlotCount(config); slotIndex += 1) {
      const patch = createPatchCandidate(seed, config, sectorX, sectorY, slotIndex);
      if (!patch) continue;
      if (validatePatch && !validatePatch(patch, getPatches)) continue;
      acceptedPatches.push(patch);
    }

    patchCache.set(key, acceptedPatches);
    return acceptedPatches;
  }

  function visitCandidatePatches(gridX, gridY, visitor) {
    const searchRadius = config.maxInfluenceRadius + PATCH_FIELD_SEARCH_PADDING_TILES;
    const minSectorX = Math.floor((gridX - searchRadius) / config.sectorSize);
    const maxSectorX = Math.floor((gridX + searchRadius) / config.sectorSize);
    const minSectorY = Math.floor((gridY - searchRadius) / config.sectorSize);
    const maxSectorY = Math.floor((gridY + searchRadius) / config.sectorSize);

    for (let sectorX = minSectorX; sectorX <= maxSectorX; sectorX += 1) {
      for (let sectorY = minSectorY; sectorY <= maxSectorY; sectorY += 1) {
        const patches = getPatches(sectorX, sectorY);
        if (!patches.length) continue;

        patches.forEach((patch) => {
          visitor(patch);
        });
      }
    }
  }

  function contains(gridX, gridY, padding = 0) {
    let inside = false;

    visitCandidatePatches(gridX, gridY, (patch) => {
      if (inside) return;
      if (pointInsidePatch(gridX, gridY, patch, padding)) {
        inside = true;
      }
    });

    return inside;
  }

  return {
    contains,
    visitCandidatePatches,
  };
}

function createCompositeField(fields) {
  return {
    contains(gridX, gridY, padding = 0) {
      return fields.some((field) => field.contains(gridX, gridY, padding));
    },
    visitCandidatePatches(gridX, gridY, visitor) {
      fields.forEach((field) => {
        field.visitCandidatePatches(gridX, gridY, visitor);
      });
    },
  };
}

function patchesConflict(a, b, buffer = 0) {
  const distance = Math.hypot(a.centerX - b.centerX, a.centerY - b.centerY);
  return distance <= a.maxInfluenceRadius + b.maxInfluenceRadius + buffer;
}

function patchConflictsWithField(patch, field, buffer = 0) {
  let hasConflict = false;

  field.visitCandidatePatches(patch.centerX, patch.centerY, (candidatePatch) => {
    if (hasConflict) return;
    if (patchesConflict(patch, candidatePatch, buffer)) {
      hasConflict = true;
    }
  });

  return hasConflict;
}

function countMatchesAround(pointMatches, gridX, gridY, radius = 1) {
  let count = 0;

  for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      if (offsetX === 0 && offsetY === 0) continue;
      if (pointMatches(gridX + offsetX, gridY + offsetY)) {
        count += 1;
      }
    }
  }

  return count;
}

function hasFieldWithinRadius(field, gridX, gridY, radius = 0) {
  for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      if (field.contains(gridX + offsetX, gridY + offsetY)) {
        return true;
      }
    }
  }

  return false;
}

export function isTerrainWalkable(terrainType) {
  return terrainType !== TERRAIN_TYPES.WATER;
}

export function createTerrainSampler(seed = WORLD_TERRAIN_SEED) {
  const rawDarkCache = new Map();
  const rawSandCache = new Map();
  const rawRoadCache = new Map();
  const rawWaterCache = new Map();
  const darkCache = new Map();
  const sandCache = new Map();
  const roadCache = new Map();
  const waterCache = new Map();
  const terrainCache = new Map();

  const darkFields = DARK_PATCH_CONFIGS.map((config) => createPatchField(seed, config));
  const combinedDarkField = createCompositeField(darkFields);
  const sandFields = SAND_PATCH_CONFIGS.map((config) =>
    createPatchField(seed, config, (patch) => {
      return !patchConflictsWithField(
        patch,
        combinedDarkField,
        SPECIAL_TERRAIN_BUFFER_TILES
      );
    })
  );
  const combinedSandField = createCompositeField(sandFields);
  const roadFields = ROAD_PATCH_CONFIGS.map((config) =>
    createPatchField(seed, config, (patch) => {
      if (
        patchConflictsWithField(patch, combinedDarkField, SPECIAL_TERRAIN_BUFFER_TILES)
      ) {
        return false;
      }

      return !patchConflictsWithField(
        patch,
        combinedSandField,
        SPECIAL_TERRAIN_BUFFER_TILES
      );
    })
  );
  const combinedRoadField = createCompositeField(roadFields);
  const waterFields = WATER_PATCH_CONFIGS.map((config) =>
    createPatchField(seed, config, (patch) => {
      if (
        patchConflictsWithField(patch, combinedDarkField, SPECIAL_TERRAIN_BUFFER_TILES)
      ) {
        return false;
      }

      if (
        patchConflictsWithField(patch, combinedSandField, SPECIAL_TERRAIN_BUFFER_TILES)
      ) {
        return false;
      }

      return !patchConflictsWithField(
        patch,
        combinedRoadField,
        SPECIAL_TERRAIN_BUFFER_TILES
      );
    })
  );
  const combinedWaterField = createCompositeField(waterFields);

  function memoize(cache, gridX, gridY, resolver) {
    const key = getCellKey(gridX, gridY);
    if (cache.has(key)) return cache.get(key);

    const value = resolver();
    cache.set(key, value);
    return value;
  }

  function isRawDark(gridX, gridY) {
    return memoize(rawDarkCache, gridX, gridY, () => combinedDarkField.contains(gridX, gridY));
  }

  function isRawSand(gridX, gridY) {
    return memoize(rawSandCache, gridX, gridY, () => {
      if (!combinedSandField.contains(gridX, gridY)) {
        return false;
      }

      return !hasFieldWithinRadius(
        combinedDarkField,
        gridX,
        gridY,
        SPECIAL_TERRAIN_BUFFER_TILES
      );
    });
  }

  function isRawRoad(gridX, gridY) {
    return memoize(rawRoadCache, gridX, gridY, () => {
      if (!combinedRoadField.contains(gridX, gridY)) {
        return false;
      }

      if (
        hasFieldWithinRadius(
          combinedDarkField,
          gridX,
          gridY,
          SPECIAL_TERRAIN_BUFFER_TILES
        )
      ) {
        return false;
      }

      return !countMatchesAround(isRawSand, gridX, gridY, SPECIAL_TERRAIN_BUFFER_TILES);
    });
  }

  function isRawWater(gridX, gridY) {
    return memoize(rawWaterCache, gridX, gridY, () => {
      if (!combinedWaterField.contains(gridX, gridY)) {
        return false;
      }

      if (
        hasFieldWithinRadius(
          combinedDarkField,
          gridX,
          gridY,
          SPECIAL_TERRAIN_BUFFER_TILES
        )
      ) {
        return false;
      }

      if (countMatchesAround(isRawSand, gridX, gridY, SPECIAL_TERRAIN_BUFFER_TILES)) {
        return false;
      }

      return !hasTerrainWithinRadius(
        isRawRoad,
        gridX,
        gridY,
        SPECIAL_TERRAIN_BUFFER_TILES
      );
    });
  }

  function hasTerrainWithinRadius(matchesTerrain, gridX, gridY, radius = 0) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        if (matchesTerrain(gridX + offsetX, gridY + offsetY)) {
          return true;
        }
      }
    }

    return false;
  }

  function isSand(gridX, gridY) {
    return memoize(sandCache, gridX, gridY, () => {
      if (!isRawSand(gridX, gridY)) {
        return false;
      }

      if (hasTerrainWithinRadius(isRawWater, gridX, gridY, SPECIAL_TERRAIN_BUFFER_TILES)) {
        return false;
      }

      if (hasTerrainWithinRadius(isRawRoad, gridX, gridY, SPECIAL_TERRAIN_BUFFER_TILES)) {
        return false;
      }

      return countMatchesAround(isRawSand, gridX, gridY, 1) >= 1;
    });
  }

  function isRoad(gridX, gridY) {
    return memoize(roadCache, gridX, gridY, () => {
      if (!isRawRoad(gridX, gridY)) {
        return false;
      }

      if (hasTerrainWithinRadius(isRawWater, gridX, gridY, SPECIAL_TERRAIN_BUFFER_TILES)) {
        return false;
      }

      return countMatchesAround(isRawRoad, gridX, gridY, 1) >= 1;
    });
  }

  function isWater(gridX, gridY) {
    return memoize(waterCache, gridX, gridY, () => {
      if (!isRawWater(gridX, gridY)) {
        return false;
      }

      return countMatchesAround(isRawWater, gridX, gridY, 1) >= 2;
    });
  }

  function isDark(gridX, gridY) {
    return memoize(darkCache, gridX, gridY, () => {
      if (!isRawDark(gridX, gridY)) {
        return false;
      }

      if (hasTerrainWithinRadius(isWater, gridX, gridY, SPECIAL_TERRAIN_BUFFER_TILES)) {
        return false;
      }

      if (hasTerrainWithinRadius(isSand, gridX, gridY, SPECIAL_TERRAIN_BUFFER_TILES)) {
        return false;
      }

      if (hasTerrainWithinRadius(isRoad, gridX, gridY, SPECIAL_TERRAIN_BUFFER_TILES)) {
        return false;
      }

      return countMatchesAround(isRawDark, gridX, gridY, 1) >= 1;
    });
  }

  function getTerrainType(gridX, gridY) {
    return memoize(terrainCache, gridX, gridY, () => {
      if (isWater(gridX, gridY)) {
        return TERRAIN_TYPES.WATER;
      }

      if (isRoad(gridX, gridY)) {
        return TERRAIN_TYPES.ROAD;
      }

      if (isSand(gridX, gridY)) {
        return TERRAIN_TYPES.SAND;
      }

      if (isDark(gridX, gridY)) {
        return TERRAIN_TYPES.GRASS_DARK;
      }

      return TERRAIN_TYPES.GRASS_LIGHT;
    });
  }

  return {
    seed,
    getTerrainType,
  };
}

export function generateLogicalTerrainGrid(cellBounds, options = {}) {
  const sampler = options.sampler || createTerrainSampler(options.seed);
  const terrainByCell = new Map();

  for (let gridX = cellBounds.startX; gridX <= cellBounds.endX; gridX += 1) {
    for (let gridY = cellBounds.startY; gridY <= cellBounds.endY; gridY += 1) {
      terrainByCell.set(getCellKey(gridX, gridY), sampler.getTerrainType(gridX, gridY));
    }
  }

  return {
    sampler,
    terrainByCell,
  };
}
