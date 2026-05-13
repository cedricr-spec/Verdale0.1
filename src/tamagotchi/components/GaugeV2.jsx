import * as React from "react";
import { useEffect, useRef } from "react";
import { getGaugeFrameFromPercent } from "../../hud/jauges/hudGaugeAtlas";
import SPRITESHEET from "../../hud/jauges/Bars & Meters.png";

// Native frame dimensions from the spritesheet
const FRAME_W = 36;
const FRAME_H = 12;
const GAUGE_SCALE = 4;
const DISPLAY_W = FRAME_W * GAUGE_SCALE;
const DISPLAY_H = FRAME_H * GAUGE_SCALE;

const LABELS = {
  energy:    "ENERGY",
  food:      "HUNGER",
  happiness: "HAPPY",
  health:    "HEALTH",
};

// Preload spritesheet once, shared across all gauge instances
const spritesheetImg = new Image();
spritesheetImg.src = SPRITESHEET;

// Width lives in CSS (.gauge-v2-outer) so the media query can shrink it on mobile
const OUTER_STYLE = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  width: "fit-content",
  height: "fit-content",
};

const GaugeV2 = React.memo(function GaugeV2({ value = 0, type = "energy" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    const frame = getGaugeFrameFromPercent(value);

    const draw = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, DISPLAY_W, DISPLAY_H);
      ctx.drawImage(
        spritesheetImg,
        frame.x, frame.y, frame.w, frame.h,
        0, 0, DISPLAY_W, DISPLAY_H
      );
    };

    if (spritesheetImg.complete && spritesheetImg.naturalWidth > 0) {
      draw();
    } else {
      spritesheetImg.addEventListener("load", draw, { once: true });
      return () => spritesheetImg.removeEventListener("load", draw);
    }
  }, [value]);

  return (
    <div className="gauge-v2-outer" style={OUTER_STYLE}>
      <span className="gauge-v2-label">{LABELS[type] ?? type.toUpperCase()}</span>
      <div
        className="gauge-v2-visual"
        style={{
          position: "relative",
          width: `${DISPLAY_W - 22}px`,
          height: `${DISPLAY_H-3}px`,
          imageRendering: "pixelated",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            boxSizing: "border-box",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
        <canvas
          className="gauge-v2-canvas"
          ref={canvasRef}
          width={DISPLAY_W}
          height={DISPLAY_H}
          style={{
            width: `${DISPLAY_W}px`,
            height: `${DISPLAY_H}px`,
            display: "block",
            imageRendering: "pixelated",
          }}
        />
      </div>
    </div>
  );
});

export default GaugeV2;
