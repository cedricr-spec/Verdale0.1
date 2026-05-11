// V1 uses emoji rendering by default.
// Later, populate these entries with real sprite definitions without changing gameplay code.

export const ITEM_SPRITES = {
  wood: {
    inventory: null,
    world: null,
  },
  metal: {
    inventory: null,
    world: null,
  },
  fruits: {
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
}

export function getItemSpriteAsset(itemId, variant = "inventory") {
  return ITEM_SPRITES[itemId]?.[variant] || null
}
