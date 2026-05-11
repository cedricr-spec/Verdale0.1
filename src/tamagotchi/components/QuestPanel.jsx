import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import TintedCtaButton from "../../components/TintedCtaButton"
import closeButton from "../../hud/CTAs/CTA_Small_8BIT_Close.webp"
import closeButtonPressed from "../../hud/CTAs/CTA_Small_8BIT_Close_Pressed.webp"
import mediumCta from "../../hud/CTAs/CTA_Medium_8BIT.webp"
import mediumCtaPressed from "../../hud/CTAs/CTA_Medium_8BIT_Pressed.webp"
import { usePetStore } from "../store/usePetStore"
import { getCurrentChapter, getQuestIdsForChapter } from "../config/questConfig"
import { getQuestSummaryById, useQuestStore } from "../store/useQuestStore"
import QuestCard, {
  QUEST_CARD_ACTIVE_SCALE,
  QUEST_CARD_BASE_HEIGHT,
  QUEST_CARD_BASE_WIDTH,
  QUEST_CARD_SCALE,
  getQuestCardMetrics,
} from "./QuestCard"

const OVERLAY_Z_INDEX = 1000002
const CONTENT_Z_INDEX = 1000004
const CLOSE_BUTTON_SIZE = 52
const CLAIM_BUTTON_WIDTH = 196
const CLAIM_BUTTON_HEIGHT = 52
const OVERLAY_HORIZONTAL_PADDING = 28
const OVERLAY_VERTICAL_RESERVE = 184
const HEADER_GAP = 22
const MOBILE_OVERLAY_HORIZONTAL_PADDING = 0
const MOBILE_OVERLAY_TOP_PADDING = 16
const MOBILE_OVERLAY_BOTTOM_PADDING = 16

// Maximum quests ahead of the active quest to show in the carousel
const MAX_AHEAD_QUESTS = 1

// Gesture thresholds
const SWIPE_THRESHOLD_PX = 40
const VERTICAL_LOCK_THRESHOLD_PX = 15
const SNAP_ANIMATION_MS = 250
const WHEEL_DEBOUNCE_MS = 100

function isQuestDone(quest) {
  return Boolean(quest && (quest.rewardClaimed || quest.status === "claimed"))
}

function isQuestSelectable(quest) {
  if (!quest) return false
  if (quest.status === "locked") return false
  if (quest.repeatable === true) return true
  return !(quest.rewardClaimed || quest.status === "claimed")
}

function canClaimQuest(quest) {
  return quest?.status === "completed" && !quest.rewardClaimed
}

export default function QuestPanel({ open, onClose }) {
  const unlockedQuestIds = useQuestStore((state) => state.unlockedQuestIds)
  const activeQuestId = useQuestStore((state) => state.activeQuestId)
  const completedQuestIds = useQuestStore((state) => state.completedQuestIds)
  const claimedQuestIds = useQuestStore((state) => state.claimedQuestIds)
  const rewardClaimedQuestIds = useQuestStore((state) => state.rewardClaimedQuestIds)
  const objectiveProgress = useQuestStore((state) => state.objectiveProgress)
  const setActiveQuest = useQuestStore((state) => state.setActiveQuest)
  const claimQuestRewards = useQuestStore((state) => state.claimQuestRewards)
  const modelColor = usePetStore((state) => state.theme.modelColor)

  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1440,
    height: typeof window !== "undefined" ? window.innerHeight : 900,
  }))

  useEffect(() => {
    if (typeof window === "undefined") return undefined

    const updateViewportSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight })
    }

    updateViewportSize()
    window.addEventListener("resize", updateViewportSize)
    return () => window.removeEventListener("resize", updateViewportSize)
  }, [])

  // Index-based slider state
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [isSnapping, setIsSnapping] = useState(false)
  
  // Gesture tracking refs
  const gestureStartRef = useRef({ x: 0, y: 0, time: 0 })
  const isDraggingRef = useRef(false)
  const wheelTimeoutRef = useRef(null)
  const wheelAccumRef = useRef(0)
  const snapTimeoutRef = useRef(null)
  const panelOpenRef = useRef(false)
  const focusedIndexRef = useRef(0)
  const isSnappingRef = useRef(false)
  const wheelLockRef = useRef(false)

  const questState = useMemo(
    () => ({
      unlockedQuestIds,
      activeQuestId,
      completedQuestIds,
      claimedQuestIds,
      rewardClaimedQuestIds,
      objectiveProgress,
    }),
    [activeQuestId, claimedQuestIds, completedQuestIds, objectiveProgress, rewardClaimedQuestIds, unlockedQuestIds]
  )

  const currentChapter = useMemo(() => getCurrentChapter(questState), [questState])

  const currentChapterQuestIds = useMemo(
    () => getQuestIdsForChapter(currentChapter.id),
    [currentChapter.id]
  )

  const questSummaries = useMemo(
    () => currentChapterQuestIds.map((questId) => getQuestSummaryById(questId, questState)).filter(Boolean),
    [currentChapterQuestIds, questState]
  )

  // Visible quest window: done quests (in chapter order) + active quest + up to MAX_AHEAD_QUESTS next
  const visibleQuestSummaries = useMemo(() => {
    const summaryById = new Map(questSummaries.map((q) => [q.id, q]))
    const ordered = currentChapterQuestIds.map((id) => summaryById.get(id)).filter(Boolean)

    const activeIdx = ordered.findIndex((q) => q.id === activeQuestId)
    const result = []
    let aheadCount = 0

    for (let i = 0; i < ordered.length; i++) {
      const quest = ordered[i]

      if (isQuestDone(quest)) {
        result.push(quest)
        continue
      }

      if (quest.id === activeQuestId) {
        result.push(quest)
        continue
      }

      const isAfterActive = activeIdx === -1 || i > activeIdx
      if (isAfterActive && aheadCount < MAX_AHEAD_QUESTS) {
        result.push(quest)
        aheadCount++
      }
    }

    // Edge case: no active quest — show up to 2 non-done quests
    if (activeIdx === -1 && result.filter((q) => !isQuestDone(q)).length === 0) {
      for (const quest of ordered) {
        if (!isQuestDone(quest) && !result.includes(quest)) {
          result.push(quest)
          if (result.filter((q) => !isQuestDone(q)).length >= 2) break
        }
      }
    }

    return result
  }, [currentChapterQuestIds, questSummaries, activeQuestId])

  const claimableQuestCount = useMemo(
    () => questSummaries.filter((quest) => canClaimQuest(quest)).length,
    [questSummaries]
  )

  const isMobileView = viewportSize.width < 800

  const fitFactor = useMemo(() => {
    const mobileHorizontalPadding = MOBILE_OVERLAY_HORIZONTAL_PADDING * 2
    const verticalReserve = viewportSize.width < 800 ? 320 : OVERLAY_VERTICAL_RESERVE
    const availableWidth = Math.max(
      220,
      viewportSize.width - (viewportSize.width < 800 ? mobileHorizontalPadding : OVERLAY_HORIZONTAL_PADDING * 2)
    )
    const availableHeight = Math.max(300, viewportSize.height - verticalReserve)
    const activeBaseWidth = QUEST_CARD_BASE_WIDTH * QUEST_CARD_ACTIVE_SCALE
    const activeBaseHeight = QUEST_CARD_BASE_HEIGHT * QUEST_CARD_ACTIVE_SCALE

    return Math.min(1, availableWidth / activeBaseWidth, availableHeight / activeBaseHeight)
  }, [viewportSize.height, viewportSize.width])

  const activeCardScale = QUEST_CARD_ACTIVE_SCALE * fitFactor
  const inactiveCardScale = QUEST_CARD_SCALE * fitFactor
  const activeCardMetrics = useMemo(() => getQuestCardMetrics(activeCardScale), [activeCardScale])

  const carouselViewportRef = useRef(null)
  const carouselTrackRef = useRef(null)
  const [carouselWidth, setCarouselWidth] = useState(0)

  const carouselGap = Math.max(6, Math.round(10 * fitFactor))
  const carouselPaddingBlock = Math.max(isMobileView ? 20 : 56, Math.round(72 * fitFactor))
  const claimButtonMarginTop = Math.max(isMobileView ? 10 : 16, Math.round(22 * fitFactor))

  // All slots share the same width so snap points are equidistant.
  const slotWidth = activeCardMetrics.width
  const slotHeight = activeCardMetrics.height

  // Initialize focused index when panel opens or visibleQuestSummaries changes
  useEffect(() => {
    if (!open) {
      panelOpenRef.current = false
      return
    }

    if (!panelOpenRef.current) {
      panelOpenRef.current = true

      // Find initial index: active quest if visible, otherwise first selectable, otherwise first
      let initialIndex = 0
      const activeIdx = visibleQuestSummaries.findIndex((q) => q.id === activeQuestId)
      if (activeIdx !== -1) {
        initialIndex = activeIdx
      } else {
        const selectableIdx = visibleQuestSummaries.findIndex((q) => isQuestSelectable(q))
        initialIndex = selectableIdx !== -1 ? selectableIdx : 0
      }

      setFocusedIndex(initialIndex)
    }
  }, [open, visibleQuestSummaries, activeQuestId])

  // Re-center focused index on window resize (but not during user drag)
  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined

    const handleResize = () => {
      if (isDraggingRef.current) return
      window.requestAnimationFrame(() => {
        // Re-clamp the focused index in case visibleQuestSummaries changed
        setFocusedIndex((prev) =>
          Math.max(0, Math.min(prev, visibleQuestSummaries.length - 1))
        )
      })
    }

    window.addEventListener("resize", handleResize, { passive: true })
    return () => window.removeEventListener("resize", handleResize)
  }, [open, visibleQuestSummaries.length])

  useLayoutEffect(() => {
    if (!open || !carouselViewportRef.current) return undefined

    const container = carouselViewportRef.current
    const updateCarouselWidth = () => {
      setCarouselWidth(container.clientWidth || 0)
    }

    updateCarouselWidth()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateCarouselWidth)
      return () => window.removeEventListener("resize", updateCarouselWidth)
    }

    const observer = new ResizeObserver(updateCarouselWidth)
    observer.observe(container)

    return () => observer.disconnect()
  }, [open])

  // Move to a specific index with snap animation
  const moveToIndex = useCallback((targetIndex) => {
    if (isSnapping) return
    const clamped = Math.max(0, Math.min(targetIndex, visibleQuestSummaries.length - 1))
    setFocusedIndex(clamped)
    setIsSnapping(true)
    if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current)
    snapTimeoutRef.current = setTimeout(() => setIsSnapping(false), SNAP_ANIMATION_MS)
  }, [visibleQuestSummaries.length, isSnapping])

  // Pointer event handling for swipes
  const handlePointerDown = useCallback((e) => {
    if (isDraggingRef.current || isSnapping) return
    isDraggingRef.current = true
    gestureStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() }
  }, [isSnapping])

  const handlePointerUp = useCallback((e) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false

    const deltaX = e.clientX - gestureStartRef.current.x
    const deltaY = e.clientY - gestureStartRef.current.y
    const absDeltaX = Math.abs(deltaX)
    const absDeltaY = Math.abs(deltaY)

    // Ensure horizontal movement is stronger than vertical (no accidental vertical swipes)
    if (absDeltaX > VERTICAL_LOCK_THRESHOLD_PX && absDeltaX > absDeltaY && absDeltaX > SWIPE_THRESHOLD_PX) {
      const direction = deltaX > 0 ? -1 : 1 // Swipe right = prev, swipe left = next
      moveToIndex(focusedIndex + direction)
    }
  }, [focusedIndex, moveToIndex])

  // Wheel / trackpad handling. Trackpads mostly emit small repeated deltas,
  // often on deltaX for horizontal swipes, so accumulate before moving one card.
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()

    if (isSnapping) return

    const horizontalDelta = Math.abs(e.deltaX) >= Math.abs(e.deltaY)
      ? e.deltaX
      : e.deltaY

    if (Math.abs(horizontalDelta) < 2) return

    wheelAccumRef.current += horizontalDelta

    if (wheelTimeoutRef.current) {
      clearTimeout(wheelTimeoutRef.current)
    }

    wheelTimeoutRef.current = setTimeout(() => {
      const accumulated = wheelAccumRef.current
      wheelAccumRef.current = 0
      wheelTimeoutRef.current = null

      if (Math.abs(accumulated) < 28) return

      const direction = accumulated > 0 ? 1 : -1
      moveToIndex(focusedIndex + direction)
    }, WHEEL_DEBOUNCE_MS)
  }, [focusedIndex, moveToIndex, isSnapping])

  useEffect(() => {
    return () => {
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current)
        wheelTimeoutRef.current = null
      }
      wheelAccumRef.current = 0
      wheelLockRef.current = false
    }
  }, [])

  // Sync refs for native wheel handler
  useEffect(() => {
    focusedIndexRef.current = focusedIndex
    isSnappingRef.current = isSnapping
  }, [focusedIndex, isSnapping])

  // Native wheel listener (non-passive) for trackpad scroll
  useEffect(() => {
    if (!open || !carouselViewportRef.current) return undefined

    const container = carouselViewportRef.current

    const handleNativeWheel = (event) => {
      event.preventDefault()
      event.stopPropagation()

      if (isSnappingRef.current || wheelLockRef.current || visibleQuestSummaries.length <= 1) return

      const dominantDelta = Math.abs(event.deltaX) >= Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY

      if (Math.abs(dominantDelta) < 1) return

      wheelAccumRef.current += dominantDelta

      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current)
      }

      const commitWheelNavigation = () => {
        const accumulated = wheelAccumRef.current
        wheelAccumRef.current = 0
        wheelTimeoutRef.current = null

        if (Math.abs(accumulated) < 22) return

        wheelLockRef.current = true
        const direction = accumulated > 0 ? 1 : -1
        moveToIndex(focusedIndexRef.current + direction)

        window.setTimeout(() => {
          wheelLockRef.current = false
        }, SNAP_ANIMATION_MS + 200)
      }

      if (Math.abs(wheelAccumRef.current) >= 10) {
        commitWheelNavigation()
        return
      }

      wheelTimeoutRef.current = setTimeout(commitWheelNavigation, 70)
    }

    container.addEventListener("wheel", handleNativeWheel, { passive: false })

    return () => {
      container.removeEventListener("wheel", handleNativeWheel)
    }
  }, [moveToIndex, open, visibleQuestSummaries.length])

  // Calculate offset for transform
  const trackOffsetX = useMemo(() => {
    const clamped = Math.max(0, Math.min(focusedIndex, visibleQuestSummaries.length - 1))
    const viewportCenterOffset = Math.max(0, carouselWidth / 2 - slotWidth / 2)
    return viewportCenterOffset - clamped * (slotWidth + carouselGap)
  }, [carouselGap, carouselWidth, focusedIndex, slotWidth, visibleQuestSummaries.length])

  // Get the focused quest from index
  const focusedQuest = useMemo(() => {
    const clamped = Math.max(0, Math.min(focusedIndex, visibleQuestSummaries.length - 1))
    return visibleQuestSummaries[clamped] ?? null
  }, [focusedIndex, visibleQuestSummaries])

  // Find the index of the currently active quest in the visible list
  const activeVisibleQuestIndex = useMemo(
    () => visibleQuestSummaries.findIndex((quest) => quest.id === activeQuestId),
    [activeQuestId, visibleQuestSummaries]
  )


  if (!open) return null

  return (
    <>
      <style>{`
        .quest-carousel-track {
          transition: ${isSnapping ? `transform ${SNAP_ANIMATION_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1)` : "none"};
        }
      `}</style>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onPointerDown={(event) => {
          event.stopPropagation()
          onClose?.()
        }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: OVERLAY_Z_INDEX,
          background: "rgba(2, 6, 12, 0.54)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          pointerEvents: "auto",
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quest carousel"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: CONTENT_Z_INDEX,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: isMobileView ? "flex-start" : "center",
          gap: isMobileView ? "12px" : `${HEADER_GAP}px`,
          padding: isMobileView
            ? `max(${MOBILE_OVERLAY_TOP_PADDING}px, env(safe-area-inset-top)) max(${MOBILE_OVERLAY_HORIZONTAL_PADDING}px, env(safe-area-inset-right)) max(${MOBILE_OVERLAY_BOTTOM_PADDING}px, env(safe-area-inset-bottom)) max(${MOBILE_OVERLAY_HORIZONTAL_PADDING}px, env(safe-area-inset-left))`
            : "20px 0 28px",
          boxSizing: "border-box",
          overflow: isMobileView ? "hidden" : "visible",
        }}
      >
        {/* Header */}
        <div
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            pointerEvents: "auto",
            width: isMobileView ? "100%" : "min(920px, calc(100vw - 44px))",
            maxWidth: "100%",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "18px",
            color: "#ffffff",
            textShadow: "0 6px 18px rgba(0,0,0,0.45)",
            overflow: "visible",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              paddingLeft: isMobileView ? "5vw" : undefined,
              paddingRight: isMobileView ? "5vw" : undefined,
              minWidth: 0,
            }}
          >
            <strong style={{ fontSize: "24px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {currentChapter.title}
            </strong>
            <span style={{ fontSize: "12px", lineHeight: 1.35, color: "rgba(255,255,255,0.78)" }}>
              {claimableQuestCount > 0
                ? `${claimableQuestCount} quest reward${claimableQuestCount === 1 ? "" : "s"} ready to claim`
                : "Swipe to explore quests. Tap a quest card to track it."}
            </span>
          </div>

          <TintedCtaButton
            ariaLabel="Close quests"
            defaultSrc={closeButton}
            pressedSrc={closeButtonPressed}
            tintColor={modelColor || "#8f8f8f"}
            onClick={() => onClose?.()}
            width={`${CLOSE_BUTTON_SIZE}px`}
            height={`${CLOSE_BUTTON_SIZE}px`}
            style={{ pointerEvents: "auto", flexShrink: 0 }}
          />
        </div>

        {/* Carousel + Claim button */}
        <div
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: `${claimButtonMarginTop}px`,
            pointerEvents: "auto",
            overflow: isMobileView ? "hidden" : "visible",
            paddingBottom: isMobileView ? "max(12px, env(safe-area-inset-bottom))" : undefined,
            boxSizing: "border-box",
            minHeight: 0,
          }}
        >
          {/* Carousel viewport: overflow hidden, no native scroll */}
          <div
            ref={carouselViewportRef}
            className="quest-carousel"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onTouchMove={(event) => {
              event.stopPropagation()
            }}
            style={{
              width: "100%",
              maxWidth: "100%",
              height: `${slotHeight + carouselPaddingBlock * 2}px`,
              overflow: "hidden",
              touchAction: "none",
              position: "relative",
            }}
          >
            {/* Carousel track: transformed via translate */}
            <div
              ref={carouselTrackRef}
              className="quest-carousel-track"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: `${carouselGap}px`,
                paddingBlock: `${carouselPaddingBlock}px`,
                boxSizing: "border-box",
                transform: `translateX(${trackOffsetX}px)`,
                willChange: isSnapping ? "transform" : "auto",
              }}
            >
              {visibleQuestSummaries.map((quest, idx) => {
                const isFocused = idx === focusedIndex
                const isSelectable = isQuestSelectable(quest)
                const cardScale = isFocused ? activeCardScale : inactiveCardScale

                return (
                  <div
                    key={quest.id}
                    data-quest-id={quest.id}
                    data-quest-index={idx}
                    style={{
                      flex: `0 0 ${slotWidth}px`,
                      width: `${slotWidth}px`,
                      height: `${slotHeight}px`,
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "center",
                      overflow: "visible",
                      background: "transparent",
                    }}
                  >
                    <QuestCard
                      quest={quest}
                      scale={cardScale}
                      isFocused={isFocused}
                      isSelectable={isSelectable}
                      ariaLabel={isSelectable ? `Select ${quest.title}` : `${quest.title} unavailable`}
                      onSelect={() => {
                        if (!isSelectable) return
                        setActiveQuest(quest.id)
                        setFocusedIndex(idx)
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Claim button */}
          {focusedQuest ? (
            <TintedCtaButton
              ariaLabel={
                canClaimQuest(focusedQuest)
                  ? `Claim rewards for ${focusedQuest.title}`
                  : `Claim unavailable for ${focusedQuest.title}`
              }
              defaultSrc={mediumCta}
              pressedSrc={mediumCtaPressed}
              tintColor={canClaimQuest(focusedQuest) ? modelColor || "#8f8f8f" : "#58606d"}
              label={canClaimQuest(focusedQuest) ? "Claim Reward" : "Not Ready"}
              labelClassName="hud-ui-text hud-ui-text--cta"
              onClick={() => {
                if (!canClaimQuest(focusedQuest)) return
                const claimedQuestId = focusedQuest.id
                claimQuestRewards(claimedQuestId)

                window.requestAnimationFrame(() => {
                  const nextActiveIndex = visibleQuestSummaries.findIndex(
                    (quest) => quest.id !== claimedQuestId && isQuestSelectable(quest)
                  )

                  if (nextActiveIndex !== -1) {
                    setFocusedIndex(nextActiveIndex)
                  }
                })
              }}
              disabled={!canClaimQuest(focusedQuest)}
              width={`${CLAIM_BUTTON_WIDTH}px`}
              height={`${CLAIM_BUTTON_HEIGHT}px`}
              style={{ pointerEvents: "auto", flexShrink: 0 }}
            />
          ) : null}
        </div>
      </div>
    </>
  )
}
