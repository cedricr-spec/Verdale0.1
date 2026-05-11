import Phaser from 'phaser';
import { setMovementLocked, useWorldStore } from '../store/worldSlice';
import {
  CHARACTER_SHADOW_ASSET,
  MERCHANT_NPC_SPRITESHEET_ASSET,
  NPC_BASIC_SPRITESHEET_ASSET,
  NPC_SPEECH_BUBBLE_ASSET,
  NPC_SLEEP_BUBBLES_ASSET,
  NPC_EMOJI_REACTIONS_ASSET,
  getMerchantNpcSpritesheetAsset,
} from './assetManifest';
import {
  NPC_COLLISION_HEIGHT,
  NPC_COLLISION_OFFSET_X,
  NPC_COLLISION_OFFSET_Y,
  NPC_COLLISION_WIDTH,
  DEBUG_NPCS,
  TEST_NPC_DOORS_FAST,
  NPC_DISCUSSION_BUBBLE_DURATION_MS,
  NPC_DISCUSSION_BUBBLE_INTERVAL_MAX_MS,
  NPC_DISCUSSION_BUBBLE_INTERVAL_MIN_MS,
  NPC_DISCUSSION_CHANCE,
  NPC_DISCUSSION_COOLDOWN_MS,
  NPC_DISCUSSION_EXIT_DELAY_MS,
  NPC_DISCUSSION_MAX_DISTANCE,
  NPC_DISCUSSION_MAX_DURATION_MS,
  NPC_DISCUSSION_MEETING_DISTANCE,
  NPC_DISCUSSION_MIN_DURATION_MS,
  NPC_DISCUSSION_SIT_CHANCE,
  NPC_DISCUSSION_SIT_SYNC_DELAY_MS,
  NPC_DISCUSSION_TRIO_CHANCE,
  NPC_DISCUSSION_EMOJI_CHANCE,
  NPC_DISCUSSION_EMOJI_FRAME_COUNT,
  NPC_DOOR_USE_CHANCE,
  NPC_ANIMATION_KEYS,
  NPC_BEHAVIOR_CONFIG,
  NPC_FRAME_SIZE,
  NPC_GOOFY_CRASH_SPEED,
  NPC_DOOR_COOLDOWN_MAX_MS,
  NPC_DOOR_COOLDOWN_MIN_MS,
  NPC_DOOR_FADE_MS,
  NPC_DOOR_FLICKER_INTERVAL_MS,
  NPC_DOOR_ENTRY_REACH_DISTANCE,
  NPC_DOOR_EXIT_WALK_AWAY_MAX_PX,
  NPC_DOOR_EXIT_WALK_AWAY_MIN_PX,
  NPC_INSIDE_MAX_MS,
  NPC_INSIDE_MIN_MS,
  NPC_PUSH_AGGRESSION_COLLISION_MS,
  NPC_PUSH_AGGRESSION_COOLDOWN_MS,
  NPC_PUSH_AGGRESSION_RUSH_MS,
  NPC_PUSH_AGGRESSION_SPEED,
  NPC_PUSH_BUBBLE_DURATION_MS,
  NPC_PUSH_CONTACT_SUSTAIN_MS,
  NPC_PUSH_COOLDOWN_MS,
  NPC_PUSH_DISTANCE_MAX_PX,
  NPC_PUSH_DISTANCE_MIN_PX,
  NPC_PUSH_FLEE_DISTANCE_MAX_PX,
  NPC_PUSH_FLEE_DISTANCE_MIN_PX,
  NPC_PUSH_FLEE_SPEED,
  NPC_PUSH_FLEE_TIMEOUT_MS,
  NPC_PUSH_IRRITATION_THRESHOLD,
  NPC_PUSH_IRRITATION_WINDOW_MS,
  NPC_PUSH_REACTION_DURATION_MS,
  NPC_PUSH_RECOIL_SPEED,
  NPC_PUSH_RECOIL_TIMEOUT_MS,
  PLAYER_PUSH_BOUNCE_DISTANCE_MAX_PX,
  PLAYER_PUSH_BOUNCE_DISTANCE_MIN_PX,
  PLAYER_PUSH_BOUNCE_DURATION_MS,
  NPC_SLEEP_BUBBLE_FPS,
  NPC_SLEEP_BUBBLE_FRAME_COUNT,
  NPC_SLEEP_BUBBLE_OFFSET_X,
  NPC_SLEEP_BUBBLE_OFFSET_Y,
  NPC_SLEEP_BUBBLE_SCALE,
  NPC_SLEEP_CLEARANCE_RADIUS_PX,
  NPC_SLEEP_MIN_FREE_DIRECTIONS,
  NPC_SPEECH_BUBBLE_OFFSET_X,
  NPC_SPEECH_BUBBLE_OFFSET_Y,
  NPC_TEST_COUNT,
  NPC_TEST_TINTS,
  NPC_WORLD_SCALE,
  PUSH_REACTION_ANGRY_EMOJIS,
  PUSH_REACTION_EMOJIS,
  ensureMerchantIdleAnimation,
  getMerchantIdleAnimationKey,
  getNpcAnimationDurationMs,
  registerNpcAnimations,
} from './npcConfig';
import { ITEMS_REGISTRY } from '../config/itemsRegistry';
import {
  DEBUG_VILLAGE_DOORS,
  VILLAGE_WORLD_TILE_SIZE,
  WORLD_VILLAGE_INSTANCES,
  getVillageCollisionRects,
  getVillageInstanceBounds,
  getVillageMerchantSpawns,
  isRectBlockedByVillage,
} from '../utils/worldVillage';
import {
  getWorldAtlasCollisionBounds,
  getWorldAtlasCollisionObjects,
  isWorldTerrainBoundsWalkable,
} from '../utils/worldAtlasFamilies';
import { WORLD_ATLAS_DATA } from '../utils/worldAtlasData';
import {
  getPetCollisionBounds,
  setNpcCollisionContactHandler,
  setNpcCollisionResolver,
} from '../systems/CollisionSystem';
import {
  CHARACTER_SHADOW_DEPTH,
  ENTITY_SORT_BASE_DEPTH,
  FIXED_MERCHANT_DEPTH,
  NPC_SPEECH_BUBBLE_DEPTH,
  NPC_SLEEP_BUBBLE_DEPTH,
  getEntityDepthFromFeetY,
} from './renderDepths';

const NPC_DEPTH = ENTITY_SORT_BASE_DEPTH;
const NPC_SHADOW_DEPTH = CHARACTER_SHADOW_DEPTH;
// NPCs this many pixels beyond the viewport edge are hidden without running the
// full sprite-sync logic.  They still receive AI/movement updates so behavior
// stays deterministic; only the Phaser property calls are skipped.
const NPC_VIEWPORT_CULL_MARGIN = 200;
const NPC_SHADOW_WIDTH = 18;
const NPC_SHADOW_HEIGHT = 8;
const NPC_WAKE_INTERACTION_KEY = 'f';
const NPC_COLLISION_STEP_PX = 4;
const NPC_SLEEP_BUBBLE_ANIMATION_KEY = 'npc_sleep_bubbles_loop';
const NPC_SPEECH_BUBBLE_SCALE = 3;
const NPC_SPEECH_ICON_DISPLAY_WIDTH = 32;
const NPC_SPEECH_ICON_DISPLAY_HEIGHT = 32;
const NPC_SPEECH_ICON_OFFSET_Y = -2;
const NPC_PUSH_CONTACT_GRACE_MS = 180;
const NPC_PUSH_DISTANCE_STEP_PX = 2;
const NPC_PLAYER_COLLISION_REACH_PX = 4;
const PLAYER_BOUNCE_STEP_PX = 2;

function getDiscussionTextureKey(url = '') {
  return `npc_discussion_${String(url).replace(/[^a-z0-9._-]/gi, '_')}`;
}

function getDeterministicTint(seed = '') {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return NPC_TEST_TINTS[hash % NPC_TEST_TINTS.length] || NPC_TEST_TINTS[0];
}

function getTextureFrame(texture, frameKey) {
  if (!texture) {
    return null;
  }

  return texture.get(frameKey) || texture.get(String(frameKey)) || null;
}

function getTextureDebugInfo(scene, textureKey) {
  const exists = scene?.textures?.exists?.(textureKey) || false;
  if (!exists) {
    return {
      exists: false,
      textureKey,
      frameCount: 0,
      frameWidth: 0,
      frameHeight: 0,
      sourceWidth: 0,
      sourceHeight: 0,
      hasFrame0: false,
      hasIdleFrames: false,
    };
  }

  const texture = scene.textures.get(textureKey);
  const frameNames = (texture?.getFrameNames?.() || []).filter(
    (name) => name !== '__BASE'
  );
  const frameZero = getTextureFrame(texture, 0);

  return {
    exists: true,
    textureKey,
    frameCount: frameNames.length,
    frameWidth: Number(frameZero?.width) || 0,
    frameHeight: Number(frameZero?.height) || 0,
    sourceWidth: Number(texture?.source?.[0]?.width) || 0,
    sourceHeight: Number(texture?.source?.[0]?.height) || 0,
    hasFrame0: Boolean(frameZero),
    hasIdleFrames: Array.from({ length: 8 }, (_, index) =>
      Boolean(getTextureFrame(texture, index))
    ).every(Boolean),
  };
}

function boundsOverlap(a, b) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

function getNpcBounds(x, y) {
  const frameWorldSize = NPC_FRAME_SIZE * NPC_WORLD_SCALE;
  const frameLeft = x - frameWorldSize * 0.5;
  const frameTop = y - frameWorldSize;
  const left = frameLeft + NPC_COLLISION_OFFSET_X * NPC_WORLD_SCALE;
  const top = frameTop + NPC_COLLISION_OFFSET_Y * NPC_WORLD_SCALE;

  return {
    left,
    right: left + NPC_COLLISION_WIDTH * NPC_WORLD_SCALE,
    top,
    bottom: top + NPC_COLLISION_HEIGHT * NPC_WORLD_SCALE,
  };
}

function getRectCenter(rect) {
  return {
    x: rect.left + rect.width * 0.5,
    y: rect.top + rect.height * 0.5,
  };
}

function clampToVillage(point, villageBounds) {
  if (!villageBounds) {
    return point;
  }

  const margin = NPC_BEHAVIOR_CONFIG.villageMargin;
  return {
    x: Phaser.Math.Clamp(point.x, villageBounds.left + margin, villageBounds.right - margin),
    y: Phaser.Math.Clamp(point.y, villageBounds.top + margin, villageBounds.bottom - margin),
  };
}

function randomBetween(min, max) {
  return Phaser.Math.FloatBetween(min, max);
}

function getRandomDuration(range) {
  return randomBetween(range.min, range.max);
}

function getRandomCooldownMs() {
  return randomBetween(NPC_DOOR_COOLDOWN_MIN_MS, NPC_DOOR_COOLDOWN_MAX_MS);
}

function getWeightedActionKey() {
  const weights = NPC_BEHAVIOR_CONFIG.actionWeights;
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight || 0), 0);
  let cursor = Math.random() * total;

  for (const [key, weight] of entries) {
    cursor -= Math.max(0, weight || 0);
    if (cursor <= 0) {
      return key;
    }
  }

  return 'idle';
}

function shouldLogNpcDoors() {
  return DEBUG_NPCS || DEBUG_VILLAGE_DOORS;
}

function isDiscussionMode(mode = '') {
  return String(mode).startsWith('discussion');
}

function isDoorMode(mode = '') {
  return String(mode).startsWith('door') || mode === 'inside';
}

function isPushMode(mode = '') {
  return (
    mode === 'push_recoil' ||
    mode === 'push_annoyed' ||
    mode === 'push_flee' ||
    mode === 'aggressive_charge' ||
    mode === 'aggressive_collision' ||
    mode === 'aggressive_cooldown'
  );
}

function getPushResumeMode(interruptedMode = '') {
  if (
    interruptedMode === 'wander' ||
    interruptedMode === 'goofy_run' ||
    interruptedMode === 'door_walk_away'
  ) {
    return 'wander';
  }

  if (interruptedMode === 'sit') {
    return 'sit';
  }

  return 'idle';
}

function normalizeVector(x, y) {
  const distance = Math.hypot(x, y);
  if (distance <= 0.001) {
    return { x: 0, y: 0, distance: 0 };
  }

  return {
    x: x / distance,
    y: y / distance,
    distance,
  };
}

export default class NPCManager {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.doorManager = options?.doorManager || null;
    this.npcs = [];
    this.villageBounds = getVillageInstanceBounds(WORLD_VILLAGE_INSTANCES[0] || null);
    this.discussionItemIds = this.buildDiscussionItemPool();
    this.discussionIconFrameCache = new Map();
    this.pendingWakeInteraction = false;
    this.playerBounce = null;
    this.handleKeyDown = this.handleKeyDown.bind(this);

    registerNpcAnimations(scene);
    this.ensureBaseTextureReady();
    this.ensureSleepBubbleAnimationReady();
    this.ensureDiscussionTexturesReady();
    this.spawnTestNpcs();
    this.setupCollisionResolver();
    this.setupDebugGraphics();

    window.addEventListener('keydown', this.handleKeyDown);
  }

  ensureBaseTextureReady() {
    const texture = this.scene.textures.get(NPC_BASIC_SPRITESHEET_ASSET.key);
    texture?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
    const merchantTexture = this.scene.textures.get(MERCHANT_NPC_SPRITESHEET_ASSET.key);
    merchantTexture?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
    if (DEBUG_NPCS) {
      const info = getTextureDebugInfo(this.scene, MERCHANT_NPC_SPRITESHEET_ASSET.key);
      console.info('[Merchant] texture exists:', info.exists);
      console.info('[Merchant NPC] asset:', {
        merchantId: 'all_fixed_merchants',
        resolvedAssetPath: MERCHANT_NPC_SPRITESHEET_ASSET.url,
        textureKey: MERCHANT_NPC_SPRITESHEET_ASSET.key,
        textureExists: info.exists,
        frameCount: info.frameCount,
        frameWidth: info.frameWidth,
        frameHeight: info.frameHeight,
        sourceWidth: info.sourceWidth,
        sourceHeight: info.sourceHeight,
      });
    }
    this.scene.textures
      .get(NPC_SPEECH_BUBBLE_ASSET.key)
      ?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);

    if (
      DEBUG_NPCS &&
      typeof window !== 'undefined' &&
      !window.__NPC_BASIC_LOADED_LOGGED__
    ) {
      console.info('[NPC] Basic_NPC loaded');
      window.__NPC_BASIC_LOADED_LOGGED__ = true;
    }

    if (
      typeof window !== 'undefined' &&
      !window.__NPC_SINGLE_SPRITE_DEPTH_LOGGED__
    ) {
      console.info('[NPC] using single-sprite depth + adjusted collision box');
      window.__NPC_SINGLE_SPRITE_DEPTH_LOGGED__ = true;
    }
  }

  resolveMerchantSpriteConfig(merchantId) {
    const preferredAsset = getMerchantNpcSpritesheetAsset(merchantId);
    const preferredInfo = getTextureDebugInfo(this.scene, preferredAsset.key);
    const preferredAnimationKey = getMerchantIdleAnimationKey(preferredAsset.key);

    if (!preferredInfo.exists || !preferredInfo.hasFrame0) {
      const fallbackAsset = NPC_BASIC_SPRITESHEET_ASSET;
      const fallbackInfo = getTextureDebugInfo(this.scene, fallbackAsset.key);
      console.info('[Merchant] texture exists:', preferredInfo.exists);
      console.info('[Merchant] animation exists:', this.scene.anims.exists(preferredAnimationKey));
      console.info('[Merchant] using texture:', preferredAsset.key);
      console.info('[Merchant] using animation:', preferredAnimationKey);
      console.info('[Merchant] fallback:', true);
      console.warn(
        `[Merchant NPC] missing merchant texture/frame, falling back to Basic_NPC for ${merchantId || 'unknown_merchant'}.`,
        {
          merchantId,
          resolvedAssetPath: preferredAsset.url,
          preferredTextureKey: preferredAsset.key,
          preferredExists: preferredInfo.exists,
          preferredHasFrame0: preferredInfo.hasFrame0,
          fallbackTextureKey: fallbackAsset.key,
          fallbackExists: fallbackInfo.exists,
        }
      );
      return {
        asset: fallbackAsset,
        textureInfo: fallbackInfo,
        idleAnimationKey: NPC_ANIMATION_KEYS.idle,
        isStatic: false,
        usedFallback: true,
      };
    }

    const isStatic = preferredInfo.frameCount <= 1 || !preferredInfo.hasIdleFrames;
    if (!isStatic) {
      ensureMerchantIdleAnimation(this.scene, preferredAsset.key);
    } else if (DEBUG_NPCS) {
      console.warn(
        `[Merchant NPC] using static frame 0 for ${merchantId || 'unknown_merchant'} because idle frames are incomplete.`,
        {
          textureKey: preferredAsset.key,
          frameCount: preferredInfo.frameCount,
          hasIdleFrames: preferredInfo.hasIdleFrames,
        }
      );
    }

    console.info('[Merchant] texture exists:', preferredInfo.exists);
    console.info('[Merchant] animation exists:', this.scene.anims.exists(preferredAnimationKey));
    console.info('[Merchant] using texture:', preferredAsset.key);
    console.info('[Merchant] using animation:', isStatic ? 'frame_0_static' : preferredAnimationKey);
    console.info('[Merchant] fallback:', false);

    return {
      asset: preferredAsset,
      textureInfo: preferredInfo,
      idleAnimationKey: isStatic ? null : preferredAnimationKey,
      isStatic,
      usedFallback: false,
    };
  }

  ensureSleepBubbleAnimationReady() {
    if (!this.scene?.anims || this.scene.anims.exists(NPC_SLEEP_BUBBLE_ANIMATION_KEY)) {
      return;
    }

    if (!this.scene.textures.exists(NPC_SLEEP_BUBBLES_ASSET.key)) {
      return;
    }

    this.scene.anims.create({
      key: NPC_SLEEP_BUBBLE_ANIMATION_KEY,
      frames: this.scene.anims.generateFrameNumbers(NPC_SLEEP_BUBBLES_ASSET.key, {
        start: 0,
        end: Math.max(0, NPC_SLEEP_BUBBLE_FRAME_COUNT - 1),
      }),
      frameRate: NPC_SLEEP_BUBBLE_FPS,
      repeat: -1,
      yoyo: false,
      showOnStart: true,
      hideOnComplete: false,
    });
  }

  ensureDiscussionTexturesReady() {
    const sources = Array.from(
      new Set(
        this.discussionItemIds
          .map((itemId) => ITEMS_REGISTRY[itemId]?.atlasSource)
          .filter(Boolean)
      )
    );
    let queued = false;

    sources.forEach((source) => {
      const textureKey = getDiscussionTextureKey(source);
      if (this.scene.textures.exists(textureKey)) {
        this.scene.textures.get(textureKey)?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
        return;
      }
      this.scene.load.image(textureKey, source);
      queued = true;
    });

    if (queued) {
      this.scene.load.once('complete', () => {
        sources.forEach((source) => {
          this.scene.textures.get(getDiscussionTextureKey(source))?.setFilter?.(
            Phaser.Textures.FilterMode.NEAREST
          );
        });
      });
      this.scene.load.start();
    }
  }

  buildDiscussionItemPool() {
    return Object.values(ITEMS_REGISTRY)
      .filter((item) => item?.id && item?.atlasSource && item?.atlasRect)
      .map((item) => item.id);
  }

  logDoorEvent(label, doorId) {
    if (!shouldLogNpcDoors()) {
      return;
    }

    console.info(`[NPC Door] ${label}`, doorId);
  }

  logDiscussionEvent(label, ...payload) {
    if (!DEBUG_NPCS) {
      return;
    }

    console.info(`[NPC Discussion] ${label}`, ...payload);
  }

  logPushEvent(label, ...payload) {
    if (!DEBUG_NPCS) {
      return;
    }

    console.info(`[NPC Push] ${label}`, ...payload);
  }

  getPlayerWorldPosition() {
    const { worldOffset } = useWorldStore.getState();
    return {
      x: -(worldOffset?.x || 0),
      y: -(worldOffset?.y || 0),
    };
  }

  isPlayerBounceActive(now = this.scene.time.now) {
    return Boolean(
      this.playerBounce &&
      now < (this.playerBounce.endsAt || 0) &&
      (this.playerBounce.remainingDistance || 0) > 0.05
    );
  }

  endPlayerBounce() {
    if (!this.playerBounce) {
      return;
    }

    this.playerBounce = null;
    setMovementLocked(false);
  }

  startPlayerBounce(direction) {
    const bounceDirection = normalizeVector(direction?.x || 0, direction?.y || 0);
    if (bounceDirection.distance <= 0.001) {
      return;
    }

    const now = this.scene.time.now;
    const totalDistance = Phaser.Math.Between(
      PLAYER_PUSH_BOUNCE_DISTANCE_MIN_PX,
      PLAYER_PUSH_BOUNCE_DISTANCE_MAX_PX
    );
    const durationMs = Math.round(
      getRandomDuration(PLAYER_PUSH_BOUNCE_DURATION_MS)
    );

    this.playerBounce = {
      directionX: bounceDirection.x,
      directionY: bounceDirection.y,
      remainingDistance: totalDistance,
      speed: totalDistance / Math.max(0.001, durationMs / 1000),
      endsAt: now + durationMs,
    };
    setMovementLocked(true);
  }

  updatePlayerBounce(deltaSeconds, now = this.scene.time.now) {
    if (!this.playerBounce) {
      return;
    }

    if (now >= this.playerBounce.endsAt) {
      this.endPlayerBounce();
      return;
    }

    const step = Math.min(
      this.playerBounce.remainingDistance,
      this.playerBounce.speed * deltaSeconds
    );
    if (step <= 0.001) {
      this.endPlayerBounce();
      return;
    }

    let remainingStep = step;
    let movedDistance = 0;
    while (remainingStep > 0.001) {
      const substep = Math.min(PLAYER_BOUNCE_STEP_PX, remainingStep);
      const applied = useWorldStore.getState().nudgeWorld(
        this.playerBounce.directionX * substep,
        this.playerBounce.directionY * substep
      );
      const appliedDistance = Math.hypot(applied?.dx || 0, applied?.dy || 0);
      if (appliedDistance <= 0.001) {
        this.endPlayerBounce();
        return;
      }

      movedDistance += appliedDistance;
      remainingStep -= substep;

      if (appliedDistance + 0.001 < substep) {
        break;
      }
    }

    this.playerBounce.remainingDistance = Math.max(
      0,
      this.playerBounce.remainingDistance - movedDistance
    );
    if (this.playerBounce.remainingDistance <= 0.05) {
      this.endPlayerBounce();
    }
  }

  hidePushReactionBubble(npc) {
    if (!npc) {
      return;
    }

    npc.pushReactionBubbleVisibleUntil = 0;
    npc.pushReactionBubbleContent = null;
  }

  getActiveSpeechBubbleContent(npc, now = this.scene.time.now) {
    if (
      npc?.pushReactionBubbleVisibleUntil > now &&
      npc?.pushReactionBubbleContent
    ) {
      return npc.pushReactionBubbleContent;
    }

    if (
      npc?.discussionBubbleVisibleUntil > now &&
      npc?.discussionCurrentBubbleContent
    ) {
      return npc.discussionCurrentBubbleContent;
    }

    return null;
  }

  pickPushReactionEmoji({ angryOnly = false } = {}) {
    const pool = angryOnly ? PUSH_REACTION_ANGRY_EMOJIS : PUSH_REACTION_EMOJIS;
    return Phaser.Utils.Array.GetRandom(pool) || pool[0] || null;
  }

  showPushReactionBubble(npc, reaction, now = this.scene.time.now) {
    if (!npc || !reaction) {
      return null;
    }

    const durationMs = Math.round(getRandomDuration(NPC_PUSH_BUBBLE_DURATION_MS));
    npc.pushReactionBubbleContent = {
      type: 'emoji',
      frameIndex: reaction.frameIndex,
      mood: reaction.mood,
      source: 'push',
    };
    npc.pushReactionBubbleVisibleUntil = now + durationMs;
    this.logPushEvent(
      'selected emoji',
      npc.id,
      reaction.mood,
      reaction.frameIndex
    );
    return npc.pushReactionBubbleContent;
  }

  resetPushContact(npc) {
    if (!npc) {
      return;
    }

    npc.lastPushContactAt = 0;
    npc.pushContactStartedAt = 0;
    npc.pushContactHits = 0;
  }

  handleKeyDown(event) {
    if (event.repeat) {
      return;
    }

    if (event.key?.toLowerCase() === NPC_WAKE_INTERACTION_KEY) {
      this.pendingWakeInteraction = true;
    }
  }

  createNpcRecord({
    id,
    x,
    y,
    tint,
    isMerchant = false,
    merchantId = null,
    shopId = null,
    facing = null,
  }) {
    const spawnPoint = { x, y };
    const merchantSpriteConfig = isMerchant
      ? this.resolveMerchantSpriteConfig(merchantId)
      : null;
    const spriteAsset = merchantSpriteConfig?.asset || NPC_BASIC_SPRITESHEET_ASSET;
    const textureInfo =
      merchantSpriteConfig?.textureInfo ||
      getTextureDebugInfo(this.scene, spriteAsset.key);
    const merchantIdleAnimationKey = merchantSpriteConfig?.idleAnimationKey || null;
    const merchantIsStatic = Boolean(merchantSpriteConfig?.isStatic);
    const merchantUsedFallback = Boolean(merchantSpriteConfig?.usedFallback);

    const shadow = this.scene.add
      .image(0, 0, CHARACTER_SHADOW_ASSET.key)
      .setOrigin(0.5, 0.5)
      .setDepth(NPC_SHADOW_DEPTH)
      .setScrollFactor(0)
      .setAlpha(0.42);

    const sprite = this.scene.add
      .sprite(0, 0, spriteAsset.key, 0)
      .setOrigin(0.5, 1)
      .setScale(NPC_WORLD_SCALE)
      .setDepth(NPC_DEPTH)
      .setScrollFactor(0);

    if (!isMerchant && Number.isFinite(tint)) {
      sprite.setTint(tint);
    } else {
      sprite.clearTint();
    }

    const sleepBubble = this.scene.add
      .sprite(0, 0, NPC_SLEEP_BUBBLES_ASSET.key, 0)
      .setOrigin(0.5, 0.5)
      .setDepth(NPC_SLEEP_BUBBLE_DEPTH)
      .setScale(NPC_SLEEP_BUBBLE_SCALE)
      .setScrollFactor(0)
      .setVisible(false);

    const speechBubble = this.scene.add
      .image(0, 0, NPC_SPEECH_BUBBLE_ASSET.key)
      .setOrigin(0.5, 0.5)
      .setDepth(NPC_SPEECH_BUBBLE_DEPTH)
      .setScale(NPC_SPEECH_BUBBLE_SCALE)
      .setScrollFactor(0)
      .setVisible(false);

    const speechIcon = this.scene.add
      .image(0, 0, NPC_SPEECH_BUBBLE_ASSET.key)
      .setOrigin(0.5, 0.5)
      .setDepth(NPC_SPEECH_BUBBLE_DEPTH)
      .setScrollFactor(0)
      .setVisible(false);

    if (this.scene.anims.exists(NPC_SLEEP_BUBBLE_ANIMATION_KEY)) {
      sleepBubble.anims.play(NPC_SLEEP_BUBBLE_ANIMATION_KEY, true);
    }

    const npc = {
      id,
      x: spawnPoint.x,
      y: spawnPoint.y,
      targetX: spawnPoint.x,
      targetY: spawnPoint.y,
      tint,
      textureKey: spriteAsset.key,
      resolvedAssetPath: spriteAsset.url,
      merchantIdleAnimationKey,
      merchantIsStatic,
      merchantUsedFallback,
      sprite,
      sleepBubble,
      speechBubble,
      speechIcon,
      shadow,
      mode: isMerchant ? 'merchant_idle' : 'idle',
      modeEndsAt: 0,
      speed: NPC_BEHAVIOR_CONFIG.wanderSpeed,
      facingLeft:
        facing === 'left'
          ? true
          : facing === 'right'
            ? false
            : Math.random() >= 0.5,
      lookAroundAt: 0,
      goofyCooldownUntil: 0,
      isMerchant,
      merchantId,
      shopId,
      doorId: null,
      lastDoorId: null,
      nextDoorAllowedAt: 0,
      nextDiscussionAllowedAt: 0,
      discussionPartnerId: null,
      discussionParticipantIds: [],
      discussionLeadId: null,
      discussionSlotIndex: 0,
      discussionPose: 'idle',
      discussionPoseUntil: 0,
      discussionSitSyncAt: 0,
      discussionBubbleVisibleUntil: 0,
      discussionCurrentBubbleContent: null,
      discussionNextBubbleAt: 0,
      discussionNextSpeakerId: null,
      discussionExitTargetX: null,
      discussionExitTargetY: null,
      enterFadeEndsAt: 0,
      enterFadeStartedAt: 0,
      doorFadeDirection: null,
      doorPendingRelease: false,
      isHidden: false,
      skipSleepTransition: false,
      pushReactionBubbleVisibleUntil: 0,
      pushReactionBubbleContent: null,
      lastPushAt: 0,
      lastPushContactAt: 0,
      pushContactStartedAt: 0,
      pushContactHits: 0,
      pushIrritationTimestamps: [],
      pendingAggression: false,
      resumeAfterPushMode: 'idle',
      collisionBounds: getNpcBounds(spawnPoint.x, spawnPoint.y),
    };

    if (isMerchant && DEBUG_NPCS) {
      console.info('[Merchant NPC] texture:', {
        merchantId: merchantId || id,
        resolvedAssetPath: spriteAsset.url,
        textureKey: spriteAsset.key,
        textureExists: textureInfo.exists,
        frameCount: textureInfo.frameCount,
        frameWidth: textureInfo.frameWidth,
        frameHeight: textureInfo.frameHeight,
        sourceWidth: textureInfo.sourceWidth,
        sourceHeight: textureInfo.sourceHeight,
        usingFallback: merchantUsedFallback,
        spawnX: spawnPoint.x,
        spawnY: spawnPoint.y,
        staticImage: merchantIsStatic,
      });
    }

    if (isMerchant) {
      this.enterMerchantIdle(npc);
    } else {
      this.enterIdle(
        npc,
        this.scene.time.now + getRandomDuration(NPC_BEHAVIOR_CONFIG.idleDurationMs)
      );
    }

    return npc;
  }

  spawnTestNpcs() {
    const merchantNpcs = getVillageMerchantSpawns().map((spawn) =>
      this.createNpcRecord({
        id: spawn.id,
        x: spawn.x,
        y: spawn.y + VILLAGE_WORLD_TILE_SIZE - 8,
        tint: null,
        isMerchant: true,
        merchantId: spawn.merchantId,
        shopId: spawn.shopId,
        facing: spawn.facing,
      })
    );

    this.npcs = [...merchantNpcs];

    const roamingNpcs = Array.from({ length: NPC_TEST_COUNT }, (_, index) => {
      const tint = NPC_TEST_TINTS[index % NPC_TEST_TINTS.length];
      const spawnPoint = this.findSpawnPoint(index);
      const npc = this.createNpcRecord({
        id: `solaria_npc_${index + 1}`,
        x: spawnPoint.x,
        y: spawnPoint.y,
        tint,
      });
      this.npcs.push(npc);
      return npc;
    });
    this.npcs = [...merchantNpcs, ...roamingNpcs];

    if (DEBUG_NPCS) {
      console.info('[NPC] spawned:', this.npcs.length);
      console.info('[Merchant NPC] spawned:', merchantNpcs.length);
      merchantNpcs.forEach((merchantNpc) => {
        console.info('[Merchant NPC] spawn:', merchantNpc.merchantId, {
          x: merchantNpc.x,
          y: merchantNpc.y,
          shopId: merchantNpc.shopId,
        });
      });
    }
  }

  findOpenPointNearby(origin) {
    const basePoint = clampToVillage(origin, this.villageBounds);
    if (this.canOccupy(basePoint.x, basePoint.y)) {
      return basePoint;
    }

    for (let index = 0; index < NPC_BEHAVIOR_CONFIG.spawnAttempts; index += 1) {
      const angle = randomBetween(0, Math.PI * 2);
      const distance = randomBetween(12, 52);
      const candidate = clampToVillage(
        {
          x: basePoint.x + Math.cos(angle) * distance,
          y: basePoint.y + Math.sin(angle) * distance,
        },
        this.villageBounds
      );

      if (this.canOccupy(candidate.x, candidate.y)) {
        return candidate;
      }
    }

    return basePoint;
  }

  findSpawnPoint(index) {
    if (!this.villageBounds) {
      return { x: index * 24, y: 0 };
    }

    for (let attempt = 0; attempt < NPC_BEHAVIOR_CONFIG.spawnAttempts; attempt += 1) {
      const candidate = {
        x: randomBetween(
          this.villageBounds.left + NPC_BEHAVIOR_CONFIG.villageMargin,
          this.villageBounds.right - NPC_BEHAVIOR_CONFIG.villageMargin
        ),
        y: randomBetween(
          this.villageBounds.top + NPC_BEHAVIOR_CONFIG.villageMargin,
          this.villageBounds.bottom - NPC_BEHAVIOR_CONFIG.villageMargin
        ),
      };

      if (this.canOccupy(candidate.x, candidate.y)) {
        return candidate;
      }
    }

    return {
      x:
        this.villageBounds.left +
        NPC_BEHAVIOR_CONFIG.villageMargin +
        index * NPC_BEHAVIOR_CONFIG.spawnSpacing,
      y:
        this.villageBounds.top +
        NPC_BEHAVIOR_CONFIG.villageMargin +
        (index % 4) * NPC_BEHAVIOR_CONFIG.spawnSpacing,
    };
  }

  getPlayerBounds() {
    const { worldOffset } = useWorldStore.getState();
    return getPetCollisionBounds({
      x: -(worldOffset?.x || 0),
      y: -(worldOffset?.y || 0),
    });
  }

  getNpcCollisionBounds(npc) {
    return getNpcBounds(npc.x, npc.y);
  }

  getVisibleCollisionBounds() {
    return this.npcs
      .filter((npc) => npc && !npc.isHidden)
      .map((npc) => npc.collisionBounds || this.getNpcCollisionBounds(npc))
      .filter(Boolean);
  }

  isBlockedByOtherNpc(bounds, ignoreNpcIds = null) {
    const ignoredIds = new Set(
      Array.isArray(ignoreNpcIds)
        ? ignoreNpcIds.filter(Boolean)
        : ignoreNpcIds
          ? [ignoreNpcIds]
          : []
    );
    return this.npcs.some((npc) => {
      if (!npc || ignoredIds.has(npc.id) || npc.isHidden) {
        return false;
      }

      const npcBounds = npc.collisionBounds || this.getNpcCollisionBounds(npc);
      return boundsOverlap(bounds, npcBounds);
    });
  }

  canOccupy(x, y, options = {}) {
    const { ignoreNpcId = null, ignoreNpcIds = null, blockPlayer = true } = options;
    const ignoredIds = Array.isArray(ignoreNpcIds)
      ? ignoreNpcIds
      : ignoreNpcId
        ? [ignoreNpcId]
        : [];
    const bounds = getNpcBounds(x, y);
    if (!isWorldTerrainBoundsWalkable(bounds)) {
      return false;
    }

    if (
      isRectBlockedByVillage(
        bounds.left,
        bounds.top,
        bounds.right - bounds.left,
        bounds.bottom - bounds.top
      )
    ) {
      return false;
    }

    if (this.isBlockedByOtherNpc(bounds, ignoredIds)) {
      return false;
    }

    if (blockPlayer && boundsOverlap(bounds, this.getPlayerBounds())) {
      return false;
    }

    return true;
  }

  canNpcBeShoved(npc) {
    if (!npc || npc.isHidden || npc.isMerchant) {
      return false;
    }

    const mode = npc.mode || '';
    if (
      mode === 'merchant_idle' ||
      mode === 'hurt' ||
      mode === 'death' ||
      mode === 'inside' ||
      isDoorMode(mode) ||
      isPushMode(mode)
    ) {
      return false;
    }

    return true;
  }

  recordPushIrritation(npc, now) {
    const timestamps = Array.isArray(npc?.pushIrritationTimestamps)
      ? npc.pushIrritationTimestamps
      : [];
    const nextTimestamps = timestamps.filter(
      (timestamp) => now - timestamp <= NPC_PUSH_IRRITATION_WINDOW_MS
    );
    nextTimestamps.push(now);
    npc.pushIrritationTimestamps = nextTimestamps;
    this.logPushEvent('irritation count', npc.id, nextTimestamps.length);
    return nextTimestamps.length;
  }

  interruptNpcForPush(npc, now = this.scene.time.now) {
    if (!npc) {
      return null;
    }

    const interruptedMode = npc.mode || 'idle';
    this.logPushEvent('interrupted state', npc.id, interruptedMode);

    if (isDiscussionMode(interruptedMode)) {
      const participants = this.getDiscussionParticipants(npc);
      this.hideDiscussionBubbles(participants);
      participants.forEach((participant) => {
        this.clearDiscussionState(participant);
        participant.speed = 0;
        participant.targetX = participant.x;
        participant.targetY = participant.y;
        participant.nextDiscussionAllowedAt = Math.max(
          participant.nextDiscussionAllowedAt || 0,
          now + NPC_DISCUSSION_COOLDOWN_MS
        );
        if (participant.id !== npc.id) {
          this.enterIdle(
            participant,
            now + getRandomDuration(NPC_BEHAVIOR_CONFIG.idleDurationMs) * 0.5
          );
        }
      });
    } else {
      this.hideSpeechBubble(npc);
    }

    this.hidePushReactionBubble(npc);
    npc.speed = 0;
    npc.targetX = npc.x;
    npc.targetY = npc.y;
    npc.modeEndsAt = now;
    npc.skipSleepTransition = false;
    npc.lookAroundAt =
      now + getRandomDuration(NPC_BEHAVIOR_CONFIG.lookAroundIntervalMs);
    npc.nextDiscussionAllowedAt = Math.max(
      npc.nextDiscussionAllowedAt || 0,
      now + 1200
    );
    npc.goofyCooldownUntil = Math.max(
      npc.goofyCooldownUntil || 0,
      now + 6000
    );
    npc.resumeAfterPushMode = getPushResumeMode(interruptedMode);

    return interruptedMode;
  }

  findPushDestination(npc, directionX, directionY, distancePx) {
    if (!npc) {
      return { x: 0, y: 0 };
    }

    let resolvedTarget = { x: npc.x, y: npc.y };

    for (
      let step = NPC_PUSH_DISTANCE_STEP_PX;
      step <= distancePx + 0.001;
      step += NPC_PUSH_DISTANCE_STEP_PX
    ) {
      const clampedDistance = Math.min(distancePx, step);
      const candidate = clampToVillage(
        {
          x: npc.x + directionX * clampedDistance,
          y: npc.y + directionY * clampedDistance,
        },
        this.villageBounds
      );

      if (!this.canOccupy(candidate.x, candidate.y, {
        ignoreNpcId: npc.id,
        blockPlayer: false,
      })) {
        break;
      }

      resolvedTarget = candidate;
    }

    return resolvedTarget;
  }

  findFleeDestination(npc, directionX, directionY, distancePx) {
    if (!npc) {
      return { x: 0, y: 0 };
    }

    const baseDirection = normalizeVector(directionX, directionY);
    const fallbackDirection = npc.facingLeft ? { x: -1, y: 0 } : { x: 1, y: 0 };
    const resolvedDirection =
      baseDirection.distance > 0.001 ? baseDirection : fallbackDirection;
    const baseAngle = Math.atan2(resolvedDirection.y, resolvedDirection.x);
    const angleOffsets = [0, Math.PI * 0.16, -Math.PI * 0.16, Math.PI * 0.33, -Math.PI * 0.33];
    const distanceSteps = [1, 0.85, 0.7, 0.55];
    let bestTarget = { x: npc.x, y: npc.y };

    for (const distanceFactor of distanceSteps) {
      const desiredDistance = Math.max(18, distancePx * distanceFactor);
      for (const angleOffset of angleOffsets) {
        const angle = baseAngle + angleOffset;
        const candidate = this.findPushDestination(
          npc,
          Math.cos(angle),
          Math.sin(angle),
          desiredDistance
        );
        const candidateTravel = Phaser.Math.Distance.Between(
          npc.x,
          npc.y,
          candidate.x,
          candidate.y
        );
        const bestTravel = Phaser.Math.Distance.Between(
          npc.x,
          npc.y,
          bestTarget.x,
          bestTarget.y
        );

        if (candidateTravel > bestTravel + 0.5) {
          bestTarget = candidate;
        }
      }
    }

    return bestTarget;
  }

  setupCollisionResolver() {
    setNpcCollisionResolver((candidateBounds, { previousBounds } = {}) => {
      const playerWasInside = previousBounds && this.npcs.some((npc) => {
        if (npc?.isHidden) {
          return false;
        }
        const npcBounds = npc.collisionBounds || this.getNpcCollisionBounds(npc);
        return boundsOverlap(previousBounds, npcBounds);
      });

      for (const npc of this.npcs) {
        if (npc?.isHidden) {
          continue;
        }
        const npcBounds =
          npc.collisionBounds || this.getNpcCollisionBounds(npc);
        if (!boundsOverlap(candidateBounds, npcBounds)) {
          continue;
        }

        if (playerWasInside && previousBounds && boundsOverlap(previousBounds, npcBounds)) {
          continue;
        }

        return {
          blocked: true,
          npcId: npc.id,
        };
      }

      return {
        blocked: false,
        npcId: null,
      };
    });
    setNpcCollisionContactHandler((contact) =>
      this.handlePlayerNpcCollisionContact(contact)
    );
  }

  setupDebugGraphics() {
    if (!DEBUG_NPCS) {
      this._npcCollisionDebug = null;
      return;
    }

    this._npcCollisionDebug = this.scene.add.graphics();
    this._npcCollisionDebug
      .setDepth(97)
      .setScrollFactor(0)
      .setVisible(true);
  }

  drawDebugCollisionBoxes(worldOffset) {
    const g = this._npcCollisionDebug;
    if (!g) {
      return;
    }

    const cam = this.scene.cameras.main;
    g.clear();
    g.fillStyle(0x10b981, 0.14);
    g.lineStyle(1, 0x34d399, 0.7);

    this.npcs.forEach((npc) => {
      if (npc.isHidden) {
        return;
      }
      const bounds = npc.collisionBounds || this.getNpcCollisionBounds(npc);
      const drawX = Math.round(cam.width * 0.5 + (worldOffset.x || 0) + bounds.left);
      const drawY = Math.round(cam.height * 0.5 + (worldOffset.y || 0) + bounds.top);
      const width = bounds.right - bounds.left;
      const height = bounds.bottom - bounds.top;

      g.fillRect(drawX, drawY, width, height);
      g.strokeRect(drawX, drawY, width, height);
    });
  }

  pickDoorForNpc(npc) {
    const allDoors = this.doorManager?.getVillageDoors?.() || [];
    let availableDoors = allDoors.filter(
      (door) =>
        door?.id &&
        (!door?.activeEntities || door.activeEntities.size === 0)
    );
    const alternateDoors = availableDoors.filter((door) => door.id !== npc?.lastDoorId);
    if (alternateDoors.length > 0) {
      availableDoors = alternateDoors;
    }

    const normalizeDoor = (door) => {
      if (!door?.id) {
        return null;
      }
      return this.doorManager?.getDoorById?.(door.id) || door;
    };

    if (this.doorManager?.getNearbyDoors) {
      const nearbyDoors = this.doorManager.getNearbyDoors(
        npc.x,
        npc.y,
        NPC_BEHAVIOR_CONFIG.doorUseRadius
      );
      let nearbyAvailableDoors = nearbyDoors.filter(
        (door) => !door?.activeEntities || door.activeEntities.size === 0
      );
      const nearbyAlternateDoors = nearbyAvailableDoors.filter(
        (door) => door?.id !== npc?.lastDoorId
      );
      if (nearbyAlternateDoors.length > 0) {
        nearbyAvailableDoors = nearbyAlternateDoors;
      }
      if (nearbyAvailableDoors.length > 0) {
        const candidates = nearbyAvailableDoors.slice(
          0,
          Math.min(4, nearbyAvailableDoors.length)
        );
        return normalizeDoor(
          Phaser.Utils.Array.GetRandom(candidates) || candidates[0] || null
        );
      }
    }

    const nearestDoor = this.doorManager?.getNearestDoor?.(
      npc.x,
      npc.y,
      NPC_BEHAVIOR_CONFIG.doorUseRadius
    );
    if (nearestDoor?.id) {
      return normalizeDoor(nearestDoor);
    }

    if (availableDoors.length > 0) {
      return normalizeDoor(
        Phaser.Utils.Array.GetRandom(availableDoors) || availableDoors[0]
      );
    }

    return normalizeDoor(allDoors[0] || null);
  }

  getDoorEntryPoint(doorId) {
    return (
      this.doorManager?.getDoorEntryTilePoint?.(doorId) ||
      this.doorManager?.getDoorEntryPoint?.(doorId) ||
      this.doorManager?.getDoorApproachPoint?.(doorId) ||
      null
    );
  }

  getDoorExitPoint(doorId) {
    return (
      this.doorManager?.getDoorExitPoint?.(doorId, 2) ||
      this.getDoorEntryPoint(doorId) ||
      null
    );
  }

  isNpcAtDoorEntry(npc) {
    if (!npc?.doorId) {
      return false;
    }

    const door = this.doorManager?.getDoorById?.(npc.doorId);
    const entryPoint = this.getDoorEntryPoint(npc.doorId);
    if (!door || !entryPoint) {
      return false;
    }

    return (
      Phaser.Math.Distance.Between(npc.x, npc.y, entryPoint.x, entryPoint.y) <=
      NPC_DOOR_ENTRY_REACH_DISTANCE
    );
  }

  getDoorOpenWaitMs(doorId, fallbackMs) {
    const animationDuration =
      this.doorManager?.getDoorAnimationDurationMs?.(doorId) || 0;
    return Math.max(fallbackMs, animationDuration + 120);
  }

  canUseDoorBehavior(npc, now = this.scene.time.now) {
    if (!npc || npc.isHidden || npc.isMerchant) {
      return false;
    }

    if (
      npc.mode === 'sleep' ||
      npc.mode === 'sleep_transition' ||
      npc.mode === 'goofy_run' ||
      npc.mode === 'hurt' ||
      npc.mode === 'death' ||
      npc.mode === 'inside' ||
      npc.mode === 'door_enter_fx' ||
      npc.mode === 'discussion_approach' ||
      npc.mode === 'discussion' ||
      npc.mode === 'discussion_exit' ||
      isPushMode(npc.mode)
    ) {
      return false;
    }

    if (now < (npc.nextDoorAllowedAt || 0)) {
      this.logDoorEvent('blocked by cooldown', `${npc.id}:${Math.ceil(npc.nextDoorAllowedAt - now)}ms`);
      return false;
    }

    return true;
  }

  getDoorWalkAwayTarget(npc, doorId) {
    const exitPoint = this.getDoorExitPoint(doorId);
    if (!exitPoint) {
      return null;
    }

    const door = this.doorManager?.getDoorById?.(doorId);
    const doorCenterX = door ? (door.bounds.left + door.bounds.right) * 0.5 : exitPoint.x;
    const directionX = exitPoint.x >= doorCenterX ? 1 : -1;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const distance = randomBetween(
        NPC_DOOR_EXIT_WALK_AWAY_MIN_PX,
        NPC_DOOR_EXIT_WALK_AWAY_MAX_PX
      );
      const candidate = clampToVillage(
        {
          x: exitPoint.x + directionX * distance,
          y: exitPoint.y + randomBetween(-12, 12),
        },
        this.villageBounds
      );
      if (this.canOccupy(candidate.x, candidate.y, { ignoreNpcId: npc.id })) {
        return candidate;
      }
    }

    return this.findOpenPointNearby(exitPoint);
  }

  getNpcById(npcId) {
    return this.npcs.find((npc) => npc?.id === npcId) || null;
  }

  getMerchants() {
    return this.npcs.filter((npc) => npc?.isMerchant && !npc.isHidden);
  }

  getNearestMerchant(x, y, maxDistance = Infinity) {
    let nearestMerchant = null;
    let nearestDistance = Infinity;

    this.npcs.forEach((npc) => {
      if (!npc?.isMerchant || npc.isHidden) {
        return;
      }

      const distance = Phaser.Math.Distance.Between(x, y, npc.x, npc.y);
      if (distance <= maxDistance && distance < nearestDistance) {
        nearestMerchant = npc;
        nearestDistance = distance;
      }
    });

    return nearestMerchant;
  }

  getExpandedBounds(bounds, padding = 0) {
    if (!bounds) {
      return null;
    }

    return {
      left: bounds.left - padding,
      top: bounds.top - padding,
      right: bounds.right + padding,
      bottom: bounds.bottom + padding,
    };
  }

  getNpcCenter(npc) {
    return {
      x: npc?.x || 0,
      y: npc?.y || 0,
    };
  }

  getNearbyWorldCollisionItems(x, y, radius = NPC_SLEEP_CLEARANCE_RADIUS_PX) {
    const viewportPadding = Math.max(
      96,
      (Number.isFinite(radius) ? radius : NPC_SLEEP_CLEARANCE_RADIUS_PX) * 4
    );

    return getWorldAtlasCollisionObjects(x, y, WORLD_ATLAS_DATA, {
      width: viewportPadding,
      height: viewportPadding,
    });
  }

  isSleepLocationSafe(npc) {
    if (!npc || npc.isHidden || npc.isMerchant) {
      return false;
    }

    const bounds = npc.collisionBounds || this.getNpcCollisionBounds(npc);
    const clearanceBounds = this.getExpandedBounds(
      bounds,
      NPC_SLEEP_CLEARANCE_RADIUS_PX
    );
    if (!clearanceBounds) {
      return false;
    }

    if (!isWorldTerrainBoundsWalkable(clearanceBounds)) {
      return false;
    }

    if (
      isRectBlockedByVillage(
        clearanceBounds.left,
        clearanceBounds.top,
        clearanceBounds.right - clearanceBounds.left,
        clearanceBounds.bottom - clearanceBounds.top
      )
    ) {
      return false;
    }

    const worldCollisionItems = this.getNearbyWorldCollisionItems(
      npc.x,
      npc.y,
      NPC_SLEEP_CLEARANCE_RADIUS_PX
    );
    if (
      worldCollisionItems.some((item) =>
        boundsOverlap(clearanceBounds, getWorldAtlasCollisionBounds(item))
      )
    ) {
      return false;
    }

    if (
      this.doorManager?.getVillageDoors?.().some((door) =>
        boundsOverlap(clearanceBounds, door.bounds)
      )
    ) {
      return false;
    }

    if (
      getVillageMerchantSpawns().some((spawn) =>
        boundsOverlap(clearanceBounds, spawn.bounds)
      )
    ) {
      return false;
    }

    const npcCenter = this.getNpcCenter(npc);
    const playerCenter = {
      x: (this.getPlayerBounds().left + this.getPlayerBounds().right) * 0.5,
      y: (this.getPlayerBounds().top + this.getPlayerBounds().bottom) * 0.5,
    };
    if (
      Phaser.Math.Distance.Between(
        npcCenter.x,
        npcCenter.y,
        playerCenter.x,
        playerCenter.y
      ) <= NPC_SLEEP_CLEARANCE_RADIUS_PX
    ) {
      return false;
    }

    const tooCloseNpc = this.npcs.some((otherNpc) => {
      if (!otherNpc || otherNpc.id === npc.id || otherNpc.isHidden) {
        return false;
      }

      const otherBounds =
        otherNpc.collisionBounds || this.getNpcCollisionBounds(otherNpc);
      if (boundsOverlap(clearanceBounds, otherBounds)) {
        return true;
      }

      return (
        Phaser.Math.Distance.Between(
          npcCenter.x,
          npcCenter.y,
          otherNpc.x,
          otherNpc.y
        ) <= NPC_SLEEP_CLEARANCE_RADIUS_PX
      );
    });
    if (tooCloseNpc) {
      return false;
    }

    const directionOffsets = [
      { x: -NPC_SLEEP_CLEARANCE_RADIUS_PX, y: 0 },
      { x: NPC_SLEEP_CLEARANCE_RADIUS_PX, y: 0 },
      { x: 0, y: -NPC_SLEEP_CLEARANCE_RADIUS_PX },
      { x: 0, y: NPC_SLEEP_CLEARANCE_RADIUS_PX },
    ];
    const freeDirectionCount = directionOffsets.reduce((count, offset) => {
      return this.canOccupy(npc.x + offset.x, npc.y + offset.y, {
        ignoreNpcId: npc.id,
      })
        ? count + 1
        : count;
    }, 0);

    return freeDirectionCount >= NPC_SLEEP_MIN_FREE_DIRECTIONS;
  }

  redirectUnsafeSleep(npc) {
    this.logDiscussionEvent('sleep blocked by clearance', npc.id);
    if (Math.random() < 0.65) {
      this.enterWander(npc);
    } else {
      this.enterIdle(npc);
    }
  }

  canUseDiscussionBehavior(npc, now = this.scene.time.now) {
    if (!npc || npc.isHidden || npc.isMerchant) {
      return false;
    }

    if (
      npc.mode === 'sleep' ||
      npc.mode === 'sleep_transition' ||
      npc.mode === 'wake' ||
      npc.mode === 'goofy_run' ||
      npc.mode === 'hurt' ||
      npc.mode === 'death' ||
      npc.mode === 'inside' ||
      npc.mode === 'door_approach' ||
      npc.mode === 'door_enter' ||
      npc.mode === 'door_enter_fx' ||
      npc.mode === 'door_exit_fx' ||
      npc.mode === 'door_walk_away' ||
      npc.mode === 'discussion_approach' ||
      npc.mode === 'discussion' ||
      npc.mode === 'discussion_exit' ||
      isPushMode(npc.mode)
    ) {
      return false;
    }

    if (now < (npc.nextDiscussionAllowedAt || 0)) {
      return false;
    }

    return true;
  }

  getDiscussionParticipants(npc) {
    if (!npc) {
      return [];
    }

    const leader =
      npc.discussionLeadId && npc.discussionLeadId !== npc.id
        ? this.getNpcById(npc.discussionLeadId) || npc
        : npc;
    const participantIds = Array.isArray(leader.discussionParticipantIds) &&
      leader.discussionParticipantIds.length > 0
      ? leader.discussionParticipantIds
      : [leader.id, leader.discussionPartnerId].filter(Boolean);

    return [...new Set(participantIds)]
      .map((npcId) => this.getNpcById(npcId))
      .filter(Boolean);
  }

  getAvailableDiscussionCandidates(npc, now = this.scene.time.now) {
    return this.npcs
      .filter((otherNpc) => otherNpc?.id !== npc.id)
      .filter((otherNpc) => this.canUseDiscussionBehavior(otherNpc, now))
      .filter(
        (otherNpc) =>
          Phaser.Math.Distance.Between(npc.x, npc.y, otherNpc.x, otherNpc.y) <=
          NPC_DISCUSSION_MAX_DISTANCE
      )
      .sort((left, right) => {
        const leftDistance = Phaser.Math.Distance.Between(npc.x, npc.y, left.x, left.y);
        const rightDistance = Phaser.Math.Distance.Between(npc.x, npc.y, right.x, right.y);
        return leftDistance - rightDistance;
      });
  }

  pickDiscussionParticipants(npc, now = this.scene.time.now) {
    const candidates = this.getAvailableDiscussionCandidates(npc, now);
    const partner = candidates[0] || null;
    if (!partner) {
      return [];
    }

    const participants = [npc, partner];
    const remainingCandidates = candidates.filter(
      (candidate) => candidate.id !== partner.id
    );
    if (
      remainingCandidates.length > 0 &&
      Math.random() < NPC_DISCUSSION_TRIO_CHANCE
    ) {
      const midpointX = (npc.x + partner.x) * 0.5;
      const midpointY = (npc.y + partner.y) * 0.5;
      const thirdNpc = remainingCandidates
        .filter(
          (candidate) =>
            Phaser.Math.Distance.Between(candidate.x, candidate.y, npc.x, npc.y) <=
              NPC_DISCUSSION_MAX_DISTANCE &&
            Phaser.Math.Distance.Between(
              candidate.x,
              candidate.y,
              partner.x,
              partner.y
            ) <= NPC_DISCUSSION_MAX_DISTANCE
        )
        .sort((left, right) => {
          const leftDistance = Phaser.Math.Distance.Between(
            left.x,
            left.y,
            midpointX,
            midpointY
          );
          const rightDistance = Phaser.Math.Distance.Between(
            right.x,
            right.y,
            midpointX,
            midpointY
          );
          return leftDistance - rightDistance;
        })[0];

      if (thirdNpc) {
        participants.push(thirdNpc);
      }
    }

    return participants;
  }

  findDiscussionMeetingTargets(participants) {
    const activeParticipants = participants.filter(Boolean);
    if (activeParticipants.length < 2) {
      return null;
    }

    const midpoint = activeParticipants.reduce(
      (accumulator, npc) => ({
        x: accumulator.x + npc.x,
        y: accumulator.y + npc.y,
      }),
      { x: 0, y: 0 }
    );
    midpoint.x /= activeParticipants.length;
    midpoint.y /= activeParticipants.length;

    const baseAngle =
      Math.atan2(
        (activeParticipants[1]?.y || midpoint.y) - (activeParticipants[0]?.y || midpoint.y),
        (activeParticipants[1]?.x || midpoint.x) - (activeParticipants[0]?.x || midpoint.x)
      ) || randomBetween(0, Math.PI * 2);
    const angleOffsets = [
      0,
      Math.PI * 0.166,
      -Math.PI * 0.166,
      Math.PI * 0.333,
      -Math.PI * 0.333,
      Math.PI * 0.5,
      -Math.PI * 0.5,
    ];
    const ignoredNpcIds = activeParticipants.map((participant) => participant.id);

    for (const offset of angleOffsets) {
      const angle = baseAngle + offset;
      const targets =
        activeParticipants.length === 2
          ? activeParticipants.map((npc, index) => {
              const direction = index === 0 ? -1 : 1;
              const halfDistance = NPC_DISCUSSION_MEETING_DISTANCE * 0.5;
              return {
                npc,
                point: clampToVillage(
                  {
                    x: midpoint.x + Math.cos(angle) * halfDistance * direction,
                    y: midpoint.y + Math.sin(angle) * halfDistance * direction,
                  },
                  this.villageBounds
                ),
              };
            })
          : activeParticipants.map((npc, index) => {
              const radius = Math.max(
                NPC_DISCUSSION_MEETING_DISTANCE * 0.95,
                16
              );
              const ringAngle =
                angle + (Math.PI * 2 * index) / activeParticipants.length;
              return {
                npc,
                point: clampToVillage(
                  {
                    x: midpoint.x + Math.cos(ringAngle) * radius,
                    y: midpoint.y + Math.sin(ringAngle) * radius,
                  },
                  this.villageBounds
                ),
              };
            });

      const allTargetsOpen = targets.every(({ npc, point }) =>
        this.canOccupy(point.x, point.y, {
          ignoreNpcIds: ignoredNpcIds.filter((npcId) => npcId !== npc.id),
        })
      );
      if (allTargetsOpen) {
        return targets;
      }
    }

    return null;
  }

  applyDiscussionGroupMetadata(participants, leader) {
    const participantIds = participants.map((participant) => participant.id);
    participants.forEach((participant, index) => {
      participant.discussionLeadId = leader.id;
      participant.discussionParticipantIds = participantIds;
      participant.discussionPartnerId =
        participantIds.find((npcId) => npcId !== participant.id) || null;
      participant.discussionSlotIndex = index;
    });
  }

  setDiscussionPose(npc, pose = 'idle') {
    npc.discussionPose = pose;
    this.setNpcAnimation(
      npc,
      pose === 'sit' ? NPC_ANIMATION_KEYS.sit : NPC_ANIMATION_KEYS.idle
    );
  }

  syncDiscussionFacing(npc, partner) {
    if (!npc || !partner) {
      return;
    }

    npc.facingLeft = npc.x > partner.x;
    partner.facingLeft = partner.x > npc.x;
  }

  syncDiscussionFacingGroup(participants) {
    const activeParticipants = participants.filter(Boolean);
    if (activeParticipants.length <= 1) {
      return;
    }

    if (activeParticipants.length === 2) {
      this.syncDiscussionFacing(activeParticipants[0], activeParticipants[1]);
      return;
    }

    const center = activeParticipants.reduce(
      (accumulator, participant) => ({
        x: accumulator.x + participant.x,
        y: accumulator.y + participant.y,
      }),
      { x: 0, y: 0 }
    );
    center.x /= activeParticipants.length;
    center.y /= activeParticipants.length;

    activeParticipants.forEach((participant) => {
      participant.facingLeft = participant.x > center.x;
    });
  }

  hideSpeechBubble(npc) {
    npc.discussionBubbleVisibleUntil = 0;
    npc.discussionCurrentBubbleContent = null;
    npc.speechBubble?.setVisible(false);
    npc.speechIcon?.setVisible(false);
  }

  hideDiscussionBubbles(...participantsOrLists) {
    const participants = participantsOrLists
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .filter(Boolean);

    participants.forEach((participant) => this.hideSpeechBubble(participant));
  }

  ensureDiscussionIconFrame(itemId) {
    if (!itemId) {
      return null;
    }

    if (this.discussionIconFrameCache.has(itemId)) {
      return this.discussionIconFrameCache.get(itemId);
    }

    const item = ITEMS_REGISTRY[itemId];
    if (!item?.atlasSource || !item?.atlasRect) {
      return null;
    }

    const textureKey = getDiscussionTextureKey(item.atlasSource);
    if (!this.scene.textures.exists(textureKey)) {
      return null;
    }

    const texture = this.scene.textures.get(textureKey);
    const rect = item.atlasRect;
    const frameKey = `${textureKey}_${rect.x}_${rect.y}_${rect.width}_${rect.height}`;
    if (!texture.has(frameKey)) {
      texture.add(frameKey, 0, rect.x, rect.y, rect.width, rect.height);
    }

    const frameData = {
      textureKey,
      frameKey,
      width: rect.width,
      height: rect.height,
    };
    this.discussionIconFrameCache.set(itemId, frameData);
    return frameData;
  }

  showDiscussionBubble(npc, content, now) {
    npc.discussionCurrentBubbleContent = content;
    npc.discussionBubbleVisibleUntil = now + NPC_DISCUSSION_BUBBLE_DURATION_MS;
    npc.speechBubble?.setVisible(true);

    if (content?.type === 'emoji') {
      npc.speechIcon
        ?.setTexture(NPC_EMOJI_REACTIONS_ASSET.key, content.frameIndex)
        .setDisplaySize(NPC_SPEECH_ICON_DISPLAY_WIDTH, NPC_SPEECH_ICON_DISPLAY_HEIGHT)
        .setVisible(true);
      this.logDiscussionEvent('bubble shown', npc.id, 'emoji', content.frameIndex);
    } else if (content?.type === 'item') {
      const frame = this.ensureDiscussionIconFrame(content.itemId);
      if (frame) {
        npc.speechIcon
          ?.setTexture(frame.textureKey, frame.frameKey)
          .setDisplaySize(NPC_SPEECH_ICON_DISPLAY_WIDTH, NPC_SPEECH_ICON_DISPLAY_HEIGHT)
          .setVisible(true);
      } else {
        npc.speechIcon?.setVisible(false);
      }
      this.logDiscussionEvent('bubble shown', npc.id, 'item', content.itemId);
    } else {
      npc.speechIcon?.setVisible(false);
    }
  }

  beginDiscussion(participants) {
    const now = this.scene.time.now;
    const endsAt = now + randomBetween(
      NPC_DISCUSSION_MIN_DURATION_MS,
      NPC_DISCUSSION_MAX_DURATION_MS
    );
    const nextBubbleAt = now + randomBetween(
      NPC_DISCUSSION_BUBBLE_INTERVAL_MIN_MS,
      NPC_DISCUSSION_BUBBLE_INTERVAL_MAX_MS
    );
    const poseUntil = now + randomBetween(2600, 4200);
    const activeParticipants = participants.filter(Boolean);
    const leader = activeParticipants[0];
    if (!leader || activeParticipants.length < 2) {
      return;
    }

    this.applyDiscussionGroupMetadata(activeParticipants, leader);
    activeParticipants.forEach((npc) => {
      npc.mode = 'discussion';
      npc.modeEndsAt = endsAt;
      npc.speed = 0;
      npc.targetX = npc.x;
      npc.targetY = npc.y;
      npc.discussionPoseUntil = poseUntil;
      npc.discussionSitSyncAt = 0;
      npc.nextDiscussionAllowedAt = now + NPC_DISCUSSION_COOLDOWN_MS;
      this.setDiscussionPose(npc, 'idle');
    });

    leader.discussionNextBubbleAt = nextBubbleAt;
    leader.discussionNextSpeakerId = leader.id;
    leader.discussionPoseUntil = poseUntil;
    leader.discussionSitSyncAt = 0;
    this.syncDiscussionFacingGroup(activeParticipants);
    this.logDiscussionEvent(
      'started',
      activeParticipants.map((participant) => participant.id).join(' <-> ')
    );
  }

  startDiscussionApproach(participants) {
    const activeParticipants = participants.filter(Boolean);
    const leader = activeParticipants[0];
    if (!leader || activeParticipants.length < 2) {
      return false;
    }

    const targets = this.findDiscussionMeetingTargets(activeParticipants);
    if (!targets) {
      return false;
    }

    const now = this.scene.time.now;
    this.applyDiscussionGroupMetadata(activeParticipants, leader);
    activeParticipants.forEach((participant) => {
      const target = targets.find((entry) => entry.npc.id === participant.id)?.point;
      participant.mode = 'discussion_approach';
      participant.modeEndsAt = now + 5000;
      participant.speed = NPC_BEHAVIOR_CONFIG.wanderSpeed;
      participant.targetX = target?.x ?? participant.x;
      participant.targetY = target?.y ?? participant.y;
    });
    this.hideDiscussionBubbles(activeParticipants);
    return true;
  }

  endDiscussion(participants) {
    const activeParticipants = participants.filter(Boolean);
    const leader = activeParticipants[0];
    if (!leader || activeParticipants.length < 2) {
      activeParticipants.forEach((participant) => {
        this.clearDiscussionState(participant);
        this.enterIdle(participant);
      });
      return;
    }

    const now = this.scene.time.now;
    this.hideDiscussionBubbles(activeParticipants);
    this.logDiscussionEvent(
      'ended',
      activeParticipants.map((participant) => participant.id).join(' <-> ')
    );

    const center = activeParticipants.reduce(
      (accumulator, participant) => ({
        x: accumulator.x + participant.x,
        y: accumulator.y + participant.y,
      }),
      { x: 0, y: 0 }
    );
    center.x /= activeParticipants.length;
    center.y /= activeParticipants.length;

    activeParticipants.forEach((npc, index) => {
      const exitAngle =
        (Math.PI * 2 * index) / activeParticipants.length + randomBetween(-0.2, 0.2);
      const separationTarget = this.findOpenPointNearby({
        x: center.x + Math.cos(exitAngle) * randomBetween(28, 44),
        y: center.y + Math.sin(exitAngle) * randomBetween(18, 34),
      });
      npc.mode = 'discussion_exit';
      npc.modeEndsAt = now + NPC_DISCUSSION_EXIT_DELAY_MS;
      npc.speed = 0;
      npc.targetX = npc.x;
      npc.targetY = npc.y;
      npc.discussionPoseUntil = 0;
      npc.discussionSitSyncAt = 0;
      npc.discussionNextSpeakerId = null;
      npc.discussionLeadId = leader.id;
      npc.nextDiscussionAllowedAt = now + NPC_DISCUSSION_COOLDOWN_MS;
      this.setDiscussionPose(npc, 'idle');
      this.logDiscussionEvent('discussion cooldown', npc.id, NPC_DISCUSSION_COOLDOWN_MS);
      npc.discussionExitTargetX = separationTarget.x;
      npc.discussionExitTargetY = separationTarget.y;
    });
  }

  clearDiscussionState(npc, preserveCooldown = true) {
    const cooldown = preserveCooldown ? npc.nextDiscussionAllowedAt : 0;
    npc.discussionPartnerId = null;
    npc.discussionParticipantIds = [];
    npc.discussionLeadId = null;
    npc.discussionSlotIndex = 0;
    npc.discussionPose = 'idle';
    npc.discussionPoseUntil = 0;
    npc.discussionSitSyncAt = 0;
    npc.discussionNextBubbleAt = 0;
    npc.discussionNextSpeakerId = null;
    npc.discussionExitTargetX = null;
    npc.discussionExitTargetY = null;
    npc.nextDiscussionAllowedAt = cooldown;
    this.hideSpeechBubble(npc);
  }

  updateDiscussionLeader(leader, now) {
    const participants = this.getDiscussionParticipants(leader);
    if (
      participants.length < 2 ||
      participants.some((participant) => participant.mode !== 'discussion')
    ) {
      participants.forEach((participant) => this.clearDiscussionState(participant));
      this.clearDiscussionState(leader);
      return;
    }

    this.syncDiscussionFacingGroup(participants);

    if (leader.discussionSitSyncAt > 0 && now >= leader.discussionSitSyncAt) {
      leader.discussionSitSyncAt = 0;
      participants
        .filter((participant) => participant.id !== leader.id)
        .forEach((participant) => this.setDiscussionPose(participant, 'sit'));
      this.logDiscussionEvent(
        'sit sync',
        `${leader.id} -> ${participants
          .filter((participant) => participant.id !== leader.id)
          .map((participant) => participant.id)
          .join(',')}`
      );
    }

    if (now >= leader.discussionPoseUntil) {
      if (
        leader.discussionPose !== 'sit' &&
        Math.random() < NPC_DISCUSSION_SIT_CHANCE
      ) {
        this.setDiscussionPose(leader, 'sit');
        participants
          .filter((participant) => participant.id !== leader.id)
          .forEach((participant) => this.setDiscussionPose(participant, 'idle'));
        leader.discussionSitSyncAt = now + NPC_DISCUSSION_SIT_SYNC_DELAY_MS;
        leader.discussionPoseUntil = now + randomBetween(2600, 4200);
        this.logDiscussionEvent('sit sync', `${leader.id} waiting ${NPC_DISCUSSION_SIT_SYNC_DELAY_MS}ms`);
      } else {
        participants.forEach((participant) => this.setDiscussionPose(participant, 'idle'));
        leader.discussionSitSyncAt = 0;
        leader.discussionPoseUntil = now + randomBetween(2200, 4200);
      }
    }

    if (leader.discussionBubbleVisibleUntil > 0 && now >= leader.discussionBubbleVisibleUntil) {
      this.hideDiscussionBubbles(participants);
    }

    if (now >= (leader.discussionNextBubbleAt || 0)) {
      const speaker =
        this.getNpcById(leader.discussionNextSpeakerId) || leader;
      const participantIds = participants.map((participant) => participant.id);
      const speakerIndex = Math.max(0, participantIds.indexOf(speaker.id));
      const content = {
        type: 'emoji',
        frameIndex: Math.floor(Math.random() * NPC_DISCUSSION_EMOJI_FRAME_COUNT),
      };
      this.hideDiscussionBubbles(participants);
      this.showDiscussionBubble(speaker, content, now);
      leader.discussionBubbleVisibleUntil = now + NPC_DISCUSSION_BUBBLE_DURATION_MS;
      leader.discussionNextSpeakerId =
        participantIds[(speakerIndex + 1) % participantIds.length] || leader.id;
      leader.discussionNextBubbleAt =
        now + randomBetween(
          NPC_DISCUSSION_BUBBLE_INTERVAL_MIN_MS,
          NPC_DISCUSSION_BUBBLE_INTERVAL_MAX_MS
        );
    }

    if (now >= leader.modeEndsAt) {
      this.endDiscussion(participants);
    }
  }

  syncSleepBubble(npc, screenX, screenY) {
    const bubble = npc?.sleepBubble;
    if (!bubble) {
      return;
    }

    const shouldShowBubble = npc.mode === 'sleep' && !npc.isHidden;
    if (!shouldShowBubble) {
      bubble.setVisible(false);
      return;
    }

    bubble
      .setPosition(
        Math.round(screenX + NPC_SLEEP_BUBBLE_OFFSET_X),
        Math.round(screenY + NPC_SLEEP_BUBBLE_OFFSET_Y)
      )
      .setDepth(NPC_SLEEP_BUBBLE_DEPTH)
      .setVisible(true);
  }

  syncSpeechBubble(npc, screenX, screenY) {
    const bubble = npc?.speechBubble;
    const icon = npc?.speechIcon;
    const activeContent = this.getActiveSpeechBubbleContent(npc);
    const shouldShowBubble =
      !npc?.isHidden &&
      Boolean(activeContent);

    if (!bubble || !icon || !shouldShowBubble) {
      bubble?.setVisible(false);
      icon?.setVisible(false);
      return;
    }

    const bubbleX = Math.round(screenX + NPC_SPEECH_BUBBLE_OFFSET_X);
    const bubbleY = Math.round(screenY + NPC_SPEECH_BUBBLE_OFFSET_Y);
    bubble
      .setPosition(bubbleX, bubbleY)
      .setDepth(NPC_SPEECH_BUBBLE_DEPTH)
      .setVisible(true);
    icon
      .setPosition(bubbleX, bubbleY + NPC_SPEECH_ICON_OFFSET_Y)
      .setDepth(NPC_SPEECH_BUBBLE_DEPTH)
      .setVisible(true);

    if (activeContent?.type === 'emoji') {
      icon
        .setTexture(NPC_EMOJI_REACTIONS_ASSET.key, activeContent.frameIndex)
        .setDisplaySize(
          NPC_SPEECH_ICON_DISPLAY_WIDTH,
          NPC_SPEECH_ICON_DISPLAY_HEIGHT
        )
        .setVisible(true);
      return;
    }

    if (activeContent?.type === 'item') {
      const frame = this.ensureDiscussionIconFrame(activeContent.itemId);
      if (frame) {
        icon
          .setTexture(frame.textureKey, frame.frameKey)
          .setDisplaySize(
            NPC_SPEECH_ICON_DISPLAY_WIDTH,
            NPC_SPEECH_ICON_DISPLAY_HEIGHT
          )
          .setVisible(true);
      } else {
        icon.setVisible(false);
      }
      return;
    }

    icon.setVisible(false);
  }

  setNpcAnimation(npc, animationKey) {
    if (!npc?.sprite) {
      return;
    }

    if (npc.isMerchant && npc.merchantIsStatic) {
      npc.currentAnimationKey = `${npc.textureKey || 'merchant'}_static`;
      npc.sprite.setFrame(0);
      return;
    }

    const resolvedAnimationKey = npc.isMerchant
      ? npc.merchantIdleAnimationKey || getMerchantIdleAnimationKey(npc.textureKey)
      : animationKey;

    if (!this.scene.anims.exists(resolvedAnimationKey)) {
      if (npc.isMerchant) {
        console.warn(
          `[Merchant NPC] missing idle animation "${resolvedAnimationKey}" for ${npc.merchantId || npc.id}; falling back to static frame 0.`
        );
        npc.merchantIsStatic = true;
        npc.currentAnimationKey = `${npc.textureKey || 'merchant'}_static`;
        npc.sprite.setFrame(0);
        return;
      }
      return;
    }

    if (npc.currentAnimationKey === resolvedAnimationKey) {
      return;
    }

    npc.currentAnimationKey = resolvedAnimationKey;
    npc.sprite.anims.play(resolvedAnimationKey, true);
  }

  enterIdle(npc, endAt = this.scene.time.now + getRandomDuration(NPC_BEHAVIOR_CONFIG.idleDurationMs)) {
    if (String(npc.mode || '').startsWith('discussion')) {
      this.clearDiscussionState(npc);
    }
    npc.mode = 'idle';
    npc.modeEndsAt = endAt;
    npc.speed = 0;
    npc.targetX = npc.x;
    npc.targetY = npc.y;
    npc.skipSleepTransition = false;
    npc.enterFadeEndsAt = 0;
    npc.enterFadeStartedAt = 0;
    npc.doorFadeDirection = null;
    npc.lookAroundAt =
      this.scene.time.now + getRandomDuration(NPC_BEHAVIOR_CONFIG.lookAroundIntervalMs);
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.idle);
  }

  enterSit(npc) {
    npc.mode = 'sit';
    npc.modeEndsAt = this.scene.time.now + getRandomDuration(NPC_BEHAVIOR_CONFIG.sitDurationMs);
    npc.speed = 0;
    npc.targetX = npc.x;
    npc.targetY = npc.y;
    npc.skipSleepTransition = false;
    npc.lookAroundAt =
      this.scene.time.now + getRandomDuration(NPC_BEHAVIOR_CONFIG.lookAroundIntervalMs);
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.sit);
  }

  enterSleepTransition(npc) {
    if (!this.isSleepLocationSafe(npc)) {
      this.redirectUnsafeSleep(npc);
      return;
    }

    npc.mode = 'sleep_transition';
    npc.modeEndsAt = this.scene.time.now + getNpcAnimationDurationMs('wake');
    npc.speed = 0;
    npc.targetX = npc.x;
    npc.targetY = npc.y;
    npc.skipSleepTransition = false;
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.wakeReverse);
  }

  enterSleep(npc) {
    if (!this.isSleepLocationSafe(npc)) {
      this.redirectUnsafeSleep(npc);
      return;
    }

    npc.mode = 'sleep';
    npc.modeEndsAt =
      this.scene.time.now + getRandomDuration(NPC_BEHAVIOR_CONFIG.sleepDurationMs);
    npc.speed = 0;
    npc.targetX = npc.x;
    npc.targetY = npc.y;
    npc.skipSleepTransition = false;
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.sleep);
  }

  enterWake(npc) {
    npc.mode = 'wake';
    npc.modeEndsAt = this.scene.time.now + getNpcAnimationDurationMs('wake');
    npc.speed = 0;
    npc.targetX = npc.x;
    npc.targetY = npc.y;
    npc.skipSleepTransition = false;
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.wake);
  }

  enterMerchantIdle(npc) {
    npc.mode = 'merchant_idle';
    npc.modeEndsAt = Number.POSITIVE_INFINITY;
    npc.speed = 0;
    npc.targetX = npc.x;
    npc.targetY = npc.y;
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.idle);
  }

  enterHurt(npc, { skipSleepTransition = false } = {}) {
    npc.mode = 'hurt';
    npc.modeEndsAt = this.scene.time.now + getNpcAnimationDurationMs('hurt') + 250;
    npc.speed = 0;
    npc.targetX = npc.x;
    npc.targetY = npc.y;
    npc.goofyCooldownUntil = this.scene.time.now + 18000;
    npc.skipSleepTransition = skipSleepTransition;
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.hurt);
  }

  enterDeath(npc) {
    npc.mode = 'death';
    npc.modeEndsAt = this.scene.time.now + getNpcAnimationDurationMs('death') + 500;
    npc.speed = 0;
    npc.targetX = npc.x;
    npc.targetY = npc.y;
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.death);
  }

  enterWander(npc) {
    const angle = randomBetween(0, Math.PI * 2);
    const distance = randomBetween(18, NPC_BEHAVIOR_CONFIG.wanderRadius);
    const target = this.findOpenPointNearby({
      x: npc.x + Math.cos(angle) * distance,
      y: npc.y + Math.sin(angle) * distance,
    });

    npc.mode = 'wander';
    npc.modeEndsAt =
      this.scene.time.now + getRandomDuration(NPC_BEHAVIOR_CONFIG.wanderDurationMs);
    npc.speed = NPC_BEHAVIOR_CONFIG.wanderSpeed;
    npc.targetX = target.x;
    npc.targetY = target.y;
    npc.skipSleepTransition = false;
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.run);
  }

  enterDoorApproach(npc) {
    if (!this.doorManager?.getNearestDoor && !this.doorManager?.getVillageDoors) {
      this.enterWander(npc);
      return;
    }

    const door = this.pickDoorForNpc(npc);
    const approachPoint = door ? this.getDoorEntryPoint(door.id) : null;

    if (!door || !approachPoint) {
      this.logDoorEvent('missing door target', door?.id || npc?.doorId || 'no-door');
      this.enterWander(npc);
      return;
    }

    npc.doorId = door.id;
    npc.mode = 'door_approach';
    npc.modeEndsAt = this.scene.time.now + NPC_BEHAVIOR_CONFIG.doorEnterTimeoutMs;
    npc.speed = NPC_BEHAVIOR_CONFIG.wanderSpeed;
    npc.targetX = approachPoint.x;
    npc.targetY = approachPoint.y;
    npc.doorPendingRelease = false;
    npc.isHidden = false;
    npc.skipSleepTransition = false;
    this.logDoorEvent('selected', door.id);
    this.logDoorEvent('entry tile target', `${door.id} @ ${Math.round(approachPoint.x)},${Math.round(approachPoint.y)}`);
    this.logDoorEvent('approaching', door.id);
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.run);
  }

  enterDoorOpening(npc) {
    if (!npc.doorId || !this.doorManager) {
      this.enterIdle(npc);
      return;
    }

    npc.mode = 'door_enter';
    npc.modeEndsAt = this.scene.time.now + this.getDoorOpenWaitMs(
      npc.doorId,
      NPC_BEHAVIOR_CONFIG.doorEnterTimeoutMs
    );
    npc.speed = 0;
    npc.targetX = npc.x;
    npc.targetY = npc.y;
    npc.doorPendingRelease = true;
    this.logDoorEvent('opening door', npc.doorId);
    this.doorManager.enterDoor(npc, npc.doorId);
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.idle);
  }

  enterDoorInterior(npc) {
    if (!npc.doorId || !this.doorManager) {
      this.enterIdle(npc);
      return;
    }

    npc.mode = 'door_enter_fx';
    npc.modeEndsAt = this.scene.time.now + NPC_DOOR_FADE_MS;
    npc.enterFadeStartedAt = this.scene.time.now;
    npc.enterFadeEndsAt = npc.modeEndsAt;
    npc.doorFadeDirection = 'out';
    npc.speed = 0;
    npc.targetX = npc.x;
    npc.targetY = npc.y;
    this.logDoorEvent('enter fade start', npc.doorId);
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.idle);
  }

  enterDoorExit(npc) {
    if (!npc.doorId || !this.doorManager) {
      this.enterIdle(npc);
      return;
    }

    const entryPoint = this.getDoorEntryPoint(npc.doorId);
    if (entryPoint) {
      npc.x = entryPoint.x;
      npc.y = entryPoint.y;
    }
    npc.isHidden = false;
    npc.collisionBounds = getNpcBounds(npc.x, npc.y);
    npc.mode = 'door_exit_fx';
    npc.modeEndsAt = this.scene.time.now + NPC_DOOR_FADE_MS;
    npc.enterFadeStartedAt = this.scene.time.now;
    npc.enterFadeEndsAt = npc.modeEndsAt;
    npc.doorFadeDirection = 'in';
    npc.speed = 0;
    npc.targetX = npc.x;
    npc.targetY = npc.y;
    this.logDoorEvent('exiting', npc.doorId);
  }

  finishDoorExit(npc) {
    npc.enterFadeEndsAt = 0;
    npc.enterFadeStartedAt = 0;
    npc.doorFadeDirection = null;
    this.logDoorEvent('reopened', npc.doorId);
    this.logDoorEvent('exited', npc.doorId);
    npc.lastDoorId = npc.doorId;
    const cooldownMs = getRandomCooldownMs();
    npc.nextDoorAllowedAt = this.scene.time.now + cooldownMs;
    this.logDoorEvent('cooldown', `${npc.lastDoorId} ${Math.round(cooldownMs)}ms`);
    const walkAwayTarget = this.getDoorWalkAwayTarget(npc, npc.doorId);
    if (walkAwayTarget) {
      npc.mode = 'door_walk_away';
      npc.modeEndsAt = this.scene.time.now + 1800;
      npc.speed = NPC_BEHAVIOR_CONFIG.wanderSpeed;
      npc.targetX = walkAwayTarget.x;
      npc.targetY = walkAwayTarget.y;
      this.logDoorEvent('walk-away target', `${npc.lastDoorId} @ ${Math.round(walkAwayTarget.x)},${Math.round(walkAwayTarget.y)}`);
      this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.run);
    } else {
      this.enterIdle(
        npc,
        this.scene.time.now + getRandomDuration(NPC_BEHAVIOR_CONFIG.idleDurationMs) * 0.6
      );
    }
    npc.doorId = null;
  }

  resetDoorState(npc) {
    if (npc.doorId) {
      this.doorManager?.releaseDoorEntity?.(npc, npc.doorId);
    }

    npc.doorId = null;
    npc.doorPendingRelease = false;
    npc.isHidden = false;
    npc.enterFadeEndsAt = 0;
    npc.enterFadeStartedAt = 0;
    npc.doorFadeDirection = null;
  }

  enterGoofyRun(npc) {
    const collisionRects = getVillageCollisionRects();
    const nearestCollision = collisionRects
      .map((rect) => ({
        rect,
        center: getRectCenter(rect),
      }))
      .sort((left, right) => {
        const leftDistance = Phaser.Math.Distance.Between(
          npc.x,
          npc.y,
          left.center.x,
          left.center.y
        );
        const rightDistance = Phaser.Math.Distance.Between(
          npc.x,
          npc.y,
          right.center.x,
          right.center.y
        );
        return leftDistance - rightDistance;
      })[0];

    if (!nearestCollision) {
      this.enterWander(npc);
      return;
    }

    npc.mode = 'goofy_run';
    npc.modeEndsAt = this.scene.time.now + randomBetween(900, 1800);
    npc.speed = NPC_GOOFY_CRASH_SPEED;
    npc.targetX = nearestCollision.center.x;
    npc.targetY = nearestCollision.center.y;
    npc.skipSleepTransition = true;
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.run);
  }

  enterDiscussion(npc) {
    const now = this.scene.time.now;
    if (
      !this.canUseDiscussionBehavior(npc, now) ||
      Math.random() > NPC_DISCUSSION_CHANCE
    ) {
      this.enterIdle(npc);
      return;
    }

    const participants = this.pickDiscussionParticipants(npc, now);
    if (participants.length < 2) {
      this.enterWander(npc);
      return;
    }

    const started = this.startDiscussionApproach(participants);
    if (!started) {
      this.enterWander(npc);
      return;
    }
  }

  chooseNextAction(npc) {
    const now = this.scene.time.now;
    const actionKey = getWeightedActionKey();

    if (actionKey === 'wander') {
      this.enterWander(npc);
      return;
    }

    if (actionKey === 'sit') {
      this.enterSit(npc);
      return;
    }

    if (actionKey === 'discussion') {
      this.enterDiscussion(npc);
      return;
    }

    if (
      actionKey === 'door' &&
      this.canUseDoorBehavior(npc, now) &&
      Math.random() <= Math.max(
        0,
        Math.min(1, NPC_BEHAVIOR_CONFIG.doorUseChance ?? NPC_DOOR_USE_CHANCE)
      )
    ) {
      this.enterDoorApproach(npc);
      return;
    }

    if (actionKey === 'sleep') {
      this.enterSleepTransition(npc);
      return;
    }

    if (actionKey === 'goofy' && now >= npc.goofyCooldownUntil) {
      this.enterGoofyRun(npc);
      return;
    }

    this.enterIdle(npc);
  }

  enterPushRecoil(npc, direction, { aggressive = false } = {}) {
    const now = this.scene.time.now;
    const playerPosition = this.getPlayerWorldPosition();
    const intendedDirection = normalizeVector(
      direction?.x || 0,
      direction?.y || 0
    );
    const separationDirection = normalizeVector(
      npc.x - playerPosition.x,
      npc.y - playerPosition.y
    );
    const fallbackDirection = npc.facingLeft ? { x: -1, y: 0 } : { x: 1, y: 0 };
    const pushDirection =
      intendedDirection.distance > 0.001
        ? intendedDirection
        : separationDirection.distance > 0.001
          ? separationDirection
          : fallbackDirection;
    const pushDistance = Phaser.Math.Between(
      NPC_PUSH_DISTANCE_MIN_PX,
      NPC_PUSH_DISTANCE_MAX_PX
    );
    const target = this.findPushDestination(
      npc,
      pushDirection.x,
      pushDirection.y,
      pushDistance
    );

    npc.mode = 'push_recoil';
    npc.modeEndsAt = now + NPC_PUSH_RECOIL_TIMEOUT_MS;
    npc.speed = NPC_PUSH_RECOIL_SPEED;
    npc.targetX = target.x;
    npc.targetY = target.y;
    npc.pendingAggression = Boolean(aggressive);
    npc.skipSleepTransition = false;
    npc.goofyCooldownUntil = Math.max(npc.goofyCooldownUntil || 0, now + 18000);
    npc.facingLeft = pushDirection.x < 0;
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.hurt);
    this.logPushEvent('shove start', npc.id, {
      mode: aggressive ? 'aggressive' : 'annoyed',
      distance: pushDistance,
      targetX: Math.round(target.x),
      targetY: Math.round(target.y),
    });
  }

  enterPushAnnoyed(npc) {
    const now = this.scene.time.now;
    npc.mode = 'push_annoyed';
    npc.modeEndsAt = now + NPC_PUSH_REACTION_DURATION_MS;
    npc.speed = 0;
    npc.targetX = npc.x;
    npc.targetY = npc.y;
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.hurt);
  }

  enterPushFlee(npc) {
    const now = this.scene.time.now;
    const playerPosition = this.getPlayerWorldPosition();
    const fleeDirection = normalizeVector(
      npc.x - playerPosition.x,
      npc.y - playerPosition.y
    );
    const fallbackDirection = npc.facingLeft ? { x: -1, y: 0 } : { x: 1, y: 0 };
    const panicBoost = npc.pendingAggression ? 1.25 : 1;
    const fleeDistance =
      Phaser.Math.Between(
        NPC_PUSH_FLEE_DISTANCE_MIN_PX,
        NPC_PUSH_FLEE_DISTANCE_MAX_PX
      ) * panicBoost;
    const target = this.findFleeDestination(
      npc,
      fleeDirection.x || fallbackDirection.x,
      fleeDirection.y || fallbackDirection.y,
      fleeDistance
    );

    npc.mode = 'push_flee';
    npc.modeEndsAt = now + NPC_PUSH_FLEE_TIMEOUT_MS;
    npc.speed = NPC_PUSH_FLEE_SPEED * panicBoost;
    npc.targetX = target.x;
    npc.targetY = target.y;
    npc.facingLeft = (target.x - npc.x) < 0;
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.run);
    this.logPushEvent('flee start', npc.id, {
      distance: Math.round(Phaser.Math.Distance.Between(npc.x, npc.y, target.x, target.y)),
      speed: Math.round(npc.speed),
      resume: npc.resumeAfterPushMode,
    });
  }

  resumeNpcAfterPush(npc) {
    const resumeMode = npc?.resumeAfterPushMode || 'idle';
    npc.resumeAfterPushMode = 'idle';
    npc.pendingAggression = false;

    if (resumeMode === 'wander') {
      this.enterWander(npc);
      return;
    }

    if (resumeMode === 'sit') {
      this.enterSit(npc);
      return;
    }

    this.enterIdle(
      npc,
      this.scene.time.now + getRandomDuration(NPC_BEHAVIOR_CONFIG.idleDurationMs) * 0.55
    );
  }

  enterAggressiveCharge(npc) {
    const now = this.scene.time.now;
    const playerPosition = this.getPlayerWorldPosition();
    npc.mode = 'aggressive_charge';
    npc.modeEndsAt = now + NPC_PUSH_AGGRESSION_RUSH_MS;
    npc.speed = NPC_PUSH_AGGRESSION_SPEED;
    npc.targetX = playerPosition.x;
    npc.targetY = playerPosition.y;
    npc.pendingAggression = false;
    npc.pushIrritationTimestamps = [];
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.run);
  }

  enterAggressiveCollision(npc) {
    const now = this.scene.time.now;
    npc.mode = 'aggressive_collision';
    npc.modeEndsAt = now + NPC_PUSH_AGGRESSION_COLLISION_MS;
    npc.speed = 0;
    npc.targetX = npc.x;
    npc.targetY = npc.y;
    npc.pendingAggression = false;
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.hurt);
  }

  enterAggressiveCooldown(npc) {
    const now = this.scene.time.now;
    npc.mode = 'aggressive_cooldown';
    npc.modeEndsAt = now + NPC_PUSH_AGGRESSION_COOLDOWN_MS;
    npc.speed = 0;
    npc.targetX = npc.x;
    npc.targetY = npc.y;
    this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.idle);
  }

  handlePlayerNpcCollisionContact(contact) {
    const npc = this.getNpcById(contact?.npcId);
    if (!this.canNpcBeShoved(npc)) {
      return;
    }

    const now = this.scene.time.now;
    if (this.isPlayerBounceActive(now)) {
      return;
    }

    const movement = normalizeVector(
      contact?.attemptedPlayerDx || 0,
      contact?.attemptedPlayerDy || 0
    );
    if (movement.distance <= 0.001) {
      return;
    }

    if (now - (npc.lastPushContactAt || 0) > NPC_PUSH_CONTACT_GRACE_MS) {
      npc.pushContactStartedAt = now;
      npc.pushContactHits = 0;
    }

    npc.lastPushContactAt = now;
    npc.pushContactHits = (npc.pushContactHits || 0) + 1;

    const sustainedContact =
      npc.pushContactHits >= 2 ||
      now - (npc.pushContactStartedAt || now) >= NPC_PUSH_CONTACT_SUSTAIN_MS;
    if (!sustainedContact) {
      return;
    }

    if (now - (npc.lastPushAt || 0) < NPC_PUSH_COOLDOWN_MS) {
      return;
    }

    const playerBounds = this.getExpandedBounds(
      contact?.candidateBounds || this.getPlayerBounds(),
      NPC_PLAYER_COLLISION_REACH_PX
    );
    const npcBounds = this.getExpandedBounds(
      npc.collisionBounds || this.getNpcCollisionBounds(npc),
      NPC_PLAYER_COLLISION_REACH_PX
    );
    if (!playerBounds || !npcBounds || !boundsOverlap(playerBounds, npcBounds)) {
      return;
    }

    npc.lastPushAt = now;
    this.resetPushContact(npc);
    const irritationCount = this.recordPushIrritation(npc, now);
    const aggressive = irritationCount >= NPC_PUSH_IRRITATION_THRESHOLD;
    if (aggressive) {
      this.logPushEvent('aggression trigger', npc.id, irritationCount);
    }

    this.interruptNpcForPush(npc, now);
    this.showPushReactionBubble(
      npc,
      this.pickPushReactionEmoji({ angryOnly: aggressive }),
      now
    );
    this.startPlayerBounce(movement);
    this.enterPushRecoil(npc, movement, { aggressive });
  }

  tryWakeSleepingNpc(playerPosition) {
    if (!this.pendingWakeInteraction) {
      return;
    }

    this.pendingWakeInteraction = false;

    const sleepingNpc = this.npcs
      .filter((npc) => npc.mode === 'sleep' && !npc.isHidden)
      .sort((left, right) => {
        const leftDistance = Phaser.Math.Distance.Between(
          playerPosition.x,
          playerPosition.y,
          left.x,
          left.y
        );
        const rightDistance = Phaser.Math.Distance.Between(
          playerPosition.x,
          playerPosition.y,
          right.x,
          right.y
        );
        return leftDistance - rightDistance;
      })
      .find(
        (npc) =>
          Phaser.Math.Distance.Between(
            playerPosition.x,
            playerPosition.y,
            npc.x,
            npc.y
          ) <= NPC_BEHAVIOR_CONFIG.wakeInteractionRadius
      );

    if (sleepingNpc) {
      this.enterWake(sleepingNpc);
    }
  }

  moveNpcTowardTarget(npc, deltaSeconds, onBlocked, occupyOptions = null) {
    const dx = npc.targetX - npc.x;
    const dy = npc.targetY - npc.y;
    const distance = Math.hypot(dx, dy);

    if (distance <= 2) {
      return true;
    }

    const step = Math.min(distance, npc.speed * deltaSeconds);
    const directionX = dx / distance;
    const directionY = dy / distance;

    npc.facingLeft = dx < 0;

    let remainingStep = step;
    let nextX = npc.x;
    let nextY = npc.y;

    while (remainingStep > 0.001) {
      const substep = Math.min(NPC_COLLISION_STEP_PX, remainingStep);
      const candidateX = nextX + directionX * substep;
      const candidateY = nextY + directionY * substep;

      if (!this.canOccupy(candidateX, candidateY, {
        ignoreNpcId: npc.id,
        ...(occupyOptions || {}),
      })) {
        onBlocked?.();
        return false;
      }

      nextX = candidateX;
      nextY = candidateY;
      remainingStep -= substep;
    }

    npc.x = nextX;
    npc.y = nextY;
    npc.collisionBounds = getNpcBounds(npc.x, npc.y);
    return distance - step <= 2;
  }

  updateIdleFacing(npc, now) {
    if (now >= npc.lookAroundAt) {
      npc.facingLeft = !npc.facingLeft;
      npc.lookAroundAt =
        now + getRandomDuration(NPC_BEHAVIOR_CONFIG.lookAroundIntervalMs);
    }
  }

  syncNpcRender(npc, worldOffset) {
    if (npc.isHidden) {
      npc.sprite?.setVisible(false);
      npc.shadow?.setVisible(false);
      npc.sleepBubble?.setVisible(false);
      npc.speechBubble?.setVisible(false);
      npc.speechIcon?.setVisible(false);
      return;
    }

    const cam = this.scene.cameras.main;
    const screenX = Math.round(cam.width * 0.5 + (worldOffset.x || 0) + npc.x);
    const screenY = Math.round(cam.height * 0.5 + (worldOffset.y || 0) + npc.y);

    // Viewport cull: skip expensive Phaser property calls for NPCs that are
    // clearly outside the visible area.  The NPC still runs AI and movement.
    const m = NPC_VIEWPORT_CULL_MARGIN;
    if (
      screenX < -m || screenX > cam.width  + m ||
      screenY < -m || screenY > cam.height + m
    ) {
      if (npc.sprite?.visible)      npc.sprite.setVisible(false);
      if (npc.shadow?.visible)      npc.shadow.setVisible(false);
      if (npc.sleepBubble?.visible) npc.sleepBubble.setVisible(false);
      if (npc.speechBubble?.visible) npc.speechBubble.setVisible(false);
      if (npc.speechIcon?.visible)  npc.speechIcon.setVisible(false);
      return;
    }
    const entityDepth = npc.isMerchant
      ? FIXED_MERCHANT_DEPTH
      : getEntityDepthFromFeetY(screenY);
    let spriteAlpha = 1;
    let shadowAlpha = 0.42;
    let spriteVisible = true;

    if (npc.mode === 'door_enter_fx' || npc.mode === 'door_exit_fx') {
      const duration = Math.max(1, npc.enterFadeEndsAt - npc.enterFadeStartedAt);
      const progress = Phaser.Math.Clamp(
        (this.scene.time.now - npc.enterFadeStartedAt) / duration,
        0,
        1
      );
      const flickerPhase = Math.floor(
        (this.scene.time.now - npc.enterFadeStartedAt) /
        Math.max(1, NPC_DOOR_FLICKER_INTERVAL_MS)
      );
      const blinkVisible = flickerPhase % 2 === 0;
      if (npc.doorFadeDirection === 'out') {
        spriteAlpha = blinkVisible ? 1 - progress : 0;
        shadowAlpha = blinkVisible ? 0.42 * (1 - progress) : 0;
      } else {
        spriteAlpha = blinkVisible ? progress : 0;
        shadowAlpha = blinkVisible ? 0.42 * progress : 0;
      }
      spriteVisible = spriteAlpha > 0.02;
    }

    npc.sprite
      .setPosition(screenX, screenY)
      .setScale(npc.facingLeft ? -NPC_WORLD_SCALE : NPC_WORLD_SCALE, NPC_WORLD_SCALE)
      .setDepth(entityDepth)
      .setAlpha(spriteAlpha)
      .setVisible(spriteVisible);

    npc.shadow
      .setPosition(screenX, Math.round(screenY - 2))
      .setDisplaySize(NPC_SHADOW_WIDTH, NPC_SHADOW_HEIGHT)
      .setDepth(NPC_SHADOW_DEPTH)
      .setAlpha(shadowAlpha)
      .setVisible(spriteVisible);

    this.syncSleepBubble(npc, screenX, screenY);
    this.syncSpeechBubble(npc, screenX, screenY);
  }

  updateNpc(npc, deltaSeconds) {
    const now = this.scene.time.now;

    switch (npc.mode) {
      case 'merchant_idle':
        break;
      case 'idle':
        this.updateIdleFacing(npc, now);
        if (now >= npc.modeEndsAt) {
          this.chooseNextAction(npc);
        }
        break;
      case 'sit':
        this.updateIdleFacing(npc, now);
        if (now >= npc.modeEndsAt) {
          this.chooseNextAction(npc);
        }
        break;
      case 'push_recoil': {
        const reachedTarget = this.moveNpcTowardTarget(
          npc,
          deltaSeconds,
          null,
          { blockPlayer: false }
        );
        if (reachedTarget || now >= npc.modeEndsAt) {
          this.enterPushAnnoyed(npc);
        }
        break;
      }
      case 'push_annoyed':
        if (now >= npc.modeEndsAt) {
          this.enterPushFlee(npc);
        }
        break;
      case 'push_flee': {
        const reachedTarget = this.moveNpcTowardTarget(
          npc,
          deltaSeconds,
          () => this.resumeNpcAfterPush(npc),
          { blockPlayer: false }
        );
        if (reachedTarget || now >= npc.modeEndsAt) {
          this.resumeNpcAfterPush(npc);
        }
        break;
      }
      case 'wander': {
        const reachedTarget = this.moveNpcTowardTarget(npc, deltaSeconds, () =>
          this.enterIdle(npc, now + getRandomDuration(NPC_BEHAVIOR_CONFIG.idleDurationMs) * 0.4)
        );
        if (reachedTarget || now >= npc.modeEndsAt) {
          this.enterIdle(npc);
        }
        break;
      }
      case 'discussion_approach': {
        const participants = this.getDiscussionParticipants(npc);
        const leader = this.getNpcById(npc.discussionLeadId) || npc;
        if (participants.length < 2) {
          this.clearDiscussionState(npc, false);
          this.enterIdle(npc);
          break;
        }
        const ignoredNpcIds = participants.map((participant) => participant.id);

        let blockedByObstacle = false;
        const reachedTarget = this.moveNpcTowardTarget(
          npc,
          deltaSeconds,
          () => {
            blockedByObstacle = true;
          },
          { ignoreNpcIds: ignoredNpcIds }
        );
        const localReady =
          Phaser.Math.Distance.Between(npc.x, npc.y, npc.targetX, npc.targetY) <= 2;
        const everyoneReady = participants.every(
          (participant) =>
            Phaser.Math.Distance.Between(
              participant.x,
              participant.y,
              participant.targetX,
              participant.targetY
            ) <= 2
        );

        if (blockedByObstacle || now >= npc.modeEndsAt) {
          participants.forEach((participant) => {
            this.clearDiscussionState(participant, false);
            this.enterIdle(participant);
          });
          break;
        }

        if ((reachedTarget || localReady) && leader.id === npc.id && everyoneReady) {
          this.beginDiscussion(participants);
        }
        break;
      }
      case 'discussion': {
        const participants = this.getDiscussionParticipants(npc);
        if (participants.length < 2) {
          this.clearDiscussionState(npc);
          this.enterIdle(npc);
          break;
        }

        npc.speed = 0;
        npc.targetX = npc.x;
        npc.targetY = npc.y;
        if (npc.discussionLeadId === npc.id) {
          this.updateDiscussionLeader(npc, now);
        } else {
          this.syncDiscussionFacingGroup(participants);
        }
        break;
      }
      case 'discussion_exit': {
        if (now < npc.modeEndsAt) {
          break;
        }

        const participants = this.getDiscussionParticipants(npc);
        npc.speed = NPC_BEHAVIOR_CONFIG.wanderSpeed;
        npc.targetX = npc.discussionExitTargetX ?? npc.x;
        npc.targetY = npc.discussionExitTargetY ?? npc.y;
        this.setNpcAnimation(npc, NPC_ANIMATION_KEYS.run);
        const reachedTarget = this.moveNpcTowardTarget(
          npc,
          deltaSeconds,
          () => {
            this.clearDiscussionState(npc);
            this.enterIdle(npc);
          },
          {
            ignoreNpcIds: participants
              .map((participant) => participant.id)
              .filter((npcId) => npcId !== npc.id),
          }
        );
        if (reachedTarget) {
          this.clearDiscussionState(npc);
          this.enterIdle(npc);
        }
        break;
      }
      case 'door_approach': {
        if (this.isNpcAtDoorEntry(npc)) {
          this.logDoorEvent('reached door', npc.doorId);
          this.enterDoorOpening(npc);
          break;
        }

        let blockedByObstacle = false;
        const reachedTarget = this.moveNpcTowardTarget(npc, deltaSeconds, () => {
          blockedByObstacle = true;
        });
        if (reachedTarget || this.isNpcAtDoorEntry(npc)) {
          this.logDoorEvent('reached door', npc.doorId);
          this.enterDoorOpening(npc);
        } else if (blockedByObstacle || now >= npc.modeEndsAt) {
          this.logDoorEvent(blockedByObstacle ? 'approach blocked' : 'approach timeout', npc.doorId);
          this.resetDoorState(npc);
          this.enterIdle(npc);
        }
        break;
      }
      case 'door_enter':
        if (this.doorManager?.isDoorOpen(npc.doorId)) {
          this.enterDoorInterior(npc);
        } else if (now >= npc.modeEndsAt) {
          this.logDoorEvent('opening timeout', npc.doorId);
          this.resetDoorState(npc);
          this.enterIdle(npc);
        }
        break;
      case 'door_enter_fx':
        if (now >= npc.modeEndsAt) {
          npc.isHidden = true;
          npc.collisionBounds = null;
          npc.enterFadeEndsAt = 0;
          npc.enterFadeStartedAt = 0;
          npc.doorFadeDirection = null;
          if (npc.doorPendingRelease) {
            this.logDoorEvent('closing', npc.doorId);
            this.doorManager.releaseDoorEntity(npc, npc.doorId);
            npc.doorPendingRelease = false;
          }
          this.doorManager.closeDoor?.(npc.doorId);
          npc.mode = 'inside';
          npc.modeEndsAt =
            this.scene.time.now +
            getRandomDuration({ min: NPC_INSIDE_MIN_MS, max: NPC_INSIDE_MAX_MS });
          this.logDoorEvent('enter fade end', npc.doorId);
          this.logDoorEvent('entered', npc.doorId);
        }
        break;
      case 'inside':
        if (now >= npc.modeEndsAt) {
          this.enterDoorExit(npc);
        }
        break;
      case 'door_exit_fx':
        if (now >= npc.modeEndsAt) {
          this.finishDoorExit(npc);
        }
        break;
      case 'door_walk_away': {
        const reachedTarget = this.moveNpcTowardTarget(npc, deltaSeconds, () =>
          this.enterIdle(npc)
        );
        if (reachedTarget || now >= npc.modeEndsAt) {
          this.enterIdle(npc);
        }
        break;
      }
      case 'goofy_run': {
        const collided = !this.moveNpcTowardTarget(npc, deltaSeconds, () =>
          this.enterHurt(npc, { skipSleepTransition: true })
        );
        if (!collided && now >= npc.modeEndsAt) {
          this.enterIdle(npc);
        }
        break;
      }
      case 'aggressive_charge': {
        const playerPosition = this.getPlayerWorldPosition();
        npc.targetX = playerPosition.x;
        npc.targetY = playerPosition.y;

        const overlapsPlayerBeforeMove = boundsOverlap(
          npc.collisionBounds || this.getNpcCollisionBounds(npc),
          this.getPlayerBounds()
        );
        if (overlapsPlayerBeforeMove) {
          this.enterAggressiveCollision(npc);
          break;
        }

        let blockedByObstacle = false;
        const reachedTarget = this.moveNpcTowardTarget(
          npc,
          deltaSeconds,
          () => {
            blockedByObstacle = true;
          },
          { blockPlayer: false }
        );
        const overlapsPlayerAfterMove = boundsOverlap(
          npc.collisionBounds || this.getNpcCollisionBounds(npc),
          this.getPlayerBounds()
        );

        if (
          overlapsPlayerAfterMove ||
          blockedByObstacle ||
          reachedTarget ||
          now >= npc.modeEndsAt
        ) {
          this.enterAggressiveCollision(npc);
        }
        break;
      }
      case 'aggressive_collision':
        if (now >= npc.modeEndsAt) {
          this.enterAggressiveCooldown(npc);
        }
        break;
      case 'aggressive_cooldown':
        if (now >= npc.modeEndsAt) {
          this.enterIdle(
            npc,
            now + getRandomDuration(NPC_BEHAVIOR_CONFIG.idleDurationMs) * 0.5
          );
        }
        break;
      case 'hurt':
        if (now >= npc.modeEndsAt) {
          this.enterDeath(npc);
        }
        break;
      case 'death':
        if (now >= npc.modeEndsAt) {
          if (npc.skipSleepTransition) {
            this.enterSleep(npc);
          } else {
            this.enterSleepTransition(npc);
          }
        }
        break;
      case 'sleep_transition':
        if (now >= npc.modeEndsAt) {
          this.enterSleep(npc);
        }
        break;
      case 'sleep':
        if (now >= npc.modeEndsAt && Math.random() < NPC_BEHAVIOR_CONFIG.sleepWakeChance) {
          this.enterWake(npc);
        } else if (now >= npc.modeEndsAt) {
          npc.modeEndsAt = now + getRandomDuration(NPC_BEHAVIOR_CONFIG.wakeRetryDelayMs);
        }
        break;
      case 'wake':
        if (now >= npc.modeEndsAt) {
          this.enterIdle(npc);
        }
        break;
      default:
        this.enterIdle(npc);
        break;
    }
  }

  /**
   * Called by MainScene when the player enters/exits an interior.
   * Hides all exterior NPC sprites immediately and pauses the full
   * NPC update loop so behavior state doesn't drift while isolated.
   */
  setExteriorPaused(paused) {
    this._exteriorPaused = Boolean(paused);
    if (paused) {
      this.endPlayerBounce();
    }
    if (paused) {
      for (const npc of this.npcs) {
        npc.sprite?.setVisible(false);
        npc.shadow?.setVisible(false);
        npc.sleepBubble?.setVisible(false);
        npc.speechBubble?.setVisible(false);
        npc.speechIcon?.setVisible(false);
      }
    }
    // When unpausing, syncNpcRender will restore visibility on the next update tick.
  }

  update() {
    if (!this.npcs.length || this._exteriorPaused) {
      return;
    }

    const deltaSeconds = Math.min(0.05, Math.max(0.008, this.scene.game.loop.delta / 1000));
    this.updatePlayerBounce(deltaSeconds, this.scene.time.now);
    const { worldOffset } = useWorldStore.getState();
    const playerPosition = {
      x: -(worldOffset?.x || 0),
      y: -(worldOffset?.y || 0),
    };

    this.tryWakeSleepingNpc(playerPosition);

    this.npcs.forEach((npc) => {
      this.updateNpc(npc, deltaSeconds);
      npc.collisionBounds = npc.isHidden ? null : this.getNpcCollisionBounds(npc);
      this.syncNpcRender(npc, worldOffset);
    });

    if (DEBUG_NPCS) {
      this.drawDebugCollisionBoxes(worldOffset);
    }
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.pendingWakeInteraction = false;
    this.endPlayerBounce();
    setNpcCollisionContactHandler(null);
    setNpcCollisionResolver(null);

    this.npcs.forEach((npc) => {
      this.resetDoorState(npc);
      this.clearDiscussionState(npc, false);
      this.hidePushReactionBubble(npc);
      npc.sprite?.destroy();
      npc.shadow?.destroy();
      npc.sleepBubble?.destroy();
      npc.speechBubble?.destroy();
      npc.speechIcon?.destroy();
    });

    this._npcCollisionDebug?.destroy();
    this._npcCollisionDebug = null;
    this.npcs = [];
    this.scene = null;
    this.villageBounds = null;
  }
}

export function getNearestMerchant(manager, x, y, maxDistance = Infinity) {
  return manager?.getNearestMerchant?.(x, y, maxDistance) || null;
}
