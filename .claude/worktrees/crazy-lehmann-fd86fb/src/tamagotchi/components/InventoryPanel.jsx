import React, { useCallback, useEffect, useMemo, useState } from "react"
import inventoryFrame from "../../hud/inventory.webp"
import { INVENTORY_LAYOUT, getInventorySlotStyle } from "../config/inventoryLayout"
import { useInventoryStore } from "../store/useInventoryStore"
import InventorySlot from "./InventorySlot"
import CraftGrid from "./CraftGrid"
import ItemVisual from "./ItemVisual"

const PANEL_WIDTH = "min(340px, calc(100vw - 24px))" // Tweak inventory panel width here.
const PANEL_BOTTOM = "124px" // Tweak inventory panel vertical position here.

function parseSlotKey(slotKey) {
  if (!slotKey) return null
  const [area, rawIndex] = slotKey.split(":")
  const index = Number(rawIndex)
  if (Number.isNaN(index)) return null

  return { area, index }
}

export default function InventoryPanel({ open }) {
  const mainSlots = useInventoryStore((state) => state.mainSlots)
  const usableSlots = useInventoryStore((state) => state.usableSlots)
  const craftSlots = useInventoryStore((state) => state.craftSlots)
  const craftResult = useInventoryStore((state) => state.craftResult)
  const craftCurrentRecipe = useInventoryStore((state) => state.craftCurrentRecipe)
  const moveItem = useInventoryStore((state) => state.moveItem)
  const lastInventoryError = useInventoryStore((state) => state.lastInventoryError)

  const [dragState, setDragState] = useState(null)

  const dragSourceKey = dragState?.sourceKey || null
  const dropTargetKey = dragState?.targetKey || null

  const handlePointerMove = useCallback((event) => {
    setDragState((current) => {
      if (!current) return current

      const hovered = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest("[data-slot-key]")

      return {
        ...current,
        x: event.clientX,
        y: event.clientY,
        targetKey: hovered?.dataset?.slotKey || null,
      }
    })
  }, [])

  const handlePointerEnd = useCallback(
    (event) => {
      setDragState((current) => {
        if (!current) return current

        const hovered = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest("[data-slot-key]")
        const target = parseSlotKey(hovered?.dataset?.slotKey || current.targetKey)

        if (
          target &&
          target.area !== "result" &&
          (target.area !== current.source.area || target.index !== current.source.index)
        ) {
          moveItem(current.source, target)
        }

        return null
      })
    },
    [moveItem]
  )

  useEffect(() => {
    if (!dragState) return undefined

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerEnd)
    window.addEventListener("pointercancel", handlePointerEnd)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerEnd)
      window.removeEventListener("pointercancel", handlePointerEnd)
    }
  }, [dragState, handlePointerEnd, handlePointerMove])

  useEffect(() => {
    if (!open) {
      setDragState(null)
    }
  }, [open])

  const handleSlotPointerDown = useCallback((event, area, index, stack) => {
    if (!stack?.itemId) return

    event.preventDefault()
    event.stopPropagation()

    setDragState({
      source: { area, index },
      sourceKey: `${area}:${index}`,
      targetKey: null,
      stack,
      x: event.clientX,
      y: event.clientY,
    })
  }, [])

  const draggedStack = dragState?.stack || null

  const dragPreview = useMemo(() => {
    if (!draggedStack?.itemId) return null

    return (
      <div
        style={{
          position: "fixed",
          left: `${dragState.x}px`,
          top: `${dragState.y}px`,
          width: "42px",
          height: "42px",
          transform: "translate(-50%, -50%)",
          borderRadius: "10px",
          background: "rgba(18, 18, 18, 0.92)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.14)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 1000003,
        }}
      >
        <ItemVisual itemId={draggedStack.itemId} size={24} emojiSize={22} />
        {draggedStack.quantity > 1 && (
          <span
            style={{
              position: "absolute",
              right: "3px",
              bottom: "2px",
              minWidth: "14px",
              height: "14px",
              padding: "0 2px",
              fontSize: "9px",
              fontWeight: 700,
              color: "#fff",
              background: "rgba(0,0,0,0.7)",
              borderRadius: "4px",
            }}
          >
            {draggedStack.quantity}
          </span>
        )}
      </div>
    )
  }, [dragState, draggedStack])

  if (!open) return null

  return (
    <>
      <div
        style={{
          position: "fixed",
          left: "50%",
          bottom: PANEL_BOTTOM,
          width: PANEL_WIDTH,
          aspectRatio: `${INVENTORY_LAYOUT.canvasWidth} / ${INVENTORY_LAYOUT.canvasHeight}`,
          transform: "translateX(-50%)",
          zIndex: 1000002,
          pointerEvents: "auto",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
          }}
        >
          <img
            src={inventoryFrame}
            alt="Inventory"
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              imageRendering: "pixelated",
              pointerEvents: "none",
            }}
          />

          {mainSlots.map((stack, index) => {
            const slotKey = `main:${index}`

            return (
              <InventorySlot
                key={slotKey}
                slotKey={slotKey}
                stack={stack}
                style={getInventorySlotStyle("main", index)}
                isDragSource={dragSourceKey === slotKey}
                isDropTarget={dropTargetKey === slotKey}
                onPointerDown={(event) => handleSlotPointerDown(event, "main", index, stack)}
              />
            )
          })}

          {usableSlots.map((stack, index) => {
            const slotKey = `usable:${index}`

            return (
              <InventorySlot
                key={slotKey}
                slotKey={slotKey}
                stack={stack}
                style={getInventorySlotStyle("usable", index)}
                isDragSource={dragSourceKey === slotKey}
                isDropTarget={dropTargetKey === slotKey}
                onPointerDown={(event) => handleSlotPointerDown(event, "usable", index, stack)}
              />
            )
          })}

          <CraftGrid
            craftSlots={craftSlots}
            craftResult={craftResult}
            dragSourceKey={dragSourceKey}
            dropTargetKey={dropTargetKey}
            onSlotPointerDown={handleSlotPointerDown}
            onResultClick={() => {
              craftCurrentRecipe()
            }}
          />

          {lastInventoryError === "inventory_full" && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                padding: "6px 8px",
                borderRadius: "8px",
                background: "rgba(0,0,0,0.72)",
                color: "#fff",
                fontSize: "11px",
                letterSpacing: "0.04em",
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}
            >
              Inventory full
            </div>
          )}
        </div>
      </div>

      {dragPreview}
    </>
  )
}
