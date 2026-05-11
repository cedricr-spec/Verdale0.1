import { defaultTheme } from "../../theme"
import { create } from "zustand"

const clampStat = (value) => Math.min(100, Math.max(0, value))

const normalizeChargeAmount = (amount) => {
  const safeAmount = Number.isFinite(amount) ? amount : 0
  return Math.max(0, Math.floor(safeAmount))
}

const applyEffectsToState = (state, effects = {}) => ({
  hunger: clampStat(state.hunger + (effects.hunger || 0)),
  energy: clampStat(state.energy + (effects.energy || 0)),
  happiness: clampStat(state.happiness + (effects.happiness || 0)),
  health: clampStat(state.health + (effects.health || 0)),
})

export const usePetStore = create((set, get) => ({
  hunger: 100,
  energy: 100,
  happiness: 100,
  health: 100,
  carrotCharges: 0,
  _gameInterval: null,
  _lastAction: 0,

  theme: defaultTheme,

  debugUI: false,

  debugColors: {
    layout: "rgba(255,0,0,0.25)",
    content: "rgba(0,255,0,0.25)",
    overlay: "rgba(0,0,255,0.25)",
    text: "rgba(255,255,0,0.25)",
  },

  getDebugColor: (layer) => {
    const colors = get().debugColors;
    return colors[layer] || "rgba(255,255,255,0.2)";
  },

  setPetColor: (color) =>
    set((state) => ({
      theme: {
        ...state.theme,
        petColor: color
      }
    })),

  setModelColor: (color) =>
    set((state) => ({
      theme: {
        ...state.theme,
        modelColor: color
      }
    })),

  setTheme: (update) =>
    set((state) => ({
      theme:
        typeof update === "function"
          ? update(state.theme)
          : {
              ...state.theme,
              ...update
            }
    })),

  canAct: () => {
    const now = Date.now();
    const last = get()._lastAction;
    return now - last > 800;
  },

  canUseCarrot: (amount = 1) => {
    const safeAmount = normalizeChargeAmount(amount)
    if (safeAmount === 0) return true

    return get().carrotCharges >= safeAmount
  },

  addCarrotCharge: (amount = 1) =>
    set((state) => ({
      carrotCharges: state.carrotCharges + normalizeChargeAmount(amount)
    })),

  consumeCarrotCharge: (amount = 1) => {
    const safeAmount = normalizeChargeAmount(amount)

    if (safeAmount === 0) return true

    if (!get().canUseCarrot(safeAmount)) return false

    set((state) => ({
      carrotCharges: Math.max(0, state.carrotCharges - safeAmount)
    }))

    return true
  },

  setActionTime: () => set({ _lastAction: Date.now() }),

  feed: () => {
    if (!get().canAct()) return;
    get().setActionTime();

    set((state) => ({
      hunger: Math.min(state.hunger + 20, 100),
      happiness: Math.min(state.happiness + 5, 100)
    }));
  },

  play: () => {
    if (!get().canAct()) return;
    get().setActionTime();

    set((state) => ({
      happiness: Math.min(state.happiness + 15, 100),
      energy: Math.max(state.energy - 10, 0),
      hunger: Math.max(state.hunger - 5, 0)
    }));
  },

  sleep: () => {
    if (!get().canAct()) return;
    get().setActionTime();

    set((state) => ({
      energy: Math.min(state.energy + 25, 100),
      hunger: Math.max(state.hunger - 5, 0)
    }));
  },

  applyEffects: (effects) =>
    set((state) => applyEffectsToState(state, effects)),

  applyAction: (action) => {
    const carrotCost = normalizeChargeAmount(action?.cost?.carrot)

    if (carrotCost > 0 && !get().canUseCarrot(carrotCost)) return false
    if (!get().canAct()) return false
    get().setActionTime();

    set((state) => ({
      ...applyEffectsToState(state, action?.effects),
      carrotCharges: Math.max(0, state.carrotCharges - carrotCost),
    }));

    return true
  },

  tick: () =>
    set((state) => ({
      hunger: Math.max(state.hunger - 0.5, 0),
      energy: Math.max(state.energy - 0.25, 0),
      happiness: Math.max(state.happiness - 0.25, 0)
    })),

  startGame: () => {
    if (get()._gameInterval) return;

    const id = setInterval(() => {
      // base decay
      get().tick();

      const { hunger, energy, happiness, health } = get();
      const lowCount = [hunger, energy, happiness].filter(v => v < 40).length;

      if (lowCount > 0) {
        set({
          health: Math.max(0, health - 0.25 * lowCount)
        });
      }
    }, 1500);

    set({ _gameInterval: id });
  },

  stopGame: () => {
    const id = get()._gameInterval;
    if (id) {
      clearInterval(id);
      set({ _gameInterval: null });
    }
  },
}))
