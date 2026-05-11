import React from "react"
import TintedCtaButton from "../../components/TintedCtaButton"
import closeButton from "../../hud/CTAs/CTA_Small_8BIT_Close.webp"
import closeButtonPressed from "../../hud/CTAs/CTA_Small_8BIT_Close_Pressed.webp"
import playerActionsSlotsSkin from "../../hud/inventories/player/PlayerActionsSlots.png"
import playerCraftSkin from "../../hud/inventories/player/PlayerCraft.png"
import playerInventorySkin from "../../hud/inventories/player/PlayerInventory.png"
import {
  PLAYER_INVENTORY_UI_LAYOUT,
  getCraftRecipePanelStyle,
  getInventorySlotStyle,
} from "../config/inventoryLayout"
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

const ACTION_PANEL = PLAYER_INVENTORY_UI_LAYOUT.actionSlots
const INVENTORY_PANEL = PLAYER_INVENTORY_UI_LAYOUT.inventory
const CRAFT_PANEL = PLAYER_INVENTORY_UI_LAYOUT.craft
const CLOSE_BUTTON_SIZE = 52
const ACTION_PANEL_STYLE = {
  width: `${ACTION_PANEL.width}px`,
  height: `${ACTION_PANEL.height}px`,
}
const INVENTORY_PANEL_STYLE = {
  width: `${INVENTORY_PANEL.width}px`,
  height: `${INVENTORY_PANEL.height}px`,
}
const CRAFT_PANEL_STYLE = {
  width: `${CRAFT_PANEL.width}px`,
  height: `${CRAFT_PANEL.height}px`,
}
const CRAFT_RECIPE_PANEL_STYLE = getCraftRecipePanelStyle()

export default function InventoryPanelDesktop({
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
  layoutScale,
  onClose,
  onSlotPointerDown,
  onCraftResultClick,
  onHoverRecipe,
  onLeaveRecipe,
  onCraftRecipe,
  getStackLabel,
  renderLockedOverlay,
}) {
  const modelColor = usePetStore((state) => state.theme?.modelColor || "#8f8f8f")
  const closeButtonScale = layoutScale > 0 ? 1 / layoutScale : 1

  return (
    <div
      className="inventory-floating-ui"
      style={{ "--inventory-ui-scale": layoutScale }}
    >
      <div className="inventory-ui-toolbar">
        <span className="inventory-ui-toolbar__meta">
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
            transform: `scale(${closeButtonScale})`,
            transformOrigin: "top right",
          }}
        />
      </div>

      <div className="inventory-floating-layout">
        <section
          className="inventory-ui-panel-shell inventory-main-panel"
          style={INVENTORY_PANEL_STYLE}
        >
          <img
            src={playerInventorySkin}
            alt=""
            aria-hidden="true"
            className="inventory-ui-skin"
          />

          <div className="inventory-ui-panel-title inventory-ui-panel-title--inventory">
            {`Bag ${mainUnlockedCount}/${INVENTORY_MAIN_SLOT_COUNT}`}
          </div>

          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: "48px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "7px 6px 5px 7px",
              boxSizing: "border-box",
              pointerEvents: "none",
              userSelect: "none",
              zIndex: 2,
            }}
          >
            <CurrencyDisplay
              amount={walletSol}
              animated
              size={16}
              fps={8}
              gap={0}
              title={`${walletSol} sol`}
              style={{
                width: "100%",
                justifyContent: "flex-start",
                transform: "translate(-3px, -2px)",
              }}
              textStyle={{
                color: "#263109",
                fontSize: "12px",
                letterSpacing: "-0.5px",
              }}
            />
          </div>

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
                style={getInventorySlotStyle("main", index)}
                isSelected={selectedSlotKey === slotKey}
                isDragSource={dragSourceKey === slotKey}
                isDropTarget={unlocked && dropTargetKey === slotKey}
                isDisabled={!unlocked}
                onPointerDown={
                  unlocked
                    ? (event) => onSlotPointerDown(event, "main", index, stack)
                    : undefined
                }
              >
                {!unlocked ? renderLockedOverlay() : null}
              </InventorySlot>
            )
          })}
        </section>

        <section
          className="inventory-ui-panel-shell inventory-craft-panel"
          style={CRAFT_PANEL_STYLE}
        >
          <img
            src={playerCraftSkin}
            alt=""
            aria-hidden="true"
            className="inventory-ui-skin"
          />

          <div className="inventory-ui-panel-title inventory-ui-panel-title--craft">
            CRAFT
          </div>
          <div className="inventory-ui-panel-title inventory-ui-panel-title--recipes">
            RECIPES
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
                style={getInventorySlotStyle("craft", index)}
                isSelected={selectedSlotKey === slotKey}
                isDragSource={dragSourceKey === slotKey}
                isDropTarget={dropTargetKey === slotKey}
                isPreview={!stack?.itemId && Boolean(previewSlot)}
                isPreviewMissing={previewSlot?.state === "missing" && !stack?.itemId}
                isPreviewCovered={previewSlot?.state === "covered" && !stack?.itemId}
                onPointerDown={(event) => onSlotPointerDown(event, "craft", index, stack)}
              />
            )
          })}

          <InventorySlot
            slotKey="result:0"
            slotType="result"
            stack={craftResult}
            title={getStackLabel(craftResult) || "Craft result"}
            style={getInventorySlotStyle("result", 0)}
            onClick={onCraftResultClick}
          />

          <div className="inventory-ui-recipes" style={CRAFT_RECIPE_PANEL_STYLE}>
            <RecipePanel
              mainSlots={mainSlots}
              usableSlots={usableSlots}
              hoverPreviewRecipeId={hoverPreviewRecipeId}
              onHoverRecipe={onHoverRecipe}
              onLeaveRecipe={onLeaveRecipe}
              onCraftRecipe={onCraftRecipe}
            />
          </div>
        </section>

        <section
          className="inventory-ui-panel-shell inventory-action-panel"
          style={ACTION_PANEL_STYLE}
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
        </section>
      </div>
    </div>
  )
}
