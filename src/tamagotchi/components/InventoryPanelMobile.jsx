import React, { useEffect, useRef, useState } from "react"
import TintedCtaButton from "../../components/TintedCtaButton"
import closeButton from "../../hud/CTAs/CTA_Small_8BIT_Close.webp"
import closeButtonPressed from "../../hud/CTAs/CTA_Small_8BIT_Close_Pressed.webp"
import playerActionsSlotsSkin from "../../hud/inventories/player/PlayerActionsSlots.png"
import playerCraftMobileSkin from "../../hud/inventories/player/PlayerCraftMobile.png"
import playerInventoryMobileSkin from "../../hud/inventories/player/PlayerInventoryMobile.png"
import playerInventoryMobileReducedSkin from "../../hud/inventories/player/PlayerInventoryMobile_Reduced(<825px).png"
import playerInventoryMobileCompactSkin from "../../hud/inventories/player/PlayerInventoryMobile_Reduced(<750px).png"
import playerInventoryMobileSlotSkin from "../../hud/inventories/player/PlayerInventoryMobileSlot.png"
import playerRecipesMobileSkin from "../../hud/inventories/player/PlayerRecipesMobile.png"
import { PLAYER_INVENTORY_UI_LAYOUT, getInventorySlotStyle } from "../config/inventoryLayout"
import { getItemDefinition } from "../config/itemsRegistry"
import CurrencyDisplay from "./CurrencyDisplay"
import InventorySlot from "./InventorySlot"
import RecipePanel from "./RecipePanel"
import {
  INVENTORY_MAIN_SLOT_COUNT,
  INVENTORY_MAX_VISUAL_CAPACITY,
  isInventorySlotUnlocked,
} from "../store/useInventoryStore"
import { usePetStore } from "../store/usePetstore"

const MOBILE_RECIPES_PANEL = {
  width: 192,
  height: 48,
  list: {
    left: 8,
    top: 4,
    width: 181,
    height: 40,
  },
}

const MOBILE_CRAFT_PANEL = {
  width: 192,
  height: 112,
  grid: {
    x: 8,
    y: 8,
    columns: 3,
    rows: 3,
    slotSize: 32,
  },
  result: {
    x: 152,
    y: 40,
    size: 32,
  },
}

const MOBILE_INVENTORY_PANEL = {
  // 5 columns × 32px slots + 8px padding on each side
  width: 176,
  // 3 visible rows × 32px slots + 8px padding top/bottom
  height: 112,
  gridViewport: {
    left: 8,
    top: 8,
    width: 160,
    height: 96,
  },
  grid: {
    columns: 5,
    slotSize: 32,
  },
}

const MOBILE_INVENTORY_PANEL_REDUCED = {
  ...MOBILE_INVENTORY_PANEL,
  // 2 visible rows × 32px slots + 8px padding top/bottom
  height: 80,
  gridViewport: {
    ...MOBILE_INVENTORY_PANEL.gridViewport,
    height: 64,
  },
}

const MOBILE_INVENTORY_PANEL_COMPACT = {
  ...MOBILE_INVENTORY_PANEL,
  // 1.5 visible rows × 32px slots + 8px padding top/bottom
  height: 64,
  gridViewport: {
    ...MOBILE_INVENTORY_PANEL.gridViewport,
    height: 48,
  },
}

const ACTION_PANEL = PLAYER_INVENTORY_UI_LAYOUT.actionSlots
const MOBILE_SLOT_STYLE = {
  position: "relative",
  width: "32px",
  height: "32px",
}
const MOBILE_SECTION_GAP = 16
const MOBILE_LABEL_GAP = 2
const MOBILE_TITLE_ROW_HEIGHT = 20
const MOBILE_META_ROW_HEIGHT = 22
const MOBILE_CONTENT_MAX_WIDTH = 351
const CLOSE_BUTTON_SIZE = 52

function MobileScaledPanel({ baseWidth, baseHeight, scale, className = "", children }) {
  const scaledWidth = Math.round(baseWidth * scale)
  const scaledHeight = Math.round(baseHeight * scale)

  return (
    <div
      className={["inventory-mobile-panel", className].filter(Boolean).join(" ")}
      style={{
        width: `${scaledWidth}px`,
        height: `${scaledHeight}px`,
      }}
    >
      <div
        className="inventory-mobile-panel__surface"
        style={{
          width: `${baseWidth}px`,
          height: `${baseHeight}px`,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

function useSharedMobileScale(initialScale = 1) {
  const contentRef = useRef(null)
  const [layoutState, setLayoutState] = useState(() => ({
    contentWidth: MOBILE_RECIPES_PANEL.width * initialScale,
    mainScale: initialScale,
    actionPanelScale: Math.min(initialScale, MOBILE_RECIPES_PANEL.width / ACTION_PANEL.width),
  }))

  useEffect(() => {
    const element = contentRef.current
    if (!element || typeof window === "undefined") return undefined

    let frameId = 0
    const updateLayout = () => {
      frameId = 0
      const rawAvailableWidth = Math.max(1, element.clientWidth || MOBILE_RECIPES_PANEL.width)
      const availableWidth = Math.min(MOBILE_CONTENT_MAX_WIDTH, rawAvailableWidth)
      const nextMainScale = availableWidth / MOBILE_RECIPES_PANEL.width
      const nextActionScale = Math.min(
        nextMainScale,
        availableWidth / ACTION_PANEL.width
      )

      setLayoutState({
        contentWidth: availableWidth,
        mainScale: nextMainScale,
        actionPanelScale: nextActionScale,
      })
    }

    const scheduleUpdate = () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
      frameId = window.requestAnimationFrame(updateLayout)
    }

    scheduleUpdate()

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleUpdate) : null
    resizeObserver?.observe(element)
    window.addEventListener("resize", scheduleUpdate)

    return () => {
      window.removeEventListener("resize", scheduleUpdate)
      resizeObserver?.disconnect()
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [])

  return [contentRef, layoutState]
}

function getMobileCraftSlotStyle(index) {
  const column = index % MOBILE_CRAFT_PANEL.grid.columns
  const row = Math.floor(index / MOBILE_CRAFT_PANEL.grid.columns)

  return {
    position: "absolute",
    left: `${MOBILE_CRAFT_PANEL.grid.x + column * MOBILE_CRAFT_PANEL.grid.slotSize}px`,
    top: `${MOBILE_CRAFT_PANEL.grid.y + row * MOBILE_CRAFT_PANEL.grid.slotSize}px`,
    width: `${MOBILE_CRAFT_PANEL.grid.slotSize}px`,
    height: `${MOBILE_CRAFT_PANEL.grid.slotSize}px`,
  }
}

function getMobileCraftResultStyle() {
  return {
    position: "absolute",
    left: `${MOBILE_CRAFT_PANEL.result.x}px`,
    top: `${MOBILE_CRAFT_PANEL.result.y}px`,
    width: `${MOBILE_CRAFT_PANEL.result.size}px`,
    height: `${MOBILE_CRAFT_PANEL.result.size}px`,
  }
}

export default function InventoryPanelMobile({
  unlockedSlotCount,
  mainUnlockedCount,
  walletSol,
  mainSlots,
  usableSlots,
  craftSlots,
  craftResult,
  craftPreviewSlots,
  selectedSlotKey,
  dragSourceKey,
  dropTargetKey,
  hoverPreviewRecipeId,
  panelScale,
  onClose,
  onSlotPointerDown,
  onCraftResultClick,
  onHoverRecipe,
  onLeaveRecipe,
  onCraftRecipe,
  getStackLabel,
  renderLockedOverlay,
}) {
  const [contentRef, layoutState] = useSharedMobileScale(Math.max(0.5, panelScale || 1))
  const modelColor = usePetStore((state) => state.theme?.modelColor || "#8f8f8f")

  const [inventorySkinMode, setInventorySkinMode] = useState(() => {
    if (typeof window === "undefined") return "normal"
    if (window.innerHeight < 750) return "compact"
    if (window.innerHeight < 825) return "reduced"
    return "normal"
  })

  useEffect(() => {
    if (typeof window === "undefined") return undefined

    const updateInventorySkinMode = () => {
      if (window.innerHeight < 750) {
        setInventorySkinMode("compact")
        return
      }
      if (window.innerHeight < 825) {
        setInventorySkinMode("reduced")
        return
      }
      setInventorySkinMode("normal")
    }

    updateInventorySkinMode()
    window.addEventListener("resize", updateInventorySkinMode)
    window.addEventListener("orientationchange", updateInventorySkinMode)

    return () => {
      window.removeEventListener("resize", updateInventorySkinMode)
      window.removeEventListener("orientationchange", updateInventorySkinMode)
    }
  }, [])

  const mobileScale = layoutState.mainScale
  const inventorySkinSrc = inventorySkinMode === "compact"
    ? playerInventoryMobileCompactSkin
    : inventorySkinMode === "reduced"
      ? playerInventoryMobileReducedSkin
      : playerInventoryMobileSkin
  const activeInventoryPanel = inventorySkinMode === "compact"
    ? MOBILE_INVENTORY_PANEL_COMPACT
    : inventorySkinMode === "reduced"
      ? MOBILE_INVENTORY_PANEL_REDUCED
      : MOBILE_INVENTORY_PANEL
  const actionScale = layoutState.actionPanelScale * 2
  const inventoryFrameWidth = activeInventoryPanel.width * mobileScale
  const inventoryFrameHeight = activeInventoryPanel.height * mobileScale
  const recipesFrameWidth = MOBILE_RECIPES_PANEL.width * mobileScale
  const recipesFrameHeight = MOBILE_RECIPES_PANEL.height * mobileScale
  const craftFrameWidth = MOBILE_CRAFT_PANEL.width * mobileScale
  const craftFrameHeight = MOBILE_CRAFT_PANEL.height * mobileScale
  const actionFrameHeight = ACTION_PANEL.height * actionScale
  const contentWidth = Math.min(layoutState.contentWidth, Math.max(recipesFrameWidth, craftFrameWidth, inventoryFrameWidth))
  const inventoryGridColumns = activeInventoryPanel.grid.columns

  return (
    <div className="inventory-mobile-ui">
      <div
        className="inventory-mobile-ui__header"
        style={{
          marginBottom: 0,
          flex: "0 0 auto",
        }}
      >
        <span className="inventory-mobile-ui__meta">
          {`${unlockedSlotCount}/${INVENTORY_MAX_VISUAL_CAPACITY} slots unlocked`}
        </span>

        <TintedCtaButton
          ariaLabel="Close inventory"
          defaultSrc={closeButton}
          pressedSrc={closeButtonPressed}
          tintColor={modelColor}
          onClick={() => onClose?.()}
          width={`${CLOSE_BUTTON_SIZE}px`}
          height={`${CLOSE_BUTTON_SIZE}px`}
          style={{
            pointerEvents: "auto",
            flexShrink: 0,
          }}
        />
      </div>

      <div
        ref={contentRef}
        style={{
          width: "100%",
          maxWidth: `${MOBILE_CONTENT_MAX_WIDTH}px`,
          marginTop: "-10px",
          flex: "1 1 auto",
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          overscrollBehavior: "contain",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 4px)",
          boxSizing: "border-box",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <div
          style={{
            width: `${contentWidth}px`,
            maxWidth: `${MOBILE_CONTENT_MAX_WIDTH}px`,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "flex-start",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${recipesFrameWidth}px`,
              height: `${MOBILE_TITLE_ROW_HEIGHT}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              color: "#d7efe5",
              fontSize: "10px",
              lineHeight: 1,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              textShadow: "1px 1px 0 rgba(0, 0, 0, 0.35)",
              paddingLeft: "2px",
              boxSizing: "border-box",
              flex: "0 0 auto",
            }}
          >
            Recipes & Craft
          </div>

          <div
            style={{
              width: `${recipesFrameWidth}px`,
              height: `${recipesFrameHeight}px`,
              marginTop: `${MOBILE_LABEL_GAP}px`,
              flex: "0 0 auto",
            }}
          >
            <MobileScaledPanel
              baseWidth={MOBILE_RECIPES_PANEL.width}
              baseHeight={MOBILE_RECIPES_PANEL.height}
              scale={mobileScale}
              className="inventory-mobile-panel--recipes"
            >
              <img
                src={playerRecipesMobileSkin}
                alt=""
                aria-hidden="true"
                className="inventory-ui-skin"
              />

              <div
                className="inventory-mobile-recipes"
                style={{
                  left: `${MOBILE_RECIPES_PANEL.list.left}px`,
                  top: `${MOBILE_RECIPES_PANEL.list.top}px`,
                  width: `${MOBILE_RECIPES_PANEL.list.width}px`,
                  height: `${MOBILE_RECIPES_PANEL.list.height}px`,
                }}
              >
                <RecipePanel
                  mainSlots={mainSlots}
                  usableSlots={usableSlots}
                  hoverPreviewRecipeId={hoverPreviewRecipeId}
                  onHoverRecipe={onHoverRecipe}
                  onLeaveRecipe={onLeaveRecipe}
                  onCraftRecipe={onCraftRecipe}
                  variant="mobile"
                />
              </div>
            </MobileScaledPanel>
          </div>

          <div
            style={{
              width: `${craftFrameWidth}px`,
              height: `${craftFrameHeight}px`,
              flex: "0 0 auto",
              marginTop: "0px",
            }}
          >
            <MobileScaledPanel
              baseWidth={MOBILE_CRAFT_PANEL.width}
              baseHeight={MOBILE_CRAFT_PANEL.height}
              scale={mobileScale}
              className="inventory-mobile-panel--craft"
            >
              <img
                src={playerCraftMobileSkin}
                alt=""
                aria-hidden="true"
                className="inventory-ui-skin"
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                }}
              >
                {Array.from({ length: 9 }).map((_, index) => {
                  const column = index % MOBILE_CRAFT_PANEL.grid.columns
                  const row = Math.floor(index / MOBILE_CRAFT_PANEL.grid.columns)

                  return (
                    <img
                      key={`craft-bg-${index}`}
                      src={playerInventoryMobileSlotSkin}
                      alt=""
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: `${MOBILE_CRAFT_PANEL.grid.x + column * MOBILE_CRAFT_PANEL.grid.slotSize}px`,
                        top: `${MOBILE_CRAFT_PANEL.grid.y + row * MOBILE_CRAFT_PANEL.grid.slotSize}px`,
                        width: `${MOBILE_CRAFT_PANEL.grid.slotSize}px`,
                        height: `${MOBILE_CRAFT_PANEL.grid.slotSize}px`,
                        imageRendering: "pixelated",
                      }}
                    />
                  )
                })}

                <img
                  src={playerInventoryMobileSlotSkin}
                  alt=""
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: `${MOBILE_CRAFT_PANEL.result.x}px`,
                    top: `${MOBILE_CRAFT_PANEL.result.y}px`,
                    width: `${MOBILE_CRAFT_PANEL.result.size}px`,
                    height: `${MOBILE_CRAFT_PANEL.result.size}px`,
                    imageRendering: "pixelated",
                  }}
                />
              </div>

              {craftSlots.map((stack, index) => {
                const slotKey = `craft:${index}`
                const previewSlot = craftPreviewSlots[index] || null
                const displayStack =
                  stack || (previewSlot ? { itemId: previewSlot.itemId, quantity: 1 } : null)

                return (
                  <InventorySlot
                    key={slotKey}
                    slotKey={slotKey}
                    stack={stack}
                    displayStack={displayStack}
                    title={
                      getStackLabel(stack) ||
                      (previewSlot?.itemId
                        ? `${getItemDefinition(previewSlot.itemId)?.name || previewSlot.itemId} preview`
                        : `Craft slot ${index + 1}`)
                    }
                    style={getMobileCraftSlotStyle(index)}
                    isSelected={selectedSlotKey === slotKey}
                    isDragSource={dragSourceKey === slotKey}
                    isDropTarget={dropTargetKey === slotKey}
                    isPreview={!stack?.itemId && Boolean(previewSlot)}
                    isPreviewMissing={previewSlot?.state === "missing" && !stack?.itemId}
                    isPreviewCovered={previewSlot?.state === "covered" && !stack?.itemId}
                    slotClassName="inventory-ui-slot--mobile-embedded"
                    onPointerDown={(event) => onSlotPointerDown(event, "craft", index, stack)}
                  />
                )
              })}

              <InventorySlot
                slotKey="result:0"
                slotType="result"
                stack={craftResult}
                title={getStackLabel(craftResult) || "Craft result"}
                style={getMobileCraftResultStyle()}
                slotClassName="inventory-ui-slot--mobile-embedded"
                onClick={onCraftResultClick}
              />
            </MobileScaledPanel>
          </div>

          <div
            style={{
              width: `${inventoryFrameWidth}px`,
              height: `${MOBILE_META_ROW_HEIGHT}px`,
              marginTop: `${MOBILE_SECTION_GAP}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              paddingLeft: "2px",
              boxSizing: "border-box",
              flex: "0 0 auto",
            }}
          >
            <span
              style={{
                color: "#d7efe5",
                fontSize: "10px",
                lineHeight: 1,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                textShadow: "1px 1px 0 rgba(0, 0, 0, 0.35)",
                whiteSpace: "nowrap",
              }}
            >
              {`Bag ${mainUnlockedCount}/${INVENTORY_MAIN_SLOT_COUNT}`}
            </span>

            <CurrencyDisplay
              amount={walletSol}
              animated
              size={16}
              fps={8}
              gap={0}
              title={`${walletSol} sol`}
              style={{
                justifyContent: "flex-end",
                flex: "0 0 auto",
              }}
              textStyle={{
                color: "#d7efe5",
                fontSize: "12px",
                letterSpacing: "-0.4px",
              }}
            />
          </div>

          <div
            style={{
              width: `${inventoryFrameWidth}px`,
              height: `${inventoryFrameHeight}px`,
              flex: "0 0 auto",
            }}
          >
            <MobileScaledPanel
              baseWidth={activeInventoryPanel.width}
              baseHeight={activeInventoryPanel.height}
              scale={mobileScale}
              className="inventory-mobile-panel--inventory"
            >
              <img
                src={inventorySkinSrc}
                alt=""
                aria-hidden="true"
                className="inventory-ui-skin"
              />

              <div
                className="inventory-mobile-grid-viewport"
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  left: `${activeInventoryPanel.gridViewport.left}px`,
                  top: `${activeInventoryPanel.gridViewport.top}px`,
                  width: `${activeInventoryPanel.gridViewport.width}px`,
                  height: `${activeInventoryPanel.gridViewport.height}px`,
                  "--inventory-mobile-grid-columns": inventoryGridColumns,
                }}
              >
                <div className="inventory-mobile-grid">
                  {mainSlots.map((stack, index) => {
                    const slotKey = `main:${index}`
                    const unlocked = isInventorySlotUnlocked({ unlockedSlotCount }, "main", index)

                    return (
                      <InventorySlot
                        key={slotKey}
                        slotKey={unlocked ? slotKey : undefined}
                        stack={stack}
                        title={
                          unlocked
                            ? getStackLabel(stack) || `Bag slot ${index + 1}`
                            : `Locked bag slot ${index + 1}`
                        }
                        style={MOBILE_SLOT_STYLE}
                        iconSize={24}
                        slotClassName="inventory-ui-slot--mobile-skin"
                        slotSkinSrc={playerInventoryMobileSlotSkin}
                        touchAction="pan-y"
                        isSelected={selectedSlotKey === slotKey}
                        isDragSource={dragSourceKey === slotKey}
                        isDropTarget={unlocked && dropTargetKey === slotKey}
                        isDisabled={!unlocked}
                        onPointerDown={
                          unlocked
                            ? (event) =>
                                onSlotPointerDown(event, "main", index, stack, {
                                  preventBrowserDefault: false,
                                  selectOnPointerDown: false,
                                  allowVerticalScroll: true,
                                })
                            : undefined
                        }
                      >
                        {!unlocked ? (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              pointerEvents: "none",
                              overflow: "hidden",
                              maskImage: `url(${playerInventoryMobileSlotSkin})`,
                              WebkitMaskImage: `url(${playerInventoryMobileSlotSkin})`,
                              maskSize: "100% 100%",
                              WebkitMaskSize: "100% 100%",
                              maskRepeat: "no-repeat",
                              WebkitMaskRepeat: "no-repeat",
                            }}
                          >
                            {renderLockedOverlay()}
                          </div>
                        ) : null}
                      </InventorySlot>
                    )
                  })}
                </div>
              </div>
            </MobileScaledPanel>
          </div>

          <div
            style={{
              width: `${recipesFrameWidth}px`,
              height: `${actionFrameHeight}px`,
              marginTop: `${MOBILE_SECTION_GAP}px`,
              flex: "0 0 auto",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
            }}
          >
            <MobileScaledPanel
              baseWidth={ACTION_PANEL.width}
              baseHeight={ACTION_PANEL.height}
              scale={actionScale}
              className="inventory-mobile-panel--actions"
            >
              <img
                src={playerActionsSlotsSkin}
                alt=""
                aria-hidden="true"
                className="inventory-ui-skin"
              />

              {usableSlots.map((stack, index) => {
                const slotKey = `usable:${index}`

                return (
                  <InventorySlot
                    key={slotKey}
                    slotKey={slotKey}
                    stack={stack}
                    title={getStackLabel(stack) || `Action slot ${index + 1}`}
                    style={getInventorySlotStyle("usable", index)}
                    isSelected={selectedSlotKey === slotKey}
                    isDragSource={dragSourceKey === slotKey}
                    isDropTarget={dropTargetKey === slotKey}
                    onPointerDown={(event) => onSlotPointerDown(event, "usable", index, stack)}
                  />
                )
              })}
            </MobileScaledPanel>
          </div>
        </div>
      </div>
    </div>
  )
}
