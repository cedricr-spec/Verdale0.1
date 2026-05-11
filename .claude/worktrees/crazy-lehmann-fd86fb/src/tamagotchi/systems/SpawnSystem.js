import { useEffect } from "react";
import { useEntityStore } from "../store/entitySlice";
import { useWorldStore } from "../store/worldSlice";
import { MAX_ENTITIES, SPAWN_RADIUS } from "../config/spawnConfig";
import { VISIBLE_MARGIN } from "../config/worldConfig";
import { ENTITY_TYPES } from "../config/entityTypes";
import { randomRange } from "../utils/random";
import { RESOURCE_ITEM_IDS } from "../config/itemsRegistry";

import tree1 from "../../spritesheets/trees/tree1.webp";
import tree2 from "../../spritesheets/trees/tree2.webp";
import tree3 from "../../spritesheets/trees/tree3.webp";
import tree4 from "../../spritesheets/trees/tree4.webp";
import tree5 from "../../spritesheets/trees/tree5.webp";
import tree6 from "../../spritesheets/trees/tree6.webp";
import tree7 from "../../spritesheets/trees/tree7.webp";
import tree8 from "../../spritesheets/trees/tree8.webp";

let sessionSeed = Math.random() * 100000;

function getSpawnPoint(center, viewport) {
  // mix session seed to avoid identical patterns across reloads
  const angle = (Math.random() + sessionSeed) % 1 * Math.PI * 2;

  const minRadius = Math.max(viewport.width, viewport.height) * 0.5 + 120;
  const maxRadius = minRadius + SPAWN_RADIUS;

  // better randomness (no radial bias)
  const t = Math.random();
  const r = Math.sqrt(
    t * (maxRadius * maxRadius - minRadius * minRadius) +
    minRadius * minRadius
  );

  return {
    x: center.x + Math.cos(angle) * r,
    y: center.y + Math.sin(angle) * r,
  };
}

export default function SpawnSystem() {
  const spawnEntity = useEntityStore((s) => s.spawnEntity);
  const spawnDecorEntity = useEntityStore((s) => s.spawnDecorEntity);

  const spawnResourceAround = (centerX, centerY, minRadius, maxRadius, itemId) => {
    const angle = Math.random() * Math.PI * 2;
    const radius = minRadius + Math.random() * (maxRadius - minRadius);
    const jitterX = (Math.random() - 0.5) * 100;
    const jitterY = (Math.random() - 0.5) * 100;

    const x = centerX + Math.cos(angle) * radius + jitterX;
    const y = centerY + Math.sin(angle) * radius + jitterY;

    spawnEntity(x, y, ENTITY_TYPES.RESOURCE, {
      itemKey: itemId,
      reward: "inventory_item",
      rewardAmount: 1,
    });
  };

  useEffect(() => {
    const existing = useEntityStore.getState().entities;
    if (existing.some((e) => e.type === "decor")) return;

    const { worldOffset } = useWorldStore.getState();

    const TREE_ASSETS = [tree1, tree2, tree3, tree4, tree5, tree6, tree7, tree8];

    const centerX = -(worldOffset.x || 0);
    const centerY = -(worldOffset.y || 0);

    const COUNT = 80;

    for (let i = 0; i < COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 200 + Math.random() * 2000;

      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      const sprite = TREE_ASSETS[Math.floor(Math.random() * TREE_ASSETS.length)];
      const scale = 0.8 + Math.random() * 0.6;

      spawnDecorEntity(x, y, sprite, scale);
    }
  }, []);

  useEffect(() => {
    useEntityStore.setState((state) => ({
      entities: (state.entities || []).filter(
        (entity) =>
          entity.type === "decor" ||
          (entity.type === ENTITY_TYPES.RESOURCE &&
            RESOURCE_ITEM_IDS.includes(entity.itemKey))
      ),
    }));

    const { worldOffset } = useWorldStore.getState();
    const centerX = -(worldOffset.x || 0);
    const centerY = -(worldOffset.y || 0);

    RESOURCE_ITEM_IDS.forEach((itemId, index) => {
      spawnResourceAround(centerX, centerY, 120 + index * 30, 280 + index * 50, itemId);
    });

    RESOURCE_ITEM_IDS.forEach((itemId) => {
      spawnResourceAround(centerX, centerY, 260, 420, itemId);
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const existing = useEntityStore.getState().entities;
      const activePickups = existing.filter((entity) => entity.type !== "decor").length;
      if (activePickups >= MAX_ENTITIES) return;

      const { worldOffset } = useWorldStore.getState();

      const batch = 1 + Math.floor(Math.random() * 3);
      const minRadius = 200;
      const maxRadius = 1200;

      for (let i = 0; i < batch; i++) {
        const centerX = -(worldOffset.x || 0);
        const centerY = -(worldOffset.y || 0);
        const itemId =
          RESOURCE_ITEM_IDS[Math.floor(Math.random() * RESOURCE_ITEM_IDS.length)];

        spawnResourceAround(centerX, centerY, minRadius, maxRadius, itemId);
      }
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
