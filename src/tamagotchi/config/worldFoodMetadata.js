import metadata from "../../data/world-food-metadata-clean-v2.json"
import foodAtlasPng from "../../spritesheets/food/Icons_Food.png"

export const WORLD_FOOD_METADATA = metadata
export const WORLD_FOODS = metadata.foods || {}
export const WORLD_FOOD_RECIPES = metadata.recipes || {}
export const WORLD_FOOD_SPAWN_POOLS = metadata.spawnPools || {}

export const FOOD_ATLAS_URLS = {
  "Icons_Food.png": foodAtlasPng,
}

export function resolveFoodAtlasUrl(atlasSourcePath) {
  if (!atlasSourcePath) return null
  const filename = atlasSourcePath.split("/").pop()
  return FOOD_ATLAS_URLS[filename] || atlasSourcePath
}

function normalizeFoodDefinition(food) {
  if (!food) return null

  return {
    ...food,
    spritePath: food.spritePath?.trim() || null,
    atlasSource: resolveFoodAtlasUrl(food.atlasSource),
    atlasRect: food.atlasRect || null,
    food: food.food || null,
  }
}

export function getFoodDefinition(id) {
  return normalizeFoodDefinition(WORLD_FOODS[id] || null)
}

export function isFood(id) {
  return Boolean(getFoodDefinition(id))
}

export function getFoodStats(id) {
  return getFoodDefinition(id)?.food || null
}

export function getSpawnableFoods() {
  const pool = WORLD_FOOD_SPAWN_POOLS?.nature_food
  if (!pool?.enabled) return []

  return (pool.itemIds || [])
    .map((itemId) => getFoodDefinition(itemId))
    .filter((food) => food?.enabled && food?.spawnable)
}
