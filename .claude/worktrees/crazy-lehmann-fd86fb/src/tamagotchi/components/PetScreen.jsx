import React from "react";
import TamagotchiUI from "../ui/TamagotchiUI";
import PrairieBackground from "../backgrounds/PrairieBackground";
import EntityLayer from "../components/EntityLayer";
import SpawnSystem from "../systems/SpawnSystem";
import VisibilitySystem from "../systems/VisibilitySystem";
import CleanupSystem from "../systems/CleanupSystem";
import InteractionSystem from "../systems/InteractionSystem";
import CollisionSystem from "../systems/CollisionSystem";
import CanvasDecorLayer from "../components/CanvasDecorLayer";

export default function PetScreen() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative", // 👈 needed for layering
        overflow: "hidden"
      }}
    >
      {/* 🌍 WORLD BACKGROUND */}
      <PrairieBackground />

      {/* 🌿 DECOR */}
      <CanvasDecorLayer />

      {/* 🌟 ENTITIES */}
      <EntityLayer />

      {/* ⚙️ SYSTEMS */}
      <SpawnSystem />
      <VisibilitySystem />
      <CleanupSystem />
      <InteractionSystem />
      <CollisionSystem />

      {/* 🐣 UI LAYER */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none" // UI handles its own events
        }}
      >
        <TamagotchiUI />
      </div>
    </div>
  );
}
