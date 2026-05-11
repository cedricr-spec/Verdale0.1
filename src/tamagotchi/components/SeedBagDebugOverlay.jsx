import React from "react"
import FARMING_ATLAS from "../../spritesheets/farming/farming_atlas_complete.json"
import cropObjectsPng from "../../spritesheets/farming/Crops Objects.png"

const DEV_SHOW_FARM_DEBUG = false

const DEBUG_DEAD_CROPS = [
  { cropId: "carrot", x: 20, y: 120 },
  { cropId: "turnip", x: 60, y: 120 },
  { cropId: "potato", x: 100, y: 120 },
  { cropId: "tomato", x: 140, y: 120 },
]

const DEBUG_SCALE = 4

export default function SeedBagDebugOverlay() {
  if (!import.meta.env.DEV || !DEV_SHOW_FARM_DEBUG) return null

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10020,
        pointerEvents: "none",
      }}
    >
      {/* TODO DEBUG REMOVE SEEDBAG TEST OVERLAY */}
      {DEBUG_DEAD_CROPS.map(({ cropId, x, y }) => {
        const rect = FARMING_ATLAS.crops[cropId]?.dead
        if (!rect) return null

        return (
          <div
            key={cropId}
            style={{
              position: "absolute",
              left: `${x}px`,
              top: `${y}px`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                backgroundImage: `url(${cropObjectsPng})`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: `-${rect.x}px -${rect.y}px`,
                backgroundSize: "auto",
                imageRendering: "pixelated",
                transform: `scale(${DEBUG_SCALE})`,
                transformOrigin: "top left",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.18)",
              }}
            />

            <div
              style={{
                marginTop: `${rect.height * (DEBUG_SCALE - 1)}px`,
                padding: "4px 6px",
                background: "rgba(0, 0, 0, 0.72)",
                borderRadius: "6px",
                color: "#ffffff",
                fontSize: "10px",
                lineHeight: 1.25,
                textAlign: "center",
                whiteSpace: "pre-line",
                textTransform: "lowercase",
              }}
            >
              {`${cropId}\ndead ${rect.x},${rect.y}`}
            </div>
          </div>
        )
      })}
    </div>
  )
}
