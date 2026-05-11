import React from "react"
import { getItemSpriteAsset } from "../config/itemSprites"
import { getItemDefinition } from "../config/itemsRegistry"

function renderSprite(sprite, size) {
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
  const item = getItemDefinition(itemId)
  const sprite = getItemSpriteAsset(itemId, variant)

  if (!item) return null

  const spriteNode = renderSprite(sprite, size)
  if (spriteNode) return spriteNode

  return (
    <span
      aria-hidden="true"
      style={{
        fontSize: `${emojiSize}px`,
        lineHeight: 1,
        display: "block",
        transform: variant === "world" ? "translateY(-1px)" : "none",
        pointerEvents: "none",
      }}
    >
      {item.emoji}
    </span>
  )
}
