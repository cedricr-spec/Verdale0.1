import React from "react";
import { useWorldStore } from "../store/worldSlice";

export default function WorldLayer() {
  const worldOffset = useWorldStore((s) => s.worldOffset);

  const x = worldOffset?.x || 0;
  const y = worldOffset?.y || 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,

        // 👉 fake background visuel pour debug
        backgroundImage: `
          linear-gradient(45deg, #333 25%, transparent 25%),
          linear-gradient(-45deg, #333 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #333 75%),
          linear-gradient(-45deg, transparent 75%, #333 75%)
        `,
        backgroundSize: "40px 40px",

        // 🔥 LA LIGNE IMPORTANTE
        backgroundPosition: `${x}px ${y}px`,

        pointerEvents: "none",
        zIndex: 0
      }}
    />
  );
}