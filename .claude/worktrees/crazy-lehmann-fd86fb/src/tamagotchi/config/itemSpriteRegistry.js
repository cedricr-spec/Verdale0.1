// Compatibility adapter for legacy world/menu item sprite usage.
// New inventory items live in itemsRegistry.js + itemSprites.js.

import { ITEMS_REGISTRY as INVENTORY_ITEMS } from "./itemsRegistry"
import { getItemSpriteAsset } from "./itemSprites"

const DEFAULT_ITEM_TYPE = "food"
const DEFAULT_ITEM_KEY = null
const DEFAULT_SPRITE_SIZE = 16

export const ITEM_SPRITE_REGISTRY = {}

const LEGACY_ITEM_REGISTRY = {}

export const ITEM_REGISTRY = {
  ...LEGACY_ITEM_REGISTRY,
  ...INVENTORY_ITEMS,
}

function resolveLegacySprite(category, spriteKey) {
  if (!category || !spriteKey) return null

  const item = category.items?.[spriteKey]
  if (!item) return null

  if (item.src) {
    return {
      src: item.src,
      width: item.width || category.tileWidth || DEFAULT_SPRITE_SIZE,
      height: item.height || category.tileHeight || DEFAULT_SPRITE_SIZE,
      isDirectAsset: true,
    }
  }

  const tileWidth = category.tileWidth || DEFAULT_SPRITE_SIZE
  const tileHeight = category.tileHeight || DEFAULT_SPRITE_SIZE

  return {
    sheet: item.sheet || category.sheet,
    width: tileWidth,
    height: tileHeight,
    x: (item.col || 0) * tileWidth,
    y: (item.row || 0) * tileHeight,
    backgroundSize: "auto",
    isDirectAsset: false,
  }
}

export function getItemDefinition(itemKey) {
  return ITEM_REGISTRY[itemKey] || null
}

export function getItemSprite(type, spriteKey) {
  const category =
    ITEM_SPRITE_REGISTRY[type] || ITEM_SPRITE_REGISTRY[DEFAULT_ITEM_TYPE]
  if (!category) return null

  const safeKey =
    spriteKey && category.items?.[spriteKey] ? spriteKey : DEFAULT_ITEM_KEY

  if (!safeKey || !category.items?.[safeKey]) return null

  return resolveLegacySprite(category, safeKey)
}

export function getItemMenuSprite(itemKey) {
  const sprite = getItemSpriteAsset(itemKey, "inventory")
  if (sprite) return sprite

  const item = getItemDefinition(itemKey)
  if (!item?.menuSpriteKey) return null

  return getItemSprite(item.type, item.menuSpriteKey)
}

export function getItemWorldSprite(itemKey) {
  const sprite = getItemSpriteAsset(itemKey, "world")
  if (sprite) return sprite

  const item = getItemDefinition(itemKey)
  if (!item?.worldSpriteKey) return null

  return getItemSprite(item.type, item.worldSpriteKey)
}
