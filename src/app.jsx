import * as React from "react";
import { useState, useEffect } from "react"; // 👈 AJOUT
import { Canvas } from "@react-three/fiber";
import Scene from "./scene.jsx";
const CustomizerPanel = React.lazy(() => import("./components/CustomizerPanel"));
const CharacterMenu = React.lazy(() => import("./components/CharacterMenu"));
const InventoryPanel = React.lazy(() => import("./tamagotchi/components/InventoryPanel"));
const QuestPanel = React.lazy(() => import("./tamagotchi/components/QuestPanel"));
import PetScreen from "./tamagotchi/components/PetScreen";
import { usePetStore } from "./tamagotchi/store/usePetStore";
import JaugesPanel from "./tamagotchi/components/JaugesPanel";
import GaugeV2 from "./tamagotchi/components/GaugeV2";
import LineMenu from "./tamagotchi/components/Line_Menu";
import PetControls from "./tamagotchi/components/PetControls";
import ActiveQuestTracker from "./tamagotchi/components/ActiveQuestTracker";
import InventoryNoticeToast from "./tamagotchi/components/InventoryNoticeToast";
import SeedBagDebugOverlay from "./tamagotchi/components/SeedBagDebugOverlay";
import WorldInteractionSystem from "./tamagotchi/systems/WorldInteractionSystem";
import WorldInteractionToast from "./tamagotchi/components/WorldInteractionToast";
import { useWorldStore } from "./tamagotchi/store/worldSlice";
import {
  DEV_START_FULLSCREEN_UI,
  DEV_START_WORLD_DEBUG,
} from "./tamagotchi/config/worldStreamingConfig";
import {
  DEFAULT_WORLD_DEBUG_FLAGS,
  useWorldDebugStore,
} from "./tamagotchi/store/worldDebugStore";
import TintedCtaButton from "./components/TintedCtaButton";
import mediumCta from "./hud/CTAs/CTA_Medium_8BIT.webp";
import mediumCtaPressed from "./hud/CTAs/CTA_Medium_8BIT_Pressed.webp";

export default function App() {
  const [open, setOpen] = useState(false)
  const [characterMenuOpen, setCharacterMenuOpen] = useState(false)
  const [starsColor, setStarsColor] = useState("#ffffff")
  const [starsSeed, setStarsSeed] = useState(0)
  const [mode, setMode] = useState(
    DEV_START_FULLSCREEN_UI ? "fullscreen" : "device"
  ); // "device" | "fullscreen"
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [questOpen, setQuestOpen] = useState(false)

  function lightenColor(hex, amount = 0.3) {
    if (!hex) return "#ffffff";
    const c = hex.replace("#", "");
    const num = parseInt(c, 16);
    let r = (num >> 16) + Math.round(255 * amount);
    let g = ((num >> 8) & 0x00ff) + Math.round(255 * amount);
    let b = (num & 0x0000ff) + Math.round(255 * amount);

    r = Math.min(255, r);
    g = Math.min(255, g);
    b = Math.min(255, b);

    return `rgb(${r}, ${g}, ${b})`;
  }

  const uiColor = lightenColor(starsColor, 0.25);

  const debugUI = usePetStore((s) => s.debugUI);
  const getColor = usePetStore((s) => s.getDebugColor);
  const modelColor = usePetStore((s) => s.theme.modelColor);

  useEffect(() => {
    usePetStore.getState().startGame();

    if (DEV_START_WORLD_DEBUG) {
      useWorldDebugStore.getState().setFlags({
        ...DEFAULT_WORLD_DEBUG_FLAGS,
        showWorldDebugOverlay: true,
        showWorldDecorDebug: true,
        showWorldDecorBoundsDebug: true,
        showWorldItemBoundsDebug: true,
        showWorldCollisionBoundsDebug: true,
        showWorldDecorLabelsDebug: false,
        showWorldSpawnRadiusDebug: true,
        showViewportCullingDebug: true,
        showSpawnDespawnBufferDebug: true,
        showWorldDecorTweakPanel: true,
        showWaterCollisionDebug: true,
      });
    }

    // 🔥 fix layout shift / vertical offset
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    document.documentElement.style.height = "100%";
    document.body.style.height = "100%";

    return () => {
      usePetStore.getState().stopGame();
    };
  }, []);

  useEffect(() => {
    document.body.dataset.uiMode = mode;
    document.documentElement.dataset.uiMode = mode;

    return () => {
      delete document.body.dataset.uiMode;
      delete document.documentElement.dataset.uiMode;
    };
  }, [mode]);

  useEffect(() => {
    const handleOpenQuestPanel = () => {
      setInventoryOpen(false);
      setQuestOpen(true);
    };

    window.addEventListener("open-quest-panel", handleOpenQuestPanel);

    return () => {
      window.removeEventListener("open-quest-panel", handleOpenQuestPanel);
    };
  }, []);

  useEffect(() => {
    useWorldStore.getState().setUiModalState({
      inventory: inventoryOpen,
      quests: questOpen,
      customizer: open,
      characterMenu: characterMenuOpen,
    });
  }, [characterMenuOpen, inventoryOpen, open, questOpen]);

  useEffect(() => {
    return () => {
      useWorldStore.getState().setUiModalState({
        inventory: false,
        quests: false,
        customizer: false,
        characterMenu: false,
      });
    };
  }, []);

  return (
  <div
    style={{
      position: "relative",
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      background: mode === "fullscreen" ? "#000000" : "transparent",
    }}
  >
    {debugUI && (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: getColor("layout"),
          pointerEvents: "none",
          zIndex: 0
        }}
      />
    )}
    {/* 3D LAYER */}
    {!debugUI && (
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{
          background: "transparent",
          zIndex: 0,
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh"
        }}
      >
        <Scene starsColor={starsColor} starsSeed={starsSeed} mode={mode} />
      </Canvas>
    )}
    

    {/* UI LAYER */}
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: mode === "fullscreen" ? "auto" : "none", // 🔥 block mouse in fullscreen
        zIndex: 10
      }}
    >
      {debugUI && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: getColor("content"),
            pointerEvents: "none",
            zIndex: 0
          }}
        />
      )}
      {/* STAT GAUGES — top-left, always visible in both modes */}
      <div
        style={{
          position: "fixed",
          top: "16px",
          left: "16px",
          zIndex: 10000,
          pointerEvents: "none",
          maxWidth: "calc(100vw - 32px)",
        }}
      >
        <JaugesPanel />
      </div>

      {/* SWITCH UI — bottom-left (deleted -> is now in CustomizerPanel pour un ptit gain de place en mobile*/}

      <ActiveQuestTracker />
      <SeedBagDebugOverlay />

      {mode === "fullscreen" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 5,
            pointerEvents: "auto",
            overflow: "hidden",
          }}
        >
          <PetScreen />
        </div>
      )}


      <div
        style={{
          position: "fixed",
          bottom: "40px",
          transform: "translateX(-50%)",
          zIndex: 100
        }}
      >
      </div>

      {/* LINE MENU */}
      <div
        data-inventory-toggle
        style={{
          position: "fixed",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          left: "12px",
          right: "12px",
          zIndex: 200,
          pointerEvents: "auto"
        }}
      >
        {debugUI && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: getColor("text"),
            pointerEvents: "none",
            zIndex: 0
          }} />
        )}
        <LineMenu
          onInventoryToggle={(event) => {
            event?.stopPropagation?.()
            setInventoryOpen((prev) => {
              const next = !prev
              if (next) {
                setQuestOpen(false)
              }
              return next
            })
          }}
          inventoryOpen={inventoryOpen}
          onQuestToggle={() => {
            setQuestOpen((prev) => {
              const next = !prev
              if (next) {
                setInventoryOpen(false)
              }
              return next
            })
          }}
          questOpen={questOpen}
          centerContent={<PetControls embedded />}
        />
      </div>
      <div style={{ position: "relative", pointerEvents: "auto" }}>
        {debugUI && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: getColor("content"),
            pointerEvents: "none",
            zIndex: 0
          }} />
        )}
      <React.Suspense fallback={null}>
        <InventoryPanel
          open={inventoryOpen}
          onClose={() => setInventoryOpen(false)}
        />
        <QuestPanel
          open={questOpen}
          onClose={() => setQuestOpen(false)}
        />
      </React.Suspense>
      <WorldInteractionSystem />
      <InventoryNoticeToast />
      <WorldInteractionToast />
      <React.Suspense fallback={null}>
        <CustomizerPanel
          open={open}
          onRandomizeStars={(seed) => setStarsSeed(seed)}
          onToggle={() => setOpen((prev) => !prev)}
          mode={mode}
          onSwitchMode={() => setMode(mode === "device" ? "fullscreen" : "device")}
        />
        <CharacterMenu
          open={characterMenuOpen}
          onToggle={() => setCharacterMenuOpen((prev) => !prev)}
        />
      </React.Suspense>
      </div>
    </div>
  </div>
);
}
