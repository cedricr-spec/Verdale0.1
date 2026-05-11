import { useEffect } from "react"
import { useEntityStore } from "../store/entitySlice"
import { useWorldStore } from "../store/worldSlice"
import { MAX_ENTITIES } from "../config/spawnConfig"
import { ENTITY_TYPES } from "../config/entityTypes"
import { getCanonicalItemId, getWorldSpawnEntries } from "../config/itemsRegistry"
import { isFood } from "../config/worldFoodMetadata"
import { isWorldPointInsideVillage } from "../utils/worldVillage"

const INITIAL_PICKUP_COUNT = 3
const ACTIVE_PICKUP_LIMIT = Math.min(MAX_ENTITIES, 12)
const RESPAWN_INTERVAL_MS = 32000
const EXTRA_RESPAWN_CHANCE = 0.08
const MAX_VILLAGE_SPAWN_ATTEMPTS = 16
const STARTER_RESOURCE_RADIUS_STEP = 64

// Guaranteed starter pickups — 3 wood logs + 3 wood branches, spawned once per session.
const STARTER_RESOURCES = [
  { itemId: "wood_log",    angle: 0,                 radius: 100 },
  { itemId: "wood_log",    angle: (Math.PI * 2) / 3, radius: 120 },
  { itemId: "wood_log",    angle: (Math.PI * 4) / 3, radius: 110 },
  { itemId: "wood_branch", angle: Math.PI / 3,        radius: 100 },
  { itemId: "wood_branch", angle: Math.PI,            radius: 130 },
  { itemId: "wood_branch", angle: (Math.PI * 5) / 3, radius: 115 },
]
let starterResourcesSeeded = false
const SPAWN_POOL_ENTRIES = getWorldSpawnEntries()

function pickWeightedEntry(entries, getWeight = (entry) => entry.weight) {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, Number(getWeight(entry)) || 0), 0)
  if (totalWeight <= 0) return null

  let roll = Math.random() * totalWeight

  for (const entry of entries) {
    roll -= Math.max(0, Number(getWeight(entry)) || 0)
    if (roll <= 0) return entry
  }

  return entries[entries.length - 1] || null
}

const SPAWN_POOL_ITEM_IDS = [
  ...new Set(SPAWN_POOL_ENTRIES.map((entry) => entry.itemId)),
]

function getPickupEntityType(itemId) {
  return isFood(itemId) ? ENTITY_TYPES.FOOD : ENTITY_TYPES.RESOURCE
}

function rollQuantity([min, max] = [1, 1]) {
  if (max <= min) return min
  return min + Math.floor(Math.random() * (max - min + 1))
}

function getRandomSpawnPoolEntry() {
  return pickWeightedEntry(SPAWN_POOL_ENTRIES) || null
}

function createRandomSpawnPoint(centerX, centerY, minRadius, maxRadius) {
  const angle = Math.random() * Math.PI * 2
  const radius = minRadius + Math.random() * (maxRadius - minRadius)
  const jitterX = (Math.random() - 0.5) * 100
  const jitterY = (Math.random() - 0.5) * 100

  return {
    x: centerX + Math.cos(angle) * radius + jitterX,
    y: centerY + Math.sin(angle) * radius + jitterY,
  }
}

function findVillageSafeSpawnPoint(centerX, centerY, minRadius, maxRadius) {
  for (let attempt = 0; attempt < MAX_VILLAGE_SPAWN_ATTEMPTS; attempt += 1) {
    const point = createRandomSpawnPoint(centerX, centerY, minRadius, maxRadius)
    if (!isWorldPointInsideVillage(point.x, point.y)) {
      return point
    }
  }

  return null
}

function findStarterSpawnPoint(centerX, centerY, angle, baseRadius) {
  for (let attempt = 0; attempt < MAX_VILLAGE_SPAWN_ATTEMPTS; attempt += 1) {
    const radius = baseRadius + attempt * STARTER_RESOURCE_RADIUS_STEP
    const point = {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    }

    if (!isWorldPointInsideVillage(point.x, point.y)) {
      return point
    }
  }

  return null
}

export default function SpawnSystem() {
  useEffect(() => {
    return startSpawnSystem()
  }, [])

  return null
}

export function startSpawnSystem() {
  const spawnPickupAround = (centerX, centerY, minRadius, maxRadius, spawnEntry) => {
    if (!spawnEntry?.itemId) return
    const point = findVillageSafeSpawnPoint(centerX, centerY, minRadius, maxRadius)
    if (!point) return
    const rewardAmount = rollQuantity(spawnEntry.quantity)

    useEntityStore.getState().spawnEntity(point.x, point.y, getPickupEntityType(spawnEntry.itemId), {
      itemKey: spawnEntry.itemId,
      reward: "inventory_item",
      rewardAmount,
    })
  }

  useEntityStore.setState((state) => ({
    entities: (state.entities || []).filter((entity) => {
      const canonicalItemId = getCanonicalItemId(entity.itemKey) || entity.itemKey
      return (
        (entity.type === ENTITY_TYPES.RESOURCE || entity.type === ENTITY_TYPES.FOOD) &&
        SPAWN_POOL_ITEM_IDS.includes(canonicalItemId)
      )
    }),
  }))

  const { worldOffset } = useWorldStore.getState()
  const centerX = -(worldOffset.x || 0)
  const centerY = -(worldOffset.y || 0)

  for (let index = 0; index < INITIAL_PICKUP_COUNT; index += 1) {
    const spawnEntry = getRandomSpawnPoolEntry()
    spawnPickupAround(centerX, centerY, 140 + index * 45, 320 + index * 70, spawnEntry)
  }

  if (!starterResourcesSeeded) {
    starterResourcesSeeded = true
    STARTER_RESOURCES.forEach(({ itemId, angle, radius }) => {
      const point = findStarterSpawnPoint(centerX, centerY, angle, radius)
      if (!point) return

      useEntityStore.getState().spawnEntity(point.x, point.y, ENTITY_TYPES.RESOURCE, {
        itemKey: itemId,
        reward: "inventory_item",
        rewardAmount: 1,
      })
    })
  }

  const intervalId = setInterval(() => {
    const existing = useEntityStore.getState().entities
    const activePickups = existing.filter(
      (entity) => entity.type === ENTITY_TYPES.RESOURCE || entity.type === ENTITY_TYPES.FOOD
    ).length
    if (activePickups >= ACTIVE_PICKUP_LIMIT) return

    const { worldOffset } = useWorldStore.getState()

    const remainingCapacity = ACTIVE_PICKUP_LIMIT - activePickups
    if (remainingCapacity <= 0) return

    const desiredBatch = Math.random() < EXTRA_RESPAWN_CHANCE ? 2 : 1
    const batch = Math.min(remainingCapacity, desiredBatch)
    const minRadius = 200
    const maxRadius = 1200

    for (let i = 0; i < batch; i += 1) {
      const centerX = -(worldOffset.x || 0)
      const centerY = -(worldOffset.y || 0)
      const spawnEntry = getRandomSpawnPoolEntry()
      spawnPickupAround(centerX, centerY, minRadius, maxRadius, spawnEntry)
    }
  }, RESPAWN_INTERVAL_MS)

  return () => clearInterval(intervalId)
}
