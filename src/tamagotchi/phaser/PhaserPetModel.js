import {
  CHARACTER_ROSTER,
  CHARACTER_ROSTER_BY_ID,
  DEFAULT_CHARACTER_SCALE,
} from "../config/characterRoster"
import { FRAME_HEIGHT, FRAME_WIDTH } from "../config/sharedAnimationMap"
import { getAnimationDefinition, resolvePetAnimationState } from "../lib/petAnimationResolver"
import { getFramePosition, getScaledSpriteMetrics } from "../lib/spritesheetUtils"
import { useCharacterStore } from "../store/useCharacterStore"
import { useWorldStore } from "../store/worldSlice"

const MOVEMENT_IDLE_DELAY = 120
const SIT_IDLE_DELAY_MS = 5000

export function syncPhaserPetMovementState() {
  const { lastMoveAt } = useWorldStore.getState()
  const { movementActive, setMovementActive } = useCharacterStore.getState()
  const shouldMove = Boolean(lastMoveAt && Date.now() - lastMoveAt < MOVEMENT_IDLE_DELAY)

  if (movementActive !== shouldMove) {
    setMovementActive(shouldMove)
  }

  return shouldMove
}

export function resolvePhaserPetModel({
  frameIndex = 0,
  viewportWidth = 0,
  viewportHeight = 0,
  characterIdOverride = null,
  persistentStateOverride = null,
  transientStateOverride = undefined,
  movementActiveOverride = null,
  facingDirectionOverride = null,
    scaleOverride = null,
  forceAnimationStateOverride = null,
} = {}) {
  const characterState = useCharacterStore.getState()
  const worldState = useWorldStore.getState()
  const isDead =
    characterState.persistentState === "dead" ||
    characterState.transientState === "death"
  const movementActive = isDead
    ? false
    : movementActiveOverride ?? characterState.movementActive

  const activeCharacterId = characterIdOverride || characterState.activeCharacterId
  const character =
    CHARACTER_ROSTER_BY_ID[activeCharacterId] ||
    CHARACTER_ROSTER[0] ||
    null

  if (!character?.spritesheet) return null

    const resolvedAnimationState = resolvePetAnimationState({
    persistentState: persistentStateOverride ?? characterState.persistentState,
    transientState:
      transientStateOverride === undefined
        ? characterState.transientState
        : transientStateOverride,
    movementActive,
    lastMoveAt: worldState.lastMoveAt,
    sitIdleDelayMs: SIT_IDLE_DELAY_MS,
  })

  const animationState = forceAnimationStateOverride || resolvedAnimationState
  const animation = getAnimationDefinition(animationState)
  const frameCount = Math.max(1, animation?.frames || 1)
  const safeFrameIndex = Math.min(Math.max(0, frameIndex), frameCount - 1)
  const frame = getFramePosition(animation, safeFrameIndex)

  const baseScale = character.scale ?? DEFAULT_CHARACTER_SCALE
  const scale = scaleOverride ?? baseScale
  const metrics = getScaledSpriteMetrics(scale)
  const offsetX = character.offsetX ?? 0
  const offsetY = character.offsetY ?? 0
  const centerX = Math.round(viewportWidth / 2 + offsetX)
  const centerY = Math.round(viewportHeight / 2 + offsetY)
  const facingDirection = facingDirectionOverride || worldState.facingDirection || "right"

  const shadow = character.shadow || null
  const baseShadowScale = shadow?.scale ?? baseScale
  const shadowScaleRatio = baseScale > 0 ? baseShadowScale / baseScale : 1
  const shadowScale = scale * shadowScaleRatio
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
        centerX: Math.round(centerX + (shadow.offsetX ?? 0)),
        centerY: Math.round(centerY + metrics.viewportHeight / 2 + (shadow.offsetY ?? 0)),
      }
    : null

  return {
    character,
    characterId: character.id,
    spritesheet: character.spritesheet,
    scale,
    baseScale,
    offsetX,
    offsetY,
    facingDirection,
    flipX: facingDirection === "left",
    animation,
    animationState,
    frameIndex: safeFrameIndex, 
    frameCount,
    frameX: frame.x,
    frameY: frame.y,
    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT,
    displayWidth: metrics.viewportWidth,
    displayHeight: metrics.viewportHeight,
    centerX,
    centerY,
    shadow,
    shadowModel,
  }
}

export function getNextPhaserPetFrameIndex({ currentFrameIndex = 0, animation } = {}) {
  const frameCount = Math.max(1, animation?.frames || 1)

  if (animation?.loop === false) {
    return Math.min(currentFrameIndex + 1, frameCount - 1)
  }

  return (currentFrameIndex + 1) % frameCount
}

export function getPhaserPetFrameDelay(animation) {
  if (Number.isFinite(animation?.frameDelayMs) && animation.frameDelayMs > 0) {
    return animation.frameDelayMs
  }

  return 1000 / Math.max(1, animation?.fps || 1)
}