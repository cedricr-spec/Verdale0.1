import React from "react";
import Entity from "./Entity";
import { useEntityStore } from "../store/entitySlice";
import { useWorldStore } from "../store/worldSlice";

export default function EntityLayer({ viewport = { width: 0, height: 0 } }) {
  const entities = useEntityStore((state) => state.entities);
  const worldOffset = useWorldStore((state) => state.worldOffset);

  return (
    <>
      {/* ⚠️ CRITICAL: Do NOT modify or remove `data-entity-layer`
         This container is used as the reference for all entity positioning and interactions.
         Changing it will break pickup, visibility, and world alignment. */}
      <div
        data-entity-layer
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          pointerEvents: "none",
          transform: "translate(-50%, -50%)",
        }}
      >
        {entities
          .filter((entity) => entity.active)
          .map((entity) => {
            const safeEntity = {
              type: "food",
              spriteKey: entity?.itemKey ? undefined : "apple",
              ...entity,
            };

            return (
              <Entity
                key={entity.id}
                entity={safeEntity}
                x={entity.x + (worldOffset?.x || 0)}
                y={entity.y + (worldOffset?.y || 0)}
              />
            );
          })}
      </div>
    </>
  );
}
