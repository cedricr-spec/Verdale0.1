import React from "react";
import { usePetStore } from "../store/usePetstore";
import GaugeV2 from "./GaugeV2";

export default function JaugesPanel({ embedded = false, ...props }) {
  const hunger = usePetStore((s) => s.hunger);
  const energy = usePetStore((s) => s.energy);
  const happiness = usePetStore((s) => s.happiness);
  const health = usePetStore((s) => s.health);

  const gauges = [
    ["energy", energy],
    ["food", hunger],
    ["happiness", happiness],
    ["health", health],
  ];

  return (
    <div
      data-hud="jauges"
      {...props}
      style={{
        position: "relative",
        inset: "auto",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: embedded ? "auto" : "none",
        zIndex: embedded ? "auto" : 20,
        width: embedded ? "100%" : undefined,
        height: embedded ? "100%" : undefined,
      }}
    >
      <div
        style={{
          width: embedded ? "min(100%, 520px)" : "fit-content",
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: "8px",
          marginBottom: 0,
        }}
      >
        {gauges.map(([type, value]) => (
          <div
            key={type}
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "fit-content",
              flex: "0 0 auto",
            }}
          >
            <GaugeV2 type={type} value={value} />
          </div>
        ))}
      </div>
    </div>
  );
}
