import React, { useEffect, useMemo } from "react"
import popoverBottomSkin from "../../hud/inventories/inventory_actions/Popover_bottom.png"
import popoverLeftSkin from "../../hud/inventories/inventory_actions/Popover_left.png"
import popoverRightSkin from "../../hud/inventories/inventory_actions/Popover_right.png"
import popoverTopSkin from "../../hud/inventories/inventory_actions/Popover_top.png"

const POPOVER_SAFE_PADDING = 12
const POPOVER_GAP = 6
const POPOVER_BASE_PADDING = 8
const POPOVER_POINTER_PADDING = 24

const POPOVER_CONTENT_PADDING = {
  top: { top: POPOVER_POINTER_PADDING, right: POPOVER_BASE_PADDING, bottom: POPOVER_BASE_PADDING, left: POPOVER_BASE_PADDING },
  right: { top: POPOVER_BASE_PADDING, right: POPOVER_POINTER_PADDING, bottom: POPOVER_BASE_PADDING, left: POPOVER_BASE_PADDING },
  bottom: { top: POPOVER_BASE_PADDING, right: POPOVER_BASE_PADDING, bottom: POPOVER_POINTER_PADDING, left: POPOVER_BASE_PADDING },
  left: { top: POPOVER_BASE_PADDING, right: POPOVER_BASE_PADDING, bottom: POPOVER_BASE_PADDING, left: POPOVER_POINTER_PADDING },
}

const POPOVER_LAYOUTS = {
  left: {
    skin: popoverLeftSkin,
    width: 96,
    height: 80,
    transformOrigin: "top left",
    pointerTip: { x: 0, y: 40 },
  },
  right: {
    skin: popoverRightSkin,
    width: 96,
    height: 80,
    transformOrigin: "top left",
    pointerTip: { x: 96, y: 40 },
  },
  top: {
    skin: popoverTopSkin,
    width: 80,
    height: 96,
    transformOrigin: "top left",
    pointerTip: { x: 40, y: 0 },
  },
  bottom: {
    skin: popoverBottomSkin,
    width: 80,
    height: 96,
    transformOrigin: "top left",
    pointerTip: { x: 40, y: 96 },
  },
}

function clamp(value, min, max) {
  if (min > max) return min
  return Math.min(Math.max(value, min), max)
}

function getOverflowScore(left, top, width, height, safePadding) {
  const right = left + width
  const bottom = top + height

  return (
    Math.max(0, safePadding - left) +
    Math.max(0, safePadding - top) +
    Math.max(0, right - (window.innerWidth - safePadding)) +
    Math.max(0, bottom - (window.innerHeight - safePadding))
  )
}

function createCandidate(placement, pointerSide, anchorRect, scale) {
  const layout = POPOVER_LAYOUTS[pointerSide]
  const scaledWidth = layout.width * scale
  const scaledHeight = layout.height * scale
  const anchorCenterX = anchorRect.left + anchorRect.width / 2
  const anchorCenterY = anchorRect.top + anchorRect.height / 2
  let left = anchorCenterX - layout.pointerTip.x * scale
  let top = anchorCenterY - layout.pointerTip.y * scale

  if (pointerSide === "left") {
    left += POPOVER_GAP * scale
  } else if (pointerSide === "right") {
    left -= POPOVER_GAP * scale
  } else if (pointerSide === "top") {
    top += POPOVER_GAP * scale
  } else if (pointerSide === "bottom") {
    top -= POPOVER_GAP * scale
  }

  return {
    placement,
    pointerSide,
    layout,
    scaledWidth,
    scaledHeight,
    rawLeft: left,
    rawTop: top,
    overflowScore: getOverflowScore(left, top, scaledWidth, scaledHeight, POPOVER_SAFE_PADDING),
  }
}

function resolvePopoverPlacement(anchorRect, scale) {
  const candidates = [
    createCandidate("right", "left", anchorRect, scale),
    createCandidate("left", "right", anchorRect, scale),
    createCandidate("bottom", "top", anchorRect, scale),
    createCandidate("top", "bottom", anchorRect, scale),
  ]

  const preferred =
    candidates.find((candidate) => candidate.overflowScore === 0) ||
    candidates.reduce((bestCandidate, candidate) =>
      candidate.overflowScore < bestCandidate.overflowScore ? candidate : bestCandidate
    )

  const clampedLeft = clamp(
    preferred.rawLeft,
    POPOVER_SAFE_PADDING,
    window.innerWidth - preferred.scaledWidth - POPOVER_SAFE_PADDING
  )
  const clampedTop = clamp(
    preferred.rawTop,
    POPOVER_SAFE_PADDING,
    window.innerHeight - preferred.scaledHeight - POPOVER_SAFE_PADDING
  )

  return {
    placement: preferred.placement,
    pointerSide: preferred.pointerSide,
    layout: preferred.layout,
    left: clampedLeft,
    top: clampedTop,
  }
}

function PixelAnchoredPopover({
  anchorRect,
  scale = 1,
  header = null,
  actions = [],
  children = null,
  onClose,
  className = "",
  zIndex,
}) {
  const resolvedPopover = useMemo(() => {
    if (!anchorRect) return null
    return resolvePopoverPlacement(anchorRect, scale)
  }, [anchorRect, scale])

  useEffect(() => {
    if (typeof onClose !== "function") return undefined

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return
      onClose()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  if (!resolvedPopover) return null

  const { placement, pointerSide, layout, left, top } = resolvedPopover
  const contentPadding = POPOVER_CONTENT_PADDING[pointerSide]

  return (
    <div
      data-item-action-popover="true"
      className={[
        "pixel-anchored-popover",
        `pixel-anchored-popover--${placement}`,
        `pixel-anchored-popover--pointer-${pointerSide}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${layout.width}px`,
        height: `${layout.height}px`,
        transform: `scale(${scale})`,
        transformOrigin: layout.transformOrigin,
        zIndex,
      }}
    >
      <img
        src={layout.skin}
        alt=""
        aria-hidden="true"
        className="pixel-anchored-popover__skin"
      />

      <div
        className="pixel-anchored-popover__content"
        style={{
          left: `${contentPadding.left}px`,
          top: `${contentPadding.top}px`,
          right: `${contentPadding.right}px`,
          bottom: `${contentPadding.bottom}px`,
        }}
      >
        <div className="pixel-anchored-popover__scroll">
          {header ? (
            <div className="pixel-anchored-popover__header">
              {header}
            </div>
          ) : null}

          {actions.length ? (
            <div className="pixel-anchored-popover__actions">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className={[
                    "pixel-anchored-popover__action",
                    action.danger ? "pixel-anchored-popover__action--danger" : null,
                    action.disabled ? "pixel-anchored-popover__action--disabled" : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={action.disabled}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}

          {children ? (
            <div className="pixel-anchored-popover__section">
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default React.memo(PixelAnchoredPopover)
