import React, { useState, useEffect, useRef } from "react"
import PanelItem from "./PanelItem"
import IconButton from "./IconButton"
import CharacterPicker from "./CharacterPicker"
import TintedCtaButton from "./TintedCtaButton"
import { HexColorPicker } from "react-colorful"
import { usePetStore } from "../tamagotchi/store/usePetstore"
import { useCharacterStore } from "../tamagotchi/store/useCharacterStore"

import menuButton from "../hud/CTAs/CTA_Small_8BIT_Menu.webp"
import menuButtonPressed from "../hud/CTAs/CTA_Small_8BIT_Menu_Pressed.webp"
import closeButton from "../hud/CTAs/CTA_Small_8BIT_Close.webp"
import closeButtonPressed from "../hud/CTAs/CTA_Small_8BIT_Close_Pressed.webp"
import mediumCta from "../hud/CTAs/CTA_Medium_8BIT.webp"
import mediumCtaPressed from "../hud/CTAs/CTA_Medium_8BIT_Pressed.webp"

const TOGGLE_BUTTON_SIZE = 52
const PANEL_SCROLL_BOTTOM_SPACE = "5vh" // Tweak bottom scroll space here.
const PANEL_CTA_HEIGHT = "52px"
const COLOR_PICKER_FRAME_STYLE = {
  width: "100%",
  maxWidth: "250px",
  aspectRatio: "1 / 1",
  margin: "0 auto",
  position: "relative",
  zIndex: 1,
  direction: "ltr",
  overflow: "visible",
  touchAction: "none",
  pointerEvents: "auto",
}
const COLOR_PICKER_SECTION_STYLE = {
  marginTop: "10px",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: "12px",
}
const COLOR_PICKER_STYLE = {
  width: "100%",
  height: "100%",
  touchAction: "none",
  pointerEvents: "auto",
}
const PRESET_CHARACTER_MAP = {
  LAVA: "special_1",
  ICE: "winter_1",
  NEON: "character_10",
  NATURE: "spring_1",
  SUNSET: "summer_1",
  SPACE: "dg_knight_1",
  CYBER: "character_21",
  MONO: "basic_character",
}

function PanelActionButton({ label, tintColor, onClick, disabled = false, style }) {
  return (
    <TintedCtaButton
      ariaLabel={label}
      defaultSrc={mediumCta}
      pressedSrc={mediumCtaPressed}
      tintColor={tintColor}
      label={label}
      labelClassName="hud-ui-text hud-ui-text--cta"
      onClick={onClick}
      disabled={disabled}
      width="100%"
      height={PANEL_CTA_HEIGHT}
      style={style}
    />
  )
}

export default function CustomizerPanel({ open, onRandomizeStars, onToggle, mode }) {
  const [active, setActive] = useState(null)
  const [selectedPreset, setSelectedPreset] = useState(null)
  const [isPresetOpen, setIsPresetOpen] = useState(false)
  const panelRef = useRef()
  const toggleButtonRef = useRef()
  const [color, setColor] = useState("#4fd1ff")
  const petColor = usePetStore((s) => s.theme.petColor)
  const modelColor = usePetStore((s) => s.theme.modelColor)
  const setPetColor = usePetStore((s) => s.setPetColor)
  const setModelColor = usePetStore((s) => s.setModelColor)
  const setTheme = usePetStore((s) => s.setTheme)
  const setCharacter = useCharacterStore((s) => s.setCharacter)
  const debugUI = usePetStore((s) => s.debugUI)
  const theme = usePetStore((s) => s.theme)
  const controlColor = theme?.modelColor || "#8f8f8f"
  const [history, setHistory] = useState({
    past: [],
    present: {
      color: "#4fd1ff",
      starsColor: "#ffffff",
      starsSeed: 0,
      petColor: petColor,
      modelColor: modelColor
    },
    future: []
  })
  const [starsTemp, setStarsTemp] = useState("#ffffff")
  const [starsSaved, setStarsSaved] = useState("#ffffff")
  const [modelTemp, setModelTemp] = useState(modelColor)
  const [modelSaved, setModelSaved] = useState(modelColor)

  const isModelDirty = modelTemp !== modelSaved

  const presets = [
    { name: "LAVA", background: "#ff5a1f", starsColor: "#ffb347", petColor: "#ff9a66", modelColor: "#cc2e00" },
    { name: "ICE", background: "#4fd1ff", starsColor: "#e0f7ff", petColor: "#e6fbff", modelColor: "#5cc8ff" },
    { name: "NEON", background: "#7b00ff", starsColor: "#00ffe0", petColor: "#ffd60a", modelColor: "#6a00f4" },
    { name: "NATURE", background: "rgb(75, 41, 25)", starsColor: "#32631f", petColor: "#b7ff9a", modelColor: "#2f7d32" },
    { name: "SUNSET", background: "#ff7e5f", starsColor: "#ffd6a5", petColor: "#ffb199", modelColor: "#ff4d2d" },
    { name: "SPACE", background: "#1a1a40", starsColor: "#ffe35a", petColor: "#9aa4ff", modelColor: "#2b2bd6" },
    { name: "CYBER", background: "#00f5d4", starsColor: "rgb(255, 221, 0)", petColor: "#ff66ff", modelColor: "#00aaff" },
    { name: "MONO", background: "#888888", starsColor: "#ffffff", petColor: "#e6e6e6", modelColor: "#555555" }
  ]

  const isDirty = color !== history.present.color
  const isStarsDirty = starsTemp !== starsSaved

  const pushToHistory = (newPartialState) => {
    setHistory((prev) => {
      const newPresent = {
        ...prev.present,
        ...newPartialState,
        modelColor:
          newPartialState.modelColor !== undefined
            ? newPartialState.modelColor
            : prev.present.modelColor
      }

      return {
        past: [...prev.past, prev.present],
        present: newPresent,
        future: []
      }
    })
  }

  const handleUndo = () => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev
      const previous = prev.past[prev.past.length - 1]
      return {
        past: prev.past.slice(0, -1),
        present: previous,
        future: [prev.present, ...prev.future]
      }
    })
  }

  const handleRedo = () => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev
      const next = prev.future[0]
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: prev.future.slice(1)
      }
    })
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

    return () => {
      document.removeEventListener("pointerdown", handleClickOutside)
    }
  }, [open, onToggle])

  useEffect(() => {
    const nextBackground = history.present.color || "#4fd1ff"
    setColor(nextBackground)
    setTheme((prev) => ({ ...prev, background: nextBackground }))

    if (history.present.starsColor) {
      setStarsTemp(history.present.starsColor)
      setStarsSaved(history.present.starsColor)
      setTheme((prev) => ({ ...prev, starsColor: history.present.starsColor }))

      if (history.present.starsSeed !== undefined && onRandomizeStars) {
        onRandomizeStars(history.present.starsSeed)
      }
    }

    if (history.present.petColor) {
      setPetColor(history.present.petColor)
    }

    if (history.present.modelColor) {
      setModelTemp(history.present.modelColor)
      setModelSaved(history.present.modelColor)
      setModelColor(history.present.modelColor)
    }
  }, [history.present, onRandomizeStars, setModelColor, setPetColor, setTheme])

  useEffect(() => {
    if (mode === "fullscreen" && active === "stickers") {
      setActive(null)
    }
  }, [active, mode])

  const handleTogglePanel = () => {
    if (onToggle) onToggle()
  }

  return (
    <>
      <TintedCtaButton
        ref={toggleButtonRef}
        ariaLabel={open ? "Fermer le panneau" : "Ouvrir le panneau"}
        defaultSrc={open ? closeButton : menuButton}
        pressedSrc={open ? closeButtonPressed : menuButtonPressed}
        tintColor={controlColor}
        onClick={handleTogglePanel}
        width={`${TOGGLE_BUTTON_SIZE}px`}
        height={`${TOGGLE_BUTTON_SIZE}px`}
        style={{
          position: "fixed",
          top: "16px",
          right: "20px",
          zIndex: 1000001,
        }}
      />

      <div
        ref={panelRef}
        className="customizer-panel-scroll hud-ui-text-scope"
        onWheel={(e) => {
          e.stopPropagation()
        }}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          overflowY: "auto",
          direction: "rtl",
          scrollbarWidth: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          backgroundImage: "url('/background_panel.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxSizing: "border-box",
          zIndex: 999999,
          isolation: "isolate",
          pointerEvents: open ? "auto" : "none",
          opacity: open ? 1 : 0,
          visibility: open ? "visible" : "hidden",
          transition: "opacity 0.2s linear, visibility 0.2s linear",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          paddingBottom: PANEL_SCROLL_BOTTOM_SPACE,
          outline: debugUI ? "2px solid red" : "none",
          overscrollBehaviorY: "auto",
          touchAction: "pan-y",
        }}
      >
        <div
          className="panel-header panel-section"
          style={{
            direction: "ltr",
            position: "sticky",
            top: 0,
            zIndex: 20,
            backgroundImage: "url('/background_panel.webp')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "16px 20px 12px 20px"
          }}
        >
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "center"
            }}
          >
            <div style={{ display: "flex", gap: "8px" }}>
              <IconButton
                defaultSrc="/undo.svg"
                clickSrc="/undo_click.svg"
                mode="press"
                onClick={handleUndo}
              />

              <IconButton
                defaultSrc="/redo.svg"
                clickSrc="/redo_click.svg"
                mode="press"
                onClick={handleRedo}
              />
            </div>
          </div>
        </div>

        <div className="panel-section panel-frame" style={{ direction: "ltr" }}>
          <div className="preset-section">
            <div
              className="preset-bar"
              onClick={() => setIsPresetOpen(!isPresetOpen)}
              style={{
                position: "relative",
                width: "100%",
                height: "64px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer"
              }}
            >
              <img
                src="/preset_bar.svg"
                style={{
                  position: "absolute",
                  display: "flex",
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  top: 0,
                  left: 0,
                  pointerEvents: "none"
                }}
              />

              <div
                className="hud-ui-text"
                style={{
                  position: "relative",
                  fontSize: "18px",
                  paddingLeft: "20px",
                  paddingRight: "40px",
                  zIndex: 2,
                  flex: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }}
              >
                {selectedPreset || "Aucun preset sélectionné"}
              </div>

              <img
                src="/dropdown_chevron.svg"
                style={{
                  position: "relative",
                  width: "20px",
                  marginRight: "20px",
                  zIndex: 2,
                  transform: `${isPresetOpen ? "scaleY(-1)" : "scaleY(1)"} scaleX(-1)`
                }}
              />
            </div>

            {isPresetOpen && (
              <div className="preset-popin">
                <div className="preset-popin-content">
                  {presets.map((p) => (
                    <div
                      key={p.name}
                      className={selectedPreset === p.name ? "active" : ""}
                      onClick={() => {
                        setSelectedPreset(p.name)
                        setIsPresetOpen(false)

                        setTheme((prev) => ({
                          ...prev,
                          background: p.background,
                          starsColor: p.starsColor,
                          petColor: p.petColor,
                          modelColor: p.modelColor
                        }))

                        if (p.petColor) {
                          setPetColor(p.petColor)
                          setModelColor(p.modelColor)

                          if (window.setPetColor) {
                            window.setPetColor(p.petColor)
                          }
                        }

                        const presetCharacterId = PRESET_CHARACTER_MAP[p.name]
                        if (presetCharacterId) {
                          setCharacter(presetCharacterId)
                        }

                        const newSeed = Date.now()
                        if (onRandomizeStars) onRandomizeStars(newSeed)

                        pushToHistory({
                          color: p.background,
                          starsColor: p.starsColor,
                          starsSeed: newSeed,
                          petColor: p.petColor,
                          modelColor: p.modelColor
                        })
                      }}
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="panel-section panel-frame" style={{ direction: "ltr" }}>
          <CharacterPicker />
        </div>

        <div className="panel-buttons" style={{ direction: "ltr" }}>
          <PanelItem
            label="ARRIÈRE PLAN"
            selected={active === "background"}
            onClick={() => setActive(active === "background" ? null : "background")}
          />

          <PanelItem
            label="ÉTOILES"
            selected={active === "stars"}
            onClick={() => setActive(active === "stars" ? null : "stars")}
          />

          {mode !== "fullscreen" && (
            <PanelItem
              label="STICKERS"
              selected={active === "stickers"}
              onClick={() => setActive(active === "stickers" ? null : "stickers")}
            />
          )}

          <PanelItem
            label="COULEUR"
            selected={active === "color"}
            onClick={() => setActive(active === "color" ? null : "color")}
          />
        </div>

        <div
          className={active === "stickers" ? "panel-section-full-width" : "panel-section"}
          style={{ direction: "ltr" }}
        >
          {active === "background" && (
            <div style={COLOR_PICKER_SECTION_STYLE}>
              <div style={COLOR_PICKER_FRAME_STYLE}>
                <HexColorPicker
                  style={COLOR_PICKER_STYLE}
                  color={color}
                  onChange={(newColor) => {
                    setColor(newColor)
                    setTheme((prev) => ({ ...prev, background: newColor }))
                  }}
                />
              </div>

              <div style={{ color: "white", fontSize: "14px", pointerEvents: "none" }}>
                {color}
              </div>

              <PanelActionButton
                label="ENREGISTRER"
                tintColor={controlColor}
                disabled={!isDirty}
                onClick={() => {
                  if (!isDirty) return
                  pushToHistory({ color })
                }}
                style={{ marginTop: "16px" }}
              />
            </div>
          )}

          {active === "stars" && (
            <div style={COLOR_PICKER_SECTION_STYLE}>
              <div style={COLOR_PICKER_FRAME_STYLE}>
                <HexColorPicker
                  style={COLOR_PICKER_STYLE}
                  color={starsTemp}
                  onChange={(c) => {
                    setStarsTemp(c)
                    setTheme((prev) => ({ ...prev, starsColor: c }))
                  }}
                />
              </div>

              <PanelActionButton
                label="ENREGISTRER"
                tintColor={controlColor}
                disabled={!isStarsDirty}
                onClick={() => {
                  if (!isStarsDirty) return
                  setStarsSaved(starsTemp)
                  setTheme((prev) => ({ ...prev, starsColor: starsTemp }))
                  pushToHistory({ starsColor: starsTemp })
                }}
                style={{ marginTop: "4px" }}
              />

              <PanelActionButton
                label="RANDOMISER"
                tintColor={controlColor}
                onClick={() => {
                  const newSeed = Date.now()
                  if (onRandomizeStars) onRandomizeStars(newSeed)
                  pushToHistory({ starsSeed: newSeed })
                }}
                style={{ marginTop: "4px" }}
              />
            </div>
          )}

          {active === "color" && (
            <div style={COLOR_PICKER_SECTION_STYLE}>
              <div style={COLOR_PICKER_FRAME_STYLE}>
                <HexColorPicker
                  style={COLOR_PICKER_STYLE}
                  color={modelTemp}
                  onChange={(c) => {
                    setModelTemp(c)
                  }}
                />
              </div>

              <div style={{ color: "white", fontSize: "14px", pointerEvents: "none" }}>
                {modelTemp}
              </div>

              <PanelActionButton
                label="ENREGISTRER"
                tintColor={controlColor}
                disabled={!isModelDirty}
                onClick={() => {
                  if (!isModelDirty) return
                  setModelSaved(modelTemp)
                  setModelColor(modelTemp)
                  pushToHistory({ modelColor: modelTemp })
                }}
                style={{ marginTop: "4px" }}
              />
            </div>
          )}

          {active === "stickers" && (
            <div className="panel-section-full-width" style={{ width: "100%", color: "white" }}>
              <div
                className="panel-section-full-width panel-frame"
                style={{ padding: "12px 24px", width: "100%", boxSizing: "border-box" }}
              >
                <div>Sticker 1</div>
                <PanelActionButton
                  label="IMPORTER IMAGE"
                  tintColor={controlColor}
                  onClick={() => {
                    const el = document.getElementById("upload-sticker-1")
                    if (el) el.click()
                  }}
                  style={{ marginBottom: "12px" }}
                />

                <input
                  id="upload-sticker-1"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files[0]
                    if (file && window.uploadSticker1) {
                      window.uploadSticker1(file)
                    }
                  }}
                />

                <div style={{ marginBottom: "6px" }}>Rotation</div>
                <input
                  type="range"
                  min="0"
                  max={Math.PI * 2}
                  step="0.01"
                  onChange={(e) => {
                    if (window.setSticker1Rotation) {
                      window.setSticker1Rotation(parseFloat(e.target.value))
                    }
                  }}
                  style={{ width: "100%", marginBottom: "16px" }}
                />
              </div>

              <div
                className="panel-section-full-width panel-frame"
                style={{
                  padding: "12px 24px",
                  marginTop: "12px",
                  width: "100%",
                  boxSizing: "border-box"
                }}
              >
                <div style={{ marginBottom: "10px" }}>Sticker 2</div>
                <PanelActionButton
                  label="IMPORTER IMAGE"
                  tintColor={controlColor}
                  onClick={() => {
                    const el = document.getElementById("upload-sticker-2")
                    if (el) el.click()
                  }}
                  style={{ marginBottom: "12px" }}
                />

                <input
                  id="upload-sticker-2"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files[0]
                    if (file && window.uploadSticker2) {
                      window.uploadSticker2(file)
                    }
                  }}
                />

                <div style={{ marginBottom: "6px" }}>Rotation</div>
                <input
                  type="range"
                  min="0"
                  max={Math.PI * 2}
                  step="0.01"
                  onChange={(e) => {
                    if (window.setSticker2Rotation) {
                      window.setSticker2Rotation(parseFloat(e.target.value))
                    }
                  }}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
          )}
        </div>

        {debugUI && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 999,
              border: "2px solid red"
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "80px",
                background: "rgba(0,255,0,0.2)"
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "80px",
                left: 0,
                width: "100%",
                height: "200px",
                background: "rgba(0,0,255,0.2)"
              }}
            />
          </div>
        )}
      </div>
    </>
  )
}
