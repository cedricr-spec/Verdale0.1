import React, { forwardRef, useState } from "react"

const TintedCtaButton = forwardRef(function TintedCtaButton(
  {
    defaultSrc,
    pressedSrc,
    tintColor = "#8f8f8f",
    label = "",
    labelClassName = "",
    ariaLabel,
    onClick,
    disabled = false,
    width,
    height,
    style,
  },
  ref
) {
  const [pressed, setPressed] = useState(false)
  const imageSrc = pressed ? pressedSrc : defaultSrc

  return (
    <button
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (disabled) return
        e.preventDefault()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        setPressed(true)
      }}
      onPointerUp={(e) => {
        if (disabled) return
        e.currentTarget.releasePointerCapture?.(e.pointerId)
        setPressed(false)
        onClick?.()
      }}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      style={{
        width,
        height,
        border: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
        ...style,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <img
          src={imageSrc}
          alt=""
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            imageRendering: "pixelated",
            display: "block",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitUserDrag: "none",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: tintColor,
            mixBlendMode: "color",
            pointerEvents: "none",
            WebkitMaskImage: `url(${imageSrc})`,
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            WebkitMaskSize: "contain",
            maskImage: `url(${imageSrc})`,
            maskRepeat: "no-repeat",
            maskPosition: "center",
            maskSize: "contain",
          }}
        />

        {label ? (
          <div
            className={labelClassName}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            {label}
          </div>
        ) : null}
      </div>
    </button>
  )
})

export default TintedCtaButton
