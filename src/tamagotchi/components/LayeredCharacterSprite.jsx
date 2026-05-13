import React, { useEffect, useState } from "react"
import {
  CHARACTER_HAND_BACK_FRAME,
  CHARACTER_HAND_FRONT_FRAME,
  hasCharacterHandFrames,
} from "../config/sharedAnimationMap"

function CharacterFrameLayer({
  spritesheet,
  frameX,
  frameY,
  metrics,
  useTint = false,
  tintColor = "#ffffff",
  zIndex = 0,
}) {
  const viewportStyle = {
    position: "relative",
    width: `${metrics.viewportWidth}px`,
    height: `${metrics.viewportHeight}px`,
    overflow: "hidden",
    imageRendering: "pixelated",
    pointerEvents: "none",
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex,
        pointerEvents: "none",
      }}
    >
      {useTint ? (
        <div
          style={{
            ...viewportStyle,
            backgroundColor: tintColor,
            WebkitMaskImage: `url("${spritesheet}")`,
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: `${metrics.spritesheetWidth}px ${metrics.spritesheetHeight}px`,
            WebkitMaskPosition: `-${frameX}px -${frameY}px`,
            maskImage: `url("${spritesheet}")`,
            maskRepeat: "no-repeat",
            maskSize: `${metrics.spritesheetWidth}px ${metrics.spritesheetHeight}px`,
            maskPosition: `-${frameX}px -${frameY}px`,
          }}
        />
      ) : (
        <div style={viewportStyle}>
          <img
            src={spritesheet}
            alt=""
            draggable="false"
            style={{
              position: "absolute",
              top: `-${frameY}px`,
              left: `-${frameX}px`,
              width: `${metrics.spritesheetWidth}px`,
              height: `${metrics.spritesheetHeight}px`,
              imageRendering: "pixelated",
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        </div>
      )}
    </div>
  )
}

export default function LayeredCharacterSprite({
  spritesheet,
  frameX,
  frameY,
  metrics,
  useTint = false,
  tintColor = "#ffffff",
  showHands = true,
}) {
  const [handsSupported, setHandsSupported] = useState(false)

  useEffect(() => {
    if (!spritesheet || typeof Image === "undefined") {
      setHandsSupported(false)
      return undefined
    }

    let cancelled = false
    const image = new Image()

    const syncSupport = () => {
      if (!cancelled) {
        setHandsSupported(hasCharacterHandFrames(image))
      }
    }

    const handleError = () => {
      if (!cancelled) {
        setHandsSupported(false)
      }
    }

    image.addEventListener("load", syncSupport)
    image.addEventListener("error", handleError)
    image.src = spritesheet

    if (image.complete && image.naturalWidth > 0) {
      syncSupport()
    }

    return () => {
      cancelled = true
      image.removeEventListener("load", syncSupport)
      image.removeEventListener("error", handleError)
    }
  }, [spritesheet])

  return (
    <>
      {showHands && handsSupported && (
        <CharacterFrameLayer
          spritesheet={spritesheet}
          frameX={CHARACTER_HAND_BACK_FRAME.x}
          frameY={CHARACTER_HAND_BACK_FRAME.y}
          metrics={metrics}
          useTint={useTint}
          tintColor={tintColor}
          zIndex={0}
        />
      )}
      <CharacterFrameLayer
        spritesheet={spritesheet}
        frameX={frameX}
        frameY={frameY}
        metrics={metrics}
        useTint={useTint}
        tintColor={tintColor}
        zIndex={1}
      />
      {showHands && handsSupported && (
        <CharacterFrameLayer
          spritesheet={spritesheet}
          frameX={CHARACTER_HAND_FRONT_FRAME.x}
          frameY={CHARACTER_HAND_FRONT_FRAME.y}
          metrics={metrics}
          useTint={useTint}
          tintColor={tintColor}
          zIndex={2}
        />
      )}
    </>
  )
}
