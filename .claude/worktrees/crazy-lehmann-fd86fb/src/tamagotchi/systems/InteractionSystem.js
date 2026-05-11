import { usePetStore } from "../store/usePetstore";
import { ENTITY_TYPE_CONFIG } from "../config/entityTypes";
import { distance } from "../utils/spatial";
import { useEffect } from "react";
import { useEntityStore } from "../store/entitySlice";
import { useWorldStore } from "../store/worldSlice";
import { useInventoryStore } from "../store/useInventoryStore";
import { ENTITY_TYPES } from "../config/entityTypes";

const PICKUP_RADIUS_BONUS = 18;
const RESOURCE_PICKUP_RADIUS_BONUS = 8; // Tweak world resource pickup precision here.

function mergeEffects(base = {}, extra = {}) {
  return {
    hunger: (base.hunger || 0) + (extra.hunger || 0),
    energy: (base.energy || 0) + (extra.energy || 0),
    happiness: (base.happiness || 0) + (extra.happiness || 0),
    health: (base.health || 0) + (extra.health || 0),
  };
}

function hasEffectValue(effects = {}) {
  return Object.values(effects).some((value) => value !== 0);
}

function getCollectEffects(entity) {
  const typeEffects = ENTITY_TYPE_CONFIG[entity.type]?.collectEffects || {};
  const entityEffects = entity.collectEffects || {};
  return mergeEffects(typeEffects, entityEffects);
}

const ENTITY_REWARD_HANDLERS = {
  carrot: (entity) => {
    const amount = Math.max(0, Math.floor(entity.rewardAmount ?? 1));
    if (amount <= 0) return;

    const addCarrotCharge = usePetStore.getState().addCarrotCharge;
    addCarrotCharge?.(amount);

    return true;
  },
  inventory_item: (entity) => {
    const amount = Math.max(0, Math.floor(entity.rewardAmount ?? 1));
    if (amount <= 0 || !entity.itemKey) return false;

    return useInventoryStore.getState().addItem(entity.itemKey, amount);
  },
};

function applyEntityReward(entity) {
  if (!entity.reward) return true;

  const rewardHandler = ENTITY_REWARD_HANDLERS[entity.reward];
  if (!rewardHandler) return true;

  return rewardHandler(entity) !== false;
}

export function handleInteractions(state) {
  const worldOffset = state.worldOffset || { x: 0, y: 0 };

  // ✅ pet position in WORLD space (this was the working logic)
  const pet = {
    x: -worldOffset.x,
    y: -worldOffset.y,
  };

  return (state.entities || []).filter((entity) => {
    const baseRadius =
      ENTITY_TYPE_CONFIG[entity.type]?.interactionRadius || 25;
    const radius =
      baseRadius +
      (entity.type === ENTITY_TYPES.RESOURCE
        ? RESOURCE_PICKUP_RADIUS_BONUS
        : PICKUP_RADIUS_BONUS);

    // ✅ PURE world-space distance (no projection)
    return distance(entity, pet) <= radius;
  });
}

export default function InteractionSystem() {
  const setEntities = useEntityStore.setState;

  useEffect(() => {
    const interval = setInterval(() => {
      const entities = useEntityStore.getState().entities;
      const worldOffset = useWorldStore.getState().worldOffset;

      const state = {
        entities,
        worldOffset
      };

      // entities in interaction range
      const inRange = handleInteractions(state);
      if (!inRange.length) return;

      const collected = inRange.filter((entity) => applyEntityReward(entity))
      if (!collected.length) return

      const pickupEffects = collected.reduce(
        (effects, entity) => mergeEffects(effects, getCollectEffects(entity)),
        {}
      );
      const applyEffects = usePetStore.getState().applyEffects;

      if (applyEffects && hasEffectValue(pickupEffects)) {
        applyEffects(pickupEffects);
      }

      const ids = new Set(collected.map((e) => e.id));

      // remove collected entities
      setEntities((s) => ({
        entities: (s.entities || []).filter((e) => !ids.has(e.id)),
      }));
    }, 80);

    return () => clearInterval(interval);
  }, []);

  return null;
}
