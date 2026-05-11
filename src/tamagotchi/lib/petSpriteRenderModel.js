import {
  CHARACTER_ROSTER,
  CHARACTER_ROSTER_BY_ID,
  DEFAULT_CHARACTER_SCALE,
} from "../config/characterRoster"
import { FRAME_HEIGHT, FRAME_WIDTH } from "../config/sharedAnimationMap"
import { getAnimationDefinition, resolvePetAnimationState } from "./petAnimationResolver"
import { getFramePosition, getScaledSpriteMetrics } from "./spritesheetUtils"

export function getPetSpriteRenderModel({
  activeCharacterId,
  persistentState,
  transientState,
  movementActive,
  facingDirection = "right",
  frameIndex = 0,
  scaleOverride = undefined,
  viewportWidth = 0,
  viewportHeight = 0,
} = {}) {
  const character =
    CHARACTER_ROSTER_BY_ID[activeCharacterId] ||
    CHARACTER_ROSTER[0] ||
    null

  if (!character) return null

  const animationState = resolvePetAnimationState({
    persistentState,
    transientState,
    movementActive,
  })
  const animation = getAnimationDefinition(animationState)
  const frameCount = Math.max(1, animation?.frames || 1)
  const safeFrameIndex = Math.min(Math.max(0, frameIndex), frameCount - 1)
  const frame = getFramePosition(animation, safeFrameIndex)

  const baseScale = character.scale ?? DEFAULT_CHARACTER_SCALE
  const scale = scaleOverride ?? baseScale
  const metrics = getScaledSpriteMetrics(scale)
  const characterOffsetX = character.offsetX ?? 0
  const characterOffsetY = character.offsetY ?? 0

  const centerX = Math.round(viewportWidth / 2 + characterOffsetX * scale)
  const centerY = Math.round(viewportHeight / 2 + characterOffsetY * scale)
  const width = metrics.viewportWidth
  const height = metrics.viewportHeight
  const drawX = centerX - width / 2
  const drawY = centerY - height / 2

  const shadow = character.shadow || null
  const baseShadowScale = shadow?.scale ?? baseScale
  const shadowScaleRatio = baseScale > 0 ? baseShadowScale / baseScale : 1
  const shadowScale = scaleOverride !== undefined ? scale * shadowScaleRatio : baseShadowScale
  const shadowModel = shadow
    ? {
        sprite: shadow.sprite,
        width: shadow.width || 17,
        height: shadow.height || 6,
        scale: shadowScale,
        opacity: shadow.opacity ?? 1,
        offsetX: shadow.offsetX ?? 0,
        offsetY: shadow.offsetY ?? 0,
        displayWidth: (shadow.width || 17) * shadowScale,
        displayHeight: (shadow.height || 6) * shadowScale,
        x: Math.round(centerX + (shadow.offsetX ?? 0) * scale),
        y: Math.round(centerY + (shadow.offsetY ?? 0) * scale),
      }
    : null

  return {
    character,
    characterId: character.id,
    spritesheet: character.spritesheet,
    scale,
    baseScale,
    characterOffsetX,
    characterOffsetY,
    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT,
    animationState,
    animation,
    frameIndex: safeFrameIndex,
    frameCount,
    frame,
    frameX: frame.x,
    frameY: frame.y,
    width,
    height,
    centerX,
    centerY,
    drawX,
    drawY,
    facingDirection,
    flipX: facingDirection === "left",
    shadow,
    shadowModel,
  }
}

export function getNextPetFrameIndex({
  currentFrameIndex = 0,
  animation,
} = {}) {
  const frameCount = Math.max(1, animation?.frames || 1)

  if (animation?.loop === false) {
    return Math.min(currentFrameIndex + 1, frameCount - 1)
  }

  return (currentFrameIndex + 1) % frameCount
}

export function getPetFrameDelay(animation) {
  return 1000 / Math.max(1, animation?.fps || 1)
}