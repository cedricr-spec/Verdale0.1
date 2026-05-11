import React, { useEffect, useMemo, useRef, useState } from "react";
import TamagotchiUI from "../ui/TamagotchiUI";
import ShopPanel from "./ShopPanel";
import EntityLayer from "../components/EntityLayer";
import WorldLayer from "../components/WorldLayer";
import PhaserGameCanvas from "../components/PhaserGameCanvas";
import { subscribePhaserDebugFlags, getPhaserDebugFlags } from "../phaser/phaserDebugFlags";
import SpawnSystem from "../systems/SpawnSystem";
import VisibilitySystem from "../systems/VisibilitySystem";
import WorldInteractionSystem from "../systems/WorldInteractionSystem";
import FarmingInteractionSystem from "../systems/FarmingInteractionSystem";
import CleanupSystem from "../systems/CleanupSystem";
import InteractionSystem from "../systems/InteractionSystem";
import CollisionSystem from "../systems/CollisionSystem";
import {
  WORLD_VIEWPORT_ASPECT_RATIO,
  WORLD_VIEWPORT_MODE,
  WORLD_VIEWPORT_SCALE,
} from "../config/worldStreamingConfig";
import {
  REACT_WORLD_RENDERER_AVAILABLE,
} from "../config/worldRendererConfig";

class PetScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error("[pet-screen-error-boundary]", error, info);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background: "rgba(0, 0, 0, 0.72)",
            color: "#ffffff",
            fontSize: 12,
            lineHeight: 1.5,
            textAlign: "left",
            whiteSpace: "pre-wrap",
          }}
        >
          {`PetScreen failed to render.\n${this.state.error?.message || "Unknown error"}`}
        </div>
      );
    }

    return this.props.children;
  }
}

const DEFAULT_VIEWPORT_FRAME = Object.freeze({
  left: 0,
  top: 0,
  width: 500,
  height: 500,
  centerX: 250,
  centerY: 250,
});

function useMeasuredWorldViewportFrame(mode = WORLD_VIEWPORT_MODE) {
  const frameRef = useRef(null);
  const [frame, setFrame] = useState(DEFAULT_VIEWPORT_FRAME);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return undefined;

    const updateFrame = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.max(1, Math.ceil(rect.width || DEFAULT_VIEWPORT_FRAME.width));
      const height = Math.max(1, Math.ceil(rect.height || DEFAULT_VIEWPORT_FRAME.height));
      const left = Math.round(rect.left || 0);
      const top = Math.round(rect.top || 0);

      setFrame({
        left,
        top,
        width,
        height,
        centerX: left + width * 0.5,
        centerY: top + height * 0.5,
      });
    };

    updateFrame();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateFrame);
      return () => window.removeEventListener("resize", updateFrame);
    }

    const observer = new ResizeObserver(updateFrame);
    observer.observe(node);
    window.addEventListener("resize", updateFrame);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateFrame);
    };
  }, [mode]);

  return [frameRef, frame];
}

// Named z-index constants for the PetScreen stacking order.
// React world layers max at z=20 (WorldAtlasLayer internal); TamagotchiUI sits at z=60.
const LAYER_WORLD = 10;
const LAYER_ENTITY = 20;
const LAYER_PHASER = 30;

function createViewportFrameStyle(mode = WORLD_VIEWPORT_MODE) {
  if (mode === "full") {
    return {
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      pointerEvents: "none",
      // Establishing a stacking context here means Phaser (inside) is painted
      // as a unit at z=30, definitively above WorldAtlasLayer (max z=20).
      zIndex: LAYER_PHASER,
    };
  }

  const scale = Math.max(0.5, Math.min(1, WORLD_VIEWPORT_SCALE || 0.9));
  const style = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: `${scale * 100}vw`,
    height: `${scale * 100}vh`,
    transform: "translate(-50%, -50%)",
    overflow: "hidden",
    pointerEvents: "none",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 20px 40px rgba(0,0,0,0.28), inset 0 0 0 1px rgba(255,255,255,0.04)",
    background: "rgba(0, 0, 0, 0.12)",
    zIndex: LAYER_PHASER,
  };

  if (WORLD_VIEWPORT_ASPECT_RATIO) {
    style.aspectRatio = String(WORLD_VIEWPORT_ASPECT_RATIO);
    style.width = `min(${scale * 100}vw, calc(${scale * 100}vh * ${WORLD_VIEWPORT_ASPECT_RATIO}))`;
    style.height = "auto";
  }

  return style;
}

export default function PetScreen({ mode = WORLD_VIEWPORT_MODE }) {
  const [viewportFrameRef, viewportFrame] = useMeasuredWorldViewportFrame(mode);
  const viewportFrameStyle = useMemo(() => createViewportFrameStyle(mode), [mode]);

  // Subscribe to Phaser debug flags so hideReactWorldLayer triggers a re-render.
  const [phaserFlags, setPhaserFlags] = useState(getPhaserDebugFlags);
  useEffect(() => subscribePhaserDebugFlags(setPhaserFlags), []);
  const shouldRenderReactWorld =
    REACT_WORLD_RENDERER_AVAILABLE && phaserFlags.renderMode !== "phaser";
  const shouldRenderReactEntities =
    REACT_WORLD_RENDERER_AVAILABLE && !phaserFlags.hideReactEntityLayer;
  const shouldRunReactGameplaySystems = shouldRenderReactWorld;

  return (
    <div
      data-pet-screen
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <PetScreenErrorBoundary>
        <div
          ref={viewportFrameRef}
          data-world-viewport-frame
          data-world-viewport-mode={mode}
          style={viewportFrameStyle}
        >
          <PhaserGameCanvas viewportFrame={viewportFrame} visible={true} />
        </div>

        {shouldRenderReactWorld ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: LAYER_WORLD,
              visibility: phaserFlags.hideReactWorldLayer ? "hidden" : "visible",
            }}
          >
            <WorldLayer viewportFrame={viewportFrame} />
          </div>
        ) : null}

        {shouldRenderReactEntities ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: LAYER_ENTITY,
              visibility: phaserFlags.hideReactEntityLayer ? "hidden" : "visible",
            }}
          >
            <EntityLayer viewportFrame={viewportFrame} />
          </div>
        ) : null}

        {shouldRunReactGameplaySystems ? (
          <>
            <SpawnSystem />
            <VisibilitySystem />
            <CleanupSystem />
            <InteractionSystem />
            <CollisionSystem />
            <WorldInteractionSystem />
            <FarmingInteractionSystem />
          </>
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 60,
          }}
        >
          <TamagotchiUI />
        </div>

        <ShopPanel />
      </PetScreenErrorBoundary>
    </div>
  );
}
