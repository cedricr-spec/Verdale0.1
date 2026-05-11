import React from "react";
import { usePetStore } from "../store/usePetStore";
import HUD_BACK from "../../hud/HUD_BACK.webp";
import HUD_FRONT from "../../hud/HUD_FRONT.webp";
import Gauge from "./Gauge";

export default function PetHUD() {
  const hunger = usePetStore((s) => s.hunger);
  const energy = usePetStore((s) => s.energy);
  const happiness = usePetStore((s) => s.happiness);
  const health = usePetStore((s) => s.health);
  const modelColor = usePetStore((s) => s.theme.modelColor);
  const gradientAnimation = usePetStore((s) => s.theme?.gradientAnimation);

  // 🎛️ GRADIENT CONTROLS (tweak here)
  const gradientWidth = "20%"; // width of gradient
  const gradientSideOffset = "5%"; // distance from edges
  const gradientVerticalInset = "16%"; // top & bottom crop
  const gradientOpacity = 1;
  const gradientBlur = 16; // px
  const gradientIntensity = 0.2; // how fast it fades (lower = sharper)
  const gradientColor = "var(--hud-grad-2)";

  // 🔧 global scale control (1 = normal, 1.3 = bigger, 0.8 = smaller)
  const hudScale = 1.5;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "40px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 10,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end"
      }}
    >
      <div
        style={{
          transform: `scale(${hudScale})`,
          transformOrigin: "center bottom",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        {/* SHADOW FRAME */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "1vh",
            transform: "translateX(-50%) translateY(5%)",
            width: "70%",
            height: "60%",
            pointerEvents: "none",
            zIndex: 0,
            boxShadow: `
              0px 8px 16px rgba(0,0,0,1),
              0px 24px 48px rgba(0,0,0,0.35),
              0px 64px 96px rgba(0,0,0,0.1)
            `
          }}
        />
        <div
          style={{
            position: "relative",
            width: "500px",
            padding: "0",
            background: "transparent",
            overflow: "hidden",
            borderRadius: "12px",
            zIndex: 1,
            display: "block"
          }}
        >
          <div style={{ lineHeight: 0 }}>
            <img
              src={HUD_BACK}
              style={{
                display: "block",
                width: "100%",
                height: "auto",
                opacity: 0,
                pointerEvents: "none"
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 1
            }}
          >
            <img
              src={HUD_BACK}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                zIndex: 0
              }}
            />

            {/* GRADIENT LAYER (no layout impact) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                overflow: "hidden",
                pointerEvents: "none",
                zIndex: 1
              }}
            >
              {/* LEFT */}
              <div
                style={{
                  position: "absolute",
                  left: gradientSideOffset,
                  top: gradientVerticalInset,
                  bottom: gradientVerticalInset,
                  width: gradientWidth,
                  background: `radial-gradient(ellipse at left center, var(--hud-grad-1) 0%, var(--hud-grad-2) 40%, rgba(0,0,0,0) 100%)`,
                  opacity: gradientOpacity,
                  mixBlendMode: "screen",
                  filter: `blur(${gradientBlur * 0.8}px)`,
                  transformOrigin: "left center",
                  animation: `hudPulse var(--hud-gradient-speed) ease-in-out infinite`
                }}
              />

              {/* RIGHT */}
              <div
                style={{
                  position: "absolute",
                  right: gradientSideOffset,
                  top: gradientVerticalInset,
                  bottom: gradientVerticalInset,
                  width: gradientWidth,
                  background: `radial-gradient(ellipse at right center, var(--hud-grad-1) 0%, var(--hud-grad-2) 40%, rgba(0,0,0,0) 100%)`,
                  opacity: gradientOpacity,
                  mixBlendMode: "screen",
                  filter: `blur(${gradientBlur * 0.8}px)`,
                  transformOrigin: "right center",
                  animation: `hudPulse var(--hud-gradient-speed) ease-in-out infinite`
                }}
              />
            </div>

            <img
              src={HUD_FRONT}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                zIndex: 2
              }}
            />
            {/* COLOR TINT FROM THEME (same system as ActionsHUD) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: "var(--hud-overlay-color, var(--hud-grad-1))",
                mixBlendMode: "overlay",
                filter: "saturate(1.7)",
                zIndex: 2,
                WebkitMaskImage: `url(${HUD_FRONT})`,
                WebkitMaskSize: "100% 100%",
                WebkitMaskRepeat: "no-repeat",
                maskImage: `url(${HUD_FRONT})`,
                maskSize: "100% 100%",
                maskRepeat: "no-repeat"
              }}
            />
          </div>
          {/* CONTENT WRAPPER (does NOT affect container size) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: "0 8%",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 3
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "3%",
                alignItems: "center",
                width: "100%",
                height: "100%",
                transform: "scale(1)",
                maxWidth: "100%",
                overflow: "hidden"
              }}
            >
              {[
                { label: "Hunger", value: hunger },
                { label: "Energy", value: energy },
                { label: "Happiness", value: happiness },
                { label: "Health", value: health }
              ].map((stat) => {
                const isLow = stat.value < 40;

                return (
                  <div
                    key={stat.label}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "stretch",
                      height: "100%",
                    }}
                  >
                    <div style={{ width: "100%", height: "100%" }}>
                      <Gauge
                        value={stat.value}
                        label={stat.label}
                        isLow={isLow}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}