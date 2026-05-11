import React from "react";
import OVERLAY_GLASS from "../../hud/Overlay_Glass.webp";

export default function ContextFrame({ hoveredAction }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "420px",
        padding: "12px",
        borderRadius: "16px",
        position: "relative",
        background: "#0a0a0a",
        overflow: "hidden",
      }}
    >
      {/* GLASS */}
      <img
        src={OVERLAY_GLASS}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          pointerEvents: "none",
          opacity: 1,
          zIndex: 2
        }}
      />

      {/* CONTENT */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          color: "white",
          fontSize: "clamp(10px, 1vw, 14px)",
          opacity: hoveredAction ? 1 : 0,
          transition: "opacity 0.25s ease"
        }}
      >
        {hoveredAction && (
          <>
            <div
              style={{
                fontWeight: 600,
                marginBottom: "6px"
              }}
            >
              {hoveredAction.label}
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "6px"
              }}
            >
              {hoveredAction.effects &&
                Object.entries(hoveredAction.effects).map(([k, v], i) => (
                  <span
                    key={i}
                    style={{
                      color: v > 0 ? "#4cff7a" : "#ff5c5c",
                      fontSize: "0.9em"
                    }}
                  >
                    {v > 0 ? "+" : ""}{v} {k}
                  </span>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}