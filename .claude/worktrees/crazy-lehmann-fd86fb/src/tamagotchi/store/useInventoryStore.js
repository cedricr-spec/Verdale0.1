import { create } from "zustand"
import { resolveCraftRecipe } from "../config/craftRecipes"
import { getItemDefinition } from "../config/itemsRegistry"

const MAIN_SLOT_COUNT = 10
const USABLE_SLOT_COUNT = 5
const CRAFT_SLOT_COUNT = 4

function createEmptySlots(count) {
  return Array.from({ length: count }, () => null)
}

function cloneSlot(slot) {
  return slot ? { ...slot } : null
}

function cloneSlots(slots) {
  return slots.map(cloneSlot)
}

function getAreaKey(area) {
  if (area === "main") return "mainSlots"
  if (area === "usable") return "usableSlots"
  if (area === "craft") return "craftSlots"
  return null
}

function getSlotsByArea(state, area) {
  return state[getAreaKey(area)] || []
}

function setSlotsByArea(nextState, area, slots) {
  const key = getAreaKey(area)
  if (key) {
    nextState[key] = slots
  }
}

function withResolvedCraftResult(nextState) {
  const recipe = resolveCraftRecipe(nextState.craftSlots)
  nextState.craftResult = recipe ? { ...recipe.output } : null

  return nextState
}

function normalizeStack(itemId, quantity = 1) {
  const definition = getItemDefinition(itemId)
  if (!definition || quantity <= 0) return null

  return {
    itemId,
    quantity: Math.min(quantity, definition.maxStack || 1),
  }
}

function canStacksMerge(source, target) {
  if (!source || !target) return false
  if (source.itemId !== target.itemId) return false

  const definition = getItemDefinition(source.itemId)
  return Boolean(definition?.stackable)
}

function mergeStacks(source, target) {
  const definition = getItemDefinition(source.itemId)
  const maxStack = definition?.maxStack || 1
  const spaceLeft = Math.max(0, maxStack - target.quantity)
  const amountToMove = Math.min(spaceLeft, source.quantity)

  return {
    source:
      source.quantity - amountToMove > 0
        ? { ...source, quantity: source.quantity - amountToMove }
        : null,
    target: {
      ...target,
      quantity: target.quantity + amountToMove,
    },
  }
}

function placeItemIntoSlots(slots, itemId, quantity) {
  const definition = getItemDefinition(itemId)
  if (!definition || quantity <= 0) {
    return { slots, remaining: quantity }
  }

  const nextSlots = cloneSlots(slots)
  let remaining = quantity

  if (definition.stackable) {
    for (let index = 0; index < nextSlots.length && remaining > 0; index += 1) {
      const slot = nextSlots[index]
      if (!slot || slot.itemId !== itemId) continue

      const spaceLeft = Math.max(0, definition.maxStack - slot.quantity)
      if (!spaceLeft) continue

      const amount = Math.min(spaceLeft, remaining)
      nextSlots[index] = {
        ...slot,
        quantity: slot.quantity + amount,
      }
      remaining -= amount
    }
  }

  for (let index = 0; index < nextSlots.length && remaining > 0; index += 1) {
    if (nextSlots[index]) continue

    const amount = definition.stackable
      ? Math.min(definition.maxStack, remaining)
      : 1

    nextSlots[index] = normalizeStack(itemId, amount)
    remaining -= amount
  }

  return {
    slots: nextSlots,
    remaining,
  }
}

function addItemToStorageAreas(state, itemId, quantity, areas = ["main", "usable"]) {
  let remaining = quantity
  const nextState = {
    ...state,
    mainSlots: cloneSlots(state.mainSlots),
    usableSlots: cloneSlots(state.usableSlots),
    craftSlots: cloneSlots(state.craftSlots),
  }

  areas.forEach((area) => {
    if (remaining <= 0) return

    const key = getAreaKey(area)
    const result = placeItemIntoSlots(nextState[key], itemId, remaining)
    nextState[key] = result.slots
    remaining = result.remaining
  })

  if (remaining > 0) {
    return {
      success: false,
      nextState: state,
    }
  }

  return {
    success: true,
    nextState: withResolvedCraftResult(nextState),
  }
}

function consumeRecipeIngredients(craftSlots, recipe) {
  const nextSlots = cloneSlots(craftSlots)

  Object.entries(recipe.ingredients).forEach(([itemId, amount]) => {
    let remaining = amount

    for (let index = 0; index < nextSlots.length && remaining > 0; index += 1) {
      const slot = nextSlots[index]
      if (!slot || slot.itemId !== itemId) continue

      if (slot.quantity > remaining) {
        nextSlots[index] = {
          ...slot,
          quantity: slot.quantity - remaining,
        }
        remaining = 0
      } else {
        remaining -= slot.quantity
        nextSlots[index] = null
      }
    }
  })

  return nextSlots
}

function buildInitialState() {
  return withResolvedCraftResult({
    mainSlots: createEmptySlots(MAIN_SLOT_COUNT),
    usableSlots: createEmptySlots(USABLE_SLOT_COUNT),
    craftSlots: createEmptySlots(CRAFT_SLOT_COUNT),
    craftResult: null,
    lastInventoryError: null,
  })
}

export const useInventoryStore = create((set, get) => ({
  ...buildInitialState(),

  addItem: (itemId, quantity = 1, areas = ["main", "usable"]) => {
    const result = addItemToStorageAreas(get(), itemId, quantity, areas)

    if (!result.success) {
      set({ lastInventoryError: "inventory_full" })
      return false
    }

    set({
      ...result.nextState,
      lastInventoryError: null,
    })
    return true
  },

  moveItem: (source, target) => {
    if (!source || !target) return false
    if (target.area === "result" || source.area === "result") return false
    if (source.area === target.area && source.index === target.index) return false

    const state = get()
    const sourceSlots = cloneSlots(getSlotsByArea(state, source.area))
    const targetSlots =
      source.area === target.area
        ? sourceSlots
        : cloneSlots(getSlotsByArea(state, target.area))

    const sourceStack = cloneSlot(sourceSlots[source.index])
    const targetStack = cloneSlot(targetSlots[target.index])

    if (!sourceStack) return false

    if (targetStack && canStacksMerge(sourceStack, targetStack)) {
      const merged = mergeStacks(sourceStack, targetStack)
      sourceSlots[source.index] = merged.source
      targetSlots[target.index] = merged.target
    } else {
      sourceSlots[source.index] = targetStack
      targetSlots[target.index] = sourceStack
    }

    const nextState = {
      ...state,
      mainSlots: source.area === "main" || target.area === "main"
        ? cloneSlots(state.mainSlots)
        : state.mainSlots,
      usableSlots: source.area === "usable" || target.area === "usable"
        ? cloneSlots(state.usableSlots)
        : state.usableSlots,
      craftSlots: source.area === "craft" || target.area === "craft"
        ? cloneSlots(state.craftSlots)
        : state.craftSlots,
      lastInventoryError: null,
    }

    setSlotsByArea(nextState, source.area, sourceSlots)
    setSlotsByArea(nextState, target.area, targetSlots)

    set(withResolvedCraftResult(nextState))
    return true
  },

  clearCraftGrid: () => {
    set((state) =>
      withResolvedCraftResult({
        ...state,
        craftSlots: createEmptySlots(CRAFT_SLOT_COUNT),
        lastInventoryError: null,
      })
    )
  },

  craftCurrentRecipe: () => {
    const state = get()
    const recipe = resolveCraftRecipe(state.craftSlots)
    if (!recipe) return false

    const addResult = addItemToStorageAreas(
      {
        ...state,
        craftSlots: consumeRecipeIngredients(state.craftSlots, recipe),
      },
      recipe.output.itemId,
      recipe.output.quantity,
      ["main", "usable"]
    )

    if (!addResult.success) {
      set({ lastInventoryError: "inventory_full" })
      return false
    }

    set({
      ...addResult.nextState,
      lastInventoryError: null,
    })
    return true
  },

  consumeSlotItem: (area, index, quantity = 1) => {
    const state = get()
    const key = getAreaKey(area)
    if (!key) return false

    const slots = cloneSlots(state[key])
    const slot = slots[index]
    if (!slot?.itemId || quantity <= 0) return false

    if (slot.quantity > quantity) {
      slots[index] = {
        ...slot,
        quantity: slot.quantity - quantity,
      }
    } else {
      slots[index] = null
    }

    set(
      withResolvedCraftResult({
        ...state,
        [key]: slots,
        lastInventoryError: null,
      })
    )
    return true
  },

  resetInventory: () => {
    set(buildInitialState())
  },
}))
