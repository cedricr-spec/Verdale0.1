import { create } from "zustand"

function buildBrokenObjectIdMap(hiddenObjectIds = {}, replacedObjectIds = {}) {
  return {
    ...hiddenObjectIds,
    ...Object.fromEntries(Object.keys(replacedObjectIds).map((id) => [id, true])),
  }
}

export const useBrokenObjectsStore = create((set, get) => ({
  hiddenObjectIds: {},
  replacedObjectIds: {},
  stumpObjects: {},
  brokenObjectIds: {},
  objectStateRevision: 0,
  worldFeedback: null,
  worldFeedbackNonce: 0,

  hideObject: (id) => {
    if (!id) return

    set((state) => ({
      hiddenObjectIds: { ...state.hiddenObjectIds, [id]: true },
      brokenObjectIds: buildBrokenObjectIdMap(
        { ...state.hiddenObjectIds, [id]: true },
        state.replacedObjectIds
      ),
      objectStateRevision: state.objectStateRevision + 1,
    }))
  },

  replaceObject: ({
    originalObjectId,
    stumpObject = null,
  }) => {
    if (import.meta.env.DEV) {
      console.log("[STORE-REPLACE-CALLED]", {
        originalObjectId,
        stumpObject,
      })
    }

    if (!originalObjectId || !stumpObject?.id) return

    set((state) => {
      const nextReplacedObjectIds = {
        ...state.replacedObjectIds,
        [originalObjectId]: {
          originalObjectId,
          stumpObjectId: stumpObject.id,
          entryId: stumpObject.entryId || null,
        },
      }
      const nextStumpObjects = {
        ...state.stumpObjects,
        [stumpObject.id]: stumpObject,
      }
      const nextState = {
        replacedObjectIds: nextReplacedObjectIds,
        stumpObjects: nextStumpObjects,
        hiddenObjectIds: state.hiddenObjectIds,
        brokenObjectIds: buildBrokenObjectIdMap(
          state.hiddenObjectIds,
          nextReplacedObjectIds
        ),
        objectStateRevision: state.objectStateRevision + 1,
      }

      if (import.meta.env.DEV) {
        console.log("[STORE-REPLACE-SAVED]", {
          replacedObjectIds: nextState.replacedObjectIds,
          stumpObjects: nextState.stumpObjects,
          objectStateRevision: nextState.objectStateRevision,
        })
        console.debug("[chop-store-state]", {
          hiddenObjectIds: nextState.hiddenObjectIds,
          replacedObjectIds: nextState.replacedObjectIds,
          stumpObjects: nextState.stumpObjects,
        })
      }

      return nextState
    })
  },

  breakObject: (id) => {
    get().hideObject(id)
  },

  isObjectBroken: (id) => Boolean(get().brokenObjectIds[id]),
  isObjectHidden: (id) => Boolean(get().hiddenObjectIds[id]),
  getObjectReplacement: (id) => get().replacedObjectIds[id] || null,

  showWorldFeedback: (message) => {
    set((state) => ({
      worldFeedback: message,
      worldFeedbackNonce: state.worldFeedbackNonce + 1,
    }))
  },
}))
