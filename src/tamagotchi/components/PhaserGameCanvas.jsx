import React, { useEffect, useMemo, useRef } from "react";
import Phaser from "phaser";
import { createPhaserConfig } from "../phaser/config";
import MainScene from "../phaser/MainScene";

// Internal z-index within the viewport frame stacking context (not the outer page).
// The viewport frame itself is at LAYER_PHASER=30 in PetScreen — this value only
// matters for ordering siblings inside that frame.
const PHASER_LAYER_Z_INDEX = 1;

function syncPhaserCanvasStyles(containerNode) {
  if (!containerNode) return;

  Array.from(containerNode.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) return;

    child.style.position = "absolute";
    child.style.inset = "0";
    child.style.width = "100%";
    child.style.height = "100%";
    child.style.pointerEvents = "auto";
    child.style.cursor = "inherit";
  });

  Array.from(containerNode.querySelectorAll("canvas")).forEach((canvas) => {
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.pointerEvents = "auto";
    canvas.style.zIndex = "0";
    canvas.style.touchAction = "manipulation";
    // Explicit overrides: visibility and opacity must never be inherited from a
    // parent that sets visibility:hidden (e.g. the hideReactWorldLayer wrapper).
    canvas.style.opacity = "1";
    canvas.style.visibility = "visible";
    canvas.style.cursor = "inherit";
  });
}

export default function PhaserGameCanvas({ viewportFrame, visible = true }) {
  const gameRef = useRef(null);
  const containerRef = useRef(null);

  const width = Math.max(1, Math.round(viewportFrame?.width || 0));
  const height = Math.max(1, Math.round(viewportFrame?.height || 0));

  useEffect(() => {
    return () => {
      if (!gameRef.current) return;

      if (window.phaserDebug?.game === gameRef.current) {
        delete window.phaserDebug;
      }

      gameRef.current.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!visible || !containerRef.current || gameRef.current || width <= 0 || height <= 0) {
      return undefined;
    }

    const config = createPhaserConfig(containerRef.current);
    config.width = width;
    config.height = height;
    config.scene = [MainScene];

    if (import.meta.env.DEV) {
      console.log("[PhaserGameCanvas] Initializing with viewport:", {
        width,
        height,
      });
    }

    const game = new Phaser.Game(config);
    gameRef.current = game;

    // Phaser (NONE scale mode) creates the canvas synchronously; one style pass is enough.
    syncPhaserCanvasStyles(containerRef.current);

    window.phaserDebug = { game };
    game.events.once('ready', () => {
      if (window.phaserDebug?.game === game) {
        window.phaserDebug.scene = game.scene.getScene('MainScene');
      }
    });
  }, [height, visible, width]);

  useEffect(() => {
    if (visible || !gameRef.current) return;

    if (window.phaserDebug?.game === gameRef.current) {
      delete window.phaserDebug;
    }

    gameRef.current.destroy(true);
    gameRef.current = null;
  }, [visible]);

  useEffect(() => {
    if (!gameRef.current) return;

    gameRef.current.scale.setGameSize(width, height);
    syncPhaserCanvasStyles(containerRef.current);
  }, [height, width]);

  const containerStyle = useMemo(
    () => ({
      position: "absolute",
      inset: 0,
      display: visible ? "block" : "none",
      overflow: "hidden",
      pointerEvents: visible ? "auto" : "none",
      touchAction: "manipulation",
      borderRadius: "inherit",
      zIndex: PHASER_LAYER_Z_INDEX,
      // Explicit overrides so a visibility:hidden ancestor never makes this invisible.
      opacity: 1,
      visibility: "visible",
    }),
    [visible]
  );

  return (
    <div
      ref={containerRef}
      data-phaser-game-canvas
      style={containerStyle}
    />
  );
}
