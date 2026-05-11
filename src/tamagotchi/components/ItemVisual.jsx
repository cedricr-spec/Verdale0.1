import React from "react"
import { getItemSpriteAsset } from "../config/itemSprites"
import { getCanonicalItemId, getItemDefinition } from "../config/itemsRegistry"
import { getItemAtlasInfo } from "../utils/farmingAtlasData"

const WORLD_ITEM_SHADOW = "drop-shadow(1px 2px 0 rgba(0,0,0,0.45))"

function getWorldShadowStyle(variant) {
  return variant === "world" ? { filter: WORLD_ITEM_SHADOW } : null
}

function renderAtlasSprite(atlasSource, atlasRectVal, size, variant = "inventory") {
  const srcW = atlasRectVal.width || 16
  const srcH = atlasRectVal.height || srcW
  // Scale so the longest dimension fills `size`, keeping aspect ratio.
  const scale = size / Math.max(srcW, srcH)
  const renderW = Math.round(srcW * scale)
  const renderH = Math.round(srcH * scale)
  // Centre the sprite inside the square slot.
  const offsetX = Math.round((size - renderW) / 2)
  const offsetY = Math.round((size - renderH) / 2)

  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        overflow: "hidden",
        position: "relative",
        display: "inline-block",
        imageRendering: "pixelated",
        flexShrink: 0,
        pointerEvents: "none",
        ...getWorldShadowStyle(variant),
      }}
      >
      <img
        src={atlasSource}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          left: `${offsetX - (atlasRectVal.x || 0) * scale}px`,
          top: `${offsetY - (atlasRectVal.y || 0) * scale}px`,
          width: "auto",
          height: "auto",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          imageRendering: "pixelated",
          pointerEvents: "none",
        }}
      />
    </div>
  )
}

function renderSprite(sprite, size, variant = "inventory") {
  if (!sprite) return null

  if (sprite.src) {
    return (
      <img
        src={sprite.src}
        alt=""
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          display: "block",
          imageRendering: "pixelated",
          pointerEvents: "none",
          ...getWorldShadowStyle(variant),
        }}
      />
    )
  }

  if (sprite.sheet) {
    return (
      <div
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          backgroundImage: `url(${sprite.sheet})`,
          backgroundPosition: `-${sprite.x || 0}px -${sprite.y || 0}px`,
          backgroundRepeat: "no-repeat",
          backgroundSize: sprite.backgroundSize || "auto",
          imageRendering: "pixelated",
          pointerEvents: "none",
          ...getWorldShadowStyle(variant),
        }}
      />
    )
  }

  return null
}

export default function ItemVisual({
  itemId,
  variant = "inventory",
  size = 24,
  emojiSize = 22,
}) {
  const canonicalItemId = getCanonicalItemId(itemId) || itemId
  const item = getItemDefinition(canonicalItemId)
  const farmingAtlasInfo = getItemAtlasInfo(canonicalItemId)

  // Priority 1: centralized farming atlas resolver
  if (farmingAtlasInfo?.atlasSource && farmingAtlasInfo?.atlasRect) {
    return renderAtlasSprite(farmingAtlasInfo.atlasSource, farmingAtlasInfo.atlasRect, size, variant)
  }

  // Priority 2: atlas sprite from item definition
  if (item?.atlasSource && item?.atlasRect) {
    return renderAtlasSprite(item.atlasSource, item.atlasRect, size, variant)
  }

  // Priority 3: configured sprite asset or spritePath
  const sprite = getItemSpriteAsset(canonicalItemId, variant)
  const spriteNode = renderSprite(sprite, size, variant)
  if (spriteNode) return spriteNode

  // Priority 4: emoji / placeholder fallback
  return (
    <span
      aria-hidden="true"
      style={{
        fontSize: `${emojiSize}px`,
        lineHeight: 1,
        display: "block",
        transform: variant === "world" ? "translateY(-1px)" : "none",
        pointerEvents: "none",
        ...getWorldShadowStyle(variant),
      }}
    >
      {item?.icon || item?.emoji || "❔"}
    </span>
  )
}
