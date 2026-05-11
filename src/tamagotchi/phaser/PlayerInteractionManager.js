import Phaser from 'phaser';
import { useWorldStore, isGameplayUiBlockingState } from '../store/worldSlice';
import { useShopStore } from '../store/useShopStore';
import { useBrokenObjectsStore } from '../store/brokenObjectsStore';
import { getItemDefinition } from '../config/itemsRegistry';
import { DEBUG_NPCS, NPC_FRAME_SIZE, NPC_WORLD_SCALE } from './npcConfig';
import actionBubbleUrl from '../../GameActions/Action_bubble.png';
import {
  findHarvestableCropsNearWorldPosition,
  getHarvestableCropByKey,
  harvestCropTile,
} from '../systems/FarmingInteractionSystem';
import { WORLD_ATLAS_TILE_SIZE } from '../utils/worldAtlasFamilies';

// ─── Config ──────────────────────────────────────────────────────────────────
/** World-space radius around a door/exit centre that activates the prompt. */
const INTERACTION_RANGE = 52; // px

/** World-space radius around a merchant that activates the prompt. */
const MERCHANT_INTERACTION_RANGE = 40; // px

const INTERACTION_COOLDOWN_MS = 280;
const INTERACT_PROMPT_LABEL = 'Enter / Tap to interact';

/**
 * Doors the player can actually enter.
 * Maps doorId → interiorId. Add more pairs here for future interiors.
 */
const INTERACTABLE_DOOR_MAP = new Map([
  ['house_01', 'interior_01'],
]);

/**
 * How long (ms) after entering an interior the player must wait before being
 * able to trigger the exit. Prevents instantly exiting upon spawn.
 */
const ENTRY_COOLDOWN_MS = 600;

// ─── Depths ──────────────────────────────────────────────────────────────────
const PROMPT_DEPTH = 95; // above all game content, below React UI
const INTERACTION_PROMPT_BUBBLE_SCALE = 2.35;

// ─── Asset key ───────────────────────────────────────────────────────────────
export const ACTION_BUBBLE_KEY = 'action_bubble';
export const ACTION_BUBBLE_URL = actionBubbleUrl;

function normalizeBounds(bounds) {
  if (!bounds) return null;

  const left = Number(bounds.left ?? bounds.x ?? 0);
  const top = Number(bounds.top ?? bounds.y ?? 0);
  const width = Number(bounds.width ?? ((bounds.right ?? left) - left));
  const height = Number(bounds.height ?? ((bounds.bottom ?? top) - top));
  const right = Number(bounds.right ?? (left + width));
  const bottom = Number(bounds.bottom ?? (top + height));

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function containsPoint(bounds, x, y) {
  return Boolean(
    bounds &&
      x >= bounds.left &&
      x <= bounds.right &&
      y >= bounds.top &&
      y <= bounds.bottom
  );
}

function distanceToBoundsCenter(bounds, x, y) {
  if (!bounds) return Infinity;

  const centerX = bounds.left + bounds.width * 0.5;
  const centerY = bounds.top + bounds.height * 0.5;
  return Math.hypot(centerX - x, centerY - y);
}

function getDisplayObjectBounds(displayObject) {
  if (!displayObject?.visible) return null;

  const bounds = displayObject.getBounds?.();
  if (!bounds) return null;
  return normalizeBounds(bounds);
}

function createNpcSpriteBounds(npc) {
  if (!npc) return null;

  const frameWorldSize = NPC_FRAME_SIZE * NPC_WORLD_SCALE;
  const spriteBounds = normalizeBounds({
    left: npc.x - frameWorldSize * 0.5,
    top: npc.y - frameWorldSize,
    right: npc.x + frameWorldSize * 0.5,
    bottom: npc.y,
  });

  const collisionBounds = normalizeBounds(npc.collisionBounds);
  if (!collisionBounds) return spriteBounds;

  return normalizeBounds({
    left: Math.min(spriteBounds.left, collisionBounds.left),
    top: Math.min(spriteBounds.top, collisionBounds.top),
    right: Math.max(spriteBounds.right, collisionBounds.right),
    bottom: Math.max(spriteBounds.bottom, collisionBounds.bottom),
  });
}

// ─── PlayerInteractionManager ─────────────────────────────────────────────────

export default class PlayerInteractionManager {
  /**
   * @param {Phaser.Scene} scene
   * @param {{ doorManager: VillageDoorManager, interiorManager: InteriorManager,
   *            transitionManager?: CircleTransitionManager,
   *            npcManager?: NPCManager }} deps
   */
  constructor(scene, { doorManager, interiorManager, transitionManager = null, npcManager = null }) {
    this._scene             = scene;
    this._doorManager       = doorManager;
    this._interiorManager   = interiorManager;
    this._transitionManager = transitionManager;
    this._npcManager        = npcManager;

    this._transitioning = false;
    this._enteredAt = -Infinity; // timestamp when last interior was entered
    this._interactionCooldownUntil = -Infinity;
    this._currentInteraction = null;
    this._availableInteractions = [];
    this._lastLoggedDoor = null;
    this._lastLoggedMerchant = null;
    // Tracks previous frame's shop-open state for open/close logging only.
    this._wasShopOpen = false;

    this._setupInput();
    this._setupPromptUI();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  setNpcManager(npcManager) {
    this._npcManager = npcManager;
  }

  update(worldOffset) {
    const shopOpen = Boolean(useWorldStore.getState().activeShop || useShopStore.getState().isOpen);
    if (shopOpen !== this._wasShopOpen) {
      console.info(shopOpen
        ? '[Merchant Interaction] shop open'
        : '[Merchant Interaction] shop closed/reset'
      );
      this._wasShopOpen = shopOpen;
    }

    if (this._transitioning || this._isGameplayInputBlocked()) {
      this._clearInteractions();
      this._hidePrompt();
      return;
    }

    const { type } = this._interiorManager.locationState;
    if (type === 'world') {
      this._updateWorldMode(worldOffset);
    } else {
      this._updateInteriorMode(worldOffset);
    }
  }

  destroy() {
    this._scene?.input?.off?.('pointerdown', this._handlePointerDown, this);
    this._bubble?.destroy();
    this._bubble = null;
    this._hintText?.destroy();
    this._hintText = null;
    this._currentInteraction = null;
    this._availableInteractions = [];
    this._enterKey = null;
    this._scene = null;
    this._doorManager = null;
    this._interiorManager = null;
    this._transitionManager = null;
    this._npcManager = null;
  }

  canTriggerInteraction() {
    return this._scene != null && this._scene.time.now >= this._interactionCooldownUntil;
  }

  markInteractionTriggered() {
    if (!this._scene) return;
    this._interactionCooldownUntil = this._scene.time.now + INTERACTION_COOLDOWN_MS;
  }

  // ── World mode ──────────────────────────────────────────────────────────────

  _updateWorldMode(worldOffset) {
    const playerX = -(worldOffset.x || 0);
    const playerY = -(worldOffset.y || 0);
    const interactions = [
      ...this._getDoorInteractions(playerX, playerY),
      ...this._getMerchantInteractions(playerX, playerY),
      ...this._getCropInteractions(playerX, playerY),
    ].sort((left, right) => left.dist - right.dist);

    this._setInteractions(interactions);
    this._updatePromptForCurrentInteraction();
    this._handleKeyboardInteraction();
  }

  _getDoorInteractions(playerX, playerY) {
    const doors = this._doorManager?.getVillageDoors?.() || [];
    const interactions = [];

    for (const door of doors) {
      const interiorId = INTERACTABLE_DOOR_MAP.get(door.id);
      if (!interiorId) continue;

      const bounds = normalizeBounds(door.bounds);
      if (!bounds) continue;

      const worldX = bounds.left + bounds.width * 0.5;
      const worldY = bounds.top + bounds.height * 0.5;
      const dist = Math.hypot(playerX - worldX, playerY - worldY);
      if (dist > INTERACTION_RANGE) continue;

      interactions.push({
        type: 'door',
        targetId: door.id,
        worldX,
        worldY,
        bounds,
        dist,
        showGenericPrompt: true,
        canInteract: () => this._canInteractWithDoor(door.id),
        onInteract: () => {
          this._beginEnterInterior(door.id, interiorId);
          return true;
        },
      });
    }

    return interactions;
  }

  _getMerchantInteractions(playerX, playerY) {
    const merchants = this._npcManager?.getMerchants?.() || [];
    const interactions = [];

    for (const npc of merchants) {
      const dist = Math.hypot(playerX - npc.x, playerY - npc.y);
      if (dist > MERCHANT_INTERACTION_RANGE) continue;

      interactions.push({
        type: 'merchant',
        targetId: npc.id || npc.merchantId,
        merchantId: npc.merchantId,
        shopId: npc.shopId,
        worldX: npc.x,
        worldY: npc.y,
        bounds: createNpcSpriteBounds(npc),
        dist,
        showGenericPrompt: true,
        canInteract: () => this._canInteractWithMerchant(npc.id || npc.merchantId),
        onInteract: () => {
          const activeNpc =
            this._npcManager?.getNpcById?.(npc.id) ||
            this._npcManager?.getMerchants?.()?.find?.(
              (merchant) => (merchant.id || merchant.merchantId) === (npc.id || npc.merchantId)
            ) ||
            npc;

          this._openMerchantShop(activeNpc);
          return true;
        },
      });
    }

    return interactions;
  }

  _getCropInteractions(playerX, playerY) {
    return findHarvestableCropsNearWorldPosition(playerX, playerY, INTERACTION_RANGE).map((target) => ({
      type: 'farm_crop',
      targetId: target.key,
      worldX: target.tileX * WORLD_ATLAS_TILE_SIZE + WORLD_ATLAS_TILE_SIZE * 0.5,
      worldY: target.tileY * WORLD_ATLAS_TILE_SIZE + WORLD_ATLAS_TILE_SIZE * 0.5,
      bounds: this._getCropBounds(target.tileX, target.tileY),
      dist: target.dist,
      showGenericPrompt: false,
      canInteract: () => this._canInteractWithCrop(target.key),
      onInteract: () => {
        const activeTarget = getHarvestableCropByKey(target.key);
        if (!activeTarget || !this._canInteractWithCrop(target.key)) return false;
        this._harvestCrop(activeTarget);
        return true;
      },
    }));
  }

  // ── Interior mode ────────────────────────────────────────────────────────────

  _updateInteriorMode(worldOffset) {
    const elapsed = this._scene.time.now - this._enteredAt;
    if (elapsed < ENTRY_COOLDOWN_MS) {
      this._clearInteractions();
      this._hidePrompt();
      return;
    }

    const nearExit = this._interiorManager.getNearbyExit(worldOffset, INTERACTION_RANGE);
    if (!nearExit) {
      this._clearInteractions();
      this._hidePrompt();
      return;
    }

    const bounds = normalizeBounds(nearExit);
    const worldX = bounds.left + bounds.width * 0.5;
    const worldY = bounds.top + bounds.height * 0.5;

    this._setInteractions([{
      type: 'interior_exit',
      targetId: nearExit.targetDoorId || this._interiorManager.locationState.returnDoorId || 'interior_exit',
      worldX,
      worldY,
      bounds,
      dist: 0,
      showGenericPrompt: true,
      canInteract: () => this._canInteractWithInteriorExit(nearExit.targetDoorId),
      onInteract: () => {
        this._beginExitInterior(nearExit.targetDoorId);
        return true;
      },
    }]);

    this._showPrompt();
    this._handleKeyboardInteraction();
  }

  // ── Transitions ──────────────────────────────────────────────────────────────

  _beginEnterInterior(doorId, interiorId) {
    this._transitioning = true;
    this._clearInteractions();
    this._hidePrompt();

    this._doorManager?.openDoor(doorId);

    const cam = this._scene.cameras.main;
    const cx  = cam.width * 0.5;
    const cy  = cam.height * 0.5;

    if (this._transitionManager) {
      this._transitionManager.playClose({
        centerX: cx,
        centerY: cy,
        onComplete: () => {
          this._interiorManager.enterInterior(interiorId, doorId);
          this._enteredAt = this._scene.time.now;
          this._transitionManager.playOpen({
            centerX: cx,
            centerY: cy,
            onComplete: () => { this._transitioning = false; },
          });
        },
      });
    } else {
      const animMs = this._doorManager?.getDoorAnimationDurationMs(doorId) || 0;
      this._scene.time.delayedCall(Math.max(animMs, 200), () => {
        this._interiorManager.enterInterior(interiorId, doorId);
        this._enteredAt = this._scene.time.now;
        this._transitioning = false;
      });
    }
  }

  _beginExitInterior(targetDoorId) {
    this._transitioning = true;
    this._clearInteractions();
    this._hidePrompt();

    const cam = this._scene.cameras.main;
    const cx  = cam.width * 0.5;
    const cy  = cam.height * 0.5;

    if (this._transitionManager) {
      this._transitionManager.playClose({
        centerX: cx,
        centerY: cy,
        onComplete: () => {
          this._interiorManager.exitInterior(targetDoorId);
          this._transitionManager.playOpen({
            centerX: cx,
            centerY: cy,
            onComplete: () => { this._transitioning = false; },
          });
        },
      });
    } else {
      this._scene.time.delayedCall(200, () => {
        this._interiorManager.exitInterior(targetDoorId);
        this._transitioning = false;
      });
    }
  }

  // ── Input helpers ───────────────────────────────────────────────────────────

  _setupInput() {
    this._enterKey = this._scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ENTER
    );
    this._scene.input.on('pointerdown', this._handlePointerDown, this);
  }

  _handleKeyboardInteraction() {
    if (!this._currentInteraction) return;
    if (!Phaser.Input.Keyboard.JustDown(this._enterKey)) return;
    this._triggerInteraction(this._currentInteraction);
  }

  _handlePointerDown(pointer) {
    if (!pointer || this._isGameplayInputBlocked()) return;

    const button = pointer.event?.button;
    if (button != null && button !== 0) return;

    const screenInteraction = this._findScreenInteraction(pointer.x, pointer.y);
    if (screenInteraction) {
      this._triggerInteraction(screenInteraction);
      return;
    }

    const worldPoint = this._screenToWorldPoint(pointer.x, pointer.y);
    const worldInteraction = this._findWorldInteraction(worldPoint.x, worldPoint.y);
    if (!worldInteraction) return;
    this._triggerInteraction(worldInteraction);
  }

  _triggerInteraction(interaction) {
    if (!interaction || this._transitioning || this._isGameplayInputBlocked()) return false;
    if (!this.canTriggerInteraction()) return false;
    if (typeof interaction.canInteract === 'function' && !interaction.canInteract()) return false;

    this.markInteractionTriggered();
    return interaction.onInteract?.() !== false;
  }

  _findScreenInteraction(screenX, screenY) {
    const cropBubbleInteraction = this._availableInteractions
      .filter((interaction) => interaction.type === 'farm_crop')
      .map((interaction) => ({
        interaction,
        bounds: this._getCropBubbleBounds(interaction.targetId),
      }))
      .filter(({ bounds }) => containsPoint(bounds, screenX, screenY))
      .sort((left, right) => (
        distanceToBoundsCenter(left.bounds, screenX, screenY) -
        distanceToBoundsCenter(right.bounds, screenX, screenY)
      ))[0];

    if (cropBubbleInteraction) {
      return cropBubbleInteraction.interaction;
    }

    if (!this._currentInteraction?.showGenericPrompt) return null;

    const promptBounds = getDisplayObjectBounds(this._bubble);
    if (containsPoint(promptBounds, screenX, screenY)) {
      return this._currentInteraction;
    }

    return null;
  }

  _findWorldInteraction(worldX, worldY) {
    const hit = this._availableInteractions
      .filter((interaction) => containsPoint(interaction.bounds, worldX, worldY))
      .sort((left, right) => (
        Math.hypot(left.worldX - worldX, left.worldY - worldY) -
        Math.hypot(right.worldX - worldX, right.worldY - worldY)
      ))[0];

    return hit || null;
  }

  // ── Interaction state ───────────────────────────────────────────────────────

  _setInteractions(interactions) {
    this._availableInteractions = interactions;
    this._currentInteraction = interactions[0] || null;
  }

  _clearInteractions() {
    this._availableInteractions = [];
    this._currentInteraction = null;
    this._lastLoggedDoor = null;
    this._lastLoggedMerchant = null;
  }

  _updatePromptForCurrentInteraction() {
    const interaction = this._currentInteraction;

    if (interaction?.type === 'door') {
      if (this._lastLoggedDoor !== interaction.targetId) {
        console.info('[Player Interaction] near door:', interaction.targetId);
        this._lastLoggedDoor = interaction.targetId;
      }
      this._lastLoggedMerchant = null;
    } else if (interaction?.type === 'merchant') {
      if (this._lastLoggedMerchant !== interaction.merchantId) {
        if (DEBUG_NPCS) {
          console.info('[Merchant Interaction] near:', interaction.merchantId, interaction.shopId);
        }
        this._lastLoggedMerchant = interaction.merchantId;
      }
      this._lastLoggedDoor = null;
    } else {
      this._lastLoggedDoor = null;
      this._lastLoggedMerchant = null;
    }

    if (interaction?.showGenericPrompt) {
      this._showPrompt();
    } else {
      this._hidePrompt();
    }
  }

  _isGameplayInputBlocked() {
    const worldState = useWorldStore.getState();
    return Boolean(
      isGameplayUiBlockingState(worldState) ||
      useShopStore.getState().isOpen
    );
  }

  // ── Interaction validation ─────────────────────────────────────────────────

  _canInteractWithDoor(doorId) {
    if (this._interiorManager.locationState.type !== 'world') return false;

    const door = this._doorManager?.getDoorById?.(doorId);
    const bounds = normalizeBounds(door?.bounds);
    if (!bounds || !INTERACTABLE_DOOR_MAP.has(doorId)) return false;

    const playerPoint = this._getPlayerWorldPoint();
    const centerX = bounds.left + bounds.width * 0.5;
    const centerY = bounds.top + bounds.height * 0.5;
    return Math.hypot(playerPoint.x - centerX, playerPoint.y - centerY) <= INTERACTION_RANGE;
  }

  _canInteractWithMerchant(targetId) {
    if (this._interiorManager.locationState.type !== 'world') return false;

    const npc =
      this._npcManager?.getNpcById?.(targetId) ||
      this._npcManager?.getMerchants?.()?.find?.(
        (merchant) => (merchant.id || merchant.merchantId) === targetId
      );
    if (!npc || npc.isHidden || !npc.isMerchant) return false;

    const playerPoint = this._getPlayerWorldPoint();
    return Math.hypot(playerPoint.x - npc.x, playerPoint.y - npc.y) <= MERCHANT_INTERACTION_RANGE;
  }

  _canInteractWithCrop(tileKey) {
    if (this._interiorManager.locationState.type !== 'world') return false;

    const target = getHarvestableCropByKey(tileKey);
    if (!target) return false;

    const playerPoint = this._getPlayerWorldPoint();
    const centerX = target.tileX * WORLD_ATLAS_TILE_SIZE + WORLD_ATLAS_TILE_SIZE * 0.5;
    const centerY = target.tileY * WORLD_ATLAS_TILE_SIZE + WORLD_ATLAS_TILE_SIZE * 0.5;
    return Math.hypot(playerPoint.x - centerX, playerPoint.y - centerY) <= INTERACTION_RANGE;
  }

  _canInteractWithInteriorExit(targetDoorId) {
    if (this._interiorManager.locationState.type !== 'interior') return false;
    if (this._scene.time.now - this._enteredAt < ENTRY_COOLDOWN_MS) return false;

    const worldOffset = useWorldStore.getState().worldOffset || { x: 0, y: 0 };
    const nearExit = this._interiorManager.getNearbyExit(worldOffset, INTERACTION_RANGE);
    if (!nearExit) return false;
    if (targetDoorId == null) return true;
    return nearExit.targetDoorId === targetDoorId;
  }

  // ── Interaction actions ────────────────────────────────────────────────────

  _openMerchantShop(npc) {
    if (DEBUG_NPCS) {
      console.info('[Merchant Interaction] open shop:', npc.shopId, 'merchantId:', npc.merchantId);
    }
    this._hidePrompt();
    useShopStore.getState().openShop(npc.merchantId);
    // Keep worldSlice in sync for any legacy readers
    useWorldStore.getState().openShop(npc.merchantId, npc.shopId);
  }

  _harvestCrop(target) {
    const resolvedTarget = target?.key ? getHarvestableCropByKey(target.key) : null;
    if (!resolvedTarget) return;

    const result = harvestCropTile(resolvedTarget.key);
    if (!result) return;

    this._hidePrompt();
    const foodLabel = getItemDefinition(result.foodItemId)?.name || result.cropId;
    const seedLabel = getItemDefinition(result.seedItemId)?.name || `${result.cropId} seed`;
    useBrokenObjectsStore.getState().showWorldFeedback(
      `+${result.foodAmount || 0} ${foodLabel} • +${result.seedAmount || 0} ${seedLabel}`
    );
    if (import.meta.env.DEV) {
      console.info('[Farm Interaction] harvested crop:', result.cropId, resolvedTarget.key);
    }
  }

  // ── UI helpers ──────────────────────────────────────────────────────────────

  _setupPromptUI() {
    const scene = this._scene;
    const cam   = scene.cameras.main;
    const cx    = cam.width * 0.5;
    const cy    = cam.height * 0.5;

    scene.textures
      .get(ACTION_BUBBLE_KEY)
      ?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);

    this._bubble = scene.add
      .image(cx, cy - 34, ACTION_BUBBLE_KEY)
      .setScrollFactor(0)
      .setDepth(PROMPT_DEPTH)
      .setScale(INTERACTION_PROMPT_BUBBLE_SCALE)
      .setVisible(false);

    this._hintText = scene.add
      .text(cx, cam.height - 16, INTERACT_PROMPT_LABEL, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#00000099',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(PROMPT_DEPTH)
      .setVisible(false);
  }

  _showPrompt() {
    this._bubble?.setVisible(true);
    this._hintText?.setVisible(true);
  }

  _hidePrompt() {
    this._bubble?.setVisible(false);
    this._hintText?.setVisible(false);
  }

  // ── Geometry helpers ────────────────────────────────────────────────────────

  _getCropBounds(tileX, tileY) {
    const tileWorldX = tileX * WORLD_ATLAS_TILE_SIZE;
    const tileWorldY = tileY * WORLD_ATLAS_TILE_SIZE;

    return normalizeBounds({
      left: tileWorldX,
      top: tileWorldY - WORLD_ATLAS_TILE_SIZE,
      right: tileWorldX + WORLD_ATLAS_TILE_SIZE,
      bottom: tileWorldY + WORLD_ATLAS_TILE_SIZE,
    });
  }

  _getCropBubbleBounds(tileKey) {
    const bubbleEntry = this._scene?.getFarmReadyBubbleEntry?.(tileKey);
    return getDisplayObjectBounds(bubbleEntry?.bubble);
  }

  _screenToWorldPoint(screenX, screenY) {
    const cam = this._scene.cameras.main;
    const worldOffset = useWorldStore.getState().worldOffset || { x: 0, y: 0 };

    return {
      x: screenX - cam.width * 0.5 - (worldOffset.x || 0),
      y: screenY - cam.height * 0.5 - (worldOffset.y || 0),
    };
  }

  _getPlayerWorldPoint() {
    const worldOffset = useWorldStore.getState().worldOffset || { x: 0, y: 0 };
    return {
      x: -(worldOffset.x || 0),
      y: -(worldOffset.y || 0),
    };
  }
}
