import rawAutotileTemplates from "../../spritesheets/world/autotile-templates-clean.json";
import {
  AUTOTILE_NEIGHBOR_KEYS,
  AUTOTILE_PATTERN_CATEGORY_KEYS,
  buildAutotileMaskSignature,
  normalizeAutotileTemplatesData,
} from "./autotileRuntimeCore.js";

const normalizedAutotileData = normalizeAutotileTemplatesData(rawAutotileTemplates);
const normalizedTemplates = Object.freeze(normalizedAutotileData.templates);
const templateIdsByCenterTerrain = Object.freeze(
  Object.fromEntries(
    Object.entries(normalizedAutotileData.templateIdsByCenterTerrain).map(
      ([terrainType, templateIds]) => [terrainType, Object.freeze([...templateIds])]
    )
  )
);
const terrainFallbackPatterns = Object.freeze({
  ...normalizedAutotileData.terrainFallbackPatterns,
});

export { AUTOTILE_NEIGHBOR_KEYS, AUTOTILE_PATTERN_CATEGORY_KEYS, buildAutotileMaskSignature };

export const AUTOTILE_TEMPLATE_META = rawAutotileTemplates?.meta || {};
export const AUTOTILE_TEMPLATES = normalizedTemplates;

export function getAutotileTemplate(templateId) {
  return normalizedTemplates[templateId] || null;
}

export function getAutotileCandidateTemplates(terrainType) {
  const templateIds = templateIdsByCenterTerrain[terrainType] || [];
  return templateIds
    .map((templateId) => normalizedTemplates[templateId])
    .filter(Boolean);
}

export function getTerrainFallbackPattern(terrainType) {
  return terrainFallbackPatterns[terrainType] || null;
}
