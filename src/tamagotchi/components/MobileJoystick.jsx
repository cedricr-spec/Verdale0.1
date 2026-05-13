import React, { useEffect, useRef, useState } from "react";

const RADIUS = 67;
const THUMB_R = 22;
const DEAD_ZONE = 0.06;
const VISUAL_LAYER_Z_INDEX = 150;
const VIEWPORT_SELECTOR = "[data-world-viewport-frame]";

const VISUAL_LAYER_STYLE = {
  position: "fixed",
  inset: 0,
  zIndex: VISUAL_LAYER_Z_INDEX,
  pointerEvents: "none",
};

const RING_STYLE = {
  position: "absolute",
  width: `${RADIUS * 2}px`,
  height: `${RADIUS * 2}px`,
  borderRadius: "50%",
  border: "1.5px solid rgba(255, 255, 255, 0.16)",
  background: "rgba(255, 255, 255, 0.05)",
  boxSizing: "border-box",
};

const THUMB_STYLE = {
  position: "absolute",
  width: `${THUMB_R * 2}px`,
  height: `${THUMB_R * 2}px`,
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.52)",
  boxShadow: "0 0 10px rgba(255, 255, 255, 0.25)",
  willChange: "transform",
};

function isWorldViewportTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(VIEWPORT_SELECTOR));
}

export default function MobileJoystick({
  onVectorChange,
  inputBlocked = false,
}) {
  const activePointerRef = useRef(null);
  const centerRef = useRef({ x: 0, y: 0 });
  const [visualState, setVisualState] = useState(null);

  const reset = (pointerId = null) => {
    if (
      pointerId !== null &&
      pointerId !== undefined &&
      activePointerRef.current !== pointerId
    ) {
      return;
    }

    activePointerRef.current = null;
    setVisualState(null);
    onVectorChange({ x: 0, y: 0 });
  };

  const applyVector = (clientX, clientY) => {
    const cx = centerRef.current.x;
    const cy = centerRef.current.y;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const magnitude = Math.min(1, dist / RADIUS);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    const thumbX = nx * magnitude * RADIUS;
    const thumbY = ny * magnitude * RADIUS;

    setVisualState({
      x: cx,
      y: cy,
      thumbX,
      thumbY,
    });

    if (magnitude < DEAD_ZONE) {
      onVectorChange({ x: 0, y: 0 });
      return;
    }

    onVectorChange({
      x: nx * magnitude,
      y: ny * magnitude,
    });
  };

  useEffect(() => {
    if (inputBlocked) {
      reset();
    }
  }, [inputBlocked]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (inputBlocked) return;
      if (activePointerRef.current !== null) return;
      if (event.pointerType !== "touch") return;
      if (event.button !== undefined && event.button !== 0) return;
      if (!isWorldViewportTarget(event.target)) return;

      activePointerRef.current = event.pointerId;
      centerRef.current = { x: event.clientX, y: event.clientY };

      if (event.cancelable) {
        event.preventDefault();
      }

      applyVector(event.clientX, event.clientY);
    };

    const handlePointerMove = (event) => {
      if (event.pointerId !== activePointerRef.current) return;

      if (event.cancelable) {
        event.preventDefault();
      }

      applyVector(event.clientX, event.clientY);
    };

    const handlePointerUp = (event) => {
      reset(event.pointerId);
    };

    const handlePointerCancel = (event) => {
      reset(event.pointerId);
    };

    const handleWindowBlur = () => {
      reset();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        reset();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, { passive: false });
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      activePointerRef.current = null;
      onVectorChange({ x: 0, y: 0 });
    };
  }, [inputBlocked]);

  return (
    <div style={VISUAL_LAYER_STYLE} aria-hidden="true">
      {visualState ? (
        <div
          style={{
            ...RING_STYLE,
            left: `${Math.round(visualState.x - RADIUS)}px`,
            top: `${Math.round(visualState.y - RADIUS)}px`,
          }}
        >
          <div
            style={{
              ...THUMB_STYLE,
              left: "50%",
              top: "50%",
              transform: `translate(calc(-50% + ${visualState.thumbX}px), calc(-50% + ${visualState.thumbY}px))`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
