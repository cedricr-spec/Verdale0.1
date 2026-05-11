import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import CTA_DEFAULT from "../../hud/CTAs/CTA_Small_8BIT.png"
import CTA_PRESSED from "../../hud/CTAs/CTA_Small_8BIT_Pressed.png"
import gameplaySlotDefault from "../../hud/inventories/player/PlayerActionUniqueSlot_Default.png"
import gameplaySlotPressed from "../../hud/inventories/player/PlayerActionUniqueSlot_Pressed.png"
import bagIcon from "../../spritesheets/items_spritesheet/bagicon.png"
import questIcon from "../../spritesheets/items_spritesheet/questicon.png"
import { usePetStore as useStore } from "../store/usePetStore"
import { useInventoryStore } from "../store/useInventoryStore"
import { getItemDefinition } from "../config/itemsRegistry"
import InventorySlot from "./InventorySlot"

const SLOT_KEYS = ["a", "z", "e", "r", "t"]
const INVENTORY_ICON_IDLE_OFFSET_Y = -2
const MENU_BUTTON_SIZE = 56
const GAMEPLAY_SLOT_SIZE = 52
const GAMEPLAY_SLOT_GAP = 4
const GAMEPLAY_SLOT_COUNT = 5
const GAMEPLAY_ACTION_BAR_WIDTH =
  GAMEPLAY_SLOT_COUNT * GAMEPLAY_SLOT_SIZE + (GAMEPLAY_SLOT_COUNT - 1) * GAMEPLAY_SLOT_GAP

export default function LineMenu({
  onHover,
  onInventoryToggle,
  inventoryOpen = false,
  onQuestToggle,
  questOpen = false,
  centerContent = null,
}) {
  const applyEffects = useStore((s) => s.applyEffects)
  const theme = useStore((s) => s.theme)
  const color = theme?.modelColor || "#8f8f8f"
  const usableSlots = useInventoryStore((s) => s.usableSlots)
  const consumeSlotItem = useInventoryStore((s) => s.consumeSlotItem)
  const setActiveUsableSlotIndex = useInventoryStore((s) => s.setActiveUsableSlotIndex)
  const gameplayViewportRef = useRef(null)
  const [pressedKey, setPressedKey] = useState(null)
  const [pressedSlotKey, setPressedSlotKey] = useState(null)
  const [gameplayBarOverflowing, setGameplayBarOverflowing] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.repeat) return

      const slotIndex = SLOT_KEYS.indexOf(event.key.toLowerCase())
      if (slotIndex === -1) return
      if (!usableSlots[slotIndex]?.itemId) return
      setActiveUsableSlotIndex(slotIndex)
      setPressedSlotKey(`usable:${slotIndex}`)
    }

    const handleKeyUp = (event) => {
      const slotIndex = SLOT_KEYS.indexOf(event.key.toLowerCase())
      if (slotIndex === -1) return
      setPressedSlotKey((currentKey) =>
        currentKey === `usable:${slotIndex}` ? null : currentKey
      )
    }

    const clearPressedSlot = () => {
      setPressedSlotKey(null)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("blur", clearPressedSlot)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("blur", clearPressedSlot)
    }
  }, [usableSlots])

  useEffect(() => {
    if (!pressedSlotKey) return

    const [, rawIndex] = pressedSlotKey.split(":")
    const slotIndex = Number(rawIndex)
    if (Number.isNaN(slotIndex) || !usableSlots[slotIndex]?.itemId) {
      setPressedSlotKey(null)
    }
  }, [pressedSlotKey, usableSlots])

  useLayoutEffect(() => {
    const viewport = gameplayViewportRef.current
    if (!viewport) return undefined

    const updateOverflowState = () => {
      const nextOverflowing = viewport.clientWidth < GAMEPLAY_ACTION_BAR_WIDTH
      setGameplayBarOverflowing(nextOverflowing)

      if (!nextOverflowing && viewport.scrollLeft !== 0) {
        viewport.scrollLeft = 0
      }
    }

    updateOverflowState()

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateOverflowState)
        : null
    resizeObserver?.observe(viewport)
    window.addEventListener("resize", updateOverflowState)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener("resize", updateOverflowState)
    }
  }, [])

  const renderMenuButton = ({
    buttonKey,
    isDisabled = false,
    onClick,
    onHoverEnter,
    onHoverLeave,
    content,
    extraStyle,
  }) => {
    const isPressed = pressedKey === buttonKey
    const ctaImage = isPressed ? CTA_PRESSED : CTA_DEFAULT

    return (
      <div
        key={buttonKey}
        style={{
          width: `${MENU_BUTTON_SIZE}px`,
          height: `${MENU_BUTTON_SIZE}px`,
          position: "relative",
          pointerEvents: "auto",
          flex: "0 0 auto",
          ...extraStyle,
        }}
      >
        <div
          onClick={() => {
            if (isDisabled) return
            onClick?.()
          }}
          onPointerEnter={(event) => {
            if (isDisabled) return
            if (event.pointerType === "touch") return
            onHoverEnter?.()
          }}
          onPointerLeave={() => {
            onHoverLeave?.()
            setPressedKey(null)
          }}
          onPointerDown={() => {
            if (isDisabled) return
            setPressedKey(buttonKey)
          }}
          onPointerUp={() => {
            if (isDisabled) return
            setPressedKey(null)
          }}
          onPointerCancel={() => {
            setPressedKey(null)
          }}
          onLostPointerCapture={() => {
            setPressedKey(null)
          }}
          onTouchEnd={() => {
            setPressedKey(null)
          }}
          onBlur={() => {
            setPressedKey(null)
          }}
          style={{
            cursor: isDisabled ? "default" : "pointer",
            position: "relative",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            touchAction: "manipulation",
          }}
        >
          <img
            src={ctaImage}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              imageRendering: "pixelated",
              display: "block",
              opacity: isDisabled ? 0.55 : 1,
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: color,
              mixBlendMode: "color",
              pointerEvents: "none",
              opacity: isDisabled ? 0.55 : 1,
              WebkitMaskImage: `url(${ctaImage})`,
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              WebkitMaskSize: "contain",
              maskImage: `url(${ctaImage})`,
              maskRepeat: "no-repeat",
              maskPosition: "center",
              maskSize: "contain",
            }}
          />

          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="gameplay-hud-row">
      <div className="gameplay-hud-row__left">
        <div
          ref={gameplayViewportRef}
          className="gameplay-action-bar-viewport"
          style={{
            overflowX: gameplayBarOverflowing ? "auto" : "hidden",
            touchAction: gameplayBarOverflowing ? "pan-x" : "manipulation",
          }}
        >
          <div
            className="gameplay-action-bar-track"
            style={{
              gap: `${GAMEPLAY_SLOT_GAP}px`,
              width: `${GAMEPLAY_ACTION_BAR_WIDTH}px`,
              minWidth: `${GAMEPLAY_ACTION_BAR_WIDTH}px`,
            }}
          >
            {usableSlots.map((stack, index) => {
              const itemId = stack?.itemId || null
              const definition = itemId ? getItemDefinition(itemId) : null
              const slotKey = `usable:${index}`
              const isSelected = pressedSlotKey === slotKey
              const isDisabled = !stack || !definition?.usable

              return (
                <InventorySlot
                  key={slotKey}
                  slotKey={slotKey}
                  stack={stack}
                  title={
                    itemId
                      ? `${definition?.name || itemId} x${Math.max(0, Number(stack?.quantity) || 0)}`
                      : `Action slot ${index + 1}`
                  }
                  style={{
                    position: "relative",
                    width: `${GAMEPLAY_SLOT_SIZE}px`,
                    height: `${GAMEPLAY_SLOT_SIZE}px`,
                    flex: `0 0 ${GAMEPLAY_SLOT_SIZE}px`,
                  }}
                  iconSize={GAMEPLAY_SLOT_SIZE - 12}
                  slotClassName="inventory-ui-slot--mobile-skin gameplay-action-slot"
                  slotSkinSrc={isSelected ? gameplaySlotPressed : gameplaySlotDefault}
                  touchAction="manipulation"
                  isDisabled={isDisabled}
                  onPointerDown={() => {
                    if (isDisabled) return
                    setPressedSlotKey(slotKey)
                  }}
                  onClick={() => {
                    if (!stack || !definition?.usable) return

                    if (definition.useEffects && applyEffects) {
                      applyEffects(definition.useEffects)
                      consumeSlotItem("usable", index, 1)
                      return
                    }

                    if (!definition.equipable) return

                    setActiveUsableSlotIndex(index)

                    const hotkey = SLOT_KEYS[index]
                    if (!hotkey) return

                    window.dispatchEvent(
                      new KeyboardEvent("keydown", { key: hotkey, bubbles: true })
                    )
                  }}
                  onPointerEnter={() => {
                    if (!onHover || !stack?.itemId) return
                    onHover(definition || null)
                  }}
                  onPointerLeave={() => {
                    setPressedSlotKey(null)
                    onHover?.(null)
                  }}
                  onPointerUp={() => {
                    setPressedSlotKey(null)
                  }}
                  onPointerCancel={() => {
                    setPressedSlotKey(null)
                  }}
                  onTouchEnd={() => {
                    setPressedSlotKey(null)
                  }}
                  onBlur={() => {
                    setPressedSlotKey(null)
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="gameplay-hud-row__center">
        {centerContent}
      </div>

      <div className="gameplay-hud-row__right">
        {renderMenuButton({
          buttonKey: "inventory",
          onClick: () => {
            onHover?.(null)
            onInventoryToggle?.()
          },
          content: (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                zIndex: 1,
                opacity: inventoryOpen ? 0.92 : 1,
              }}
            >
              <img
                src={bagIcon}
                alt=""
                style={{
                  width: "30px",
                  height: "30px",
                  objectFit: "contain",
                  imageRendering: "pixelated",
                  display: "block",
                  transform: `translateY(${pressedKey === "inventory" ? 0 : INVENTORY_ICON_IDLE_OFFSET_Y}px)`,
                  pointerEvents: "none",
                }}
              />
            </div>
          ),
        })}

        {renderMenuButton({
          buttonKey: "quest",
          onClick: () => {
            onHover?.(null)
            onQuestToggle?.()
          },
          content: (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                zIndex: 1,
                opacity: questOpen ? 0.92 : 1,
              }}
            >
              <img
                src={questIcon}
                alt=""
                style={{
                  width: "30px",
                  height: "30px",
                  objectFit: "contain",
                  imageRendering: "pixelated",
                  pointerEvents: "none",
                  transform: `translateY(${pressedKey === "quest" ? 0 : INVENTORY_ICON_IDLE_OFFSET_Y}px)`,
                  display: "block",
                }}
              />
            </div>
          ),
        })}
      </div>
    </div>
  )
}
