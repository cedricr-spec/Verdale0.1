import React, { useState } from "react"

export default function ArrowToggle({ open, onClick }) {
  const [hover, setHover] = useState(false)

  // 👉 inversé (gauche UI)
  const src = open
    ? (hover ? "/CTA_arrow_left_hover.svg" : "/CTA_arrow_left.svg")
    : (hover ? "/CTA_arrow_right_hover.svg" : "/CTA_arrow_right.svg")

  const panelWidth = 320
  const offset = 16
  const scale = 0.8

  return (
    <img
      src={src}
      onClick={onClick}
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") setHover(true)
      }}
      onPointerLeave={() => setHover(false)}
      onPointerCancel={() => setHover(false)}
      style={{
        position: "fixed",
        top: "50%",
        left: open ? `${panelWidth + offset}px` : `${offset}px`,
        transform: `translateY(-50%) scale(${scale})`,
        transformOrigin: "center",
        cursor: "pointer",
        zIndex: 20,
        transition: "left 0.35s ease",
        touchAction: "manipulation"
      }}
    />
  )
}
