import React from "react"
import { getItemDefinition } from "../config/itemsRegistry"
import {
  getQuestRewards,
  QUEST_OBJECTIVE_TYPES,
  QUEST_REWARD_TYPES,
} from "../config/questConfig"
import { getActiveQuestSummary, useQuestStore } from "../store/useQuestStore"
import questTrackerBackground from "../../hud/Quests/S_Quest_Background.webp"
import { getItemAtlasInfo } from "../utils/farmingAtlasData"

function getItemLabel(itemId) {
  return getItemDefinition(itemId)?.name || itemId || "Unknown Item"
}

function formatObjectiveLabel(objective) {
  const itemLabel = getItemLabel(objective.itemId)

  if (objective.type === QUEST_OBJECTIVE_TYPES.COLLECT_ITEM) {
    return `Collect ${itemLabel}`
  }

  if (objective.type === QUEST_OBJECTIVE_TYPES.CRAFT_ITEM) {
    return `Craft ${itemLabel}`
  }

  if (objective.type === QUEST_OBJECTIVE_TYPES.DISCARD_ITEM) {
    return `Discard ${itemLabel}`
  }

  return itemLabel
}

const ACTIVE_QUEST_TRACKER_MOBILE_MEDIA_QUERY = "(max-width: 768px)"

function useIsMobileQuestTrackerHidden() {
  const [hidden, setHidden] = React.useState(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia(ACTIVE_QUEST_TRACKER_MOBILE_MEDIA_QUERY).matches
  })

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined

    const mediaQuery = window.matchMedia(ACTIVE_QUEST_TRACKER_MOBILE_MEDIA_QUERY)
    const updateHidden = () => setHidden(mediaQuery.matches)

    updateHidden()
    mediaQuery.addEventListener?.("change", updateHidden)

    return () => {
      mediaQuery.removeEventListener?.("change", updateHidden)
    }
  }, [])

  return hidden
}

function ItemIcon({ itemId, size = 34 }) {
  const item = getItemDefinition(itemId)
  const farmingAtlasInfo = getItemAtlasInfo(itemId)
  const rect = farmingAtlasInfo?.atlasRect || item?.atlasRect
  const atlasSource = farmingAtlasInfo?.atlasSource || item?.atlasSource

  if (atlasSource && rect) {
    const scale = size / Math.max(1, rect.width || 16)

    return (
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          position: "relative",
          overflow: "hidden",
          flex: "0 0 auto",
          imageRendering: "pixelated",
        }}
      >
        <img
          src={atlasSource}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: `${-(rect.x || 0) * scale}px`,
            top: `${-(rect.y || 0) * scale}px`,
            width: "auto",
            height: "auto",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
        />
      </div>
    )
  }

  if (item?.spritePath) {
    return (
      <img
        src={item.spritePath}
        alt=""
        draggable={false}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          objectFit: "contain",
          imageRendering: "pixelated",
          flex: "0 0 auto",
          pointerEvents: "none",
        }}
      />
    )
  }

  return (
    <span
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        fontSize: `${Math.round(size * 0.68)}px`,
        lineHeight: 1,
      }}
    >
      {item?.icon || "?"}
    </span>
  )
}

function formatRewardLabel(reward) {
  if (!reward) return "Reward"

  if (reward.type === QUEST_REWARD_TYPES.ITEM) {
    const item = getItemDefinition(reward.value)
    return `${reward.amount || 1}× ${item?.name || reward.value}`
  }

  if (reward.type === QUEST_REWARD_TYPES.UNLOCK_CHARACTER) {
    return "Character unlock"
  }

  if (reward.type === QUEST_REWARD_TYPES.UNLOCK_RECIPE) {
    return "Recipe unlock"
  }

  if (reward.type === QUEST_REWARD_TYPES.INVENTORY_CAPACITY) {
    return `Inventory +${reward.amount || reward.value || 1}`
  }

  return reward.value ? String(reward.value) : "Reward"
}

function getRewardIconItemId(reward) {
  if (
    reward?.type === QUEST_REWARD_TYPES.ITEM ||
    reward?.type === QUEST_REWARD_TYPES.INVENTORY_CAPACITY
  ) {
    return reward.value || null
  }

  return null
}

const QUEST_TRACKER_ASPECT_RATIO = 740 / 390

export default function ActiveQuestTracker() {
  const [isHovered, setIsHovered] = React.useState(false)
  const hideOnMobile = useIsMobileQuestTrackerHidden()
  const activeQuestId = useQuestStore((state) => state.activeQuestId)
  const unlockedQuestIds = useQuestStore((state) => state.unlockedQuestIds)
  const completedQuestIds = useQuestStore((state) => state.completedQuestIds)
  const claimedQuestIds = useQuestStore((state) => state.claimedQuestIds)
  const rewardClaimedQuestIds = useQuestStore((state) => state.rewardClaimedQuestIds)
  const objectiveProgress = useQuestStore((state) => state.objectiveProgress)

  const activeQuest = React.useMemo(
    () =>
      getActiveQuestSummary({
        activeQuestId,
        unlockedQuestIds,
        completedQuestIds,
        claimedQuestIds,
        rewardClaimedQuestIds,
        objectiveProgress,
      }),
    [
      activeQuestId,
      claimedQuestIds,
      completedQuestIds,
      objectiveProgress,
      rewardClaimedQuestIds,
      unlockedQuestIds,
    ]
  )

  const primaryItemId = activeQuest?.objectives?.find((objective) => objective.itemId)?.itemId || null
  const rewards = activeQuest ? getQuestRewards(activeQuest.id) : []
  const primaryReward = rewards[0] || null
  const primaryRewardItemId = getRewardIconItemId(primaryReward)
  const isReadyToClaim = activeQuest?.status === "completed"

  if (!activeQuest || hideOnMobile) return null 

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        window.dispatchEvent(new CustomEvent("open-quest-panel"))
      }}
      style={{
        position: "fixed",
        top: "76px",
        right: "20px",
        width: "280px",
        aspectRatio: `${QUEST_TRACKER_ASPECT_RATIO}`,
        padding: "0",
        backgroundImage: `url(${questTrackerBackground})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% 100%",
        color: "#2b1a12",
        zIndex: 10001,
        pointerEvents: "auto",
        cursor: "pointer",
        opacity: isHovered ? 1 : 0.4,
        transform: isHovered ? "scale(1.03)" : "scale(1)",
        transition: "opacity 0.2s ease, transform 0.15s ease",
        filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.28))",
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      <style>
        {`
          @keyframes activeQuestTrackerShine {
            0% {
              transform: translate(260px, 145px) rotate(45deg);
              opacity: 0;
            }
            12% {
              opacity: 0.9;
            }
            55% {
              opacity: 0.78;
            }
            78% {
              transform: translate(-260px, -145px) rotate(45deg);
              opacity: 0;
            }
            100% {
              transform: translate(-260px, -145px) rotate(45deg);
              opacity: 0;
            }
          }
        `}
      </style>
      {isReadyToClaim && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 3,
            WebkitMaskImage: `url(${questTrackerBackground})`,
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: "100% 100%",
            WebkitMaskPosition: "center",
            maskImage: `url(${questTrackerBackground})`,
            maskRepeat: "no-repeat",
            maskSize: "100% 100%",
            maskPosition: "center",
          }}
        >
         <>
           <div
             style={{
               position: "absolute",
               width: "56px",
               height: "500px",
               left: "calc(50% - 20px)",
               top: "calc(50% - 190px)",
               background: "#ffffff15",
               mixBlendMode: "color-dodge",
               blur: "6px",
               animation: "activeQuestTrackerShine 3s ease-out infinite",
               willChange: "transform, opacity",
             }}
           />

           <div
             style={{
               position: "absolute",
               width: "24px",
               height: "500px",
               left: "calc(50% - 12px)",
               top: "calc(50% - 130px)",
               background: "#ffffff15",
               mixBlendMode: "color-dodge",
               blur: "4px",
               animation: "activeQuestTrackerShine 3s ease-out infinite",
               animationDelay: "0.1s",
               willChange: "transform, opacity",
             }}
           />
         </>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          zIndex: 2,
          inset: "30px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minWidth: 0,
        }}
      >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "24px 1fr",
          gap: "8px",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "24px",
            height: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {primaryItemId ? <ItemIcon itemId={primaryItemId} size={20} /> : null}
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            className="hud-ui-text"
            style={{
              fontSize: "8px",
              lineHeight: 1,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              opacity: 0.72,
              marginBottom: "4px",
            }}
          >
            Active Quest
          </div>
          <div
            className="hud-ui-text"
            style={{
              fontSize: "12px",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {activeQuest.title}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {activeQuest.objectives.map((objective, objectiveIndex) => (
          <div
            key={`${activeQuest.id}:tracker:${objectiveIndex}`}
            className="hud-ui-text"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: "8px",
              alignItems: "center",
              fontSize: "9px",
              lineHeight: 1.1,
              opacity: 0.86,
            }}
          >
            <span
              style={{
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {formatObjectiveLabel(objective)}
            </span>
            <span>{`${objective.current}/${objective.target}`}</span>
          </div>
        ))}
      </div>

      <div
        className="hud-ui-text"
        style={{
          marginTop: "8px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "9px",
          lineHeight: 1,
          opacity: 0.9,
        }}
      >
        <span style={{ opacity: 0.7 }}>Reward</span>
        {primaryRewardItemId ? <ItemIcon itemId={primaryRewardItemId} size={14} /> : null}
        <span
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {formatRewardLabel(primaryReward)}
        </span>
      </div>
      </div>
    </div>
  )
}
