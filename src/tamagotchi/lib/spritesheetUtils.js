import {
  FRAME_HEIGHT,
  FRAME_WIDTH,
  SPRITESHEET_HEIGHT,
  SPRITESHEET_WIDTH,
} from "../config/sharedAnimationMap"

export function getFramePosition(animation, frameIndex = 0) {
  return {
    x: animation.x + frameIndex * FRAME_WIDTH,
    y: animation.y,
  }
}

export function getScaledSpriteMetrics(scale = 1) {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1

  return {
    viewportWidth: FRAME_WIDTH * safeScale,
    viewportHeight: FRAME_HEIGHT * safeScale,
    spritesheetWidth: SPRITESHEET_WIDTH * safeScale,
    spritesheetHeight: SPRITESHEET_HEIGHT * safeScale,
    scale: safeScale,
  }
}
