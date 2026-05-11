import { create } from "zustand"
import {
  countItemsInSlots,
  getCraftRecipe,
  getRecipeAvailability,
  getRecipeInputs,
  getRecipeOutputs,
  getRecipePrimaryOutput,
  isRecipeCraftableInInventory,
  resolveCraftRecipe,
} from "../config/craftRecipes"
import {
  PLAYER_INVENTORY_CRAFT_SLOT_COUNT,
  PLAYER_INVENTORY_MAIN_SLOT_COUNT,
  PLAYER_INVENTORY_MAX_VISUAL_CAPACITY,
  PLAYER_INVENTORY_USABLE_SLOT_COUNT,
} from "../config/inventoryLayout"
import {
  getCanonicalItemId,
  getItemDefinition,
  isItemDiscardable,
} from "../config/itemsRegistry"
import { ENTITY_TYPES } from "../config/entityTypes"
import { QUEST_REWARD_TYPES } from "../config/questConfig"
import { useEntityStore } from "./entitySlice"
import { useWorldStore } from "./worldSlice"
import { isPointBlockedByVillage } from "../utils/worldVillage"
import {
  createTerrainSampler,
  isTerrainWalkable,
} from "../utils/worldTerrainGeneratorCore"

export const INVENTORY_MAX_VISUAL_CAPACITY = PLAYER_INVENTORY_MAX_VISUAL_CAPACITY
export const INVENTORY_STARTING_UNLOCKED_SLOTS = 12
export const INVENTORY_USABLE_SLOT_COUNT = PLAYER_INVENTORY_USABLE_SLOT_COUNT
export const INVENTORY_MAIN_SLOT_COUNT = PLAYER_INVENTORY_MAIN_SLOT_COUNT
const CRAFT_SLOT_COUNT = PLAYER_INVENTORY_CRAFT_SLOT_COUNT
const WORLD_TILE_SIZE = 16
const THROW_DROP_DISTANCE_PX = WORLD_TILE_SIZE * 5
const THROW_PICKUP_COOLDOWN_MS = 800
const THROW_DROP_POINT_RADIUS = 6
const sharedTerrainSampler = createTerrainSampler()

const STORAGE_AREA_UNLOCK_ORDER = [
  { area: "usable", count: INVENTORY_USABLE_SLOT_COUNT },
  { area: "main", count: INVENTORY_MAIN_SLOT_COUNT },
]

export function getInventoryErrorMessage(errorCode) {
  if (errorCode === "inventory_full") {
    return "Inventory full — upgrade your bag to carry more."
  }

  if (errorCode === "item_not_discardable") {
    return "This item can't be discarded."
  }

  return null
}

function clampUnlockedSlotCount(value) {
  return Math.max(
    0,
    Math.min(INVENTORY_MAX_VISUAL_CAPACITY, Math.floor(Number(value) || 0))
  )
}

function createEmptySlots(count) {
  return Array.from({ length: count }, () => null)
}

function cloneSlot(slot) {
  return slot ? { ...slot } : null
}

function cloneSlots(slots) {
  return slots.map(cloneSlot)
}

function createMutableInventoryState(state) {
  return {
    ...state,
    mainSlots: cloneSlots(state.mainSlots),
    usableSlots: cloneSlots(state.usableSlots),
    craftSlots: cloneSlots(state.craftSlots),
  }
}

function getAreaKey(area) {
  if (area === "main") return "mainSlots"
  if (area === "usable") return "usableSlots"
  if (area === "craft") return "craftSlots"
  return null
}

function isStorageArea(area) {
  return area === "main" || area === "usable"
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
  const output = getRecipePrimaryOutput(recipe)
  nextState.craftResult = output ? { ...output } : null

  return nextState
}

function getStackItemId(stack) {
  return getCanonicalItemId(stack?.itemId) || stack?.itemId || null
}

function normalizeStack(itemId, quantity = 1) {
  const canonicalItemId = getCanonicalItemId(itemId) || itemId
  const definition = getItemDefinition(canonicalItemId)
  if (!definition || quantity <= 0) return null

  return {
    itemId: canonicalItemId,
    quantity: Math.min(quantity, definition.maxStack || 1),
  }
}

function canStacksMerge(source, target) {
  if (!source || !target) return false

  const sourceItemId = getStackItemId(source)
  const targetItemId = getStackItemId(target)
  if (!sourceItemId || sourceItemId !== targetItemId) return false

  const definition = getItemDefinition(sourceItemId)
  return Boolean(definition?.stackable)
}

function mergeStacks(source, target) {
  const sourceItemId = getStackItemId(source)
  const definition = getItemDefinition(sourceItemId)
  const maxStack = definition?.maxStack || 1
  const spaceLeft = Math.max(0, maxStack - target.quantity)
  const amountToMove = Math.min(spaceLeft, source.quantity)

  return {
    source:
      source.quantity - amountToMove > 0
        ? { ...source, itemId: sourceItemId, quantity: source.quantity - amountToMove }
        : null,
    target: {
      ...target,
      itemId: sourceItemId,
      quantity: target.quantity + amountToMove,
    },
  }
}

export function getUnlockedSlotCountForArea(totalUnlockedSlots, area) {
  const remainingUnlockedSlots = clampUnlockedSlotCount(totalUnlockedSlots)
  let remaining = remainingUnlockedSlots

  for (const areaConfig of STORAGE_AREA_UNLOCK_ORDER) {
    const unlockedCount = Math.min(areaConfig.count, remaining)
    if (areaConfig.area === area) return unlockedCount
    remaining = Math.max(0, remaining - areaConfig.count)
  }

  return 0
}

export function isInventorySlotUnlocked(stateLike, area, index) {
  if (area === "craft" || area === "result") return true
  if (!isStorageArea(area)) return false

  return index >= 0 && index < getUnlockedSlotCountForArea(stateLike.unlockedSlotCount, area)
}

function getAreaUnlockedSlotCount(stateLike, area) {
  if (!isStorageArea(area)) return getSlotsByArea(stateLike, area).length
  return getUnlockedSlotCountForArea(stateLike.unlockedSlotCount, area)
}

function placeItemIntoSlots(slots, itemId, quantity, unlockedSlotCount = slots.length) {
  const canonicalItemId = getCanonicalItemId(itemId) || itemId
  const definition = getItemDefinition(canonicalItemId)
  if (!definition || quantity <= 0) {
    return { slots, remaining: quantity }
  }

  const nextSlots = cloneSlots(slots)
  const activeSlotCount = Math.max(0, Math.min(nextSlots.length, unlockedSlotCount))
  let remaining = quantity

  if (definition.stackable) {
    for (let index = 0; index < activeSlotCount && remaining > 0; index += 1) {
      const slot = nextSlots[index]
      if (!slot || getStackItemId(slot) !== canonicalItemId) continue

      const spaceLeft = Math.max(0, definition.maxStack - slot.quantity)
      if (!spaceLeft) continue

      const amount = Math.min(spaceLeft, remaining)
      nextSlots[index] = {
        ...slot,
        itemId: canonicalItemId,
        quantity: slot.quantity + amount,
      }
      remaining -= amount
    }
  }

  for (let index = 0; index < activeSlotCount && remaining > 0; index += 1) {
    if (nextSlots[index]) continue

    const amount = definition.stackable ? Math.min(definition.maxStack, remaining) : 1
    nextSlots[index] = normalizeStack(canonicalItemId, amount)
    remaining -= amount
  }

  return {
    slots: nextSlots,
    remaining,
  }
}

function addItemToStorageAreas(state, itemId, quantity, areas = ["main", "usable"]) {
  let remaining = quantity
  const nextState = createMutableInventoryState(state)

  areas.forEach((area) => {
    if (remaining <= 0) return

    const key = getAreaKey(area)
    if (!key) return

    const result = placeItemIntoSlots(
      nextState[key],
      itemId,
      remaining,
      getAreaUnlockedSlotCount(nextState, area)
    )
    nextState[key] = result.slots
    remaining = result.remaining
  })

  if (remaining > 0) {
    return {
      success: false,
      nextState: state,
      reason: "inventory_full",
    }
  }

  return {
    success: true,
    nextState: withResolvedCraftResult(nextState),
  }
}

function addRecipeOutputsToStorageAreas(state, recipeOutputs, areas = ["main", "usable"]) {
  let nextState = state

  for (const output of recipeOutputs) {
    const result = addItemToStorageAreas(nextState, output.itemId, output.quantity, areas)
    if (!result.success) {
      return {
        success: false,
        nextState: state,
        reason: result.reason || "inventory_full",
      }
    }

    nextState = result.nextState
  }

  return {
    success: true,
    nextState,
  }
}

function getFacingDirectionVector(facingDirection) {
  switch (facingDirection) {
    case "left":
      return { x: -1, y: 0 }
    case "right":
      return { x: 1, y: 0 }
    case "up":
      return { x: 0, y: -1 }
    case "down":
    default:
      return { x: 0, y: 1 }
  }
}

function getThrowDropType(itemDefinition) {
  return itemDefinition?.food?.edible ? ENTITY_TYPES.FOOD : ENTITY_TYPES.RESOURCE
}

function isDropPointBlocked(x, y) {
  const gridX = Math.floor(x / WORLD_TILE_SIZE)
  const gridY = Math.floor(y / WORLD_TILE_SIZE)
  if (!isTerrainWalkable(sharedTerrainSampler.getTerrainType(gridX, gridY))) {
    return true
  }

  if (isPointBlockedByVillage(x, y)) {
    return true
  }

  const sampleOffsets = [
    { x: 0, y: 0 },
    { x: THROW_DROP_POINT_RADIUS, y: 0 },
    { x: -THROW_DROP_POINT_RADIUS, y: 0 },
    { x: 0, y: THROW_DROP_POINT_RADIUS },
    { x: 0, y: -THROW_DROP_POINT_RADIUS },
  ]

  return sampleOffsets.some((offset) => isPointBlockedByVillage(x + offset.x, y + offset.y))
}

function buildThrowDropCandidates(playerX, playerY, facingDirection) {
  const direction = getFacingDirectionVector(facingDirection)
  const perpendicular = { x: -direction.y, y: direction.x }
  const distances = [THROW_DROP_DISTANCE_PX, WORLD_TILE_SIZE * 6, WORLD_TILE_SIZE * 7]
  const lateralOffsets = [0, WORLD_TILE_SIZE, -WORLD_TILE_SIZE, WORLD_TILE_SIZE * 2, -WORLD_TILE_SIZE * 2]
  const candidates = []

  distances.forEach((distance) => {
    lateralOffsets.forEach((lateral) => {
      const x = Math.round(playerX + direction.x * distance + perpendicular.x * lateral)
      const y = Math.round(playerY + direction.y * distance + perpendicular.y * lateral)
      candidates.push({ x, y })
    })
  })

  return candidates
}

function resolveThrowDropPosition(playerX, playerY, facingDirection) {
  const candidates = buildThrowDropCandidates(playerX, playerY, facingDirection)
  const safeCandidate = candidates.find((candidate) => !isDropPointBlocked(candidate.x, candidate.y))

  return safeCandidate || candidates[0] || { x: Math.round(playerX), y: Math.round(playerY + THROW_DROP_DISTANCE_PX) }
}

function consumeRecipeIngredients(craftSlots, recipe) {
  const nextSlots = cloneSlots(craftSlots)

  getRecipeInputs(recipe).forEach((input) => {
    const recipeItemId = getCanonicalItemId(input.itemId) || input.itemId
    let remaining = input.quantity

    for (let index = 0; index < nextSlots.length && remaining > 0; index += 1) {
      const slot = nextSlots[index]
      if (!slot || getStackItemId(slot) !== recipeItemId) continue

      if (slot.quantity > remaining) {
        nextSlots[index] = {
          ...slot,
          itemId: recipeItemId,
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

function countItemsAcrossAreas(state, areas = ["main", "usable"]) {
  return countItemsInSlots(
    areas.flatMap((area) => {
      const key = getAreaKey(area)
      return key ? state[key] || [] : []
    })
  )
}

function buildRequirementMap(inputs = []) {
  return inputs.reduce((requirements, input) => {
    const itemId = getCanonicalItemId(input?.itemId) || input?.itemId
    const quantity = Math.max(0, Number(input?.quantity) || 0)

    if (!itemId || quantity <= 0) return requirements

    requirements[itemId] = (requirements[itemId] || 0) + quantity
    return requirements
  }, {})
}

function consumeItemsFromAreas(state, inputs, areas = ["main", "usable"]) {
  const nextState = createMutableInventoryState(state)
  const remainingRequirements = buildRequirementMap(inputs)

  areas.forEach((area) => {
    const key = getAreaKey(area)
    if (!key) return

    for (let index = 0; index < nextState[key].length; index += 1) {
      const slot = nextState[key][index]
      const itemId = getStackItemId(slot)
      const remaining = itemId ? remainingRequirements[itemId] || 0 : 0

      if (!slot || !itemId || remaining <= 0) continue

      if (slot.quantity > remaining) {
        nextState[key][index] = {
          ...slot,
          itemId,
          quantity: slot.quantity - remaining,
        }
        remainingRequirements[itemId] = 0
      } else {
        remainingRequirements[itemId] = remaining - slot.quantity
        nextState[key][index] = null
      }
    }
  })

  const hasMissingItems = Object.values(remainingRequirements).some((quantity) => quantity > 0)
  if (hasMissingItems) {
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

function buildInventoryStateUpdate(stateLike, updates = {}) {
  return {
    ...stateLike,
    ...updates,
    lastInventoryError:
      updates.lastInventoryError === undefined ? stateLike.lastInventoryError : updates.lastInventoryError,
    lastInventoryErrorNonce:
      updates.lastInventoryErrorNonce === undefined
        ? stateLike.lastInventoryErrorNonce
        : updates.lastInventoryErrorNonce,
  }
}

function withInventoryErrorState(stateLike, errorCode) {
  return buildInventoryStateUpdate(stateLike, {
    lastInventoryError: errorCode,
    lastInventoryErrorNonce: (stateLike.lastInventoryErrorNonce || 0) + 1,
  })
}

function withInventorySuccessState(stateLike) {
  return buildInventoryStateUpdate(stateLike, {
    lastInventoryError: null,
  })
}

// TODO: DEBUG — set to false or delete this block before production
const ENABLE_DEBUG_STARTER_SEEDS = true
const DEV_STARTER_LOADOUT = Object.freeze([
  { itemId: "wooden_hoe", quantity: 1, areas: ["usable", "main"] },
  { itemId: "wooden_shovel", quantity: 1, areas: ["usable", "main"] },
  { itemId: "wooden_pickaxe", quantity: 1, areas: ["usable", "main"] },
  { itemId: "wooden_watering_can", quantity: 1, areas: ["usable", "main"] },
  { itemId: "carrot_seed", quantity: 1, areas: ["main", "usable"] },
])

function buildInitialState() {
  let state = withResolvedCraftResult({
    mainSlots: createEmptySlots(INVENTORY_MAIN_SLOT_COUNT),
    usableSlots: createEmptySlots(INVENTORY_USABLE_SLOT_COUNT),
    craftSlots: createEmptySlots(CRAFT_SLOT_COUNT),
    craftResult: null,
    unlockedSlotCount: INVENTORY_STARTING_UNLOCKED_SLOTS,
    lastInventoryError: null,
    lastInventoryErrorNonce: 0,
    wallet: { sol: 120 },
    activeUsableSlotIndex: null,
  })

  // TODO: DEBUG — farming test kit — remove before production
  if (import.meta.env.DEV && ENABLE_DEBUG_STARTER_SEEDS) {
    for (const { itemId, quantity, areas } of DEV_STARTER_LOADOUT) {
      const result = addItemToStorageAreas(state, itemId, quantity, areas)
      if (result.success) state = result.nextState
    }
  }

  return state
}

function increaseUnlockedSlotCountInState(stateLike, amount) {
  const safeAmount = Math.max(0, Math.floor(Number(amount) || 0))
  return {
    ...stateLike,
    unlockedSlotCount: clampUnlockedSlotCount(stateLike.unlockedSlotCount + safeAmount),
  }
}

function applyQuestRewardsToState(state, rewards = []) {
  let nextState = createMutableInventoryState(state)

  rewards.forEach((reward) => {
    if (reward?.type !== QUEST_REWARD_TYPES.INVENTORY_CAPACITY) return
    nextState = increaseUnlockedSlotCountInState(nextState, reward.amount)
  })

  for (const reward of rewards) {
    if (reward?.type !== QUEST_REWARD_TYPES.ITEM) continue

    const itemId = getCanonicalItemId(reward.value) || reward.value
    const quantity = Math.max(0, Math.floor(Number(reward.amount) || 0))
    if (!itemId || quantity <= 0) continue

    const result = addItemToStorageAreas(nextState, itemId, quantity, ["main", "usable"])
    if (!result.success) {
      return {
        success: false,
        reason: result.reason || "inventory_full",
        nextState: state,
      }
    }

    nextState = result.nextState
  }

  return {
    success: true,
    nextState: withInventorySuccessState(nextState),
  }
}

function getCraftOutputSummary(recipe) {
  return (getRecipeOutputs(recipe) || []).map((output) => ({
    itemId: output.itemId,
    quantity: Math.max(0, Number(output.quantity) || 0),
  }))
}

export const useInventoryStore = create((set, get) => ({
  ...buildInitialState(),

  setActiveUsableSlotIndex: (index = null) => {
    const safeIndex = Number.isInteger(index) && index >= 0 && index < INVENTORY_USABLE_SLOT_COUNT
      ? index
      : null
    set({ activeUsableSlotIndex: safeIndex })
  },

  addItem: (itemId, quantity = 1, areas = ["main", "usable"]) => {
    const result = addItemToStorageAreas(get(), itemId, quantity, areas)

    if (!result.success) {
      set((state) => withInventoryErrorState(state, result.reason || "inventory_full"))
      return false
    }

    set((state) =>
      withInventorySuccessState({
        ...result.nextState,
        lastInventoryErrorNonce: state.lastInventoryErrorNonce,
      })
    )
    return true
  },

  moveItem: (source, target) => {
    if (!source || !target) return false
    if (target.area === "result" || source.area === "result") return false
    if (source.area === target.area && source.index === target.index) return false

    const state = get()
    if (!isInventorySlotUnlocked(state, source.area, source.index)) return false
    if (!isInventorySlotUnlocked(state, target.area, target.index)) return false

    const sourceSlots = cloneSlots(getSlotsByArea(state, source.area))
    const targetSlots =
      source.area === target.area ? sourceSlots : cloneSlots(getSlotsByArea(state, target.area))

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
      mainSlots:
        source.area === "main" || target.area === "main"
          ? cloneSlots(state.mainSlots)
          : state.mainSlots,
      usableSlots:
        source.area === "usable" || target.area === "usable"
          ? cloneSlots(state.usableSlots)
          : state.usableSlots,
      craftSlots:
        source.area === "craft" || target.area === "craft"
          ? cloneSlots(state.craftSlots)
          : state.craftSlots,
    }

    setSlotsByArea(nextState, source.area, sourceSlots)
    setSlotsByArea(nextState, target.area, targetSlots)

    set((currentState) =>
      withInventorySuccessState({
        ...withResolvedCraftResult(nextState),
        lastInventoryErrorNonce: currentState.lastInventoryErrorNonce,
      })
    )
    return true
  },

  clearCraftGrid: () => {
    set((state) =>
      withInventorySuccessState({
        ...withResolvedCraftResult({
          ...state,
          craftSlots: createEmptySlots(CRAFT_SLOT_COUNT),
        }),
        lastInventoryErrorNonce: state.lastInventoryErrorNonce,
      })
    )
  },

  craftCurrentRecipe: () => {
    const state = get()
    const recipe = resolveCraftRecipe(state.craftSlots)
    if (!recipe) return { success: false, reason: "missing_recipe" }

    const consumedState = {
      ...state,
      craftSlots: consumeRecipeIngredients(state.craftSlots, recipe),
    }

    const addResult = addRecipeOutputsToStorageAreas(
      consumedState,
      getRecipeOutputs(recipe),
      ["main", "usable"]
    )

    if (!addResult.success) {
      set((currentState) =>
        withInventoryErrorState(currentState, addResult.reason || "inventory_full")
      )
      return { success: false, reason: addResult.reason || "inventory_full" }
    }

    set((currentState) =>
      withInventorySuccessState({
        ...addResult.nextState,
        lastInventoryErrorNonce: currentState.lastInventoryErrorNonce,
      })
    )

    return {
      success: true,
      recipeId: recipe.id,
      outputs: getCraftOutputSummary(recipe),
    }
  },

  craftRecipeById: (recipeId) => {
    const state = get()
    const recipe = getCraftRecipe(recipeId)
    if (!recipe || recipe.unlocked === false || !isRecipeCraftableInInventory(recipe)) {
      return { success: false, reason: "missing_recipe" }
    }

    const availability = getRecipeAvailability(
      recipe,
      countItemsAcrossAreas(state, ["main", "usable"])
    )
    if (!availability.canCraft) {
      return { success: false, reason: "missing_ingredients" }
    }

    const consumeResult = consumeItemsFromAreas(state, getRecipeInputs(recipe), ["main", "usable"])
    if (!consumeResult.success) {
      return { success: false, reason: "missing_ingredients" }
    }

    const addResult = addRecipeOutputsToStorageAreas(
      consumeResult.nextState,
      getRecipeOutputs(recipe),
      ["main", "usable"]
    )

    if (!addResult.success) {
      set((currentState) =>
        withInventoryErrorState(currentState, addResult.reason || "inventory_full")
      )
      return { success: false, reason: addResult.reason || "inventory_full" }
    }

    set((currentState) =>
      withInventorySuccessState({
        ...addResult.nextState,
        lastInventoryErrorNonce: currentState.lastInventoryErrorNonce,
      })
    )

    return {
      success: true,
      recipeId: recipe.id,
      outputs: getCraftOutputSummary(recipe),
    }
  },

  throwItemFromSlot: (area, index, quantity = 1) => {
    const state = get()
    const key = getAreaKey(area)
    if (!key || !isStorageArea(area) || !isInventorySlotUnlocked(state, area, index)) {
      return { success: false, reason: "invalid_slot" }
    }

    const slots = cloneSlots(state[key])
    const slot = slots[index]
    const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0))
    if (!slot?.itemId || safeQuantity !== 1) {
      return { success: false, reason: "invalid_quantity" }
    }

    const itemId = getStackItemId(slot)
    const itemDefinition = getItemDefinition(itemId)
    if (!itemId || !itemDefinition || !isItemDiscardable(itemId)) {
      return { success: false, reason: "item_not_discardable" }
    }

    const { worldOffset, facingDirection } = useWorldStore.getState()
    const playerX = -(worldOffset?.x || 0)
    const playerY = -(worldOffset?.y || 0)
    const spawnPosition = resolveThrowDropPosition(playerX, playerY, facingDirection || "down")
    if (!spawnPosition) {
      return { success: false, reason: "drop_spawn_failed" }
    }

    const now = Date.now()
    const droppedEntity = useEntityStore.getState().spawnDroppedItem(
      spawnPosition.x,
      spawnPosition.y,
      getThrowDropType(itemDefinition),
      {
        itemKey: itemId,
        reward: "inventory_item",
        rewardAmount: 1,
        source: "throw",
        droppedAt: now,
        pickupDisabledUntil: now + THROW_PICKUP_COOLDOWN_MS,
      }
    )

    if (!droppedEntity?.id) {
      return { success: false, reason: "drop_spawn_failed" }
    }

    if (slot.quantity > safeQuantity) {
      slots[index] = {
        ...slot,
        itemId,
        quantity: slot.quantity - safeQuantity,
      }
    } else {
      slots[index] = null
    }

    set((currentState) =>
      withInventorySuccessState({
        ...withResolvedCraftResult({
          ...state,
          [key]: slots,
        }),
        lastInventoryErrorNonce: currentState.lastInventoryErrorNonce,
      })
    )

    return {
      success: true,
      itemId,
      quantity: safeQuantity,
      entityId: droppedEntity.id,
      x: spawnPosition.x,
      y: spawnPosition.y,
    }
  },

  consumeSlotItem: (area, index, quantity = 1) => {
    const state = get()
    const key = getAreaKey(area)
    if (!key || !isInventorySlotUnlocked(state, area, index)) return false

    const slots = cloneSlots(state[key])
    const slot = slots[index]
    if (!slot?.itemId || quantity <= 0) return false

    if (slot.quantity > quantity) {
      slots[index] = {
        ...slot,
        itemId: getStackItemId(slot),
        quantity: slot.quantity - quantity,
      }
    } else {
      slots[index] = null
    }

    set((currentState) =>
      withInventorySuccessState({
        ...withResolvedCraftResult({
          ...state,
          [key]: slots,
        }),
        lastInventoryErrorNonce: currentState.lastInventoryErrorNonce,
      })
    )
    return true
  },

  discardItem: (area, index, quantity = 1) => {
    const state = get()
    const key = getAreaKey(area)
    if (!key || !isStorageArea(area) || !isInventorySlotUnlocked(state, area, index)) {
      return { success: false, reason: "invalid_slot" }
    }

    const slots = cloneSlots(state[key])
    const slot = slots[index]
    const itemId = getStackItemId(slot)
    const safeQuantity = Math.max(0, Math.floor(Number(quantity) || 0))

    if (!itemId || safeQuantity <= 0) {
      return { success: false, reason: "missing_item" }
    }

    if (!isItemDiscardable(itemId)) {
      set((currentState) => withInventoryErrorState(currentState, "item_not_discardable"))
      return { success: false, reason: "item_not_discardable" }
    }

    const discardedQuantity = Math.min(slot.quantity, safeQuantity)

    if (slot.quantity > discardedQuantity) {
      slots[index] = {
        ...slot,
        itemId,
        quantity: slot.quantity - discardedQuantity,
      }
    } else {
      slots[index] = null
    }

    set((currentState) =>
      withInventorySuccessState({
        ...withResolvedCraftResult({
          ...state,
          [key]: slots,
        }),
        lastInventoryErrorNonce: currentState.lastInventoryErrorNonce,
      })
    )

    return {
      success: true,
      itemId,
      quantity: discardedQuantity,
    }
  },

  increaseUnlockedSlotCount: (amount = 0) => {
    const safeAmount = Math.max(0, Math.floor(Number(amount) || 0))
    if (safeAmount <= 0) return false

    set((state) =>
      withInventorySuccessState({
        ...increaseUnlockedSlotCountInState(state, safeAmount),
        lastInventoryErrorNonce: state.lastInventoryErrorNonce,
      })
    )
    return true
  },

  applyQuestRewards: (rewards = []) => {
    const result = applyQuestRewardsToState(get(), rewards)
    if (!result.success) {
      set((state) => withInventoryErrorState(state, result.reason || "inventory_full"))
      return { success: false, reason: result.reason || "inventory_full" }
    }

    set((state) => ({
      ...result.nextState,
      lastInventoryErrorNonce: state.lastInventoryErrorNonce,
    }))
    return { success: true }
  },

  clearLastInventoryError: () => {
    set({ lastInventoryError: null })
  },

  // ── Wallet ──────────────────────────────────────────────────────────────────

  addCurrency: (currencyId, amount) => {
    const safeAmount = Math.max(0, Math.floor(Number(amount) || 0))
    if (safeAmount <= 0) return
    set((state) => ({
      wallet: { ...state.wallet, [currencyId]: (state.wallet[currencyId] || 0) + safeAmount },
    }))
  },

  removeCurrency: (currencyId, amount) => {
    const safeAmount = Math.max(0, Math.floor(Number(amount) || 0))
    if (safeAmount <= 0) return { success: true }
    const state = get()
    if ((state.wallet[currencyId] || 0) < safeAmount) return { success: false, reason: "insufficient_funds" }
    set((s) => ({
      wallet: { ...s.wallet, [currencyId]: (s.wallet[currencyId] || 0) - safeAmount },
    }))
    return { success: true }
  },

  countItemsOwned: (itemId) => {
    const state = get()
    const canonical = getCanonicalItemId(itemId) || itemId
    const counts = countItemsAcrossAreas(state, ["main", "usable"])
    return counts[canonical] || 0
  },

  removeItem: (itemId, qty = 1) => {
    const state = get()
    const result = consumeItemsFromAreas(
      state,
      [{ itemId, quantity: qty }],
      ["main", "usable"]
    )
    if (!result.success) return { success: false, reason: "item_not_owned" }
    set((currentState) =>
      withInventorySuccessState({
        ...result.nextState,
        lastInventoryErrorNonce: currentState.lastInventoryErrorNonce,
      })
    )
    return { success: true }
  },

  canAffordPrice: (price) => {
    const state = get()
    if (price?.currency) {
      for (const [currencyId, amount] of Object.entries(price.currency)) {
        if ((state.wallet[currencyId] || 0) < amount) return false
      }
    }
    if (price?.items?.length > 0) {
      const counts = countItemsAcrossAreas(state, ["main", "usable"])
      for (const { itemId, qty } of price.items) {
        const canonical = getCanonicalItemId(itemId) || itemId
        if ((counts[canonical] || 0) < qty) return false
      }
    }
    return true
  },

  payPrice: (price) => {
    const state = get()
    // Validate currency
    if (price?.currency) {
      for (const [currencyId, amount] of Object.entries(price.currency)) {
        const safeAmount = Math.max(0, Math.floor(Number(amount) || 0))
        if ((state.wallet[currencyId] || 0) < safeAmount) return { success: false, reason: "insufficient_funds" }
      }
    }
    // Validate barter items
    if (price?.items?.length > 0) {
      const counts = countItemsAcrossAreas(state, ["main", "usable"])
      for (const { itemId, qty } of price.items) {
        const canonical = getCanonicalItemId(itemId) || itemId
        if ((counts[canonical] || 0) < qty) return { success: false, reason: "missing_barter_items" }
      }
    }
    // Deduct currency
    if (price?.currency) {
      const newWallet = { ...state.wallet }
      for (const [currencyId, amount] of Object.entries(price.currency)) {
        newWallet[currencyId] = (newWallet[currencyId] || 0) - Math.floor(Number(amount) || 0)
      }
      set({ wallet: newWallet })
    }
    // Consume barter items
    if (price?.items?.length > 0) {
      const currentState = get()
      const consumeResult = consumeItemsFromAreas(
        currentState,
        price.items.map(({ itemId, qty }) => ({ itemId, quantity: qty })),
        ["main", "usable"]
      )
      if (!consumeResult.success) return { success: false, reason: "consume_failed" }
      set((currentState) =>
        withInventorySuccessState({
          ...consumeResult.nextState,
          lastInventoryErrorNonce: currentState.lastInventoryErrorNonce,
        })
      )
    }
    return { success: true }
  },

  grantPrice: (price) => {
    if (price?.currency) {
      const state = get()
      const newWallet = { ...state.wallet }
      for (const [currencyId, amount] of Object.entries(price.currency)) {
        const safeAmount = Math.max(0, Math.floor(Number(amount) || 0))
        newWallet[currencyId] = (newWallet[currencyId] || 0) + safeAmount
      }
      set({ wallet: newWallet })
    }
    if (price?.items?.length > 0) {
      price.items.forEach(({ itemId, qty }) => {
        addItemToStorageAreas(get(), itemId, qty ?? 1, ["main", "usable"])
      })
    }
  },

  resetInventory: () => {
    set(buildInitialState())
  },
}))
