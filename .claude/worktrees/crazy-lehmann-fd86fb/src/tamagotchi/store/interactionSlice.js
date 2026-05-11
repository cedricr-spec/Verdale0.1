import { create } from "zustand";

export const createInteractionSlice = (set) => ({
  lastInteraction: null,

  applyInteraction: (entity) =>
    set({
      // Placeholder for future stat, inventory, or animation effects.
      lastInteraction: entity || null,
    }),
});

export const useInteractionStore = create((set) => ({
  ...createInteractionSlice(set),
}));
