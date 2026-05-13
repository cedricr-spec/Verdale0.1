export const CHARACTER_FRAME_SIZE = 24
export const FRAME_WIDTH = CHARACTER_FRAME_SIZE
export const FRAME_HEIGHT = CHARACTER_FRAME_SIZE
export const SPRITESHEET_WIDTH = 216
export const SPRITESHEET_HEIGHT = 120

function createCharacterLayerFrame(x, y) {
  return Object.freeze({
    x,
    y,
    w: CHARACTER_FRAME_SIZE,
    h: CHARACTER_FRAME_SIZE,
    width: CHARACTER_FRAME_SIZE,
    height: CHARACTER_FRAME_SIZE,
  })
}

export const CHARACTER_HAND_FRONT_FRAME = createCharacterLayerFrame(192, 0)
export const CHARACTER_HAND_BACK_FRAME = createCharacterLayerFrame(192, 24)

export function getImageDimensions(source) {
  if (!source) return null

  if (
    Number.isFinite(source.naturalWidth) &&
    Number.isFinite(source.naturalHeight) &&
    source.naturalWidth > 0 &&
    source.naturalHeight > 0
  ) {
    return {
      width: source.naturalWidth,
      height: source.naturalHeight,
    }
  }

  if (
    Number.isFinite(source.width) &&
    Number.isFinite(source.height) &&
    source.width > 0 &&
    source.height > 0
  ) {
    return {
      width: source.width,
      height: source.height,
    }
  }

  return null
}

export function doesFrameFitSource(frame, source) {
  const dimensions = getImageDimensions(source)
  if (!frame || !dimensions) return false

  const width = frame.width || frame.w || CHARACTER_FRAME_SIZE
  const height = frame.height || frame.h || CHARACTER_FRAME_SIZE

  return (
    frame.x >= 0 &&
    frame.y >= 0 &&
    frame.x + width <= dimensions.width &&
    frame.y + height <= dimensions.height
  )
}

export function hasCharacterHandFrames(source) {
  return (
    doesFrameFitSource(CHARACTER_HAND_FRONT_FRAME, source) &&
    doesFrameFitSource(CHARACTER_HAND_BACK_FRAME, source)
  )
}

export const PERSISTENT_CHARACTER_STATES = ["idle", "run", "sit", "dead"]
export const TRANSIENT_CHARACTER_STATES = ["jump", "hurt", "death"]
export const DEFAULT_PERSISTENT_STATE = "idle"
export const RUN_ANIMATION_FPS = 6 // Tweak this value to change run speed.

export const SHARED_ANIMATION_MAP = {
  idle: { x: 0, y: 0, frames: 8, fps: 6, loop: true },
  run: { x: 0, y: 24, frames: 3, fps: RUN_ANIMATION_FPS, loop: true },
  jump: { x: 72, y: 24, frames: 1, fps: 1, loop: false, nextState: "idle" },
  death: {
    x: 0,
    y: 48,
    frames: 9,
    fps: 8,
    loop: false,
    holdLastFrame: true,
    nextState: "dead",
  },
  hurt: { x: 0, y: 72, frames: 1, fps: 1, loop: false, nextState: "idle" },
  sit: { x: 0, y: 96, frames: 2, fps: 1, loop: true, frameDelayMs: 3000 },
  dead: { x: 192, y: 48, frames: 1, fps: 1, loop: false },
}
