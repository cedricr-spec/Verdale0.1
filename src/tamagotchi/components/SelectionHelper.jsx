import React from "react"
import cursorsSprite from "../../hud/Cursors & Pointers.png"

// Renders the selection frame at x=32, y=0 (32×32) from the Cursors & Pointers spritesheet.
// Uses CSS transform to scale from native 32px to the requested display size.
export default function SelectionHelper({ size = 44, zIndex = 5, style = {} }) {
  const scale = size / 32

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: `${size}px`,
        height: `${size}px`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <div
        className="selection-helper-sprite"
        style={{
          flexShrink: 0,
          width: "32px",
          height: "32px",
          backgroundImage: `url(${cursorsSprite})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "-32px 0px",
          backgroundSize: "auto",
          imageRendering: "pixelated",
          "--sel-scale": scale,
        }}
      />
    </div>
  )
}
