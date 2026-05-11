import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  CHARACTER_ROSTER,
  CHARACTER_ROSTER_BY_ID,
  DEFAULT_CHARACTER_SCALE,
  DEFAULT_CHARACTER_SHADOW,
} from "../config/characterRoster"
import { DEFAULT_PERSISTENT_STATE } from "../config/sharedAnimationMap"
import { getAnimationDefinition, resolvePetAnimationState } from "../lib/petAnimationResolver"
import { getFramePosition, getScaledSpriteMetrics } from "../lib/spritesheetUtils"
import { useCharacterStore } from "../store/useCharacterStore"
import { usePetStore } from "../store/usePetstore"
import { useWorldStore } from "../store/worldSlice"

const MOVEMENT_IDLE_DELAY = 120

export default function PetSprite({
  characterId = null,
  previewMode = false,
  forceAnimation = null,
  scaleOverride,
  forceFacingDirection = null,
}) {
  const activeCharacterId = useCharacterStore((state) => state.activeCharacterId)
  const persistentState = useCharacterStore((state) => state.persistentState)
  const transientState = useCharacterStore((state) => state.transientState)
  const movementActive = useCharacterStore((state) => state.movementActive)
  const clearTransientState = useCharacterStore((state) => state.clearTransientState)
  const playOneShot = useCharacterStore((state) => state.playOneShot)
  const setPersistentState = useCharacterStore((state) => state.setPersistentState)
  const setMovementActive = useCharacterStore((state) => state.setMovementActive)
  const lastMoveAt = useWorldStore((state) => state.lastMoveAt)
  const facingDirection = useWorldStore((state) => state.facingDirection)
  const petColor = usePetStore((state) => state.theme?.petColor || "#ffffff")
  const health = usePetStore((state) => state.health)

  const [frameIndex, setFrameIndex] = useState(0)
  const previousHealthRef = useRef(health)
  const targetCharacterId = characterId || activeCharacterId

  const activeCharacter =
    CHARACTER_ROSTER_BY_ID[targetCharacterId] ||
    CHARACTER_ROSTER_BY_ID[CHARACTER_ROSTER[0]?.id] ||
    null
  const shadow = activeCharacter?.shadow || DEFAULT_CHARACTER_SHADOW
  const shouldForceDeadAtMount =
    !previewMode &&
    !forceAnimation &&
    health <= 0 &&
    previousHealthRef.current <= 0 &&
    transientState !== "death" &&
    persistentState !== "dead"

  const resolvedAnimationState = useMemo(
    () =>
      forceAnimation ||
      (previewMode
        ? "idle"
        : shouldForceDeadAtMount
        ? "dead"
        : resolvePetAnimationState({
            persistentState,
            transientState,
            movementActive,
          })),
    [
      forceAnimation,
      movementActive,
      persistentState,
      previewMode,
      shouldForceDeadAtMount,
      transientState,
    ]
  )

  const animation = getAnimationDefinition(resolvedAnimationState)
  const animationStartRef = useRef(0)
  const completedAnimationRef = useRef(false)

  useEffect(() => {
    if (previewMode) return
    if (!lastMoveAt) return

    setMovementActive(true)

    const timeoutId = window.setTimeout(() => {
      useCharacterStore.getState().setMovementActive(false)
    }, MOVEMENT_IDLE_DELAY)

    return () => window.clearTimeout(timeoutId)
  }, [lastMoveAt, previewMode, setMovementActive])

  useEffect(() => {
    if (previewMode) return
    if (!import.meta.env.DEV) return

    window.petSpriteDebug = {
      listCharacters: () => CHARACTER_ROSTER.map(({ id, name }) => ({ id, name })),
      setCharacter: (id) => useCharacterStore.getState().setCharacter(id),
      setPersistentState: (state) => useCharacterStore.getState().setPersistentState(state),
      playOneShot: (state) => useCharacterStore.getState().playOneShot(state),
      clearTransientState: () => useCharacterStore.getState().clearTransientState(),
      resetToIdle: () => useCharacterStore.getState().resetToIdle(),
      getState: () => ({
        ...useCharacterStore.getState(),
        resolvedAnimationState: resolvePetAnimationState(useCharacterStore.getState()),
      }),
    }

    return () => {
      delete window.petSpriteDebug
    }
  }, [previewMode])

  useEffect(() => {
    if (previewMode) return
    const previousHealth = previousHealthRef.current

    if (health <= 0) {
      if (previousHealth > 0) {
        playOneShot("death")
      } else if (transientState !== "death" && persistentState !== "dead") {
        setPersistentState("dead")
      }
    }

    previousHealthRef.current = health
  }, [health, persistentState, playOneShot, previewMode, setPersistentState, transientState])

  useEffect(() => {
    animationStartRef.current = performance.now()
    completedAnimationRef.current = false
    setFrameIndex(0)
  }, [resolvedAnimationState, targetCharacterId])

  useEffect(() => {
    if (!animation) return

    let frameRequestId = 0

    const frameDuration = 1000 / Math.max(animation.fps || 1, 1)
    const totalDuration = animation.frames * frameDuration

    const updateFrame = (now) => {
      const elapsed = now - animationStartRef.current
      let nextFrame = 0

      if (animation.loop) {
        nextFrame = Math.floor(elapsed / frameDuration) % animation.frames
      } else {
        nextFrame = Math.min(animation.frames - 1, Math.floor(elapsed / frameDuration))

        if (
          transientState === resolvedAnimationState &&
          elapsed >= totalDuration &&
          !completedAnimationRef.current
        ) {
          completedAnimationRef.current = true
          clearTransientState(animation.nextState)
        }
      }

      setFrameIndex((current) => (current === nextFrame ? current : nextFrame))
      frameRequestId = requestAnimationFrame(updateFrame)
    }

    frameRequestId = requestAnimationFrame(updateFrame)

    return () => cancelAnimationFrame(frameRequestId)
  }, [animation, clearTransientState, resolvedAnimationState, transientState])

  if (!activeCharacter) return null

  const baseCharacterScale = activeCharacter.scale ?? DEFAULT_CHARACTER_SCALE
  const characterScale = scaleOverride ?? baseCharacterScale
  const metrics = getScaledSpriteMetrics(characterScale)
  const baseShadowScale = shadow?.scale ?? baseCharacterScale
  const shadowScaleRatio = baseCharacterScale > 0 ? baseShadowScale / baseCharacterScale : 1
  const shadowScale =
    scaleOverride !== undefined ? characterScale * shadowScaleRatio : baseShadowScale
  const shadowWidth = (shadow?.width || 17) * shadowScale
  const shadowHeight = (shadow?.height || 6) * shadowScale
  const shadowOffsetX = shadow?.offsetX ?? 0
  const shadowOffsetY = shadow?.offsetY ?? 0
  const shadowOpacity = shadow?.opacity ?? 1
  const framePosition = getFramePosition(animation, frameIndex)
  const frameX = framePosition.x * metrics.scale
  const frameY = framePosition.y * metrics.scale
  const safeLabel = `${activeCharacter.name} ${resolvedAnimationState || DEFAULT_PERSISTENT_STATE}`
  const resolvedFacingDirection = forceFacingDirection || (previewMode ? "right" : facingDirection)
  const spriteFlipScale = resolvedFacingDirection === "left" ? -1 : 1

  const viewportStyle = {
    position: "relative",
    width: `${metrics.viewportWidth}px`,
    height: `${metrics.viewportHeight}px`,
    overflow: "hidden",
    imageRendering: "pixelated",
    pointerEvents: "none",
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          width: `${metrics.viewportWidth}px`,
          height: `${metrics.viewportHeight}px`,
          transform: `translate(${activeCharacter.offsetX || 0}px, ${activeCharacter.offsetY || 0}px)`,
          transformOrigin: "center center",
          pointerEvents: "none",
        }}
      >
        <div
          data-layer="shadow"
          style={{
            position: "absolute",
            left: "50%",
            top: `${metrics.viewportHeight - shadowHeight / 2 + shadowOffsetY}px`,
            width: `${shadowWidth}px`,
            height: `${shadowHeight}px`,
            transform: `translateX(-50%) translateX(${shadowOffsetX}px)`,
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          <img
            src={shadow.sprite}
            alt=""
            draggable="false"
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              opacity: shadowOpacity,
              imageRendering: "pixelated",
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        </div>

        <div
          data-layer="sprite"
          aria-label={safeLabel}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            transform: `scaleX(${spriteFlipScale})`,
            transformOrigin: "center center",
            zIndex: 1,
          }}
        >
          {activeCharacter.useTint ? (
            <div
              style={{
                ...viewportStyle,
                backgroundColor: petColor,
                WebkitMaskImage: `url("${activeCharacter.spritesheet}")`,
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskSize: `${metrics.spritesheetWidth}px ${metrics.spritesheetHeight}px`,
                WebkitMaskPosition: `-${frameX}px -${frameY}px`,
                maskImage: `url("${activeCharacter.spritesheet}")`,
                maskRepeat: "no-repeat",
                maskSize: `${metrics.spritesheetWidth}px ${metrics.spritesheetHeight}px`,
                maskPosition: `-${frameX}px -${frameY}px`,
              }}
            />
          ) : (
            <div style={viewportStyle}>
              <img
                src={activeCharacter.spritesheet}
                alt=""
                draggable="false"
                style={{
                  position: "absolute",
                  top: `-${frameY}px`,
                  left: `-${frameX}px`,
                  width: `${metrics.spritesheetWidth}px`,
                  height: `${metrics.spritesheetHeight}px`,
                  imageRendering: "pixelated",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
