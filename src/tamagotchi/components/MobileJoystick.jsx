import React, { useRef, useState } from "react";

// Outer touch zone radius (px) — ~22% larger than original 55 for better thumb reach
const RADIUS = 67;
// Thumb indicator radius (px)
const THUMB_R = 22;
// Radial dead zone — any magnitude below this threshold sends zero
const DEAD_ZONE = 0.06;

const ZONE_SIZE = RADIUS * 2;

const SHELL_STYLE = {
  position: "fixed",
  right: "24px",
  bottom: "110px",
  zIndex: 999,
  pointerEvents: "none",
};

const RING_STYLE = {
  width: ZONE_SIZE + "px",
  height: ZONE_SIZE + "px",
  borderRadius: "50%",
  border: "1.5px solid rgba(255, 255, 255, 0.16)",
  background: "rgba(255, 255, 255, 0.05)",
  position: "relative",
  boxSizing: "border-box",
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTapHighlightColor: "transparent",
  WebkitTouchCallout: "none",
  pointerEvents: "auto",
};

const THUMB_BASE_STYLE = {
  position: "absolute",
  width: THUMB_R * 2 + "px",
  height: THUMB_R * 2 + "px",
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.52)",
  boxShadow: "0 0 10px rgba(255, 255, 255, 0.25)",
  pointerEvents: "none",
  willChange: "transform",
};

export default function MobileJoystick({ onVectorChange }) {
  const ringRef = useRef(null);
  const activePointerRef = useRef(null);
  const centerRef = useRef({ x: 0, y: 0 });

  // null = thumb hidden, {x,y} = offset from zone center in px
  const [thumb, setThumb] = useState(null);

  const applyVector = (clientX, clientY) => {
    const cx = centerRef.current.x;
    const cy = centerRef.current.y;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Unit direction
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;

    // Magnitude clamped to 1
    const magnitude = Math.min(1, dist / RADIUS);

    // Thumb follows, clamped inside ring
    setThumb({ x: nx * magnitude * RADIUS, y: ny * magnitude * RADIUS });

    // Send zero inside dead zone, otherwise send normalized analog vector
    if (magnitude < DEAD_ZONE) {
      onVectorChange({ x: 0, y: 0 });
    } else {
      onVectorChange({ x: nx * magnitude, y: ny * magnitude });
    }
  };

  const release = (pointerId) => {
    if (activePointerRef.current !== pointerId) return;
    activePointerRef.current = null;
    setThumb(null);
    onVectorChange({ x: 0, y: 0 });
  };

  const handlePointerDown = (e) => {
    // Only track first touch
    if (activePointerRef.current !== null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerRef.current = e.pointerId;

    // Snapshot zone center once per gesture (handles orientation changes)
    const rect = ringRef.current.getBoundingClientRect();
    centerRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    applyVector(e.clientX, e.clientY);
  };

  const handlePointerMove = (e) => {
    if (e.pointerId !== activePointerRef.current) return;
    // Prevent page drag / rubber-band while the joystick is active.
    // Safe to call here because touchAction: "none" makes this listener non-passive.
    e.preventDefault();
    applyVector(e.clientX, e.clientY);
  };

  const handlePointerUp = (e) => release(e.pointerId);
  const handlePointerCancel = (e) => release(e.pointerId);

  return (
    <div style={SHELL_STYLE}>
      <div
        ref={ringRef}
        style={RING_STYLE}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onContextMenu={(e) => e.preventDefault()}
      >
        {thumb && (
          <div
            style={{
              ...THUMB_BASE_STYLE,
              left: "50%",
              top: "50%",
              transform: `translate(calc(-50% + ${thumb.x}px), calc(-50% + ${thumb.y}px))`,
            }}
          />
        )}
      </div>
    </div>
  );
}
