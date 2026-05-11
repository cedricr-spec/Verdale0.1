import Phaser from 'phaser';
import {
  WORLD_ATLAS_TEXTURES,
  WORLD_VILLAGE_TEXTURES,
  CHARACTER_SHADOW_ASSET,
  MERCHANT_NPC_SPRITESHEET_ASSET,
  NPC_BASIC_SPRITESHEET_ASSET,
  NPC_SPEECH_BUBBLE_ASSET,
  NPC_SLEEP_BUBBLES_ASSET,
  NPC_EMOJI_REACTIONS_ASSET,
  ALL_ASSETS,
} from './assetManifest';
import {
  WORLD_ATLAS_DATA,
  applyWorldAtlasObjectState,
  createWorldAtlasStumpRenderItem,
} from '../utils/worldAtlasData';
import { getWorldAtlasLayout, primeWorldAtlasWindow, getStartupPreloadChunks } from '../utils/worldAtlasFamilies';
import { WORLD_SEASON_IDS } from '../config/worldSeasonConfig';
import { getItemWorldSprite, getItemSprite } from '../config/itemSpriteRegistry';
import { getItemDefinition } from '../config/itemsRegistry';
import { getItemSpriteAsset } from '../config/itemSprites';
import { useWorldStore, setWorldMovementResolver } from '../store/worldSlice';
import { useEntityStore } from '../store/entitySlice';
import { useBrokenObjectsStore } from '../store/brokenObjectsStore';
import { useWorldFxStore } from '../store/worldFxStore';
import { useCharacterStore } from '../store/useCharacterStore';
import { getPhaserDebugFlags, setPhaserDebugFlag } from './phaserDebugFlags';
import PhaserPet from './PhaserPet';
import NPCManager from './NPCManager';
import VillageDoorManager from './VillageDoorManager';
import axeSlashSheet from '../../spritesheets/fx/attacks/Hslash1.png';
import pickaxeSlashSheet from '../../spritesheets/fx/attacks/VslashSmall1.png';
import hourglassCursorUrl from '../../hud/Cursors & Pointers.png';
import farmReadyBubbleUrl from '../../spritesheets/farming/ready_to_farm_bubble.png';
import StartupPreloadSystem, { HOURGLASS_TEXTURE_KEY } from './StartupPreloadSystem';
import { useFarmingStore } from '../store/useFarmingStore';
import {
  getCropDeadSpriteInfo,
  FARMING_TEXTURES,
  FARMING_CROP_TILES_KEY,
  FARMING_CROP_OBJECTS_KEY,
  getCropFoodSpriteInfo,
  getSoilSpriteInfo,
  getCropSpriteInfo,
  getSoilStateKey,
  MAX_GROWTH_STAGE,
} from '../utils/farmingAtlasData';
import { WORLD_ATLAS_TILE_SIZE } from '../utils/worldAtlasFamilies';
import { startSpawnSystem } from '../systems/SpawnSystem';
import { startVisibilitySystem } from '../systems/VisibilitySystem';
import { startCleanupSystem } from '../systems/CleanupSystem';
import { startInteractionSystem } from '../systems/InteractionSystem';
import {
  DEBUG_PLAYER_COLLISION,
  getCollisionDebugState,
  getPetCollisionBounds,
  startCollisionSystem,
} from '../systems/CollisionSystem';
import { startWorldInteractionSystem } from '../systems/WorldInteractionSystem';
import { startFarmingInteractionSystem } from '../systems/FarmingInteractionSystem';
import CircleTransitionManager from './CircleTransitionManager';
import {
  CHUNK_GENERATION_BUDGET_MS,
  CHUNK_PREWARM_STEPS_PER_FRAME,
  CHUNK_TEXTURE_CACHE_ENABLED,
  DEBUG_CHUNK_PERFORMANCE,
  DEBUG_CHUNK_SLOW_THRESHOLD_MS,
  DEBUG_PERFORMANCE_PROFILER,
  DEBUG_RENDER_PERFORMANCE,
  PERFORMANCE_SLOW_FRAME_MS,
  PERFORMANCE_SLOW_SECTION_MS,
  RENDER_SLOW_THRESHOLD_MS,
  VILLAGE_STATIC_CACHE_ENABLED,
} from '../config/worldStreamingConfig';
import ChunkTextureCache from './ChunkTextureCache';
import InteriorManager from './InteriorManager';
import PlayerInteractionManager, {
  ACTION_BUBBLE_KEY,
  ACTION_BUBBLE_URL,
} from './PlayerInteractionManager';
import {
  DEBUG_VILLAGE_COLLISION,
  DEBUG_VILLAGE_DEPTH,
  getVillageCollisionRects,
  getVillageDepthRects,
  getVillageDoorStateVersion,
  getVillageTextureKeyForTheme,
  getVillageViewportWorldBounds,
  visitVillageRenderTiles,
} from '../utils/worldVillage';
import { DEBUG_NPCS } from './npcConfig';
import {
  FARM_READY_BUBBLE_DEPTH,
  CHARACTER_BODY_DEPTH,
  CHARACTER_SHADOW_DEPTH,
  VILLAGE_FRONT_DEPTH,
  VILLAGE_MID_DEPTH,
  VILLAGE_SHADOW_MASK_DEPTH,
  WORLD_TERRAIN_DEPTH,
} from './renderDepths';

const THEME_TO_ATLAS_KEY = {
  [WORLD_SEASON_IDS.SPRING]: 'atlas_spring',
  [WORLD_SEASON_IDS.SUMMER]: 'atlas_summer',
  [WORLD_SEASON_IDS.AUTUMN]: 'atlas_autumn',
  [WORLD_SEASON_IDS.WINTER]: 'atlas_winter',
};
const ACTIVE_WORLD_RENDERER_ID = 'phaser';
const ACTIVE_WORLD_RENDERER_LOG = '[World Renderer] Phaser active';

// Entity sprites rendered at 2× (matches React Entity.jsx ENTITY_SCALE).
const ENTITY_SCALE = 2;

const WORLD_FX_TEXTURES = {
  axe_slash: {
    key: 'fx_axe_slash',
    url: axeSlashSheet,
    frameWidth: 64,
    frameHeight: 32,
    frames: 5,
    renderScale: 2,
    frameDurationMs: 70,
    verticalOffsetY: 0,
  },
  pickaxe_slash: {
    key: 'fx_pickaxe_slash',
    url: pickaxeSlashSheet,
    frameWidth: 32,
    frameHeight: 48,
    frames: 4,
    renderScale: 2,
    frameDurationMs: 70,
    verticalOffsetY: 10,
  },
};

const FARM_READY_BUBBLE_TEXTURE_KEY = 'farm_ready_bubble';

function getDepthSplitYForEntry(entry) {
  const frontY = Number(entry?.depthSplit?.frontY);
  if (Number.isFinite(frontY) && frontY > 0) return frontY;

  const explicitSplit = Number(entry?.depth?.splitY);
  if (Number.isFinite(explicitSplit) && explicitSplit > 0) return explicitSplit;

  const id = entry?.id || entry?.name || '';
  if (/^tree_48x40_/.test(id)) return 34;
  if (/^tree_48x51_/.test(id)) return 46;
  if (/^tree_48x72_/.test(id)) return 58;
  return null;
}

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  preload() {
    let errorCount = 0;
    this.load.on('loaderror', (file) => {
      errorCount++;
      console.warn(`[Phaser] Failed to load asset: "${file.key}" (${file.src || file.url})`);
    });

    if (import.meta.env.DEV) {
      console.log(
        '[Phaser] preload() starting, loading',
        WORLD_ATLAS_TEXTURES.length,
        'atlas textures:',
        WORLD_ATLAS_TEXTURES.map(a => a.key)
      );
    }

    for (const { key, url } of WORLD_ATLAS_TEXTURES) {
      if (import.meta.env.DEV) {
        console.log(`[Phaser] Queueing load: "${key}"`);
      }
      this.load.image(key, url);
    }

    for (const { key, url } of WORLD_VILLAGE_TEXTURES) {
      if (import.meta.env.DEV) {
        console.log(`[Phaser] Queueing village load: "${key}"`);
      }
      this.load.image(key, url);
    }

    this.load.image(CHARACTER_SHADOW_ASSET.key, CHARACTER_SHADOW_ASSET.url);
    this.load.spritesheet(
      NPC_BASIC_SPRITESHEET_ASSET.key,
      NPC_BASIC_SPRITESHEET_ASSET.url,
      {
        frameWidth: NPC_BASIC_SPRITESHEET_ASSET.frameWidth,
        frameHeight: NPC_BASIC_SPRITESHEET_ASSET.frameHeight,
      }
    );
    this.load.spritesheet(
      MERCHANT_NPC_SPRITESHEET_ASSET.key,
      MERCHANT_NPC_SPRITESHEET_ASSET.url,
      {
        frameWidth: MERCHANT_NPC_SPRITESHEET_ASSET.frameWidth,
        frameHeight: MERCHANT_NPC_SPRITESHEET_ASSET.frameHeight,
      }
    );
    this.load.spritesheet(
      NPC_SLEEP_BUBBLES_ASSET.key,
      NPC_SLEEP_BUBBLES_ASSET.url,
      {
        frameWidth: NPC_SLEEP_BUBBLES_ASSET.frameWidth,
        frameHeight: NPC_SLEEP_BUBBLES_ASSET.frameHeight,
      }
    );
    this.load.image(
      NPC_SPEECH_BUBBLE_ASSET.key,
      NPC_SPEECH_BUBBLE_ASSET.url
    );
    this.load.spritesheet(
      NPC_EMOJI_REACTIONS_ASSET.key,
      NPC_EMOJI_REACTIONS_ASSET.url,
      {
        frameWidth: NPC_EMOJI_REACTIONS_ASSET.frameWidth,
        frameHeight: NPC_EMOJI_REACTIONS_ASSET.frameHeight,
      }
    );
    this.load.once('complete', () => {
      this.textures.get(NPC_EMOJI_REACTIONS_ASSET.key)?.setFilter?.(
        Phaser.Textures.FilterMode.NEAREST
      );
    });

    Object.values(WORLD_FX_TEXTURES).forEach((fx) => {
      this.load.image(fx.key, fx.url);
    });

    this.load.image(HOURGLASS_TEXTURE_KEY, hourglassCursorUrl);
    this.load.image(ACTION_BUBBLE_KEY, ACTION_BUBBLE_URL);
    this.load.image(FARM_READY_BUBBLE_TEXTURE_KEY, farmReadyBubbleUrl);

    for (const { key, url } of FARMING_TEXTURES) {
      this.load.image(key, url);
    }
    this.load.once('complete', () => {
      this.textures.get(FARM_READY_BUBBLE_TEXTURE_KEY)?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
      for (const { key } of FARMING_TEXTURES) {
        this.textures.get(key)?.setFilter?.(Phaser.Textures.FilterMode.NEAREST);
      }
    });

    if (import.meta.env.DEV) {
      const originalComplete = this.load.complete;
      this.load.once('complete', () => {
        const loaded = ALL_ASSETS.filter((a) => this.textures.exists(a.key)).map((a) => a.key);
        console.log(
          `[Phaser] Load complete. Assets ready (${loaded.length}/${ALL_ASSETS.length}):`,
          loaded,
          `(${errorCount} errors)`
        );
        this._assetsLoaded = true;
      });
    }

    if (import.meta.env.DEV) {
      console.log('[Phaser] preload() finish - about to call load.start()');
    }
  }

  create() {
    const cam = this.cameras.main;

    this._setupViewportTerrain(cam);
    this._setupPhaserEntityLayer();
    this._setupWorldFxLayer();
    this._setupFarmReadyBubbleLayer();
    this._setupPhaserPlayer();
    this._setupVillageDoorManager();
    this._setupNpcManager();
    this._interiorManager = new InteriorManager(this);
    this._circleTransitionManager = new CircleTransitionManager(this);
    this._playerInteractionManager = new PlayerInteractionManager(this, {
      doorManager:       this._villageDoorManager,
      interiorManager:   this._interiorManager,
      transitionManager: this._circleTransitionManager,
      npcManager:        this._npcManager,
    });
    // Track interior mode transitions for world-layer visibility toggling
    this._wasInInterior = false;
    if (import.meta.env.DEV) {
      this._setupPlayerMarker(cam);
      this._setupEntityMarkers();
    }
    this._setupDebugHandles();
    this._setupVillageCollisionDebug();
    const flags = getPhaserDebugFlags();
    window.phaserDebug.showViewportTerrain = flags.showViewportTerrain;
    window.phaserDebug.renderMode = flags.renderMode;
    window.phaserDebug.showPhaserEntityLayer = flags.showPhaserEntityLayer;
    window.phaserDebug.hideReactEntityLayer = flags.hideReactEntityLayer;
    window.phaserDebug.showPhaserPlayer = flags.showPhaserPlayer;
    this._runtimeDisposers = [
      startSpawnSystem(),
      startVisibilitySystem(),
      startCleanupSystem(),
      startInteractionSystem(),
      startCollisionSystem(),
      startWorldInteractionSystem(),
      startFarmingInteractionSystem(),
    ].filter(Boolean);
    this._pendingBrokenObjectRedraw = false;
    this._runtimeDisposers.push(
      useBrokenObjectsStore.subscribe((state) => state.objectStateRevision, () => {
        this._pendingBrokenObjectRedraw = true;
      })
    );
    if (typeof window !== 'undefined') {
      window.__WORLD_RENDERER__ = ACTIVE_WORLD_RENDERER_ID;
      if (!window.__PHASER_WORLD_RENDERER_LOGGED__) {
        console.info(ACTIVE_WORLD_RENDERER_LOG);
        window.__PHASER_WORLD_RENDERER_LOGGED__ = true;
      }
    }

    this.add.text(8, cam.height - 20, 'Phaser running', {
      font: '10px monospace',
      fill: '#ffffff',
      alpha: 0.45,
      backgroundColor: 'rgba(0,0,0,0)',
    }).setScrollFactor(0).setDepth(100);

    // Startup: prewarm initial chunks behind a loading overlay, then iris-reveal.
    this._startupPreload = new StartupPreloadSystem(this, {
      onComplete: () => {
        this._startupPreload = null;

        if (import.meta.env.DEV) {
          // Report how many preload-range chunks remain uncached after startup.
          // Should be 0; any positive value means the startup queue missed some.
          const _vp = { width: cam.width, height: cam.height };
          const _info = getStartupPreloadChunks(0, 0, WORLD_ATLAS_DATA, _vp);
          console.info(
            `[Startup] remaining after prewarm: ${_info.missingCount}/${_info.totalCount}` +
            ` (expect 0 — if >0 the preload range was not fully covered)`
          );
        }

        // Cooldown: skip/limit runtime prewarm for 2.5 s so the first frames
        // after iris-open never see a buildChunkLayout burst.
        this._startupCooldownUntil = performance.now() + 2500;
        this._debugPrewarmStart    = performance.now();

        this._circleTransitionManager.playOpen({
          centerX: cam.width  * 0.5,
          centerY: cam.height * 0.5,
          duration: 600,
        });
      },
    });
    this._startupPreload.startLoading();

    if (import.meta.env.DEV) {
      console.log('[Phaser MainScene] Created successfully');
    }
  }

  // ─── Viewport terrain ────────────────────────────────────────────────────────

  _setupViewportTerrain(cam) {
    // depth 1 so entity sprites (depth 50) and player (depth 55) render above terrain.
    this._viewportTerrainRT = this.add
      .renderTexture(0, 0, cam.width, cam.height)
      .setOrigin(0, 0)
      .setDepth(WORLD_TERRAIN_DEPTH)
      .setScrollFactor(0)
      .setVisible(false);

    this._viewportVillageMidRT = this.add
      .renderTexture(0, 0, cam.width, cam.height)
      .setOrigin(0, 0)
      .setDepth(VILLAGE_MID_DEPTH)
      .setScrollFactor(0)
      .setVisible(false);

    this._viewportVillageShadowMaskRT = this.add
      .renderTexture(0, 0, cam.width, cam.height)
      .setOrigin(0, 0)
      .setDepth(VILLAGE_SHADOW_MASK_DEPTH)
      .setScrollFactor(0)
      .setVisible(false);

    this._viewportFrontRT = this.add
      .renderTexture(0, 0, cam.width, cam.height)
      .setOrigin(0, 0)
      .setDepth(VILLAGE_FRONT_DEPTH)
      .setScrollFactor(0)
      .setVisible(false);

    // Phaser 4: RenderTexture.renderMode defaults to 'render', which ONLY displays
    // the current GL texture — it never calls render() to process the command buffer.
    // 'all' mode calls render() (processes draw/stamp/clear commands) then displays.
    // Without this, every rt.stamp() / rt.draw() call is buffered but never executed,
    // leaving the RT permanently transparent (black).
    this._viewportTerrainRT.setRenderMode('all');
    this._viewportVillageMidRT.setRenderMode('all');
    this._viewportVillageShadowMaskRT.setRenderMode('all');
    this._viewportFrontRT.setRenderMode('all');

    this._decorFrameKeyCache = new Map();

    this._lastWorldOffset = null;
    this._lastTheme = null;
    this._lastAnimationTick = -1;
    this._lastBrokenObjectsSignature = '';
    this._drawnTileCount = 0;

    // Village dirty tracking — separate from terrain dirty so that pure
    // animation ticks don't force a full village re-stamp (saves 3 RT passes).
    this._lastVillageWxRounded = null;
    this._lastVillageWyRounded = null;
    this._lastVillageDoorVersion = -1;
    this._lastVillageThemeKey = null;

    // Prewarm direction — track last player position to derive movement direction.
    this._prewarmLastPx = null;
    this._prewarmLastPy = null;

    // Cached animation-presence flag — updated inside _drawViewportObjects when
    // layout is refreshed, consumed in update() to avoid per-frame .some() scans.
    this._cachedHasAnimations = false;

    // Last brokenObjects state reference — identity check replaces JSON.stringify.
    this._lastBrokenState = null;

    // Farming dirty tracking — revision counter from useFarmingStore
    this._lastFarmingRevision = -1;
    // Per-texture farming frame caches (mirrors _decorFrameKeyCache for atlas)
    this._farmingFrameCaches = new Map();

    // Entity sync rounded-pixel trackers to avoid sub-pixel syncs.
    this._lastEntitySyncRoundedX = null;
    this._lastEntitySyncRoundedY = null;

    // Per-chunk RenderTexture cache for static tile layers.
    this._chunkTextureCache = CHUNK_TEXTURE_CACHE_ENABLED ? new ChunkTextureCache(this) : null;

    // Debug one-shot flags (dev only).
    this._loggedFirstTerrainDraw = false;
    this._warnedTerrainInvisible = false;

    // Post-startup prewarm cooldown (set in create() onComplete, read in update).
    // Infinity means "loading not yet done — skip runtime prewarm entirely".
    this._startupCooldownUntil = Infinity;
    // First-5-s runtime prewarm counter (dev only).
    this._debugPrewarmStart  = null;
    this._debugPrewarmChunks = 0;
    this._debugPrewarmLogged = false;
  }

  _ensureRTSize(cam) {
    const resizeRT = (rt) => {
      if (!rt) return;
      if (rt.width !== cam.width || rt.height !== cam.height) {
        rt.resize(cam.width, cam.height);
      }
    };

    resizeRT(this._viewportTerrainRT);
    resizeRT(this._viewportVillageMidRT);
    resizeRT(this._viewportVillageShadowMaskRT);
    resizeRT(this._viewportFrontRT);
  }

  _drawViewportTerrain(worldOffset, theme, { villageDirty = true } = {}) {
    const cam = this.cameras.main;
    const atlasKey = THEME_TO_ATLAS_KEY[theme] || 'atlas_spring';

    this._ensureRTSize(cam);

    if (!this.textures.exists(atlasKey)) {
      if (import.meta.env.DEV && !this._warnedMissingTexture) {
        console.warn(
          `[Phaser] Atlas texture "${atlasKey}" not loaded. Drawing fallback color. ` +
          `Available textures: ${JSON.stringify(Array.from(this.textures.keys()).filter(Boolean))}`
        );
        this._warnedMissingTexture = true;
      }

      const fallbackColors = {
        spring: 0x75ad4c,
        summer: 0x6eaf48,
        autumn: 0x8e7b41,
        winter: 0x8ba6b5,
      };
      const themeId = theme === 'winter' ? 'winter'
        : theme === 'autumn' ? 'autumn'
        : theme === 'summer' ? 'summer'
        : 'spring';
      const color = fallbackColors[themeId] || 0x75ad4c;

      this._viewportTerrainRT.clear();
      this._viewportTerrainRT.fill(color);
      this._viewportVillageMidRT?.clear();
      this._viewportVillageShadowMaskRT?.clear();
      this._viewportFrontRT?.clear();
      this._drawnTileCount = 0;
      return;
    }

    this._warnedMissingTexture = false;

    const rt = this._viewportTerrainRT;
    const midRT = this._viewportVillageMidRT;
    const shadowMaskRT = this._viewportVillageShadowMaskRT;
    const frontRT = this._viewportFrontRT;
    rt.clear();
    // When VILLAGE_STATIC_CACHE_ENABLED and the village hasn't changed, keep the
    // existing mid/shadow RT content and skip their expensive re-stamp passes.
    // The front RT cannot be treated the same way because it also contains
    // foreground object tops (tree foliage, tall decor), which must refresh
    // immediately when broken-object state changes without requiring movement.
    const skipCachedVillagePasses = VILLAGE_STATIC_CACHE_ENABLED && !villageDirty;
    frontRT?.clear();
    if (!skipCachedVillagePasses) {
      midRT?.clear();
      shadowMaskRT?.clear();
    }
    const playerBounds = getPetCollisionBounds({
      x: -(worldOffset.x || 0),
      y: -(worldOffset.y || 0),
    });
    const depthOccluderBounds = [
      playerBounds,
      ...(this._npcManager?.getVisibleCollisionBounds?.() || []),
    ].filter(Boolean);

    // Use the same world layout source as WorldAtlasLayer. Do not mix this with
    // the terrain sampler/autotile renderer, otherwise transitions and terrain
    // variants get drawn twice or out of order.
    const drawnItems = this._drawViewportObjects(worldOffset, theme, rt, cam, atlasKey, frontRT);
    // Village back is stamped into the terrain RT (rt), so it always runs when
    // terrain redraws (rt was just cleared above).
    const drawnVillageBack = this._drawVillagePass(
      worldOffset,
      theme,
      rt,
      cam,
      'back',
      depthOccluderBounds
    );
    // Mid, shadow-mask, and front layers live in separate RTs.  When
    // skipVillagePasses is true, their RTs were not cleared so the previous
    // frame's content is still valid — skip the expensive re-stamp.
    const drawnVillageMid = skipCachedVillagePasses ? 0 : this._drawVillagePass(
      worldOffset,
      theme,
      midRT || rt,
      cam,
      'mid',
      depthOccluderBounds
    );
    const drawnVillageShadowMask = skipCachedVillagePasses ? 0 : this._drawVillagePass(
      worldOffset,
      theme,
      shadowMaskRT || rt,
      cam,
      'shadowmask',
      depthOccluderBounds
    );
    const drawnVillageFront = this._drawVillagePass(
      worldOffset,
      theme,
      frontRT || rt,
      cam,
      'front',
      depthOccluderBounds
    );
    this._drawnTileCount =
      drawnItems +
      drawnVillageBack +
      drawnVillageMid +
      drawnVillageShadowMask +
      drawnVillageFront;
  }

  _drawViewportObjects(worldOffset, theme, rt, cam, atlasKey, frontRT = null) {
    const wx = worldOffset.x || 0;
    const wy = worldOffset.y || 0;
    const playerX = -wx;
    const playerY = -wy;

    const viewport = { width: cam.width, height: cam.height };
    const layout = getWorldAtlasLayout(playerX, playerY, WORLD_ATLAS_DATA, viewport);
    this._lastLayout = layout;

    // Update animation-presence cache used by update() to decide dirty state.
    this._cachedHasAnimations = Boolean(
      (layout.renderItems || []).some((i) => i.animation) ||
      (layout.tileChunks || []).some((chunk) =>
        (chunk.animatedTileBackItems?.length  ?? 0) > 0 ||
        (chunk.animatedTileFrontItems?.length ?? 0) > 0
      )
    );

    const texture = this.textures.get(atlasKey);
    if (!texture) {
      if (import.meta.env.DEV && !this._warnedMissingTexture) {
        console.warn(`[Terrain] atlas texture "${atlasKey}" not found — terrain will be black`);
        this._warnedMissingTexture = true;
      }
      return 0;
    }

    if (!this._decorFrameKeyCache.has(atlasKey)) {
      this._decorFrameKeyCache.set(atlasKey, new Map());
    }
    const frameCache = this._decorFrameKeyCache.get(atlasKey);

    let drawn = 0;
    let tileDrawn = 0;
    const frameTick = Math.floor(this.time.now / 120);

    // Fetch broken state once — used for both tile and floating item filtering.
    const brokenObjectState = useBrokenObjectsStore.getState();
    const hiddenIds = brokenObjectState?.hiddenObjectIds || {};

    // ── 1. Tile layers — always stamp directly for guaranteed correctness ──────
    // Chunk RT caching proved unreliable (blank RTs when renderMode promotion
    // timing is off). Direct stamping is safe: the terrain RT is always in
    // 'all' mode so every stamp is processed in the same render pass.
    // The terrain RT is only cleared+redrawn when dirty (movedByPixel /
    // themeChanged / animationChanged / brokenObjectsChanged), so direct stamps
    // here are NOT O(N) every frame — they only run when terrain is actually dirty.
    for (const chunk of layout.tileChunks || []) {
      for (const item of chunk.tileBackItems          || []) { if (!item.id || !hiddenIds[item.id]) tileDrawn += this._stampSingleItem(item, wx, wy, atlasKey, texture, frameCache, rt, frontRT, cam, frameTick); }
      for (const item of chunk.tileFrontItems         || []) { if (!item.id || !hiddenIds[item.id]) tileDrawn += this._stampSingleItem(item, wx, wy, atlasKey, texture, frameCache, rt, frontRT, cam, frameTick); }
      for (const item of chunk.animatedTileBackItems  || []) { if (!item.id || !hiddenIds[item.id]) tileDrawn += this._stampSingleItem(item, wx, wy, atlasKey, texture, frameCache, rt, frontRT, cam, frameTick); }
      for (const item of chunk.animatedTileFrontItems || []) { if (!item.id || !hiddenIds[item.id]) tileDrawn += this._stampSingleItem(item, wx, wy, atlasKey, texture, frameCache, rt, frontRT, cam, frameTick); }
    }
    drawn += tileDrawn;

    if (import.meta.env.DEV && tileDrawn === 0 && (layout.tileChunks || []).length > 0) {
      console.warn(`[Terrain] 0 tile stamps for ${layout.tileChunks.length} chunks — terrain will be black. atlasKey=${atlasKey} rt.visible=${rt.visible}`);
    }

    // ── 2. Farming overlay — soil + crop sprites stamped above terrain tiles ──
    this._drawFarmingOverlay(wx, wy, rt, cam);

    // ── 3. Floating items — globally depth-sorted across all chunks ───────────
    // layout.renderItems contains all floating items (trees, rocks, mushrooms…)
    // globally Y-sorted for correct inter-chunk depth ordering.
    // Do NOT also stamp per-chunk floatingItems — same objects, just unsorted.
    const filteredRenderItems = applyWorldAtlasObjectState(
      layout.renderItems || [],
      WORLD_ATLAS_DATA,
      brokenObjectState
    );
    for (const item of filteredRenderItems) drawn += this._stampSingleItem(item, wx, wy, atlasKey, texture, frameCache, rt, frontRT, cam, frameTick);

    // ── 3. Stumps (broken trees) ──────────────────────────────────────────────
    for (const stumpObject of Object.values(brokenObjectState?.stumpObjects || {})) {
      const stump = createWorldAtlasStumpRenderItem(stumpObject, WORLD_ATLAS_DATA);
      if (stump) drawn += this._stampSingleItem(stump, wx, wy, atlasKey, texture, frameCache, rt, frontRT, cam, frameTick);
    }

    return drawn;
  }

  _stampSingleItem(item, wx, wy, atlasKey, texture, frameCache, rt, frontRT, cam, frameTick) {
    const entry = item.entry;
    if (!entry) return 0;

    const scale = item.scale || 1;
    const animation = item.animation;
    const frameCount = Math.max(1, animation?.frameCount || 1);
    const frameWidth = animation?.frameWidth || item.renderWidth || entry.width;
    const frameHeight = animation?.frameHeight || item.renderHeight || entry.height;
    const frameIndex = animation ? frameTick % frameCount : 0;

    const srcX = entry.x + frameIndex * frameWidth;
    const srcY = entry.y;
    const srcW = frameWidth;
    const srcH = frameHeight;

    const renderW = srcW * scale;
    const renderH = srcH * scale;

    const anchorX = item.anchorMode === 'tile' ? 0 : (item.anchorX ?? 0.5);
    const anchorY = item.anchorMode === 'tile' ? 0 : (item.anchorY ?? 1);

    const screenX = Math.round(cam.width / 2 + wx + item.x);
    const screenY = Math.round(cam.height / 2 + wy + item.y);
    const drawX = Math.round(screenX - anchorX * renderW);
    const drawY = Math.round(screenY - anchorY * renderH);

    if (drawX + renderW < -64 || drawX > cam.width + 64) return 0;
    if (drawY + renderH < -64 || drawY > cam.height + 64) return 0;

    const frameKey = `layout_${srcX}_${srcY}_${srcW}_${srcH}`;
    if (!frameCache.has(frameKey)) {
      texture.add(frameKey, 0, srcX, srcY, srcW, srcH);
      frameCache.set(frameKey, true);
    }
    if (!texture.has(frameKey)) return 0;

    const splitY = getDepthSplitYForEntry({
      ...entry,
      depthSplit: item.depthSplit || entry.depthSplit,
      depth: item.depth || entry.depth,
    });
    if (splitY > 0 && splitY < srcH) {
      let count = 0;
      const topFrameKey = `${frameKey}_top_${splitY}`;
      if (!frameCache.has(topFrameKey)) {
        texture.add(topFrameKey, 0, srcX, srcY, srcW, splitY);
        frameCache.set(topFrameKey, true);
      }
      const bottomH = srcH - splitY;
      const bottomFrameKey = `${frameKey}_bottom_${splitY}`;
      if (!frameCache.has(bottomFrameKey)) {
        texture.add(bottomFrameKey, 0, srcX, srcY + splitY, srcW, bottomH);
        frameCache.set(bottomFrameKey, true);
      }
      if (texture.has(bottomFrameKey)) {
        rt.stamp(atlasKey, bottomFrameKey, drawX, drawY + splitY * scale, {
          scale, originX: 0, originY: 0,
        });
        count++;
      }
      if (texture.has(topFrameKey)) {
        const targetRT = frontRT || rt;
        targetRT.stamp(atlasKey, topFrameKey, drawX, drawY, {
          scale, originX: 0, originY: 0,
        });
        count++;
      }
      return count;
    }

    rt.stamp(atlasKey, frameKey, drawX, drawY, {
      scale, originX: 0, originY: 0,
    });
    return 1;
  }

  // Stamps soil and crop sprites for all visible farm tiles onto the terrain RT.
  // Called from _drawViewportObjects between tile layers and floating objects.
  _drawFarmingOverlay(wx, wy, rt, cam) {
    const farmTiles = useFarmingStore.getState().farmTiles;
    const tileEntries = Object.entries(farmTiles);
    if (tileEntries.length === 0) return;

    const scale = 2; // matches WORLD_ATLAS_TILE_SCALE

    for (const [key, tile] of tileEntries) {
      if (!tile.tilled) continue;

      const [tileX, tileY] = key.split('_').map(Number);

      // World-space top-left of this tile
      const tileWorldX = tileX * WORLD_ATLAS_TILE_SIZE;
      const tileWorldY = tileY * WORLD_ATLAS_TILE_SIZE;

      const screenX = Math.round(cam.width / 2 + wx + tileWorldX);
      const screenY = Math.round(cam.height / 2 + wy + tileWorldY);

      // Cull tiles outside the visible viewport with a small margin
      if (screenX + WORLD_ATLAS_TILE_SIZE < -8 || screenX > cam.width + 8) continue;
      if (screenY + WORLD_ATLAS_TILE_SIZE < -8 || screenY > cam.height + 8) continue;

      // ── Soil layer ──
      const soilStateKey = getSoilStateKey(tile);
      if (soilStateKey) {
        const soilInfo = getSoilSpriteInfo(soilStateKey);
        if (soilInfo) {
          this._stampFarmingSprite(rt, soilInfo, screenX, screenY, scale);
        }
      }

      // ── Crop layer (on top of soil) ──
      if (tile.seeded && tile.cropId != null) {
        const cropInfo = tile.isDead
          ? getCropDeadSpriteInfo(tile.cropId)
          : getCropSpriteInfo(tile.cropId, tile.growthStage);
        if (cropInfo) {
          // Crop sprites are 16×32 — anchor at bottom-center of the tile
          const cropScreenX = screenX + (WORLD_ATLAS_TILE_SIZE - cropInfo.width * scale) / 2;
          const cropScreenY = screenY + WORLD_ATLAS_TILE_SIZE - cropInfo.height * scale;
          this._stampFarmingSprite(rt, cropInfo, cropScreenX, cropScreenY, scale);
        }
      }
    }
  }

  // Stamps a single farming sprite rect from its farming texture onto rt.
  _stampFarmingSprite(rt, spriteInfo, screenX, screenY, scale) {
    const { textureKey, x, y, width, height } = spriteInfo;
    if (!this.textures.exists(textureKey)) return;

    const texture = this.textures.get(textureKey);
    if (!texture) return;

    if (!this._farmingFrameCaches.has(textureKey)) {
      this._farmingFrameCaches.set(textureKey, new Map());
    }
    const frameCache = this._farmingFrameCaches.get(textureKey);
    const frameKey = `farm_${x}_${y}_${width}_${height}`;

    if (!frameCache.has(frameKey)) {
      texture.add(frameKey, 0, x, y, width, height);
      frameCache.set(frameKey, true);
    }
    if (!texture.has(frameKey)) return;

    rt.stamp(textureKey, frameKey, Math.round(screenX), Math.round(screenY), {
      scale,
      originX: 0,
      originY: 0,
    });
  }

  _drawVillagePass(
    worldOffset,
    theme,
    targetRT,
    cam,
    pass = 'back',
    playerBounds = null,
    layerFilter = null
  ) {
    if (!targetRT) return 0;

    const textureKey = getVillageTextureKeyForTheme(theme);
    if (!this.textures.exists(textureKey)) {
      return 0;
    }

    const texture = this.textures.get(textureKey);
    if (!texture) {
      return 0;
    }

    if (!this._decorFrameKeyCache.has(textureKey)) {
      this._decorFrameKeyCache.set(textureKey, new Map());
    }
    const frameCache = this._decorFrameKeyCache.get(textureKey);
    const wx = worldOffset.x || 0;
    const wy = worldOffset.y || 0;
    const worldBounds = getVillageViewportWorldBounds(worldOffset, {
      width: cam.width,
      height: cam.height,
    });
    let drawn = 0;

    visitVillageRenderTiles(
      pass,
      ({ tile, worldX, worldY, renderWidth, renderHeight }) => {
        const srcX = tile.sx;
        const srcY = tile.sy;
        const srcW = tile.sw;
        const srcH = tile.sh;
        const scale = renderWidth / srcW;
        const drawX = Math.round(cam.width / 2 + wx + worldX);
        const drawY = Math.round(cam.height / 2 + wy + worldY);

        if (drawX + renderWidth < -64 || drawX > cam.width + 64) return;
        if (drawY + renderHeight < -64 || drawY > cam.height + 64) return;

        const frameKey = `village_${srcX}_${srcY}_${srcW}_${srcH}`;
        if (!frameCache.has(frameKey)) {
          texture.add(frameKey, 0, srcX, srcY, srcW, srcH);
          frameCache.set(frameKey, true);
        }

        if (!texture.has(frameKey)) return;

        targetRT.stamp(textureKey, frameKey, drawX, drawY, {
          scale,
          originX: 0,
          originY: 0,
        });
        drawn++;
      },
      { worldBounds, playerBounds, layerFilter }
    );

    return drawn;
  }

  _setupVillageCollisionDebug() {
    if (DEBUG_VILLAGE_COLLISION) {
      this._villageCollisionDebug = this.add.graphics();
      this._villageCollisionDebug
        .setDepth(96)
        .setScrollFactor(0)
        .setVisible(true);
    } else {
      this._villageCollisionDebug = null;
    }

    if (DEBUG_PLAYER_COLLISION) {
      this._playerCollisionDebug = this.add.graphics();
      this._playerCollisionDebug
        .setDepth(96)
        .setScrollFactor(0)
        .setVisible(true);
    } else {
      this._playerCollisionDebug = null;
    }

    if (DEBUG_VILLAGE_DEPTH) {
      this._villageDepthDebug = this.add.graphics();
      this._villageDepthDebug
        .setDepth(96)
        .setScrollFactor(0)
        .setVisible(true);
    } else {
      this._villageDepthDebug = null;
    }

    this._lastVillageCollisionDebugOffsetX = null;
    this._lastVillageCollisionDebugOffsetY = null;
  }

  _drawVillageCollisionDebug(worldOffset) {
    const g = this._villageCollisionDebug;
    if (!g) {
      return;
    }

    const cam = this.cameras.main;
    const wx = worldOffset?.x || 0;
    const wy = worldOffset?.y || 0;
    const cameraCenterX = cam.width / 2;
    const cameraCenterY = cam.height / 2;

    g.clear();
    g.fillStyle(0xff0000, 0.18);
    g.lineStyle(1, 0xff5555, 0.5);

    getVillageCollisionRects().forEach((rect) => {
      const drawX = Math.round(cameraCenterX + wx + rect.left);
      const drawY = Math.round(cameraCenterY + wy + rect.top);

      g.fillRect(drawX, drawY, rect.width, rect.height);
      g.strokeRect(drawX, drawY, rect.width, rect.height);
    });
  }

  _drawPlayerCollisionDebug(worldOffset) {
    const g = this._playerCollisionDebug;
    if (!g) {
      return;
    }

    const cam = this.cameras.main;
    const wx = worldOffset?.x || 0;
    const wy = worldOffset?.y || 0;
    const cameraCenterX = cam.width / 2;
    const cameraCenterY = cam.height / 2;
    const playerWorldPoint = {
      x: -wx,
      y: -wy,
    };
    const liveBounds = getPetCollisionBounds(playerWorldPoint);
    const debugState = getCollisionDebugState();
    const candidateBounds = debugState?.candidateBounds || null;
    const blockedBounds = debugState?.blockedBounds || null;

    g.clear();

    const drawBounds = (bounds, fillColor, lineColor, alpha = 0.18) => {
      if (!bounds) {
        return;
      }

      const drawX = Math.round(cameraCenterX + wx + bounds.left);
      const drawY = Math.round(cameraCenterY + wy + bounds.top);
      const width = bounds.right - bounds.left;
      const height = bounds.bottom - bounds.top;

      g.fillStyle(fillColor, alpha);
      g.lineStyle(1, lineColor, 0.8);
      g.fillRect(drawX, drawY, width, height);
      g.strokeRect(drawX, drawY, width, height);
    };

    drawBounds(liveBounds, 0x22c55e, 0x4ade80, 0.14);
    drawBounds(candidateBounds, 0xf59e0b, 0xfbbf24, 0.14);
    drawBounds(blockedBounds, 0xef4444, 0xf87171, 0.1);
  }

  _drawVillageDepthDebug(worldOffset) {
    const g = this._villageDepthDebug;
    if (!g) {
      return;
    }

    const cam = this.cameras.main;
    const wx = worldOffset?.x || 0;
    const wy = worldOffset?.y || 0;
    const cameraCenterX = cam.width / 2;
    const cameraCenterY = cam.height / 2;

    g.clear();
    g.fillStyle(0x3b82f6, 0.18);
    g.lineStyle(1, 0x60a5fa, 0.55);

    getVillageDepthRects().forEach((rect) => {
      const drawX = Math.round(cameraCenterX + wx + rect.left);
      const drawY = Math.round(cameraCenterY + wy + rect.top);

      g.fillRect(drawX, drawY, rect.width, rect.height);
      g.strokeRect(drawX, drawY, rect.width, rect.height);
    });
  }

  // ─── Phaser entity layer ──────────────────────────────────────────────────────

  _setupPhaserEntityLayer() {
    // Map<entityId, Phaser.GameObjects.Image>
    this._entitySpritePool = new Map();
    // Set of textureKeys currently loading — prevents duplicate load calls.
    this._loadingTextures = new Set();
    this._entityLayerVisible = false;
    this._lastEntitySyncOffsetX = null;
    this._lastEntitySyncOffsetY = null;
    this._lastEntitySyncCount = -1;
    // Per-URL texture key registry to avoid sanitizing the same URL twice.
    this._urlToKeyCache = new Map();
  }

  _urlToTextureKey(url) {
    if (this._urlToKeyCache.has(url)) return this._urlToKeyCache.get(url);
    // Stable key: keep alphanumeric/dot/dash chars, collapse the rest.
    const key = 'dyn_' + url.replace(/[^a-z0-9._-]/gi, '_');
    this._urlToKeyCache.set(url, key);
    return key;
  }

  // Returns sprite info needed by Phaser, or null if entity has no renderable sprite.
  _resolveEntitySpriteInfo(entity) {
    const itemId =
      entity.itemKey ||
      entity.itemId ||
      entity.itemType ||
      entity.rewardItem ||
      entity.type;

    if (itemId) {
      const definition = getItemDefinition(itemId);

      // React ItemVisual renders most resources/foods from item definitions using
      // atlasSource + atlasRect. Mirror that first, otherwise Phaser skips those
      // entities and they disappear when React EntityLayer is hidden.
      if (definition?.atlasSource && definition?.atlasRect) {
        const rect = definition.atlasRect;
        return {
          url: definition.atlasSource,
          isCrop: true,
          cropX: rect.x || 0,
          cropY: rect.y || 0,
          cropW: rect.width || 16,
          cropH: rect.height || 16,
          displayW: (rect.width || 16) * ENTITY_SCALE,
          displayH: (rect.height || 16) * ENTITY_SCALE,
        };
      }

      if (definition?.spritePath) {
        return {
          url: definition.spritePath,
          isCrop: false,
          displayW: 16 * ENTITY_SCALE,
          displayH: 16 * ENTITY_SCALE,
        };
      }

      const configuredSprite = getItemSpriteAsset(itemId, 'world') || getItemSpriteAsset(itemId, 'inventory');
      if (configuredSprite?.src) {
        return {
          url: configuredSprite.src,
          isCrop: false,
          displayW: 16 * ENTITY_SCALE,
          displayH: 16 * ENTITY_SCALE,
        };
      }
    }

    let sprite = null;
    if (entity.itemKey) {
      sprite = getItemWorldSprite(entity.itemKey);
    }
    if (!sprite && !entity.itemKey) {
      sprite = getItemSprite(entity.type, entity.spriteKey);
    }
    if (!sprite) return null;

    const url = sprite.src || sprite.sheet;
    if (!url) return null;

    const w = sprite.width || 16;
    const h = sprite.height || 16;

    if (sprite.src || sprite.isDirectAsset) {
      return { url, isCrop: false, displayW: w * ENTITY_SCALE, displayH: h * ENTITY_SCALE };
    }

    return {
      url,
      isCrop: true,
      cropX: sprite.x || 0,
      cropY: sprite.y || 0,
      cropW: w,
      cropH: h,
      displayW: w * ENTITY_SCALE,
      displayH: h * ENTITY_SCALE,
    };
  }

  // Ensures the texture is loaded. Returns true if already available.
  // Calls onLoaded() (with no args) when it finishes loading, if it was not already loaded.
  _ensureTexture(textureKey, url, onLoaded) {
    if (this.textures.exists(textureKey)) return true;

    if (!this._loadingTextures.has(textureKey)) {
      this._loadingTextures.add(textureKey);
      this.load.image(textureKey, url);
      this.load.once('complete', () => {
        this._loadingTextures.delete(textureKey);
        onLoaded?.();
      });
      this.load.start();
    }

    return false;
  }

  _syncPhaserEntitySprites(worldOffset, entities) {
    const cam = this.cameras.main;
    const wx = worldOffset.x || 0;
    const wy = worldOffset.y || 0;
    const cx = cam.width / 2;
    const cy = cam.height / 2;

    const activeIds = new Set();

    for (const entity of entities) {
      if (!entity.active) continue;
      activeIds.add(entity.id);

      const screenX = Math.round(cx + wx + entity.x);
      const screenY = Math.round(cy + wy + entity.y);
      const offscreen =
        screenX < -64 || screenX > cam.width + 64 ||
        screenY < -64 || screenY > cam.height + 64;

      const existing = this._entitySpritePool.get(entity.id);

      if (existing) {
        existing.setPosition(screenX, screenY).setVisible(!offscreen && this._entityLayerVisible);
        continue;
      }

      if (offscreen) continue;

      const info = this._resolveEntitySpriteInfo(entity);
      // No resolvable sprite — React EntityLayer (ItemVisual / atlas) handles this entity.
      // Do not create a placeholder; skip silently.
      if (!info) continue;

      const textureKey = this._urlToTextureKey(info.url);
      const ready = this._ensureTexture(textureKey, info.url, () => {
        // On load complete, force re-sync.
        this._lastEntitySyncOffsetX = null;
      });

      if (!ready) continue;

      // Texture is loaded — register crop frame if needed, then verify before use.
      let frameKey = '__BASE';
      if (info.isCrop) {
        frameKey = `ef_${info.cropX}_${info.cropY}_${info.cropW}_${info.cropH}`;
        const texture = this.textures.get(textureKey);
        if (!texture.has(frameKey)) {
          texture.add(frameKey, 0, info.cropX, info.cropY, info.cropW, info.cropH);
        }
        // Guard: if the frame still isn't registered (e.g. out-of-bounds crop),
        // skip this entity rather than letting Phaser render a pink missing-frame square.
        if (!texture.has(frameKey)) {
          if (import.meta.env.DEV && !this._warnedFrames?.has(frameKey)) {
            this._warnedFrames = this._warnedFrames || new Set();
            this._warnedFrames.add(frameKey);
            console.warn(`[Phaser] Frame registration failed for entity "${entity.id}": ${frameKey}`);
          }
          continue;
        }
      }

      const img = this.add.image(screenX, screenY, textureKey, frameKey);
      // origin (0.5, 1) = bottom-center, matches React Entity's translate(-50%, -100%).
      img.setOrigin(0.5, 1);
      img.setScale(ENTITY_SCALE);
      img.setDepth(50);
      img.setScrollFactor(0);
      img.setVisible(this._entityLayerVisible);

      this._entitySpritePool.set(entity.id, img);
    }

    // Destroy sprites for removed entities.
    for (const [id, obj] of this._entitySpritePool) {
      if (!activeIds.has(id)) {
        obj.destroy();
        this._entitySpritePool.delete(id);
      }
    }
  }

  // ─── Phaser world interaction FX ─────────────────────────────────────────────

  _setupWorldFxLayer() {
    this._worldFxSpritePool = new Map();
    this._worldImpactSpritePool = new Map();
    this._fxFrameKeyCache = new Map();
  }

  _setupFarmReadyBubbleLayer() {
    this._farmReadyBubblePool = new Map();
  }

  getFarmReadyBubbleEntry(tileKey) {
    return this._farmReadyBubblePool?.get?.(tileKey) || null;
  }

  _ensureFarmingFrame(textureKey, x, y, width, height, prefix = 'farm') {
    if (!this.textures.exists(textureKey)) return null;

    const texture = this.textures.get(textureKey);
    if (!texture) return null;

    if (!this._farmingFrameCaches.has(textureKey)) {
      this._farmingFrameCaches.set(textureKey, new Map());
    }
    const frameCache = this._farmingFrameCaches.get(textureKey);
    const frameKey = `${prefix}_${x}_${y}_${width}_${height}`;

    if (!frameCache.has(frameKey)) {
      texture.add(frameKey, 0, x, y, width, height);
      frameCache.set(frameKey, true);
    }

    return texture.has(frameKey) ? frameKey : null;
  }

  _syncFarmReadyBubbles(worldOffset) {
    const cam = this.cameras.main;
    const wx = worldOffset.x || 0;
    const wy = worldOffset.y || 0;
    const activeKeys = new Set();
    const farmTiles = useFarmingStore.getState().farmTiles;

    for (const [key, tile] of Object.entries(farmTiles)) {
      if (!tile?.seeded || !tile.cropId || tile.isDead || tile.growthStage < MAX_GROWTH_STAGE) continue;

      const foodInfo = getCropFoodSpriteInfo(tile.cropId);
      if (!foodInfo?.textureKey) continue;

      const [tileX, tileY] = key.split('_').map(Number);
      const tileWorldX = tileX * WORLD_ATLAS_TILE_SIZE;
      const tileWorldY = tileY * WORLD_ATLAS_TILE_SIZE;
      const screenCenterX = Math.round(cam.width / 2 + wx + tileWorldX + WORLD_ATLAS_TILE_SIZE / 2);
      const cropTopY = Math.round(cam.height / 2 + wy + tileWorldY - WORLD_ATLAS_TILE_SIZE * 2);
      const floatOffsetY = Math.round(Math.sin(this.time.now / 700 + tileX * 0.7 + tileY * 0.45) * 3);
      const bubbleY = cropTopY - 6 + WORLD_ATLAS_TILE_SIZE * 2 + floatOffsetY;
      if (screenCenterX < -32 || screenCenterX > cam.width + 32) continue;
      if (bubbleY < -64 || bubbleY > cam.height + 32) continue;

      const iconFrameKey = this._ensureFarmingFrame(
        foodInfo.textureKey,
        foodInfo.x,
        foodInfo.y,
        foodInfo.width,
        foodInfo.height,
        'farm_ready_food'
      );
      if (!iconFrameKey) continue;

      activeKeys.add(key);
      let entry = this._farmReadyBubblePool.get(key);

      if (!entry) {
        const bubble = this.add.image(screenCenterX, bubbleY, FARM_READY_BUBBLE_TEXTURE_KEY);
        bubble
          .setScrollFactor(0)
          .setDepth(FARM_READY_BUBBLE_DEPTH)
          .setScale(2)
          .setVisible(true);

        const icon = this.add.image(screenCenterX, bubbleY - 2, foodInfo.textureKey, iconFrameKey);
        icon
          .setScrollFactor(0)
          .setDepth(FARM_READY_BUBBLE_DEPTH + 0.01)
          .setScale(1)
          .setVisible(true);

        entry = { bubble, icon };
        this._farmReadyBubblePool.set(key, entry);
      }

      entry.bubble
        .setPosition(screenCenterX, bubbleY)
        .setVisible(true);
      entry.icon
        .setTexture(foodInfo.textureKey, iconFrameKey)
        .setPosition(screenCenterX, bubbleY - 1)
        .setVisible(true);
    }

    for (const [key, entry] of this._farmReadyBubblePool) {
      if (activeKeys.has(key)) continue;
      entry.bubble?.destroy();
      entry.icon?.destroy();
      this._farmReadyBubblePool.delete(key);
    }
  }

  _hideFarmReadyBubbles() {
    for (const entry of this._farmReadyBubblePool?.values?.() || []) {
      entry.bubble?.setVisible(false);
      entry.icon?.setVisible(false);
    }
  }

  _getFxFrameKey(type, frameIndex) {
    const config = WORLD_FX_TEXTURES[type];
    if (!config) return null;

    const key = `${type}_${frameIndex}`;
    if (this._fxFrameKeyCache.has(key)) return key;

    const texture = this.textures.get(config.key);
    if (!texture) return null;

    texture.add(
      key,
      0,
      frameIndex * config.frameWidth,
      0,
      config.frameWidth,
      config.frameHeight
    );
    this._fxFrameKeyCache.set(key, true);
    return key;
  }

  _syncWorldFxSprites(worldOffset) {
    const fxStore = useWorldFxStore.getState();
    fxStore.cleanupExpiredFx?.();

    const activeFx = fxStore.activeFx || [];
    const activeImpacts = fxStore.activeObjectImpacts || [];
    const cam = this.cameras.main;
    const wx = worldOffset.x || 0;
    const wy = worldOffset.y || 0;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    const activeFxIds = new Set();
    const activeImpactIds = new Set();

    for (const fx of activeFx) {
      const config = WORLD_FX_TEXTURES[fx.type];
      if (!config || !this.textures.exists(config.key)) continue;

      const elapsedMs = Math.max(0, Date.now() - (fx.createdAt || Date.now()));
      const frameIndex = Math.min(
        config.frames - 1,
        Math.floor(elapsedMs / config.frameDurationMs)
      );
      const frameKey = this._getFxFrameKey(fx.type, frameIndex);
      if (!frameKey) continue;

      activeFxIds.add(fx.id);
      const screenX = Math.round(cx + wx + fx.x);
      const screenY = Math.round(cy + wy + fx.y + config.verticalOffsetY);
      let sprite = this._worldFxSpritePool.get(fx.id);

      if (!sprite) {
        sprite = this.add.image(screenX, screenY, config.key, frameKey);
        sprite.setOrigin(0.5, 0.5);
        sprite.setScrollFactor(0);
        sprite.setDepth(95);
        this._worldFxSpritePool.set(fx.id, sprite);
      }

      sprite
        .setTexture(config.key, frameKey)
        .setPosition(screenX, screenY)
        .setScale(config.renderScale * (fx.flipX ? -1 : 1), config.renderScale)
        .setVisible(true);
    }

    for (const impact of activeImpacts) {
      const item = impact.item;
      if (!item?.entry) continue;

      const atlasKey = THEME_TO_ATLAS_KEY[useWorldStore.getState().currentWorldTheme] || 'atlas_spring';
      const texture = this.textures.get(atlasKey);
      if (!texture) continue;

      const width = item.renderWidth || item.entry.width || 0;
      const height = item.renderHeight || item.entry.height || 0;
      if (width <= 0 || height <= 0) continue;

      const frameKey = `impact_${item.entry.id || item.entry.name}_${item.entry.x}_${item.entry.y}_${width}_${height}`;
      if (!texture.has(frameKey)) {
        texture.add(frameKey, 0, item.entry.x || 0, item.entry.y || 0, width, height);
      }
      if (!texture.has(frameKey)) continue;

      activeImpactIds.add(impact.objectId);

      const scale = Number.isFinite(item.scale) && item.scale > 0 ? item.scale : 1;
      const anchorX = item.anchorMode === 'tile' ? 0 : (item.anchorX ?? 0.5);
      const anchorY = item.anchorMode === 'tile' ? 0 : (item.anchorY ?? 1);
      const baseScreenX = Math.round(cx + wx + (item.x || 0));
      const baseScreenY = Math.round(cy + wy + (item.y || 0));
      const elapsed = Math.max(0, Date.now() - (impact.startedAt || Date.now()));
      const jiggle = elapsed < (impact.durationMs || 140)
        ? [0, -2, 2, -1][Math.floor((elapsed / Math.max(1, impact.durationMs || 140)) * 4) % 4]
        : 0;

      let sprite = this._worldImpactSpritePool.get(impact.objectId);
      if (!sprite) {
        sprite = this.add.image(baseScreenX, baseScreenY, atlasKey, frameKey);
        sprite.setScrollFactor(0);
        sprite.setDepth(94);
        sprite.setTint(0xffffff)
.setTintMode(Phaser.TintModes.FILL);
        this._worldImpactSpritePool.set(impact.objectId, sprite);
      }

      sprite
        .setTexture(atlasKey, frameKey)
        .setOrigin(anchorX, anchorY)
        .setPosition(baseScreenX + jiggle, baseScreenY)
        .setScale(scale)
        .setTint(0xffffff)
.setTintMode(Phaser.TintModes.FILL)
        .setVisible(true);
    }

    for (const [id, sprite] of this._worldFxSpritePool) {
      if (!activeFxIds.has(id)) {
        sprite.destroy();
        this._worldFxSpritePool.delete(id);
      }
    }

    for (const [id, sprite] of this._worldImpactSpritePool) {
      if (!activeImpactIds.has(id)) {
        sprite.destroy();
        this._worldImpactSpritePool.delete(id);
      }
    }
  }

  // ─── Phaser player ────────────────────────────────────────────────────────────

  _setupPhaserPlayer() {
    this._phaserPet = new PhaserPet(this);
    const flags = getPhaserDebugFlags();
    this._phaserPet.setVisible(Boolean(flags.showPhaserPlayer));
  }

  _setupVillageDoorManager() {
    this._villageDoorManager = new VillageDoorManager(this);
  }

  _setupNpcManager() {
    this._npcManager = new NPCManager(this, {
      doorManager: this._villageDoorManager,
    });
    if (
      DEBUG_NPCS &&
      typeof window !== 'undefined' &&
      this.textures.exists(NPC_BASIC_SPRITESHEET_ASSET.key) &&
      !window.__NPC_BASIC_LOADED_LOGGED__
    ) {
      console.info('[NPC] Basic_NPC loaded');
      window.__NPC_BASIC_LOADED_LOGGED__ = true;
    }
  }


  _setupPlayerMarker(cam) {
    this._playerMarker = this.add.graphics();
    this._playerMarker.setDepth(71).setScrollFactor(0).setVisible(false);
    this._drawPlayerMarker(cam);
  }

  _drawPlayerMarker(cam) {
    const g = this._playerMarker;
    if (!g) return;
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    const R = 6;
    g.clear();
    g.lineStyle(2, 0xff4444, 0.9);
    g.strokeCircle(cx, cy, R);
    g.lineStyle(1, 0xff4444, 0.7);
    g.lineBetween(cx - R - 4, cy, cx + R + 4, cy);
    g.lineBetween(cx, cy - R - 4, cx, cy + R + 4);
    g.fillStyle(0xff4444, 1);
    g.fillCircle(cx, cy, 2);
  }

  _setupEntityMarkers() {
    this._entityMarkers = this.add.graphics();
    this._entityMarkers.setDepth(70).setScrollFactor(0).setVisible(false);
    this._lastEntityMarkersOffsetX = null;
    this._lastEntityMarkersOffsetY = null;
    this._lastEntityMarkersCount = -1;
  }

  _drawEntityMarkers(worldOffset, entities) {
    const g = this._entityMarkers;
    if (!g) return;
    const cam = this.cameras.main;
    const wx = worldOffset.x || 0;
    const wy = worldOffset.y || 0;
    const cx = cam.width / 2;
    const cy = cam.height / 2;

    g.clear();
    g.lineStyle(1.5, 0x44ddff, 0.85);
    g.fillStyle(0x44ddff, 0.55);

    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      const sx = cx + wx + e.x;
      const sy = cy + wy + e.y;
      if (sx < -16 || sx > cam.width + 16 || sy < -16 || sy > cam.height + 16) continue;
      g.strokeRect(sx - 5, sy - 5, 10, 10);
      g.fillRect(sx - 3, sy - 3, 6, 6);
    }
  }

  // ─── Debug handles ────────────────────────────────────────────────────────────

  _setupDebugHandles() {
    const scene = this;

    // ── Terrain RenderTexture ──
    const rt = this._viewportTerrainRT;
    Object.defineProperty(window.phaserDebug, 'showViewportTerrain', {
      configurable: true,
      get: () => rt.visible,
      set: (v) => {
        const on = Boolean(v);
        rt.setVisible(on);
        scene._viewportVillageMidRT?.setVisible(on);
        scene._viewportVillageShadowMaskRT?.setVisible(on);
        scene._viewportFrontRT?.setVisible(on);
        setPhaserDebugFlag('showViewportTerrain', on);
        if (on) {
          const { worldOffset, currentWorldTheme } = useWorldStore.getState();
          scene._drawViewportTerrain(worldOffset, currentWorldTheme);
          scene._lastWorldOffset = worldOffset;
          scene._lastTheme = currentWorldTheme;
        }
      },
    });

    // ── renderMode — high-level terrain switch ──
    // 'react'  : default — no Phaser terrain, React terrain visible
    // 'hybrid' : both React and Phaser terrain visible (alignment check)
    // 'phaser' : Phaser terrain only — React terrain hidden after Phaser renders
    Object.defineProperty(window.phaserDebug, 'renderMode', {
      configurable: true,
      get: () => getPhaserDebugFlags().renderMode,
      set: (v) => {
        if (!['react', 'hybrid', 'phaser'].includes(v)) return;
        setPhaserDebugFlag('renderMode', v);

        if (v === 'react') {
          rt.setVisible(false);
          scene._viewportVillageMidRT?.setVisible(false);
          scene._viewportVillageShadowMaskRT?.setVisible(false);
          scene._viewportFrontRT?.setVisible(false);
          setPhaserDebugFlag('showViewportTerrain', false);
          setPhaserDebugFlag('hideReactWorldLayer', false);
          return;
        }

        // ── Shared path: 'hybrid' and 'phaser' use IDENTICAL terrain rendering ──
        // _drawViewportTerrain writes pixels into the RT's WebGL FBO. Phaser's
        // main render pass (which paints the RT onto the visible canvas) runs on
        // the NEXT requestAnimationFrame. So the draw call is queued here but not
        // on-screen yet. Both modes draw the same way; the only difference is
        // whether React terrain is hidden afterward.
        const { worldOffset, currentWorldTheme } = useWorldStore.getState();
        const atlasKey = THEME_TO_ATLAS_KEY[currentWorldTheme] || 'atlas_spring';

        rt.setVisible(true);
        scene._viewportVillageMidRT?.setVisible(true);
        scene._viewportVillageShadowMaskRT?.setVisible(true);
        scene._viewportFrontRT?.setVisible(true);
        setPhaserDebugFlag('showViewportTerrain', true);
        scene._drawViewportTerrain(worldOffset, currentWorldTheme);
        scene._lastWorldOffset = worldOffset;
        scene._lastTheme = currentWorldTheme;

        if (v === 'hybrid') {
          // Keep React terrain — no hide needed.
          setPhaserDebugFlag('hideReactWorldLayer', false);
          return;
        }

        // ── 'phaser' mode only: defer React hide by one Phaser frame ──
        // Hiding React in the same JS task that called _drawViewportTerrain causes
        // a black frame: React terrain disappears before Phaser's rAF fires and
        // commits the RT pixels to the canvas. Deferring via delayedCall(0) lets
        // Phaser complete one render pass first, so the transition is seamless.
        // In hybrid mode the gap is invisible (React terrain covers it); in phaser
        // mode it was exposed, producing the persistent black screen.
        scene.time.delayedCall(0, () => {
          // Guard: abort if RT is no longer visible, atlas is gone, or no tiles were
          // actually drawn. The last check catches the case where _drawViewportTerrain
          // ran but stamped 0 tiles (e.g. worldOffset placed all tiles off-screen).
          if (!rt.visible || !scene.textures.exists(atlasKey) || scene._drawnTileCount < 1) {
            if (import.meta.env.DEV) {
              console.warn(
                `[Phaser] renderMode phaser: RT not ready (visible=${rt.visible}, ` +
                `tilesDrawn=${scene._drawnTileCount}) — keeping React terrain visible`
              );
            }
            return;
          }
          setPhaserDebugFlag('hideReactWorldLayer', true);
        });
      },
    });

    // ── React world layer visibility ──
    Object.defineProperty(window.phaserDebug, 'hideReactWorldLayer', {
      configurable: true,
      get: () => getPhaserDebugFlags().hideReactWorldLayer,
      set: (v) => setPhaserDebugFlag('hideReactWorldLayer', Boolean(v)),
    });

    // ── Phaser entity layer ──
    Object.defineProperty(window.phaserDebug, 'showPhaserEntityLayer', {
      configurable: true,
      get: () => getPhaserDebugFlags().showPhaserEntityLayer,
      set: (v) => {
        const on = Boolean(v);
        scene._entityLayerVisible = on;
        for (const img of scene._entitySpritePool.values()) img.setVisible(on);
        setPhaserDebugFlag('showPhaserEntityLayer', on);
        if (on) scene._lastEntitySyncOffsetX = null;
      },
    });

    // ── React entity layer visibility ──
    Object.defineProperty(window.phaserDebug, 'hideReactEntityLayer', {
      configurable: true,
      get: () => getPhaserDebugFlags().hideReactEntityLayer,
      set: (v) => setPhaserDebugFlag('hideReactEntityLayer', Boolean(v)),
    });

    // ── Phaser player ──
    Object.defineProperty(window.phaserDebug, 'showPhaserPlayer', {
      configurable: true,
      get: () => getPhaserDebugFlags().showPhaserPlayer,
      set: (v) => {
        const on = Boolean(v);
        scene._phaserPet?.setVisible(on);
        setPhaserDebugFlag('showPhaserPlayer', on);
      },
    });

    // ── Debug overlays ──
    const playerMarker = this._playerMarker;
    Object.defineProperty(window.phaserDebug, 'showPlayerMarker', {
      configurable: true,
      get: () => getPhaserDebugFlags().showPlayerMarker,
      set: (v) => {
        const on = Boolean(v);
        playerMarker?.setVisible(on);
        setPhaserDebugFlag('showPlayerMarker', on);
      },
    });

    const entityMarkers = this._entityMarkers;
    Object.defineProperty(window.phaserDebug, 'showEntityMarkers', {
      configurable: true,
      get: () => getPhaserDebugFlags().showEntityMarkers,
      set: (v) => {
        const on = Boolean(v);
        entityMarkers?.setVisible(on);
        setPhaserDebugFlag('showEntityMarkers', on);
        if (on) scene._lastEntityMarkersOffsetX = null;
      },
    });

    // ── forceRedCanvas — hard CSS visibility test ──
    // Sets a full-viewport red rectangle at depth 999.
    // If this is not visible after `window.phaserDebug.forceRedCanvas = true`,
    // the Phaser canvas is still occluded by a React layer — do NOT hide React terrain.
    Object.defineProperty(window.phaserDebug, 'forceRedCanvas', {
      configurable: true,
      get: () => getPhaserDebugFlags().forceRedCanvas,
      set: (v) => {
        const on = Boolean(v);
        setPhaserDebugFlag('forceRedCanvas', on);
        if (!scene._redOverlay) {
          const cam = scene.cameras.main;
          scene._redOverlay = scene.add
            .rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, 0xff0000, 0.9)
            .setScrollFactor(0)
            .setDepth(999);
        }
        scene._redOverlay.setVisible(on);
      },
    });
  }

  // ─── Step 5A – small atlas tile strip ────────────────────────────────────────


  update() {
    const _frameStart = DEBUG_PERFORMANCE_PROFILER ? performance.now() : 0;

    const { worldOffset, currentWorldTheme } = useWorldStore.getState();
    const wx = worldOffset.x || 0;
    const wy = worldOffset.y || 0;

    const themeChanged = this._lastTheme !== currentWorldTheme;

    // Identity check: Zustand replaces the state object on any mutation,
    // so a reference comparison is both correct and O(1).
    const brokenState = useBrokenObjectsStore.getState();
    const brokenObjectsChanged =
      this._pendingBrokenObjectRedraw || brokenState !== this._lastBrokenState;

    const farmingRevision = useFarmingStore.getState().growthTickRevision;
    const farmingChanged = farmingRevision !== this._lastFarmingRevision;

    // ── Interior / world mode transition ──
    const inInterior = this._interiorManager?.locationState?.type === 'interior';
    if (inInterior !== this._wasInInterior) {
      this._wasInInterior = inInterior;
      if (inInterior) {
        // ── Enter interior ──────────────────────────────────────────────────
        // Hide outdoor terrain layers
        this._viewportTerrainRT?.setVisible(false);
        this._viewportVillageMidRT?.setVisible(false);
        this._viewportVillageShadowMaskRT?.setVisible(false);
        this._viewportFrontRT?.setVisible(false);
        this._hideFarmReadyBubbles();
        this._interiorManager.setVisible(true);

        // Pause and hide all exterior NPCs/merchants so they don't bleed
        // over the interior black background (their sprites sit at depth 52+,
        // above the interior tile RT at depth 2).
        this._npcManager?.setExteriorPaused(true);

        // Hide all exterior entity/pickup sprites immediately. Store the
        // current visibility flag so it can be restored on exit.
        this._savedEntityLayerVisible = this._entityLayerVisible;
        this._entityLayerVisible = false;
        if (this._entitySpritePool) {
          for (const sprite of this._entitySpritePool.values()) sprite.setVisible(false);
        }

        // Replace the village/terrain collision resolver with free movement so
        // the player can walk inside the interior without outdoor geometry blocking.
        setWorldMovementResolver(null);
      } else {
        // ── Exit interior ───────────────────────────────────────────────────
        // Restore outdoor terrain layers (respecting debug flag state)
        const terrainOn = getPhaserDebugFlags().showViewportTerrain ?? true;
        this._viewportTerrainRT?.setVisible(terrainOn);
        this._viewportVillageMidRT?.setVisible(terrainOn);
        this._viewportVillageShadowMaskRT?.setVisible(terrainOn);
        this._viewportFrontRT?.setVisible(terrainOn);
        this._interiorManager.setVisible(false);
        // Force terrain redraw on the next frame after returning to world
        this._lastWorldOffset = null;

        // Restore entity/pickup visibility to whatever it was before entering.
        this._entityLayerVisible = this._savedEntityLayerVisible ?? false;
        this._savedEntityLayerVisible = undefined;

        // Resume exterior NPCs and restore world collision
        this._npcManager?.setExteriorPaused(false);
        startCollisionSystem();

        // Immediately force the return door to closed state — skip the closing
        // animation so the door tile shows as closed the moment the player
        // re-appears in the village.
        const returnDoorId = this._interiorManager?.lastReturnDoorId || 'house_01';
        this._villageDoorManager?.forceCloseDoor(returnDoorId);
      }
    }

    // ── Interior rendering ──
    if (inInterior) {
      this._interiorManager.update(worldOffset);
      this._phaserPet?.update();
      this._playerInteractionManager?.update(worldOffset);
      this._hideFarmReadyBubbles();
      return;
    }

    // ── Chunk texture cache — advance frame counter, promote pending→ready RTs ──
    this._chunkTextureCache?.beginFrame();

    // ── Viewport terrain ──
    const terrainVisible = this._viewportTerrainRT?.visible || this._viewportFrontRT?.visible;
    const animationTick = Math.floor(this.time.now / 120);
    // _cachedHasAnimations is updated inside _drawViewportObjects when the layout
    // refreshes. Consuming the cached value here avoids an O(N) .some() scan every frame.
    const animationChanged = terrainVisible && this._cachedHasAnimations &&
      this._lastAnimationTick !== animationTick;

    // Sub-pixel guard: all stamp positions use Math.round(), so if the rounded
    // offset hasn't changed the rendered output would be pixel-identical.
    const roundedWx = Math.round(wx);
    const roundedWy = Math.round(wy);
    const movedByPixel =
      roundedWx !== Math.round(this._lastWorldOffset?.x ?? (roundedWx + 1)) ||
      roundedWy !== Math.round(this._lastWorldOffset?.y ?? (roundedWy + 1));

    // Village dirty: only when player moved a screen pixel, season changed, or
    // a door was opened/closed.  Animation ticks and broken-object changes do
    // NOT require the mid/shadow/front village RTs to be rebuilt.
    const currentDoorVersion = getVillageDoorStateVersion();
    const villageThemeKey = THEME_TO_ATLAS_KEY[currentWorldTheme] || 'atlas_spring';
    const villageDirty =
      movedByPixel ||
      themeChanged ||
      currentDoorVersion !== this._lastVillageDoorVersion ||
      villageThemeKey !== this._lastVillageThemeKey;

    // Invalidate chunk RTs when atlas/season changes.
    if (themeChanged && this._chunkTextureCache) {
      this._chunkTextureCache.invalidateAll();
    }

    if (!terrainVisible && import.meta.env.DEV && !this._warnedTerrainInvisible) {
      console.warn('[Terrain] terrain RT not visible — terrain will be black. Check renderMode setup.');
      this._warnedTerrainInvisible = true;
    }

    if (terrainVisible && (movedByPixel || themeChanged || animationChanged || brokenObjectsChanged || farmingChanged)) {
      const _t0 = (DEBUG_RENDER_PERFORMANCE || DEBUG_PERFORMANCE_PROFILER) ? performance.now() : 0;
      this._drawViewportTerrain(worldOffset, currentWorldTheme, { villageDirty });
      if (import.meta.env.DEV) {
        if (!this._loggedFirstTerrainDraw) {
          this._loggedFirstTerrainDraw = true;
          console.info(`[Terrain] first draw: tiles=${this._drawnTileCount} atlas=${THEME_TO_ATLAS_KEY[currentWorldTheme] || 'atlas_spring'} rtVisible=${this._viewportTerrainRT?.visible}`);
        }
        if (this._drawnTileCount === 0) {
          console.warn(`[Terrain] draw produced 0 tiles — black terrain expected. theme=${currentWorldTheme}`);
        }
      }
      if (DEBUG_RENDER_PERFORMANCE || DEBUG_PERFORMANCE_PROFILER) {
        const elapsed = performance.now() - _t0;
        const threshold = DEBUG_PERFORMANCE_PROFILER ? PERFORMANCE_SLOW_SECTION_MS : RENDER_SLOW_THRESHOLD_MS;
        if (elapsed > threshold) {
          console.warn(`[Perf] terrain ${elapsed.toFixed(1)}ms tiles=${this._drawnTileCount} (village=${villageDirty ? 'dirty' : 'skip'})`);
        }
      }
      this._lastWorldOffset = worldOffset;
      this._lastTheme = currentWorldTheme;
      this._lastAnimationTick = animationTick;
      this._lastBrokenState = brokenState;
      this._pendingBrokenObjectRedraw = false;
      this._lastFarmingRevision = farmingRevision;
      if (villageDirty) {
        this._lastVillageWxRounded = roundedWx;
        this._lastVillageWyRounded = roundedWy;
        this._lastVillageDoorVersion = currentDoorVersion;
        this._lastVillageThemeKey = villageThemeKey;
      }
    }

    // ── Chunk prewarm — generate ahead-of-player chunks, one per frame ──────
    if (!inInterior) {
      const playerX = -wx;
      const playerY = -wy;
      const cam = this.cameras.main;
      const viewport = { width: cam.width, height: cam.height };

      // Direction-aware priority: generate chunks ahead of movement first.
      const prewarmPriority = (this._prewarmLastPx != null)
        ? { x: Math.sign(playerX - this._prewarmLastPx), y: Math.sign(playerY - this._prewarmLastPy) }
        : undefined;
      this._prewarmLastPx = playerX;
      this._prewarmLastPy = playerY;

      const now = performance.now();
      let chunksGenerated = 0;

      // ── Post-startup cooldown ───────────────────────────────────────────────
      // For 2.5 s after loading completes the preload range is fully warm and
      // any runtime prewarm call would immediately return remainingCount=0 (a
      // fast no-op scan). The cooldown is an explicit safety net: if anything
      // was missed, we skip generation here rather than risk a burst spike.
      const inCooldown = now < this._startupCooldownUntil;

      if (!inCooldown) {
        // ── Single-shot prewarm — no while loop ──────────────────────────────
        // The original while loop allowed a fast chunk to drag in a slow second
        // chunk within the same frame (budget check fires BEFORE each call).
        // Running exactly ONE attempt per frame caps the worst-case per-frame
        // cost at one buildChunkLayout call (~5–40 ms for complex chunks).
        const budgetStart = performance.now();
        const result = primeWorldAtlasWindow(playerX, playerY, WORLD_ATLAS_DATA, viewport, {
          includePreload: true,
          maxChunks: CHUNK_PREWARM_STEPS_PER_FRAME,
          priority: prewarmPriority,
        });
        chunksGenerated = result.generatedCount;

        // ── First-5-s debug counter ───────────────────────────────────────────
        if (import.meta.env.DEV && this._debugPrewarmStart != null && !this._debugPrewarmLogged) {
          this._debugPrewarmChunks += result.generatedCount;
          if (now - this._debugPrewarmStart >= 5000) {
            console.info(
              `[Startup] runtime chunks generated in first 5 s: ${this._debugPrewarmChunks}` +
              ` (expect 0 if preload was complete)`
            );
            this._debugPrewarmLogged = true;
          }
        }

        if (DEBUG_CHUNK_PERFORMANCE || DEBUG_RENDER_PERFORMANCE || DEBUG_PERFORMANCE_PROFILER) {
          const elapsed = performance.now() - budgetStart;
          const chunkThreshold = DEBUG_PERFORMANCE_PROFILER ? PERFORMANCE_SLOW_SECTION_MS : DEBUG_CHUNK_SLOW_THRESHOLD_MS;
          if (chunksGenerated > 0 && elapsed > chunkThreshold) {
            console.warn(`[Perf] prewarm ${elapsed.toFixed(1)}ms (${chunksGenerated} chunks)`);
          }
        }
      }

      // Evict chunk RTs for chunks that have scrolled far behind the player.
      if (this._chunkTextureCache && this._lastLayout) {
        const chunks = this._lastLayout.tileChunks || [];
        if (chunks.length > 0) {
          let minCX = Infinity, maxCX = -Infinity, minCY = Infinity, maxCY = -Infinity;
          for (const c of chunks) {
            if (c.chunkX < minCX) minCX = c.chunkX;
            if (c.chunkX > maxCX) maxCX = c.chunkX;
            if (c.chunkY < minCY) minCY = c.chunkY;
            if (c.chunkY > maxCY) maxCY = c.chunkY;
          }
          this._chunkTextureCache.evictDistantChunks(
            { minChunkX: minCX, maxChunkX: maxCX, minChunkY: minCY, maxChunkY: maxCY }
          );
        }
      }
    }

    // ── Phaser entity sprites ──
    if (this._entityLayerVisible) {
      const { entities } = useEntityStore.getState();
      const roundedEntityX = Math.round(wx);
      const roundedEntityY = Math.round(wy);
      const entityMoved =
        roundedEntityX !== this._lastEntitySyncRoundedX ||
        roundedEntityY !== this._lastEntitySyncRoundedY;
      const countChanged = this._lastEntitySyncCount !== entities.length;

      if (entityMoved || countChanged) {
        const _te0 = (DEBUG_RENDER_PERFORMANCE || DEBUG_PERFORMANCE_PROFILER) ? performance.now() : 0;
        this._syncPhaserEntitySprites(worldOffset, entities);
        if (DEBUG_RENDER_PERFORMANCE || DEBUG_PERFORMANCE_PROFILER) {
          const elapsed = performance.now() - _te0;
          const threshold = DEBUG_PERFORMANCE_PROFILER ? PERFORMANCE_SLOW_SECTION_MS : RENDER_SLOW_THRESHOLD_MS;
          if (elapsed > threshold) console.warn(`[Perf] entity sync ${elapsed.toFixed(1)}ms`);
        }
        this._lastEntitySyncRoundedX = roundedEntityX;
        this._lastEntitySyncRoundedY = roundedEntityY;
        this._lastEntitySyncCount = entities.length;
      }
    }

    // ── Phaser player ──
    this._phaserPet?.update();

    // ── Phaser NPCs ──
    {
      const _tn0 = (DEBUG_RENDER_PERFORMANCE || DEBUG_PERFORMANCE_PROFILER) ? performance.now() : 0;
      this._npcManager?.update();
      if (DEBUG_RENDER_PERFORMANCE || DEBUG_PERFORMANCE_PROFILER) {
        const elapsed = performance.now() - _tn0;
        const threshold = DEBUG_PERFORMANCE_PROFILER ? PERFORMANCE_SLOW_SECTION_MS : RENDER_SLOW_THRESHOLD_MS;
        if (elapsed > threshold) console.warn(`[Perf] NPC update ${elapsed.toFixed(1)}ms`);
      }
    }

    // ── Village doors ──
    this._villageDoorManager?.update(worldOffset, this.game.loop.delta || 0);

    // ── Player door interaction ──
    this._playerInteractionManager?.update(worldOffset);

    // ── Farming ready bubbles ──
    this._syncFarmReadyBubbles(worldOffset);

    // ── Phaser world interaction FX ──
    this._syncWorldFxSprites(worldOffset);

    // ── forceRedCanvas resize ──
    if (this._redOverlay?.visible) {
      const cam = this.cameras.main;
      this._redOverlay.setPosition(cam.width / 2, cam.height / 2);
      this._redOverlay.setSize(cam.width, cam.height);
    }

    if (
      this._villageCollisionDebug?.visible ||
      this._villageDepthDebug?.visible ||
      this._playerCollisionDebug?.visible
    ) {
      if (this._villageCollisionDebug?.visible) {
        this._drawVillageCollisionDebug(worldOffset);
      }
      if (this._villageDepthDebug?.visible) {
        this._drawVillageDepthDebug(worldOffset);
      }
      if (this._playerCollisionDebug?.visible) {
        this._drawPlayerCollisionDebug(worldOffset);
      }
      this._lastVillageCollisionDebugOffsetX = wx;
      this._lastVillageCollisionDebugOffsetY = wy;
    }

    // ── Debug entity markers ──
    if (this._entityMarkers?.visible) {
      const { entities } = useEntityStore.getState();
      const markerMoved =
        this._lastEntityMarkersOffsetX !== wx ||
        this._lastEntityMarkersOffsetY !== wy;
      const markerCountChanged = this._lastEntityMarkersCount !== entities.length;

      if (markerMoved || markerCountChanged) {
        this._drawEntityMarkers(worldOffset, entities);
        this._lastEntityMarkersOffsetX = wx;
        this._lastEntityMarkersOffsetY = wy;
        this._lastEntityMarkersCount = entities.length;
      }
    }

    if (DEBUG_PERFORMANCE_PROFILER) {
      const frameDuration = performance.now() - _frameStart;
      if (frameDuration > PERFORMANCE_SLOW_FRAME_MS) {
        console.warn(`[Perf] SLOW FRAME ${frameDuration.toFixed(1)}ms`);
      }
    }
  }

  shutdown() {
    if (this._runtimeDisposers?.length) {
      this._runtimeDisposers.forEach((dispose) => {
        if (typeof dispose === 'function') {
          dispose();
        }
      });
      this._runtimeDisposers = [];
    }

    // Destroy entity sprites.
    if (this._entitySpritePool) {
      for (const obj of this._entitySpritePool.values()) obj.destroy();
      this._entitySpritePool.clear();
    }

    if (this._worldFxSpritePool) {
      for (const obj of this._worldFxSpritePool.values()) obj.destroy();
      this._worldFxSpritePool.clear();
    }

    if (this._worldImpactSpritePool) {
      for (const obj of this._worldImpactSpritePool.values()) obj.destroy();
      this._worldImpactSpritePool.clear();
    }

    if (this._farmReadyBubblePool) {
      for (const entry of this._farmReadyBubblePool.values()) {
        entry.bubble?.destroy();
        entry.icon?.destroy();
      }
      this._farmReadyBubblePool.clear();
    }

    this._startupPreload?.destroy();
    this._startupPreload = null;
    this._playerInteractionManager?.destroy();
    this._playerInteractionManager = null;
    this._circleTransitionManager?.destroy();
    this._circleTransitionManager = null;
    this._interiorManager?.destroy();
    this._interiorManager = null;
    this._phaserPet?.destroy();
    this._phaserPet = null;
    this._npcManager?.destroy();
    this._npcManager = null;

    this._playerMarker?.destroy();
    this._playerMarker = null;
    this._entityMarkers?.destroy();
    this._entityMarkers = null;
    this._redOverlay?.destroy();
    this._redOverlay = null;
    this._villageCollisionDebug?.destroy();
    this._villageCollisionDebug = null;
    this._playerCollisionDebug?.destroy();
    this._playerCollisionDebug = null;
    this._villageDepthDebug?.destroy();
    this._villageDepthDebug = null;
    this._villageDoorManager?.destroy();
    this._villageDoorManager = null;
    this._viewportVillageMidRT?.destroy();
    this._viewportVillageMidRT = null;
    this._viewportVillageShadowMaskRT?.destroy();
    this._viewportVillageShadowMaskRT = null;
    this._viewportFrontRT?.destroy();
    this._viewportFrontRT = null;

    this._chunkTextureCache?.destroy();
    this._chunkTextureCache = null;

    this._decorFrameKeyCache?.clear();
    this._fxFrameKeyCache?.clear();
    this._urlToKeyCache?.clear();
    this._warnedFrames?.clear();

    if (import.meta.env.DEV) {
      console.log('[Phaser MainScene] Shutting down');
    }
  }
}

export default MainScene;
