import { useEffect } from "react"
import { useWorldStore } from "../store/worldSlice"
import { useBrokenObjectsStore } from "../store/brokenObjectsStore"
import { useInventoryStore } from "../store/useInventoryStore"
import { useEntityStore } from "../store/entitySlice"
import { useQuestStore } from "../store/useQuestStore"
import { useWorldFxStore } from "../store/worldFxStore"
import { getPetCollisionBounds } from "./CollisionSystem"
import {
  getCanonicalItemId,
  getDefaultWorldInteractionConfig,
  getItemDefinition,
  getObtainEntriesByType,
  matchesToolRequirement,
} from "../config/itemsRegistry"
import { ENTITY_TYPES } from "../config/entityTypes"
import { getWorldThemeConfig } from "../config/worldThemeConfig"
import {
  WORLD_ATLAS_DATA,
  applyWorldAtlasObjectState,
  createWorldAtlasStumpObject,
  getWorldAtlasEntryById,
} from "../utils/worldAtlasData"
import {
  WORLD_ATLAS_COLLISION_VIEWPORT,
  getWorldAtlasCollisionBounds,
  getWorldAtlasLayout,
} from "../utils/worldAtlasFamilies"

const SLOT_KEYS = ["a", "z", "e", "r", "t"]
const INTERACTION_RADIUS = 72
const INTERACTION_BOUNDS_PADDING_PX = 12
const TREE_INTERACTION_BASE_HEIGHT_PX = 28
const BASE_POINT_INTERACTION_SIZE_PX = 14
const DEFAULT_RESOURCE_HIT_COUNT = 3
const OBJECT_IMPACT_DURATION_MS = 140

function isTreeItem(item) {
  const group = item.entry?.group
  const family = item.entry?.family || item.worldDecorFamily || ""
  const name = String(item.entry?.name || item.id || "").toLowerCase()
  const tags = item.entry?.tags || []
  return (
    group === "trees" ||
    family.includes("tree") ||
    name.includes("tree") ||
    tags.includes("tree")
  )
}

function isRockItem(item) {
  const group = item.entry?.group
  const family = item.entry?.family || item.worldDecorFamily || ""
  const name = String(item.entry?.name || item.id || "").toLowerCase()
  const tags = item.entry?.tags || []
  return (
    group === "rocks" ||
    family.includes("rock") ||
    name.includes("rock") ||
    tags.includes("rock")
  )
}

function matchesTargetGroup(item, targetGroup) {
  if (targetGroup === "trees") return isTreeItem(item)
  if (targetGroup === "rocks") return isRockItem(item)
  return false
}

function isInteractionDisabledItem(item) {
  return item?.entry?.interactionDisabled === true
}

function isTreeInteractionBlocked(item) {
  return isInteractionDisabledItem(item) || item?.entry?.isStump === true
}

function getItemDistancePoint(item) {
  if (item.baseX != null && item.baseY != null) {
    return { x: item.baseX, y: item.baseY }
  }
  if (item.x != null && item.y != null) {
    return { x: item.x, y: item.y }
  }
  try {
    const bounds = getWorldAtlasCollisionBounds(item)
    return {
      x: (bounds.left + bounds.right) / 2,
      y: (bounds.top + bounds.bottom) / 2,
    }
  } catch {
    return null
  }
}

function getInteractionFxPoint(item) {
  if (item.baseX != null && item.baseY != null) {
    return { x: item.baseX, y: item.baseY }
  }

  try {
    const bounds = getWorldAtlasCollisionBounds(item)
    return {
      x: (bounds.left + bounds.right) / 2,
      y: bounds.bottom,
    }
  } catch {
    if (item.x != null && item.y != null) {
      return { x: item.x, y: item.y }
    }
  }

  return null
}

function getInteractionBounds(item) {
  try {
    const bounds = getWorldAtlasCollisionBounds(item)
    const width = Math.max(0, bounds.right - bounds.left)
    const height = Math.max(0, bounds.bottom - bounds.top)

    if (width > 0 && height > 0) {
      if (isTreeItem(item)) {
        const top = Math.max(bounds.top, bounds.bottom - TREE_INTERACTION_BASE_HEIGHT_PX)
        return {
          left: bounds.left,
          right: bounds.right,
          top,
          bottom: bounds.bottom,
        }
      }

      return bounds
    }
  } catch {
    // Fallback to a small box around the base point below.
  }

  const point = getItemDistancePoint(item)
  if (!point) return null

  const halfSize = BASE_POINT_INTERACTION_SIZE_PX / 2
  return {
    left: point.x - halfSize,
    right: point.x + halfSize,
    top: point.y - halfSize,
    bottom: point.y + halfSize,
  }
}

function getRectGap(a, b) {
  if (!a || !b) return Infinity

  const dx = Math.max(0, a.left - b.right, b.left - a.right)
  const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom)
  return Math.hypot(dx, dy)
}

function getInteractionMetrics(item, petBounds, petX, petY) {
  const interactionBounds = getInteractionBounds(item)
  const distancePoint = getItemDistancePoint(item)
  if (!interactionBounds || !distancePoint) return null

  return {
    interactionBounds,
    edgeDistance: getRectGap(petBounds, interactionBounds),
    baseDistance: Math.hypot(distancePoint.x - petX, distancePoint.y - petY),
    distancePoint,
  }
}

function getRequiredInteractionHits(target, interactionType) {
  const configuredHits = Number(
    target?.entry?.interaction?.requiredHits ??
      target?.entry?.interaction?.durability ??
      target?.entry?.requiredHits ??
      target?.entry?.durability
  )

  if (Number.isFinite(configuredHits) && configuredHits > 0) {
    return Math.max(1, Math.floor(configuredHits))
  }

  if (interactionType === "chop" && isTreeItem(target)) {
    return DEFAULT_RESOURCE_HIT_COUNT
  }

  if (interactionType === "mine" && isRockItem(target)) {
    return DEFAULT_RESOURCE_HIT_COUNT
  }

  return 1
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

function createInteractionFx(toolItemId, petX, petY, target) {
  const fxConfig = getDefaultWorldInteractionConfig(toolItemId)?.fx
  if (!fxConfig) return null

  const targetPoint = getInteractionFxPoint(target)
  if (!targetPoint) return null

  const towardPetX = petX - targetPoint.x
  const towardPetY = petY - targetPoint.y
  const distance = Math.hypot(towardPetX, towardPetY) || 1
  const unitX = towardPetX / distance
  const unitY = towardPetY / distance

  return {
    type: fxConfig.type,
    x: targetPoint.x + unitX * fxConfig.towardPetDistance,
    y: targetPoint.y + unitY * fxConfig.towardPetDistance - fxConfig.liftFromBase,
    flipX: targetPoint.x < petX,
  }
}

function normalizeInteractionType(interactionType) {
  if (interactionType === "chop") return "chop"
  if (interactionType === "mine") return "mine"
  return null
}

function getTargetGroupForInteractionType(interactionType) {
  if (interactionType === "chop") return "trees"
  if (interactionType === "mine") return "rocks"
  return null
}

function resolveInteractionDrop(interactionType, toolItemId, target, fallbackConfig) {
  const obtainType =
    interactionType === "chop" ? "chopping" : interactionType === "mine" ? "mining" : null
  if (!obtainType) return null

  const sourceGroup = fallbackConfig?.targetGroup || getTargetGroupForInteractionType(interactionType)
  const entries = getObtainEntriesByType(obtainType, {
    sourceGroup,
    toolItemId,
  })
  const explicitItemId = getCanonicalItemId(target?.entry?.interaction?.gives)
  const entry = explicitItemId
    ? entries.find((candidate) => candidate.itemId === explicitItemId) || null
    : entries[0] || null

  return {
    itemId: explicitItemId || entry?.itemId || null,
    quantity: Array.isArray(entry?.quantity) ? entry.quantity[0] || 1 : 1,
  }
}

export function startWorldInteractionSystem() {
  const pendingResultObjectIds = new Set()
  const pendingResultTimeouts = new Set()
  const interactionHitCounts = new Map()

  function handleKeyDown(event) {
    if (event.repeat) return

    const key = event.key.toLowerCase()
    const slotIndex = SLOT_KEYS.indexOf(key)
    if (slotIndex === -1) return

    const inventoryState = useInventoryStore.getState()
    const slot = inventoryState.usableSlots[slotIndex]
    if (!slot?.itemId) return

    const equippedItemId = getCanonicalItemId(slot.itemId) || slot.itemId
    const definition = getItemDefinition(equippedItemId)
    if (!definition?.equipable) return

    const toolConfig = getDefaultWorldInteractionConfig(equippedItemId)
    if (!toolConfig) return

    const { worldOffset, currentWorldTheme } = useWorldStore.getState()
    const petX = -(worldOffset?.x || 0)
    const petY = -(worldOffset?.y || 0)
    const petBounds = getPetCollisionBounds({ x: petX, y: petY })

    const theme = getWorldThemeConfig(currentWorldTheme)
    const layout = getWorldAtlasLayout(
      petX,
      petY,
      theme.atlasData,
      WORLD_ATLAS_COLLISION_VIEWPORT
    )

    const brokenStore = useBrokenObjectsStore.getState()

      // renderItems only contains floating/object-anchored items (trees, etc.).
      // Tile-anchored items (small rocks) live in tileChunks — extract those
      // that have explicit interaction metadata so we can mine them too.
    const tileInteractionItems = layout.tileChunks.flatMap((chunk) => [
      ...chunk.tileBackItems,
      ...chunk.tileFrontItems,
    ]).filter((item) => item.entry?.interaction != null)

    const allRenderItems = applyWorldAtlasObjectState(
      [...layout.renderItems, ...tileInteractionItems],
      theme.atlasData,
      brokenStore
    )

    const candidates = allRenderItems.reduce((results, item) => {
      if (!item?.id || brokenStore.isObjectBroken(item.id)) {
        return results
      }

      if (isInteractionDisabledItem(item)) return results

      const interaction = item.entry?.interaction
      const interactionType =
        normalizeInteractionType(interaction?.type) || toolConfig.interactionType

      if (interactionType === "chop" && isTreeInteractionBlocked(item)) {
        return results
      }

      if (interaction) {
        if (!normalizeInteractionType(interaction.type)) return results
        if (!matchesToolRequirement(equippedItemId, interaction.tool)) return results
      } else if (!matchesTargetGroup(item, toolConfig.targetGroup)) {
        return results
      }

      const metrics = getInteractionMetrics(item, petBounds, petX, petY)
      if (!metrics) return results
      if (metrics.baseDistance > INTERACTION_RADIUS) return results
      if (metrics.edgeDistance > INTERACTION_BOUNDS_PADDING_PX) return results

      results.push({
        item,
        interactionType,
        metrics,
      })
      return results
    }, [])

    if (candidates.length === 0) {
      brokenStore.showWorldFeedback(toolConfig.missingMessage)
      return
    }

    const targetCandidate = candidates.reduce((closest, candidate) => {
      if (!closest) return candidate

      if (candidate.metrics.edgeDistance !== closest.metrics.edgeDistance) {
        return candidate.metrics.edgeDistance < closest.metrics.edgeDistance
          ? candidate
          : closest
      }

      return candidate.metrics.baseDistance < closest.metrics.baseDistance
        ? candidate
        : closest
    }, null)
    const target = targetCandidate?.item || null
    const interactionType = targetCandidate?.interactionType || null
    if (!target || !interactionType) return

    if (pendingResultObjectIds.has(target.id) || brokenStore.isObjectBroken(target.id)) {
      return
    }

    dispatchEquipmentAction(interactionType, equippedItemId)

    const dropResult = resolveInteractionDrop(
      interactionType,
      equippedItemId,
      target,
      toolConfig
    )
    const spawnItemId = dropResult?.itemId || null
    const spawnQuantity = Math.max(1, Number(dropResult?.quantity) || 1)
    const replacementEntryId =
      target.entry?.choppedVariantId ||
      target.entry?.interaction?.replacementEntryId ||
      null

    if (import.meta.env.DEV) {
      console.log("[interaction-target]", {
        slotItemId: equippedItemId,
        targetId: target.id,
        targetEntryId: target.entry?.id || null,
        targetEntryName: target.entry?.name || null,
        targetGroup: target.entry?.group || null,
        targetFamily: target.entry?.family || target.worldDecorFamily || null,
        interaction: target.entry?.interaction || null,
        choppedVariantId: target.entry?.choppedVariantId || null,
        replacementEntryId,
        baseX: target.baseX ?? null,
        baseY: target.baseY ?? null,
        x: target.x ?? null,
        y: target.y ?? null,
        scale: target.scale ?? null,
        anchorMode: target.anchorMode || null,
      })
    }

    pendingResultObjectIds.add(target.id)

    const requiredHits = getRequiredInteractionHits(target, interactionType)
    const currentHits = interactionHitCounts.get(target.id) || 0
    const nextHits = Math.min(requiredHits, currentHits + 1)
    const isFinalHit = nextHits >= requiredHits
    interactionHitCounts.set(target.id, nextHits)

    const interactionFx = createInteractionFx(equippedItemId, petX, petY, target)
    if (interactionFx) {
      useWorldFxStore.getState().spawnFx(interactionFx)
    }

    useWorldFxStore.getState().spawnObjectImpact({
      objectId: target.id,
      item: target,
      durationMs: OBJECT_IMPACT_DURATION_MS,
    })

    const timeoutId = window.setTimeout(() => {
      pendingResultTimeouts.delete(timeoutId)
      pendingResultObjectIds.delete(target.id)
      if (!isFinalHit) return
      if (brokenStore.isObjectBroken(target.id)) {
        interactionHitCounts.delete(target.id)
        return
      }

      interactionHitCounts.delete(target.id)

      if (interactionType === "chop" && replacementEntryId) {
        const replacementEntry =
          getWorldAtlasEntryById(theme.atlasData, replacementEntryId) ||
          getWorldAtlasEntryById(WORLD_ATLAS_DATA, replacementEntryId)
        const stumpObject = createWorldAtlasStumpObject(target, replacementEntry)

        if (import.meta.env.DEV) {
          console.log("[chop-start]", {
            targetId: target.id,
            entryId: target.entry?.id || null,
            entryName: target.entry?.name || null,
            replacementEntryId,
            replacementEntryFound: Boolean(replacementEntry),
            stumpCreated: Boolean(stumpObject),
          })
        }

        if (stumpObject) {
          brokenStore.replaceObject({ originalObjectId: target.id, stumpObject })
        } else {
          brokenStore.breakObject(target.id)
        }
      } else {
        brokenStore.breakObject(target.id)
      }

      if (!spawnItemId) {
        brokenStore.showWorldFeedback(toolConfig.successMessage)
        return
      }

      useEntityStore.getState().spawnEntity(
        target.baseX ?? target.x,
        target.baseY ?? target.y,
        ENTITY_TYPES.RESOURCE,
        { itemKey: spawnItemId, reward: "inventory_item", rewardAmount: spawnQuantity }
      )

      useQuestStore.getState().recordWorldInteraction({
        type: toolConfig.interactionType,
        sourceFamily: toolConfig.targetGroup,
        itemId: spawnItemId,
      })

      brokenStore.showWorldFeedback(toolConfig.successMessage)
    }, OBJECT_IMPACT_DURATION_MS)
    pendingResultTimeouts.add(timeoutId)
  }

  window.addEventListener("keydown", handleKeyDown)
  return () => {
    window.removeEventListener("keydown", handleKeyDown)
    pendingResultTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
  }
}

export default function WorldInteractionSystem() {
  useEffect(() => {
    return startWorldInteractionSystem()
  }, [])

  return null
}
