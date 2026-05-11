import React, { useMemo } from "react"
import PetSprite from "../components/PetSprite"
import { resolvePetAnimationState } from "../lib/petAnimationResolver"
import { useCharacterStore } from "../store/useCharacterStore"
import { usePetStore } from "../store/usePetstore"

export default function TamagotchiUI() {
  const debugUI = usePetStore((state) => state.debugUI)
  const activeCharacterId = useCharacterStore((state) => state.activeCharacterId)
  const persistentState = useCharacterStore((state) => state.persistentState)
  const transientState = useCharacterStore((state) => state.transientState)
  const movementActive = useCharacterStore((state) => state.movementActive)

  const resolvedAnimationState = useMemo(
    () =>
      resolvePetAnimationState({
        persistentState,
        transientState,
        movementActive,
      }),
    [movementActive, persistentState, transientState]
  )

  return (
    <div
      id="tamagotchi-ui"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 2,
        width: "100%",
        height: "100%",
        borderRadius: "16px",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <PetSprite />

      {debugUI && (
        <div
          style={{
            position: "absolute",
            left: "8px",
            bottom: "8px",
            padding: "6px 8px",
            fontSize: "10px",
            lineHeight: 1.4,
            color: "#fff",
            background: "rgba(0,0,0,0.45)",
            borderRadius: "8px",
            pointerEvents: "none",
          }}
        >
          {activeCharacterId} / {resolvedAnimationState}
        </div>
      )}
    </div>
  )
}
