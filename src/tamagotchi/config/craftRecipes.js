import {
  NORMALIZED_REGISTRY_RECIPES,
  getCanonicalItemId,
  getItemDefinition,
} from "./itemsRegistry"
import { WORLD_FOOD_RECIPES, resolveFoodAtlasUrl } from "./worldFoodMetadata"

const LEGACY_RECIPES = [
  {
    id: "care_kit",
    name: "Care Kit",
    icon: "🩹",
    spritePath: null,
    type: "crafting",
    station: null,
    inputs: [
      { itemId: "wood_log", quantity: 1 },
      { itemId: "apple", quantity: 1 },
    ],
    outputs: [{ itemId: "care_kit", quantity: 1 }],
    category: "care",
    unlocked: true,
    showInPanel: true,
  },
  {
    id: "campfire",
    name: "Campfire",
    icon: "🔥",
    spritePath: null,
    type: "crafting",
    station: null,
    inputs: [
      { itemId: "wood_log", quantity: 3 },
      { itemId: "stone", quantity: 2 },
    ],
    outputs: [{ itemId: "campfire", quantity: 1 }],
    category: "structures",
    unlocked: true,
    showInPanel: true,
  },
  {
    id: "flower_charm",
    name: "Flower Charm",
    icon: "🌼",
    spritePath: null,
    type: "crafting",
    station: null,
    inputs: [
      { itemId: "flower", quantity: 3 },
      { itemId: "gem", quantity: 1 },
    ],
    outputs: [{ itemId: "flower_charm", quantity: 1 }],
    category: "charms",
    unlocked: true,
    showInPanel: true,
  },
  {
    id: "stone_path",
    name: "Stone Path",
    icon: "🧱",
    spritePath: null,
    type: "crafting",
    station: null,
    inputs: [{ itemId: "stone", quantity: 4 }],
    outputs: [{ itemId: "stone_path", quantity: 1 }],
    category: "structures",
    unlocked: true,
    showInPanel: true,
  },
  {
    id: "iron_frame",
    name: "Iron Frame",
    icon: "⚙️",
    spritePath: null,
    type: "crafting",
    station: null,
    inputs: [
      { itemId: "gears", quantity: 3 },
      { itemId: "stone", quantity: 2 },
    ],
    outputs: [{ itemId: "iron_frame", quantity: 1 }],
    category: "structures",
    unlocked: true,
    showInPanel: true,
  },
  {
    id: "lucky_gem",
    name: "Lucky Gem",
    icon: "💎",
    spritePath: null,
    type: "crafting",
    station: null,
    inputs: [
      { itemId: "gem", quantity: 1 },
      { itemId: "flower", quantity: 2 },
      { itemId: "water_drop", quantity: 1 },
    ],
    outputs: [{ itemId: "lucky_gem", quantity: 1 }],
    category: "charms",
    unlocked: true,
    showInPanel: true,
  },
]

function dedupeRecipesById(recipes) {
  const recipeMap = new Map()
  recipes.forEach((recipe) => {
    recipeMap.set(recipe.id, recipe)
  })
  return [...recipeMap.values()]
}

function normalizeRecipeItems(items = []) {
  return items
    .map((entry) => {
      const itemId = getCanonicalItemId(entry?.itemId) || entry?.itemId
      const quantity = Math.max(0, Number(entry?.quantity) || 0)
      if (!itemId || quantity <= 0) return null
      return { itemId, quantity }
    })
    .filter(Boolean)
}

function normalizeIngredients(ingredients = {}) {
  return normalizeRecipeItems(
    Object.entries(ingredients).map(([itemId, quantity]) => ({ itemId, quantity }))
  )
}

function getRecipeOutputDefinition(recipe) {
  const primaryOutput = recipe?.outputs?.[0] || recipe?.output || null
  return primaryOutput?.itemId ? getItemDefinition(primaryOutput.itemId) : null
}

function createRegistryRecipe(registryRecipe) {
  const outputDefinition = getRecipeOutputDefinition(registryRecipe)

  return {
    id: registryRecipe.id,
    registryRecipeId: registryRecipe.registryRecipeId,
    name: outputDefinition?.name || registryRecipe.name,
    icon: outputDefinition?.icon || registryRecipe.icon || "📦",
    spritePath: outputDefinition?.spritePath || null,
    atlasSource: outputDefinition?.atlasSource || registryRecipe.atlasSource || null,
    atlasRect: outputDefinition?.atlasRect || registryRecipe.atlasRect || null,
    inputs: registryRecipe.inputs,
    outputs: registryRecipe.outputs,
    category: outputDefinition?.category || registryRecipe.category || "material",
    type: registryRecipe.type || "crafting",
    station: registryRecipe.station || null,
    sortIndex: registryRecipe.sortIndex,
    unlocked: true,
    showInPanel: registryRecipe.showInPanel !== false,
    craftableInInventory:
      registryRecipe.type === "crafting" && (registryRecipe.station || null) === null,
  }
}

const REGISTRY_RECIPES = NORMALIZED_REGISTRY_RECIPES.map(createRegistryRecipe)

const FOOD_METADATA_RECIPES = Object.values(WORLD_FOOD_RECIPES).map((recipe) => ({
  ...recipe,
  type: recipe.type || "crafting",
  station: recipe.station || null,
  spritePath: recipe.spritePath?.trim() || null,
  atlasSource: resolveFoodAtlasUrl(recipe.atlasSource),
  atlasRect: recipe.atlasRect || null,
  category: recipe.category || "food",
  unlocked: recipe.unlocked !== false,
  showInPanel: true,
  craftableInInventory: (recipe.station || null) === null,
}))

function normalizeRecipe(recipe) {
  const outputDefinition = getRecipeOutputDefinition(recipe)

  return {
    ...recipe,
    name: recipe.name || outputDefinition?.name || recipe.id,
    icon: recipe.icon || outputDefinition?.icon || "📦",
    spritePath: recipe.spritePath ?? outputDefinition?.spritePath ?? null,
    atlasSource: recipe.atlasSource ?? outputDefinition?.atlasSource ?? null,
    atlasRect: recipe.atlasRect ?? outputDefinition?.atlasRect ?? null,
    inputs: normalizeRecipeItems(recipe.inputs || normalizeIngredients(recipe.ingredients)),
    outputs: normalizeRecipeItems(recipe.outputs || (recipe.output ? [recipe.output] : [])),
    unlocked: recipe.unlocked !== false,
    type: recipe.type || "crafting",
    station: recipe.station || null,
    craftableInInventory:
      recipe.craftableInInventory ??
      ((recipe.station || null) === null && (recipe.type || "crafting") === "crafting"),
  }
}

const RAW_CRAFT_RECIPES = dedupeRecipesById([
  ...REGISTRY_RECIPES,
  ...LEGACY_RECIPES,
  ...FOOD_METADATA_RECIPES,
])

export const CRAFT_RECIPES = RAW_CRAFT_RECIPES.map(normalizeRecipe)

const CRAFT_RECIPE_MAP = CRAFT_RECIPES.reduce((registry, recipe) => {
  registry[recipe.id] = recipe
  return registry
}, {})

export function getCraftRecipe(recipeId) {
  return CRAFT_RECIPE_MAP[recipeId] || null
}

export function isRecipeCraftableInInventory(recipe) {
  return Boolean(recipe?.craftableInInventory)
}

export function getVisibleCraftRecipes() {
  return CRAFT_RECIPES
    .filter(
      (recipe) =>
        recipe.showInPanel !== false &&
        recipe.unlocked !== false &&
        isRecipeCraftableInInventory(recipe)
    )
    .sort((left, right) => {
      const leftOrder = Number.isFinite(left?.sortIndex) ? left.sortIndex : Number.MAX_SAFE_INTEGER
      const rightOrder = Number.isFinite(right?.sortIndex) ? right.sortIndex : Number.MAX_SAFE_INTEGER
      if (leftOrder !== rightOrder) return leftOrder - rightOrder
      return String(left?.name || left?.id).localeCompare(String(right?.name || right?.id))
    })
}

export function getCraftRecipesByStation(station = null) {
  return CRAFT_RECIPES.filter((recipe) => (recipe.station || null) === (station || null))
}

export function getCraftRecipesByType(type = "crafting") {
  return CRAFT_RECIPES.filter((recipe) => recipe.type === type)
}

export function getRecipeInputs(recipe) {
  return recipe?.inputs || []
}

export function getRecipeOutputs(recipe) {
  return recipe?.outputs || []
}

export function getRecipePrimaryOutput(recipe) {
  return getRecipeOutputs(recipe)[0] || null
}

export function countItemsInSlots(slots = []) {
  return slots.reduce((counts, slot) => {
    const itemId = getCanonicalItemId(slot?.itemId) || slot?.itemId
    const quantity = Math.max(0, Number(slot?.quantity) || 0)
    if (!itemId || quantity <= 0) return counts
    counts[itemId] = (counts[itemId] || 0) + quantity
    return counts
  }, {})
}

export function getRecipeAvailability(recipe, itemCounts = {}) {
  const inputs = getRecipeInputs(recipe).map((input) => {
    const owned = Math.max(0, Number(itemCounts[input.itemId]) || 0)
    return {
      ...input,
      owned,
      missing: Math.max(0, input.quantity - owned),
      fulfilled: owned >= input.quantity,
    }
  })

  return {
    inputs,
    canCraft: inputs.every((input) => input.fulfilled),
  }
}

export function resolveCraftRecipe(craftSlots = []) {
  const counts = countItemsInSlots(craftSlots)
  const presentItemIds = Object.keys(counts).filter((itemId) => counts[itemId] > 0)

  return (
    getVisibleCraftRecipes().find((recipe) => {
      const ingredientIds = getRecipeInputs(recipe).map((input) => input.itemId)
      if (presentItemIds.some((itemId) => !ingredientIds.includes(itemId))) return false
      return getRecipeInputs(recipe).every(
        (input) => (counts[input.itemId] || 0) >= input.quantity
      )
    }) || null
  )
}
