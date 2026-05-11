// Chunk dimensions are expressed in atlas tiles, not pixels.
// Larger chunks reduce cache churn; smaller chunks reduce per-generation cost.
export const CHUNK_TILE_SIZE = 16;

// Extra fully-rendered chunk margin around the exact visible chunk window.
export const ACTIVE_RADIUS_X = 0;
export const ACTIVE_RADIUS_Y = 0;

// Additional chunks to generate and keep warm beyond the active render window.
export const PRELOAD_RADIUS_X = 2;
export const PRELOAD_RADIUS_Y = 2;

// Extra chunk margin kept in cache before distant chunks are pruned.
export const DESPAWN_MARGIN = 2;

// Overscan keeps edge pop-in down while still culling far-away content.
export const RENDER_OVERSCAN_TILES = 10;
export const COLLISION_OVERSCAN_TILES = 6;

// Idle chunk work budget. Keep this tiny so chunk warm-up does not land as a frame hitch.
export const CHUNK_PREWARM_STEPS_PER_FRAME = 1;

// Each cached chunk is generated with a small padding ring for stable borders.
export const CHUNK_GENERATION_PADDING_TILES = 8;

// Decor tuning. These stay global while family-specific rules live in worldObjectProfiles.
export const FLOWER_DENSITY = 1.85;
export const DECOR_JITTER = 1;
export const DECOR_MIN_DISTANCE = 1;
export const TREE_CLUSTER_CHANCE = 1;
export const TREE_MAX_PER_CHUNK = 1;
export const TREE_OVERLAP_PADDING_TILES = 2.4;

// Soft caps for cache churn and optional developer diagnostics.
// Must exceed the largest expected preloadChunkRange size (144–252 chunks for
// 960×720–4K viewports) so startup prewarm never evicts the inner active-range
// chunks it just generated.  128 caused eviction of center chunks → first-render
// spike.  512 gives comfortable headroom for all common screen sizes.
export const MAX_CACHED_WORLD_CHUNKS = 512;
export const MAX_CACHED_WORLD_WINDOWS = 16;

export const SHOW_WORLD_STREAMING_DEBUG = false;

export const DEV_START_FULLSCREEN_UI = true;
export const DEV_START_WORLD_DEBUG = false;

// "full" = true fullscreen play mode. Set to "contained" for spawn/culling debug tuning.
export const WORLD_VIEWPORT_MODE = "full";
export const WORLD_VIEWPORT_SCALE = 0.9;
export const WORLD_VIEWPORT_ASPECT_RATIO = null;

// Keep canvas terrain for FPS, but with safer culling/debug margins.
export const WORLD_RENDER_MODE = "canvas-terrain";

// Bigger buffers to prevent trees/items being cut or popping too close to the viewport.
export const WORLD_ACTIVE_BUFFER_TILES = 18;
export const WORLD_DESPAWN_BUFFER_TILES = 28;

// All debug flags default OFF for normal play. Enable individually for tuning.
export const SHOW_WORLD_DEBUG_OVERLAY = false;
export const SHOW_VIEWPORT_CULLING_DEBUG = false;
export const SHOW_WORLD_ITEM_BOUNDS_DEBUG = false;
export const SHOW_WORLD_DECOR_BOUNDS_DEBUG = false;
export const SHOW_WORLD_COLLISION_BOUNDS_DEBUG = false;
export const SHOW_COLLISION_RECTS_ONLY = true;
export const SHOW_SPAWN_DESPAWN_BUFFER_DEBUG = false;

export const SHOW_COLLISION_DEBUG =
  SHOW_WORLD_COLLISION_BOUNDS_DEBUG || SHOW_COLLISION_RECTS_ONLY;
export const COLLISION_PROFILE_DEBUG =
  SHOW_WORLD_COLLISION_BOUNDS_DEBUG || SHOW_COLLISION_RECTS_ONLY;

export const SHOW_TERRAIN_AUTOTILE_DEBUG = false;
export const SHOW_TERRAIN_TYPE_DEBUG = false;
export const SHOW_AUTOTILE_CATEGORY_DEBUG = false;
export const SHOW_WATER_COLLISION_DEBUG = false;
export const SHOW_OBJECT_SPAWN_DEBUG = false;

export const SHOW_WORLD_DECOR_DEBUG = false;
export const SHOW_WORLD_DECOR_LABELS_DEBUG = false;
export const SHOW_WORLD_SPAWN_RADIUS_DEBUG = false;
export const SHOW_WORLD_DECOR_TWEAK_PANEL = false;
export const SHOW_WORLD_PERF_DEBUG = false;
export const DEBUG_TREE_COLLISION_SOURCE = false;

// Log chunk generation timing to the console when a chunk takes longer than
// DEBUG_CHUNK_SLOW_THRESHOLD_MS to build.  Set to false to silence.
export const DEBUG_CHUNK_PERFORMANCE = false;
export const DEBUG_CHUNK_SLOW_THRESHOLD_MS = 8;

// Max milliseconds per frame spent pre-warming (generating ahead-of-player)
// chunks.  Keep small so warm-up never causes a perceptible hitch.
export const CHUNK_GENERATION_BUDGET_MS = 2;

// ─── Render performance ───────────────────────────────────────────────────────
// Log slow render sections (terrain draw, village passes, NPC update, entity sync,
// chunk prewarm) to the console.  Set to false for normal play.
export const DEBUG_RENDER_PERFORMANCE = false;
// A section must exceed this many milliseconds before it is logged.
export const RENDER_SLOW_THRESHOLD_MS = 4;

// ─── Frame profiler ────────────────────────────────────────────────────────────
// When true, logs any frame that exceeds PERFORMANCE_SLOW_FRAME_MS, and any
// section that exceeds PERFORMANCE_SLOW_SECTION_MS.
export const DEBUG_PERFORMANCE_PROFILER = false;
export const PERFORMANCE_SLOW_FRAME_MS    = 16;
export const PERFORMANCE_SLOW_SECTION_MS  = 4;

// ─── Chunk texture cache ──────────────────────────────────────────────────────
// Reserved for a future optimization: pre-render each chunk into its own RT so
// the per-frame terrain pass only stamps one texture per chunk instead of N tiles.
// Currently unused (keeping false until the feature is implemented).
// Chunk RT baking is disabled — chunk RTs produced blank terrain (renderMode
// promotion timing unreliable). Direct tile stamping is used instead.
// Re-enable only after verifying setRenderMode('all'/'render') round-trip works.
export const CHUNK_TEXTURE_CACHE_ENABLED = false;
export const MAX_CACHED_CHUNK_TEXTURES = 48;
export const DEBUG_CHUNK_TEXTURE_CACHE = false;

// ─── Village static cache ─────────────────────────────────────────────────────
// When true, the village mid / shadow-mask / front render-texture layers are NOT
// cleared and re-stamped on every frame.  They are only re-drawn when the player
// actually moved at least one screen pixel, the season changed, or a door changed.
// Animation-tick and broken-object triggered redraws skip the village passes.
export const VILLAGE_STATIC_CACHE_ENABLED = true;
