import { useCharacterStore } from "./useCharacterStore";
import { usePetStore } from "./usePetStore";
import { create } from "zustand";
import {
  DEFAULT_WORLD_THEME,
  isWorldThemeAvailable,
} from "../config/worldThemeConfig";

let worldMovementResolver = null;
let _movementLocked = false;
const DEFAULT_UI_MODAL_STATE = Object.freeze({
  inventory: false,
  quests: false,
  customizer: false,
  characterMenu: false,
});

export function setWorldMovementResolver(resolver) {
  worldMovementResolver = typeof resolver === "function" ? resolver : null;
}

export function setMovementLocked(locked) {
  _movementLocked = Boolean(locked);
}

export function isGameplayUiBlockingState(stateLike) {
  const uiModalState = stateLike?.uiModalState || DEFAULT_UI_MODAL_STATE;

  return Boolean(
    stateLike?.activeShop ||
      uiModalState.inventory ||
      uiModalState.quests ||
      uiModalState.customizer ||
      uiModalState.characterMenu
  );
}

function resolveWorldMovement(state, dx, dy) {
  if (!worldMovementResolver) {
    return { dx, dy };
  }

  const resolved = worldMovementResolver({
    worldOffset: state.worldOffset,
    dx,
    dy,
  });

  return {
    dx: Number.isFinite(resolved?.dx) ? resolved.dx : dx,
    dy: Number.isFinite(resolved?.dy) ? resolved.dy : dy,
  };
}

function applyWorldMovement(state, dx, dy) {
  const movement = resolveWorldMovement(state, dx, dy);
  const nextDx = movement.dx;
  const nextDy = movement.dy;

  return {
    dx: nextDx,
    dy: nextDy,
    nextState: {
      worldOffset: {
        x: state.worldOffset.x + nextDx,
        y: state.worldOffset.y + nextDy,
      },
    },
  };
}

export const createWorldSlice = (set) => ({
  worldOffset: { x: 0, y: 0 },
  lastMoveAt: 0,
  facingDirection: "right",
  currentWorldTheme: DEFAULT_WORLD_THEME,
  uiModalState: DEFAULT_UI_MODAL_STATE,

  // Active merchant shop — set by Phaser, read by React.
  // { merchantId: string, shopId: string } | null
  activeShop: null,
  openShop: (merchantId, shopId) => set({ activeShop: { merchantId, shopId } }),
  closeShop: () => set({ activeShop: null }),
  setUiModalState: (partialState) =>
    set((state) => ({
      uiModalState: {
        ...state.uiModalState,
        ...(partialState || {}),
      },
    })),

  setWorldTheme: (themeId) => {
    set({
      currentWorldTheme: isWorldThemeAvailable(themeId)
        ? themeId
        : DEFAULT_WORLD_THEME,
    });
  },

  moveWorld: (dx, dy) => {
    const { health } = usePetStore.getState();
    const { persistentState, transientState } = useCharacterStore.getState();
    const isDead =
      health <= 0 ||
      transientState === "death" ||
      persistentState === "dead";

    if (_movementLocked || isDead || (dx === 0 && dy === 0)) return;

    set((state) => {
      const movement = applyWorldMovement(state, dx, dy);
      const nextDx = movement.dx;
      const nextDy = movement.dy;

      return {
        ...movement.nextState,
        lastMoveAt: Date.now(),
        facingDirection:
          dx > 0 ? "left" : dx < 0 ? "right" : state.facingDirection,
      };
    });
  },

  nudgeWorld: (dx, dy, options = {}) => {
    if (dx === 0 && dy === 0) return { dx: 0, dy: 0 };

    let applied = { dx: 0, dy: 0 };
    set((state) => {
      const movement = applyWorldMovement(state, dx, dy);
      applied = { dx: movement.dx, dy: movement.dy };

      return {
        ...movement.nextState,
        lastMoveAt: options?.markMoved === false ? state.lastMoveAt : Date.now(),
      };
    });

    return applied;
  },
});

export const useWorldStore = create((set) => ({
  ...createWorldSlice(set),
}));
