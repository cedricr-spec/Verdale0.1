// 🌿 CLEAN DECOR GENERATOR (deterministic + layered + configurable)

export const DECOR_CONFIG = {
  rangeX: 380,
  rangeY: 280,
};

export const TREE_VISUAL_SCALE = 1.4;

const TREE_SPRITE_SIZES = [
  { width: 32, height: 47 },
  { width: 30, height: 32 },
  { width: 30, height: 32 },
  { width: 30, height: 32 },
  { width: 20, height: 23 },
  { width: 48, height: 60 },
  { width: 32, height: 47 },
  { width: 48, height: 60 },
];

const GRASS_SPRITE_SIZES = [
  { width: 16, height: 16 },
  { width: 16, height: 15 },
  { width: 16, height: 15 },
  { width: 14, height: 13 },
  { width: 24, height: 16 },
  { width: 23, height: 16 },
  { width: 29, height: 22 },
];

const ROCK_SPRITE_SIZES = [
  { width: 32, height: 31 },
  { width: 16, height: 16 },
  { width: 14, height: 16 },
];

const FLOWER_SPRITE_SIZES = [
  { width: 16, height: 16 },
  { width: 16, height: 15 },
  { width: 16, height: 16 },
  { width: 16, height: 16 },
  { width: 16, height: 16 },
  { width: 16, height: 16 },
  { width: 16, height: 16 },
];

const TYPE_SPACING = {
  tree: 80,
  rock: 60,
  flower: 25,
  grass: 15,
};

const SPATIAL_CELL_SIZE = 80;

const TREE_CONFIG = {
  cellSize: 300,
  density: 0.5,
  seed: 111,
  jitter: 0.6,
  spriteCount: 8,
};

const GRASS_CONFIG = {
  cellSize: 120,
  density: 0.8,
  seed: 222,
  jitter: 0.8,
  spriteCount: 7,
};

const ROCK_CONFIG = {
  cellSize: 260,
  density: 0.35,
  seed: 333,
  jitter: 0.5,
  spriteCount: 3,
};

const FLOWER_CONFIG = {
  cellSize: 140,
  density: 0.6,
  seed: 444,
  jitter: 0.7,
  spriteCount: 7,
};

let layoutCacheKey = null;
let layoutCacheValue = null;
const decorBaseCache = new Map();

function hash(x, y, seed = 0) {
  const h = (x * 374761393 + y * 668265263 + seed * 1442695040888963407) | 0;
  return Math.abs(Math.sin(h)) % 1;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, y, seed = 0, scale = 0.005) {
  const nx = x * scale;
  const ny = y * scale;

  const x0 = Math.floor(nx);
  const x1 = x0 + 1;
  const y0 = Math.floor(ny);
  const y1 = y0 + 1;

  const sx = smoothstep(nx - x0);
  const sy = smoothstep(ny - y0);

  const n00 = hash(x0, y0, seed);
  const n10 = hash(x1, y0, seed);
  const n01 = hash(x0, y1, seed);
  const n11 = hash(x1, y1, seed);

  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);

  return lerp(ix0, ix1, sy);
}

function createDecorItem(base, type, width, height, spriteIndex, scale, flip) {
  return {
    ...base,
    type,
    width,
    height,
    spriteIndex,
    anchorX: 0.5,
    anchorY: 1,
    scale,
    flip,
  };
}

function getSpriteSize(spriteSizes, spriteIndex) {
  return spriteSizes[spriteIndex % spriteSizes.length];
}

function getDecorBoundsKey(playerX, playerY, cellSize) {
  const { rangeX, rangeY } = DECOR_CONFIG;

  const startX = Math.floor((playerX - rangeX) / cellSize);
  const endX = Math.ceil((playerX + rangeX) / cellSize);
  const startY = Math.floor((playerY - rangeY) / cellSize);
  const endY = Math.ceil((playerY + rangeY) / cellSize);

  return { startX, endX, startY, endY };
}

function getConfigCacheKey(config, bounds) {
  return [
    config.seed,
    config.cellSize,
    config.density,
    config.jitter ?? 0.5,
    bounds.startX,
    bounds.endX,
    bounds.startY,
    bounds.endY,
  ].join("|");
}

function generateDecor(playerX, playerY, config) {
  const { cellSize, density, seed, jitter = 0.5 } = config;
  const bounds = getDecorBoundsKey(playerX, playerY, cellSize);
  const cacheKey = getConfigCacheKey(config, bounds);

  if (decorBaseCache.has(cacheKey)) {
    return decorBaseCache.get(cacheKey);
  }

  const items = [];

  for (let gx = bounds.startX; gx <= bounds.endX; gx++) {
    for (let gy = bounds.startY; gy <= bounds.endY; gy++) {
      const worldX = gx * cellSize;
      const worldY = gy * cellSize;

      const n = valueNoise(worldX, worldY, seed);
      if (n > density) continue;

      const jx = (hash(gx, gy, seed + 1) - 0.5) * cellSize * jitter;
      const jy = (hash(gx, gy, seed + 2) - 0.5) * cellSize * jitter;

      items.push({
        id: `${gx}_${gy}_${seed}`,
        x: worldX + jx,
        y: worldY + jy,
      });
    }
  }

  decorBaseCache.set(cacheKey, items);

  if (decorBaseCache.size > 24) {
    const oldestKey = decorBaseCache.keys().next().value;
    decorBaseCache.delete(oldestKey);
  }

  return items;
}

function createSpatialIndex() {
  return new Map();
}

function getSpatialKey(x, y) {
  const cellX = Math.floor(x / SPATIAL_CELL_SIZE);
  const cellY = Math.floor(y / SPATIAL_CELL_SIZE);
  return `${cellX},${cellY}`;
}

function addToSpatialIndex(index, item) {
  const key = getSpatialKey(item.x, item.y);
  const bucket = index.get(key);

  if (bucket) {
    bucket.push(item);
    return;
  }

  index.set(key, [item]);
}

function canPlaceItem(index, candidate) {
  const candidateSpacing = TYPE_SPACING[candidate.type];
  const cellX = Math.floor(candidate.x / SPATIAL_CELL_SIZE);
  const cellY = Math.floor(candidate.y / SPATIAL_CELL_SIZE);
  const searchRadius = Math.ceil(candidateSpacing / SPATIAL_CELL_SIZE) + 1;

  for (let ix = cellX - searchRadius; ix <= cellX + searchRadius; ix++) {
    for (let iy = cellY - searchRadius; iy <= cellY + searchRadius; iy++) {
      const bucket = index.get(`${ix},${iy}`);
      if (!bucket) continue;

      for (const placed of bucket) {
        const requiredDistance = Math.max(candidateSpacing, TYPE_SPACING[placed.type]);
        const dx = candidate.x - placed.x;
        const dy = candidate.y - placed.y;

        if (dx * dx + dy * dy < requiredDistance * requiredDistance) {
          return false;
        }
      }
    }
  }

  return true;
}

function buildTreeItem(base) {
  const spriteIndex = Math.floor(hash(base.x, base.y, 3) * TREE_CONFIG.spriteCount);
  const { width, height } = getSpriteSize(TREE_SPRITE_SIZES, spriteIndex);
  const scale = (0.85 + hash(base.x, base.y, 5) * 0.4) * TREE_VISUAL_SCALE;
  const flip = hash(base.x, base.y, 6) > 0.5;

  return createDecorItem(base, "tree", width, height, spriteIndex, scale, flip);
}

function buildRockItem(base) {
  const spriteIndex = Math.floor(hash(base.x, base.y, 12) * ROCK_CONFIG.spriteCount);
  const { width, height } = getSpriteSize(ROCK_SPRITE_SIZES, spriteIndex);
  const scale = 1.15 + hash(base.x, base.y, 13) * 0.7;
  const flip = hash(base.x, base.y, 14) > 0.5;

  return createDecorItem(base, "rock", width, height, spriteIndex, scale, flip);
}

function buildGrassItem(base) {
  const spriteIndex = Math.floor(hash(base.x, base.y, 9) * GRASS_CONFIG.spriteCount);
  const { width, height } = getSpriteSize(GRASS_SPRITE_SIZES, spriteIndex);
  const scale = 0.6 + hash(base.x, base.y, 10) * 0.5;
  const flip = hash(base.x, base.y, 11) > 0.5;

  return createDecorItem(base, "grass", width, height, spriteIndex, scale, flip);
}

function buildFlowerItem(base) {
  const spriteIndex = Math.floor(hash(base.x, base.y, 15) * FLOWER_CONFIG.spriteCount);
  const { width, height } = getSpriteSize(FLOWER_SPRITE_SIZES, spriteIndex);
  const scale = 0.9 + hash(base.x, base.y, 16) * 0.55;
  const flip = hash(base.x, base.y, 17) > 0.5;

  return createDecorItem(base, "flower", width, height, spriteIndex, scale, flip);
}

function placeItems(bases, buildItem, index, target) {
  for (const base of bases) {
    const item = buildItem(base);
    if (!canPlaceItem(index, item)) continue;

    target.push(item);
    addToSpatialIndex(index, item);
  }
}

function placeFlowers(bases, index, target) {
  for (const base of bases) {
    const clusterChance = hash(base.x, base.y, 500);

    if (clusterChance >= 0.3) {
      const flower = buildFlowerItem(base);
      if (!canPlaceItem(index, flower)) continue;

      target.push(flower);
      addToSpatialIndex(index, flower);
      continue;
    }

    const clusterCount = 3 + Math.floor(hash(base.x, base.y, 501) * 4);
    const clusterRadius = 20 + hash(base.x, base.y, 502) * 30;

    for (let i = 0; i < clusterCount; i++) {
      const angle = hash(base.x, base.y, 510 + i) * Math.PI * 2;
      const distance = hash(base.x, base.y, 520 + i) * clusterRadius;
      const offsetX = Math.cos(angle) * distance + (hash(base.x, base.y, 530 + i) - 0.5) * 8;
      const offsetY = Math.sin(angle) * distance + (hash(base.x, base.y, 540 + i) - 0.5) * 8;

      const flowerBase = {
        id: `${base.id}_cluster_${i}`,
        x: base.x + offsetX,
        y: base.y + offsetY,
      };

      const flower = buildFlowerItem(flowerBase);
      if (!canPlaceItem(index, flower)) continue;

      target.push(flower);
      addToSpatialIndex(index, flower);
    }
  }
}

function generateDecorLayout(playerX, playerY) {
  const treeBounds = getDecorBoundsKey(playerX, playerY, TREE_CONFIG.cellSize);
  const rockBounds = getDecorBoundsKey(playerX, playerY, ROCK_CONFIG.cellSize);
  const flowerBounds = getDecorBoundsKey(playerX, playerY, FLOWER_CONFIG.cellSize);
  const grassBounds = getDecorBoundsKey(playerX, playerY, GRASS_CONFIG.cellSize);

  const cacheKey = [
    treeBounds.startX, treeBounds.endX, treeBounds.startY, treeBounds.endY,
    rockBounds.startX, rockBounds.endX, rockBounds.startY, rockBounds.endY,
    flowerBounds.startX, flowerBounds.endX, flowerBounds.startY, flowerBounds.endY,
    grassBounds.startX, grassBounds.endX, grassBounds.startY, grassBounds.endY,
  ].join("|");

  if (layoutCacheKey === cacheKey && layoutCacheValue) {
    return layoutCacheValue;
  }

  const layout = {
    trees: [],
    rocks: [],
    flowers: [],
    grass: [],
  };

  const spatialIndex = createSpatialIndex();

  placeItems(generateDecor(playerX, playerY, TREE_CONFIG), buildTreeItem, spatialIndex, layout.trees);
  placeItems(generateDecor(playerX, playerY, ROCK_CONFIG), buildRockItem, spatialIndex, layout.rocks);
  placeFlowers(generateDecor(playerX, playerY, FLOWER_CONFIG), spatialIndex, layout.flowers);
  placeItems(generateDecor(playerX, playerY, GRASS_CONFIG), buildGrassItem, spatialIndex, layout.grass);

  layoutCacheKey = cacheKey;
  layoutCacheValue = layout;

  return layout;
}

export function getTreesAround(playerX, playerY) {
  return generateDecorLayout(playerX, playerY).trees;
}

export function getGrassAround(playerX, playerY) {
  return generateDecorLayout(playerX, playerY).grass;
}

export function getRocksAround(playerX, playerY) {
  return generateDecorLayout(playerX, playerY).rocks;
}

export function getFlowersAround(playerX, playerY) {
  return generateDecorLayout(playerX, playerY).flowers;
}
