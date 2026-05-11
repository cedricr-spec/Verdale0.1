export const ITEM_TYPES = {
  RESOURCE: "resource",
  TOOL: "tool",
  FOOD: "food",
  CARE: "care",
}

export const ITEMS_REGISTRY = {
  wood: {
    id: "wood",
    name: "Wood",
    type: ITEM_TYPES.RESOURCE,
    emoji: "🪵",
    sprite: null,
    spriteKey: "wood",
    stackable: true,
    maxStack: 99,
    usable: false,
    equipable: false,
    reward: "inventory_item",
    rewardAmount: 1,
  },
  metal: {
    id: "metal",
    name: "Metal",
    type: ITEM_TYPES.RESOURCE,
    emoji: "⚙️",
    sprite: null,
    spriteKey: "metal",
    stackable: true,
    maxStack: 99,
    usable: false,
    equipable: false,
    reward: "inventory_item",
    rewardAmount: 1,
  },
  fruits: {
    id: "fruits",
    name: "Fruits",
    type: ITEM_TYPES.RESOURCE,
    emoji: "🍎",
    sprite: null,
    spriteKey: "fruits",
    stackable: true,
    maxStack: 99,
    usable: true,
    equipable: false,
    reward: "inventory_item",
    rewardAmount: 1,
    useEffects: {
      hunger: 6,
      health: 2,
    },
  },
  axe: {
    id: "axe",
    name: "Axe",
    type: ITEM_TYPES.TOOL,
    emoji: "🪓",
    sprite: null,
    spriteKey: "axe",
    stackable: false,
    maxStack: 1,
    usable: false,
    equipable: true,
  },
  cake: {
    id: "cake",
    name: "Cake",
    type: ITEM_TYPES.FOOD,
    emoji: "🍰",
    sprite: null,
    spriteKey: "cake",
    stackable: true,
    maxStack: 10,
    usable: true,
    equipable: false,
    useEffects: {
      hunger: 14,
      happiness: 6,
    },
  },
  care_kit: {
    id: "care_kit",
    name: "Care Kit",
    type: ITEM_TYPES.CARE,
    emoji: "🩹",
    sprite: null,
    spriteKey: "care_kit",
    stackable: true,
    maxStack: 10,
    usable: true,
    equipable: false,
    useEffects: {
      health: 18,
      happiness: 2,
    },
  },
}

export const RESOURCE_ITEM_IDS = ["wood", "metal", "fruits"]

export function getItemDefinition(itemId) {
  return ITEMS_REGISTRY[itemId] || null
}

export function getItemMaxStack(itemId) {
  return getItemDefinition(itemId)?.maxStack || 1
}

export function isItemStackable(itemId) {
  return Boolean(getItemDefinition(itemId)?.stackable)
}
