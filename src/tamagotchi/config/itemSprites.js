import { getCanonicalItemId, getItemDefinition } from "./itemsRegistry"

// V1 uses emoji rendering by default.
// Later, replace null entries or item spritePath values with real sprite assets.

export const ITEM_SPRITES = {
  wood: {
    inventory: null,
    world: null,
  },
  gears: {
    inventory: null,
    world: null,
  },
  apple: {
    inventory: null,
    world: null,
  },
  stone: {
    inventory: null,
    world: null,
  },
  water_drop: {
    inventory: null,
    world: null,
  },
  flower: {
    inventory: null,
    world: null,
  },
  mushroom: {
    inventory: null,
    world: null,
  },
  berry: {
    inventory: null,
    world: null,
  },
  gem: {
    inventory: null,
    world: null,
  },
  axe: {
    inventory: null,
    world: null,
  },
  cake: {
    inventory: null,
    world: null,
  },
  care_kit: {
    inventory: null,
    world: null,
  },
  campfire: {
    inventory: null,
    world: null,
  },
  mushroom_soup: {
    inventory: null,
    world: null,
  },
  fruit_salad: {
    inventory: null,
    world: null,
  },
  flower_charm: {
    inventory: null,
    world: null,
  },
  stone_path: {
    inventory: null,
    world: null,
  },
  iron_frame: {
    inventory: null,
    world: null,
  },
  lucky_gem: {
    inventory: null,
    world: null,
  },
}

export function getItemSpriteAsset(itemId, variant = "inventory") {
  const canonicalItemId = getCanonicalItemId(itemId) || itemId
  const configuredSprite = ITEM_SPRITES[canonicalItemId]?.[variant] || null

  if (configuredSprite) return configuredSprite

  const definition = getItemDefinition(canonicalItemId)
  if (definition?.spritePath) {
    return {
      src: definition.spritePath,
    }
  }

  return null
}
