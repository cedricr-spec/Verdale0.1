import { resolveTerrainAutotileCore } from "./autotileRuntimeCore.js";
import {
  getAutotileTemplate,
  getAutotileCandidateTemplates,
  getTerrainFallbackPattern,
} from "./worldAutotileTemplates";
import { SHOW_TERRAIN_AUTOTILE_DEBUG } from "../config/worldStreamingConfig";
import { TERRAIN_TYPES } from "./worldTerrainGenerator";

const terrainEntryCache = new Map();
const warningCache = new Set();
let hasLoggedAutotileSample = false;

function warnOnce(key, message, details) {
  if (!import.meta.env.DEV) return;
  if (warningCache.has(key)) return;

  warningCache.add(key);
  console.warn(message, details);
}

function logAutotileDebug(details) {
  if (!import.meta.env.DEV || !SHOW_TERRAIN_AUTOTILE_DEBUG) return;
  console.debug("[autotile]", details);
}

function logAutotileSample(result, gridX, gridY) {
  if (!import.meta.env.DEV || !SHOW_TERRAIN_AUTOTILE_DEBUG) return;
  if (hasLoggedAutotileSample) return;

  hasLoggedAutotileSample = true;
  console.debug("[autotile-sample]", {
    worldPosition: { x: gridX, y: gridY },
    templateId: result.templateId,
    patternId: result.patternId,
    sampledTerrains: result.sampledTerrains,
    rawMask: result.rawMask,
    generatedMask: result.mask,
    maskSignature: result.maskSignature,
  });
}

function getFallbackPatternForTerrain(terrainType) {
  return (
    getTerrainFallbackPattern(terrainType) ||
    getTerrainFallbackPattern(TERRAIN_TYPES.GRASS_LIGHT)
  );
}

function getTerrainEntry(terrainType, pattern, renderLayer) {
  const atlas = pattern?.tile?.atlas;
  const key = `${terrainType}:${pattern?.id || "fallback"}:${atlas?.x || 0}:${atlas?.y || 0}`;
  const cached = terrainEntryCache.get(key);

  if (cached) return cached;

  const entry = {
    name: `terrain_${key}`,
    type: "tile",
    group: "terrain",
    category: "terrain_autotile",
    family: `${terrainType}_autotile`,
    description: pattern?.label || terrainType,
    x: atlas?.x || 0,
    y: atlas?.y || 0,
    width: atlas?.width || 16,
    height: atlas?.height || 16,
    tileW: 1,
    tileH: 1,
    tags: ["terrain", terrainType],
    collision: {
      blocksMovement: false,
      walkableOverride: false,
    },
    render: {
      layer: renderLayer,
      priority: 0,
    },
  };

  terrainEntryCache.set(key, entry);
  return entry;
}

function createResolvedTerrainTile(result) {
  const pattern = result.pattern || getFallbackPatternForTerrain(result.terrainType);
  const renderLayer = result.terrainType === TERRAIN_TYPES.WATER ? "water" : "ground";

  return {
    ...result,
    patternId: pattern?.id || "fallback",
    category: pattern?.category || result.category || "full",
    entry: getTerrainEntry(result.terrainType, pattern, renderLayer),
  };
}

function getCandidateTemplates(centerTerrain, options = {}) {
  const excludedTemplateIds = new Set(options.excludedTemplateIds || []);
  const filterTemplates = (templates) =>
    excludedTemplateIds.size > 0
      ? templates.filter((template) => !excludedTemplateIds.has(template.id))
      : templates;

  if (Object.prototype.hasOwnProperty.call(options, "candidateTemplateIds")) {
    return filterTemplates(
      (options.candidateTemplateIds || [])
        .map((templateId) => getAutotileTemplate(templateId))
        .filter(Boolean)
    );
  }

  return filterTemplates(getAutotileCandidateTemplates(centerTerrain));
}

export function resolveTerrainAutotile(getTerrainAt, gridX, gridY, options = {}) {
  const centerTerrain = getTerrainAt(gridX, gridY);
  const candidateTemplates = getCandidateTemplates(centerTerrain, options);

  if (!candidateTemplates.length) {
    const result = {
      terrainType: centerTerrain,
      templateId: null,
      centerTerrain,
      centerToken: null,
      backgroundToken: null,
      backgroundTerrain: null,
      sampledTerrains: null,
      rawMask: null,
      mask: null,
      maskSignature: null,
      pattern: getFallbackPatternForTerrain(centerTerrain),
      patternId: getFallbackPatternForTerrain(centerTerrain)?.id || "fallback",
      category: getFallbackPatternForTerrain(centerTerrain)?.category || "full",
      unsupportedNeighborCount: 0,
      usedFallback: false,
    };

    logAutotileDebug({
      gridX,
      gridY,
      templateId: null,
      centerTerrain,
      centerToken: null,
      maskSignature: null,
      computedMask: null,
      patternId: result.patternId,
      category: result.category,
      usedFallback: false,
      unsupportedNeighborCount: 0,
    });
    logAutotileSample(result, gridX, gridY);

    return createResolvedTerrainTile(result);
  }

  const result = resolveTerrainAutotileCore({
    getTerrainAt,
    gridX,
    gridY,
    candidateTemplates,
    fallbackPattern: getFallbackPatternForTerrain(centerTerrain),
  });

  if (!candidateTemplates.length) {
    warnOnce(
      `missing-template:${centerTerrain}`,
      "Missing autotile template for terrain; using fallback terrain tile.",
      { centerTerrain }
    );
  } else if (result.usedFallback) {
    warnOnce(
      `fallback-pattern:${result.templateId || centerTerrain}:${result.maskSignature || "none"}`,
      "Autotile fallback used for terrain cell.",
      {
        centerTerrain,
        templateId: result.templateId,
        maskSignature: result.maskSignature,
        unsupportedNeighborCount: result.unsupportedNeighborCount,
      }
    );
  }

  logAutotileDebug({
    gridX,
    gridY,
    templateId: result.templateId,
    centerTerrain,
    centerToken: result.centerToken,
    maskSignature: result.maskSignature,
    computedMask: result.mask,
    patternId: result.patternId,
    category: result.category,
    usedFallback: result.usedFallback,
    unsupportedNeighborCount: result.unsupportedNeighborCount,
  });
  logAutotileSample(result, gridX, gridY);

  return createResolvedTerrainTile(result);
}
