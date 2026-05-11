import { VISIBLE_MARGIN } from "../config/worldConfig";
import { isInBounds } from "../utils/spatial";

import { useEffect } from "react";
import { useEntityStore } from "../store/entitySlice";
import { useWorldStore } from "../store/worldSlice";

export function updateVisibility(state, viewport = { width: 0, height: 0 }, worldOffset = { x: 0, y: 0 }) {
  const halfWidth = viewport.width / 2;
  const halfHeight = viewport.height / 2;

  const margin = VISIBLE_MARGIN * 2;
  const bounds = {
    left: -halfWidth - margin,
    right: halfWidth + margin,
    top: -halfHeight - margin,
    bottom: halfHeight + margin,
  };

  return (state.entities || []).map((entity) => ({
    ...entity,
    active: isInBounds(
      {
        x: entity.x + (worldOffset.x || 0),
        y: entity.y + (worldOffset.y || 0),
      },
      bounds
    ),
  }));
}

export function startVisibilitySystem() {
  const setState = useEntityStore.setState;

  let raf;
  let last = 0;
  const FPS = 30;
  const interval = 1000 / FPS;

  const loop = (t = 0) => {
    if (t - last < interval) {
      raf = requestAnimationFrame(loop);
      return;
    }
    last = t;

    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const worldOffset = useWorldStore.getState().worldOffset;

    setState((state) => {
      const nextEntities = updateVisibility(state, viewport, worldOffset);

      const prev = state.entities || [];
      let changed = prev.length !== nextEntities.length;

      if (!changed) {
        for (let i = 0; i < nextEntities.length; i++) {
          if (prev[i]?.active !== nextEntities[i]?.active) {
            changed = true;
            break;
          }
        }
      }

      if (!changed) return state;

      return { entities: nextEntities };
    });

    raf = requestAnimationFrame(loop);
  };

  loop();

  return () => cancelAnimationFrame(raf);
}

export default function VisibilitySystem() {
  useEffect(() => {
    return startVisibilitySystem();
  }, []);

  return null;
}
