import { useEffect } from "react";
import { useEntityStore } from "../store/entitySlice";
import { useWorldStore } from "../store/worldSlice";
import { MAX_DISTANCE } from "../config/worldConfig";
import { distance } from "../utils/spatial";

export function cleanupEntities(state, worldOffset = { x: 0, y: 0 }) {
  const pet = {
    x: -worldOffset.x,
    y: -worldOffset.y,
  };

  return (state.entities || []).filter((entity) => {
    const dist = distance(entity, pet);
    return dist <= MAX_DISTANCE;
  });
}

export default function CleanupSystem() {
  const setState = useEntityStore.setState;

  useEffect(() => {
    const interval = setInterval(() => {
      const worldOffset = useWorldStore.getState().worldOffset;

      setState((state) => ({
        entities: cleanupEntities(state, worldOffset),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
