export const AUTOTILE_NEIGHBOR_KEYS = [
  "topLeft",
  "top",
  "topRight",
  "left",
  "right",
  "bottomLeft",
  "bottom",
  "bottomRight",
];

const AUTOTILE_MASK_KEYS = [
  "topLeft",
  "top",
  "topRight",
  "left",
  "center",
  "right",
  "bottomLeft",
  "bottom",
  "bottomRight",
];

export const AUTOTILE_PATTERN_CATEGORY_KEYS = [
  "full",
  "edges",
  "outer_corners",
  "inner_corners",
  "corridors",
  "sides",
  "isolated",
  "complex",
];

export const NEIGHBOR_COORDINATES = {
  topLeft: [-1, -1],
  top: [0, -1],
  topRight: [1, -1],
  left: [-1, 0],
  right: [1, 0],
  bottomLeft: [-1, 1],
  bottom: [0, 1],
  bottomRight: [1, 1],
};

function normalizeMaskToken(value) {
  return value === "A" || value === "B" ? value : null;
}

export function getOppositeMaskToken(token) {
  if (token === "A") return "B";
  if (token === "B") return "A";
  return null;
}

export function buildAutotileMaskSignature(mask = {}) {
  return AUTOTILE_MASK_KEYS.map(
    (key) => `${key}=${normalizeMaskToken(mask[key]) || "?"}`
  ).join("|");
}

function hasValidAtlasSlice(pattern) {
  const atlas = pattern?.tile?.atlas;

  return (
    Number.isFinite(atlas?.x) &&
    Number.isFinite(atlas?.y) &&
    Number.isFinite(atlas?.width) &&
    Number.isFinite(atlas?.height)
  );
}

function pickTemplateCenterToken(rawPatterns = []) {
  const tokens = [
    ...new Set(
      rawPatterns
        .map((pattern) => normalizeMaskToken(pattern?.mask?.center))
        .filter(Boolean)
    ),
  ];

  if (tokens.length === 1) {
    return tokens[0];
  }

  return null;
}

function normalizePattern(pattern, template, templateId, fallbackCenterToken = "B") {
  const centerToken = normalizeMaskToken(pattern?.mask?.center) || fallbackCenterToken;
  const normalizedMask = {
    ...pattern.mask,
    center: centerToken,
  };

  return {
    ...pattern,
    templateId,
    terrainA: template.terrainA,
    terrainB: template.terrainB,
    centerToken,
    mask: normalizedMask,
    signature: buildAutotileMaskSignature(normalizedMask),
  };
}

function pickFallbackPattern(patterns) {
  return (
    patterns.find((pattern) => pattern.id === "full" || pattern.category === "full") ||
    patterns[0] ||
    null
  );
}

function normalizeTemplate(templateId, template = {}) {
  const rawPatterns = Object.values(template.patterns || {});
  const templateCenterToken = pickTemplateCenterToken(rawPatterns) || "B";
  const patterns = rawPatterns
    .filter((pattern) => !pattern?.unused)
    .filter(hasValidAtlasSlice)
    .map((pattern) =>
      normalizePattern(pattern, template, templateId, templateCenterToken)
    );
  const bySignature = new Map();

  patterns.forEach((pattern) => {
    if (!bySignature.has(pattern.signature)) {
      bySignature.set(pattern.signature, pattern);
    }
  });

  const fallbackPattern = pickFallbackPattern(patterns);
  const centerToken = fallbackPattern?.centerToken || templateCenterToken;
  const backgroundToken = getOppositeMaskToken(centerToken) || "A";
  const centerTerrain = centerToken === "A" ? template.terrainA : template.terrainB;
  const backgroundTerrain =
    backgroundToken === "A" ? template.terrainA : template.terrainB;

  return {
    ...template,
    id: templateId,
    patterns,
    bySignature,
    fallbackPattern,
    centerToken,
    backgroundToken,
    centerTerrain,
    backgroundTerrain,
  };
}

export function normalizeAutotileTemplatesData(rawAutotileTemplates = {}) {
  const templates = Object.fromEntries(
    Object.entries(rawAutotileTemplates.templates || {}).map(
      ([templateId, template]) => [templateId, normalizeTemplate(templateId, template)]
    )
  );
  const templateIdsByCenterTerrain = {};
  const terrainFallbackPatterns = {};

  Object.values(templates).forEach((template) => {
    if (!template?.centerTerrain) return;

    if (!templateIdsByCenterTerrain[template.centerTerrain]) {
      templateIdsByCenterTerrain[template.centerTerrain] = [];
    }

    templateIdsByCenterTerrain[template.centerTerrain].push(template.id);

    if (!terrainFallbackPatterns[template.centerTerrain] && template.fallbackPattern) {
      terrainFallbackPatterns[template.centerTerrain] = template.fallbackPattern;
    }
  });

  return {
    meta: rawAutotileTemplates.meta || {},
    templates,
    templateIdsByCenterTerrain,
    terrainFallbackPatterns,
  };
}

export function getMaskTokenForTerrain(template, terrainType) {
  if (terrainType === template.terrainB) return "B";
  return "A";
}

function canonicalizeMaskByCenterToken(rawMask) {
  const centerToken = rawMask.center === "A" ? "A" : "B";
  const oppositeToken = centerToken === "A" ? "B" : "A";
  const mask = {
    ...rawMask,
  };

  if (rawMask.topLeft === centerToken) {
    mask.topLeft =
      rawMask.top === centerToken && rawMask.left === centerToken
        ? centerToken
        : oppositeToken;
  }

  if (rawMask.topRight === centerToken) {
    mask.topRight =
      rawMask.top === centerToken && rawMask.right === centerToken
        ? centerToken
        : oppositeToken;
  }

  if (rawMask.bottomLeft === centerToken) {
    mask.bottomLeft =
      rawMask.bottom === centerToken && rawMask.left === centerToken
        ? centerToken
        : oppositeToken;
  }

  if (rawMask.bottomRight === centerToken) {
    mask.bottomRight =
      rawMask.bottom === centerToken && rawMask.right === centerToken
        ? centerToken
        : oppositeToken;
  }

  return mask;
}

function buildTemplateMask(template, getTerrainAt, gridX, gridY) {
  const rawMask = {};
  let unsupportedNeighborCount = 0;

  const sampledTerrains = {
    topLeft: getTerrainAt(gridX - 1, gridY - 1),
    top: getTerrainAt(gridX, gridY - 1),
    topRight: getTerrainAt(gridX + 1, gridY - 1),
    left: getTerrainAt(gridX - 1, gridY),
    center: getTerrainAt(gridX, gridY),
    right: getTerrainAt(gridX + 1, gridY),
    bottomLeft: getTerrainAt(gridX - 1, gridY + 1),
    bottom: getTerrainAt(gridX, gridY + 1),
    bottomRight: getTerrainAt(gridX + 1, gridY + 1),
  };

  AUTOTILE_MASK_KEYS.forEach((key) => {
    const terrainType = sampledTerrains[key];
    if (terrainType !== template.terrainA && terrainType !== template.terrainB) {
      unsupportedNeighborCount += key === "center" ? 0 : 1;
    }

    rawMask[key] = getMaskTokenForTerrain(template, terrainType);
  });

  const mask = canonicalizeMaskByCenterToken(rawMask);

  return {
    sampledTerrains,
    rawMask,
    mask,
    signature: buildAutotileMaskSignature(mask),
    unsupportedNeighborCount,
  };
}

function selectBetterMatch(currentMatch, nextMatch) {
  if (!currentMatch) return nextMatch;
  if (nextMatch.unsupportedNeighborCount !== currentMatch.unsupportedNeighborCount) {
    return nextMatch.unsupportedNeighborCount < currentMatch.unsupportedNeighborCount
      ? nextMatch
      : currentMatch;
  }

  if (nextMatch.pattern?.category === "full" && currentMatch.pattern?.category !== "full") {
    return currentMatch;
  }

  return currentMatch;
}

export function resolveTerrainAutotileCore({
  getTerrainAt,
  gridX,
  gridY,
  candidateTemplates = [],
  fallbackPattern = null,
}) {
  const centerTerrain = getTerrainAt(gridX, gridY);
  let bestExactMatch = null;
  let bestFallbackMatch = null;

  candidateTemplates.forEach((template) => {
    const { sampledTerrains, rawMask, mask, signature, unsupportedNeighborCount } =
      buildTemplateMask(template, getTerrainAt, gridX, gridY);
    const pattern = template.bySignature.get(signature) || null;
    const match = {
      terrainType: centerTerrain,
      templateId: template.id,
      centerTerrain,
      centerToken: template.centerToken,
      backgroundToken: template.backgroundToken,
      backgroundTerrain: template.backgroundTerrain,
      sampledTerrains,
      rawMask,
      mask,
      maskSignature: signature,
      pattern: pattern || template.fallbackPattern || fallbackPattern,
      patternId: (pattern || template.fallbackPattern || fallbackPattern)?.id || "fallback",
      category:
        pattern?.category ||
        (pattern || template.fallbackPattern || fallbackPattern)?.category ||
        "full",
      unsupportedNeighborCount,
      usedFallback: !pattern,
    };

    if (pattern) {
      bestExactMatch = selectBetterMatch(bestExactMatch, match);
      return;
    }

    bestFallbackMatch = selectBetterMatch(bestFallbackMatch, match);
  });

  if (bestExactMatch) {
    return bestExactMatch;
  }

  if (bestFallbackMatch) {
    return bestFallbackMatch;
  }

  return {
    terrainType: centerTerrain,
    templateId: null,
    centerTerrain,
    centerToken: null,
    backgroundToken: null,
    backgroundTerrain: null,
    mask: null,
    maskSignature: null,
    pattern: fallbackPattern,
    patternId: fallbackPattern?.id || "fallback",
    category: fallbackPattern?.category || "full",
    unsupportedNeighborCount: 0,
    usedFallback: true,
  };
}
