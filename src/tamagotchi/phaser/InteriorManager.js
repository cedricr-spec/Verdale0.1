import { useWorldStore } from '../store/worldSlice';

// ─── TMJ parsing constants ───────────────────────────────────────────────────
const TILED_FLIP_FLAG_MASK = 0x1fffffff;
const INTERIOR_SOURCE_TILE_SIZE = 16;
const INTERIOR_RENDER_SCALE = 2;
const INTERIOR_RENDER_TILE_SIZE = INTERIOR_SOURCE_TILE_SIZE * INTERIOR_RENDER_SCALE;
const INTERIOR_TILESET_COLUMNS = 116; // same SolariaMegaTileset layout as village

// ─── Depth layout (interior mode) ────────────────────────────────────────────
// depth 0  : black background rect   ← hides world behind interior
// depth 2  : interior tile RT        ← ground / objects / over
// depth 52 : player shadow           (unchanged, shared constant)
// depth 54+: player body             (unchanged, Y-sorted)
const INTERIOR_BG_DEPTH = 0;
const INTERIOR_TILE_DEPTH = 2;

// ─── Interior map registry ────────────────────────────────────────────────────
// "Interior #1.tmj" cannot be statically imported by Rollup because '#' is
// treated as a URL fragment separator.  We use a thin JS bridge file instead.
import interior1MapData from '../../spritesheets/interiors/interior1Map.js';

const INTERIOR_REGISTRY = {
  interior_01: {
    id: 'interior_01',
    mapData: interior1MapData, // already-parsed JS object — no JSON.parse needed
    // Uses the same village atlas already loaded by MainScene
    textureKey: 'village_default',
    parsed: null, // lazy-processed on first enter
  },
};

// ─── TMJ parser ──────────────────────────────────────────────────────────────

function flattenTMJLayers(layers, out = []) {
  for (const layer of layers || []) {
    if (layer.type === 'group') {
      flattenTMJLayers(layer.layers, out);
    } else {
      out.push(layer);
    }
  }
  return out;
}

/** @param {object} map - already-parsed Tiled JSON object */
function parseInteriorMap(map) {
  const firstgid = Number(map.tilesets?.[0]?.firstgid) || 1;
  const mapWidth = Number(map.width) || 0;
  const mapHeight = Number(map.height) || 0;

  const tileLayers = [];
  const exitObjects = [];
  const spawnObjects = [];

  for (const layer of flattenTMJLayers(map.layers)) {
    // ── Tile layer ──
    if (layer.type === 'tilelayer') {
      const tiles = [];
      (layer.data || []).forEach((rawGid, i) => {
        const gid = rawGid & TILED_FLIP_FLAG_MASK;
        if (!gid || gid < firstgid) return;
        const localId = gid - firstgid;
        tiles.push({
          x: i % mapWidth,
          y: Math.floor(i / mapWidth),
          sx: (localId % INTERIOR_TILESET_COLUMNS) * INTERIOR_SOURCE_TILE_SIZE,
          sy: Math.floor(localId / INTERIOR_TILESET_COLUMNS) * INTERIOR_SOURCE_TILE_SIZE,
          sw: INTERIOR_SOURCE_TILE_SIZE,
          sh: INTERIOR_SOURCE_TILE_SIZE,
        });
      });
      tileLayers.push({ name: layer.name, tiles });
      continue;
    }

    // ── Object layer ──
    if (layer.type === 'objectgroup') {
      // Layer-level properties (e.g. the "exit" layer has type/targetDoorId there)
      const layerProps = {};
      for (const p of layer.properties || []) layerProps[p.name] = p.value;

      for (const obj of layer.objects || []) {
        // Object-level properties (e.g. spawn objects have type/spawnId on the object)
        const objProps = {};
        for (const p of obj.properties || []) objProps[p.name] = p.value;

        const effectiveType = objProps.type || layerProps.type || '';
        const targetDoorId = objProps.targetDoorId || layerProps.targetDoorId || '';
        const spawnId = objProps.spawnId || '';

        if (effectiveType === 'exit') {
          // Store bounds in display (2×) coords
          exitObjects.push({
            left:   obj.x * INTERIOR_RENDER_SCALE,
            top:    obj.y * INTERIOR_RENDER_SCALE,
            right:  (obj.x + (obj.width  || 0)) * INTERIOR_RENDER_SCALE,
            bottom: (obj.y + (obj.height || 0)) * INTERIOR_RENDER_SCALE,
            targetDoorId,
          });
        }

        if (effectiveType === 'player_spawn') {
          spawnObjects.push({
            x: obj.x * INTERIOR_RENDER_SCALE,
            y: obj.y * INTERIOR_RENDER_SCALE,
            spawnId,
          });
        }
      }
    }
  }

  return {
    mapWidth,
    mapHeight,
    pixelWidth:  mapWidth  * INTERIOR_RENDER_TILE_SIZE,
    pixelHeight: mapHeight * INTERIOR_RENDER_TILE_SIZE,
    firstgid,
    tileLayers,
    exitObjects,
    spawnObjects,
  };
}

function getInteriorEntry(interiorId) {
  const entry = INTERIOR_REGISTRY[interiorId];
  if (!entry) return null;
  if (!entry.parsed) entry.parsed = parseInteriorMap(entry.mapData);
  return entry;
}

// ─── InteriorManager ─────────────────────────────────────────────────────────

export default class InteriorManager {
  constructor(scene) {
    this._scene = scene;
    /** @type {{ type: 'world'|'interior', interiorId: string|null, returnDoorId: string|null }} */
    this._locationState = { type: 'world', interiorId: null, returnDoorId: null };
    this._returnWorldOffset = null;  // saved on enter, restored on exit
    this._lastReturnDoorId = null;   // persists after exit so callers can force-close it
    this._currentEntry = null;       // INTERIOR_REGISTRY entry
    this._currentData = null;        // parsed TMJ data
    this._frameCache = new Map();    // frameKey → true; shared with village atlas frames
    this._lastDrawSig = '';

    this._setupRenderObjects();
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  get locationState() { return this._locationState; }
  get lastReturnDoorId() { return this._lastReturnDoorId; }

  enterInterior(interiorId, returnDoorId) {
    console.info('[Interior] entering:', interiorId);

    const entry = getInteriorEntry(interiorId);
    if (!entry) {
      console.warn('[Interior] unknown interiorId:', interiorId);
      return;
    }

    const data = entry.parsed;
    this._currentEntry = entry;
    this._currentData  = data;

    // Save current world offset so we can restore it on exit
    const { worldOffset } = useWorldStore.getState();
    this._returnWorldOffset = { x: worldOffset.x, y: worldOffset.y };

    // Find the entry spawn (spawnId === 'entry'), fallback to map centre
    const spawn = data.spawnObjects.find(s => s.spawnId === 'entry')
               || data.spawnObjects[0]
               || null;
    const spawnX = spawn ? spawn.x : data.pixelWidth  * 0.5;
    const spawnY = spawn ? spawn.y : data.pixelHeight * 0.5;

    if (!spawn) {
      console.warn('[Interior] no spawn point found, defaulting to map centre');
    }

    // Teleport player: worldOffset = −spawnPos so the player (always at screen
    // centre) appears at the spawn position inside the interior.
    useWorldStore.setState({ worldOffset: { x: -spawnX, y: -spawnY } });

    this._lastReturnDoorId = returnDoorId || null;
    this._locationState = { type: 'interior', interiorId, returnDoorId };
    this._lastDrawSig   = '';

    console.info('[Interior] loaded:', interiorId);
  }

  exitInterior(targetDoorId) {
    const dest = targetDoorId || this._locationState.returnDoorId || 'house_01';
    console.info('[Interior] exiting to:', dest);

    if (this._returnWorldOffset) {
      // Nudge the player slightly south so they appear just outside the door
      useWorldStore.setState({
        worldOffset: {
          x: this._returnWorldOffset.x,
          y: this._returnWorldOffset.y - 8,
        },
      });
    }

    this._locationState  = { type: 'world', interiorId: null, returnDoorId: null };
    this._currentEntry   = null;
    this._currentData    = null;
    this._returnWorldOffset = null;
    this._lastDrawSig    = '';
  }

  /** Returns the nearest exit object if the player is within `range` px, else null. */
  getNearbyExit(worldOffset, range) {
    if (this._locationState.type !== 'interior' || !this._currentData) return null;

    // Player world position inside the interior == −worldOffset
    const px = -(worldOffset.x || 0);
    const py = -(worldOffset.y || 0);

    for (const exit of this._currentData.exitObjects) {
      const cx = (exit.left + exit.right)  * 0.5;
      const cy = (exit.top  + exit.bottom) * 0.5;
      if (Math.hypot(px - cx, py - cy) <= range) return exit;
    }
    return null;
  }

  /**
   * Draws interior tiles every frame when active.
   * Only redraws when worldOffset changed (player moved).
   */
  update(worldOffset) {
    if (this._locationState.type !== 'interior') return;
    if (!this._currentEntry || !this._currentData)  return;

    const cam       = this._scene.cameras.main;
    const wx        = worldOffset.x || 0;
    const wy        = worldOffset.y || 0;
    const signature = `${wx},${wy}`;
    if (signature === this._lastDrawSig) return;
    this._lastDrawSig = signature;

    // Resize RT if viewport changed
    const rt = this._interiorRT;
    if (rt.width !== cam.width || rt.height !== cam.height) {
      rt.resize(cam.width, cam.height);
    }

    // Resize black background to cover full viewport
    this._bgRect
      .setPosition(cam.width * 0.5, cam.height * 0.5)
      .setSize(cam.width, cam.height);

    const entry      = this._currentEntry;
    const data       = this._currentData;
    const textureKey = entry.textureKey;

    if (!this._scene.textures.exists(textureKey)) return;

    const texture = this._scene.textures.get(textureKey);
    const cx      = cam.width  * 0.5;
    const cy      = cam.height * 0.5;

    rt.clear();

    for (const layer of data.tileLayers) {
      for (const tile of layer.tiles) {
        const drawX = Math.round(cx + wx + tile.x * INTERIOR_RENDER_TILE_SIZE);
        const drawY = Math.round(cy + wy + tile.y * INTERIOR_RENDER_TILE_SIZE);

        // Viewport cull
        const tileDisplay = INTERIOR_RENDER_TILE_SIZE;
        if (
          drawX + tileDisplay < 0 || drawX > cam.width  ||
          drawY + tileDisplay < 0 || drawY > cam.height
        ) continue;

        // Register source frame in the texture atlas once
        const frameKey = `interior_${tile.sx}_${tile.sy}_${tile.sw}_${tile.sh}`;
        if (!this._frameCache.has(frameKey)) {
          texture.add(frameKey, 0, tile.sx, tile.sy, tile.sw, tile.sh);
          this._frameCache.set(frameKey, true);
        }
        if (!texture.has(frameKey)) continue;

        rt.stamp(textureKey, frameKey, drawX, drawY, {
          scale:   INTERIOR_RENDER_SCALE,
          originX: 0,
          originY: 0,
        });
      }
    }
  }

  /** Show or hide the interior render objects. Called by MainScene on transitions. */
  setVisible(visible) {
    this._bgRect?.setVisible(visible);
    this._interiorRT?.setVisible(visible);
  }

  destroy() {
    this._bgRect?.destroy();
    this._bgRect = null;
    this._interiorRT?.destroy();
    this._interiorRT = null;
    this._frameCache?.clear();
    this._frameCache = null;
    this._scene = null;
    this._currentEntry = null;
    this._currentData  = null;
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _setupRenderObjects() {
    const scene = this._scene;
    const cam   = scene.cameras.main;

    // Full-viewport black rectangle that hides the outdoor world behind the interior
    this._bgRect = scene.add
      .rectangle(cam.width * 0.5, cam.height * 0.5, cam.width, cam.height, 0x000000, 1)
      .setScrollFactor(0)
      .setDepth(INTERIOR_BG_DEPTH)
      .setVisible(false);

    // RenderTexture for interior tiles
    this._interiorRT = scene.add
      .renderTexture(0, 0, cam.width, cam.height)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(INTERIOR_TILE_DEPTH)
      .setVisible(false);
    this._interiorRT.setRenderMode?.('all');
  }
}
