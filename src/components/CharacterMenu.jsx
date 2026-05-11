import React, { useState, useEffect, useRef } from "react"
import Phaser from "phaser"
import TintedCtaButton from "./TintedCtaButton"
import CharacterPicker from "./CharacterPicker"
import { CHARACTER_ROSTER } from "../tamagotchi/config/characterRoster"
import { useCharacterStore } from "../tamagotchi/store/useCharacterStore"
import { useProgressionStore } from "../tamagotchi/store/progressionStore"
import { usePetStore } from "../tamagotchi/store/usePetStore"
import PhaserPet from "../tamagotchi/phaser/PhaserPet"
import {
  getCharacterLockIcon,
  sortCharactersByProgression,
} from "../tamagotchi/config/characterPresentation"
import menuButton from "../hud/CTAs/CTA_Small_8BIT_Character.webp"
import menuButtonPressed from "../hud/CTAs/CTA_Small_8BIT_Character_Pressed.webp"
import closeButton from "../hud/CTAs/CTA_Small_8BIT_Close.webp"
import closeButtonPressed from "../hud/CTAs/CTA_Small_8BIT_Close_Pressed.webp"
import scrollbarThumb from "../hud/CTAs/Scrollbar_8BIT.webp"
import scrollbarThumbHover from "../hud/CTAs/Scrollbar_8BIT_Hover.webp"
import selectVisualHelper from "../hud/Select_Visual_Helper.png"

// Toggle button sits to the LEFT of CustomizerPanel's button (right:20px, w:52px → gap:8px → right:80px)
const TOGGLE_BUTTON_SIZE = 52
const TOGGLE_BUTTON_TOP = 16
const TOGGLE_BUTTON_RIGHT = 80
const CONTENT_WIDTH = "min(520px, calc(100vw - 72px))"
const CUSTOM_SCROLLBAR_WIDTH = TOGGLE_BUTTON_SIZE
const CUSTOM_SCROLLBAR_RIGHT = 18
const CUSTOM_SCROLLBAR_TOP = 86
const CUSTOM_SCROLLBAR_BOTTOM = 26
const CUSTOM_SCROLLBAR_MIN_THUMB_HEIGHT = 54

const GRID_SCALE = 2.0       // PetSprite scale inside cell — viewport = 48×48px
const GRID_CELL_SIZE = 64    // outer cell px
const SELECTOR_SIZE = 76     // px — slightly overflows the 64px cell on each side



function PhaserCharacterCell({ characterId, visible = true }) {
  const containerRef = useRef(null)
  const gameRef = useRef(null)
  const petRef = useRef(null)

  useEffect(() => {
    const parent = containerRef.current
    if (!parent) return undefined

    class CharacterMenuScene extends Phaser.Scene {
      constructor() {
        super({ key: `CharacterMenuScene_${characterId}` })
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
          scaleOverride: GRID_SCALE,
          forceAnimationState: "idle",
        })
        petRef.current.setVisible(true)
        petRef.current.update()
      }

      update() {
        const pet = petRef.current
        if (!pet) return

        pet.setVisible(true)
        pet.update()

        const spriteReady = Boolean(pet.sprite?.sprite)
        const shadowReady = !pet.model?.shadowModel || Boolean(pet.shadow?.sprite)
        if (spriteReady && shadowReady) {
          this.scene.pause()
        }
      }
    }

    const canvas = document.createElement("canvas")
canvas.width = GRID_CELL_SIZE
canvas.height = GRID_CELL_SIZE
canvas.style.width = `${GRID_CELL_SIZE}px`
canvas.style.height = `${GRID_CELL_SIZE}px`
canvas.style.imageRendering = "pixelated"
canvas.getContext("2d", { willReadFrequently: true })

gameRef.current = new Phaser.Game({
  type: Phaser.CANVAS,
  parent,
  canvas,
  width: GRID_CELL_SIZE,
      height: GRID_CELL_SIZE,
      backgroundColor: "rgba(0,0,0,0)",
      transparent: true,
      pixelArt: true,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.NONE,
        width: GRID_CELL_SIZE,
        height: GRID_CELL_SIZE,
      },
      render: {
        pixelArt: true,
        antialias: false,
        antialiasGL: false,
        roundPixels: true,
      },
      scene: CharacterMenuScene,
    })

    return () => {
      petRef.current?.destroy()
      petRef.current = null
      gameRef.current?.destroy(true)
      gameRef.current = null
    }
  }, [characterId])

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        width: `${GRID_CELL_SIZE}px`,
        height: `${GRID_CELL_SIZE}px`,
        overflow: "hidden",
        imageRendering: "pixelated",
        pointerEvents: "none",
      }}
    />
  )
}

function CharacterGridItem({ character, isActive, isPreviewed, isUnlocked, onSelect, menuOpen }) {
  const isSelected = isPreviewed  // selector follows preview only — never duplicate for active
  const lockIcon = getCharacterLockIcon(character)

  return (
    // Outer wrapper: overflow:visible so the selector image can bleed past the cell edges
    <div
      role="button"
      aria-label={`${character.name}${isUnlocked ? "" : " (verrouillé)"}`}
      onClick={() => onSelect(character.id)}
      style={{
        position: "relative",
        width: `${GRID_CELL_SIZE}px`,
        height: `${GRID_CELL_SIZE}px`,
        flexShrink: 0,
        cursor: isUnlocked ? "pointer" : "default",
      }}
    >
      {/* Inner cell — clips the sprite and lock overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "8px",
          overflow: "hidden",
          backgroundColor: "rgba(0,0,0,0.3)",
        }}
      >
        {/* Character sprite with filter for locked state */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            filter: isUnlocked ? "none" : "grayscale(1) brightness(0.38)",
          }}
        >
          {menuOpen && <PhaserCharacterCell characterId={character.id} visible />}
        </div>

        {/* Lock overlay */}
        {!isUnlocked && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            <img
              src={lockIcon}
              alt=""
              draggable={false}
              style={{
                width: "22px",
                height: "32px",
                imageRendering: "pixelated",
                pointerEvents: "none",
              }}
            />
          </div>
        )}
      </div>

      {/* Selection helper — rendered outside inner cell so it overflows */}
      {isSelected && (
        <img
          src={selectVisualHelper}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: `${SELECTOR_SIZE}px`,
            height: `${SELECTOR_SIZE}px`,
            imageRendering: "pixelated",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}
    </div>
  )
}

export default function CharacterMenu({ open, onToggle }) {
  const panelRef = useRef()
  const toggleButtonRef = useRef()
  const scrollbarDragRef = useRef({
    active: false,
    pointerId: null,
    startY: 0,
    startScrollTop: 0,
  })
  const [scrollbarHover, setScrollbarHover] = useState(false)
  const [scrollbarState, setScrollbarState] = useState({
    scrollTop: 0,
    scrollHeight: 1,
    clientHeight: 1,
  })

  const activeCharacterId = useCharacterStore((s) => s.activeCharacterId)
  const setCharacter = useCharacterStore((s) => s.setCharacter)
  const unlockedCharacterIds = useProgressionStore((s) => s.unlockedCharacterIds)
  const theme = usePetStore((s) => s.theme)
  const controlColor = theme?.modelColor || "#8f8f8f"

  const [previewedId, setPreviewedId] = useState(activeCharacterId)
  const sortedCharacters = sortCharactersByProgression(CHARACTER_ROSTER, unlockedCharacterIds)

  // Reset preview to current active character each time the menu opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) setPreviewedId(activeCharacterId)
  }, [open])

  const canScroll = scrollbarState.scrollHeight > scrollbarState.clientHeight + 1
  const scrollbarTrackHeight = `calc(100vh - ${CUSTOM_SCROLLBAR_TOP + CUSTOM_SCROLLBAR_BOTTOM}px)`
  const scrollbarThumbHeight = canScroll
    ? Math.max(
        CUSTOM_SCROLLBAR_MIN_THUMB_HEIGHT,
        (scrollbarState.clientHeight / scrollbarState.scrollHeight) *
          Math.max(1, scrollbarState.clientHeight - CUSTOM_SCROLLBAR_TOP - CUSTOM_SCROLLBAR_BOTTOM)
      )
    : CUSTOM_SCROLLBAR_MIN_THUMB_HEIGHT
  const scrollbarMaxTravel = Math.max(
    0,
    scrollbarState.clientHeight -
      CUSTOM_SCROLLBAR_TOP -
      CUSTOM_SCROLLBAR_BOTTOM -
      scrollbarThumbHeight
  )
  const scrollbarProgress = canScroll
    ? scrollbarState.scrollTop / (scrollbarState.scrollHeight - scrollbarState.clientHeight)
    : 0
  const scrollbarThumbTop = CUSTOM_SCROLLBAR_TOP + scrollbarMaxTravel * scrollbarProgress

  const handleScrollbarPointerDown = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const panel = panelRef.current
    if (!panel) return
    scrollbarDragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: panel.scrollTop,
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handleScrollbarPointerMove = (event) => {
    if (!scrollbarDragRef.current.active) return
    event.preventDefault()
    event.stopPropagation()
    const panel = panelRef.current
    if (!panel || scrollbarMaxTravel <= 0) return
    const deltaY = event.clientY - scrollbarDragRef.current.startY
    const maxScrollTop = panel.scrollHeight - panel.clientHeight
    const nextScrollTop =
      scrollbarDragRef.current.startScrollTop + (deltaY / scrollbarMaxTravel) * maxScrollTop
    panel.scrollTop = Math.max(0, Math.min(maxScrollTop, nextScrollTop))
  }

  const handleScrollbarPointerUp = (event) => {
    event.preventDefault()
    event.stopPropagation()
    scrollbarDragRef.current = { active: false, pointerId: null, startY: 0, startScrollTop: 0 }
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      const clickedInsidePanel = panelRef.current?.contains(e.target)
      const clickedToggleButton = toggleButtonRef.current?.contains(e.target)
      if (!clickedInsidePanel && !clickedToggleButton) {
        if (open && onToggle) onToggle()
      }
    }
    document.addEventListener("pointerdown", handleClickOutside)
    return () => document.removeEventListener("pointerdown", handleClickOutside)
  }, [open, onToggle])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return undefined
    const update = () =>
      setScrollbarState({
        scrollTop: panel.scrollTop,
        scrollHeight: panel.scrollHeight,
        clientHeight: panel.clientHeight,
      })
    update()
    panel.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      panel.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [open])

  const handleGridSelect = (id) => {
    setPreviewedId(id)
    if (unlockedCharacterIds.includes(id)) {
      setCharacter(id)
    }
  }

  return (
    <>
      <TintedCtaButton
        ref={toggleButtonRef}
        ariaLabel={open ? "Fermer le menu personnage" : "Ouvrir le menu personnage"}
        defaultSrc={open ? closeButton : menuButton}
        pressedSrc={open ? closeButtonPressed : menuButtonPressed}
        tintColor={controlColor}
        onClick={() => onToggle?.()}
        width={`${TOGGLE_BUTTON_SIZE}px`}
        height={`${TOGGLE_BUTTON_SIZE}px`}
        style={{
          position: "fixed",
          top: `${TOGGLE_BUTTON_TOP}px`,
          right: `${TOGGLE_BUTTON_RIGHT}px`,
          zIndex: 1000001,
        }}
      />

      <div
        ref={panelRef}
        className="customizer-panel-scroll hud-ui-text-scope"
        onWheel={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          overflowY: "auto",
          direction: "rtl",
          scrollbarWidth: "none",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          backgroundColor: "rgba(6, 10, 18, 0.34)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxSizing: "border-box",
          zIndex: 999998,
          isolation: "isolate",
          pointerEvents: open ? "auto" : "none",
          opacity: open ? 1 : 0,
          visibility: open ? "visible" : "hidden",
          transition: "opacity 0.2s linear, visibility 0.2s linear",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: "12px",
          paddingTop: "28px",
          paddingBottom: "5vh",
          overscrollBehaviorY: "auto",
          touchAction: "pan-y",
          scrollbarGutter: "stable",
          paddingRight: 0,
        }}
      >
        {/* Title — anchored near top, no heavy spacer */}
        <div
          style={{
            direction: "ltr",
            width: CONTENT_WIDTH,
            maxWidth: CONTENT_WIDTH,
            boxSizing: "border-box",
            flexShrink: 0,
          }}
        >
          <div
            className="hud-ui-text"
            style={{
              fontSize: "18px",
              letterSpacing: "0.14em",
              textAlign: "center",
              userSelect: "none",
              opacity: 0.9,
            }}
          >
            CHARACTERS
          </div>
        </div>

        {/* Character picker: preview sprite + arrows */}
        <div
          style={{
            direction: "ltr",
            width: CONTENT_WIDTH,
            maxWidth: CONTENT_WIDTH,
            boxSizing: "border-box",
          }}
        >
          <CharacterPicker previewedId={previewedId} onPreviewChange={setPreviewedId} />
        </div>

        {/* Character grid */}
        <div
          style={{
            direction: "ltr",
            width: CONTENT_WIDTH,
            maxWidth: CONTENT_WIDTH,
            boxSizing: "border-box",
          }}
        >
          <div
            className="hud-ui-text"
            style={{
              fontSize: "12px",
              opacity: 0.5,
              marginBottom: "10px",
              letterSpacing: "0.1em",
            }}
          >
            ALL CHARACTERS
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            {sortedCharacters.map((character) => {
              const isUnlocked = unlockedCharacterIds.includes(character.id)
              const isActive = character.id === activeCharacterId
              const isPreviewed = character.id === previewedId
              return (
                <CharacterGridItem
                  key={character.id}
                  character={character}
                  isActive={isActive}
                  isPreviewed={isPreviewed}
                  isUnlocked={isUnlocked}
                  onSelect={handleGridSelect}
                  menuOpen={open}
                />
              )
            })}
          </div>
        </div>
      </div>

      {open && canScroll && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: `${CUSTOM_SCROLLBAR_TOP}px`,
            right: `${CUSTOM_SCROLLBAR_RIGHT}px`,
            width: `${CUSTOM_SCROLLBAR_WIDTH}px`,
            display: "flex",
            justifyContent: "center",
            height: scrollbarTrackHeight,
            zIndex: 999999,
            pointerEvents: "none",
          }}
        >
          <div
            onPointerDown={handleScrollbarPointerDown}
            onPointerMove={handleScrollbarPointerMove}
            onPointerUp={handleScrollbarPointerUp}
            onPointerCancel={handleScrollbarPointerUp}
            onMouseEnter={() => setScrollbarHover(true)}
            onMouseLeave={() => setScrollbarHover(false)}
            style={{
              position: "absolute",
              top: `${scrollbarThumbTop - CUSTOM_SCROLLBAR_TOP}px`,
              right: 0,
              width: `${CUSTOM_SCROLLBAR_WIDTH}px`,
              height: `${scrollbarThumbHeight}px`,
              pointerEvents: "auto",
              cursor: "grab",
              touchAction: "none",
              userSelect: "none",
              backgroundColor: "transparent",
              overflow: "hidden",
              borderRadius: 0,
              imageRendering: "pixelated",
            }}
          >
            <TintedCtaButton
              ariaLabel="Scrollbar"
              defaultSrc={scrollbarHover ? scrollbarThumbHover : scrollbarThumb}
              pressedSrc={scrollbarThumbHover}
              tintColor={controlColor}
              width="100%"
              height="100%"
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            />
          </div>
        </div>
      )}
    </>
  )
}
