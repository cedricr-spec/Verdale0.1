import React, { useLayoutEffect, useRef, useState } from "react"
import playerActionsSlotsSkin from "../../hud/inventories/player/PlayerActionsSlots.png"
import playerInventoryMobileSlotSkin from "../../hud/inventories/player/PlayerInventoryMobileSlot.png"
import playerActionSlotDefaultSkin from "../../hud/inventories/player/PlayerActionUniqueSlot_Default.png"
import playerActionSlotPressedSkin from "../../hud/inventories/player/PlayerActionUniqueSlot_Pressed.png"
import {
  PLAYER_INVENTORY_UI_LAYOUT,
  getInventorySlotRect,
  getInventorySlotStyle,
} from "../config/inventoryLayout"
import InventorySlot from "./InventorySlot"

const ACTION_PANEL = PLAYER_INVENTORY_UI_LAYOUT.actionSlots
const GAMEPLAY_SLOT_SIZE = 56
const GAMEPLAY_SLOT_GAP = 8

const AUX_SLOT_STYLE = {
  position: "absolute",
  left: "0px",
  top: "0px",
  width: `${ACTION_PANEL.slotSize}px`,
  height: `${ACTION_PANEL.slotSize}px`,
}

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ")
}

function ScaledPixelSurface({
  baseWidth,
  baseHeight,
  scale,
  className,
  style,
  children,
}) {
  const resolvedScale = scale || 1
  const scaledWidth = Math.round(baseWidth * resolvedScale)
  const scaledHeight = Math.round(baseHeight * resolvedScale)

  return (
    <div
      className={joinClassNames("action-slot-bar__surface-shell", className)}
      style={{
        width: `${scaledWidth}px`,
        height: `${scaledHeight}px`,
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        className="action-slot-bar__surface"
        style={{
          width: `${baseWidth}px`,
          height: `${baseHeight}px`,
          transform: `scale(${resolvedScale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

export default function ActionSlotBar({
  usableSlots,
  selectedSlotKey = null,
  dragSourceKey = null,
  dropTargetKey = null,
  getStackLabel,
  onUsableSlotPointerDown,
  onUsableSlotClick,
  onUsableSlotPointerEnter,
  onUsableSlotPointerLeave,
  slotClassName = "",
  auxiliaryButtons = [],
  mode = "embedded",
  scale = 1,
  className = "",
  style,
  usableSlotTouchAction,
  assetWindow = null,
  clampScroll = false,
}) {
  const viewportRef = useRef(null)
  const trackRef = useRef(null)
  const hasLoggedRef = useRef(false)
  const [isOverflowing, setIsOverflowing] = useState(false)

  const getUsableSlotStyle = (index) => {
    if (!assetWindow) return getInventorySlotStyle("usable", index)

    const rect = getInventorySlotRect("usable", index)
    if (!rect) return null

    return {
      position: "absolute",
      left: `${rect.left - assetWindow.offsetX}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    }
  }

  const renderUsableSlots = (touchActionOverride) =>
    usableSlots.map((stack, index) => {
      const slotKey = `usable:${index}`

      return (
        <InventorySlot
          key={slotKey}
          slotKey={slotKey}
          stack={stack}
          title={getStackLabel?.(stack) || `Action slot ${index + 1}`}
          style={getUsableSlotStyle(index)}
          touchAction={touchActionOverride}
          isSelected={selectedSlotKey === slotKey}
          isDragSource={dragSourceKey === slotKey}
          isDropTarget={dropTargetKey === slotKey}
          slotClassName={slotClassName}
          onPointerDown={
            onUsableSlotPointerDown
              ? (event) => onUsableSlotPointerDown(event, index, stack)
              : undefined
          }
          onClick={
            onUsableSlotClick ? () => onUsableSlotClick(index, stack) : undefined
          }
          onPointerEnter={
            onUsableSlotPointerEnter
              ? () => onUsableSlotPointerEnter(index, stack)
              : undefined
          }
          onPointerLeave={
            onUsableSlotPointerLeave
              ? () => onUsableSlotPointerLeave(index, stack)
              : undefined
          }
        />
      )
    })

  if (mode === "embedded") {
    return (
      <div
        className={joinClassNames("action-slot-bar", "action-slot-bar--embedded", className)}
        style={style}
      >
        <img
          src={playerActionsSlotsSkin}
          alt=""
          aria-hidden="true"
          className="inventory-ui-skin"
        />
        {renderUsableSlots(usableSlotTouchAction)}
      </div>
    )
  }

  if (mode === "gameplay") {
    const gameplayTrackWidth =
      usableSlots.length * GAMEPLAY_SLOT_SIZE +
      Math.max(0, usableSlots.length - 1) * GAMEPLAY_SLOT_GAP

    return (
      <div
        className={joinClassNames("action-slot-scroll", "action-slot-scroll--gameplay", className)}
        style={style}
      >
        <div
          ref={viewportRef}
          className="action-slot-scroll__viewport"
          style={{
            overflowX: "auto",
            overflowY: "hidden",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            touchAction: "pan-x",
          }}
        >
          <div
            ref={trackRef}
            className="action-slot-scroll__track action-slot-scroll__track--gameplay"
            style={{
              width: `${gameplayTrackWidth}px`,
              minWidth: `${gameplayTrackWidth}px`,
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: `${GAMEPLAY_SLOT_GAP}px`,
            }}
          >
            {usableSlots.map((stack, index) => {
              const slotKey = `usable:${index}`
              const isSelected = selectedSlotKey === slotKey

              return (
                <InventorySlot
                  key={slotKey}
                  slotKey={slotKey}
                  stack={stack}
                  title={getStackLabel?.(stack) || `Action slot ${index + 1}`}
                  style={{
                    position: "relative",
                    left: "auto",
                    top: "auto",
                    width: `${GAMEPLAY_SLOT_SIZE}px`,
                    minWidth: `${GAMEPLAY_SLOT_SIZE}px`,
                    maxWidth: `${GAMEPLAY_SLOT_SIZE}px`,
                    height: `${GAMEPLAY_SLOT_SIZE}px`,
                    minHeight: `${GAMEPLAY_SLOT_SIZE}px`,
                    maxHeight: `${GAMEPLAY_SLOT_SIZE}px`,
                    flex: `0 0 ${GAMEPLAY_SLOT_SIZE}px`,
                    transform: "none",
                  }}
                  touchAction={usableSlotTouchAction || "pan-x"}
                  isSelected={isSelected}
                  isDragSource={dragSourceKey === slotKey}
                  isDropTarget={dropTargetKey === slotKey}
                  slotSkinSrc={isSelected ? playerActionSlotPressedSkin : playerActionSlotDefaultSkin}
                  slotClassName={joinClassNames(
                    "inventory-ui-slot--mobile-skin",
                    "action-slot-bar__gameplay-slot",
                    slotClassName
                  )}
                  onPointerDown={
                    onUsableSlotPointerDown
                      ? (event) => onUsableSlotPointerDown(event, index, stack)
                      : undefined
                  }
                  onClick={
                    onUsableSlotClick ? () => onUsableSlotClick(index, stack) : undefined
                  }
                  onPointerEnter={
                    onUsableSlotPointerEnter
                      ? () => onUsableSlotPointerEnter(index, stack)
                      : undefined
                  }
                  onPointerLeave={
                    onUsableSlotPointerLeave
                      ? () => onUsableSlotPointerLeave(index, stack)
                      : undefined
                  }
                />
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const gameplayScale = mode === "gameplay" ? GAMEPLAY_SLOT_SIZE / ACTION_PANEL.slotSize : scale
  const trackGap = mode === "gameplay"
    ? GAMEPLAY_SLOT_GAP
    : Math.max(8, Math.round(scale * 8))
  const panelBaseWidth = assetWindow?.width || ACTION_PANEL.width
  const panelScaledWidth = Math.round(panelBaseWidth * gameplayScale)
  const auxScaledWidth = Math.round(ACTION_PANEL.slotSize * gameplayScale)
  const intendedTrackWidthPx =
    panelScaledWidth +
    auxiliaryButtons.length * auxScaledWidth +
    auxiliaryButtons.length * trackGap

  useLayoutEffect(() => {
    if (!clampScroll) return undefined

    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return undefined

    const clampToBounds = (shouldLog = false) => {
      const maxScroll = Math.max(0, intendedTrackWidthPx - viewport.clientWidth)
      if (viewport.scrollLeft > maxScroll) {
        viewport.scrollLeft = maxScroll
      }
      if (viewport.scrollLeft < 0) {
        viewport.scrollLeft = 0
      }
      setIsOverflowing(maxScroll > 0)

      if (import.meta.env.DEV && (shouldLog || !hasLoggedRef.current)) {
        const trackWidth = Math.round(track.getBoundingClientRect().width)
        console.log(
          `[ActionBar] viewportWidth=${viewport.clientWidth}, scrollWidth=${viewport.scrollWidth}, trackWidth=${trackWidth}, intendedWidth=${panelBaseWidth}`
        )
        hasLoggedRef.current = true
      }
    }

    clampToBounds(true)
    const handleScroll = () => clampToBounds(false)
    const handleResizeMeasure = () => clampToBounds(true)

    viewport.addEventListener("scroll", handleScroll, { passive: true })

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(handleResizeMeasure)
        : null
    resizeObserver?.observe(viewport)
    resizeObserver?.observe(track)
    window.addEventListener("resize", handleResizeMeasure)

    return () => {
      viewport.removeEventListener("scroll", handleScroll)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", handleResizeMeasure)
    }
  }, [clampScroll, intendedTrackWidthPx, panelBaseWidth])

  return (
    <div
      className={joinClassNames("action-slot-scroll", className)}
      style={{
        ...style,
        "--action-slot-scroll-fade-width": `${Math.max(18, Math.round(scale * 12))}px`,
      }}
    >
      <div
        className="action-slot-scroll__fade action-slot-scroll__fade--left"
        aria-hidden="true"
      />
      <div
        className="action-slot-scroll__fade action-slot-scroll__fade--right"
        aria-hidden="true"
      />

      <div
        ref={viewportRef}
        className="action-slot-scroll__viewport"
        style={
          clampScroll
            ? {
                overflowX: isOverflowing ? "auto" : "hidden",
                touchAction: isOverflowing ? "pan-x" : "manipulation",
              }
            : undefined
        }
      >
        <div
          ref={trackRef}
          className="action-slot-scroll__track"
          style={{
            gap: `${trackGap}px`,
            width: clampScroll ? `${intendedTrackWidthPx}px` : undefined,
            minWidth: clampScroll ? `${intendedTrackWidthPx}px` : undefined,
          }}
        >
          <ScaledPixelSurface
            baseWidth={assetWindow?.width || ACTION_PANEL.width}
            baseHeight={ACTION_PANEL.height}
            scale={gameplayScale}
            className="action-slot-bar action-slot-bar--scroll-panel"
          >
            {assetWindow ? (
              <img
                src={playerActionsSlotsSkin}
                alt=""
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 0,
                  left: `-${assetWindow.offsetX}px`,
                  width: `${ACTION_PANEL.width}px`,
                  height: "100%",
                  display: "block",
                  pointerEvents: "none",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  imageRendering: "pixelated",
                }}
              />
            ) : (
              <img
                src={playerActionsSlotsSkin}
                alt=""
                aria-hidden="true"
                className="inventory-ui-skin"
              />
            )}
            {renderUsableSlots(usableSlotTouchAction || "pan-x")}
          </ScaledPixelSurface>

          {auxiliaryButtons.map((button) => (
            <ScaledPixelSurface
              key={button.key}
              baseWidth={ACTION_PANEL.slotSize}
              baseHeight={ACTION_PANEL.slotSize}
              scale={gameplayScale}
              className="action-slot-scroll__aux-shell"
            >
              <InventorySlot
                slotKey={button.slotKey}
                title={button.title}
                style={AUX_SLOT_STYLE}
                slotSkinSrc={playerInventoryMobileSlotSkin}
                slotClassName={joinClassNames(
                  "inventory-ui-slot--mobile-skin",
                  "action-slot-scroll__aux-slot",
                  button.slotClassName
                )}
                touchAction={button.touchAction || "manipulation"}
                isSelected={button.isSelected}
                isDisabled={button.isDisabled}
                cursor={button.cursor || "pointer"}
                onClick={button.onClick}
              >
                {button.content}
              </InventorySlot>
            </ScaledPixelSurface>
          ))}
        </div>
      </div>
    </div>
  )
}
