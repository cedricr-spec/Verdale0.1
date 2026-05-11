import * as React from "react";
import { useMemo } from "react";
import INNER_IMG from "../../hud/jauges/jauge_inner.png";

// ⚠️ Fixed pixel base (624x84). Scaling must be applied from parent (GaugeV2) to keep image + fill aligned.

const TOTAL_CHUNKS = 10;

const OUTER_STYLE = { display: "inline-block", width: "fit-content", height: "fit-content" };
const CONTAINER_STYLE = { width: "624px", height: "108px", position: "relative", transformOrigin: "top right" };
const IMG_STYLE = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", zIndex: 1 };
const FILL_ROW_STYLE = { position: "absolute", top: "11.11%", left: "1.92%", width: "96.15%", height: "77.77%", display: "flex", alignItems: "center", gap: "2%", zIndex: 2 };
const CHUNK_BASE_STYLE = { width: "8%", height: "100%", imageRendering: "pixelated", flexShrink: 0, transition: "background 0.2s linear, box-shadow 0.2s linear" };

const GaugeV2_Inner = React.memo(function GaugeV2_Inner({ value = 0 }) {
  const activeChunks = Math.round((value / 100) * TOTAL_CHUNKS);

  const { color, shadow } = useMemo(() => {
    const t = value / 100;
    const hue = Math.pow(t, 2) * 120;
    const c = `hsl(${hue}, 70%, 45%)`;
    const soft = `hsl(${hue} 70% 45% / 0.25)`;
    return {
      color: c,
      shadow: `0 0 6px ${c}, 0 0 12px ${c}, 0 0 20px ${soft}, 0 0 40px ${soft}`,
    };
  }, [value]);

  return (
    <div style={OUTER_STYLE}>
      <div style={CONTAINER_STYLE}>
        <img src={INNER_IMG} alt="" style={IMG_STYLE} />
        <div style={FILL_ROW_STYLE}>
          {Array.from({ length: TOTAL_CHUNKS }).map((_, i) => {
            const active = i < activeChunks;
            return (
              <div
                key={i}
                style={{
                  ...CHUNK_BASE_STYLE,
                  background: active ? color : "transparent",
                  boxShadow: active ? shadow : "none",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default GaugeV2_Inner;
