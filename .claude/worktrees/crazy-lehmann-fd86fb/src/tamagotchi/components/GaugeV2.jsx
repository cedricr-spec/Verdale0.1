import * as React from "react";
import ENERGY from "../../hud/jauges/jauge_energie.png";
import FOOD from "../../hud/jauges/jauge_food.png";
import HAPPINESS from "../../hud/jauges/jauge_hapiness.png";
import HEALTH from "../../hud/jauges/jauge_health.png";
import GaugeV2_Inner from "./GaugeV2_Inner";

export default function GaugeV2({ value = 0, type = "energy" }) {
  const ICONS = {
    energy: ENERGY,
    food: FOOD,
    happiness: HAPPINESS,
    health: HEALTH
  };

  const icon = ICONS[type];

  // BASE IMAGE SIZE (source PNG)
  const BASE_WIDTH = 876;
  const BASE_HEIGHT = 240;

  // INNER GAUGE BOX (adjust these in PX from your original PNG)
  const INNER = {
    right: 520,   // 🔥 distance depuis la DROITE (contrôle position X)
    y: 62,       // 🔥 distance depuis le TOP (contrôle position Y)
    width: 620,  // 🔥 scale h  orizontal
    height: 120  // 🔥 scale vertical
  };

  const INNER_SCALE = 0.18; // 🔥 tweak this to resize inner gauge

  return (
    <div
      style={{
        position: "relative",
        display: "block",
        width: "clamp(160px, 6vw, 360px)", // 🔥 CONTROL GLOBAL SCALE HERE (bigger gauges)
        aspectRatio: "876 / 240"
      }}
    >
      {/* FRAME IMAGE */}
      <img
        src={icon}
        alt="gauge"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "fit-content",
          height: "100%",
          objectFit: "contain",
          imageRendering: "pixelated"
        }}
      />

      {/* INNER FILL */}
      <div
        style={{
          position: "absolute",
          right: `${(INNER.right / BASE_WIDTH) * 100}%`, // 🔥 position depuis la droite
          top: `${(INNER.y / BASE_HEIGHT) * 100}%`, // 🔥 position depuis le top
          width: `${(INNER.width / BASE_WIDTH) * 100}%`,
          height: `${(INNER.height / BASE_HEIGHT) * 100}%`,
          transform: `scale(${INNER_SCALE})`, // 🔥 SCALE CONTROL HERE
          transformOrigin: "top right",
          zIndex: 2
        }}
      >
        <GaugeV2_Inner value={value} />
      </div>
    </div>
  );
}
