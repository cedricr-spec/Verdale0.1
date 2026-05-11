import React, { useMemo } from "react"
import commonBg from "../../hud/Quests/M_COMMON_Quest_Background.webp"
import goldBg from "../../hud/Quests/M_GOLD_Quest_Background.webp"
import emeraldBg from "../../hud/Quests/M_EMERALD_Quest_Background.webp"
import diamondBg from "../../hud/Quests/M_DIAMOND_Quest_Background.webp"
import starShine1 from "../../spritesheets/fx/shines/Star1.png"
import starShine2 from "../../spritesheets/fx/shines/Star2.png"
import bagIcon from "../../spritesheets/items_spritesheet/bagicon.png"
import { getItemDefinition } from "../config/itemsRegistry"
import { QUEST_OBJECTIVE_TYPES, QUEST_REWARD_TYPES } from "../config/questConfig"
import { getQuestPresentation } from "../config/questPresentation"
import { getItemAtlasInfo } from "../utils/farmingAtlasData"

export const QUEST_CARD_BASE_WIDTH = 740
export const QUEST_CARD_BASE_HEIGHT = 1210
export const QUEST_CARD_BASE_PADDING_X = 75
export const QUEST_CARD_BASE_PADDING_Y = 135
export const QUEST_CARD_SCALE = 0.36
export const QUEST_CARD_ACTIVE_SCALE = 0.46
const QUEST_CARD_READY_STAR_FX = [
  { x: 18, y: 16, size: 60, delay: 0.05, duration: 1.75, src: starShine1 },
  { x: 76, y: 12, size: 44, delay: 0.42, duration: 1.55, src: starShine2 },
  { x: 62, y: 28, size: 56, delay: 0.86, duration: 1.8, src: starShine1 },
  { x: 32, y: 42, size: 40, delay: 1.12, duration: 1.45, src: starShine2 },
  { x: 84, y: 46, size: 52, delay: 1.54, duration: 1.7, src: starShine1 },
  { x: 14, y: 66, size: 48, delay: 1.96, duration: 1.6, src: starShine2 },
  { x: 68, y: 72, size: 64, delay: 2.28, duration: 1.9, src: starShine1 },
  { x: 43, y: 86, size: 44, delay: 2.74, duration: 1.5, src: starShine2 },
  { x: 88, y: 82, size: 36, delay: 3.1, duration: 1.55, src: starShine2 },
  { x: 22, y: 88, size: 52, delay: 3.42, duration: 1.8, src: starShine1 },
]
function roundMetric(value) {
  return Math.round(value * 100) / 100
}

export function getQuestCardMetrics(scale) {
  return {
    scale,
    width: roundMetric(QUEST_CARD_BASE_WIDTH * scale),
    height: roundMetric(QUEST_CARD_BASE_HEIGHT * scale),
    paddingX: roundMetric(QUEST_CARD_BASE_PADDING_X * scale),
    paddingY: roundMetric(QUEST_CARD_BASE_PADDING_Y * scale),
    sectionGap: roundMetric(32 * scale),
    framePaddingX: roundMetric(30 * scale),
    framePaddingY: roundMetric(28 * scale),
    iconTile: roundMetric(132 * scale),
    iconSize: roundMetric(70 * scale),
    titleSize: roundMetric(42 * scale),
    bodySize: roundMetric(34 * scale),
    metaSize: roundMetric(24 * scale),
    frameBorderWidth: Math.max(1, roundMetric(2 * scale)),
  }
}

function getItemLabel(itemId) {
  return getItemDefinition(itemId)?.name || itemId || "Unknown item"
}

function getPrimaryObjective(quest) {
  return quest?.objectives?.[0] || null
}

function getPrimaryReward(quest) {
  return quest?.rewards?.[0] || null
}

function getRewardIconItemId(reward, fallbackItemId = null) {
  if (reward?.type === QUEST_REWARD_TYPES.INVENTORY_CAPACITY) {
    return "__inventory_slots_reward__"
  }

  if (reward?.type === QUEST_REWARD_TYPES.ITEM) {
    return reward.value || fallbackItemId
  }

  return fallbackItemId
}

function getItemIconData(itemId, fallbackLabel = "Quest") {
  if (itemId === "__inventory_slots_reward__") {
    return {
      itemId,
      label: "Inventory Slots",
      atlasSource: null,
      atlasRect: null,
      spritePath: bagIcon,
      emoji: "",
    }
  }
  const itemDefinition = itemId ? getItemDefinition(itemId) : null
  const farmingAtlasInfo = getItemAtlasInfo(itemId)
  const atlasRect =
    farmingAtlasInfo?.atlasRect ||
    itemDefinition?.atlasRect ||
    itemDefinition?.atlas?.rect ||
    itemDefinition?.spriteRect ||
    null
  const atlasSource =
    farmingAtlasInfo?.atlasSource ||
    itemDefinition?.atlasSource ||
    itemDefinition?.atlas?.source ||
    itemDefinition?.spritesheet ||
    itemDefinition?.spriteSheet ||
    null
  const spritePath =
    itemDefinition?.spritePath ||
    itemDefinition?.sprite ||
    itemDefinition?.iconPath ||
    null

  return {
    itemId,
    label: itemDefinition?.name || itemId || fallbackLabel,
    atlasSource,
    atlasRect,
    spritePath,
    emoji:
      itemDefinition?.emoji ||
      itemDefinition?.icon ||
      itemDefinition?.iconGlyph ||
      itemDefinition?.glyph ||
      "✦",
  }
}

function getQuestIconData(quest) {
  const objective = getPrimaryObjective(quest)
  const reward = getPrimaryReward(quest)
  const itemId = objective?.itemId || reward?.value || null
  return getItemIconData(itemId, "Quest")
}

function QuestItemIcon({ iconData, metrics }) {
  const displaySize = Math.round(metrics.iconSize * 1.65)
  const atlasRect = iconData?.atlasRect
  const atlasSource = iconData?.atlasSource

  if (atlasSource && atlasRect) {
    const rectX = Number(atlasRect.x ?? atlasRect.left ?? 0)
    const rectY = Number(atlasRect.y ?? atlasRect.top ?? 0)
    const rectWidth = Number(atlasRect.width ?? atlasRect.w ?? 0)
    const rectHeight = Number(atlasRect.height ?? atlasRect.h ?? 0)
    const safeRectWidth = Number.isFinite(rectWidth) && rectWidth > 0 ? rectWidth : 16
    const safeRectHeight = Number.isFinite(rectHeight) && rectHeight > 0 ? rectHeight : 16
    const scale = displaySize / Math.max(safeRectWidth, safeRectHeight)

    return (
      <div
        aria-hidden="true"
        title={iconData.label}
        style={{
          width: displaySize,
          height: displaySize,
          overflow: "hidden",
          position: "relative",
          display: "inline-block",
          imageRendering: "pixelated",
          flexShrink: 0,
          pointerEvents: "none",
        }}
      >
        <img
          src={atlasSource}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: `${-rectX * scale}px`,
            top: `${-rectY * scale}px`,
            width: "auto",
            height: "auto",
            imageRendering: "pixelated",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            pointerEvents: "none",
          }}
        />
      </div>
    )
  }

  if (iconData?.spritePath) {
    return (
      <img
        src={iconData.spritePath}
        alt=""
        aria-hidden="true"
        title={iconData.label}
        style={{
          width: `${displaySize}px`,
          height: `${displaySize}px`,
          objectFit: "contain",
          imageRendering: "pixelated",
          display: "block",
        }}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      title={iconData.label}
      style={{
        fontSize: `${displaySize}px`,
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {iconData?.emoji || "✦"}
    </span>
  )
}

function ItemInfoBlock({ metrics, label, primary, secondary, iconData }) {
  const iconBoxSize = Math.round(118 * metrics.scale)
  const iconScaleMetrics = {
    ...metrics,
    iconSize: Math.round(48 * metrics.scale),
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        gridTemplateColumns: `${iconBoxSize}px 1fr`,
        alignItems: "center",
        gap: `${Math.round(26 * metrics.scale)}px`,
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: `${iconBoxSize}px`,
          height: `${iconBoxSize}px`,
          aspectRatio: "1 / 1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          boxSizing: "border-box",
        }}
      >
        <QuestItemIcon iconData={iconData} metrics={iconScaleMetrics} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: `${Math.round(12 * metrics.scale)}px`,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: `${Math.round(metrics.metaSize * 0.88)}px`,
            lineHeight: 1,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "rgba(255, 247, 227, 0.68)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: `${metrics.bodySize}px`,
            lineHeight: 1.08,
            color: "#fff7e3",
          }}
        >
          {primary}
        </span>
        {secondary ? (
          <span
            style={{
              fontSize: `${metrics.metaSize}px`,
              lineHeight: 1,
              color: "rgba(242, 251, 255, 0.72)",
            }}
          >
            {secondary}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function formatObjectiveLabel(objective) {
  if (!objective) return "Quest details soon"
  const itemLabel = getItemLabel(objective.itemId)
  if (objective.type === QUEST_OBJECTIVE_TYPES.COLLECT_ITEM) return `Collect ${itemLabel}`
  if (objective.type === QUEST_OBJECTIVE_TYPES.CRAFT_ITEM) return `Craft ${itemLabel}`
  if (objective.type === QUEST_OBJECTIVE_TYPES.DISCARD_ITEM) return `Discard ${itemLabel}`
  if (objective.type === QUEST_OBJECTIVE_TYPES.MINE_OBJECT) return `Mine ${itemLabel}`
  if (objective.type === QUEST_OBJECTIVE_TYPES.CHOP_OBJECT) return `Chop ${itemLabel}`
  if (objective.type === QUEST_OBJECTIVE_TYPES.PLANT_CROP) return `Plant ${itemLabel}`
  if (objective.type === QUEST_OBJECTIVE_TYPES.HARVEST_CROP) return `Harvest ${itemLabel}`
  return itemLabel
}

function ObjectivesBlock({ quest, metrics }) {
  const objectives = quest?.objectives || []
  const primaryObjective = objectives[0] || null
  const iconScaleMetrics = { ...metrics, iconSize: Math.round(48 * metrics.scale) }
  const iconBoxSize = Math.round(118 * metrics.scale)
  const iconData = getItemIconData(primaryObjective?.itemId, "Requirement")

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        gridTemplateColumns: `${iconBoxSize}px 1fr`,
        alignItems: "center",
        gap: `${Math.round(26 * metrics.scale)}px`,
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: `${iconBoxSize}px`,
          height: `${iconBoxSize}px`,
          aspectRatio: "1 / 1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          boxSizing: "border-box",
        }}
      >
        <QuestItemIcon iconData={iconData} metrics={iconScaleMetrics} />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          gap: `${Math.round(9 * metrics.scale)}px`,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: `${Math.round(metrics.metaSize * 0.88)}px`,
            lineHeight: 1,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "rgba(255, 247, 227, 0.68)",
          }}
        >
          Requirements
        </span>
        {objectives.map((objective, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: `${Math.round(8 * metrics.scale)}px`,
              alignItems: "center",
              width: "100%",
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: `${Math.round(metrics.bodySize * 0.82)}px`,
                lineHeight: 1.08,
                color: "#fff7e3",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {formatObjectiveLabel(objective)}
            </span>
            <span
              style={{
                fontSize: `${metrics.metaSize}px`,
                lineHeight: 1,
                color: "rgba(242, 251, 255, 0.72)",
                whiteSpace: "nowrap",
              }}
            >
              {`${objective.current}/${objective.target}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatRewardPrimary(quest) {
  const reward = getPrimaryReward(quest)
  if (!reward) return "Reward pending"

  if (reward.type === QUEST_REWARD_TYPES.INVENTORY_CAPACITY) {
    return `Slots +${Math.max(0, Number(reward.amount) || 0)}`
  }

  if (reward.type === QUEST_REWARD_TYPES.ITEM) {
    return `${getItemLabel(reward.value)} x${Math.max(0, Number(reward.amount) || 0)}`
  }

  return `${reward.type}`
}

function getCardVisualState(quest, isFocused) {
  if (!quest) {
    return {
      opacity: 0.7,
      filter: "grayscale(0.2) brightness(0.92)",
      boxShadow: "0 20px 28px rgba(0,0,0,0.28)",
    }
  }

  if (quest.rewardClaimed || quest.status === "claimed") {
    return {
      opacity: 0.2,
      filter: "grayscale(1) saturate(0) brightness(0.78)",
      boxShadow: "0 12px 20px rgba(0,0,0,0.18)",
    }
  }

  if (quest.status === "locked") {
    return {
      opacity: 0.2,
      filter: "grayscale(0.5) saturate(0.6) brightness(0.82)",
      boxShadow: "0 14px 22px rgba(0,0,0,0.20)",
    }
  }

  if (isFocused) {
    return {
      opacity: 1,
      filter: "brightness(1.02) saturate(1.02)",
      boxShadow: "0 26px 42px rgba(0,0,0,0.42)",
    }
  }

  return {
    opacity: 0.82,
    filter: "brightness(0.92) saturate(0.9)",
    boxShadow: "0 16px 28px rgba(0,0,0,0.26)",
  }
}

function CardSection({ metrics, children }) {
  return (
    <div
      style={{
        borderRadius: 0,
        padding: `${metrics.framePaddingY}px ${metrics.framePaddingX}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: `${roundMetric(16 * metrics.scale)}px`,
        minHeight: 0,
        width: "100%",
        boxSizing: "border-box",
        textAlign: "center",
      }}
    >
      {children}
    </div>
  )
}

export default function QuestCard({
  quest,
  scale,
  isFocused,
  isSelectable,
  onSelect,
  ariaLabel,
}) {
  const metrics = useMemo(() => getQuestCardMetrics(scale), [scale])
  const visualState = useMemo(() => getCardVisualState(quest, isFocused), [isFocused, quest])
  const presentation = useMemo(() => getQuestPresentation(quest), [quest])
  const background =
    presentation?.grade === "gold"
      ? goldBg
      : presentation?.grade === "emerald"
      ? emeraldBg
      : presentation?.grade === "diamond"
      ? diamondBg
      : commonBg
  const iconData = getQuestIconData(quest)
  const reward = getPrimaryReward(quest)
  const rewardIconData = getItemIconData(getRewardIconItemId(reward, iconData.itemId), "Reward")
  const rewardPrimary = formatRewardPrimary(quest)
  const isReadyToClaim = quest?.status === "completed" && !quest?.rewardClaimed

  return (
    <button
      className={presentation?.className}
      data-grade={presentation?.grade}
      type="button"
      aria-label={ariaLabel}
      aria-pressed={isFocused}
      disabled={!isSelectable}
      onClick={() => {
        if (!isSelectable) return
        onSelect?.()
      }}
      style={{
        width: `${metrics.width}px`,
        height: `${metrics.height}px`,
        padding: `${metrics.paddingY}px ${metrics.paddingX}px`,
        boxSizing: "border-box",
        border: "none",
        borderRadius: 0,
        backgroundColor: "transparent",
        backgroundImage: `url(${background})`,
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        color: "#fff7e3",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: `${metrics.sectionGap}px`,
        textAlign: "center",
        cursor: isSelectable ? "pointer" : "default",
        opacity: visualState.opacity,
        filter: visualState.filter,
        boxShadow: visualState.boxShadow,
        appearance: "none",
        WebkitAppearance: "none",
        transform: "translateZ(0)",
        transition: "width 180ms ease, height 180ms ease, opacity 180ms ease, filter 180ms ease",
        position: "relative",
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      <style>
        {`
          @keyframes questCardShine {
            0% {
              transform: translate(360px, 590px) rotate(45deg);
              opacity: 0;
            }
            12% {
              opacity: 0.3;
            }
            55% {
              opacity: 0.3;
            }
            78% {
              transform: translate(-360px, -590px) rotate(45deg);
              opacity: 0;
            }
            100% {
              transform: translate(-360px, -590px) rotate(45deg);
              opacity: 0;
            }
          }

          @keyframes questCardReadyStarPop {
            0% {
              transform: scale(0);
              opacity: 0;
            }
            28% {
              transform: scale(1);
              opacity: 0.95;
            }
            58% {
              transform: scale(1);
              opacity: 0.9;
            }
            100% {
              transform: scale(0);
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
            zIndex: 4,
            WebkitMaskImage: `url(${background})`,
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: "100% 100%",
            WebkitMaskPosition: "center",
            maskImage: `url(${background})`,
            maskRepeat: "no-repeat",
            maskSize: "100% 100%",
            maskPosition: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: `${Math.round(130 * metrics.scale)}px`,
              height: `${Math.round(2000 * metrics.scale)}px`,
              left: `calc(50% - ${Math.round(42 * metrics.scale)}px)`,
              top: `calc(50% - ${Math.round(410 * metrics.scale)}px)`,
              background: "#ffffff4c",
              mixBlendMode: "color-dodge",
              borderRadius: "0px",
              filter: `blur(${Math.max(1, Math.round(6 * metrics.scale))}px)`,
              opacity: 0,
              animation: "questCardShine 3s ease-out infinite",
              willChange: "transform, opacity",
            }}
          />

          <div
            style={{
              position: "absolute",
              width: `${Math.round(90 * metrics.scale)}px`,
              height: `${Math.round(2000 * metrics.scale)}px`,
              left: `calc(50% - ${Math.round(18 * metrics.scale)}px)`,
              top: `calc(50% - ${Math.round(280 * metrics.scale)}px)`,
              background: "#ffffff2f",
              mixBlendMode: "color-dodge",
              borderRadius: "0px",
              filter: `blur(${Math.max(1, Math.round(4 * metrics.scale))}px)`,
              opacity: 0,
              animation: "questCardShine 3s ease-out infinite",
              animationDelay: "0.1s",
              willChange: "transform, opacity",
            }}  
          />

          {QUEST_CARD_READY_STAR_FX.map((star, index) => (
            <img
              key={`ready-star-${index}`}
              src={star.src}
              alt=""
              draggable={false}
              aria-hidden="true"
              style={{
                position: "absolute",
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${Math.round(star.size * metrics.scale)}px`,
                height: `${Math.round(star.size * metrics.scale)}px`,
                imageRendering: "pixelated",
                pointerEvents: "none",
                opacity: 0,
                transformOrigin: "center center",
                mixBlendMode: "screen",
                animation: `questCardReadyStarPop ${star.duration}s ease-in-out ${star.delay}s infinite`,
                willChange: "transform, opacity",
              }}
            />
          ))}
        </div>
      )}

      <div
        style={{
          display: "grid",
          position: "relative",
          zIndex: 2,
          gridTemplateRows: "0.95fr 0.72fr 1fr 1fr",
          gap: `${metrics.sectionGap}px`,
          flex: 1,
          minHeight: 0,
          width: "100%",
          alignItems: "center",
          justifyItems: "center",
        }}
      >
        <CardSection metrics={metrics}>
          <div
            style={{
              width: `${Math.round(150 * metrics.scale)}px`,
              height: `${Math.round(150 * metrics.scale)}px`,
              aspectRatio: "1 / 1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              boxSizing: "border-box",
            }}
          >
            <QuestItemIcon iconData={iconData} metrics={metrics} />
          </div>
        </CardSection>

        <CardSection metrics={metrics}>
          <span
            style={{
              fontSize: `${metrics.titleSize}px`,
              lineHeight: 1.02,
              color: "#fff7e5",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {quest?.title || "Quest"}
          </span>
        </CardSection>

        <CardSection metrics={metrics}>
          <ObjectivesBlock quest={quest} metrics={metrics} />
        </CardSection>

        <CardSection metrics={metrics}>
          <ItemInfoBlock
            metrics={metrics}
            label="Reward"
            primary={rewardPrimary}
            secondary=""
            iconData={rewardIconData}
          />
        </CardSection>
      </div>
    </button>
  )
}
