export const CRAFT_RECIPES = [
  {
    id: "axe",
    output: { itemId: "axe", quantity: 1 },
    ingredients: {
      wood: 1,
      metal: 1,
    },
  },
  {
    id: "cake",
    output: { itemId: "cake", quantity: 1 },
    ingredients: {
      fruits: 2,
    },
  },
  {
    id: "care_kit",
    output: { itemId: "care_kit", quantity: 1 },
    ingredients: {
      wood: 1,
      fruits: 1,
    },
  },
]

export function countItemsInSlots(slots = []) {
  return slots.reduce((counts, slot) => {
    if (!slot?.itemId || !slot.quantity) return counts

    counts[slot.itemId] = (counts[slot.itemId] || 0) + slot.quantity
    return counts
  }, {})
}

export function resolveCraftRecipe(craftSlots = []) {
  const counts = countItemsInSlots(craftSlots)
  const presentItemIds = Object.keys(counts).filter((itemId) => counts[itemId] > 0)

  return (
    CRAFT_RECIPES.find((recipe) => {
      const ingredientIds = Object.keys(recipe.ingredients)

      if (presentItemIds.some((itemId) => !ingredientIds.includes(itemId))) {
        return false
      }

      return ingredientIds.every(
        (itemId) => (counts[itemId] || 0) >= recipe.ingredients[itemId]
      )
    }) || null
  )
}
