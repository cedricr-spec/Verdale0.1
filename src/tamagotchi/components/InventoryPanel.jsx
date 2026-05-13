import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import lockIcon from "../../hud/Locks/Lock_Icon.webp"
import MenuBackdrop from "./MenuBackdrop"
import { countItemsInSlots, getCraftRecipe, getRecipeInputs } from "../config/craftRecipes"
import { PLAYER_INVENTORY_UI_LAYOUT } from "../config/inventoryLayout"
import { getItemDefinition } from "../config/itemsRegistry"
import ItemVisual from "./ItemVisual"
import InventoryPanelDesktop from "./InventoryPanelDesktop"
import InventoryPanelMobile from "./InventoryPanelMobile"
import PixelAnchoredPopover from "./PixelAnchoredPopover"
import {
  getUnlockedSlotCountForArea,
  useInventoryStore,
} from "../store/useInventoryStore"
import { usePetStore } from "../store/usePetStore"
import { useQuestStore } from "../store/useQuestStore"

const OVERLAY_Z_INDEX = 1000002
const POPIN_Z_INDEX = 1000003
const CLICK_DRAG_THRESHOLD_PX = 5
const ACTION_FEEDBACK_DURATION_MS = 1800
const MOBILE_BREAKPOINT_PX = 760
const FLOATING_TOOLBAR_BASE_HEIGHT = 30
const MOBILE_PRIMARY_PANEL_WIDTH = 192
const MOBILE_HORIZONTAL_PADDING = 24
const MOBILE_MAX_ACTION_SCALE = 1.25

const ACTION_PANEL = PLAYER_INVENTORY_UI_LAYOUT.actionSlots
const INVENTORY_PANEL = PLAYER_INVENTORY_UI_LAYOUT.inventory
const CRAFT_PANEL = PLAYER_INVENTORY_UI_LAYOUT.craft
const DESKTOP_LAYOUT_WIDTH =
  INVENTORY_PANEL.width + PLAYER_INVENTORY_UI_LAYOUT.desktop.columnGap + CRAFT_PANEL.width
const DESKTOP_LAYOUT_HEIGHT =
  INVENTORY_PANEL.height + PLAYER_INVENTORY_UI_LAYOUT.desktop.rowGap + ACTION_PANEL.height

function snapInventoryScale(maxScale) {
  if (!Number.isFinite(maxScale) || maxScale <= 0) return 1
  if (maxScale >= 2) return 2
  if (maxScale >= 1.75) return 1.75
  if (maxScale >= 1.5) return 1.5
  if (maxScale >= 1.25) return 1.25
  if (maxScale >= 1) return 1
  return Math.max(0.75, Math.floor(maxScale * 100) / 100)
}

function getInventoryLayoutMetrics() {
  if (typeof window === "undefined") {
    return {
      isMobileLayout: false,
      desktopScale: 1,
      mobilePanelScale: 1,
      mobileActionScale: 1,
    }
  }

  const isMobileLayout = window.innerWidth <= MOBILE_BREAKPOINT_PX
  if (isMobileLayout) {
    const availableWidth = Math.max(1, window.innerWidth - MOBILE_HORIZONTAL_PADDING)
    const mobilePanelScale = snapInventoryScale(
      Math.min(2, availableWidth / MOBILE_PRIMARY_PANEL_WIDTH)
    )
    const mobileActionScale = snapInventoryScale(
      Math.min(MOBILE_MAX_ACTION_SCALE, availableWidth / ACTION_PANEL.width)
    )

    return {
      isMobileLayout: true,
      desktopScale: 1,
      mobilePanelScale,
      mobileActionScale,
    }
  }

  const horizontalPadding = 64
  const verticalPadding = 112
  const availableWidth = Math.max(1, window.innerWidth - horizontalPadding)
  const availableHeight = Math.max(1, window.innerHeight - verticalPadding)
  const desktopScale = snapInventoryScale(
    Math.min(
      availableWidth / DESKTOP_LAYOUT_WIDTH,
      availableHeight / (DESKTOP_LAYOUT_HEIGHT + FLOATING_TOOLBAR_BASE_HEIGHT),
      2
    )
  )

  return {
    isMobileLayout: false,
    desktopScale,
    mobilePanelScale: 1,
    mobileActionScale: 1,
  }
}

function parseSlotKey(slotKey) {
  if (!slotKey) return null
  const [area, rawIndex] = slotKey.split(":")
  const index = Number(rawIndex)
  if (Number.isNaN(index)) return null

  return { area, index }
}

function getStackLabel(stack) {
  if (!stack?.itemId) return null

  const itemDefinition = getItemDefinition(stack.itemId)
  const quantity = Math.max(0, Number(stack.quantity) || 0)
  return `${itemDefinition?.name || stack.itemId} x${quantity}`
}

function hasAnyEffectValue(effects = {}) {
  return ["hunger", "energy", "happiness", "health"].some(
    (key) => Number(effects?.[key] || 0) !== 0
  )
}

function getFoodUseEffects(foodStats = null) {
  if (!foodStats?.edible) return null

  return {
    hunger: Number(foodStats.hungerRestore) || 0,
    energy: Number(foodStats.energyRestore) || 0,
    happiness: Number(foodStats.happinessRestore) || 0,
    health: Number(foodStats.healthRestore) || 0,
  }
}

function canUseItemDefinition(itemDefinition) {
  return Boolean(itemDefinition?.usable || itemDefinition?.food?.edible)
}

function canSplitStackForUi(area, stack, itemDefinition) {
  if (!["main", "usable"].includes(area)) return false
  if (!stack?.itemId) return false
  if (!itemDefinition?.stackable) return false
  return Math.max(0, Number(stack.quantity) || 0) > 1
}

function renderLockedOverlay() {
  return (
    <span className="inventory-ui-slot__lock">
      <img
        src={lockIcon}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="inventory-ui-slot__lock-icon"
      />
    </span>
  )
}

function expandRecipePreviewIngredients(recipe) {
  return getRecipeInputs(recipe)
    .flatMap((input) =>
      Array.from({ length: Math.max(0, Number(input.quantity) || 0) }, () => ({
        itemId: input.itemId,
        quantity: 1,
      }))
    )
}

function buildCraftPreviewSlots(recipe, craftSlots = []) {
  if (!recipe) return []

  const previewIngredients = expandRecipePreviewIngredients(recipe)
  const remainingRealCounts = { ...countItemsInSlots(craftSlots) }

  return previewIngredients.map((ingredient, index) => {
    const realStack = craftSlots[index]
    const sameSlotQuantity =
      realStack?.itemId === ingredient.itemId ? Math.max(0, Number(realStack.quantity) || 0) : 0

    if (sameSlotQuantity > 0) {
      remainingRealCounts[ingredient.itemId] = Math.max(
        0,
        (remainingRealCounts[ingredient.itemId] || 0) - 1
      )
      return {
        ...ingredient,
        state: "placed",
      }
    }

    if ((remainingRealCounts[ingredient.itemId] || 0) > 0) {
      remainingRealCounts[ingredient.itemId] -= 1
      return {
        ...ingredient,
        state: "covered",
      }
    }

    return {
      ...ingredient,
      state: "missing",
    }
  })
}

export default function InventoryPanel({ open, onClose }) {
  const mainSlots = useInventoryStore((state) => state.mainSlots)
  const usableSlots = useInventoryStore((state) => state.usableSlots)
  const craftSlots = useInventoryStore((state) => state.craftSlots)
  const craftResult = useInventoryStore((state) => state.craftResult)
  const unlockedSlotCount = useInventoryStore((state) => state.unlockedSlotCount)
  const walletSol = useInventoryStore((state) => state.wallet?.sol ?? 0)
  const moveItem = useInventoryStore((state) => state.moveItem)
  const splitStack = useInventoryStore((state) => state.splitStack)
  const craftCurrentRecipe = useInventoryStore((state) => state.craftCurrentRecipe)
  const craftRecipeById = useInventoryStore((state) => state.craftRecipeById)
  const consumeSlotItem = useInventoryStore((state) => state.consumeSlotItem)
  const throwItemFromSlot = useInventoryStore((state) => state.throwItemFromSlot)
  const recordCraftedItem = useQuestStore((state) => state.recordCraftedItem)

  const pressStateRef = useRef(null)
  const dragStateRef = useRef(null)
  const [dragState, setDragState] = useState(null)
  const [pressState, setPressState] = useState(null)
  const [selectedSlotKey, setSelectedSlotKey] = useState(null)
  const [itemActionPopover, setItemActionPopover] = useState(null)
  const [actionFeedback, setActionFeedback] = useState(null)
  const [hoverPreviewRecipeId, setHoverPreviewRecipeId] = useState(null)
  const [layoutMetrics, setLayoutMetrics] = useState(() => getInventoryLayoutMetrics())

  const dragSourceKey = dragState?.sourceKey || null
  const dropTargetKey = dragState?.targetKey || null
  const mainUnlockedCount = getUnlockedSlotCountForArea(unlockedSlotCount, "main")
  const { isMobileLayout, desktopScale, mobilePanelScale, mobileActionScale } = layoutMetrics

  const getInteractionScale = useCallback(
    (area) => {
      if (!isMobileLayout) return desktopScale
      if (area === "usable") return mobileActionScale
      return mobilePanelScale
    },
    [desktopScale, isMobileLayout, mobileActionScale, mobilePanelScale]
  )

  const getStackForArea = useCallback(
    (area, index) => {
      if (area === "main") return mainSlots[index] || null
      if (area === "usable") return usableSlots[index] || null
      if (area === "craft") return craftSlots[index] || null
      return null
    },
    [craftSlots, mainSlots, usableSlots]
  )

  const showActionFeedback = useCallback((message) => {
    if (!message) return
    setActionFeedback(message)
  }, [])

  const closeItemActionPopover = useCallback(() => {
    setItemActionPopover(null)
  }, [])

  const openItemActionPopover = useCallback(
    (slotKey, area, index, stack, anchorRect) => {
      if (!stack?.itemId || !["main", "usable"].includes(area)) {
        setItemActionPopover(null)
        return
      }

      setItemActionPopover({
        slotKey,
        area,
        index,
        anchorRect: {
          left: anchorRect.left,
          top: anchorRect.top,
          right: anchorRect.right,
          bottom: anchorRect.bottom,
          width: anchorRect.width,
          height: anchorRect.height,
        },
      })
    },
    []
  )

  const handlePointerMove = useCallback((event) => {
    const currentDrag = dragStateRef.current

    if (currentDrag) {
      const hovered = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest("[data-slot-key]")

      setDragState((activeDragState) => {
        if (!activeDragState) return activeDragState

        const nextActiveDragState = {
          ...activeDragState,
          x: event.clientX,
          y: event.clientY,
          targetKey: hovered?.dataset?.slotKey || null,
        }

        dragStateRef.current = nextActiveDragState
        return nextActiveDragState
      })
      return
    }

    const currentPress = pressStateRef.current
    if (!currentPress?.stack?.itemId) return

    const deltaX = event.clientX - currentPress.originX
    const deltaY = event.clientY - currentPress.originY
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)
    const distance = Math.hypot(deltaX, deltaY)

    if (currentPress.allowVerticalScroll && absY >= CLICK_DRAG_THRESHOLD_PX && absY > absX) {
      pressStateRef.current = null
      setPressState(null)
      return
    }

    if (distance < CLICK_DRAG_THRESHOLD_PX) return

    const hovered = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest("[data-slot-key]")

    const nextDragState = {
      source: currentPress.source,
      sourceKey: currentPress.sourceKey,
      targetKey: hovered?.dataset?.slotKey || null,
      stack: currentPress.stack,
      x: event.clientX,
      y: event.clientY,
    }

    pressStateRef.current = null
    dragStateRef.current = nextDragState
    setPressState(null)
    setItemActionPopover(null)
    setDragState(nextDragState)
  }, [])

  const handlePointerEnd = useCallback(
    (event) => {
      const currentDrag = dragStateRef.current

      if (currentDrag) {
        const hovered = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest("[data-slot-key]")
        const target = parseSlotKey(hovered?.dataset?.slotKey || currentDrag.targetKey)

        if (
          target &&
          target.area !== "result" &&
          (target.area !== currentDrag.source.area || target.index !== currentDrag.source.index)
        ) {
          moveItem(currentDrag.source, target)
        }

        dragStateRef.current = null
        setDragState(null)
        return
      }

      const currentPress = pressStateRef.current
      if (!currentPress) return

      pressStateRef.current = null
      setPressState(null)

      const hoveredSlotKey =
        document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest("[data-slot-key]")
          ?.dataset?.slotKey || currentPress.sourceKey

      if (hoveredSlotKey !== currentPress.sourceKey) {
        setItemActionPopover(null)
        return
      }

      setSelectedSlotKey(currentPress.sourceKey)

      const currentStack =
        getStackForArea(currentPress.source.area, currentPress.source.index) || currentPress.stack

      if (!currentStack?.itemId) {
        setItemActionPopover(null)
        return
      }

      if (["main", "usable"].includes(currentPress.source.area)) {
        openItemActionPopover(
          currentPress.sourceKey,
          currentPress.source.area,
          currentPress.source.index,
          currentStack,
          currentPress.anchorRect
        )
        return
      }

      setItemActionPopover(null)
    },
    [getStackForArea, moveItem, openItemActionPopover]
  )

  useEffect(() => {
    pressStateRef.current = pressState
  }, [pressState])

  useEffect(() => {
    dragStateRef.current = dragState
  }, [dragState])

  useEffect(() => {
    if (typeof document === "undefined") return undefined

    const { body } = document
    if (!body) return undefined

    if (dragState?.stack?.itemId) {
      body.classList.add("is-dragging")
    } else {
      body.classList.remove("is-dragging")
    }

    return () => {
      body.classList.remove("is-dragging")
    }
  }, [dragState])

  useEffect(() => {
    if (!open) return undefined

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerEnd)
    window.addEventListener("pointercancel", handlePointerEnd)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerEnd)
      window.removeEventListener("pointercancel", handlePointerEnd)
    }
  }, [handlePointerEnd, handlePointerMove, open])

  useEffect(() => {
    if (!open) return undefined

    const updateLayoutMetrics = () => {
      setLayoutMetrics(getInventoryLayoutMetrics())
    }

    updateLayoutMetrics()
    window.addEventListener("resize", updateLayoutMetrics)

    return () => window.removeEventListener("resize", updateLayoutMetrics)
  }, [open])

  useEffect(() => {
    if (!actionFeedback) return undefined

    const timeoutId = window.setTimeout(() => {
      setActionFeedback(null)
    }, ACTION_FEEDBACK_DURATION_MS)

    return () => window.clearTimeout(timeoutId)
  }, [actionFeedback])

  useEffect(() => {
    if (open) return
    dragStateRef.current = null
    pressStateRef.current = null
    setDragState(null)
    setPressState(null)
    setSelectedSlotKey(null)
    setItemActionPopover(null)
    setActionFeedback(null)
    setHoverPreviewRecipeId(null)
  }, [open])

  const handleSplitStackAction = useCallback(
    (area, index, stack) => {
      const itemDefinition = stack?.itemId ? getItemDefinition(stack.itemId) : null
      if (!canSplitStackForUi(area, stack, itemDefinition)) {
        return { success: false, reason: "not_splittable" }
      }

      const result = splitStack(area, index)
      if (!result?.success) {
        showActionFeedback("No empty unlocked slot for a split stack.")
        return result
      }

      const targetLabel =
        result.target?.area === "usable"
          ? `action slot ${result.target.index + 1}`
          : `bag slot ${result.target.index + 1}`
      showActionFeedback(
        `Split ${itemDefinition?.name || stack.itemId} into ${targetLabel}.`
      )
      setSelectedSlotKey(
        result.target ? `${result.target.area}:${result.target.index}` : `${area}:${index}`
      )
      return result
    },
    [showActionFeedback, splitStack]
  )

  const handleSlotPointerDown = useCallback((event, area, index, stack, options = {}) => {
    const {
      preventBrowserDefault = true,
      selectOnPointerDown = true,
      allowVerticalScroll = false,
    } = options

    if (event.button !== undefined && event.button !== 0) {
      return
    }

    if (preventBrowserDefault) {
      event.preventDefault()
    }
    event.stopPropagation()

    const slotKey = `${area}:${index}`
    if (selectOnPointerDown) {
      setSelectedSlotKey(slotKey)
    }
    setItemActionPopover(null)

    if (!stack?.itemId) {
      pressStateRef.current = null
      setPressState(null)
      return
    }

    if (event.shiftKey) {
      const splitResult = handleSplitStackAction(area, index, stack)
      if (splitResult?.success) {
        pressStateRef.current = null
        setPressState(null)
      }
      return
    }

    const nextPressState = {
      source: { area, index },
      sourceKey: slotKey,
      stack,
      originX: event.clientX,
      originY: event.clientY,
      anchorRect: event.currentTarget.getBoundingClientRect(),
      allowVerticalScroll,
    }

    pressStateRef.current = nextPressState
    setPressState(nextPressState)
  }, [handleSplitStackAction])

  const handleStorageSlotContextMenu = useCallback((event, area, index, stack) => {
    event.preventDefault()
    event.stopPropagation()
    pressStateRef.current = null
    dragStateRef.current = null
    setPressState(null)
    setDragState(null)
    setItemActionPopover(null)
    handleSplitStackAction(area, index, stack)
  }, [handleSplitStackAction])

  const notifyCraftedOutputs = useCallback(
    (outputs = []) => {
      outputs.forEach((output) => {
        if (!output?.itemId) return
        const quantity = Math.max(0, Number(output.quantity) || 0)
        if (quantity <= 0) return
        recordCraftedItem(output.itemId, quantity)
      })
    },
    [recordCraftedItem]
  )

  const handleCraftResultClick = useCallback(() => {
    const result = craftCurrentRecipe()
    if (result?.success) {
      notifyCraftedOutputs(result.outputs)
    }
  }, [craftCurrentRecipe, notifyCraftedOutputs])

  const handleHoverRecipePreview = useCallback((recipeId) => {
    setHoverPreviewRecipeId(recipeId)
  }, [])

  const handleClearHoverRecipePreview = useCallback(() => {
    setHoverPreviewRecipeId(null)
  }, [])

  const handleCraftRecipeById = useCallback(
    (recipeId) => {
      const result = craftRecipeById(recipeId)
      if (result?.success) {
        notifyCraftedOutputs(result.outputs)
      }
      return result
    },
    [craftRecipeById, notifyCraftedOutputs]
  )

  const previewRecipe = useMemo(
    () => (hoverPreviewRecipeId ? getCraftRecipe(hoverPreviewRecipeId) : null),
    [hoverPreviewRecipeId]
  )

  const craftPreviewSlots = useMemo(
    () => buildCraftPreviewSlots(previewRecipe, craftSlots),
    [craftSlots, previewRecipe]
  )

  const actionPopoverStack = itemActionPopover
    ? getStackForArea(itemActionPopover.area, itemActionPopover.index)
    : null
  const actionPopoverItemDefinition = actionPopoverStack?.itemId
    ? getItemDefinition(actionPopoverStack.itemId)
    : null
  const canUsePopoverItem = canUseItemDefinition(actionPopoverItemDefinition)
  const canThrowPopoverItem = actionPopoverItemDefinition?.discardable === true
  const canSplitPopoverItem = canSplitStackForUi(
    itemActionPopover?.area,
    actionPopoverStack,
    actionPopoverItemDefinition
  )
  const canEquipPopoverItem =
    Boolean(actionPopoverItemDefinition?.equipable) && itemActionPopover?.area === "main"

  useEffect(() => {
    if (!itemActionPopover) return

    if (!actionPopoverStack?.itemId) {
      setItemActionPopover(null)
    }
  }, [actionPopoverStack, itemActionPopover])

  const handleUseSelectedItem = useCallback(() => {
    if (!itemActionPopover) return

    const stack = getStackForArea(itemActionPopover.area, itemActionPopover.index)
    const itemDefinition = stack?.itemId ? getItemDefinition(stack.itemId) : null

    if (!stack?.itemId || !itemDefinition) {
      setItemActionPopover(null)
      return
    }

    const foodEffects = getFoodUseEffects(itemDefinition.food)
    const useEffects = itemDefinition.useEffects || foodEffects
    const isEdibleFood = itemDefinition.food?.edible === true
    const isConsumableUse =
      isEdibleFood || (itemDefinition.usable === true && hasAnyEffectValue(useEffects))

    if (!canUseItemDefinition(itemDefinition)) {
      setItemActionPopover(null)
      return
    }

    if (!isConsumableUse) {
      showActionFeedback(`${itemDefinition.name} can't be used here yet.`)
      setItemActionPopover(null)
      return
    }

    const consumed = consumeSlotItem(itemActionPopover.area, itemActionPopover.index, 1)
    if (!consumed) {
      setItemActionPopover(null)
      return
    }

    if (useEffects) {
      usePetStore.getState().applyEffects(useEffects)
    }

    showActionFeedback(`Used ${itemDefinition.name}`)
    setItemActionPopover(null)
  }, [consumeSlotItem, getStackForArea, itemActionPopover, showActionFeedback])

  const handleEquipPopoverItem = useCallback(
    (targetSlotIndex) => {
      if (!itemActionPopover) return

      const source = { area: itemActionPopover.area, index: itemActionPopover.index }
      const target = { area: "usable", index: targetSlotIndex }
      moveItem(source, target)
      setItemActionPopover(null)
      showActionFeedback(`Equipped to slot ${targetSlotIndex + 1}`)
    },
    [itemActionPopover, moveItem, showActionFeedback]
  )

  const handleThrowSelectedItem = useCallback(() => {
    if (!itemActionPopover) return

    const result = throwItemFromSlot(itemActionPopover.area, itemActionPopover.index, 1)
    if (!result?.success) {
      showActionFeedback("Couldn't throw that item here.")
      setItemActionPopover(null)
      return
    }

    showActionFeedback(`Threw ${getItemDefinition(result.itemId)?.name || result.itemId}`)
    setItemActionPopover(null)
  }, [itemActionPopover, showActionFeedback, throwItemFromSlot])

  const handleSplitSelectedItem = useCallback(() => {
    if (!itemActionPopover) return

    const stack = getStackForArea(itemActionPopover.area, itemActionPopover.index)
    const result = handleSplitStackAction(
      itemActionPopover.area,
      itemActionPopover.index,
      stack
    )
    if (result?.success) {
      setItemActionPopover(null)
    }
  }, [getStackForArea, handleSplitStackAction, itemActionPopover])

  const draggedStack = dragState?.stack || null
  const dragPreviewScale = dragState?.source?.area
    ? getInteractionScale(dragState.source.area)
    : desktopScale
  const itemPopoverScale = itemActionPopover?.area
    ? getInteractionScale(itemActionPopover.area)
    : desktopScale
  const feedbackScale = isMobileLayout ? 1 : desktopScale
  const itemPopoverActions = useMemo(
    () => [
      {
        label: "Use",
        disabled: !canUsePopoverItem,
        onClick: handleUseSelectedItem,
      },
      {
        label: "Split",
        disabled: !canSplitPopoverItem,
        onClick: handleSplitSelectedItem,
      },
      {
        label: "Throw",
        disabled: !canThrowPopoverItem,
        danger: true,
        onClick: handleThrowSelectedItem,
      },
      {
        label: "Cancel",
        disabled: false,
        onClick: closeItemActionPopover,
      },
    ],
    [
      canSplitPopoverItem,
      canThrowPopoverItem,
      canUsePopoverItem,
      closeItemActionPopover,
      handleSplitSelectedItem,
      handleThrowSelectedItem,
      handleUseSelectedItem,
    ]
  )

  const dragPreview = useMemo(() => {
    if (!draggedStack?.itemId || !dragState) return null

    return (
      <div
        className="inventory-ui-drag-preview"
        style={{
          left: `${dragState.x}px`,
          top: `${dragState.y}px`,
          transform: `translate(-50%, -50%) scale(${dragPreviewScale})`,
          zIndex: POPIN_Z_INDEX + 1,
        }}
      >
        <ItemVisual itemId={draggedStack.itemId} size={24} emojiSize={22} />
        {draggedStack.quantity > 1 && (
          <span className="inventory-ui-slot__quantity">
            {draggedStack.quantity}
          </span>
        )}
      </div>
    )
  }, [dragPreviewScale, dragState, draggedStack])

  if (!open) return null

  return (
    <>
      <MenuBackdrop
        open
        zIndex={OVERLAY_Z_INDEX}
        aria-hidden="true"
        style={{ transition: "none" }}
        onPointerDown={(event) => {
          event.stopPropagation()
          onClose?.()
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        data-inventory-panel="true"
        className={[
          "inventory-panel-shell",
          "hud-ui-text-scope",
          isMobileLayout ? "inventory-panel-shell--mobile" : null,
        ].filter(Boolean).join(" ")}
        onPointerDown={(event) => {
          event.stopPropagation()

          if (!(event.target instanceof Element)) return
          if (event.target.closest("[data-item-action-popover]")) return
          if (event.target.closest("[data-inventory-slot]")) return

          closeItemActionPopover()
        }}
        style={{
          zIndex: POPIN_Z_INDEX,
        }}
      >
        {isMobileLayout ? (
          <InventoryPanelMobile
            unlockedSlotCount={unlockedSlotCount}
            mainUnlockedCount={mainUnlockedCount}
            walletSol={walletSol}
            mainSlots={mainSlots}
            usableSlots={usableSlots}
            craftSlots={craftSlots}
            craftResult={craftResult}
            craftPreviewSlots={craftPreviewSlots}
            selectedSlotKey={selectedSlotKey}
            dragSourceKey={dragSourceKey}
            dropTargetKey={dropTargetKey}
            hoverPreviewRecipeId={hoverPreviewRecipeId}
            panelScale={mobilePanelScale}
            actionScale={mobileActionScale}
            onClose={onClose}
            onSlotPointerDown={handleSlotPointerDown}
            onCraftResultClick={handleCraftResultClick}
            onHoverRecipe={handleHoverRecipePreview}
            onLeaveRecipe={handleClearHoverRecipePreview}
            onCraftRecipe={handleCraftRecipeById}
            getStackLabel={getStackLabel}
            renderLockedOverlay={renderLockedOverlay}
            onStorageSlotContextMenu={handleStorageSlotContextMenu}
          />
        ) : (
          <InventoryPanelDesktop
            unlockedSlotCount={unlockedSlotCount}
            mainUnlockedCount={mainUnlockedCount}
            walletSol={walletSol}
            mainSlots={mainSlots}
            usableSlots={usableSlots}
            craftSlots={craftSlots}
            craftResult={craftResult}
            craftPreviewSlots={craftPreviewSlots}
            selectedSlotKey={selectedSlotKey}
            dragSourceKey={dragSourceKey}
            dropTargetKey={dropTargetKey}
            hoverPreviewRecipeId={hoverPreviewRecipeId}
            layoutScale={desktopScale}
            onClose={onClose}
            onSlotPointerDown={handleSlotPointerDown}
            onCraftResultClick={handleCraftResultClick}
            onHoverRecipe={handleHoverRecipePreview}
            onLeaveRecipe={handleClearHoverRecipePreview}
            onCraftRecipe={handleCraftRecipeById}
            getStackLabel={getStackLabel}
            renderLockedOverlay={renderLockedOverlay}
            onStorageSlotContextMenu={handleStorageSlotContextMenu}
          />
        )}
      </div>

      {itemActionPopover?.anchorRect && actionPopoverStack?.itemId ? (
        <PixelAnchoredPopover
          anchorRect={itemActionPopover.anchorRect}
          scale={itemPopoverScale}
          actions={itemPopoverActions}
          onClose={closeItemActionPopover}
          zIndex={POPIN_Z_INDEX + 2}
          header={
            <div className="inventory-item-popover__header">
              <ItemVisual itemId={actionPopoverStack.itemId} size={16} emojiSize={14} />
              <div className="inventory-item-popover__details">
                <strong className="inventory-item-popover__name">
                  {actionPopoverItemDefinition?.name || actionPopoverStack.itemId}
                </strong>
                <span className="inventory-item-popover__meta">
                  {`Qty ${actionPopoverStack.quantity}`}
                </span>
              </div>
            </div>
          }
        >
          {canEquipPopoverItem ? (
            <>
              <span className="inventory-item-popover__section-label">
                Equip to slot
              </span>
              <div className="inventory-item-popover__equip-list">
                {usableSlots.map((slotStack, slotIndex) => (
                  <button
                    key={slotIndex}
                    type="button"
                    className="inventory-item-popover__equip-action"
                    onClick={() => handleEquipPopoverItem(slotIndex)}
                    title={
                      slotStack?.itemId
                        ? `Replace ${slotStack.itemId}`
                        : `Slot ${slotIndex + 1}`
                    }
                  >
                    {`Slot ${slotIndex + 1}`}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </PixelAnchoredPopover>
      ) : null}

      {actionFeedback ? (
        <div
          className="inventory-ui-feedback-toast"
          style={{
            transform: `translateX(-50%) scale(${feedbackScale})`,
            zIndex: POPIN_Z_INDEX + 3,
          }}
        >
          {actionFeedback}
        </div>
      ) : null}

      {dragPreview}
    </>
  )
}
