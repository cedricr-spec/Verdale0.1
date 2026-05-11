import * as React from "react";
import INNER_IMG from "../../hud/jauges/jauge_inner.png";

// ⚠️ Fixed pixel base (624x84). Scaling must be applied from parent (GaugeV2) to keep image + fill aligned.

export default function GaugeV2_Inner({ value = 0 }) {
  // CONFIG (pixel perfect based on your specs)
  const CHUNK_WIDTH = 48;
  const GAP = 12;
  const TOTAL_CHUNKS = 10; // adjust if needed

  const activeChunks = Math.round((value / 100) * TOTAL_CHUNKS);
  // 🔥 COLOR (green → orange → red)
  const t = value / 100;
  const hue = Math.pow(t, 2) * 120; // 🔥 faster transition to red (compresses orange zone)
  const color = `hsl(${hue}, 70%, 45%)`; // 🔥 less flashy green (reduced saturation + lightness)
  const colorSoft = `hsl(${hue} 70% 45% / 0.25)`; // 🔥 softer diffuse glow

  return (
    <div
      style={{
        display: "inline-block",
        width: "fit-content",
        height: "fit-content"
      }}
    >
      <div
        style={{
          width: "624px",
          height: "108px",
          position: "relative",
          transformOrigin: "top right"
        }}
      >
        {/* INNER IMAGE (background) */}
        <img
          src={INNER_IMG}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            pointerEvents: "none",
            zIndex: 1
          }}
        />

        {/* FILL */}
        <div
          style={{
            position: "absolute",
            top: "11.11%",   // 12 / 108
            left: "1.92%",   // (12 + 0 offset removed) / 624
            width: "96.15%", // 600 / 624
            height: "77.77%", // 84 / 108
            display: "flex",
            alignItems: "center",
            gap: "2%", // 12 / 600
            zIndex: 2
          }}
        >
          {Array.from({ length: TOTAL_CHUNKS }).map((_, i) => (
            <div
              key={i}
              style={{
                width: "8%", // 48 / 600
                height: "100%",
                background: i < activeChunks ? color : "transparent",
                imageRendering: "pixelated",
                flexShrink: 0,
                boxShadow: i < activeChunks
                  ? `
                      0 0 6px ${color},
                      0 0 12px ${color},
                      0 0 20px ${colorSoft},
                      0 0 40px ${colorSoft}
                    ` // 🔥 glow + diffuse glow
                  : "none",
                transition: "background 0.2s linear, box-shadow 0.2s linear"
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}