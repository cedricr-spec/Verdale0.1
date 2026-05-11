import {
  MERCHANT_NPC_SPRITESHEET_ASSET,
  NPC_BASIC_SPRITESHEET_ASSET,
  NPC_EMOJI_REACTIONS_ASSET,
} from './assetManifest';

export const DEBUG_NPCS = false;
export const NPC_WORLD_SCALE = 2;
export const NPC_FRAME_SIZE = 24;
export const NPC_GOOFY_CRASH_SPEED = 180;
export const TEST_NPC_DOORS_FAST = false;
// Keep NPC blocking focused on the feet/lower body so the player can visually
// pass "behind" the upper part of an NPC without hitting an invisible tall box.
export const NPC_COLLISION_WIDTH = 12;
export const NPC_COLLISION_HEIGHT = 10;
export const NPC_COLLISION_OFFSET_X = 6;
export const NPC_COLLISION_OFFSET_Y = 14;
export const NPC_DOOR_USE_CHANCE = TEST_NPC_DOORS_FAST ? 1 : 0.7;
export const NPC_INSIDE_MIN_MS = TEST_NPC_DOORS_FAST ? 4000 : 5400;
export const NPC_INSIDE_MAX_MS = TEST_NPC_DOORS_FAST ? 7000 : 10800;
export const NPC_DOOR_ENTRY_REACH_DISTANCE = 4;
export const NPC_DOOR_FADE_MS = 520;
export const NPC_DOOR_FLICKER_INTERVAL_MS = 70;
export const NPC_DOOR_COOLDOWN_MIN_MS = TEST_NPC_DOORS_FAST ? 5000 : 45000;
export const NPC_DOOR_COOLDOWN_MAX_MS = TEST_NPC_DOORS_FAST ? 10000 : 90000;
export const NPC_DOOR_EXIT_WALK_AWAY_MIN_PX = 24;
export const NPC_DOOR_EXIT_WALK_AWAY_MAX_PX = 48;
export const NPC_DISCUSSION_CHANCE = 0.5;
export const NPC_DISCUSSION_TRIO_CHANCE = 0.5;
export const NPC_DISCUSSION_MIN_DURATION_MS = 45000;
export const NPC_DISCUSSION_MAX_DURATION_MS = 120000;
export const NPC_DISCUSSION_EMOJI_CHANCE = 0.8;
export const NPC_DISCUSSION_ITEM_CHANCE = 0.2;
export const NPC_DISCUSSION_EMOJI_FRAME_COUNT = 96;
export const NPC_DISCUSSION_COOLDOWN_MS = 30000;
export const NPC_DISCUSSION_MAX_DISTANCE = 96;
export const NPC_DISCUSSION_MEETING_DISTANCE = 20;
export const NPC_DISCUSSION_SIT_CHANCE = 0.35;
export const NPC_DISCUSSION_SIT_SYNC_DELAY_MS = 900;
export const NPC_DISCUSSION_BUBBLE_INTERVAL_MIN_MS = 1100;
export const NPC_DISCUSSION_BUBBLE_INTERVAL_MAX_MS = 2200;
export const NPC_DISCUSSION_BUBBLE_DURATION_MS = 1400;
export const NPC_SPEECH_BUBBLE_OFFSET_X = 0;
export const NPC_SPEECH_BUBBLE_OFFSET_Y = -54;
export const NPC_DISCUSSION_EXIT_DELAY_MS = 900;
export const NPC_SLEEP_BUBBLE_OFFSET_X = -8;
export const NPC_SLEEP_BUBBLE_OFFSET_Y = -32;
export const NPC_SLEEP_BUBBLE_SCALE = 2;
export const NPC_SLEEP_BUBBLE_FPS = 4;
export const NPC_SLEEP_BUBBLE_FRAME_COUNT = 5;
export const NPC_SLEEP_CLEARANCE_RADIUS_PX = 32;
export const NPC_SLEEP_MIN_FREE_DIRECTIONS = 3;
export const NPC_SLEEP_MIN_DURATION_MS = 30000;
export const NPC_SLEEP_MAX_DURATION_MS = 90000;
export const NPC_PUSH_COOLDOWN_MS = 500;
export const NPC_PUSH_CONTACT_SUSTAIN_MS = 110;
export const NPC_PUSH_DISTANCE_MIN_PX = 6;
export const NPC_PUSH_DISTANCE_MAX_PX = 12;
export const NPC_PUSH_RECOIL_SPEED = 108;
export const NPC_PUSH_RECOIL_TIMEOUT_MS = 220;
export const NPC_PUSH_REACTION_DURATION_MS = 320;
export const NPC_PUSH_BUBBLE_DURATION_MS = Object.freeze({
  min: 1000,
  max: 1800,
});
export const NPC_PUSH_IRRITATION_WINDOW_MS = 6000;
export const NPC_PUSH_IRRITATION_THRESHOLD = 4;
export const NPC_PUSH_FLEE_SPEED = 154;
export const NPC_PUSH_FLEE_DISTANCE_MIN_PX = 72;
export const NPC_PUSH_FLEE_DISTANCE_MAX_PX = 128;
export const NPC_PUSH_FLEE_TIMEOUT_MS = 1350;
export const NPC_PUSH_AGGRESSION_SPEED = 132;
export const NPC_PUSH_AGGRESSION_RUSH_MS = 650;
export const NPC_PUSH_AGGRESSION_COLLISION_MS = 280;
export const NPC_PUSH_AGGRESSION_COOLDOWN_MS = 900;
export const PLAYER_PUSH_BOUNCE_DISTANCE_MIN_PX = 4;
export const PLAYER_PUSH_BOUNCE_DISTANCE_MAX_PX = 8;
export const PLAYER_PUSH_BOUNCE_DURATION_MS = Object.freeze({
  min: 100,
  max: 180,
});
export const NPC_FOOTPRINT = Object.freeze({
  width: NPC_COLLISION_WIDTH,
  height: NPC_COLLISION_HEIGHT,
});
export const NPC_TEST_COUNT = 15;

export const NPC_ANIMATION_CONFIG = Object.freeze({
  idle: { x: 0, y: 0, frames: 8, fps: 6, loop: true },
  run: { x: 0, y: 24, frames: 3, fps: 4, loop: true },
  jump: { x: 72, y: 24, frames: 1, fps: 1, loop: false },
  death: {
    x: 0,
    y: 48,
    frames: 9,
    fps: 8,
    loop: false,
    holdLastFrame: true,
  },
  dead: { x: 192, y: 48, frames: 1, fps: 1, loop: false },
  hurt: { x: 0, y: 72, frames: 1, fps: 1, loop: false },
  sleep: { x: 72, y: 72, frames: 4, fps: 2, loop: true },
  sit: {
    x: 0,
    y: 96,
    frames: 2,
    fps: 1,
    loop: true,
    frameDelayMs: 3000,
  },
  wake: { x: 72, y: 96, frames: 3, fps: 6, loop: false },
});

export const NPC_ANIMATION_KEYS = Object.freeze({
  idle: 'npc_basic_idle',
  run: 'npc_basic_run',
  jump: 'npc_basic_jump',
  death: 'npc_basic_death',
  dead: 'npc_basic_dead',
  hurt: 'npc_basic_hurt',
  sleep: 'npc_basic_sleep',
  sit: 'npc_basic_sit',
  wake: 'npc_basic_wake',
  wakeReverse: 'npc_basic_wake_reverse',
});

export const NPC_TEST_TINTS = Object.freeze([
  0xf97316,
  0x22c55e,
  0x38bdf8,
  0xfacc15,
  0xf472b6,
  0xa78bfa,
  0xfb7185,
  0x34d399,
  0xf59e0b,
  0x60a5fa,
  0xe879f9,
  0x2dd4bf,
]);

export const NPC_BEHAVIOR_CONFIG = Object.freeze({
  wanderSpeed: 36,
  goofyRunSpeed: NPC_GOOFY_CRASH_SPEED,
  wakeInteractionRadius: 64,
  doorUseRadius: 160,
  doorUseChance: NPC_DOOR_USE_CHANCE,
  wanderRadius: 64,
  villageMargin: 56,
  spawnAttempts: 40,
  spawnSpacing: 30,
  idleDurationMs: Object.freeze({ min: 900, max: 2200 }),
  wanderDurationMs: Object.freeze({ min: 1400, max: 3200 }),
  sitDurationMs: Object.freeze({ min: 2400, max: 4200 }),
  sleepDurationMs: Object.freeze({
    min: NPC_SLEEP_MIN_DURATION_MS,
    max: NPC_SLEEP_MAX_DURATION_MS,
  }),
  doorEnterTimeoutMs: 2200,
  doorInsideDurationMs: Object.freeze({
    min: NPC_INSIDE_MIN_MS,
    max: NPC_INSIDE_MAX_MS,
  }),
  doorEntryReachDistance: NPC_DOOR_ENTRY_REACH_DISTANCE,
  doorFadeMs: NPC_DOOR_FADE_MS,
  doorFlickerIntervalMs: NPC_DOOR_FLICKER_INTERVAL_MS,
  doorCooldownMs: Object.freeze({
    min: NPC_DOOR_COOLDOWN_MIN_MS,
    max: NPC_DOOR_COOLDOWN_MAX_MS,
  }),
  discussionChance: NPC_DISCUSSION_CHANCE,
  discussionTrioChance: NPC_DISCUSSION_TRIO_CHANCE,
  discussionDurationMs: Object.freeze({
    min: NPC_DISCUSSION_MIN_DURATION_MS,
    max: NPC_DISCUSSION_MAX_DURATION_MS,
  }),
  discussionCooldownMs: NPC_DISCUSSION_COOLDOWN_MS,
  discussionMaxDistance: NPC_DISCUSSION_MAX_DISTANCE,
  discussionMeetingDistance: NPC_DISCUSSION_MEETING_DISTANCE,
  discussionSitChance: NPC_DISCUSSION_SIT_CHANCE,
  discussionSitSyncDelayMs: NPC_DISCUSSION_SIT_SYNC_DELAY_MS,
  sleepClearanceRadiusPx: NPC_SLEEP_CLEARANCE_RADIUS_PX,
  sleepMinFreeDirections: NPC_SLEEP_MIN_FREE_DIRECTIONS,
  discussionBubbleIntervalMs: Object.freeze({
    min: NPC_DISCUSSION_BUBBLE_INTERVAL_MIN_MS,
    max: NPC_DISCUSSION_BUBBLE_INTERVAL_MAX_MS,
  }),
  discussionBubbleDurationMs: NPC_DISCUSSION_BUBBLE_DURATION_MS,
  discussionExitDelayMs: NPC_DISCUSSION_EXIT_DELAY_MS,
  speechBubbleOffsetX: NPC_SPEECH_BUBBLE_OFFSET_X,
  speechBubbleOffsetY: NPC_SPEECH_BUBBLE_OFFSET_Y,
  doorExitWalkAwayPx: Object.freeze({
    min: NPC_DOOR_EXIT_WALK_AWAY_MIN_PX,
    max: NPC_DOOR_EXIT_WALK_AWAY_MAX_PX,
  }),
  doorExitTimeoutMs: 2200,
  lookAroundIntervalMs: Object.freeze({ min: 1400, max: 2800 }),
  wakeRetryDelayMs: Object.freeze({ min: 4000, max: 8000 }),
  actionWeights: Object.freeze({
    idle: TEST_NPC_DOORS_FAST ? 8 : 25,
    wander: TEST_NPC_DOORS_FAST ? 38 : 66,
    sit: 6,
    discussion: 28,
    door: TEST_NPC_DOORS_FAST ? 140 : 50,
    sleep: 0.65,
    goofy: 0.5,
  }),
  sleepWakeChance: 0.08,
});

function getEmojiReactionColumns() {
  return Math.floor(
    64 / Math.max(1, NPC_EMOJI_REACTIONS_ASSET.frameWidth)
  );
}

function getEmojiReactionFrameIndex(x, y) {
  const columns = getEmojiReactionColumns();
  const col = Math.floor(x / NPC_EMOJI_REACTIONS_ASSET.frameWidth);
  const row = Math.floor(y / NPC_EMOJI_REACTIONS_ASSET.frameHeight);
  return row * columns + col;
}

function createPushReactionEmoji(mood, x, y) {
  return Object.freeze({
    mood,
    x,
    y,
    frameIndex: getEmojiReactionFrameIndex(x, y),
  });
}

export const PUSH_REACTION_EMOJIS = Object.freeze([
  createPushReactionEmoji('angry', 48, 96),
  createPushReactionEmoji('angry', 16, 112),
  createPushReactionEmoji('angry', 0, 160),
  createPushReactionEmoji('angry', 0, 272),
  createPushReactionEmoji('sad', 16, 208),
  createPushReactionEmoji('sad', 16, 240),
  createPushReactionEmoji('sad', 32, 48),
  createPushReactionEmoji('shock', 0, 208),
  createPushReactionEmoji('shock', 48, 176),
]);

export const PUSH_REACTION_ANGRY_EMOJIS = Object.freeze(
  PUSH_REACTION_EMOJIS.filter((reaction) => reaction.mood === 'angry')
);

function getSpritesheetColumns() {
  return Math.floor(
    216 / Math.max(1, NPC_BASIC_SPRITESHEET_ASSET.frameWidth)
  );
}

function getFrameIndex(x, y) {
  const columns = getSpritesheetColumns();
  const col = Math.floor(x / NPC_BASIC_SPRITESHEET_ASSET.frameWidth);
  const row = Math.floor(y / NPC_BASIC_SPRITESHEET_ASSET.frameHeight);
  return row * columns + col;
}

function createAnimationFramesForTexture(
  textureKey,
  animationId,
  { reverse = false } = {}
) {
  const definition = NPC_ANIMATION_CONFIG[animationId];
  if (!definition) {
    return [];
  }

  const startFrame = getFrameIndex(definition.x, definition.y);
  const frames = Array.from({ length: definition.frames }, (_, index) => {
    const frameIndex = startFrame + index;
    const baseFrame = {
      key: textureKey,
      frame: frameIndex,
    };

    if (definition.frameDelayMs) {
      return {
        ...baseFrame,
        duration: definition.frameDelayMs,
      };
    }

    return baseFrame;
  });

  return reverse ? frames.slice().reverse() : frames;
}

function createAnimationFrames(animationId, { reverse = false } = {}) {
  return createAnimationFramesForTexture(
    NPC_BASIC_SPRITESHEET_ASSET.key,
    animationId,
    { reverse }
  );
}

function createAnimationDefinition(animationId, key, { reverse = false } = {}) {
  const definition = NPC_ANIMATION_CONFIG[animationId];
  return {
    key,
    frames: createAnimationFrames(animationId, { reverse }),
    frameRate: Math.max(1, definition?.fps || 1),
    repeat: definition?.loop ? -1 : 0,
    yoyo: false,
    showOnStart: true,
    hideOnComplete: false,
  };
}

export function getMerchantIdleAnimationKey(textureKey) {
  return textureKey === MERCHANT_NPC_SPRITESHEET_ASSET.key
    ? 'merchant_idle'
    : `${textureKey}_idle`;
}

export function ensureMerchantIdleAnimation(scene, textureKey) {
  if (!scene?.anims || !scene?.textures?.exists?.(textureKey)) {
    return false;
  }

  const animationKey = getMerchantIdleAnimationKey(textureKey);
  if (scene.anims.exists(animationKey)) {
    return true;
  }

  scene.anims.create({
    key: animationKey,
    frames: createAnimationFramesForTexture(textureKey, 'idle'),
    frameRate: Math.max(1, NPC_ANIMATION_CONFIG.idle?.fps || 1),
    repeat: -1,
    yoyo: false,
    showOnStart: true,
    hideOnComplete: false,
  });

  return true;
}

export function registerNpcAnimations(scene) {
  if (!scene?.anims) {
    return;
  }

  const animationEntries = [
    ['idle', NPC_ANIMATION_KEYS.idle],
    ['run', NPC_ANIMATION_KEYS.run],
    ['jump', NPC_ANIMATION_KEYS.jump],
    ['death', NPC_ANIMATION_KEYS.death],
    ['dead', NPC_ANIMATION_KEYS.dead],
    ['hurt', NPC_ANIMATION_KEYS.hurt],
    ['sleep', NPC_ANIMATION_KEYS.sleep],
    ['sit', NPC_ANIMATION_KEYS.sit],
    ['wake', NPC_ANIMATION_KEYS.wake],
  ];

  animationEntries.forEach(([animationId, animationKey]) => {
    if (scene.anims.exists(animationKey)) {
      return;
    }

    scene.anims.create(createAnimationDefinition(animationId, animationKey));
  });

  if (!scene.anims.exists(NPC_ANIMATION_KEYS.wakeReverse)) {
    scene.anims.create(
      createAnimationDefinition('wake', NPC_ANIMATION_KEYS.wakeReverse, {
        reverse: true,
      })
    );
  }

  ensureMerchantIdleAnimation(scene, MERCHANT_NPC_SPRITESHEET_ASSET.key);
}

export function getNpcAnimationDurationMs(animationId) {
  const definition = NPC_ANIMATION_CONFIG[animationId];
  if (!definition) {
    return 0;
  }

  if (definition.frameDelayMs) {
    return definition.frameDelayMs * Math.max(1, definition.frames);
  }

  const frameDurationMs = 1000 / Math.max(1, definition.fps || 1);
  return frameDurationMs * Math.max(1, definition.frames);
}
