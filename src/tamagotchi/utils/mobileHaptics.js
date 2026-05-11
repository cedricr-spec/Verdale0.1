const COLLISION_HAPTIC_DURATION_MS = 5;
const MOBILE_HAPTIC_COOLDOWN_MS = 150;

let mobileHapticsEnabledCache = null;
let lastHapticAt = -Infinity;

function canUseWindow() {
  return typeof window !== "undefined";
}

function canUseNavigator() {
  return typeof navigator !== "undefined";
}

function detectMobileHapticsSupport() {
  if (mobileHapticsEnabledCache != null) {
    return mobileHapticsEnabledCache;
  }

  if (!canUseWindow() || !canUseNavigator()) {
    mobileHapticsEnabledCache = false;
    return mobileHapticsEnabledCache;
  }

  const hasTouch =
    navigator.maxTouchPoints > 0 ||
    "ontouchstart" in window;
  const hasCoarsePointer =
    window.matchMedia?.("(pointer: coarse)")?.matches ||
    window.matchMedia?.("(any-pointer: coarse)")?.matches ||
    false;

  mobileHapticsEnabledCache = Boolean(hasTouch || hasCoarsePointer);
  return mobileHapticsEnabledCache;
}

export function canTriggerMobileHaptics() {
  return detectMobileHapticsSupport();
}

export function triggerMobileHaptic(type) {
  if (type !== "collision") {
    return false;
  }

  if (!detectMobileHapticsSupport()) {
    return false;
  }

  const now =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  if (now - lastHapticAt < MOBILE_HAPTIC_COOLDOWN_MS) {
    return false;
  }

  try {
    const didVibrate = navigator.vibrate?.(COLLISION_HAPTIC_DURATION_MS);
    if (!didVibrate) {
      return false;
    }
  } catch {
    return false;
  }

  lastHapticAt = now;
  return true;
}
