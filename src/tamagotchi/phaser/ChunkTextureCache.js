import {
  MAX_CACHED_CHUNK_TEXTURES,
  DEBUG_CHUNK_TEXTURE_CACHE,
} from '../config/worldStreamingConfig';

// CHUNK_TILE_SIZE (16) × WORLD_ATLAS_TILE_SIZE (16 × 2 = 32) = 512 px per side.
// This matches getChunkBounds() / getChunkPixelSize() in worldAtlasFamilies.js.
export const CHUNK_RT_SIZE = 512;

// ─── ChunkTextureCache ────────────────────────────────────────────────────────
/**
 * Renders each chunk's static tile layers (tileBackItems + tileFrontItems)
 * into a per-chunk RenderTexture once, then reuses it every viewport refresh.
 *
 * Lifecycle per chunk RT:
 *   Frame N  : buildChunkRT() stamps tile items into a new RT (renderMode='all').
 *              Entry is placed in _pending.
 *   Frame N+1: beginFrame() promotes _pending → _ready.
 *              Phaser's renderer has processed the RT's command queue in frame N's
 *              render pass; the GL framebuffer now holds the correct pixels.
 *              We switch to renderMode='render' (freeze the GL content, no replay).
 *              saveTexture(key) registers the GL texture for stamp() usage.
 *   Frame N+2+: drawToRT() stamps the saved texture key into the viewport RT
 *              with a single stamp() call instead of N individual tile stamps.
 *
 * Dirty invalidation:
 *   - Season / atlas key change → invalidateAll()
 *   - Broken objects do NOT affect tile layers (breakable items are floatingItems)
 *     so no per-broken-object invalidation is needed.
 *
 * Memory:
 *   - Each RT is 512×512×4 bytes ≈ 1 MB.
 *   - LRU eviction keeps the cache under MAX_CACHED_CHUNK_TEXTURES entries.
 */
export default class ChunkTextureCache {
  constructor(scene) {
    this._scene = scene;
    // Entries built this frame; Phaser will process their commands in the render pass.
    // Map<cacheKey, entry>
    this._pending = new Map();
    // Entries whose GL framebuffers are frozen and ready to blit.
    // Map<cacheKey, entry>
    this._ready = new Map();
    this._frame = 0;
    this._stats = {
      hits:      0,
      misses:    0,
      rebuilds:  0,
      evictions: 0,
      visible:   0,
    };
  }

  get stats() { return this._stats; }

  // ── Called at the START of MainScene.update() ───────────────────────────────

  beginFrame() {
    this._frame++;

    // Promote every entry that was built in the PREVIOUS frame.
    // By now Phaser's renderer has run the RT's command queue (renderMode='all'),
    // so the GL framebuffer is populated.  Switching to 'render' freezes it.
    for (const [key, entry] of this._pending) {
      if (typeof entry.chunkRT.setRenderMode === 'function') {
        entry.chunkRT.setRenderMode('render');
      }

      // Register the frozen GL texture under a named key so stamp() can use it.
      let useSaved = false;
      if (typeof entry.chunkRT.saveTexture === 'function') {
        try {
          if (this._scene.textures.exists(entry.textureKey)) {
            this._scene.textures.remove(entry.textureKey);
          }
          entry.chunkRT.saveTexture(entry.textureKey);
          useSaved = true;
        } catch (_e) {
          useSaved = false;
        }
      }
      entry.useSavedTexture = useSaved;

      this._ready.set(key, entry);

      if (DEBUG_CHUNK_TEXTURE_CACHE) {
        console.log(
          `[ChunkRT] ready (${entry.chunkKey}) atlas=${entry.atlasKey}` +
          ` saved=${useSaved}`
        );
      }
    }
    this._pending.clear();

    // Periodic stats log
    if (DEBUG_CHUNK_TEXTURE_CACHE) {
      if (this._frame % 120 === 0) {
        console.log(
          `[ChunkRT] frame=${this._frame}` +
          ` hits=${this._stats.hits} misses=${this._stats.misses}` +
          ` rebuilds=${this._stats.rebuilds} evictions=${this._stats.evictions}` +
          ` ready=${this._ready.size} visible/120f=${this._stats.visible}`
        );
        this._stats.visible = 0;
      }
    }
  }

  // ── Cache key ───────────────────────────────────────────────────────────────

  _cacheKey(chunkKey, atlasKey) {
    return `${chunkKey}@${atlasKey}`;
  }

  // ── Query ───────────────────────────────────────────────────────────────────

  /** True if the entry exists in the pending queue (built this/last frame, not yet frozen). */
  isPending(chunkKey, atlasKey) {
    return this._pending.has(this._cacheKey(chunkKey, atlasKey));
  }

  // ── Draw ────────────────────────────────────────────────────────────────────

  /**
   * Draws the cached chunk tile layer into targetRT at (blitX, blitY).
   * Returns true on cache hit, false on miss or pending (caller must fall back).
   */
  drawToRT(chunkKey, atlasKey, targetRT, blitX, blitY) {
    const key = this._cacheKey(chunkKey, atlasKey);
    const entry = this._ready.get(key);
    if (!entry) {
      this._stats.misses++;
      return false;
    }

    entry.lastUsedFrame = this._frame;
    this._stats.hits++;
    this._stats.visible++;

    if (entry.useSavedTexture && this._scene.textures.exists(entry.textureKey)) {
      // Fast path: single stamp of the saved texture frame.
      targetRT.stamp(entry.textureKey, '__BASE', blitX, blitY, {
        scale:   1,
        originX: 0,
        originY: 0,
      });
    } else {
      // Fallback: draw the RT object directly (WebGL blits its current framebuffer).
      targetRT.draw(entry.chunkRT, blitX, blitY);
    }
    return true;
  }

  // ── Build ───────────────────────────────────────────────────────────────────

  /**
   * Creates a new RenderTexture for the chunk and stamps its static tile items
   * (tileBackItems + tileFrontItems without animations or parent bindings).
   *
   * The RT is placed in _pending.  It becomes ready in the NEXT beginFrame() call,
   * after Phaser has processed its command queue during this frame's render pass.
   */
  buildChunkRT(chunk, atlasKey, texture, frameCache) {
    const scene = this._scene;
    const key   = this._cacheKey(chunk.key, atlasKey);

    // Evict any existing entry for this key before rebuilding.
    this._evictEntry(key);

    const chunkRT = scene.add
      .renderTexture(0, 0, CHUNK_RT_SIZE, CHUNK_RT_SIZE)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setVisible(false);

    // 'all' mode: Phaser processes the command queue during the render phase,
    // even when the RT is setVisible(false).
    chunkRT.setRenderMode?.('all');

    const originX = chunk.bounds.left;
    const originY = chunk.bounds.top;

    // Only cache static, non-parent-bound tile items.
    // Floating items (trees, rocks) and animated tiles are stamped per-frame.
    const staticItems = [
      ...(chunk.tileBackItems  || []),
      ...(chunk.tileFrontItems || []),
    ].filter((item) => !item.parentObjectId && !item.animation);

    let stamped = 0;
    for (const item of staticItems) {
      const entry = item.entry;
      if (!entry) continue;

      const scale = item.scale || 1;
      const srcX  = entry.x;
      const srcY  = entry.y;
      const srcW  = item.renderWidth  || entry.width;
      const srcH  = item.renderHeight || entry.height;

      // anchorMode='tile' → anchorX=0, anchorY=0
      const stampX = Math.round(item.x - originX);
      const stampY = Math.round(item.y - originY);

      if (stampX + srcW * scale < 0 || stampX > CHUNK_RT_SIZE) continue;
      if (stampY + srcH * scale < 0 || stampY > CHUNK_RT_SIZE) continue;

      const frameKey = `layout_${srcX}_${srcY}_${srcW}_${srcH}`;
      if (!frameCache.has(frameKey)) {
        texture.add(frameKey, 0, srcX, srcY, srcW, srcH);
        frameCache.set(frameKey, true);
      }
      if (!texture.has(frameKey)) continue;

      chunkRT.stamp(atlasKey, frameKey, stampX, stampY, {
        scale,
        originX: 0,
        originY: 0,
      });
      stamped++;
    }

    const textureKey = `chrt_${key}`;
    this._pending.set(key, {
      chunkRT,
      textureKey,
      chunkKey:       chunk.key,
      chunkX:         chunk.chunkX,
      chunkY:         chunk.chunkY,
      atlasKey,
      lastUsedFrame:  this._frame,
      useSavedTexture: false,
    });
    this._stats.rebuilds++;

    if (DEBUG_CHUNK_TEXTURE_CACHE) {
      console.log(
        `[ChunkRT] build (${chunk.key}) atlas=${atlasKey} ` +
        `stamped=${stamped} (pending until next frame)`
      );
    }
  }

  // ── Invalidation ────────────────────────────────────────────────────────────

  /** Invalidate all entries for a specific atlas key (e.g. on season change). */
  invalidateAllForAtlas(atlasKey) {
    for (const [key, entry] of this._ready) {
      if (entry.atlasKey === atlasKey) this._evictEntry(key);
    }
    for (const [key, entry] of this._pending) {
      if (entry.atlasKey === atlasKey) {
        entry.chunkRT?.destroy();
        this._pending.delete(key);
      }
    }
    if (DEBUG_CHUNK_TEXTURE_CACHE) {
      console.log(`[ChunkRT] invalidated all for atlas=${atlasKey}`);
    }
  }

  /** Invalidate everything (e.g. on scene restart). */
  invalidateAll() {
    for (const [key] of [...this._ready]) this._evictEntry(key);
    for (const [, entry] of this._pending) entry.chunkRT?.destroy();
    this._pending.clear();
    if (DEBUG_CHUNK_TEXTURE_CACHE) {
      console.log('[ChunkRT] invalidated all');
    }
  }

  // ── Eviction ────────────────────────────────────────────────────────────────

  /**
   * Evict chunk RTs that are outside the given active chunk range (+ margin).
   * Called after prewarm to free memory for chunks far behind the player.
   */
  evictDistantChunks(activeRange, margin = 2) {
    for (const [key, entry] of this._ready) {
      if (
        entry.chunkX < activeRange.minChunkX - margin ||
        entry.chunkX > activeRange.maxChunkX + margin ||
        entry.chunkY < activeRange.minChunkY - margin ||
        entry.chunkY > activeRange.maxChunkY + margin
      ) {
        this._evictEntry(key);
        this._stats.evictions++;
      }
    }
  }

  /** LRU eviction — called after each buildChunkRT to stay under the memory cap. */
  _evictLRU() {
    if (this._ready.size <= MAX_CACHED_CHUNK_TEXTURES) return;

    let lruKey   = null;
    let lruFrame = Infinity;
    for (const [k, entry] of this._ready) {
      if (entry.lastUsedFrame < lruFrame) {
        lruFrame = entry.lastUsedFrame;
        lruKey   = k;
      }
    }
    if (lruKey) {
      this._evictEntry(lruKey);
      this._stats.evictions++;
      if (DEBUG_CHUNK_TEXTURE_CACHE) {
        console.log(`[ChunkRT] LRU evict ${lruKey} (lastFrame=${lruFrame})`);
      }
    }
  }

  _evictEntry(key) {
    const entry = this._ready.get(key);
    if (!entry) return;

    if (entry.useSavedTexture) {
      try {
        if (this._scene?.textures?.exists(entry.textureKey)) {
          this._scene.textures.remove(entry.textureKey);
        }
      } catch (_e) { /* ignore */ }
    }
    entry.chunkRT?.destroy();
    this._ready.delete(key);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  destroy() {
    this.invalidateAll();
    this._scene = null;
  }
}
