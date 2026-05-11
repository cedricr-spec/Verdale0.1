import React, { useEffect, useMemo, useRef, memo } from "react";
import Entity from "./Entity";
import { useEntityStore } from "../store/entitySlice";
import { useWorldStore } from "../store/worldSlice";

const DEFAULT_VIEWPORT_FRAME = Object.freeze({
  left: 0,
  top: 0,
  width: 500,
  height: 500,
});

const WORLD_LAYER_STYLE = {
  position: "absolute",
  left: 0,
  top: 0,
  pointerEvents: "none",
};

function createWorldTransform(viewportFrame, worldOffset = { x: 0, y: 0 }) {
  return `translate3d(${Math.round((viewportFrame.width || 0) * 0.5 + (worldOffset?.x || 0))}px, ${Math.round(
    (viewportFrame.height || 0) * 0.5 + (worldOffset?.y || 0)
  )}px, 0)`;
}

function applyWorldTransform(node, viewportFrame, worldOffset) {
  if (!node) return;

  const nextTransform = createWorldTransform(viewportFrame, worldOffset);
  if (node.style.transform !== nextTransform) {
    node.style.transform = nextTransform;
  }
  if (node.style.willChange !== "transform") {
    node.style.willChange = "transform";
  }
}

export default function EntityLayer({ viewportFrame = DEFAULT_VIEWPORT_FRAME }) {
  const entities = useEntityStore((state) => state.entities);
  const worldLayerRef = useRef(null);

  useEffect(() => {
    const initialOffset = useWorldStore.getState().worldOffset || { x: 0, y: 0 };
    applyWorldTransform(worldLayerRef.current, viewportFrame, initialOffset);
  }, [viewportFrame.height, viewportFrame.width]);

  useEffect(() => {
    const unsubscribe = useWorldStore.subscribe((state, previousState) => {
      if (state.worldOffset === previousState.worldOffset) {
        return;
      }

      applyWorldTransform(worldLayerRef.current, viewportFrame, state.worldOffset);
    });

    return () => unsubscribe();
  }, [viewportFrame.height, viewportFrame.width]);

  const frameStyle = useMemo(
    () => ({
      position: "absolute",
      left: Math.round(viewportFrame.left || 0),
      top: Math.round(viewportFrame.top || 0),
      width: Math.max(1, Math.round(viewportFrame.width || DEFAULT_VIEWPORT_FRAME.width)),
      height: Math.max(1, Math.round(viewportFrame.height || DEFAULT_VIEWPORT_FRAME.height)),
      overflow: "hidden",
      pointerEvents: "none",
      // z=3: sits between WorldAtlasLayer back (z=0) and front (z=5).
      // Requires worldFrameStyle to NOT create a stacking context (no clipPath).
      zIndex: 3,
    }),
    [viewportFrame.height, viewportFrame.left, viewportFrame.top, viewportFrame.width]
  );

  return (
    <div style={frameStyle}>
      <div
        ref={worldLayerRef}
        data-entity-layer
        style={WORLD_LAYER_STYLE}
      >
        {entities
          .filter((entity) => entity.active)
          .map((entity) => (
            <Entity
              key={entity.id}
              entity={entity}
              x={entity.x}
              y={entity.y}
            />
          ))}
      </div>
    </div>
  );
}
