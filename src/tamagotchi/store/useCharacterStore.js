import { create } from "zustand"
import { CHARACTER_ROSTER_BY_ID, DEFAULT_CHARACTER_ID } from "../config/characterRoster"

export const INITIAL_UNLOCKED_CHARACTER_IDS = [
  "basic_character",
  "spring_4",
  "main_character",
  "character_1",
  "gato",
]
import {
  DEFAULT_PERSISTENT_STATE,
  SHARED_ANIMATION_MAP,
} from "../config/sharedAnimationMap"
import {
  isPersistentCharacterState,
  isTransientCharacterState,
  normalizePersistentState,
  resolvePostTransientState,
} from "../lib/petAnimationResolver"

export const useCharacterStore = create((set, get) => ({
  activeCharacterId: DEFAULT_CHARACTER_ID,
  persistentState: DEFAULT_PERSISTENT_STATE,
  previousPersistentState: DEFAULT_PERSISTENT_STATE,
  transientState: null,
  movementActive: false,
  unlockedCharacterIds: INITIAL_UNLOCKED_CHARACTER_IDS,

  setCharacter: (id) => {
    if (!CHARACTER_ROSTER_BY_ID[id]) return
    set({ activeCharacterId: id })
  },

  unlockCharacter: (id) => {
    if (!CHARACTER_ROSTER_BY_ID[id]) return
    set((state) => {
      if (state.unlockedCharacterIds.includes(id)) return state
      return { unlockedCharacterIds: [...state.unlockedCharacterIds, id] }
    })
  },

  setPersistentState: (state) =>
    set((current) => {
      if (current.transientState === "death") return current

      const nextState = normalizePersistentState(state)

      if (nextState === "dead") {
        return {
          persistentState: "dead",
          previousPersistentState: "dead",
          transientState: null,
          movementActive: false,
        }
      }

      return {
        persistentState: nextState,
        previousPersistentState: nextState,
      }
    }),

  setMovementActive: (active) =>
    set((current) => {
      if (current.transientState === "death" || current.persistentState === "dead") {
        return active ? current : { movementActive: false }
      }

      return { movementActive: Boolean(active) }
    }),

  playOneShot: (state) => {
    if (!isTransientCharacterState(state)) return false

    const current = get()

    if (current.transientState === "death") return false
    if (current.persistentState === "dead" && state !== "death") return false

    set({
      transientState: state,
      previousPersistentState: normalizePersistentState(current.persistentState),
      movementActive: state === "death" ? false : current.movementActive,
    })

    return true
  },

  clearTransientState: (nextStateOverride) =>
    set((current) => {
      if (!current.transientState) return current

      const definition = SHARED_ANIMATION_MAP[current.transientState]
      const resolvedPersistentState = resolvePostTransientState({
        transientState: current.transientState,
        previousPersistentState: current.previousPersistentState,
        nextState: nextStateOverride || definition?.nextState,
      })

      if (resolvedPersistentState === "dead") {
        return {
          transientState: null,
          persistentState: "dead",
          previousPersistentState: "dead",
          movementActive: false,
        }
      }

      return {
        transientState: null,
        persistentState: isPersistentCharacterState(resolvedPersistentState)
          ? resolvedPersistentState
          : DEFAULT_PERSISTENT_STATE,
        previousPersistentState: isPersistentCharacterState(resolvedPersistentState)
          ? resolvedPersistentState
          : DEFAULT_PERSISTENT_STATE,
      }
    }),

  resetToIdle: () =>
    set({
      persistentState: DEFAULT_PERSISTENT_STATE,
      previousPersistentState: DEFAULT_PERSISTENT_STATE,
      transientState: null,
      movementActive: false,
    }),
}))
