import {
  NORMALIZED_REGISTRY_ITEMS_BY_ID,
  NORMALIZED_REGISTRY_RECIPES_BY_ID,
  RAW_NORMALIZED_ITEM_REGISTRY,
  getWorldSpawnEntries,
  resolveItemAtlasUrl,
} from "./normalizedItemRegistry"

export const WORLD_ITEM_METADATA = RAW_NORMALIZED_ITEM_REGISTRY
export const WORLD_ITEMS = NORMALIZED_REGISTRY_ITEMS_BY_ID
export const WORLD_RECIPES = NORMALIZED_REGISTRY_RECIPES_BY_ID

export function resolveAtlasUrl(atlasSourcePath) {
  return resolveItemAtlasUrl(atlasSourcePath)
}

export function getWorldItemDef(itemId) {
  return WORLD_ITEMS[itemId] || null
}

export function getWorldRecipeDef(recipeId) {
  return WORLD_RECIPES[recipeId] || null
}

export function getSpawnableItemIds() {
  return getWorldSpawnEntries().map((entry) => entry.itemId)
}

export const WORLD_INTERACTION_STUBS = {
  mine: { enabled: true, targetFamilies: ["rocks"], requiredTool: "pickaxe" },
  chop: { enabled: true, targetFamilies: ["trees"], requiredTool: "axe" },
  fill: { enabled: true, nearTerrain: "water", requiredTool: "wooden_bucket" },
}
