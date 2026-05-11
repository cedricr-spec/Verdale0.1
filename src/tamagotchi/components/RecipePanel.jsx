import React, { useCallback, useEffect, useRef, useState } from "react"
import recipeFrameActive from "../../hud/inventories/player/recipe_frame_active.png"
import recipeFrame from "../../hud/inventories/player/recipe_frame.png"
import {
  countItemsInSlots,
  getRecipeAvailability,
  getRecipeOutputs,
  getVisibleCraftRecipes,
} from "../config/craftRecipes"
import { getItemSpriteAsset } from "../config/itemSprites"
import { getItemDefinition } from "../config/itemsRegistry"
import { getItemAtlasInfo } from "../utils/farmingAtlasData"
import ItemVisual from "./ItemVisual"

function humanizeItemId(itemId) {
  return itemId
    ?.split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

function getItemLabel(itemId) {
  return getItemDefinition(itemId)?.name || humanizeItemId(itemId) || "Unknown Item"
}

function getRecipeIcon(recipe) {
  const primaryOutputId = getRecipeOutputs(recipe)[0]?.itemId
  if (hasRealItemIcon(primaryOutputId)) {
    return <ItemVisual itemId={primaryOutputId} size={16} emojiSize={14} />
  }
  return null
}

function hasRealItemIcon(itemId) {
  if (!itemId) return false

  const farmingAtlasInfo = getItemAtlasInfo(itemId)
  const itemDefinition = getItemDefinition(itemId)
  if (farmingAtlasInfo?.atlasSource && farmingAtlasInfo?.atlasRect) return true
  if (itemDefinition?.atlasSource && itemDefinition?.atlasRect) return true
  if (itemDefinition?.spritePath) return true

  return Boolean(getItemSpriteAsset(itemId, "inventory"))
}

function buildRecipeTooltip(recipe, availability, outputs) {
  const inputsLabel = availability.inputs
    .map((input) => `${getItemLabel(input.itemId)} ${input.owned}/${input.quantity}`)
    .join(" • ")
  const outputsLabel = outputs
    .map((output) => `${getItemLabel(output.itemId)} x${Math.max(0, Number(output.quantity) || 0)}`)
    .join(" • ")

  return [recipe.name, outputsLabel, inputsLabel].filter(Boolean).join(" | ")
}

function RecipePanel({
  mainSlots = [],
  usableSlots = [],
  hoverPreviewRecipeId = null,
  onHoverRecipe,
  onLeaveRecipe,
  onCraftRecipe,
  variant = "desktop",
}) {
  const [poppingRecipeId, setPoppingRecipeId] = useState(null)
  const [pressedRecipeId, setPressedRecipeId] = useState(null)
  const popTimeoutRef = useRef(null)
  const visibleRecipes = getVisibleCraftRecipes().filter((recipe) =>
    hasRealItemIcon(getRecipeOutputs(recipe)[0]?.itemId)
  )
  const inventoryCounts = countItemsInSlots([...(mainSlots || []), ...(usableSlots || [])])

  useEffect(() => () => {
    if (popTimeoutRef.current) {
      window.clearTimeout(popTimeoutRef.current)
    }
  }, [])

  const triggerPopAnimation = useCallback((recipeId) => {
    if (!recipeId) return
    if (popTimeoutRef.current) {
      window.clearTimeout(popTimeoutRef.current)
    }
    setPoppingRecipeId(recipeId)
    popTimeoutRef.current = window.setTimeout(() => {
      setPoppingRecipeId(null)
      popTimeoutRef.current = null
    }, 180)
  }, [])

  const handleRecipeClick = useCallback(
    (recipeId, canCraft) => {
      if (!canCraft || typeof onCraftRecipe !== "function") return

      const result = onCraftRecipe(recipeId)
      if (result?.success) {
        triggerPopAnimation(recipeId)
      }
    },
    [onCraftRecipe, triggerPopAnimation]
  )

  if (!visibleRecipes.length) {
    return (
      <div className="inventory-ui-recipe-empty">
        No craft recipes available.
      </div>
    )
  }

  return (
    <div
      className={[
        "inventory-ui-recipe-list",
        variant === "mobile" ? "inventory-ui-recipe-list--mobile" : null,
      ].filter(Boolean).join(" ")}
    >
      {visibleRecipes.map((recipe) => {
        const availability = getRecipeAvailability(recipe, inventoryCounts)
        const isPreviewed = hoverPreviewRecipeId === recipe.id
        const canCraft = availability.canCraft
        const recipeFrameSkin = canCraft ? recipeFrameActive : recipeFrame

        return (
          <button
            key={recipe.id}
            type="button"
            className={[
              "inventory-ui-recipe-row",
              isPreviewed ? "inventory-ui-recipe-row--previewed" : null,
              pressedRecipeId === recipe.id ? "inventory-ui-recipe-row--pressed" : null,
              poppingRecipeId === recipe.id ? "inventory-ui-recipe-row--pop" : null,
              canCraft
                ? "inventory-ui-recipe-row--ready"
                : "inventory-ui-recipe-row--disabled",
              variant === "mobile" ? "inventory-ui-recipe-row--mobile" : null,
            ].filter(Boolean).join(" ")}
            aria-pressed={false}
            title={buildRecipeTooltip(recipe, availability, getRecipeOutputs(recipe))}
            onPointerEnter={() => onHoverRecipe?.(recipe.id)}
            onPointerLeave={() => {
              setPressedRecipeId(null)
              onLeaveRecipe?.()
            }}
            onPointerDown={() => {
              setPressedRecipeId(recipe.id)
              if (variant === "mobile") {
                onHoverRecipe?.(recipe.id)
              }
            }}
            onPointerUp={() => setPressedRecipeId(null)}
            onPointerCancel={() => setPressedRecipeId(null)}
            onLostPointerCapture={() => setPressedRecipeId(null)}
            onTouchEnd={() => setPressedRecipeId(null)}
            onBlur={() => setPressedRecipeId(null)}
            onClick={() => handleRecipeClick(recipe.id, canCraft)}
          >
            <img
              src={recipeFrameSkin}
              alt=""
              aria-hidden="true"
              className="inventory-ui-recipe-row__frame"
            />

            <span className="inventory-ui-recipe-row__icon">{getRecipeIcon(recipe)}</span>

            <span className="inventory-ui-recipe-row__body">
              <span className="inventory-ui-recipe-row__name">{recipe.name}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default React.memo(RecipePanel)
