import FARMING_ATLAS from "../../spritesheets/farming/farming_atlas_complete.json"
import cropTilesPng from "../../spritesheets/farming/Crops Tiles.png"
import cropObjectsPng from "../../spritesheets/farming/Crops Objects.png"
import cropIconsPng from "../../spritesheets/farming/Crops Icons.png"

export { FARMING_ATLAS }

export const FARMING_CROP_TILES_KEY = "farming_crop_tiles"
export const FARMING_CROP_OBJECTS_KEY = "farming_crop_objects"
export const FARMING_CROP_ICONS_KEY = "farming_crop_icons"

export const FARMING_TEXTURES = [
  { key: FARMING_CROP_TILES_KEY, url: cropTilesPng },
  { key: FARMING_CROP_OBJECTS_KEY, url: cropObjectsPng },
  { key: FARMING_CROP_ICONS_KEY, url: cropIconsPng },
]

const SHEET_TO_TEXTURE_KEY = {
  cropTiles: FARMING_CROP_TILES_KEY,
  cropObjects: FARMING_CROP_OBJECTS_KEY,
  cropIcons: FARMING_CROP_ICONS_KEY,
}

const SHEET_TO_ATLAS_SOURCE = {
  cropTiles: cropTilesPng,
  cropObjects: cropObjectsPng,
  cropIcons: cropIconsPng,
}

export function getTextureKeyForSheet(sheet) {
  return SHEET_TO_TEXTURE_KEY[sheet] || null
}

export function getAtlasSourceForSheet(sheet) {
  return SHEET_TO_ATLAS_SOURCE[sheet] || null
}

// Returns { textureKey, x, y, width, height } for a soil state
export function getSoilSpriteInfo(stateKey) {
  const entry = FARMING_ATLAS.soil[stateKey]
  if (!entry) return null
  return {
    textureKey: getTextureKeyForSheet(entry.sheet),
    x: entry.x,
    y: entry.y,
    width: FARMING_ATLAS.tileSize,
    height: FARMING_ATLAS.tileSize,
  }
}

// Returns { textureKey, x, y, width, height } for a crop at a given growth stage
export function getCropSpriteInfo(cropId, growthStage) {
  const crop = FARMING_ATLAS.crops[cropId]
  if (!crop) return null
  const g = crop.growth
  return {
    textureKey: getTextureKeyForSheet(g.sheet),
    x: g.startX + growthStage * g.stageSpacingX,
    y: g.startY,
    width: g.stageWidth,
    height: g.stageHeight,
  }
}

export function getCropFoodSpriteInfo(cropId) {
  const food = FARMING_ATLAS.crops[cropId]?.food
  if (!food) return null

  return {
    textureKey: getTextureKeyForSheet(food.sheet),
    x: food.x,
    y: food.y,
    width: food.width,
    height: food.height,
  }
}

export function getCropDeadSpriteInfo(cropId) {
  const dead = FARMING_ATLAS.crops[cropId]?.dead
  if (!dead) return null

  return {
    textureKey: getTextureKeyForSheet(dead.sheet),
    x: dead.x,
    y: dead.y,
    width: dead.width,
    height: dead.height,
  }
}

// Derive the soil state key from a FarmTileState
export function getSoilStateKey(tile) {
  if (!tile?.tilled) return null
  if (tile.seeded) return tile.watered ? "seededWatered" : "seededDry"
  if (tile.holed) return tile.watered ? "holeWatered" : "holeDry"
  return tile.watered ? "tilledWatered" : "tilledDry"
}

// Maps inventory seed item IDs → farming cropId
export const SEED_TO_CROP = {
  carrot_seed: "carrot",
  turnip_seed: "turnip",
  potato_seed: "potato",
  tomato_seed: "tomato",
}

// Maps cropId → harvested food item ID
export const CROP_TO_FOOD = {
  carrot: "carrot_food",
  turnip: "turnip_food",
  potato: "potato_food",
  tomato: "tomato_food",
}

// Maps cropId → seed item ID (returned on harvest)
export const CROP_TO_SEED = {
  carrot: "carrot_seed",
  turnip: "turnip_seed",
  potato: "potato_seed",
  tomato: "tomato_seed",
}

// Full set of valid seed item IDs
export const SEED_ITEM_IDS = new Set(Object.keys(SEED_TO_CROP))

// Growth stages: 0–3 are intermediate, 4 is harvestable
export const MAX_GROWTH_STAGE = 4

// Returns { atlasSource, atlasRect } for an item's UI icon derived from the
// farming atlas — handles *_seed → crop.seedBag and *_food → crop.food.
// Returns null for items not derivable this way (caller falls back to itemsRegistry).
export function getItemAtlasInfo(itemId) {
  if (!itemId) return null

  if (itemId.endsWith("_seed")) {
    const cropId = itemId.replace(/_seed$/, "")
    const bag = FARMING_ATLAS.crops[cropId]?.seedBag
    const atlasSource = getAtlasSourceForSheet(bag?.sheet)
    if (bag && atlasSource) {
      return {
        atlasSource,
        atlasRect: {
          x: bag.x,
          y: bag.y,
          width: bag.width,
          height: bag.height,
        },
      }
    }
  }

  if (itemId.endsWith("_food")) {
    const cropId = itemId.replace(/_food$/, "")
    const food = FARMING_ATLAS.crops[cropId]?.food
    const atlasSource = getAtlasSourceForSheet(food?.sheet)
    if (food && atlasSource) {
      return {
        atlasSource,
        atlasRect: {
          x: food.x,
          y: food.y,
          width: food.width,
          height: food.height,
        },
      }
    }
  }

  return null
}
