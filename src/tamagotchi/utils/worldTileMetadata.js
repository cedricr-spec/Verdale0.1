import rawWorldTileMetadata from "../../spritesheets/world/world-tile-metadata.json";

const VALID_TERRAINS = new Set([
  "grass_light",
  "grass_dark",
  "water",
  "sand",
  "road",
]);

const VALID_AUTOTILE_CATEGORIES = new Set([
  "full",
  "edges",
  "outer_corners",
  "inner_corners",
  "corridors",
  "sides",
  "isolated",
  "complex",
]);

const DEFAULT_WORLD_INTEGRATION_RULES = Object.freeze({
  globalPlacement: {
    onlyOnResolvedFullAutotiles: true,
    doNotPlaceOnTransitions: true,
    forbiddenAutotileCategories: [
      "edges",
      "inner_corners",
      "outer_corners",
      "corridors",
      "sides",
      "isolated",
      "complex",
    ],
  },
  familyPlacementRules: {
    trees: {
      requiresAutotileCategory: ["full"],
      requiresFullNeighborRing: true,
      forbiddenNearbyTerrains: ["water", "sand", "road"],
    },
    tall_tree: {
      requiresAutotileCategory: ["full"],
      requiresFullNeighborRing: true,
      forbiddenNearbyTerrains: ["water", "sand", "road"],
    },
    tree_green: {
      requiresAutotileCategory: ["full"],
      requiresFullNeighborRing: true,
      forbiddenNearbyTerrains: ["water", "sand", "road"],
    },
    tree_green_birch: {
      requiresAutotileCategory: ["full"],
      requiresFullNeighborRing: true,
      forbiddenNearbyTerrains: ["water", "sand", "road"],
    },
    tree_pink: {
      requiresAutotileCategory: ["full"],
      requiresFullNeighborRing: true,
      forbiddenNearbyTerrains: ["water", "sand", "road"],
    },
    atlas_trees: {
      allowedTerrains: ["grass_light"],
      requiresAutotileCategory: ["full"],
      requiresFullNeighborRing: true,
      forbiddenNearbyTerrains: ["water", "sand", "road"],
    },
    small_water_rock: {
      allowedTerrains: ["water"],
      requiresAutotileCategory: ["full"],
      requiresFullNeighborRing: true,
    },
    water_idle_sparkle_loop_a: {
      allowedTerrains: ["water"],
      requiresAutotileCategory: ["full"],
    },
    water_idle_sparkle_loop_b: {
      allowedTerrains: ["water"],
      requiresAutotileCategory: ["full"],
    },
    fountain_loop: {
      allowedTerrains: ["grass_light"],
      requiresAutotileCategory: ["full"],
      requiresFullNeighborRing: true,
      forbiddenNearbyTerrains: ["water", "sand", "road"],
    },
    small_flowers: {
      allowedTerrains: ["grass_light", "grass_dark"],
      requiresAutotileCategory: ["full"],
    },
    small_herbs_light: {
      allowedTerrains: ["grass_light"],
      requiresAutotileCategory: ["full"],
    },
    small_herbs_dark: {
      allowedTerrains: ["grass_dark"],
      requiresAutotileCategory: ["full"],
    },
    shroom_green_01: {
      allowedTerrains: ["grass_light"],
      requiresAutotileCategory: ["full"],
      forbiddenNearbyTerrains: ["water", "sand", "road"],
    },
    light_small_rock: {
      allowedTerrains: ["grass_light"],
      requiresAutotileCategory: ["full"],
    },
    dark_small_rock: {
      allowedTerrains: ["grass_dark"],
      requiresAutotileCategory: ["full"],
    },
    variation_on_grass_light: {
      allowedTerrains: ["grass_light"],
      requiresAutotileCategory: ["full"],
    },
    variation_on_grass_dark: {
      allowedTerrains: ["grass_dark"],
      requiresAutotileCategory: ["full"],
    },
    variation_on_sand: {
      allowedTerrains: ["sand"],
      requiresAutotileCategory: ["full"],
    },
    variation_on_road: {
      allowedTerrains: ["road"],
      requiresAutotileCategory: ["full"],
    },
  },
});

const FAMILY_ALIASES = {
  shroom_green_01: "shroom_green",
};

const warningCache = new Set();

function warnOnce(key, message, details) {
  if (!import.meta.env.DEV || warningCache.has(key)) {
    return;
  }

  warningCache.add(key);
  console.warn(message, details);
}

function normalizeFamilyId(familyId) {
  return FAMILY_ALIASES[familyId] || familyId;
}

function isFiniteAtlasCoord(value) {
  return Number.isFinite(value) && value >= 0;
}

function normalizeTerrainList(values, fallbackValues = [], warningKey = null) {
  const sourceValues = Array.isArray(values) && values.length ? values : fallbackValues;
  const terrains = [...new Set(sourceValues.filter((terrain) => VALID_TERRAINS.has(terrain)))];

  if (
    warningKey &&
    Array.isArray(sourceValues) &&
    sourceValues.some((terrain) => !VALID_TERRAINS.has(terrain))
  ) {
    warnOnce(
      warningKey,
      "Ignoring unsupported terrain names in world tile metadata.",
      { sourceValues }
    );
  }

  return terrains;
}

function normalizeAutotileCategoryList(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.filter((value) => VALID_AUTOTILE_CATEGORIES.has(value)))];
}

function mergeTerrainLists(primaryValues, fallbackValues = [], warningKey = null) {
  return normalizeTerrainList(
    [
      ...(Array.isArray(fallbackValues) ? fallbackValues : []),
      ...(Array.isArray(primaryValues) ? primaryValues : []),
    ],
    [],
    warningKey
  );
}

function mergeAutotileCategoryLists(primaryValues, fallbackValues = []) {
  return normalizeAutotileCategoryList([
    ...(Array.isArray(fallbackValues) ? fallbackValues : []),
    ...(Array.isArray(primaryValues) ? primaryValues : []),
  ]);
}

function inferAllowedTerrains(normalizedFamilyId, fallbackValues = []) {
  if (fallbackValues.length > 0) {
    return fallbackValues;
  }

  if (normalizedFamilyId === "small_herbs_dark") {
    return ["grass_dark"];
  }

  return [];
}

function normalizeGlobalPlacementRules(rawRules = {}, fallbackRules = {}) {
  return {
    ...fallbackRules,
    ...rawRules,
    onlyOnResolvedFullAutotiles:
      rawRules.onlyOnResolvedFullAutotiles ??
      fallbackRules.onlyOnResolvedFullAutotiles ??
      false,
    doNotPlaceOnTransitions:
      rawRules.doNotPlaceOnTransitions ?? fallbackRules.doNotPlaceOnTransitions ?? false,
    forbiddenAutotileCategories: mergeAutotileCategoryLists(
      rawRules.forbiddenAutotileCategories,
      fallbackRules.forbiddenAutotileCategories
    ),
  };
}

function createNormalizedFamilyPlacementRuleMap(rawRules = {}) {
  return Object.fromEntries(
    Object.entries(rawRules).map(([familyId, rule]) => [normalizeFamilyId(familyId), rule || {}])
  );
}

function normalizeFamilyPlacementRule(familyId, rawRule = {}, fallbackRule = {}) {
  return {
    ...fallbackRule,
    ...rawRule,
    allowedTerrains: inferAllowedTerrains(
      familyId,
      mergeTerrainLists(
        rawRule.allowedTerrains,
        fallbackRule.allowedTerrains,
        `integration-allowed-terrains:${familyId}`
      )
    ),
    requiresAutotileCategory: mergeAutotileCategoryLists(
      rawRule.requiresAutotileCategory,
      fallbackRule.requiresAutotileCategory
    ),
    requiresFullNeighborRing:
      rawRule.requiresFullNeighborRing ?? fallbackRule.requiresFullNeighborRing ?? false,
    forbiddenNearbyTerrains: mergeTerrainLists(
      rawRule.forbiddenNearbyTerrains,
      fallbackRule.forbiddenNearbyTerrains,
      `integration-forbidden-nearby:${familyId}`
    ),
  };
}

function normalizeIntegrationRules(rawRules = {}) {
  const defaultRuleMap = createNormalizedFamilyPlacementRuleMap(
    DEFAULT_WORLD_INTEGRATION_RULES.familyPlacementRules
  );
  const rawRuleMap = createNormalizedFamilyPlacementRuleMap(rawRules.familyPlacementRules);
  const familyIds = [
    ...new Set([...Object.keys(defaultRuleMap), ...Object.keys(rawRuleMap)]),
  ];

  return Object.freeze({
    ...rawRules,
    globalPlacement: Object.freeze(
      normalizeGlobalPlacementRules(
        rawRules.globalPlacement,
        DEFAULT_WORLD_INTEGRATION_RULES.globalPlacement
      )
    ),
    familyPlacementRules: Object.freeze(
      Object.fromEntries(
        familyIds.map((familyId) => [
          familyId,
          Object.freeze(
            normalizeFamilyPlacementRule(
              familyId,
              rawRuleMap[familyId],
              defaultRuleMap[familyId]
            )
          ),
        ])
      )
    ),
  });
}

function normalizeFamily(rawFamilyId, family = {}) {
  const id = normalizeFamilyId(rawFamilyId);
  const allowedTerrains = inferAllowedTerrains(
    id,
    normalizeTerrainList(
      family.allowedTerrains,
      [],
      `family-allowed-terrains:${rawFamilyId}`
    )
  );
  const forbiddenTerrains = normalizeTerrainList(
    family.forbiddenTerrains,
    [],
    `family-forbidden-terrains:${rawFamilyId}`
  );

  return {
    ...family,
    id,
    rawFamilyId,
    enabled: family.enabled !== false,
    spawnable: family.spawnable !== false,
    renderLayer: family.renderLayer || "decor_ground",
    allowedTerrains,
    forbiddenTerrains,
    requiresAutotileCategory: normalizeAutotileCategoryList(
      family.requiresAutotileCategory
    ),
    avoidAutotileCategories: normalizeAutotileCategoryList(
      family.avoidAutotileCategories
    ),
    nearTerrain: normalizeTerrainList(
      family.nearTerrain,
      [],
      `family-near-terrain:${rawFamilyId}`
    ),
    nearObjectFamilies: Array.isArray(family.nearObjectFamilies)
      ? [...new Set(family.nearObjectFamilies.map((value) => String(value)))]
      : [],
    nearTerrainRadiusTiles: Number.isFinite(family.nearTerrainRadiusTiles)
      ? family.nearTerrainRadiusTiles
      : 2,
    variantIds: Array.isArray(family.variantIds) ? [...family.variantIds] : [],
  };
}

function normalizeAtlasRect(id, atlas, fallbackWidth, fallbackHeight) {
  const rect = {
    x: atlas?.x,
    y: atlas?.y,
    width: atlas?.width ?? fallbackWidth,
    height: atlas?.height ?? fallbackHeight,
  };

  if (
    !isFiniteAtlasCoord(rect.x) ||
    !isFiniteAtlasCoord(rect.y) ||
    !Number.isFinite(rect.width) ||
    rect.width <= 0 ||
    !Number.isFinite(rect.height) ||
    rect.height <= 0
  ) {
    warnOnce(`atlas:${id}`, "Skipping world tile metadata item with invalid atlas data.", {
      id,
      atlas,
    });
    return null;
  }

  return rect;
}

function normalizeTile(
  tileId,
  tile = {},
  familiesByRawId,
  tileSize
) {
  const rawFamilyId = tile.family;
  const family = familiesByRawId[rawFamilyId] || null;
  const normalizedFamilyId = family?.id || normalizeFamilyId(rawFamilyId || "ungrouped");
  const atlas = normalizeAtlasRect(tileId, tile.atlas, tileSize, tileSize);

  if (!atlas) {
    return null;
  }

  const allowedTerrains = inferAllowedTerrains(
    normalizedFamilyId,
    normalizeTerrainList(
      tile?.placement?.allowedTerrains,
      family?.allowedTerrains || [],
      `tile-allowed-terrains:${tileId}`
    )
  );
  const forbiddenTerrains = normalizeTerrainList(
    tile?.placement?.forbiddenTerrains,
    family?.forbiddenTerrains || [],
    `tile-forbidden-terrains:${tileId}`
  );
  const renderLayer =
    tile?.placement?.renderLayer || family?.renderLayer || "decor_ground";
  const gridWidth = Math.max(1, Math.round(tile?.grid?.width || atlas.width / tileSize || 1));
  const gridHeight = Math.max(
    1,
    Math.round(tile?.grid?.height || atlas.height / tileSize || 1)
  );

  return {
    id: tile.id || tileId,
    enabled: tile.enabled !== false && family?.enabled !== false,
    spawnable: tile.spawnable !== false && family?.spawnable !== false,
    family: normalizedFamilyId,
    rawFamilyId,
    type: tile.type || family?.type || "decor",
    group: tile.group || family?.group || "world_metadata",
    category: tile.category || tile.type || family?.type || "decor",
    name: tile.name || tile.id || tileId,
    description: tile.description || family?.notes || tile.integrationNotes || "",
    atlas,
    grid: {
      width: gridWidth,
      height: gridHeight,
    },
    renderLayer,
    placementMode:
      tile?.placement?.placementMode || family?.placementMode || "scatter",
    densityKey: tile?.placement?.density || family?.density || "low",
    allowedTerrains,
    forbiddenTerrains,
    requiresAutotileCategory: normalizeAutotileCategoryList(
      tile?.placement?.requiresAutotileCategory || family?.requiresAutotileCategory
    ),
    avoidAutotileCategories: normalizeAutotileCategoryList(
      tile?.placement?.avoidAutotileCategories || family?.avoidAutotileCategories
    ),
    nearTerrain: normalizeTerrainList(
      tile?.placement?.nearTerrain,
      family?.nearTerrain || [],
      `tile-near-terrain:${tileId}`
    ),
    nearTerrainRadiusTiles: Number.isFinite(tile?.placement?.nearTerrainRadiusTiles)
      ? tile.placement.nearTerrainRadiusTiles
      : family?.nearTerrainRadiusTiles || 2,
    nearObjectFamilies: Array.isArray(tile?.placement?.nearObjectFamilies)
      ? [...new Set(tile.placement.nearObjectFamilies.map((value) => String(value)))]
      : family?.nearObjectFamilies || [],
    collisionType:
      tile?.collision?.type || family?.collisionType || "none",
    walkable:
      tile?.collision?.walkable ?? family?.walkable ?? true,
    tags: Array.isArray(tile.tags)
      ? [...new Set(tile.tags.map((value) => String(value)))]
      : Array.isArray(family?.tags)
        ? [...new Set(family.tags.map((value) => String(value)))]
        : [],
    sourceIntent: tile.sourceIntent || null,
    integrationNotes: tile.integrationNotes || family?.notes || "",
    variantIndex: Number.isFinite(tile.variantIndex) ? tile.variantIndex : null,
    interaction: tile.interaction || family?.interaction || null,
  };
}

function normalizeAnimation(animationId, animation = {}, tileSize) {
  const integrationAnimationRule =
    rawWorldTileMetadata?.integrationRules?.animationPlacement?.[animationId] || {};
  const placement = animation?.placement || {};
  const collision = animation?.collision || integrationAnimationRule?.collision || null;
  const frames = Array.isArray(animation.frames)
    ? animation.frames
        .map((frame, index) => {
          const atlas = normalizeAtlasRect(
            `${animationId}:frame:${index}`,
            frame.atlas,
            animation.frameSize?.width || tileSize,
            animation.frameSize?.height || tileSize
          );

          if (!atlas) {
            return null;
          }

          return {
            index: Number.isFinite(frame.index) ? frame.index : index,
            atlas,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.index - b.index)
    : [];

  if (!frames.length) {
    warnOnce(
      `animation-frames:${animationId}`,
      "Skipping world animation with no valid frames.",
      { animationId }
    );
    return null;
  }

  const frameWidth = animation.frameSize?.width || frames[0].atlas.width;
  const frameHeight = animation.frameSize?.height || frames[0].atlas.height;
  const allowedTerrains = normalizeTerrainList(
    placement.allowedTerrains,
    integrationAnimationRule.allowedTerrains || [],
    `animation-allowed-terrains:${animationId}`
  );
  const forbiddenTerrains = normalizeTerrainList(
    placement.forbiddenTerrains,
    integrationAnimationRule.forbiddenTerrains || [],
    `animation-forbidden-terrains:${animationId}`
  );

  return {
    id: animation.id || animationId,
    enabled: animation.enabled !== false,
    spawnable: placement.spawnable ?? integrationAnimationRule.spawnable ?? true,
    category: animation.category || "animated_decor",
    name: animation.name || animation.id || animationId,
    description: animation.description || "",
    seasonal: animation.seasonal !== false,
    frameWidth,
    frameHeight,
    frameCount: Number.isFinite(animation.frameCount)
      ? animation.frameCount
      : frames.length,
    frames,
    loop: animation.loop !== false,
    fps: Number.isFinite(animation.fps) && animation.fps > 0 ? animation.fps : 8,
    placementType: placement.type || integrationAnimationRule.placement || "random_sparse_overlay",
    allowedTerrains,
    forbiddenTerrains,
    requiresAutotileCategory: normalizeAutotileCategoryList(
      placement.requiresResolvedAutotileCategory
        ? [placement.requiresResolvedAutotileCategory]
        : integrationAnimationRule.requiresResolvedAutotileCategory
          ? [integrationAnimationRule.requiresResolvedAutotileCategory]
          : placement.requiresAutotileCategory || integrationAnimationRule.requiresAutotileCategory || []
    ),
    avoidAutotileCategories: placement.avoidBordersAndCorners
      ? ["edges", "outer_corners", "inner_corners", "corridors", "sides", "isolated", "complex"]
      : [],
    walkable: placement.walkable ?? integrationAnimationRule.walkable ?? collision?.walkable ?? true,
    collisionType:
      collision?.type || placement.collisionType || integrationAnimationRule.collisionType || "none",
    densityKey: placement.density || integrationAnimationRule.density || "low",
    nearTerrain: normalizeTerrainList(
      placement.nearTerrain,
      integrationAnimationRule.nearTerrain || [],
      `animation-near-terrain:${animationId}`
    ),
    nearObjectFamilies: Array.isArray(placement.nearObjectFamilies)
      ? [...new Set(placement.nearObjectFamilies.map((value) => String(value)))]
      : Array.isArray(integrationAnimationRule.nearObjectFamilies)
        ? [...new Set(integrationAnimationRule.nearObjectFamilies.map((value) => String(value)))]
        : [],
    nearTerrainRadiusTiles: Number.isFinite(placement.nearTerrainRadiusTiles)
      ? placement.nearTerrainRadiusTiles
      : Number.isFinite(integrationAnimationRule.nearTerrainRadiusTiles)
        ? integrationAnimationRule.nearTerrainRadiusTiles
        : 2,
    avoidWaterNearby: Boolean(placement.avoidWaterNearby ?? integrationAnimationRule.avoidWaterNearby),
    raw: {
      ...animation,
      integrationRule: integrationAnimationRule,
      collision,
    },
  };
}

function groupBy(items, getKeys) {
  const groups = {};

  items.forEach((item) => {
    getKeys(item).forEach((key) => {
      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(item);
    });
  });

  return Object.freeze(
    Object.fromEntries(
      Object.entries(groups).map(([key, values]) => [key, Object.freeze(values)])
    )
  );
}

function normalizeWorldTileMetadata(rawMetadata = {}) {
  const tileSize = rawMetadata?.meta?.tileSize || 16;
  const familiesByRawId = Object.fromEntries(
    Object.entries(rawMetadata.families || {}).map(([familyId, family]) => [
      familyId,
      normalizeFamily(familyId, family),
    ])
  );
  const families = Object.freeze(
    Object.fromEntries(
      Object.values(familiesByRawId).map((family) => [family.id, Object.freeze(family)])
    )
  );
  const enabledTiles = Object.freeze(
    Object.entries(rawMetadata.tiles || {})
      .map(([tileId, tile]) => normalizeTile(tileId, tile, familiesByRawId, tileSize))
      .filter(Boolean)
      .filter((tile) => tile.enabled)
      .map((tile) => Object.freeze(tile))
  );
  const tilesById = Object.freeze(
    Object.fromEntries(enabledTiles.map((tile) => [tile.id, tile]))
  );
  const enabledAnimations = Object.freeze(
    Object.entries(rawMetadata.animations || {})
      .map(([animationId, animation]) => normalizeAnimation(animationId, animation, tileSize))
      .filter(Boolean)
      .filter((animation) => animation.enabled)
      .map((animation) => Object.freeze(animation))
  );
  const animationsById = Object.freeze(
    Object.fromEntries(enabledAnimations.map((animation) => [animation.id, animation]))
  );

  return Object.freeze({
    raw: rawMetadata,
    meta: rawMetadata.meta || {},
    tileSize,
    integrationRules: normalizeIntegrationRules(rawMetadata.integrationRules || {}),
    families,
    enabledTiles,
    tilesById,
    tilesByFamily: groupBy(enabledTiles, (tile) => [tile.family]),
    tilesByCategory: groupBy(enabledTiles, (tile) => [tile.category]),
    tilesByAllowedTerrain: groupBy(enabledTiles, (tile) => tile.allowedTerrains),
    animations: enabledAnimations,
    animationsById,
    animationsByAllowedTerrain: groupBy(enabledAnimations, (animation) =>
      animation.allowedTerrains
    ),
  });
}

const normalizedWorldTileMetadata = normalizeWorldTileMetadata(rawWorldTileMetadata);

export const WORLD_TILE_METADATA = normalizedWorldTileMetadata;
export const WORLD_TILE_METADATA_INTEGRATION_RULES =
  normalizedWorldTileMetadata.integrationRules;
export const WORLD_TILE_METADATA_META = normalizedWorldTileMetadata.meta;
export const WORLD_TILE_METADATA_FAMILIES = normalizedWorldTileMetadata.families;
export const WORLD_TILE_METADATA_TILES = normalizedWorldTileMetadata.enabledTiles;
export const WORLD_TILE_METADATA_TILES_BY_FAMILY =
  normalizedWorldTileMetadata.tilesByFamily;
export const WORLD_TILE_METADATA_TILES_BY_CATEGORY =
  normalizedWorldTileMetadata.tilesByCategory;
export const WORLD_TILE_METADATA_TILES_BY_ALLOWED_TERRAIN =
  normalizedWorldTileMetadata.tilesByAllowedTerrain;
export const WORLD_TILE_METADATA_ANIMATIONS =
  normalizedWorldTileMetadata.animationsById;

export function getWorldTileMetadataFamily(familyId) {
  return WORLD_TILE_METADATA_FAMILIES[normalizeFamilyId(familyId)] || null;
}

export function getWorldTileMetadataTilesForFamily(familyId) {
  return (
    WORLD_TILE_METADATA_TILES_BY_FAMILY[normalizeFamilyId(familyId)] || Object.freeze([])
  );
}

export function getWorldTileMetadataAnimation(animationId) {
  return WORLD_TILE_METADATA_ANIMATIONS[animationId] || null;
}
