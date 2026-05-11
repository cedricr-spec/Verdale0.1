import React from "react";
import GAUGE_CENTER from "../../hud/HUD_GAUGE_CENTER.webp";
import { usePetStore } from "../store/usePetStore";

export default function Gauge({ value = 0, label, labelScale = 0.5 }) {
  const modelColor = usePetStore((s) => s.modelColor);
  // 🎨 Dynamic color from red → orange → green
  const getGaugeColor = (v) => {
    const clamped = Math.max(0, Math.min(100, v));
    
    if (clamped < 50) {
      // red → orange
      const t = clamped / 50;
      const r = 255;
      const g = Math.round(120 * t);
      return `rgb(${r}, ${g}, 0)`;
    } else {
      // orange → green
      const t = (clamped - 50) / 50;
      const r = Math.round(255 * (1 - t));
      const g = 180 + Math.round(75 * t);
      return `rgb(${r}, ${g}, 0)`;
    }
  };

  const gaugeColor = getGaugeColor(value);

  const radius = 36; // more space from center
  const stroke = 1.6; // ultra thin like Figma
  const normalizedRadius = radius - stroke / 2;

  const fullCircumference = normalizedRadius * 2 * Math.PI;
  const arcLength = fullCircumference * 0.75; // cleaner symmetric arc
  const progress = (value / 100) * arcLength;
  const strokeDasharray = `${arcLength} ${fullCircumference}`;
  const strokeDashoffset = arcLength - progress;

  return (
    <div
      className="gauge-container"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        height: "100%",
        marginTop: "1vh",
        transform: "scale(0.85)",
        transformOrigin: "top center",
      }}
    >
      {/* LABEL WITH PANEL */}
      <div
        className="gauge-label-wrapper"
        style={{
          position: "relative",
          borderRadius: "3px",
          overflow: "hidden",
          minHeight: "28px",
          height: "auto",
          lineHeight: 1,
          border: "0.5px solid transparent",
          boxShadow: `
            inset -20px 20px 40px rgba(0,0,0,0.4),
            inset -8px 8px 20px rgba(0,0,0,0.25)
          `,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          flexShrink: 0,
          alignSelf: "stretch",
        }}
      >
        <span
          className="gauge-label-text"
          style={{
            position: "relative",
            zIndex: 1,
            color: "white",
            fontSize: "0.8em",
            textAlign: "center",
            width: "Fit-content"
          }}
        >
          {label}
        </span>
      </div>
      <div
        className="gauge-ring-wrapper"
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          aspectRatio: "1 / 1",
          maxWidth: "100%",
        }}
      >
        {/* SVG RING */}
        <svg
          viewBox="0 0 100 100"
          width="100%"
          height="100%"
          style={{ transform: "rotate(135deg)", zIndex: 1, position: "relative" }}
        >
          {/* BACK */}
          <circle
            stroke="rgba(0,0,0,0.9)"
            strokeLinecap="round"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx="50"
            cy="50"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={0}
            style={{
              filter: "drop-shadow(0 0 0.3px rgba(255,255,255,0.2))"
            }}
          />

          {/* PROGRESS */}
          <circle
            stroke={gaugeColor}
            fill="transparent"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            r={normalizedRadius}
            cx="50"
            cy="50"
            style={{
              transition: "stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1)"
            }}
          />

          {/* GLOW */}
          <circle
            stroke={gaugeColor}
            fill="transparent"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            r={normalizedRadius + 0.5}
            cx="50"
            cy="50"
            style={{
              filter: "blur(6px)",
              opacity: 0.5
            }}
          />

          {/* END DOT GLOW */}
          {(() => {
            const alpha = Math.max(0, Math.min(1, value / 5));
            const totalArc = 1.5 * Math.PI;
            const angle = (progress / arcLength) * totalArc;

            const x = 50 + normalizedRadius * Math.cos(angle);
            const y = 50 + normalizedRadius * Math.sin(angle);

            return (
              <circle
                r={3.5}
                cx={x}
                cy={y}
                fill={gaugeColor}
                style={{
                  filter: "blur(3px)",
                  opacity: 0.3 * alpha,
                  transition: "cx 0.6s cubic-bezier(0.22, 1, 0.36, 1), cy 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease"
                }}
              />
            );
          })()}
        </svg>

        {/* VALUE */}
        <div
          className="gauge-value gauge-label-text"
          style={{
            color: gaugeColor
          }}
        >
          {Math.round(value)}
        </div>

        {/* CENTER WRAPPER */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "52%",
            height: "52%",
            transform: "translate(-50%, -50%)",
            borderRadius: "9999px",
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 2,
            boxShadow: `
              0px 12px 27px rgba(0,0,0,0.45),
              3px 48px 48px rgba(0,0,0,0.39),
              9px 111px 66px rgba(0,0,0,0.23),
              18px 195px 78px rgba(0,0,0,0.07),
              27px 306px 87px rgba(0,0,0,0.01)
            `
          }}
        >
          <img
            src={GAUGE_CENTER}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block"
            }}
          />
        </div>
      </div>
    </div>
  );
}