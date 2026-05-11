export const FRAME_WIDTH = 24
export const FRAME_HEIGHT = 24
export const SPRITESHEET_WIDTH = 216
export const SPRITESHEET_HEIGHT = 120

export const PERSISTENT_CHARACTER_STATES = ["idle", "run", "sit", "dead"]
export const TRANSIENT_CHARACTER_STATES = ["jump", "hurt", "death"]
export const DEFAULT_PERSISTENT_STATE = "idle"
export const RUN_ANIMATION_FPS = 5 // Tweak this value to change run speed.

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
  sit: { x: 0, y: 96, frames: 2, fps: 2, loop: true },
  dead: { x: 192, y: 48, frames: 1, fps: 1, loop: false },
}
