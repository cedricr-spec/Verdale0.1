import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useWorldStore } from "../store/worldSlice";
import { usePetStore } from "../store/usePetstore";
import MobileJoystick from "./MobileJoystick";

import controlUp from "../../hud/Control_Keys/Control_Up.webp";
import controlDown from "../../hud/Control_Keys/Control_Down.webp";
import controlLeft from "../../hud/Control_Keys/Control_Left.webp";
import controlRight from "../../hud/Control_Keys/Control_Right.webp";

import controlUpPressed from "../../hud/Control_Keys/Control_Up_Pressed.webp";
import controlDownPressed from "../../hud/Control_Keys/Control_Down_Pressed.webp";
import controlLeftPressed from "../../hud/Control_Keys/Control_Left_Pressed.webp";
import controlRightPressed from "../../hud/Control_Keys/Control_Right_Pressed.webp";

const CONTROL_SIZE = 52;

const MENU_BLOCKING_SELECTOR = [
  '[role="dialog"][aria-modal="true"]',
  '[aria-label="Quest carousel"]',
  '[data-inventory-panel]',
  '[data-player-inventory]',
  '[data-shop-panel]',
  '.inventory-panel',
  '.inventory-overlay',
  '.quest-panel',
  '.shop-panel',
].join(',');

function hasBlockingMenuInDom() {
  if (typeof document === 'undefined') return false;
  const node = document.querySelector(MENU_BLOCKING_SELECTOR);
  if (!node) return false;
  const style = window.getComputedStyle?.(node);
  if (!style) return true;
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

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
      onPointerLeave={onRelease}
      onPointerCancel={onRelease}
      onLostPointerCapture={onRelease}
      onTouchEnd={onRelease}
      onBlur={onRelease}
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

export default function PetControls({ embedded = false }) {
  const energy = usePetStore((s) => s.energy);
  const theme = usePetStore((s) => s.theme);
  const color = theme?.modelColor || "#8f8f8f";

  const activeShop = useWorldStore((s) => s.activeShop);
  const inventoryOpen = useWorldStore((s) => Boolean(
    s.inventoryOpen ||
    s.isInventoryOpen ||
    s.inventoryVisible ||
    s.activeInventory ||
    s.openInventory
  ));
  const questPanelOpen = useWorldStore((s) => Boolean(
    s.questPanelOpen ||
    s.isQuestPanelOpen ||
    s.questOverlayOpen ||
    s.activeQuestPanel ||
    s.questCarouselOpen
  ));
  const [blockingMenuOpen, setBlockingMenuOpen] = useState(false);
  const gameplayInputBlocked = Boolean(activeShop || inventoryOpen || questPanelOpen || blockingMenuOpen);

  // Discrete direction state for D-pad (touch + keyboard)
  const holdRef = useRef({ up: false, down: false, left: false, right: false });
  const keyboardHoldRef = useRef({ up: false, down: false, left: false, right: false });

  // Analog joystick vector — used on touch devices instead of holdRef touch directions
  // {x, y} each in range [-1, 1]; positive x = right, positive y = down (screen coords)
  const joystickVecRef = useRef({ x: 0, y: 0 });

  const velocityRef = useRef({ x: 0, y: 0 });
  const speedRef = useRef({ touchSpeed: 0, keyboardSpeed: 0 });
  const pendingSpeedRef = useRef(null);

  const [pressed, setPressed] = useState({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  // Detect touch / coarse-pointer devices (phones, tablets)
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouchDevice(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const updateBlockingMenuState = () => {
      setBlockingMenuOpen(hasBlockingMenuInDom());
    };

    updateBlockingMenuState();
    const interval = window.setInterval(updateBlockingMenuState, 120);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!gameplayInputBlocked) return;

    holdRef.current.up = false;
    holdRef.current.down = false;
    holdRef.current.left = false;
    holdRef.current.right = false;

    keyboardHoldRef.current.up = false;
    keyboardHoldRef.current.down = false;
    keyboardHoldRef.current.left = false;
    keyboardHoldRef.current.right = false;

    joystickVecRef.current = { x: 0, y: 0 };
    velocityRef.current.x = 0;
    velocityRef.current.y = 0;

    setPressed({ up: false, down: false, left: false, right: false });
  }, [gameplayInputBlocked]);

  const keyToDirection = useMemo(
    () => ({
      arrowup: "up",
      arrowdown: "down",
      arrowleft: "left",
      arrowright: "right",
    }),
    []
  );

  const hasActiveInput = () =>
    Object.values(holdRef.current).some(Boolean) ||
    Object.values(keyboardHoldRef.current).some(Boolean) ||
    joystickVecRef.current.x !== 0 ||
    joystickVecRef.current.y !== 0;

  // Update speed when energy changes; defer if movement is active
  useEffect(() => {
    const baseSpeed = 7;
    const keyboardSpeedMultiplier = 1;
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
      if (prev[direction] === nextPressed) return prev;
      return { ...prev, [direction]: nextPressed };
    });
  };

  // Stable callback passed to MobileJoystick — only writes to a ref so no re-render risk
  const updateJoystickVec = useCallback((vec) => {
    joystickVecRef.current = vec;
  }, []);

  // RAF game loop + keyboard listeners
  useEffect(() => {
    const acceleration = 0.25;
    const damping = 0.86;
    const stopThreshold = 0.02;
    const baseFrameMs = 1000 / 60;

    const handleDown = (e) => {
      const key = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        if (gameplayInputBlocked) return;
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
      if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
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

      if (gameplayInputBlocked) {
        joystickVecRef.current = { x: 0, y: 0 };
        velocityRef.current.x = 0;
        velocityRef.current.y = 0;
        raf = requestAnimationFrame(loop);
        return;
      }

      const { touchSpeed, keyboardSpeed } = speedRef.current;
      let targetDx = 0;
      let targetDy = 0;

      // ── Keyboard (desktop) ──
      if (keyboardHoldRef.current.up) targetDy += keyboardSpeed;
      if (keyboardHoldRef.current.down) targetDy -= keyboardSpeed;
      if (keyboardHoldRef.current.left) targetDx += keyboardSpeed;
      if (keyboardHoldRef.current.right) targetDx -= keyboardSpeed;

      // ── D-pad buttons (desktop fallback / non-touch) ──
      if (holdRef.current.up) targetDy += touchSpeed;
      if (holdRef.current.down) targetDy -= touchSpeed;
      if (holdRef.current.left) targetDx += touchSpeed;
      if (holdRef.current.right) targetDx -= touchSpeed;

      // ── Virtual joystick (mobile touch) ──
      // jx positive = thumb right = player moves right = world moves left (−x)
      // jy positive = thumb down  = player moves down  = world moves up   (−y)
      const jx = joystickVecRef.current.x;
      const jy = joystickVecRef.current.y;
      targetDx -= jx * touchSpeed;
      targetDy -= jy * touchSpeed;

      // Apply acceleration toward target
      velocityRef.current.x += (targetDx - velocityRef.current.x) * accelerationFactor;
      velocityRef.current.y += (targetDy - velocityRef.current.y) * accelerationFactor;

      // Damp axes with no active input
      if (targetDx === 0) velocityRef.current.x *= dampingFactor;
      if (targetDy === 0) velocityRef.current.y *= dampingFactor;

      // Snap to zero to avoid micro-drift
      if (Math.abs(velocityRef.current.x) < stopThreshold) velocityRef.current.x = 0;
      if (Math.abs(velocityRef.current.y) < stopThreshold) velocityRef.current.y = 0;

      const dx = velocityRef.current.x * frameFactor;
      const dy = velocityRef.current.y * frameFactor;

      // Apply deferred speed update once movement fully stops
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

      joystickVecRef.current = { x: 0, y: 0 };

      velocityRef.current.x = 0;
      velocityRef.current.y = 0;
      pendingSpeedRef.current = null;

      cancelAnimationFrame(raf);
    };
  }, [gameplayInputBlocked, keyToDirection]);

  const setDirectionPressed = (direction, value) => {
    holdRef.current[direction] = value;
    syncPressedState(direction, value || keyboardHoldRef.current[direction]);
  };

  // ── Mobile: render virtual joystick via portal to escape transform stacking context ──
  if (isTouchDevice && !gameplayInputBlocked) {
    return createPortal(
      <MobileJoystick onVectorChange={updateJoystickVec} />,
      document.body
    );
  }

  // ── Desktop: render D-pad ──
  return (
    <div
      style={{
        position: embedded ? "relative" : "fixed",
        bottom: embedded ? "auto" : "20%",
        left: embedded ? "auto" : "50%",
        transform: embedded ? "none" : "translateX(-50%)",
        zIndex: embedded ? "auto" : 999,
        display: "grid",
        gridTemplateColumns: "repeat(3, 52px)",
        gridTemplateRows: "repeat(2, 52px)",
        gap: "8px",
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
