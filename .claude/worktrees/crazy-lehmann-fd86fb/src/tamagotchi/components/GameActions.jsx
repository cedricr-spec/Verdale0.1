import React from "react";
import { usePetStore } from "../store/usePetstore";
import EllipsePicker from "./Ellipse_Picker";
import CTA_ROUNDED from "../../GameActions/CTA_rounded_Game_Action.webp";

export default function GameActions({ onHover, onAction }) {
  const feed = usePetStore((s) => s.feed);

  const [open, setOpen] = React.useState("actions");
  const containerRef = React.useRef(null);

  const [pressed, setPressed] = React.useState(false);
  const [hover, setHover] = React.useState(false);

  const debugUI = usePetStore((s) => s.debugUI);
  const getColor = usePetStore((s) => s.getDebugColor);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",

        zIndex: 9999,
        pointerEvents: "auto",
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
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
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
        <button
          onClick={() => {
            setOpen((prev) => {
              const next = prev === "actions" ? null : "actions";
              if (!next) onHover?.(null);
              return next;
            });
          }}
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerLeave={() => { setPressed(false); setHover(false); }}
          onPointerCancel={() => { setPressed(false); setHover(false); }}
          onPointerEnter={(e) => {
            if (e.pointerType !== "touch") setHover(true);
          }}
          onFocus={(e) => e.target.blur()}
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            backgroundImage: `url(${CTA_ROUNDED})`,
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
            border: "none",
            cursor: "pointer",
            outline: "none",
            boxShadow: "none",
            backgroundColor: "transparent",
            transform: `scale(${pressed ? 0.92 : hover ? 1.05 : 1})`,
            transition: "transform 0.15s ease",
            position: "relative",
            zIndex: 2,
            flexShrink: 0,
            touchAction: "manipulation",
          }}
        >
          {debugUI && (
            <div style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: getColor("overlay"),
              pointerEvents: "none",
              zIndex: 0
            }} />
          )}
          <span style={{ fontSize: 26 }}>⚡</span>
        </button>
      </div>

      {open === "actions" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            zIndex: 3,
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
          <EllipsePicker
            radiusX={120}
            radiusY={120}
            onClose={() => {
              setOpen(null);
              onHover?.(null);
            }}
            onHover={onHover}
            onAction={onAction}
          />
        </div>
      )}
    </div>
  );
}
