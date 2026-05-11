import React from "react"
import { usePetStore } from "../tamagotchi/store/usePetstore"
import TintedCtaButton from "./TintedCtaButton"
import mediumCta from "../hud/CTAs/CTA_Medium_8BIT.webp"
import mediumCtaPressed from "../hud/CTAs/CTA_Medium_8BIT_Pressed.webp"

export default function PanelItem({ label, selected = false, onClick }) {
  const debugUI = usePetStore((s) => s.debugUI)
  const tintColor = usePetStore((s) => s.theme?.modelColor || "#8f8f8f")

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        outline: debugUI ? "2px solid red" : "none",
      }}
    >
      <TintedCtaButton
        ariaLabel={label}
        defaultSrc={mediumCta}
        pressedSrc={mediumCtaPressed}
        tintColor={selected ? "#ffffff" : tintColor}
        label={label}
        labelClassName="hud-ui-text hud-ui-text--cta"
        onClick={onClick}
        width="100%"
        height="52px"
        style={{
          filter: selected ? "brightness(1.08)" : "none",
        }}
      />

      {debugUI && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 10
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "rgba(255,0,0,0.2)" }} />
          <div style={{ position: "absolute", left: "10%", right: "10%", top: "20%", bottom: "20%", background: "rgba(0,255,0,0.2)" }} />
        </div>
      )}
    </div>
  )
}
