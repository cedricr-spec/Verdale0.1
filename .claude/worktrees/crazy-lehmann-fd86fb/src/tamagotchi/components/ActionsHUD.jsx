import React, { useState } from "react";
import { usePetStore } from "../store/usePetstore";
import BG_BACK from "../../hud/ActionsHUD_BACK.webp";
import BG_FRONT from "../../hud/ActionsHUD_FRONT.webp";
import BG_TEXT from "../../hud/ActionsHUD_bg_text.webp";
import GameActions from "./GameActions";
import OVERLAY_GLASS from "../../hud/Overlay_Glass.webp";


export default function ActionsHUD() {
  const [hoveredAction, setHoveredAction] = useState(null);
  const [history, setHistory] = useState([]);

  const debugUI = usePetStore((s) => s.debugUI);
  const getColor = usePetStore((s) => s.getDebugColor);

  const styles = `
.hud-gradient {
  animation: hudPulse var(--hud-gradient-speed) ease-in-out infinite;
  transform-origin: center top;
}

.action-title {
  font-style: normal;
  font-weight: 600;
  margin-bottom: 0.5vh;
}

.action-effects {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4vw;
}

.effect {
  font-size: 0.9em;
}

.effect.positive {
  color: #4cff7a;
}

.effect.negative {
  color: #ff5c5c;
}

.action-placeholder {
  opacity: 0.6;
  font-style: italic;
}

.text-bg {
  box-shadow:
    inset 0 0 40px rgba(0,0,0,0.35),
    0 10px 30px rgba(0,0,0,0.25);
}
`;

  return (
    <div
      style={{
        position: "fixed",
        right: "3vw",
        bottom: "16vh",
        width: "320px",
        aspectRatio: "1482 / 3218",
        height: "auto",
        zIndex: 1000,
        pointerEvents: "auto",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        borderRadius: "24px",
        overflow: "hidden",
        // TODO: Keep HUD at fixed size (no responsive scaling). Mobile version will be handled separately with a deploy/expand behavior.
        transform: "scale(1)",
        transformOrigin: "bottom right",
      }}
    >
      {debugUI && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: getColor("layout"),
          pointerEvents: "none",
          zIndex: 0
        }} />
      )}
      <style>{styles}</style>

      {/* BACK */}
      <img
        src={BG_BACK}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          pointerEvents: "none"
        }}
      />

      /*
      GRADIENT CONTROLS:
      - height: controls how high the glow goes (e.g. 60% → subtle, 100% → very strong)
      - background (radial-gradient):
          - 50% 100% = origin (center bottom)
          - color stops (0%, 25%, 45%, 75%) = spread of colors
      - filter: blur(px) → softness of glow (higher = softer)
      - opacity: overall intensity
      - animation (hud-gradient): pulse strength/speed
      */
      {/* BOTTOM GRADIENT */}
      <div
        className="hud-gradient"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          margin: "0 auto",
          bottom: "8%",
          width: "80%",
          height: "6%",
          pointerEvents: "none",
          background: `radial-gradient(circle at 50% 0%,
            var(--hud-grad-1) 0%,
            var(--hud-grad-2) 35%,
            var(--hud-grad-3) 65%,
            rgba(0,0,0,0) 80%)`,
          filter: "blur(2vw)",
          opacity: 1,
          zIndex: 0,
        }}
      >
        {debugUI && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: getColor("overlay"),
            pointerEvents: "none",
            zIndex: 0
          }} />
        )}
      </div>

      {/* FRONT */}
      <img
        src={BG_FRONT}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          pointerEvents: "none",
          zIndex: 1
        }}
      />

      {/* COLOR TINT FROM THEME */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "var(--hud-overlay-color, var(--hud-grad-1))",
          mixBlendMode: "overlay",
          brightness: "1.2",
          filter: "saturate(1.7)",
          zIndex: 1,
          WebkitMaskImage: `url(${BG_FRONT})`,
          WebkitMaskSize: "100% 100%",
          WebkitMaskRepeat: "no-repeat",
          maskImage: `url(${BG_FRONT})`,
          maskSize: "100% 100%",
          maskRepeat: "no-repeat",
        }}
      />

      {/* CONTENT */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "6%",
          zIndex: 3
        }}
      >
        {debugUI && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: getColor("content"),
            pointerEvents: "none",
            zIndex: 0
          }} />
        )}

          {/* DESCRIPTION */}
          <div
            style={{
              flex: 1,
              minHeight: "42%",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              position: "relative",
              marginTop: "0",
            }}
          >
            {/* BG TEXT */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "16px",
                overflow: "hidden",

                // base background replaced with stroke effect and highlight
                background: `
                  linear-gradient(#0a0a0a, #0a0a0a) padding-box,
                  radial-gradient(circle at 50% -10%, rgba(255,255,255,0.35), rgba(255,255,255,0) 30%) border-box
                `,

                border: "1px solid transparent",

                // inner shadow (top-right light direction)
                boxShadow: `
                  inset -30px 30px 80px rgba(0, 0, 0, 0.45),
                  inset -10px 10px 40px rgba(0, 0, 0, 0.25)
                `,
                zIndex: 0,
              }}
            >
              {/* GLASS OVERLAY */}
              <img
                src={OVERLAY_GLASS}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  pointerEvents: "none",
                  zIndex: 3,
                  opacity: 1
                }}
              />
            </div>

            {/* TEXT */}
            <div
              style={{
                position: "relative",
                width: "100%",
                padding: "8%",
                textAlign: "left",
                fontSize: "clamp(10px, 1.2vw, 16px)",
                color: "white",
                opacity: hoveredAction ? 1 : 0,
                transition: "opacity 0.25s ease",
                zIndex: 3,
              }}
            >
              {debugUI && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  background: getColor("text"),
                  pointerEvents: "none",
                  zIndex: 0
                }} />
              )}
              {hoveredAction && (
                <>
                  <div className="action-title">
                    {hoveredAction.label}
                  </div>

                  <div className="action-effects">
                    {hoveredAction.effects &&
                      Object.entries(hoveredAction.effects).map(([k, v], i) => (
                        <span
                          key={i}
                          className={`effect ${v > 0 ? "positive" : "negative"}`}
                        >
                          {v > 0 ? "+" : ""}{v} {k}
                        </span>
                      ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* TOP FRAME */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "50%",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "1 / 1",
                maxWidth: "95%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: "scale(1)",
                transformOrigin: "center"
              }}
            >
              <GameActions
                onHover={(action) => setHoveredAction(action)}
                onAction={(action) => {
                  setHistory((prev) => [action.label, ...prev].slice(0, 5));
                }}
              />
            </div>
          </div>

      </div>
    </div>
  );
}