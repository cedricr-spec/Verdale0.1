import React, { useEffect, useMemo, useRef, useState } from "react"
import Phaser from "phaser"
import TintedCtaButton from "./TintedCtaButton"
import { CHARACTER_ROSTER } from "../tamagotchi/config/characterRoster"
import { useCharacterStore } from "../tamagotchi/store/useCharacterStore"
import { useProgressionStore } from "../tamagotchi/store/progressionStore"
import { usePetStore } from "../tamagotchi/store/usePetStore"
import PhaserPet from "../tamagotchi/phaser/PhaserPet"
import {
  getCharacterLockIcon,
  sortCharactersByProgression,
} from "../tamagotchi/config/characterPresentation"
import mediumCta from "../hud/CTAs/CTA_Medium_8BIT.webp"
import mediumCtaPressed from "../hud/CTAs/CTA_Medium_8BIT_Pressed.webp"
import leftChevron from "../hud/CTAs/CTA_Small_8BIT_Chevron_Left.webp"
import leftChevronPressed from "../hud/CTAs/CTA_Small_8BIT_Chevron_Left_Pressed.webp"
import rightChevron from "../hud/CTAs/CTA_Small_8BIT_Chevron_Right.webp"
import rightChevronPressed from "../hud/CTAs/CTA_Small_8BIT_Chevron_Right_Pressed.webp"

const CHEVRON_BUTTON_SIZE = 52
const PREVIEW_CHARACTER_SCALE = 7
const PREVIEW_CANVAS_WIDTH = 448
const PREVIEW_CANVAS_HEIGHT = 224
const RANDOM_BUTTON_WIDTH = "132px"

function PhaserCharacterPreview({ characterId, scale = PREVIEW_CHARACTER_SCALE }) {
  const containerRef = useRef(null)
  const gameRef = useRef(null)
  const petRef = useRef(null)

  useEffect(() => {
    const parent = containerRef.current
    if (!parent || !characterId) return undefined
    parent.replaceChildren()

    class CharacterPickerScene extends Phaser.Scene {
      constructor() {
        super({ key: `CharacterPickerScene_${characterId}` })
      }

      create() {
        this.cameras.main.roundPixels = true
        petRef.current = new PhaserPet(this, {
          mode: "menu",
          characterId,
          persistentState: "idle",
          transientState: null,
          movementActive: false,
          facingDirection: "right",
          scaleOverride: scale,
          forceAnimationState: "idle",
        })
        petRef.current.setVisible(true)
        petRef.current.update()
      }

      update() {
        if (petRef.current) {
          petRef.current.setVisible(true)
          petRef.current.update()
        }
      }
    }

    const width = PREVIEW_CANVAS_WIDTH
    const height = PREVIEW_CANVAS_HEIGHT
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.style.display = "block"
    canvas.style.imageRendering = "pixelated"
    canvas.style.flexShrink = "0"
    canvas.getContext("2d", { willReadFrequently: true })

    gameRef.current = new Phaser.Game({
      type: Phaser.CANVAS,
      parent,
      canvas,
      width,
      height,
      backgroundColor: "rgba(0,0,0,0)",
      transparent: true,
      pixelArt: true,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.NONE,
        width,
        height,
      },
      render: {
        pixelArt: true,
        antialias: false,
        antialiasGL: false,
        roundPixels: true,
      },
      scene: CharacterPickerScene,
    })

    return () => {
      petRef.current?.destroy()
      petRef.current = null
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [characterId, scale])

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: `${PREVIEW_CANVAS_HEIGHT}px`,
        overflow: "hidden",
        imageRendering: "pixelated",
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    />
  )
}

function ChevronButton({ label, defaultImage, pressedImage, pressed, onPress, onRelease, color }) {
  const displayImage = pressed ? pressedImage || defaultImage : defaultImage

  return (
    <button
      type="button"
      aria-label={label}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture?.(e.pointerId)
        onPress?.()
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture?.(e.pointerId)
        onRelease?.()
      }}
      onPointerLeave={() => onRelease?.()}
      onPointerCancel={() => onRelease?.()}
      style={{
        width: `${CHEVRON_BUTTON_SIZE}px`,
        height: `${CHEVRON_BUTTON_SIZE}px`,
        border: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        cursor: "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
        flexShrink: 0,
      }}
    >
      <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
        <img
          src={displayImage}
          alt=""
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            imageRendering: "pixelated",
            display: "block",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitUserDrag: "none",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: color || "#8f8f8f",
            mixBlendMode: "color",
            pointerEvents: "none",
            WebkitMaskImage: `url(${displayImage})`,
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            WebkitMaskSize: "contain",
            maskImage: `url(${displayImage})`,
            maskRepeat: "no-repeat",
            maskPosition: "center",
            maskSize: "contain",
          }}
        />
      </div>
    </button>
  )
}

// Controlled component: previewedId and onPreviewChange are owned by the parent (CharacterMenu).
export default function CharacterPicker({ previewedId, onPreviewChange }) {
  const activeCharacterId = useCharacterStore((s) => s.activeCharacterId)
  const setCharacter = useCharacterStore((s) => s.setCharacter)
  const unlockedCharacterIds = useProgressionStore((s) => s.unlockedCharacterIds)
  const theme = usePetStore((s) => s.theme)
  const controlColor = theme?.modelColor || "#8f8f8f"

  const [leftPressed, setLeftPressed] = useState(false)
  const [rightPressed, setRightPressed] = useState(false)

  const characters = useMemo(
  () =>
    sortCharactersByProgression(
      Array.isArray(CHARACTER_ROSTER) ? CHARACTER_ROSTER : [],
      unlockedCharacterIds
    ),
  [unlockedCharacterIds]
)

  const previewIndex = useMemo(() => {
    const idx = characters.findIndex((c) => c.id === previewedId)
    return idx >= 0 ? idx : 0
  }, [characters, previewedId])

  const previewCharacter = characters[previewIndex] || characters[0] || null
  const isPreviewLocked = previewCharacter
    ? !unlockedCharacterIds.includes(previewCharacter.id)
    : false
  const previewLockIcon = previewCharacter ? getCharacterLockIcon(previewCharacter) : null

  const navigate = (delta) => {
    if (!characters.length) return
    const nextIndex = (previewIndex + delta + characters.length) % characters.length
    const next = characters[nextIndex]
    if (!next) return
    onPreviewChange?.(next.id)
    if (unlockedCharacterIds.includes(next.id)) {
      setCharacter(next.id)
    }
  }

  const pickRandomUnlocked = () => {
    const candidates = characters.filter(
      (c) => unlockedCharacterIds.includes(c.id) && c.id !== activeCharacterId
    )
    if (!candidates.length) return
    const next = candidates[Math.floor(Math.random() * candidates.length)]
    if (next) {
      onPreviewChange?.(next.id)
      setCharacter(next.id)
    }
  }

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
        <TintedCtaButton
          ariaLabel="Random character"
          defaultSrc={mediumCta}
          pressedSrc={mediumCtaPressed}
          tintColor={controlColor}
          label="Random"
          labelClassName="hud-ui-text hud-ui-text--cta"
          onClick={pickRandomUnlocked}
          width={RANDOM_BUTTON_WIDTH}
          height="52px"
        />
      </div>

      {/* Preview frame — no background panel, filter applied to sprite only */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: `${PREVIEW_CANVAS_HEIGHT}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* Sprite wrapper receives grayscale/dim filter for locked state */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            filter: isPreviewLocked ? "grayscale(1) brightness(0.45)" : "none",
            transition: "filter 0.15s ease",
          }}
        >
          {previewCharacter && (
            <PhaserCharacterPreview
              key={`${previewCharacter.id}-${PREVIEW_CHARACTER_SCALE}`}
              characterId={previewCharacter.id}
              scale={PREVIEW_CHARACTER_SCALE}
            />
          )}
        </div>

        {/* Lock icon — centered over the sprite */}
        {isPreviewLocked && previewLockIcon && (
          <div
            style={{
              position: "absolute",
              top: "70%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <img
              src={previewLockIcon}
              alt=""
              draggable={false}
              style={{
                width: "33px",
                height: "48px",
                imageRendering: "pixelated",
                pointerEvents: "none",
              }}
            />
          </div>
        )}
      </div>

      <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: `${CHEVRON_BUTTON_SIZE}px 1fr ${CHEVRON_BUTTON_SIZE}px`,
          alignItems: "center",
          gap: "8px",
        }}
      >
        <ChevronButton
          label="Previous character"
          defaultImage={leftChevron}
          pressedImage={leftChevronPressed}
          pressed={leftPressed}
          color={controlColor}
          onPress={() => setLeftPressed(true)}
          onRelease={() => {
            if (leftPressed) navigate(-1)
            setLeftPressed(false)
          }}
        />

        <div
          className="hud-ui-text"
          style={{
            fontSize: "16px",
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          {previewCharacter?.name || "Character"}
        </div>

        <ChevronButton
          label="Next character"
          defaultImage={rightChevron}
          pressedImage={rightChevronPressed}
          pressed={rightPressed}
          color={controlColor}
          onPress={() => setRightPressed(true)}
          onRelease={() => {
            if (rightPressed) navigate(1)
            setRightPressed(false)
          }}
        />
      </div>
    </div>
  )
}
