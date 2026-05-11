import React from "react"
import { useState } from "react"

export default function CustomizerButton({ onClick }) {
  const [hover, setHover] = useState(false)

  return (
    <img
      src={hover 
        ? "/CTA_personnaliser_hover.svg" 
        : "/CTA_personnaliser.svg"}
      
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") setHover(true)
      }}
      onPointerLeave={() => setHover(false)}
      onPointerCancel={() => setHover(false)}
      onClick={onClick}

      style={{
        position: "fixed",
        right: "24px",
        top: "50%",
        transform: "translateY(-50%)",
        width: "220px",
        cursor: "pointer",
        zIndex: 20,
        touchAction: "manipulation"
      }}
    />
  )
}
