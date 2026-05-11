import { create } from "zustand"

let fxSequence = 0

const DEFAULT_FX_DURATION_MS = 220

export const WORLD_FX_CONFIG = Object.freeze({
  axe_slash: Object.freeze({
    durationMs: 220,
    frameCount: 4,
  }),
  pickaxe_slash: Object.freeze({
    durationMs: 220,
    frameCount: 4,
  }),
})

function getFxDurationMs(type) {
  return Math.max(
    80,
    Math.floor(Number(WORLD_FX_CONFIG[type]?.durationMs) || DEFAULT_FX_DURATION_MS)
  )
}

function createFxId(type = "fx") {
  fxSequence += 1
  return `${type}-${Date.now()}-${fxSequence}`
}

function createImpactItemSnapshot(item) {
  if (!item?.id || !item?.entry) return null

  return {
    id: item.id,
    x: item.x,
    y: item.y,
    scale: item.scale,
    anchorMode: item.anchorMode,
    anchorX: item.anchorX,
    anchorY: item.anchorY,
    renderWidth: item.renderWidth,
    renderHeight: item.renderHeight,
    entry: {
      id: item.entry.id,
      name: item.entry.name,
      x: item.entry.x,
      y: item.entry.y,
      width: item.entry.width,
      height: item.entry.height,
    },
  }
}

export const useWorldFxStore = create((set) => ({
  activeFx: [],
  activeObjectImpacts: [],

  spawnFx: ({ type, x, y, flipX = false }) => {
    if (!type || !Number.isFinite(x) || !Number.isFinite(y)) {
      return null
    }

    const createdAt = Date.now()
    const durationMs = getFxDurationMs(type)

    const nextFx = {
      id: createFxId(type),
      type,
      x,
      y,
      flipX: Boolean(flipX),
      createdAt,
      durationMs,
      expiresAt: createdAt + durationMs,
    }

    set((state) => ({
      activeFx: [...state.activeFx, nextFx],
    }))

    return nextFx.id
  },

  removeFx: (fxId) => {
    if (!fxId) return

    set((state) => ({
      activeFx: state.activeFx.filter((fx) => fx.id !== fxId),
    }))
  },

  cleanupExpiredFx: (now = Date.now()) => {
    set((state) => ({
      activeFx: state.activeFx.filter((fx) => !fx.expiresAt || fx.expiresAt > now),
      activeObjectImpacts: state.activeObjectImpacts.filter((impact) => {
        const startedAt = Number(impact.startedAt) || 0
        const durationMs = Number(impact.durationMs) || 0
        return startedAt + durationMs > now
      }),
    }))
  },

  spawnObjectImpact: ({ objectId, item, durationMs = 140 }) => {
    const itemSnapshot = createImpactItemSnapshot(item)
    const safeDurationMs = Math.max(80, Math.floor(Number(durationMs) || 140))

    if (!objectId || !itemSnapshot) {
      return null
    }

    const nextImpact = {
      objectId,
      item: itemSnapshot,
      startedAt: Date.now(),
      durationMs: safeDurationMs,
    }

    set((state) => ({
      activeObjectImpacts: [
        ...state.activeObjectImpacts.filter((impact) => impact.objectId !== objectId),
        nextImpact,
      ],
    }))

    return nextImpact
  },

  removeObjectImpact: (objectId) => {
    if (!objectId) return

    set((state) => ({
      activeObjectImpacts: state.activeObjectImpacts.filter(
        (impact) => impact.objectId !== objectId
      ),
    }))
  },
}))