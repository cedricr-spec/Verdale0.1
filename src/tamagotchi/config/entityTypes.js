export const ENTITY_TYPES = {
  FOOD: "food",
  TOY: "toy",
  RESOURCE: "resource",
};

export const ENTITY_TYPE_CONFIG = {
  [ENTITY_TYPES.FOOD]: {
    label: "Food",
    interactionRadius: 80,
    collectEffects: {
      happiness: 1,
    },
  },
  [ENTITY_TYPES.TOY]: {
    label: "Toy",
    interactionRadius: 100,
  },
  [ENTITY_TYPES.RESOURCE]: {
    label: "Resource",
    interactionRadius: 62,
  },
};
