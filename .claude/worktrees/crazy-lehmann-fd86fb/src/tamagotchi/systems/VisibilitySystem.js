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

export default function VisibilitySystem() {
  const setState = useEntityStore.setState;

  useEffect(() => {
    let raf;

    const loop = () => {
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      const worldOffset = useWorldStore.getState().worldOffset;

      setState((state) => ({
        entities: updateVisibility(state, viewport, worldOffset),
      }));

      raf = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(raf);
  }, []);

  return null;
}
