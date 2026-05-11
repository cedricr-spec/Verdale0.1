import React from "react";
import PetScreen from "./tamagotchi/components/PetScreen";

export default function FullscreenPetScreen() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "black",
        zIndex: 9999
      }}
    >
      <div
        style={{
          width: "min(90vw, 500px)",
          aspectRatio: "1 / 1"
        }}
      >
        <PetScreen />
      </div>
    </div>
  );
}