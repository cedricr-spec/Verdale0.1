import React from "react"
import bitmapBg from "../../hud/bg_bitmap_b_andw.webp"

// Shared full-screen menu backdrop: dark translucent blur + decorative bottom bitmap.
// Use forwardRef so callers can attach panelRef directly (e.g. for click-outside detection).
// Pass extra props (onPointerDown, aria-hidden, etc.) via spread.
const MenuBackdrop = React.forwardRef(function MenuBackdrop(
  { open = true, zIndex = 999998, style = {}, className = "", children = null, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={`menu-backdrop${className ? ` ${className}` : ""}`}
      {...rest}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(6, 10, 18, 0.34)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        isolation: "isolate",
        zIndex,
        pointerEvents: open ? "auto" : "none",
        opacity: open ? 1 : 0,
        visibility: open ? "visible" : "hidden",
        transition: "opacity 0.2s linear, visibility 0.2s linear",
        ...style,
      }}
    >
      <img
        src={bitmapBg}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="lazy"
        className="menu-backdrop__bitmap"
      />
      {children}
    </div>
  )
})

export default MenuBackdrop
