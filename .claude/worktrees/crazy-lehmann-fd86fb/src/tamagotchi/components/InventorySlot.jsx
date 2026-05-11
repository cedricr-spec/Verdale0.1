import React from "react"
import ItemVisual from "./ItemVisual"

export default function InventorySlot({
  slotKey,
  slotType = "storage",
  stack,
  style,
  isDragSource = false,
  isDropTarget = false,
  isDisabled = false,
  onPointerDown,
  onClick,
}) {
  const hasItem = Boolean(stack?.itemId)
  const isResult = slotType === "result"

  return (
    <button
      type="button"
      data-inventory-slot="true"
      data-slot-key={slotKey}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onContextMenu={(event) => event.preventDefault()}
      style={{
        ...style,
        border: "none",
        outline: "none",
        padding: 0,
        margin: 0,
        background: isResult
          ? "rgba(255, 227, 130, 0.12)"
          : "rgba(255, 255, 255, 0.04)",
        boxShadow: isDropTarget
          ? "0 0 0 2px rgba(255,255,255,0.7) inset"
          : "0 0 0 1px rgba(255,255,255,0.18) inset",
        borderRadius: "6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "absolute",
        cursor: hasItem && !isDisabled ? "grab" : isResult ? "pointer" : "default",
        opacity: isDragSource ? 0.35 : 1,
        transition: "box-shadow 0.14s ease, background 0.14s ease, opacity 0.14s ease",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {hasItem && (
        <>
          <ItemVisual
            itemId={stack.itemId}
            variant={isResult ? "inventory" : "inventory"}
            size={24}
            emojiSize={22}
          />

          {stack.quantity > 1 && (
            <span
              style={{
                position: "absolute",
                right: "3px",
                bottom: "2px",
                minWidth: "14px",
                height: "14px",
                padding: "0 2px",
                fontSize: "9px",
                lineHeight: 1,
                fontWeight: 700,
                color: "#ffffff",
                background: "rgba(0,0,0,0.7)",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              {stack.quantity}
            </span>
          )}
        </>
      )}
    </button>
  )
}
