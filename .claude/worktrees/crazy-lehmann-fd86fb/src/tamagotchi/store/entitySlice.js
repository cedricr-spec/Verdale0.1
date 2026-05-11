import { create } from "zustand";
import { ENTITY_TYPES } from "../config/entityTypes";
import { getItemDefinition } from "../config/itemSpriteRegistry";

const DEFAULT_PICKUP_ITEM_KEY = "carrot";

function createEntityId(prefix = "entity") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createPickupEntity(x, y, type = ENTITY_TYPES.FOOD, options = {}) {
  const jitter =
    type === "decor" ? () => 0 : () => (Math.random() - 0.5) * 60;
  const item =
    (options.itemKey && getItemDefinition(options.itemKey)) ||
    (type === ENTITY_TYPES.FOOD
      ? getItemDefinition(DEFAULT_PICKUP_ITEM_KEY)
      : null)

  return {
    id: createEntityId(),
    x: x + jitter(),
    y: y + jitter(),
    type,
    itemKey: options.itemKey || (item ? DEFAULT_PICKUP_ITEM_KEY : undefined),
    spriteKey: options.spriteKey || item?.worldSpriteKey,
    reward: options.reward || item?.reward,
    rewardAmount: options.rewardAmount ?? item?.rewardAmount,
    collectEffects: options.collectEffects || item?.collectEffects,
    active: true,
  };
}

export const createEntitySlice = (set) => ({
  entities: [],

  spawnEntity: (x, y, type = ENTITY_TYPES.FOOD, options = {}) =>
    set((state) => {
      return {
        entities: [
          ...state.entities,
          createPickupEntity(x, y, type, options),
        ],
      };
    }),
  spawnDecorEntity: (x, y, sprite, scale = 1) =>
    set((state) => ({
      entities: [
        ...state.entities,
        {
          id: createEntityId("decor"),
          x,
          y,
          type: "decor",
          sprite,
          scale,
          active: true,
          persistent: true,
        },
      ],
    })),
  addEntity: (entity) =>
    set((state) => ({
      entities: [...state.entities, entity],
    })),

  removeEntity: (entityId) =>
    set((state) => ({
      entities: state.entities.filter((entity) => entity.id !== entityId),
    })),

  clearNonPersistent: () =>
    set((state) => ({
      entities: state.entities.filter((e) => e.persistent),
    })),

  updateEntity: (entityId, updates) =>
    set((state) => ({
      entities: state.entities.map((entity) =>
        entity.id === entityId
          ? {
              ...entity,
              ...(typeof updates === "function" ? updates(entity) : updates),
            }
          : entity
      ),
    })),
});

export const useEntityStore = create((set) => ({
  ...createEntitySlice(set),
}));
