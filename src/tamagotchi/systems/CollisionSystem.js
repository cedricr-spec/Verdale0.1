import { useEffect } from "react";
import {
  isGameplayUiBlockingState,
  setWorldMovementResolver,
  useWorldStore,
} from "../store/worldSlice";
import { useBrokenObjectsStore } from "../store/brokenObjectsStore";
import { getWorldThemeConfig } from "../config/worldThemeConfig";
import {
  DEFAULT_CHARACTER_SCALE,
} from "../config/characterRoster";
import { FRAME_HEIGHT } from "../config/sharedAnimationMap";
import {
  applyWorldAtlasObjectState,
  createWorldAtlasStumpRenderItem,
} from "../utils/worldAtlasData";
import {
  WORLD_ATLAS_COLLISION_VIEWPORT,
  getWorldAtlasCollisionBounds,
  getWorldAtlasCollisionObjects,
  isWorldTerrainBoundsWalkable,
} from "../utils/worldAtlasFamilies";
import {
  isRectBlockedByVillage,
  usesVillageCollisionObjectLayer,
} from "../utils/worldVillage";
import { canTriggerMobileHaptics, triggerMobileHaptic } from "../utils/mobileHaptics";

const PET_SPRITE_HEIGHT = FRAME_HEIGHT * DEFAULT_CHARACTER_SCALE;
const PET_COLLISION_SIZE = 24;
const PLAYER_COLLISION_STEP_PX = 4;
export const DEBUG_PLAYER_COLLISION = false;

// Shared authoritative footprint — imported by WorldAtlasLayer for debug rendering.
// Fixed-size 24x24 footprint, centered on the pet and bottom-aligned to the feet
// so gameplay collision and debug use the exact same rectangle.
export const PET_COLLISION_FOOTPRINT = {
  width: PET_COLLISION_SIZE,
  height: PET_COLLISION_SIZE,
};

function getBounds(item) {
  return getWorldAtlasCollisionBounds(item);
}

export function getPetCollisionBounds(point) {
  const spriteBottom = point.y + PET_SPRITE_HEIGHT * 0.5;

  return {
    left: point.x - PET_COLLISION_FOOTPRINT.width / 2,
    right: point.x + PET_COLLISION_FOOTPRINT.width / 2,
    top: spriteBottom - PET_COLLISION_FOOTPRINT.height,
    bottom: spriteBottom,
  };
}

function pathIntersectsBounds(fromBounds, toBounds, bounds) {
  const sweptLeft = Math.min(fromBounds.left, toBounds.left);
  const sweptRight = Math.max(fromBounds.right, toBounds.right);
  const sweptTop = Math.min(fromBounds.top, toBounds.top);
  const sweptBottom = Math.max(fromBounds.bottom, toBounds.bottom);

  return !(
    sweptRight < bounds.left ||
    sweptLeft > bounds.right ||
    sweptBottom < bounds.top ||
    sweptTop > bounds.bottom
  );
}

function boundsOverlap(a, b) {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

let npcCollisionResolver = null;
let npcCollisionContactHandler = null;
let lastCollisionHapticDirection = null;
let wasCollisionHapticBlocked = false;
let collisionDebugState = {
  previousBounds: null,
  candidateBounds: null,
  resolvedBounds: null,
  blockedBounds: null,
};

export function setNpcCollisionResolver(resolver) {
  npcCollisionResolver = typeof resolver === "function" ? resolver : null;
}

export function setNpcCollisionContactHandler(handler) {
  npcCollisionContactHandler =
    typeof handler === "function" ? handler : null;
}

export function getCollisionDebugState() {
  return collisionDebugState;
}

function setCollisionDebugState(nextState) {
  collisionDebugState = {
    previousBounds: nextState?.previousBounds || null,
    candidateBounds: nextState?.candidateBounds || null,
    resolvedBounds: nextState?.resolvedBounds || null,
    blockedBounds: nextState?.blockedBounds || null,
  };
}

function getMovementDirectionKey(dx, dy) {
  const horizontal =
    dx > 0.001 ? "right" : dx < -0.001 ? "left" : "";
  const vertical =
    dy > 0.001 ? "down" : dy < -0.001 ? "up" : "";

  return `${horizontal}${horizontal && vertical ? "-" : ""}${vertical}` || "idle";
}

function shouldSuppressCollisionHaptic() {
  if (!canTriggerMobileHaptics()) {
    return true;
  }

  if (typeof document !== "undefined" && document.body?.classList.contains("is-dragging")) {
    return true;
  }

  return isGameplayUiBlockingState(useWorldStore.getState());
}

function updateCollisionHaptics({ isBlocked, attemptedDx, attemptedDy, collisionType }) {
  if (!isBlocked) {
    wasCollisionHapticBlocked = false;
    lastCollisionHapticDirection = null;
    return;
  }

  if (collisionType !== "collision" || shouldSuppressCollisionHaptic()) {
    return;
  }

  const directionKey = getMovementDirectionKey(attemptedDx, attemptedDy);
  const directionChanged = lastCollisionHapticDirection !== directionKey;
  const shouldPulse = !wasCollisionHapticBlocked || directionChanged;

  wasCollisionHapticBlocked = true;
  lastCollisionHapticDirection = directionKey;

  if (shouldPulse) {
    triggerMobileHaptic("collision");
  }
}

export function startCollisionSystem() {
  if (
    typeof window !== "undefined" &&
    !window.__VILLAGE_COLLISION_MODE_LOGGED__
  ) {
    console.info(
      `[Village Collision] using ${
        usesVillageCollisionObjectLayer() ? "object layer" : "tile fallback"
      }`
    );
    window.__VILLAGE_COLLISION_MODE_LOGGED__ = true;
  }

  setWorldMovementResolver(({ worldOffset, dx, dy }) => {
    if (dx === 0 && dy === 0) {
      updateCollisionHaptics({
        isBlocked: false,
        attemptedDx: 0,
        attemptedDy: 0,
        collisionType: null,
      });
      const idleBounds = getPetCollisionBounds({
        x: -worldOffset.x,
        y: -worldOffset.y,
      });
      setCollisionDebugState({
        previousBounds: idleBounds,
        candidateBounds: idleBounds,
        resolvedBounds: idleBounds,
        blockedBounds: null,
      });
      return { dx, dy };
    }

    const { currentWorldTheme } = useWorldStore.getState();
    const theme = getWorldThemeConfig(currentWorldTheme);
    const previousPet = { x: -worldOffset.x, y: -worldOffset.y };
    const previousBounds = getPetCollisionBounds(previousPet);
    let pendingNpcContact = null;

    function getCandidateOffset(candidateDx, candidateDy) {
      return {
        x: worldOffset.x + candidateDx,
        y: worldOffset.y + candidateDy,
      };
    }

    const fullCandidateOffset = getCandidateOffset(dx, dy);
    const proposedPet = {
      x: -fullCandidateOffset.x,
      y: -fullCandidateOffset.y,
    };
    const rangeX = WORLD_ATLAS_COLLISION_VIEWPORT.width / 2;
    const rangeY = WORLD_ATLAS_COLLISION_VIEWPORT.height / 2;
    const brokenObjectState = useBrokenObjectsStore.getState();
    const stumpObjects = brokenObjectState?.stumpObjects || {};
    const allItems = getWorldAtlasCollisionObjects(
      proposedPet.x,
      proposedPet.y,
      theme.atlasData,
      WORLD_ATLAS_COLLISION_VIEWPORT
    );
    const baseItems = applyWorldAtlasObjectState(
      allItems,
      theme.atlasData,
      brokenObjectState
    );
    const stumpItems = Object.values(stumpObjects)
      .map((stumpObject) =>
        createWorldAtlasStumpRenderItem(stumpObject, theme.atlasData)
      )
      .filter(Boolean);
    const items = [...baseItems, ...stumpItems];
    const collisionViewportBounds = {
      left: proposedPet.x - rangeX,
      right: proposedPet.x + rangeX,
      top: proposedPet.y - rangeY,
      bottom: proposedPet.y + rangeY,
    };
    const visibleItems = items.filter((item) =>
      boundsOverlap(getBounds(item), collisionViewportBounds)
    );
    const walkableOverrides = visibleItems
      .filter((item) => item.walkableOverride)
      .map((item) => ({ item, bounds: getBounds(item) }));

    function normalizeNpcCollision(result) {
      if (result && typeof result === "object") {
        return {
          blocked: Boolean(result.blocked),
          npcId: result.npcId || null,
        };
      }

      return {
        blocked: Boolean(result),
        npcId: null,
      };
    }

    function registerNpcContact(npcCollision, candidateBounds) {
      if (!npcCollision?.npcId) {
        return;
      }

      pendingNpcContact = {
        npcId: npcCollision.npcId,
        candidateBounds,
        previousBounds,
        attemptedWorldDx: dx,
        attemptedWorldDy: dy,
        attemptedPlayerDx: -dx,
        attemptedPlayerDy: -dy,
      };
    }

    function evaluateMove(candidateDx, candidateDy) {
      const candidateOffset = getCandidateOffset(candidateDx, candidateDy);
      const candidatePet = {
        x: -candidateOffset.x,
        y: -candidateOffset.y,
      };
      const candidateBounds = getPetCollisionBounds(candidatePet);
      const swept = {
        left: Math.min(previousBounds.left, candidateBounds.left),
        right: Math.max(previousBounds.right, candidateBounds.right),
        top: Math.min(previousBounds.top, candidateBounds.top),
        bottom: Math.max(previousBounds.bottom, candidateBounds.bottom),
      };

      if (!isWorldTerrainBoundsWalkable(swept)) {
        return {
          blocked: true,
          candidateBounds,
          blockedBounds: candidateBounds,
          collisionType: "collision",
        };
      }

      const overlapsVillageNow = isRectBlockedByVillage(
        candidateBounds.left,
        candidateBounds.top,
        candidateBounds.right - candidateBounds.left,
        candidateBounds.bottom - candidateBounds.top
      );
      const overlapsVillageBefore = isRectBlockedByVillage(
        previousBounds.left,
        previousBounds.top,
        previousBounds.right - previousBounds.left,
        previousBounds.bottom - previousBounds.top
      );
      if (overlapsVillageNow && !overlapsVillageBefore) {
        return {
          blocked: true,
          candidateBounds,
          blockedBounds: candidateBounds,
          collisionType: "collision",
        };
      }

      const npcCollision = normalizeNpcCollision(
        npcCollisionResolver?.(candidateBounds, {
          previousBounds,
        })
      );
      const overlapsNpcNow = npcCollision.blocked;
      if (overlapsNpcNow) {
        registerNpcContact(npcCollision, candidateBounds);
        return {
          blocked: true,
          candidateBounds,
          blockedBounds: candidateBounds,
          collisionType: "collision",
        };
      }

      for (const item of visibleItems) {
        if (!item.blocksMovement) continue;
        const bounds = getBounds(item);

        const overridden = walkableOverrides.some(({ bounds: overrideBounds }) => {
          if (!boundsOverlap(bounds, overrideBounds)) return false;
          return (
            boundsOverlap(candidateBounds, overrideBounds) ||
            boundsOverlap(previousBounds, overrideBounds) ||
            pathIntersectsBounds(previousBounds, candidateBounds, overrideBounds)
          );
        });
        if (overridden) continue;

        // If already overlapping this obstacle, allow movement so the player can escape.
        if (boundsOverlap(previousBounds, bounds)) continue;

        if (
          boundsOverlap(candidateBounds, bounds) ||
          pathIntersectsBounds(previousBounds, candidateBounds, bounds)
        ) {
          return {
            blocked: true,
            candidateBounds,
            blockedBounds: bounds,
            collisionType: "collision",
          };
        }
      }

      return {
        blocked: false,
        candidateBounds,
        blockedBounds: null,
        collisionType: null,
      };
    }

    function resolveSteppedMove(targetDx, targetDy) {
      const distance = Math.hypot(targetDx, targetDy);
      if (distance <= 0.001) {
        return {
          dx: 0,
          dy: 0,
          bounds: previousBounds,
          blockedBounds: null,
          lastCandidateBounds: previousBounds,
          collisionType: null,
        };
      }

      const directionX = targetDx / distance;
      const directionY = targetDy / distance;
      let remaining = distance;
      let resolvedDx = 0;
      let resolvedDy = 0;
      let lastCandidateBounds = previousBounds;
      let blockedBounds = null;
      let collisionType = null;

      while (remaining > 0.001) {
        const substep = Math.min(PLAYER_COLLISION_STEP_PX, remaining);
        const nextDx = resolvedDx + directionX * substep;
        const nextDy = resolvedDy + directionY * substep;
        const evaluation = evaluateMove(nextDx, nextDy);
        lastCandidateBounds = evaluation.candidateBounds;

        if (evaluation.blocked) {
          blockedBounds = evaluation.blockedBounds || evaluation.candidateBounds;
          collisionType = evaluation.collisionType || "collision";
          break;
        }

        resolvedDx = nextDx;
        resolvedDy = nextDy;
        remaining -= substep;
      }

      const resolvedBounds = evaluateMove(resolvedDx, resolvedDy).candidateBounds;
      return {
        dx: resolvedDx,
        dy: resolvedDy,
        bounds: resolvedBounds,
        blockedBounds,
        lastCandidateBounds,
        collisionType,
      };
    }

    const fullEvaluation = evaluateMove(dx, dy);
    if (!fullEvaluation.blocked) {
      updateCollisionHaptics({
        isBlocked: false,
        attemptedDx: dx,
        attemptedDy: dy,
        collisionType: null,
      });
      if (pendingNpcContact) {
        npcCollisionContactHandler?.(pendingNpcContact);
      }
      setCollisionDebugState({
        previousBounds,
        candidateBounds: fullEvaluation.candidateBounds,
        resolvedBounds: fullEvaluation.candidateBounds,
        blockedBounds: null,
      });
      return { dx, dy };
    }

    const steppedMove = resolveSteppedMove(dx, dy);
    if (Math.abs(steppedMove.dx) > 0.001 || Math.abs(steppedMove.dy) > 0.001) {
      updateCollisionHaptics({
        isBlocked: true,
        attemptedDx: dx,
        attemptedDy: dy,
        collisionType:
          steppedMove.collisionType ||
          fullEvaluation.collisionType ||
          "collision",
      });
      if (pendingNpcContact) {
        npcCollisionContactHandler?.(pendingNpcContact);
      }
      setCollisionDebugState({
        previousBounds,
        candidateBounds: steppedMove.lastCandidateBounds,
        resolvedBounds: steppedMove.bounds,
        blockedBounds: steppedMove.blockedBounds,
      });
      return {
        dx: steppedMove.dx,
        dy: steppedMove.dy,
      };
    }

    const resolvedDx = dx !== 0 ? resolveSteppedMove(dx, 0) : null;
    const resolvedDy = dy !== 0 ? resolveSteppedMove(0, dy) : null;
    const finalDx = resolvedDx?.dx || 0;
    const finalDy = resolvedDy?.dy || 0;
    const finalResolvedBounds =
      (Math.abs(finalDx) > 0.001 || Math.abs(finalDy) > 0.001)
        ? evaluateMove(finalDx, finalDy).candidateBounds
        : previousBounds;

    updateCollisionHaptics({
      isBlocked: true,
      attemptedDx: dx,
      attemptedDy: dy,
      collisionType:
        resolvedDx?.collisionType ||
        resolvedDy?.collisionType ||
        fullEvaluation.collisionType ||
        "collision",
    });

    setCollisionDebugState({
      previousBounds,
      candidateBounds: fullEvaluation.candidateBounds,
      resolvedBounds: finalResolvedBounds,
      blockedBounds:
        resolvedDx?.blockedBounds ||
        resolvedDy?.blockedBounds ||
        fullEvaluation.blockedBounds ||
        null,
    });

    if (pendingNpcContact) {
      npcCollisionContactHandler?.(pendingNpcContact);
    }

    return {
      dx: finalDx,
      dy: finalDy,
    };
  });

  return () => {
    setWorldMovementResolver(null);
  };
}

export default function CollisionSystem() {
  useEffect(() => {
    return startCollisionSystem();
  }, []);

  return null;
}
