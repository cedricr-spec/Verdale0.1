import React from "react"
import { useWorldStore } from "../store/worldSlice"

export default function PrairieBackground() {
  const worldOffset = useWorldStore((s) => s.worldOffset || { x: 0, y: 0 });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,

        // 🌱 base
        backgroundColor: "#7aa14b",

        // 🌱 overlay seamless
        backgroundImage: "url('/bg/bg_prairie_overlay.webp')",
        backgroundRepeat: "repeat",
        backgroundPosition: `${worldOffset.x}px ${worldOffset.y}px`,

        // 👉 important pour pixel art
        imageRendering: "pixelated",

        // 👉 scale du pattern
        backgroundSize: "128px"
      }}
    />
  )
}