import React, { useState } from "react"

export default function IconButton({
  defaultSrc,
  clickSrc,
  onClick,
  mode = "press" // 👈 par défaut comportement bouton
}) {
  const [active, setActive] = useState(false)

  const handleClick = () => {
    if (mode === "press") {
      setActive(true)

      setTimeout(() => {
        setActive(false)
      }, 150)
    }

    if (mode === "toggle") {
      setActive(!active)
    }

    onClick && onClick()
  }

  return (
    <img
      src={active ? clickSrc : defaultSrc}
      onClick={handleClick}
      style={{
        width: "44px",
        height: "44px",
        objectFit: "contain",
        cursor: "pointer",
        transition: "transform 0.15s ease",
        transform: active ? "scale(0.95)" : "scale(1)",
        touchAction: "manipulation"
      }}
    />
  )
}
