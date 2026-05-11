import { useEffect } from "react"
import { useWorldStore } from "../store/worldSlice"
import { useInventoryStore } from "../store/useInventoryStore"
import { useBrokenObjectsStore } from "../store/brokenObjectsStore"
import { useQuestStore } from "../store/useQuestStore"
import { useFarmingStore } from "../store/useFarmingStore"
import {
  getCanonicalItemId,
  getItemDefinition,
  getItemToolProfile,
} from "../config/itemsRegistry"
import {
  SEED_TO_CROP,
  CROP_TO_FOOD,
  CROP_TO_SEED,
  SEED_ITEM_IDS,
  MAX_GROWTH_STAGE,
} from "../utils/farmingAtlasData"
import {
  TERRAIN_TYPES,
  createTerrainSampler,
} from "../utils/worldTerrainGeneratorCore"
import {
  WORLD_ATLAS_TILE_SIZE,
  WORLD_ATLAS_COLLISION_VIEWPORT,
  getWorldAtlasLayout,
} from "../utils/worldAtlasFamilies"
import { getWorldThemeConfig } from "../config/worldThemeConfig"

const SLOT_KEYS = ["a", "z", "e", "r", "t"]
const DEFAULT_HARVEST_FOOD_MIN = 1
const DEFAULT_HARVEST_FOOD_MAX = 4
// TODO: move harvest yield weights to crop config later.
const HARVEST_FOOD_YIELD_WEIGHTS = [
  { value: 1, weight: 10 },
  { value: 2, weight: 40 },
  { value: 3, weight: 35 },
  { value: 4, weight: 15 },
]
const HARVEST_SEED_YIELD_WEIGHTS = [
  { value: 1, weight: 60 },
  { value: 2, weight: 30 },
  { value: 3, weight: 10 },
]

// Interaction reach: 2 tiles radius
const FARM_INTERACTION_RADIUS = WORLD_ATLAS_TILE_SIZE * 2

// Growth tick interval in milliseconds (15s per stage = ~75s full growth)
const GROWTH_TICK_MS = 15_000

// Lazy singleton terrain sampler — deterministic, cheap after first construction
let _terrainSampler = null
function getTerrainSampler() {
  if (!_terrainSampler) _terrainSampler = createTerrainSampler()
  return _terrainSampler
}

function tileKey(tileX, tileY) {
  return `${tileX}_${tileY}`
}

function worldToTile(worldCoord) {
  return Math.floor(worldCoord / WORLD_ATLAS_TILE_SIZE)
}

function tileCenterWorld(tileX, tileY) {
  return {
    x: tileX * WORLD_ATLAS_TILE_SIZE + WORLD_ATLAS_TILE_SIZE / 2,
    y: tileY * WORLD_ATLAS_TILE_SIZE + WORLD_ATLAS_TILE_SIZE / 2,
  }
}

function buildHarvestableCropTarget(key, tile, px = null, py = null) {
  if (!tile?.seeded || !tile.cropId || tile.isDead || tile.growthStage < MAX_GROWTH_STAGE) {
    return null
  }

  const [tileX, tileY] = key.split("_").map(Number)
  const center = tileCenterWorld(tileX, tileY)
  const target = {
    key,
    tile,
    tileX,
    tileY,
  }

  if (Number.isFinite(px) && Number.isFinite(py)) {
    target.dist = Math.hypot(center.x - px, center.y - py)
  }

  return target
}

function randomInt(min, max) {
  const safeMin = Math.ceil(Math.min(min, max))
  const safeMax = Math.floor(Math.max(min, max))
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin
}

function weightedRandom(entries) {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 0), 0)
  if (totalWeight <= 0) return entries[0]?.value ?? null

  let roll = Math.random() * totalWeight
  for (const entry of entries) {
    roll -= Math.max(0, Number(entry.weight) || 0)
    if (roll <= 0) return entry.value
  }

  return entries[entries.length - 1]?.value ?? null
}

// A tile is tillable only if all 9 cells in the 3×3 neighbourhood share the
// EXACT same terrain type (all GRASS_LIGHT or all GRASS_DARK).
// This rejects:
//   • tiles adjacent to water, sand, road (non-grass neighbours)
//   • the visual transition/border zone where GRASS_LIGHT meets GRASS_DARK
function canTill(tileX, tileY) {
  const sampler = getTerrainSampler()
  const centerType = sampler.getTerrainType(tileX, tileY)
  if (centerType !== TERRAIN_TYPES.GRASS_LIGHT && centerType !== TERRAIN_TYPES.GRASS_DARK) {
    return false
  }
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      if (sampler.getTerrainType(tileX + dx, tileY + dy) !== centerType) return false
    }
  }
  return true
}

// Find the nearest farm tile matching a predicate within radius of (px, py)
function findNearestFarmTile(farmTiles, px, py, predicate) {
  let best = null
  let bestDist = Infinity

  for (const [key, tile] of Object.entries(farmTiles)) {
    if (!predicate(tile)) continue
    const [tx, ty] = key.split("_").map(Number)
    const center = tileCenterWorld(tx, ty)
    const dist = Math.hypot(center.x - px, center.y - py)
    if (dist <= FARM_INTERACTION_RADIUS && dist < bestDist) {
      best = { key, tile, tileX: tx, tileY: ty, dist }
      bestDist = dist
    }
  }

  return best
}

export function findNearestHarvestableCrop(px, py, maxDistance = FARM_INTERACTION_RADIUS) {
  return findHarvestableCropsNearWorldPosition(px, py, maxDistance)[0] || null
}

export function findHarvestableCropsNearWorldPosition(
  px,
  py,
  maxDistance = FARM_INTERACTION_RADIUS
) {
  const farmTiles = useFarmingStore.getState().farmTiles
  const matches = []

  for (const [key, tile] of Object.entries(farmTiles)) {
    const target = buildHarvestableCropTarget(key, tile, px, py)
    if (!target || target.dist > maxDistance) continue
    matches.push(target)
  }

  matches.sort((left, right) => left.dist - right.dist)
  return matches
}

export function getHarvestableCropByKey(tileKey) {
  if (!tileKey) return null

  const tile = useFarmingStore.getState().farmTiles?.[tileKey]
  return buildHarvestableCropTarget(tileKey, tile)
}

export function harvestCropTile(tileKey) {
  const farmStore = useFarmingStore.getState()
  const harvestedCropId = farmStore.harvestCrop(tileKey)
  if (!harvestedCropId) return null

  const foodItemId = CROP_TO_FOOD[harvestedCropId]
  const seedItemIdBack = CROP_TO_SEED[harvestedCropId]
  const inventoryStore = useInventoryStore.getState()
  const foodAmount = foodItemId
    ? weightedRandom(HARVEST_FOOD_YIELD_WEIGHTS) ??
      randomInt(DEFAULT_HARVEST_FOOD_MIN, DEFAULT_HARVEST_FOOD_MAX)
    : 0
  const seedAmount = seedItemIdBack ? weightedRandom(HARVEST_SEED_YIELD_WEIGHTS) ?? 1 : 0

  if (foodItemId && foodAmount > 0) inventoryStore.addItem(foodItemId, foodAmount)
  if (seedItemIdBack && seedAmount > 0) inventoryStore.addItem(seedItemIdBack, seedAmount)

  useQuestStore.getState().recordHarvestedCrop(harvestedCropId)

  return {
    cropId: harvestedCropId,
    foodItemId,
    foodAmount,
    seedItemId: seedItemIdBack,
    seedAmount,
  }
}

export function harvestReadyCropNearWorldPosition(px, py, maxDistance = FARM_INTERACTION_RADIUS) {
  const target = findNearestHarvestableCrop(px, py, maxDistance)
  if (!target) return null

  const result = harvestCropTile(target.key)
  if (!result) return null

  return {
    ...result,
    target,
  }
}

// Eject feedback through the existing world feedback channel
function showFeedback(message) {
  useBrokenObjectsStore.getState().showWorldFeedback(message)
}

function dispatchEquipmentAction(type, itemId) {
  if (typeof window === "undefined" || !type) return

  window.dispatchEvent(
    new CustomEvent("phaser-equipment-action", {
      detail: {
        type,
        itemId,
      },
    })
  )
}

// When a tile is tilled, hide any small non-interactable decor (flowers, weeds, pebbles)
// that sits on that exact tile. Rocks and other interactables are left untouched.
function clearDecorAtTile(petX, petY, tileX, tileY) {
  const { currentWorldTheme } = useWorldStore.getState()
  const theme = getWorldThemeConfig(currentWorldTheme)
  const layout = getWorldAtlasLayout(petX, petY, theme.atlasData, WORLD_ATLAS_COLLISION_VIEWPORT)
  const brokenStore = useBrokenObjectsStore.getState()

  for (const chunk of layout.tileChunks || []) {
    for (const item of [...(chunk.tileBackItems || []), ...(chunk.tileFrontItems || [])]) {
      if (item.gridX !== tileX || item.gridY !== tileY) continue
      if (!item.id) continue
      if (item.id.startsWith("terrain_")) continue // never remove base terrain tiles
      if (item.entry?.interaction != null) continue // leave interactables (rocks, etc.) alone
      brokenStore.breakObject(item.id)
    }
  }
}

function handleHoe(petX, petY, toolItemId = "wooden_hoe") {
  const tileX = worldToTile(petX)
  const tileY = worldToTile(petY)
  const key = tileKey(tileX, tileY)

  if (!canTill(tileX, tileY)) {
    showFeedback("Can't till here")
    return
  }

  const farmStore = useFarmingStore.getState()
  if (farmStore.getTile(key)?.tilled) {
    showFeedback("Already tilled")
    return
  }

  farmStore.tillTile(key)
  clearDecorAtTile(petX, petY, tileX, tileY)
  dispatchEquipmentAction("till", toolItemId)
  showFeedback("Tilled!")

  useQuestStore.getState().recordWorldInteraction({
    type: "world_interaction",
    sourceFamily: "farming",
    itemId: toolItemId,
  })
}

function handleShovel(petX, petY, toolItemId = "wooden_shovel") {
  const farmStore = useFarmingStore.getState()
  const target = findNearestFarmTile(
    farmStore.farmTiles,
    petX,
    petY,
    (t) => t.tilled && !t.holed && !t.seeded
  )

  if (!target) {
    showFeedback("Needs tilled soil")
    return
  }

  farmStore.digHole(target.key)
  dispatchEquipmentAction("dig", toolItemId)
  showFeedback("Dug hole!")
}

function handleWateringCan(petX, petY, toolItemId = "wooden_watering_can") {
  const farmStore = useFarmingStore.getState()
  const target = findNearestFarmTile(
    farmStore.farmTiles,
    petX,
    petY,
    (t) => t.tilled && !t.watered
  )

  if (!target) {
    showFeedback("No soil to water")
    return
  }

  const waterResult = farmStore.waterTile(target.key)
  dispatchEquipmentAction("water", toolItemId)
  if (target.tile?.isDead && target.tile?.cropId) {
    if (waterResult?.revived) {
      showFeedback(`Revived ${target.tile.cropId}!`)
    } else {
      showFeedback(`Reviving ${target.tile.cropId} (${waterResult?.waterCount || 1}/2)`)
    }
  } else {
    showFeedback("Watered!")
  }

  if (target.tile.seeded && target.tile.cropId) {
    useQuestStore.getState().recordWateredCrop(target.tile.cropId)
  }
}

function handleSeed(slotArea, slotIndex, seedItemId, petX, petY) {
  const cropId = SEED_TO_CROP[seedItemId]
  if (!cropId) return

  // First check: can we harvest a ready crop of this type nearby?
  const readyCrop = findNearestHarvestableCrop(petX, petY)

  if (readyCrop?.tile?.cropId === cropId) {
    const result = harvestCropTile(readyCrop.key)
    if (!result) return
    const foodLabel = getItemDefinition(result.foodItemId)?.name || result.cropId
    const seedLabel = getItemDefinition(result.seedItemId)?.name || `${result.cropId} seed`
    showFeedback(`+${result.foodAmount || 0} ${foodLabel} • +${result.seedAmount || 0} ${seedLabel}`)
    return
  }

  // Otherwise: plant the seed
  const farmStore = useFarmingStore.getState()
  const target = findNearestFarmTile(
    farmStore.farmTiles,
    petX,
    petY,
    (t) => t.tilled && t.holed && !t.seeded
  )

  if (!target) {
    showFeedback("Needs dug hole")
    return
  }

  const inventoryStore = useInventoryStore.getState()
  const consumed = inventoryStore.consumeSlotItem(slotArea, slotIndex)
  if (!consumed) {
    showFeedback("No seeds left")
    return
  }

  farmStore.plantSeed(target.key, cropId)
  useQuestStore.getState().recordPlantedCrop(cropId)
  showFeedback(`Planted ${cropId}!`)
}

export function startFarmingInteractionSystem() {
  function handleKeyDown(event) {
    if (event.repeat) return

    const key = event.key.toLowerCase()
    const slotIndex = SLOT_KEYS.indexOf(key)
    if (slotIndex === -1) return

    const inventoryState = useInventoryStore.getState()
    const slot = inventoryState.usableSlots[slotIndex]
    if (!slot?.itemId) return

    const definition = getItemDefinition(slot.itemId)
    if (!definition?.equipable) return

    const { worldOffset } = useWorldStore.getState()
    const petX = -(worldOffset?.x || 0)
    const petY = -(worldOffset?.y || 0)

    const itemId = getCanonicalItemId(slot.itemId) || slot.itemId
    const toolKind = getItemToolProfile(itemId)?.kind

    if (toolKind === "hoe") {
      handleHoe(petX, petY, itemId)
      return
    }

    if (toolKind === "shovel") {
      handleShovel(petX, petY, itemId)
      return
    }

    if (toolKind === "watering_can") {
      handleWateringCan(petX, petY, itemId)
      return
    }

    if (SEED_ITEM_IDS.has(itemId)) {
      handleSeed("usable", slotIndex, itemId, petX, petY)
      return
    }
  }

  window.addEventListener("keydown", handleKeyDown)

  // Growth tick — advances crops every GROWTH_TICK_MS ms
  const growthInterval = window.setInterval(() => {
    useFarmingStore.getState().advanceGrowth()
  }, GROWTH_TICK_MS)

  return () => {
    window.removeEventListener("keydown", handleKeyDown)
    window.clearInterval(growthInterval)
  }
}

export default function FarmingInteractionSystem() {
  useEffect(() => {
    return startFarmingInteractionSystem()
  }, [])

  return null
}
