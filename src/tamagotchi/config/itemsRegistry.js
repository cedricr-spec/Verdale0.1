import cropObjectsPng from "../../spritesheets/farming/Crops Objects.png"
import {
  NORMALIZED_REGISTRY_ALIASES,
  NORMALIZED_REGISTRY_ITEMS,
  NORMALIZED_REGISTRY_RECIPES,
  getCanonicalRegistryItemId,
  getDefaultWorldInteractionConfig,
  getItemToolProfile,
  getNormalizedRegistryItem,
  getNormalizedRegistryRecipe,
  getObtainEntriesByType,
  getObtainEntriesForItem,
  getRegistryRecipesByStation,
  getWorldSpawnEntries,
  matchesToolRequirement,
  resolveItemAtlasUrl,
} from "./normalizedItemRegistry"
import { getFoodDefinition, WORLD_FOODS } from "./worldFoodMetadata"

export const ITEM_TYPES = {
  MATERIAL: "material",
  TOOL: "tool",
  FOOD: "food",
  CARE: "care",
  RARE: "rare",
  STRUCTURE: "structure",
  CHARM: "charm",
  RESOURCE: "resource",
  CONTAINER: "container",
}

function createItemDefinition({
  id,
  name,
  icon,
  spritePath = null,
  type,
  category = null,
  description,
  spriteKey = id,
  stackable = true,
  maxStack = 99,
  usable = false,
  equipable = false,
  reward = null,
  rewardAmount = 1,
  useEffects,
  legacyIds = [],
  atlasSource = null,
  atlasRect: atlasRectVal = null,
  food = null,
  seedForCropId = null,
  discardable = null,
  tool = null,
  gameplay = null,
  crafting = null,
  obtainableFrom = [],
  dropRules = null,
}) {
  const resolvedDiscardable =
    typeof discardable === "boolean"
      ? discardable
      : [ITEM_TYPES.FOOD, ITEM_TYPES.MATERIAL, ITEM_TYPES.RESOURCE, ITEM_TYPES.CARE, ITEM_TYPES.TOOL].includes(type)

  return {
    id,
    name,
    icon,
    emoji: icon,
    spritePath,
    type,
    category,
    description,
    spriteKey,
    stackable,
    maxStack,
    usable,
    equipable,
    reward,
    rewardAmount,
    useEffects,
    legacyIds,
    atlasSource,
    atlasRect: atlasRectVal,
    food,
    seedForCropId,
    discardable: resolvedDiscardable,
    tool,
    gameplay,
    crafting,
    obtainableFrom,
    dropRules,
  }
}

function getRegistryItemType(registryItem) {
  const category = registryItem?.gameplay?.category
  const toolProfile = registryItem?.tool

  if (toolProfile?.kind === "bucket") return ITEM_TYPES.CONTAINER
  if (toolProfile) return ITEM_TYPES.TOOL
  if (category === "resource") return ITEM_TYPES.RESOURCE
  if (category === "object") return ITEM_TYPES.STRUCTURE
  if (registryItem?.id === "complete_crystal_gem") return ITEM_TYPES.RARE
  return ITEM_TYPES.MATERIAL
}

function isEquipableTool(toolProfile) {
  if (!toolProfile?.kind) return false
  return toolProfile.kind !== "bucket"
}

function isUsableRegistryItem(registryItem) {
  const toolProfile = registryItem?.tool
  if (toolProfile?.kind) return true
  return registryItem?.id === "complete_crystal_gem"
}

function createRegistryItemDefinition(registryItem) {
  const type = getRegistryItemType(registryItem)

  return createItemDefinition({
    id: registryItem.id,
    name: registryItem.name || registryItem.id,
    icon: registryItem.displayIcon || "📦",
    type,
    category: registryItem?.gameplay?.category || null,
    description: registryItem?.raw?.description || registryItem?.description || registryItem?.name || "",
    stackable: registryItem.stackable,
    maxStack: registryItem.maxStack,
    usable: isUsableRegistryItem(registryItem),
    equipable: isEquipableTool(registryItem.tool),
    reward: "inventory_item",
    rewardAmount: 1,
    legacyIds: registryItem.legacyIds,
    atlasSource: registryItem.atlasSource,
    atlasRect: registryItem.atlasRect,
    discardable: undefined,
    tool: registryItem.tool,
    gameplay: registryItem.gameplay,
    crafting: registryItem.crafting,
    obtainableFrom: registryItem.obtainableFrom,
    dropRules: registryItem.dropRules,
  })
}

const FOOD_FALLBACK_DEFINITIONS = [
  createItemDefinition({
    id: "carrot_food",
    name: "Carrot",
    icon: "🥕",
    type: ITEM_TYPES.FOOD,
    category: "vegetable",
    description: "A fresh carrot harvested from your farm.",
    maxStack: 32,
    usable: true,
    useEffects: { hunger: 8, health: 3 },
    atlasSource: cropObjectsPng,
    atlasRect: { x: 0, y: 0, width: 16, height: 16 },
  }),
  createItemDefinition({
    id: "turnip_food",
    name: "Turnip",
    icon: "🌱",
    type: ITEM_TYPES.FOOD,
    category: "vegetable",
    description: "A fresh turnip harvested from your farm.",
    maxStack: 32,
    usable: true,
    useEffects: { hunger: 7, health: 2 },
    atlasSource: cropObjectsPng,
    atlasRect: { x: 0, y: 16, width: 16, height: 16 },
  }),
  createItemDefinition({
    id: "potato_food",
    name: "Potato",
    icon: "🥔",
    type: ITEM_TYPES.FOOD,
    category: "vegetable",
    description: "A fresh potato harvested from your farm.",
    maxStack: 32,
    usable: true,
    useEffects: { hunger: 10, health: 2 },
    atlasSource: cropObjectsPng,
    atlasRect: { x: 0, y: 48, width: 16, height: 16 },
  }),
  createItemDefinition({
    id: "tomato_food",
    name: "Tomato",
    icon: "🍅",
    type: ITEM_TYPES.FOOD,
    category: "vegetable",
    description: "A ripe tomato harvested from your farm.",
    maxStack: 32,
    usable: true,
    useEffects: { hunger: 7, health: 4, happiness: 2 },
    atlasSource: cropObjectsPng,
    atlasRect: { x: 0, y: 112, width: 16, height: 16 },
  }),
]

const FOOD_FALLBACK_DEFINITION_MAP = FOOD_FALLBACK_DEFINITIONS.reduce((registry, item) => {
  registry[item.id] = item
  return registry
}, {})

function createFoodItemDefinition(foodDefinition, existingDefinition = null) {
  return createItemDefinition({
    id: foodDefinition.id,
    name: foodDefinition.name || existingDefinition?.name || foodDefinition.id,
    icon: foodDefinition.icon || existingDefinition?.icon || "🍽️",
    spritePath: foodDefinition.spritePath || existingDefinition?.spritePath || null,
    type: ITEM_TYPES.FOOD,
    category: foodDefinition.category || existingDefinition?.category || "food",
    description: foodDefinition.description || existingDefinition?.description || "",
    spriteKey: existingDefinition?.spriteKey || foodDefinition.id,
    stackable: foodDefinition.stackable ?? existingDefinition?.stackable ?? true,
    maxStack: foodDefinition.maxStack ?? existingDefinition?.maxStack ?? 32,
    usable: existingDefinition?.usable ?? false,
    equipable: existingDefinition?.equipable ?? false,
    reward: existingDefinition?.reward ?? "inventory_item",
    rewardAmount:
      foodDefinition.obtain?.outputQuantity ??
      existingDefinition?.rewardAmount ??
      1,
    useEffects: existingDefinition?.useEffects,
    discardable: existingDefinition?.discardable ?? true,
    legacyIds: existingDefinition?.legacyIds || [],
    atlasSource: foodDefinition.atlasSource || existingDefinition?.atlasSource || null,
    atlasRect: foodDefinition.atlasRect || existingDefinition?.atlasRect || null,
    food: foodDefinition.food || existingDefinition?.food || null,
  })
}

const REGISTRY_ITEM_DEFINITIONS = NORMALIZED_REGISTRY_ITEMS.map(createRegistryItemDefinition)

const FOOD_ITEM_DEFINITIONS = Object.keys(WORLD_FOODS)
  .map((foodId) => getFoodDefinition(foodId))
  .filter((food) => food?.enabled)
  .map((food) => createFoodItemDefinition(food, FOOD_FALLBACK_DEFINITION_MAP[food.id]))

const FOOD_ITEM_IDS = new Set(FOOD_ITEM_DEFINITIONS.map((item) => item.id))

const ITEM_DEFINITIONS = [
  ...REGISTRY_ITEM_DEFINITIONS.filter((item) => !FOOD_ITEM_IDS.has(item.id)),
  ...FOOD_ITEM_DEFINITIONS,
]

export const ITEMS_REGISTRY = ITEM_DEFINITIONS.reduce((registry, item) => {
  registry[item.id] = item
  return registry
}, {})

export const ITEM_ALIASES = ITEM_DEFINITIONS.reduce(
  (aliases, item) => {
    item.legacyIds.forEach((legacyId) => {
      aliases[legacyId] = item.id
    })
    return aliases
  },
  {
    ...NORMALIZED_REGISTRY_ALIASES,
  }
)

export function getCanonicalItemId(itemId) {
  if (!itemId) return null
  if (ITEMS_REGISTRY[itemId]) return itemId
  return ITEM_ALIASES[itemId] || getCanonicalRegistryItemId(itemId)
}

export function getItemDefinition(itemId) {
  const canonicalItemId = getCanonicalItemId(itemId)
  return canonicalItemId ? ITEMS_REGISTRY[canonicalItemId] || null : null
}

export function getItemMaxStack(itemId) {
  return getItemDefinition(itemId)?.maxStack || 1
}

export function isItemStackable(itemId) {
  return Boolean(getItemDefinition(itemId)?.stackable)
}

export function isItemDiscardable(itemId) {
  return Boolean(getItemDefinition(itemId)?.discardable)
}

export {
  NORMALIZED_REGISTRY_RECIPES,
  getDefaultWorldInteractionConfig,
  getItemToolProfile,
  getNormalizedRegistryItem,
  getNormalizedRegistryRecipe,
  getObtainEntriesByType,
  getObtainEntriesForItem,
  getRegistryRecipesByStation,
  getWorldSpawnEntries,
  matchesToolRequirement,
  resolveItemAtlasUrl,
}
