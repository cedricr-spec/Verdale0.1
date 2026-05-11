export const EQUIPMENT_IDLE_BOB_FRAMES = [-1, 0, 0, 0, 0, -1, -1, -1]
export const EQUIPMENT_RUN_BOB_FRAMES = [0, -2, 0]
export const EQUIPMENT_HIDDEN_ANIMATION_STATES = new Set(["dead", "death"])

const DEFAULT_EQUIPMENT_ACTION_DURATION_MS = 340
const DEFAULT_EQUIPMENT_HOLD_ORIGIN = { x: 0.18, y: 0.86 }

const ACTION_PROFILE_KEYS_BY_TYPE = {
  chop: "axe",
  mine: "pickaxe",
  dig: "shovel",
  till: "hoe",
  water: "watering_can",
  attack: "weapon",
}

const EQUIPMENT_ACTION_PROFILES = {
  axe: {
    durationMs: 360,
    origin: DEFAULT_EQUIPMENT_HOLD_ORIGIN,
    facing: {
      left: {
        mirrorX: true,
        rotationMultiplier: 1,
      },
      right: {
        mirrorX: true,
        rotationMultiplier: 1,
      },
    },
    keyframes: [
      { t: 0, x: 0, y: 0, bob: 0, rotation: 0 },
      { t: 0.18, x: -2, y: 0, bob: -1, rotation: -14 },
      { t: 0.45, x: 2, y: -4, bob: -6, rotation: 28 },
      { t: 0.68, x: 6, y: -7, bob: -3, rotation: 76 },
      { t: 0.86, x: 2, y: -1, bob: 0, rotation: 18 },
      { t: 1, x: 0, y: 0, bob: 0, rotation: 0 },
    ],
  },
  pickaxe: {
    durationMs: 350,
    origin: DEFAULT_EQUIPMENT_HOLD_ORIGIN,
    facing: {
      left: {
        mirrorX: true,
        rotationMultiplier: 1,
      },
      right: {
        mirrorX: true,
        rotationMultiplier: 1,
      },
    },
    keyframes: [
      { t: 0, x: 0, y: 0, bob: 0, rotation: 0 },
      { t: 0.16, x: -2, y: 0, bob: -1, rotation: -16 },
      { t: 0.42, x: 1, y: -4, bob: -6, rotation: 22 },
      { t: 0.66, x: 5, y: -8, bob: -2, rotation: 62 },
      { t: 0.84, x: 1, y: -2, bob: 0, rotation: 18 },
      { t: 1, x: 0, y: 0, bob: 0, rotation: 0 },
    ],
  },
  shovel: {
    durationMs: 330,
    origin: DEFAULT_EQUIPMENT_HOLD_ORIGIN,
    facing: {
      left: {
        mirrorX: true,
        rotationMultiplier: 1,
      },
      right: {
        mirrorX: true,
        rotationMultiplier: 1,
      },
    },
    keyframes: [
      { t: 0, x: 0, y: 0, bob: 0, rotation: 0 },
      { t: 0.2, x: -1, y: 0, bob: -1, rotation: -8 },
      { t: 0.5, x: 2, y: -3, bob: -4, rotation: 18 },
      { t: 0.76, x: 5, y: -5, bob: -2, rotation: 44 },
      { t: 0.9, x: 1, y: 0, bob: 0, rotation: 12 },
      { t: 1, x: 0, y: 0, bob: 0, rotation: 0 },
    ],
  },
  hoe: {
    durationMs: 320,
    origin: DEFAULT_EQUIPMENT_HOLD_ORIGIN,
    facing: {
      left: {
        mirrorX: true,
        rotationMultiplier: 1,
      },
      right: {
        mirrorX: true,
        rotationMultiplier: 1,
      },
    },
    keyframes: [
      { t: 0, x: 0, y: 0, bob: 0, rotation: 0 },
      { t: 0.22, x: -1, y: 0, bob: -1, rotation: -10 },
      { t: 0.48, x: 2, y: -2, bob: -4, rotation: 18 },
      { t: 0.74, x: 4, y: -4, bob: -2, rotation: 38 },
      { t: 0.9, x: 1, y: 0, bob: 0, rotation: 10 },
      { t: 1, x: 0, y: 0, bob: 0, rotation: 0 },
    ],
  },
  watering_can: {
    durationMs: 360,
    origin: { x: 0.2, y: 0.82 },
    facing: {
      left: {
        mirrorX: true,
        rotationMultiplier: 1,
      },
      right: {
        mirrorX: true,
        rotationMultiplier: 1,
      },
    },
    keyframes: [
      { t: 0, x: 0, y: 0, bob: 0, rotation: 0 },
      { t: 0.22, x: 0, y: -1, bob: -1, rotation: -4 },
      { t: 0.52, x: 3, y: -3, bob: -2, rotation: 12 },
      { t: 0.78, x: 5, y: -2, bob: 0, rotation: 24 },
      { t: 0.92, x: 1, y: 0, bob: 0, rotation: 10 },
      { t: 1, x: 0, y: 0, bob: 0, rotation: 0 },
    ],
  },
  weapon: {
    durationMs: 320,
    origin: DEFAULT_EQUIPMENT_HOLD_ORIGIN,
    facing: {
      left: {
        mirrorX: true,
        rotationMultiplier: 1,
      },
      right: {
        mirrorX: true,
        rotationMultiplier: 1,
      },
    },
    keyframes: [
      { t: 0, x: 0, y: 0, bob: 0, rotation: 0 },
      { t: 0.16, x: -2, y: 0, bob: -1, rotation: -18 },
      { t: 0.4, x: 1, y: -4, bob: -6, rotation: 20 },
      { t: 0.62, x: 8, y: -7, bob: -2, rotation: 88 },
      { t: 0.84, x: 2, y: -1, bob: 0, rotation: 26 },
      { t: 1, x: 0, y: 0, bob: 0, rotation: 0 },
    ],
  },
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function lerp(start, end, amount) {
  return start + (end - start) * amount
}

function smoothstep(amount) {
  return amount * amount * (3 - 2 * amount)
}

function getActionProfileKey(actionType, animationSet = null) {
  if (animationSet && EQUIPMENT_ACTION_PROFILES[animationSet]) {
    return animationSet
  }

  return ACTION_PROFILE_KEYS_BY_TYPE[actionType] || "weapon"
}

function getActionProfile(actionType, animationSet = null) {
  return (
    EQUIPMENT_ACTION_PROFILES[getActionProfileKey(actionType, animationSet)] ||
    EQUIPMENT_ACTION_PROFILES.weapon
  )
}

function interpolateKeyframes(keyframes = [], progress = 0) {
  if (!Array.isArray(keyframes) || keyframes.length === 0) {
    return { x: 0, y: 0, bob: 0, rotation: 0 }
  }

  if (keyframes.length === 1) {
    return keyframes[0]
  }

  const clampedProgress = clamp(progress, 0, 1)

  for (let index = 1; index < keyframes.length; index += 1) {
    const previous = keyframes[index - 1]
    const next = keyframes[index]

    if (clampedProgress > next.t && index < keyframes.length - 1) {
      continue
    }

    const segmentSpan = Math.max(0.0001, next.t - previous.t)
    const segmentProgress = smoothstep(
      clamp((clampedProgress - previous.t) / segmentSpan, 0, 1)
    )

    return {
      x: lerp(previous.x || 0, next.x || 0, segmentProgress),
      y: lerp(previous.y || 0, next.y || 0, segmentProgress),
      bob: lerp(previous.bob || 0, next.bob || 0, segmentProgress),
      rotation: lerp(previous.rotation || 0, next.rotation || 0, segmentProgress),
    }
  }

  const last = keyframes[keyframes.length - 1]
  return {
    x: last.x || 0,
    y: last.y || 0,
    bob: last.bob || 0,
    rotation: last.rotation || 0,
  }
}

export function getEquipmentHoldTransform(animationSet = null, facing = "right") {
  const profile = getActionProfile(null, animationSet)
  const origin = profile?.origin || DEFAULT_EQUIPMENT_HOLD_ORIGIN

  return {
    originX: facing === "left" ? 1 - origin.x : origin.x,
    originY: origin.y,
  }
}

export function getEquipmentActionDuration(actionType, animationSet = null) {
  return getActionProfile(actionType, animationSet)?.durationMs || DEFAULT_EQUIPMENT_ACTION_DURATION_MS
}

export function getEquipmentActionPose({
  actionType,
  animationSet = null,
  progress = 0,
  facing = "right",
}) {
  if (!actionType) {
    return { x: 0, y: 0, bob: 0, rotation: 0 }
  }

  const profile = getActionProfile(actionType, animationSet)
  const facingProfile = profile?.facing?.[facing] || {}
  const pose = interpolateKeyframes(profile?.keyframes, progress)
  const shouldMirrorX = facingProfile.mirrorX !== false && facing === "left"
  const x = (pose.x || 0) * (shouldMirrorX ? -1 : 1)

  return {
    x: x + (facingProfile.offsetX || 0),
    y: (pose.y || 0) + (facingProfile.offsetY || 0),
    bob: (pose.bob || 0) + (facingProfile.bobOffset || 0),
    rotation:
      (pose.rotation || 0) * (facingProfile.rotationMultiplier ?? 1) +
      (facingProfile.rotationOffset || 0),
  }
}
