import { useCharacterStore } from "./useCharacterStore";
import { usePetStore } from "./usePetstore";
import { create } from "zustand";

export const createWorldSlice = (set) => ({
  worldOffset: { x: 0, y: 0 },
  lastMoveAt: 0,
  facingDirection: "right",

  moveWorld: (dx, dy) => {
    const { health } = usePetStore.getState();
    const { persistentState, transientState } = useCharacterStore.getState();
    const isDead =
      health <= 0 ||
      transientState === "death" ||
      persistentState === "dead";

    if (isDead || (dx === 0 && dy === 0)) return;

    set((state) => ({
      worldOffset: {
        x: state.worldOffset.x + dx,
        y: state.worldOffset.y + dy,
      },
      lastMoveAt: Date.now(),
      facingDirection:
        dx > 0 ? "left" : dx < 0 ? "right" : state.facingDirection,
    }));
  },
});

export const useWorldStore = create((set) => ({
  ...createWorldSlice(set),
}));
