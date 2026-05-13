import React from "react"
import ItemVisual from "./ItemVisual"
import SelectionHelper from "./SelectionHelper"

export default function InventorySlot({
  slotKey,
  slotType = "storage",
  stack,
  displayStack = stack,
  style,
  title,
  iconSize: explicitIconSize,
  slotClassName,
  slotSkinSrc = null,
  touchAction = "none",
  isDragSource = false,
  isDropTarget = false,
  isSelected = false,
  isDisabled = false,
  isPreview = false,
  isPreviewMissing = false,
  isPreviewCovered = false,
  cursor,
  onPointerDown,
  onClick,
  children,
  ...buttonProps
}) {
  const hasRealItem = Boolean(stack?.itemId)
  const hasDisplayItem = Boolean(displayStack?.itemId)
  const isResult = slotType === "result"
  const fallbackSlotSize =
    typeof style?.width === "number"
      ? style.width
      : Number.parseFloat(style?.width || "") || 24
  const iconSize = explicitIconSize ?? Math.max(16, fallbackSlotSize - 8 || 24)
  const className = [
    "inventory-ui-slot",
    slotClassName,
    isResult ? "inventory-ui-slot--result" : null,
    isDragSource ? "inventory-ui-slot--drag-source" : null,
    isDropTarget ? "inventory-ui-slot--drop-target" : null,
    isSelected ? "inventory-ui-slot--selected" : null,
    isDisabled ? "inventory-ui-slot--disabled" : null,
    isPreview ? "inventory-ui-slot--preview" : null,
    isPreviewMissing ? "inventory-ui-slot--preview-missing" : null,
    isPreviewCovered ? "inventory-ui-slot--preview-covered" : null,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <button
      type="button"
      title={title}
      className={className}
      data-inventory-slot="true"
      data-slot-key={slotKey}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onContextMenu={(event) => event.preventDefault()}
      aria-disabled={isDisabled}
      {...buttonProps}
      style={{
        ...style,
        border: "none",
        outline: "none",
        padding: 0,
        margin: 0,
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: style?.position || "absolute",
        cursor:
          cursor ||
          (isDisabled ? "not-allowed" : hasRealItem ? "grab" : isResult ? "pointer" : "default"),
        touchAction,
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTapHighlightColor: "transparent",
        boxSizing: "border-box",
      }}
    >
      {slotSkinSrc ? (
        <img
          src={slotSkinSrc}
          alt=""
          aria-hidden="true"
          className="inventory-ui-slot__skin"
        />
      ) : null}

      {hasDisplayItem && (
        <>
          <ItemVisual
            itemId={displayStack.itemId}
            variant={isResult ? "inventory" : "inventory"}
            size={iconSize}
            emojiSize={Math.max(14, iconSize - 2)}
          />

          {displayStack.quantity > 1 && (
            <span className="inventory-ui-slot__quantity">
              {displayStack.quantity}
            </span>
          )}
        </>
      )}

      {isSelected && <SelectionHelper size={fallbackSlotSize + 8} zIndex={4} />}

      {children}
    </button>
  )
}
