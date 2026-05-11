import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWorldStore } from "../store/worldSlice";
import { usePetStore } from "../store/usePetstore";

import controlUp from "../../hud/Control_Keys/Control_Up.webp";
import controlDown from "../../hud/Control_Keys/Control_Down.webp";
import controlLeft from "../../hud/Control_Keys/Control_Left.webp";
import controlRight from "../../hud/Control_Keys/Control_Right.webp";

import controlUpPressed from "../../hud/Control_Keys/Control_Up_Pressed.webp";
import controlDownPressed from "../../hud/Control_Keys/Control_Down_Pressed.webp";
import controlLeftPressed from "../../hud/Control_Keys/Control_Left_Pressed.webp";
import controlRightPressed from "../../hud/Control_Keys/Control_Right_Pressed.webp";

const CONTROL_SIZE = 52;

function ControlButton({
  image,
  pressedImage,
  pressed,
  onPress,
  onRelease,
  label,
  color,
}) {
  const displayImage = pressed ? pressedImage || image : image;

  return (
    <button
      aria-label={label}
      type="button"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        onPress();
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        onRelease();
      }}
      onPointerCancel={onRelease}
      style={{
        width: `${CONTROL_SIZE}px`,
        height: `${CONTROL_SIZE}px`,
        border: "none",
        background: "transparent",
        padding: 0,
        cursor: "pointer",
        position: "relative",
        pointerEvents: "auto",
        touchAction: "manipulation",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <img
          src={displayImage}
          alt=""
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            imageRendering: "pixelated",
            display: "block",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitUserDrag: "none",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: color || "#8f8f8f",
            mixBlendMode: "color",
            pointerEvents: "none",
            WebkitMaskImage: `url(${displayImage})`,
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            WebkitMaskSize: "contain",
            maskImage: `url(${displayImage})`,
            maskRepeat: "no-repeat",
            maskPosition: "center",
            maskSize: "contain",
          }}
        />
      </div>
    </button>
  );
}

export default function PetControls() {
  const energy = usePetStore((s) => s.energy);
  const theme = usePetStore((s) => s.theme);
  const color = theme?.modelColor || "#8f8f8f";

  const holdRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const keyboardHoldRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const velocityRef = useRef({ x: 0, y: 0 });
  const speedRef = useRef({ touchSpeed: 0, keyboardSpeed: 0 });
  const pendingSpeedRef = useRef(null);

  const [pressed, setPressed] = useState({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");

    const update = () => setIsTouchDevice(media.matches);

    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  }, []);

  const keyToDirection = useMemo(
    () => ({
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right",
    }),
    []
  );

  const hasActiveInput = () =>
    Object.values(holdRef.current).some(Boolean) ||
    Object.values(keyboardHoldRef.current).some(Boolean);

  useEffect(() => {
    const baseSpeed = 7; // vitesse de base en pixels par frame
    const keyboardSpeedMultiplier = 1; // Tweak keyboard speed relative to touch here.
    const minSpeedMultiplier = 0.45;
    const maxEnergy = 100;

    const clampedEnergy = Math.max(0, Math.min(maxEnergy, energy ?? maxEnergy));
    const energyRatio = clampedEnergy / maxEnergy;
    const speedMultiplier =
      minSpeedMultiplier + energyRatio * (1 - minSpeedMultiplier);

    const touchSpeed = baseSpeed * speedMultiplier;
    const keyboardSpeed = touchSpeed * keyboardSpeedMultiplier;
    const nextSpeed = { touchSpeed, keyboardSpeed };

    if (hasActiveInput()) {
      pendingSpeedRef.current = nextSpeed;
      return;
    }

    speedRef.current = nextSpeed;
    pendingSpeedRef.current = null;
  }, [energy]);

  const syncPressedState = (direction, nextPressed) => {
    setPressed((prev) => {
      if (prev[direction] === nextPressed) {
        return prev;
      }

      return {
        ...prev,
        [direction]: nextPressed,
      };
    });
  };

  useEffect(() => {
    const acceleration = 0.25; // + reactif
    const damping = 0.86; // moins glissant
    const stopThreshold = 0.02; // ne coupe plus trop tôt
    const baseFrameMs = 1000 / 60;

    const handleDown = (e) => {
      const key = e.key.toLowerCase();

      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(
          key
        )
      ) {
        e.preventDefault();

        const direction = keyToDirection[key];

        if (direction && !keyboardHoldRef.current[direction]) {
          keyboardHoldRef.current[direction] = true;
          syncPressedState(direction, true);
        }
      }
    };

    const handleUp = (e) => {
      const key = e.key.toLowerCase();

      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(
          key
        )
      ) {
        const direction = keyToDirection[key];

        if (direction && keyboardHoldRef.current[direction]) {
          keyboardHoldRef.current[direction] = false;
          syncPressedState(direction, holdRef.current[direction]);
        }
      }
    };

    const clearKeyboardState = () => {
      Object.keys(keyboardHoldRef.current).forEach((direction) => {
        keyboardHoldRef.current[direction] = false;
        syncPressedState(direction, holdRef.current[direction]);
      });
    };

    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);
    window.addEventListener("blur", clearKeyboardState);

    let raf;
    let lastTime = performance.now();

    const loop = (time) => {
      const deltaMs = Math.min(32, Math.max(8, time - lastTime || baseFrameMs));
      const frameFactor = deltaMs / baseFrameMs;
      const accelerationFactor = 1 - Math.pow(1 - acceleration, frameFactor);
      const dampingFactor = Math.pow(damping, frameFactor);

      lastTime = time;

      const { touchSpeed, keyboardSpeed } = speedRef.current;
      let targetDx = 0;
      let targetDy = 0;

      if (keyboardHoldRef.current.up) targetDy += keyboardSpeed;
      if (keyboardHoldRef.current.down) targetDy -= keyboardSpeed;
      if (keyboardHoldRef.current.left) targetDx += keyboardSpeed;
      if (keyboardHoldRef.current.right) targetDx -= keyboardSpeed;

      if (holdRef.current.up) targetDy += touchSpeed;
      if (holdRef.current.down) targetDy -= touchSpeed;
      if (holdRef.current.left) targetDx += touchSpeed;
      if (holdRef.current.right) targetDx -= touchSpeed;

      velocityRef.current.x += (targetDx - velocityRef.current.x) * accelerationFactor;
      velocityRef.current.y += (targetDy - velocityRef.current.y) * accelerationFactor;

      if (targetDx === 0) {
        velocityRef.current.x *= dampingFactor;
      }

      if (targetDy === 0) {
        velocityRef.current.y *= dampingFactor;
      }

      if (Math.abs(velocityRef.current.x) < stopThreshold) {
        velocityRef.current.x = 0;
      }

      if (Math.abs(velocityRef.current.y) < stopThreshold) {
        velocityRef.current.y = 0;
      }

      const dx = velocityRef.current.x * frameFactor;
      const dy = velocityRef.current.y * frameFactor;

      if (!hasActiveInput() && pendingSpeedRef.current && dx === 0 && dy === 0) {
        speedRef.current = pendingSpeedRef.current;
        pendingSpeedRef.current = null;
      }

      if (dx !== 0 || dy !== 0) {
        useWorldStore.getState().moveWorld(dx, dy);
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
      window.removeEventListener("blur", clearKeyboardState);

      keyboardHoldRef.current.up = false;
      keyboardHoldRef.current.down = false;
      keyboardHoldRef.current.left = false;
      keyboardHoldRef.current.right = false;

      velocityRef.current.x = 0;
      velocityRef.current.y = 0;
      pendingSpeedRef.current = null;

      cancelAnimationFrame(raf);
    };
  }, [keyToDirection]);

  const setDirectionPressed = (direction, value) => {
    holdRef.current[direction] = value;
    syncPressedState(direction, value || keyboardHoldRef.current[direction]);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20%",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 999,
        display: "grid",
        gridTemplateColumns: "repeat(3, 52px)",
        gridTemplateRows: "repeat(2, 52px)",
        gap: isTouchDevice ? "24px" : "8px",
        pointerEvents: "none",
      }}
    >
      <div />
      <ControlButton
        image={controlUp}
        pressedImage={controlUpPressed}
        pressed={pressed.up}
        label="Move up"
        color={color}
        onPress={() => setDirectionPressed("up", true)}
        onRelease={() => setDirectionPressed("up", false)}
      />
      <div />

      <ControlButton
        image={controlLeft}
        pressedImage={controlLeftPressed}
        pressed={pressed.left}
        label="Move left"
        color={color}
        onPress={() => setDirectionPressed("left", true)}
        onRelease={() => setDirectionPressed("left", false)}
      />

      <ControlButton
        image={controlDown}
        pressedImage={controlDownPressed}
        pressed={pressed.down}
        label="Move down"
        color={color}
        onPress={() => setDirectionPressed("down", true)}
        onRelease={() => setDirectionPressed("down", false)}
      />

      <ControlButton
        image={controlRight}
        pressedImage={controlRightPressed}
        pressed={pressed.right}
        label="Move right"
        color={color}
        onPress={() => setDirectionPressed("right", true)}
        onRelease={() => setDirectionPressed("right", false)}
      />
    </div>
  );
}
