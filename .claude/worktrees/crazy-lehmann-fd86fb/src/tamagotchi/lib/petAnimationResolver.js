import {
  DEFAULT_PERSISTENT_STATE,
  PERSISTENT_CHARACTER_STATES,
  SHARED_ANIMATION_MAP,
  TRANSIENT_CHARACTER_STATES,
} from "../config/sharedAnimationMap"

export function isPersistentCharacterState(state) {
  return PERSISTENT_CHARACTER_STATES.includes(state)
}

export function isTransientCharacterState(state) {
  return TRANSIENT_CHARACTER_STATES.includes(state)
}

export function normalizePersistentState(state) {
  return isPersistentCharacterState(state) ? state : DEFAULT_PERSISTENT_STATE
}

export function resolvePetAnimationState({
  persistentState,
  transientState,
  movementActive,
}) {
  if (transientState === "death") return "death"
  if (persistentState === "dead") return "dead"
  if (transientState && isTransientCharacterState(transientState)) return transientState
  if (movementActive) return "run"

  return normalizePersistentState(persistentState)
}

export function resolvePostTransientState({
  transientState,
  previousPersistentState,
  nextState,
}) {
  if (transientState === "death" || nextState === "dead") {
    return "dead"
  }

  if (isPersistentCharacterState(previousPersistentState)) {
    return previousPersistentState
  }

  return normalizePersistentState(nextState)
}

export function getAnimationDefinition(state) {
  return SHARED_ANIMATION_MAP[state] || SHARED_ANIMATION_MAP[DEFAULT_PERSISTENT_STATE]
}
