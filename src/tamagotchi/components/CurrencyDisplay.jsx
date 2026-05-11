import React, { useEffect, useState } from "react"
import coinSheet from "../../spritesheets/items/Coin_Sheet.png"
import coinSprite from "../../spritesheets/items/Coin_Sprite.png"

const COIN_FRAME_SIZE = 16
const COIN_FRAME_COUNT = 8
const DEFAULT_ANIMATION_FPS = 8
const PROJECT_FONT_FAMILY = 'var(--app-font-family)'

function normalizeAmount(amount) {
  const numericAmount = Number(amount)
  if (!Number.isFinite(numericAmount)) return 0
  return Math.max(0, Math.floor(numericAmount))
}

export default function CurrencyDisplay({
  amount = 0,
  animated = false,
  size = COIN_FRAME_SIZE,
  fps = DEFAULT_ANIMATION_FPS,
  gap = 4,
  style = null,
  iconStyle = null,
  textStyle = null,
  title = null,
}) {
  const [frameIndex, setFrameIndex] = useState(0)

  useEffect(() => {
    if (!animated) {
      setFrameIndex(0)
      return undefined
    }

    const nextIntervalMs = Math.max(100, Math.round(1000 / Math.max(1, fps)))
    const intervalId = window.setInterval(() => {
      setFrameIndex((currentFrameIndex) => (currentFrameIndex + 1) % COIN_FRAME_COUNT)
    }, nextIntervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [animated, fps])

  const safeAmount = normalizeAmount(amount)

  return (
    <span
      title={title || undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: `${gap}px`,
        whiteSpace: "nowrap",
        lineHeight: 1,
        fontFamily: PROJECT_FONT_FAMILY,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          display: "inline-block",
          flexShrink: 0,

        marginBottom: "-2px",
          backgroundImage: `url(${animated ? coinSheet : coinSprite})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: animated ? `-${frameIndex * size}px 0px` : "0px 0px",
          backgroundSize: animated
            ? `${COIN_FRAME_COUNT * size}px ${size}px`
            : `${size}px ${size}px`,
          imageRendering: "pixelated",
          ...iconStyle,
        }}
      />
      <span
        style={{
          fontFamily: PROJECT_FONT_FAMILY,
          lineHeight: 1,
          ...textStyle,
        }}
      >
        {safeAmount}
      </span>
    </span>
  )
}
