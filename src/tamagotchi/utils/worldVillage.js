import solariaVillageMapRaw from "../../spritesheets/world/Solaria_Village_Tiling.tmj?raw";
import solariaVillageDefaultAtlasImage from "../../spritesheets/world/SolariaMegaTileset.png";
import solariaVillageWinterAtlasImage from "../../spritesheets/world/SolariaMegaTileset_Winter.png";
import { WORLD_SEASON_IDS } from "../config/worldSeasonConfig";

const TILED_FLIP_FLAG_MASK = 0x1fffffff;

export const VILLAGE_SOURCE_TILE_SIZE = 16;
export const VILLAGE_RENDER_SCALE = 2;
export const VILLAGE_WORLD_TILE_SIZE =
  VILLAGE_SOURCE_TILE_SIZE * VILLAGE_RENDER_SCALE;
export const VILLAGE_TILESET_COLUMNS = 116;
export const DEBUG_VILLAGE_COLLISION = false;
export const DEBUG_VILLAGE_DEPTH = false;
export const DEBUG_VILLAGE_DOORS = false;
export const DEBUG_VILLAGE_DECOR_OCCUPANCY = false;
export const VILLAGE_OCCUPIED_DECOR_PADDING_TILES = 1;

const VILLAGE_DEFAULT_TEXTURE_KEY = "village_default";
const VILLAGE_WINTER_TEXTURE_KEY = "village_winter";
const VILLAGE_GID_FRAME_STRIDE = 1;

const VILLAGE_BLOCKING_LAYER_NAMES = new Set([
  "fondations",
  "buildings",
  "objects",
  "market buildings",
  "market objects",
  "market objects #2",
]);
const VILLAGE_COLLISION_OBJECT_LAYER_NAME = "collision";
const VILLAGE_DEPTH_OBJECT_LAYER_NAME = "depth layer";
const VILLAGE_DOOR_OBJECT_LAYER_NAME = "doors";
const VILLAGE_MERCHANT_SPAWN_OBJECT_LAYER_NAMES = new Set([
  "merchant_spawns",
  "merchants_spawns",
]);
const VILLAGE_SHADOW_MASK_LAYER_NAME_PATTERN = /shadow mask/i;
const VILLAGE_FOREGROUND_LAYER_NAME_PATTERN = /(?:^|[\s_])over(?:[\s_]|$)/i;
const VILLAGE_MARKET_LAYER_NAME_PATTERN = /^market\b/i;
const VILLAGE_MARKET_GROUND_LAYER_NAME_PATTERN = /^market\b.*ground\b/i;
const VILLAGE_SHADOW_MASK_FOREGROUND_OVERRIDE_LAYER_NAMES = new Set([
  "bushes",
  "decors",
  "benchs",
  "fence",
  "fences",
  "door_tiles",
  "doors_tiles",
  "objects",
  "market fences",
  "market objects",
  "market objects #2",
]);
export const VILLAGE_DEPTH_AWARE_LAYER_NAMES = Object.freeze([
  "bushes",
  "objects",
  "decors",
  "benchs",
  "fence",
  "fences",
  "market fences",
  "market objects",
  "market objects #2",
]);
export const VILLAGE_DEPTH_EXCLUDED_LAYER_NAMES = Object.freeze([
  "ground",
  "roads",
  "variations road",
  "stairs",
  "market ground",
  "market variations ground",
  "fondations",
  "fondations shadow mask",
  "buildings",
  "market buildings",
  "over",
  "market over",
  "fence over",
  "fences over",
  "market fence over",
  "market fences over",
  "collision",
  "depth layer",
  "doors",
  "door_tiles",
  "doors_tiles",
]);
const VILLAGE_DEPTH_EXCLUDED_LAYER_NAME_SET = new Set(
  VILLAGE_DEPTH_EXCLUDED_LAYER_NAMES
);
const VILLAGE_DEPTH_AWARE_LAYER_NAME_SET = new Set(
  VILLAGE_DEPTH_AWARE_LAYER_NAMES.filter(
    (layerName) => !VILLAGE_DEPTH_EXCLUDED_LAYER_NAME_SET.has(layerName)
  )
);
const VILLAGE_COLLISION_WORLD_SCALE =
  VILLAGE_WORLD_TILE_SIZE / VILLAGE_SOURCE_TILE_SIZE;
const VILLAGE_DOOR_VISUAL_LAYER_NAMES = Object.freeze([
  "door_tiles",
  "doors_tiles",
  "doors",
]);
const VILLAGE_DOOR_VISUAL_LAYER_NAME_SET = new Set(
  VILLAGE_DOOR_VISUAL_LAYER_NAMES
);

const villageDoorTileOverrides = new Map();
// Monotonically increasing counter — bumped whenever a door tile override changes.
// Consumers can compare against a saved value to detect door-state changes cheaply.
let _villageDoorStateVersion = 0;
export function getVillageDoorStateVersion() { return _villageDoorStateVersion; }
let lastVillageDepthMovedTileLog = "";
let lastVillageDepthMovedTileSampleLog = "";

function normalizeGid(gid = 0) {
  const numericGid = Number(gid) || 0;
  return numericGid & TILED_FLIP_FLAG_MASK;
}

function createTileKey(x, y) {
  return `${x},${y}`;
}

function parseEmbeddedTiledProperty(text) {
  if (typeof text !== "string") {
    return null;
  }

  const match = text.match(
    /Name:\s*([^\n]+)\nType:\s*[^\n]*\nValue:\s*([\s\S]*)/
  );
  if (!match) {
    return null;
  }

  return {
    name: match[1].trim(),
    value: match[2].trim(),
  };
}

function getObjectCustomProperties(object) {
  const properties = {};

  (object?.properties || []).forEach((property) => {
    if (property && typeof property.name === "string" && !property.name.startsWith("Name:")) {
      properties[property.name] = property.value;
    }

    const decodedNameProperty = parseEmbeddedTiledProperty(property?.name);
    if (decodedNameProperty) {
      properties[decodedNameProperty.name] = decodedNameProperty.value;
    }

    const decodedValueProperty = parseEmbeddedTiledProperty(property?.value);
    if (decodedValueProperty) {
      properties[decodedValueProperty.name] = decodedValueProperty.value;
    }
  });

  return properties;
}

function getNumericPropertyValue(value, fallback = null) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function flattenTiledLayers(layers, flatLayers = [], parentPath = "") {
  if (!Array.isArray(layers)) {
    return flatLayers;
  }

  layers.forEach((layer) => {
    if (!layer) {
      return;
    }

    const layerName = layer.name || layer.type || "layer";
    const layerPath = parentPath ? `${parentPath}/${layerName}` : layerName;

    if (layer.type === "group") {
      flattenTiledLayers(layer.layers, flatLayers, layerPath);
      return;
    }

    flatLayers.push({
      ...layer,
      __groupPath: parentPath,
      __layerPath: layerPath,
    });
  });

  return flatLayers;
}

function buildLayerRuntime(layer, mapWidth, mapHeight, firstgid, columns) {
  const width = Number(layer?.width) || mapWidth;
  const height = Number(layer?.height) || mapHeight;
  const tiles = [];
  const tilesByCoord = new Map();
  const data = Array.isArray(layer?.data) ? layer.data : [];

  data.forEach((rawGid, index) => {
    const gid = normalizeGid(rawGid);
    if (!gid || gid < firstgid) {
      return;
    }

    const localId = gid - firstgid;
    const x = index % width;
    const y = Math.floor(index / width);
    const tile = Object.freeze({
      x,
      y,
      gid,
      localId,
      sx: (localId % columns) * VILLAGE_SOURCE_TILE_SIZE,
      sy: Math.floor(localId / columns) * VILLAGE_SOURCE_TILE_SIZE,
      sw: VILLAGE_SOURCE_TILE_SIZE,
      sh: VILLAGE_SOURCE_TILE_SIZE,
    });

    tiles.push(tile);
    tilesByCoord.set(createTileKey(x, y), tile);
  });

  return Object.freeze({
    id: layer?.id ?? null,
    name: layer?.name || "layer",
    groupPath: layer?.__groupPath || "",
    layerPath: layer?.__layerPath || layer?.name || "layer",
    orderIndex: Number.isFinite(Number(layer?.__orderIndex))
      ? Number(layer.__orderIndex)
      : -1,
    width,
    height,
    visible: layer?.visible !== false,
    tiles: Object.freeze(tiles),
    tilesByCoord,
  });
}

function createVillageLayerRef(layer) {
  return Object.freeze({
    id: layer?.id ?? null,
    name: layer?.name || "layer",
    groupPath: layer?.groupPath || layer?.__groupPath || "",
    layerPath: layer?.layerPath || layer?.__layerPath || layer?.name || "layer",
    orderIndex: Number.isFinite(Number(layer?.orderIndex))
      ? Number(layer.orderIndex)
      : Number.isFinite(Number(layer?.__orderIndex))
        ? Number(layer.__orderIndex)
      : -1,
  });
}

function getVillageLayerRefKey(layerRef) {
  if (!layerRef) {
    return "";
  }

  if (layerRef.id !== null && layerRef.id !== undefined) {
    return `id:${layerRef.id}`;
  }

  return `path:${layerRef.layerPath || layerRef.name || ""}`;
}

function buildVillageMerchantRenderBand(flatLayers, depthMarkerIndex) {
  const marketTileLayers = (flatLayers || [])
    .filter(
      (layer) =>
        layer?.type === "tilelayer" &&
        layer?.visible !== false &&
        VILLAGE_MARKET_LAYER_NAME_PATTERN.test(String(layer?.name || ""))
    )
    .sort(
      (left, right) =>
        (Number(left?.__orderIndex) || 0) - (Number(right?.__orderIndex) || 0)
    );

  if (!marketTileLayers.length) {
    return null;
  }

  const lowerLayer = [...marketTileLayers]
    .reverse()
    .find((layer) =>
      VILLAGE_MARKET_GROUND_LAYER_NAME_PATTERN.test(String(layer?.name || ""))
    );
  if (!lowerLayer) {
    return null;
  }

  const lowerOrderIndex = Number(lowerLayer.__orderIndex);
  const upperLayers = marketTileLayers.filter((layer) => {
    const orderIndex = Number(layer?.__orderIndex);
    return (
      Number.isFinite(orderIndex) &&
      orderIndex > lowerOrderIndex &&
      !VILLAGE_FOREGROUND_LAYER_NAME_PATTERN.test(String(layer?.name || ""))
    );
  });

  if (!upperLayers.length) {
    return null;
  }

  const foregroundLayers = marketTileLayers.filter((layer) => {
    const orderIndex = Number(layer?.__orderIndex);
    return (
      Number.isFinite(orderIndex) &&
      orderIndex > lowerOrderIndex &&
      VILLAGE_FOREGROUND_LAYER_NAME_PATTERN.test(String(layer?.name || ""))
    );
  });

  return Object.freeze({
    lowerLayer: createVillageLayerRef(lowerLayer),
    lowerPass: resolveVillageRenderPassForLayer(lowerLayer, depthMarkerIndex) || "back",
    upperLayers: Object.freeze(upperLayers.map((layer) => createVillageLayerRef(layer))),
    upperPass: "mid",
    foregroundLayers: Object.freeze(
      foregroundLayers.map((layer) => createVillageLayerRef(layer))
    ),
  });
}

function resolveVillageRenderPassForLayer(layer, depthMarkerIndex) {
  const layerName = layer?.name;
  if (typeof layerName !== "string" || layer?.visible === false) {
    return null;
  }

  if (VILLAGE_SHADOW_MASK_LAYER_NAME_PATTERN.test(layerName)) {
    return "shadowmask";
  }

  if (VILLAGE_FOREGROUND_LAYER_NAME_PATTERN.test(layerName)) {
    return "front";
  }

  if (VILLAGE_SHADOW_MASK_FOREGROUND_OVERRIDE_LAYER_NAMES.has(layerName)) {
    return "mid";
  }

  if (
    depthMarkerIndex >= 0 &&
    Number.isFinite(Number(layer?.__orderIndex)) &&
    Number(layer.__orderIndex) > depthMarkerIndex
  ) {
    return "front";
  }

  return "back";
}

function buildOrderedVillageRenderPasses(flatLayers) {
  const orderedTileLayers = Array.isArray(flatLayers)
    ? flatLayers.filter((layer) => layer?.type === "tilelayer")
    : [];
  const depthMarkerIndex = Array.isArray(flatLayers)
    ? flatLayers.findIndex(
        (layer) =>
          layer?.type === "objectgroup" &&
          layer?.name === VILLAGE_DEPTH_OBJECT_LAYER_NAME
      )
    : -1;

  const backLayers = [];
  const frontLayers = [];
  const midLayers = [];
  const shadowMaskLayers = [];
  const merchantRenderBand = buildVillageMerchantRenderBand(
    flatLayers,
    depthMarkerIndex
  );
  const merchantUpperLayerRefKeys = new Set(
    (merchantRenderBand?.upperLayers || []).map((layerRef) =>
      getVillageLayerRefKey(layerRef)
    )
  );

  orderedTileLayers.forEach((layer) => {
    const layerRef = createVillageLayerRef(layer);
    if (merchantUpperLayerRefKeys.has(getVillageLayerRefKey(layerRef))) {
      midLayers.push(layerRef);
      return;
    }

    const pass = resolveVillageRenderPassForLayer(layer, depthMarkerIndex);
    if (!pass || !layerRef) {
      return;
    }

    if (pass === "front") {
      frontLayers.push(layerRef);
      return;
    }

    if (pass === "shadowmask") {
      shadowMaskLayers.push(layerRef);
      return;
    }

    if (pass === "mid") {
      midLayers.push(layerRef);
      return;
    }

    backLayers.push(layerRef);
  });

  return Object.freeze({
    backLayers: Object.freeze(backLayers),
    midLayers: Object.freeze(midLayers),
    shadowMaskLayers: Object.freeze(shadowMaskLayers),
    frontLayers: Object.freeze(frontLayers),
    merchantRenderBand,
  });
}

function getVillageLayerOrderIndex(layerRef) {
  if (!layerRef) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number.isFinite(Number(layerRef.orderIndex))
    ? Number(layerRef.orderIndex)
    : Number.MAX_SAFE_INTEGER;
}

function sortVillageLayerRefsByMapOrder(layerRefs) {
  const uniqueRefs = Array.from(
    new Map(
      (layerRefs || [])
        .filter(Boolean)
        .map((layerRef) => [layerRef.id ?? layerRef.layerPath, layerRef])
    ).values()
  );

  return uniqueRefs.sort((left, right) => {
    const leftIndex = getVillageLayerOrderIndex(left);
    const rightIndex = getVillageLayerOrderIndex(right);
    if (leftIndex === rightIndex) {
      return String(left?.layerPath || left?.name || "").localeCompare(
        String(right?.layerPath || right?.name || "")
      );
    }
    return leftIndex - rightIndex;
  });
}

function buildTileRuntimeFromGid(gid, firstgid, columns, x, y) {
  const normalizedGid = normalizeGid(gid);
  if (!normalizedGid || normalizedGid < firstgid) {
    return null;
  }

  const localId = normalizedGid - firstgid;
  return Object.freeze({
    x,
    y,
    gid: normalizedGid,
    localId,
    sx: (localId % columns) * VILLAGE_SOURCE_TILE_SIZE,
    sy: Math.floor(localId / columns) * VILLAGE_SOURCE_TILE_SIZE,
    sw: VILLAGE_SOURCE_TILE_SIZE,
    sh: VILLAGE_SOURCE_TILE_SIZE,
  });
}

function buildCollisionObjectBounds(object) {
  if (!object) {
    return null;
  }

  const x = Number(object.x);
  const y = Number(object.y);
  const width = Number(object.width);
  const height = Number(object.height);

  if (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  ) {
    return Object.freeze({
      id: object.id ?? null,
      name: object.name || "",
      left: x,
      top: y,
      right: x + width,
      bottom: y + height,
      width,
      height,
    });
  }

  const points = Array.isArray(object.polygon)
    ? object.polygon
    : Array.isArray(object.polyline)
      ? object.polyline
      : null;
  if (!points?.length || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const xs = points.map((point) => x + (Number(point.x) || 0));
  const ys = points.map((point) => y + (Number(point.y) || 0));

  return Object.freeze({
    id: object.id ?? null,
    name: object.name || "",
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  });
}

function buildCollisionObjectRuntime(layer) {
  if (
    layer?.type !== "objectgroup" ||
    layer?.name !== VILLAGE_COLLISION_OBJECT_LAYER_NAME
  ) {
    return [];
  }

  return (layer.objects || [])
    .map((object) => buildCollisionObjectBounds(object))
    .filter(Boolean);
}

function buildDepthObjectRuntime(layer) {
  if (
    layer?.type !== "objectgroup" ||
    layer?.name !== VILLAGE_DEPTH_OBJECT_LAYER_NAME
  ) {
    return [];
  }

  return (layer.objects || [])
    .map((object) => buildCollisionObjectBounds(object))
    .filter(Boolean);
}

function getVillageDoorVisualLayerNameFromLayers(layersByName) {
  return (
    VILLAGE_DOOR_VISUAL_LAYER_NAMES.find((layerName) => Boolean(layersByName[layerName])) ||
    null
  );
}

function inferDoorTileCoords(object, properties, visualLayer) {
  const explicitTileX = getNumericPropertyValue(properties?.tileX);
  const explicitTileY = getNumericPropertyValue(properties?.tileY);

  if (Number.isFinite(explicitTileX) && Number.isFinite(explicitTileY)) {
    return {
      tileX: explicitTileX,
      tileY: explicitTileY,
    };
  }

  const x = Number(object?.x) || 0;
  const y = Number(object?.y) || 0;
  const width = Math.max(0, Number(object?.width) || 0);
  const height = Math.max(0, Number(object?.height) || 0);

  const candidateCoords = [
    { tileX: Math.floor(x / VILLAGE_SOURCE_TILE_SIZE), tileY: Math.floor(y / VILLAGE_SOURCE_TILE_SIZE) },
    {
      tileX: Math.floor((x + width * 0.5) / VILLAGE_SOURCE_TILE_SIZE),
      tileY: Math.floor(y / VILLAGE_SOURCE_TILE_SIZE),
    },
    {
      tileX: Math.floor((x + width * 0.5) / VILLAGE_SOURCE_TILE_SIZE),
      tileY: Math.floor((y + height * 0.5) / VILLAGE_SOURCE_TILE_SIZE),
    },
    {
      tileX: Math.floor((x + width * 0.5) / VILLAGE_SOURCE_TILE_SIZE),
      tileY: Math.floor(Math.max(0, y + height - 1) / VILLAGE_SOURCE_TILE_SIZE),
    },
  ];

  const matchingTileCoord = candidateCoords.find(({ tileX, tileY }) =>
    Boolean(visualLayer?.tilesByCoord.get(createTileKey(tileX, tileY)))
  );

  return matchingTileCoord || candidateCoords[0];
}

function buildDoorObjectRuntime(layer, layersByName, firstgid, columns) {
  if (
    layer?.type !== "objectgroup" ||
    layer?.name !== VILLAGE_DOOR_OBJECT_LAYER_NAME
  ) {
    return [];
  }

  const visualLayerName = getVillageDoorVisualLayerNameFromLayers(layersByName);
  const visualLayer = visualLayerName ? layersByName[visualLayerName] : null;

  return (layer.objects || [])
    .map((object) => {
      const properties = getObjectCustomProperties(object);
      const explicitType = String(properties.type || object?.type || "").toLowerCase();
      const inferredType = String(
        explicitType || object?.name || ""
      ).toLowerCase();
      if (explicitType ? explicitType !== "door" : !inferredType.includes("door")) {
        return null;
      }

      const bounds = buildCollisionObjectBounds(object);
      if (!bounds) {
        return null;
      }

      const { tileX, tileY } = inferDoorTileCoords(object, properties, visualLayer);
      const visualTile =
        visualLayer?.tilesByCoord.get(createTileKey(tileX, tileY)) || null;
      const closedGid = normalizeGid(visualTile?.gid || 0);

      return Object.freeze({
        id: String(properties.doorId || object?.name || `door_${object?.id || tileX}_${tileY}`),
        objectId: object?.id ?? null,
        bounds,
        tileX,
        tileY,
        visualLayerName,
        closedGid,
        frameGids: closedGid
          ? [0, 1, 2, 3].map((offset) => closedGid + offset * VILLAGE_GID_FRAME_STRIDE)
          : [],
      });
    })
    .filter(Boolean);
}

function buildMerchantSpawnRuntime(layer) {
  if (
    layer?.type !== "objectgroup" ||
    !VILLAGE_MERCHANT_SPAWN_OBJECT_LAYER_NAMES.has(layer?.name)
  ) {
    return [];
  }

  return (layer.objects || [])
    .map((object) => {
      const properties = getObjectCustomProperties(object);
      const explicitType = String(properties.type || object?.type || "").toLowerCase();
      if (explicitType && explicitType !== "merchant") {
        return null;
      }

      const bounds = buildCollisionObjectBounds(object);
      if (!bounds) {
        return null;
      }

      const merchantId = String(
        properties.merchantId || object?.name || `merchant_${object?.id || "spawn"}`
      );

      return Object.freeze({
        id: merchantId,
        objectId: object?.id ?? null,
        merchantId,
        shopId: properties.shopId ? String(properties.shopId) : null,
        facing: properties.facing ? String(properties.facing).toLowerCase() : null,
        merchantRenderBand: layer?.__merchantRenderBand || null,
        bounds,
        x: bounds.left + bounds.width * 0.5,
        y: bounds.top + bounds.height * 0.5,
      });
    })
    .filter(Boolean);
}

function buildVillageMapRuntime(rawMap) {
  const width = Number(rawMap?.width) || 0;
  const height = Number(rawMap?.height) || 0;
  const firstgid = Number(rawMap?.tilesets?.[0]?.firstgid) || 1;
  const flatLayers = flattenTiledLayers(rawMap?.layers).map((layer, index) => ({
    ...layer,
    __orderIndex: index,
  }));
  const layers = flatLayers.length
    ? flatLayers
        .filter((layer) => layer?.type === "tilelayer")
        .map((layer) =>
          buildLayerRuntime(layer, width, height, firstgid, VILLAGE_TILESET_COLUMNS)
        )
    : [];
  const collisionRects = flatLayers.length
    ? flatLayers.flatMap((layer) => buildCollisionObjectRuntime(layer))
    : [];
  const depthRects = flatLayers.length
    ? flatLayers.flatMap((layer) => buildDepthObjectRuntime(layer))
    : [];
  const layersByName = Object.fromEntries(layers.map((layer) => [layer.name, layer]));
  const layersById = Object.fromEntries(
    layers
      .filter((layer) => layer?.id !== null && layer?.id !== undefined)
      .map((layer) => [String(layer.id), layer])
  );
  const orderedRenderPasses = buildOrderedVillageRenderPasses(flatLayers);
  const doorObjects = flatLayers.length
    ? flatLayers.flatMap((layer) =>
        buildDoorObjectRuntime(
          layer,
          layersByName,
          firstgid,
          VILLAGE_TILESET_COLUMNS
        )
      )
    : [];
  const merchantSpawns = flatLayers.length
    ? flatLayers.flatMap((layer) =>
        buildMerchantSpawnRuntime({
          ...layer,
          __merchantRenderBand: orderedRenderPasses.merchantRenderBand || null,
        })
      )
    : [];
  const doorVisualLayerName = getVillageDoorVisualLayerNameFromLayers(layersByName);
  const tileLayerOrderIndexByName = Object.fromEntries(
    layers.map((layer) => [layer.name, layer.orderIndex])
  );
  const blockingTiles = new Set();

  layers.forEach((layer) => {
    if (VILLAGE_BLOCKING_LAYER_NAMES.has(layer.name)) {
      layer.tiles.forEach((tile) => {
        blockingTiles.add(createTileKey(tile.x, tile.y));
      });
    }
  });

  return Object.freeze({
    id: "solaria_village",
    width,
    height,
    tileWidth: VILLAGE_SOURCE_TILE_SIZE,
    tileHeight: VILLAGE_SOURCE_TILE_SIZE,
    worldTileSize: VILLAGE_WORLD_TILE_SIZE,
    firstgid,
    columns: VILLAGE_TILESET_COLUMNS,
    layers: Object.freeze(layers),
    layersByName,
    layersById,
    blockingTiles,
    collisionRects: Object.freeze(collisionRects),
    depthRects: Object.freeze(depthRects),
    doorObjects: Object.freeze(doorObjects),
    merchantSpawns: Object.freeze(merchantSpawns),
    doorVisualLayerName,
    hasCollisionObjectLayer: collisionRects.length > 0,
    hasDepthObjectLayer: depthRects.length > 0,
    tileLayerOrderIndexByName,
    depthAwareLayerNames: Object.freeze(
      layers
        .map((layer) => layer.name)
        .filter((layerName) => VILLAGE_DEPTH_AWARE_LAYER_NAME_SET.has(layerName))
    ),
    depthExcludedLayerNames: Object.freeze(
      layers
        .map((layer) => layer.name)
        .filter((layerName) => VILLAGE_DEPTH_EXCLUDED_LAYER_NAME_SET.has(layerName))
    ),
    backLayers: orderedRenderPasses.backLayers,
    shadowMaskLayers: orderedRenderPasses.shadowMaskLayers,
    midLayers: orderedRenderPasses.midLayers,
    frontLayers: orderedRenderPasses.frontLayers,
    merchantRenderBand: orderedRenderPasses.merchantRenderBand || null,
  });
}

function createWorldCollisionRect(instance, rect) {
  if (!instance || !rect) {
    return null;
  }

  const worldOriginX = instance.worldX * VILLAGE_WORLD_TILE_SIZE;
  const worldOriginY = instance.worldY * VILLAGE_WORLD_TILE_SIZE;
  const left = worldOriginX + rect.left * VILLAGE_COLLISION_WORLD_SCALE;
  const top = worldOriginY + rect.top * VILLAGE_COLLISION_WORLD_SCALE;
  const width = rect.width * VILLAGE_COLLISION_WORLD_SCALE;
  const height = rect.height * VILLAGE_COLLISION_WORLD_SCALE;

  return Object.freeze({
    id: rect.id ?? null,
    name: rect.name || "",
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  });
}

function createWorldDoorRuntime(instance, door) {
  if (!instance || !door) {
    return null;
  }

  const worldBounds = createWorldCollisionRect(instance, door.bounds);
  if (!worldBounds) {
    return null;
  }

  const worldTileX = instance.worldX + door.tileX;
  const worldTileY = instance.worldY + door.tileY;

  return Object.freeze({
    ...door,
    worldTileX,
    worldTileY,
    bounds: worldBounds,
    worldX: worldTileX * VILLAGE_WORLD_TILE_SIZE,
    worldY: worldTileY * VILLAGE_WORLD_TILE_SIZE,
  });
}

function createWorldMerchantSpawnRuntime(instance, spawn) {
  if (!instance || !spawn) {
    return null;
  }

  const worldBounds = createWorldCollisionRect(instance, spawn.bounds);
  if (!worldBounds) {
    return null;
  }

  return Object.freeze({
    ...spawn,
    bounds: worldBounds,
    x: worldBounds.left + worldBounds.width * 0.5,
    y: worldBounds.top + worldBounds.height * 0.5,
  });
}

function boundsIntersect(a, b) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  );
}

function pointInsideBounds(x, y, bounds) {
  return (
    x >= bounds.left &&
    x < bounds.right &&
    y >= bounds.top &&
    y < bounds.bottom
  );
}

function getVillageLayerRefsForPass(map, pass = "back") {
  if (pass === "front") {
    return map.frontLayers || [];
  }
  if (pass === "shadowmask") {
    return map.shadowMaskLayers || [];
  }
  if (pass === "mid") {
    return map.midLayers || [];
  }
  return map.backLayers || [];
}

function getVillageLayerByRef(map, layerRef) {
  if (!map || !layerRef) {
    return null;
  }

  if (layerRef.id !== null && layerRef.id !== undefined) {
    const layerById = map.layersById?.[String(layerRef.id)];
    if (layerById) {
      return layerById;
    }
  }

  return map.layersByName?.[layerRef.name] || null;
}

function getWorldTileRangeForBounds(bounds) {
  if (!bounds) {
    return null;
  }

  return {
    startX: Math.floor(bounds.left / VILLAGE_WORLD_TILE_SIZE),
    endX: Math.floor((bounds.right - 1) / VILLAGE_WORLD_TILE_SIZE),
    startY: Math.floor(bounds.top / VILLAGE_WORLD_TILE_SIZE),
    endY: Math.floor((bounds.bottom - 1) / VILLAGE_WORLD_TILE_SIZE),
  };
}

function getVillageTileAtWorldTile(instance, layerName, worldTileX, worldTileY) {
  if (!instance?.map) {
    return null;
  }

  const localTileX = worldTileX - instance.worldX;
  const localTileY = worldTileY - instance.worldY;

  if (
    localTileX < 0 ||
    localTileY < 0 ||
    localTileX >= instance.map.width ||
    localTileY >= instance.map.height
  ) {
    return null;
  }

  const layer = instance.map.layersByName[layerName];
  if (!layer) {
    return null;
  }

  return layer.tilesByCoord.get(createTileKey(localTileX, localTileY)) || null;
}

function addTileWithPadding(targetSet, worldTileX, worldTileY, paddingTiles = 0) {
  const padding = Math.max(0, Number(paddingTiles) || 0);
  for (let offsetX = -padding; offsetX <= padding; offsetX += 1) {
    for (let offsetY = -padding; offsetY <= padding; offsetY += 1) {
      targetSet.add(createTileKey(worldTileX + offsetX, worldTileY + offsetY));
    }
  }
}

function addWorldTileRangeWithPadding(
  targetSet,
  range,
  paddingTiles = 0,
  rawSet = null
) {
  if (!range) {
    return;
  }

  for (let worldTileX = range.startX; worldTileX <= range.endX; worldTileX += 1) {
    for (let worldTileY = range.startY; worldTileY <= range.endY; worldTileY += 1) {
      rawSet?.add(createTileKey(worldTileX, worldTileY));
      addTileWithPadding(targetSet, worldTileX, worldTileY, paddingTiles);
    }
  }
}

function buildVillageDecorOccupancyRuntime({
  map,
  worldX,
  worldY,
  collisionRects,
  merchantSpawns,
}) {
  const occupiedRawTileKeys = new Set();
  const excludedTileKeys = new Set();
  const collisionRawTileKeys = new Set();
  const merchantRawTileKeys = new Set();
  const occupancyLayerNames = [];
  const paddingTiles = VILLAGE_OCCUPIED_DECOR_PADDING_TILES;

  map.layers.forEach((layer) => {
    if (!layer?.visible || VILLAGE_DOOR_VISUAL_LAYER_NAME_SET.has(layer.name)) {
      return;
    }

    occupancyLayerNames.push(layer.name);
    layer.tiles.forEach((tile) => {
      const worldTileX = worldX + tile.x;
      const worldTileY = worldY + tile.y;
      const key = createTileKey(worldTileX, worldTileY);
      occupiedRawTileKeys.add(key);
      addTileWithPadding(excludedTileKeys, worldTileX, worldTileY, paddingTiles);
    });
  });

  (collisionRects || []).forEach((rect) => {
    addWorldTileRangeWithPadding(
      excludedTileKeys,
      getWorldTileRangeForBounds(rect),
      paddingTiles,
      collisionRawTileKeys
    );
  });

  (merchantSpawns || []).forEach((spawn) => {
    addWorldTileRangeWithPadding(
      excludedTileKeys,
      getWorldTileRangeForBounds(spawn.bounds),
      paddingTiles,
      merchantRawTileKeys
    );
  });

  const totalVillageTileCount = Math.max(0, (map?.width || 0) * (map?.height || 0));
  const rawOccupiedTileUnion = new Set([
    ...occupiedRawTileKeys,
    ...collisionRawTileKeys,
    ...merchantRawTileKeys,
  ]);

  return Object.freeze({
    paddingTiles,
    occupancyLayerNames: Object.freeze(occupancyLayerNames),
    occupiedRawTileKeys,
    excludedTileKeys,
    collisionRawTileKeys,
    merchantRawTileKeys,
    rawOccupiedTileCount: rawOccupiedTileUnion.size,
    visibleTileOccupiedCount: occupiedRawTileKeys.size,
    emptyTileCountInsideBounds: Math.max(0, totalVillageTileCount - rawOccupiedTileUnion.size),
    excludedTileCount: excludedTileKeys.size,
  });
}

function createVillageInstance(id, map, worldX, worldY) {
  const collisionRects = Object.freeze(
    (map?.collisionRects || [])
      .map((rect) => createWorldCollisionRect({ map, worldX, worldY }, rect))
      .filter(Boolean)
  );
  const depthRects = Object.freeze(
    (map?.depthRects || [])
      .map((rect) => createWorldCollisionRect({ map, worldX, worldY }, rect))
      .filter(Boolean)
  );
  const doorObjects = Object.freeze(
    (map?.doorObjects || [])
      .map((door) => createWorldDoorRuntime({ map, worldX, worldY }, door))
      .filter(Boolean)
  );
  const merchantSpawns = Object.freeze(
    (map?.merchantSpawns || [])
      .map((spawn) => createWorldMerchantSpawnRuntime({ map, worldX, worldY }, spawn))
      .filter(Boolean)
  );
  const decorOccupancy = buildVillageDecorOccupancyRuntime({
    map,
    worldX,
    worldY,
    collisionRects,
    merchantSpawns,
  });

  return Object.freeze({
    id,
    map,
    worldX,
    worldY,
    collisionRects,
    depthRects,
    doorObjects,
    merchantSpawns,
    decorOccupancy,
    usesCollisionLayer: Boolean(map?.hasCollisionObjectLayer && collisionRects.length),
    usesDepthLayer: Boolean(map?.hasDepthObjectLayer && depthRects.length),
  });
}

const rawSolariaVillageMap = JSON.parse(solariaVillageMapRaw);
const flatSolariaVillageLayers = flattenTiledLayers(rawSolariaVillageMap?.layers);
const parsedVillageMap = buildVillageMapRuntime(rawSolariaVillageMap);
const solariaVillageDiscoveredTileLayers = parsedVillageMap.layers.map((layer) => ({
  name: layer.name,
  tileCount: layer.tiles.length,
}));
const solariaVillageFenceLayers = solariaVillageDiscoveredTileLayers.filter((layer) =>
  /fence/i.test(layer.name)
);
const solariaVillageDepthLayerEntries = flatSolariaVillageLayers
  .filter(
    (layer) =>
      layer?.type === "objectgroup" &&
      layer?.name === VILLAGE_DEPTH_OBJECT_LAYER_NAME
  )
  .map((layer) => ({
    layerName: layer.name,
    groupPath: layer.__groupPath || "",
    layerPath: layer.__layerPath || layer.name,
    objectCount: Array.isArray(layer.objects) ? layer.objects.length : 0,
  }));
const solariaVillageOverLayerTileCount =
  parsedVillageMap.layersByName.over?.tiles.length ?? 0;
const solariaVillageDoorCount = parsedVillageMap.doorObjects?.length ?? 0;
const solariaVillageMerchantSpawnCount =
  parsedVillageMap.merchantSpawns?.length ?? 0;
const solariaVillageDepthRectCount =
  parsedVillageMap.depthRects?.length ?? 0;
const solariaVillageDoorObjectLayerFound = flatSolariaVillageLayers.some(
    (layer) => layer?.type === "objectgroup" && layer?.name === VILLAGE_DOOR_OBJECT_LAYER_NAME
  );
const solariaVillageDoorTileLayerFound = Boolean(parsedVillageMap.doorVisualLayerName);

console.info(
  "[Solaria Village] over layer tiles:",
  solariaVillageOverLayerTileCount
);
if (solariaVillageOverLayerTileCount === 0) {
  console.warn(
    '[Solaria Village] "over" layer has 0 tiles; layer name may not match.'
  );
}
console.info("[Village Doors] loaded:", solariaVillageDoorCount);
console.info("[Village Merchants] spawns loaded:", solariaVillageMerchantSpawnCount);
console.info("[Village Doors] door object layer found:", solariaVillageDoorObjectLayerFound);
console.info("[Village Doors] door tile layer found:", solariaVillageDoorTileLayerFound);
console.info(
  "[Solaria Village] tile layers discovered:",
  solariaVillageDiscoveredTileLayers
);
console.info(
  "[Solaria Village] fence layers discovered:",
  solariaVillageFenceLayers
);
console.info(
  "[Solaria Village] depth layers found:",
  solariaVillageDepthLayerEntries
);
console.info(
  "[Solaria Village] depth rect count:",
  solariaVillageDepthRectCount
);
console.info(
  "[Solaria Village] depth-aware layers:",
  parsedVillageMap.depthAwareLayerNames
);
console.info(
  "[Solaria Village] depth-excluded layers:",
  parsedVillageMap.depthExcludedLayerNames
);

export const SOLARIA_VILLAGE_MAP = parsedVillageMap;

export const WORLD_VILLAGE_INSTANCES = Object.freeze([
  createVillageInstance(
    "solaria_village_origin",
    SOLARIA_VILLAGE_MAP,
    -Math.floor(SOLARIA_VILLAGE_MAP.width * 0.5),
    -Math.floor(SOLARIA_VILLAGE_MAP.height * 0.5)
  ),
]);

WORLD_VILLAGE_INSTANCES.forEach((instance) => {
  instance.doorObjects.forEach((door) => {
    console.info("[Village Doors] door:", {
      doorId: door.id,
      worldBounds: door.bounds,
      tileX: door.worldTileX,
      tileY: door.worldTileY,
      closedGid: door.closedGid,
    });

    if (!Number.isFinite(door.worldTileX) || !Number.isFinite(door.worldTileY)) {
      console.warn(`[Village Doors] door "${door.id}" is missing tileX/tileY.`);
    }

    if (!door.closedGid) {
      console.warn(`[Village Doors] door "${door.id}" has closedGid=0; door tile layer or inferred tile may be wrong.`);
    }
  });

  instance.merchantSpawns?.forEach((spawn) => {
    console.info("[Village Merchants] spawn:", {
      merchantId: spawn.merchantId,
      shopId: spawn.shopId,
      facing: spawn.facing,
      x: spawn.x,
      y: spawn.y,
    });
  });

  if (DEBUG_VILLAGE_DECOR_OCCUPANCY) {
    console.info("[Solaria Village] decor occupancy:", {
      instanceId: instance.id,
      occupiedVillageCells: instance.decorOccupancy.rawOccupiedTileCount,
      visibleTileOccupiedCells: instance.decorOccupancy.visibleTileOccupiedCount,
      emptyVillageCells: instance.decorOccupancy.emptyTileCountInsideBounds,
      excludedTilesWithPadding: instance.decorOccupancy.excludedTileCount,
      paddingTiles: instance.decorOccupancy.paddingTiles,
      occupancyLayerNames: instance.decorOccupancy.occupancyLayerNames,
    });
  }
});

export function getVillageAtlasImageForTheme(themeId) {
  return themeId === WORLD_SEASON_IDS.WINTER
    ? solariaVillageWinterAtlasImage
    : solariaVillageDefaultAtlasImage;
}

export function getVillageTextureKeyForTheme(themeId) {
  return themeId === WORLD_SEASON_IDS.WINTER
    ? VILLAGE_WINTER_TEXTURE_KEY
    : VILLAGE_DEFAULT_TEXTURE_KEY;
}

export function getVillageTextureAssets() {
  return [
    {
      key: VILLAGE_DEFAULT_TEXTURE_KEY,
      url: solariaVillageDefaultAtlasImage,
    },
    {
      key: VILLAGE_WINTER_TEXTURE_KEY,
      url: solariaVillageWinterAtlasImage,
    },
  ];
}

export function getVillageInstanceBounds(instance) {
  const map = instance?.map;
  if (!instance || !map) {
    return null;
  }

  const leftTile = instance.worldX;
  const topTile = instance.worldY;
  const rightTile = leftTile + map.width;
  const bottomTile = topTile + map.height;

  return {
    leftTile,
    topTile,
    rightTile,
    bottomTile,
    left: leftTile * VILLAGE_WORLD_TILE_SIZE,
    top: topTile * VILLAGE_WORLD_TILE_SIZE,
    right: rightTile * VILLAGE_WORLD_TILE_SIZE,
    bottom: bottomTile * VILLAGE_WORLD_TILE_SIZE,
    widthTiles: map.width,
    heightTiles: map.height,
    width: map.width * VILLAGE_WORLD_TILE_SIZE,
    height: map.height * VILLAGE_WORLD_TILE_SIZE,
  };
}

export function getVillageViewportWorldBounds(
  worldOffset,
  viewport,
  padding = VILLAGE_WORLD_TILE_SIZE * 2
) {
  const width = Number(viewport?.width) || 0;
  const height = Number(viewport?.height) || 0;
  const offsetX = Number(worldOffset?.x) || 0;
  const offsetY = Number(worldOffset?.y) || 0;

  return {
    left: -offsetX - width * 0.5 - padding,
    right: -offsetX + width * 0.5 + padding,
    top: -offsetY - height * 0.5 - padding,
    bottom: -offsetY + height * 0.5 + padding,
  };
}

function getActiveVillageDepthRects(playerBounds, instances = WORLD_VILLAGE_INSTANCES) {
  const activeBounds = Array.isArray(playerBounds)
    ? playerBounds.filter(Boolean)
    : playerBounds
      ? [playerBounds]
      : [];
  if (!activeBounds.length) {
    return [];
  }

  return instances.flatMap((instance) => {
    if (!instance.usesDepthLayer) {
      return [];
    }

    return instance.depthRects.filter((rect) =>
      activeBounds.some((bounds) => boundsIntersect(bounds, rect))
    );
  });
}

function getVillageDoorTileOverrideGid(worldTileX, worldTileY) {
  return villageDoorTileOverrides.get(createTileKey(worldTileX, worldTileY)) || null;
}

function resolveVillageRenderTile(instance, layerName, tile, worldTileX, worldTileY) {
  const visualDoorLayerName = instance?.map?.doorVisualLayerName;
  if (layerName !== visualDoorLayerName) {
    return tile;
  }

  const overrideGid = getVillageDoorTileOverrideGid(worldTileX, worldTileY);
  if (!overrideGid || overrideGid === tile.gid) {
    return tile;
  }

  return (
    buildTileRuntimeFromGid(
      overrideGid,
      instance.map.firstgid,
      instance.map.columns,
      tile.x,
      tile.y
    ) || tile
  );
}

export function visitVillageRenderTiles(
  pass,
  visitor,
  {
    instances = WORLD_VILLAGE_INSTANCES,
    worldBounds = null,
    playerBounds = null,
    layerFilter = null,
  } = {}
) {
  if (typeof visitor !== "function") {
    return;
  }

  const activeDepthRects = getActiveVillageDepthRects(playerBounds, instances);
  const hasActiveDepthRects = activeDepthRects.length > 0;

  instances.forEach((instance) => {
    const instanceBounds = getVillageInstanceBounds(instance);
    if (
      worldBounds &&
      instanceBounds &&
      (instanceBounds.right <= worldBounds.left ||
        instanceBounds.left >= worldBounds.right ||
        instanceBounds.bottom <= worldBounds.top ||
        instanceBounds.top >= worldBounds.bottom)
    ) {
      return;
    }

    const layerRefs = [...getVillageLayerRefsForPass(instance.map, pass)];
    if (pass === "front" && hasActiveDepthRects) {
      const depthAwareLayerRefs = (instance.map.layers || [])
        .filter((layer) => VILLAGE_DEPTH_AWARE_LAYER_NAME_SET.has(layer.name))
        .map((layer) => createVillageLayerRef(layer));
      layerRefs.push(...depthAwareLayerRefs);
    }
    const orderedLayerRefs = sortVillageLayerRefsByMapOrder(layerRefs);
    let movedToFrontCount = 0;
    const movedTileSamples = [];

    orderedLayerRefs.forEach((layerRef) => {
      const layerName = layerRef.name;
      if (typeof layerFilter === "function" && !layerFilter(layerName, pass, instance)) {
        return;
      }

      const layer = getVillageLayerByRef(instance.map, layerRef);
      if (!layer?.visible || !layer?.tiles.length) {
        return;
      }

      layer.tiles.forEach((tile) => {
        const worldTileX = instance.worldX + tile.x;
        const worldTileY = instance.worldY + tile.y;
        const worldX = worldTileX * VILLAGE_WORLD_TILE_SIZE;
        const worldY = worldTileY * VILLAGE_WORLD_TILE_SIZE;
        const worldRight = worldX + VILLAGE_WORLD_TILE_SIZE;
        const worldBottom = worldY + VILLAGE_WORLD_TILE_SIZE;
        const tileBounds = {
          left: worldX,
          top: worldY,
          right: worldRight,
          bottom: worldBottom,
        };
        const isDynamicDepthTile =
          VILLAGE_DEPTH_AWARE_LAYER_NAME_SET.has(layerName) &&
          hasActiveDepthRects &&
          activeDepthRects.some((rect) => boundsIntersect(tileBounds, rect));

        if (
          worldBounds &&
          (worldRight <= worldBounds.left ||
            worldX >= worldBounds.right ||
            worldBottom <= worldBounds.top ||
            worldY >= worldBounds.bottom)
        ) {
          return;
        }

        if (VILLAGE_DEPTH_AWARE_LAYER_NAME_SET.has(layerName)) {
          if ((pass === "back" || pass === "mid") && isDynamicDepthTile) {
            return;
          }

          if (pass === "front" && !isDynamicDepthTile) {
            return;
          }
        }

        if (pass === "front" && isDynamicDepthTile) {
          movedToFrontCount += 1;
          if (movedTileSamples.length < 6) {
            movedTileSamples.push({
              layerName,
              worldTileX,
              worldTileY,
            });
          }
        }

        const renderTile = resolveVillageRenderTile(
          instance,
          layerName,
          tile,
          worldTileX,
          worldTileY
        );

        visitor({
          instance,
          map: instance.map,
          layerName,
          tile: renderTile,
          sourceTile: tile,
          worldTileX,
          worldTileY,
          worldX,
          worldY,
          renderWidth: VILLAGE_WORLD_TILE_SIZE,
          renderHeight: VILLAGE_WORLD_TILE_SIZE,
        });
      });
    });

    if (DEBUG_VILLAGE_DEPTH && pass === "front" && movedToFrontCount > 0) {
      const orderedLayerPaths = orderedLayerRefs.map(
        (layerRef) => layerRef.layerPath || layerRef.name
      );
      const debugSignature = `${instance.id}:${movedToFrontCount}:${orderedLayerPaths.join(",")}`;
      if (debugSignature !== lastVillageDepthMovedTileLog) {
        console.info("[Solaria Village] depth-moved tiles:", {
          instanceId: instance.id,
          movedToFrontCount,
          orderedLayerPaths,
        });
        lastVillageDepthMovedTileLog = debugSignature;
      }

      const sampleSignature = `${instance.id}:${movedTileSamples
        .map((sample) => `${sample.layerName}@${sample.worldTileX},${sample.worldTileY}`)
        .join("|")}`;
      if (sampleSignature !== lastVillageDepthMovedTileSampleLog) {
        console.info("[Solaria Village] depth-moved tile samples:", movedTileSamples);
        lastVillageDepthMovedTileSampleLog = sampleSignature;
      }
    }
  });
}

export function isWorldTileInsideVillage(worldTileX, worldTileY) {
  return WORLD_VILLAGE_INSTANCES.some((instance) => {
    const bounds = getVillageInstanceBounds(instance);
    return (
      bounds &&
      worldTileX >= bounds.leftTile &&
      worldTileX < bounds.rightTile &&
      worldTileY >= bounds.topTile &&
      worldTileY < bounds.bottomTile
    );
  });
}

export function isWorldPointInsideVillage(worldX, worldY) {
  const worldTileX = Math.floor(worldX / VILLAGE_WORLD_TILE_SIZE);
  const worldTileY = Math.floor(worldY / VILLAGE_WORLD_TILE_SIZE);
  return isWorldTileInsideVillage(worldTileX, worldTileY);
}

export function getVillageDecorExclusionInfo(worldTileX, worldTileY) {
  const key = createTileKey(worldTileX, worldTileY);

  for (const instance of WORLD_VILLAGE_INSTANCES) {
    const decorOccupancy = instance.decorOccupancy;
    if (!decorOccupancy?.excludedTileKeys?.has(key)) {
      continue;
    }

    const reasons = [];
    if (decorOccupancy.occupiedRawTileKeys?.has(key)) {
      reasons.push("visible_tile");
    }
    if (decorOccupancy.collisionRawTileKeys?.has(key)) {
      reasons.push("collision_rect");
    }
    if (decorOccupancy.merchantRawTileKeys?.has(key)) {
      reasons.push("merchant_zone");
    }
    if (!reasons.length) {
      reasons.push("padding");
    }

    return {
      excluded: true,
      instanceId: instance.id,
      reasons,
      worldTileX,
      worldTileY,
    };
  }

  return {
    excluded: false,
    instanceId: null,
    reasons: [],
    worldTileX,
    worldTileY,
  };
}

export function isWorldTileExcludedByVillageDecor(worldTileX, worldTileY) {
  return getVillageDecorExclusionInfo(worldTileX, worldTileY).excluded;
}

export function isWorldPointExcludedByVillageDecor(worldX, worldY) {
  const worldTileX = Math.floor(worldX / VILLAGE_WORLD_TILE_SIZE);
  const worldTileY = Math.floor(worldY / VILLAGE_WORLD_TILE_SIZE);
  return isWorldTileExcludedByVillageDecor(worldTileX, worldTileY);
}

export function isWorldBoundsExcludedByVillageDecor(bounds) {
  const tileRange = getWorldTileRangeForBounds(bounds);
  if (!tileRange) {
    return false;
  }

  for (let worldTileX = tileRange.startX; worldTileX <= tileRange.endX; worldTileX += 1) {
    for (let worldTileY = tileRange.startY; worldTileY <= tileRange.endY; worldTileY += 1) {
      if (isWorldTileExcludedByVillageDecor(worldTileX, worldTileY)) {
        return true;
      }
    }
  }

  return false;
}

export function isVillageBlockingTile(worldTileX, worldTileY) {
  return WORLD_VILLAGE_INSTANCES.some((instance) => {
    if (instance.usesCollisionLayer) {
      const worldTileBounds = {
        left: worldTileX * VILLAGE_WORLD_TILE_SIZE,
        top: worldTileY * VILLAGE_WORLD_TILE_SIZE,
        right: (worldTileX + 1) * VILLAGE_WORLD_TILE_SIZE,
        bottom: (worldTileY + 1) * VILLAGE_WORLD_TILE_SIZE,
      };

      return instance.collisionRects.some((rect) =>
        boundsIntersect(worldTileBounds, rect)
      );
    }

    const localTileX = worldTileX - instance.worldX;
    const localTileY = worldTileY - instance.worldY;

    if (
      localTileX < 0 ||
      localTileY < 0 ||
      localTileX >= instance.map.width ||
      localTileY >= instance.map.height
    ) {
      return false;
    }

    return instance.map.blockingTiles.has(createTileKey(localTileX, localTileY));
  });
}

export function getVillageCollisionRects() {
  return WORLD_VILLAGE_INSTANCES.flatMap((instance) => instance.collisionRects || []);
}

export function usesVillageCollisionObjectLayer() {
  return WORLD_VILLAGE_INSTANCES.some((instance) => Boolean(instance.usesCollisionLayer));
}

export function getVillageDepthRects() {
  return WORLD_VILLAGE_INSTANCES.flatMap((instance) => instance.depthRects || []);
}

export function getVillageDoors() {
  return WORLD_VILLAGE_INSTANCES.flatMap((instance) => instance.doorObjects || []);
}

export function getVillageMerchantSpawns() {
  return WORLD_VILLAGE_INSTANCES.flatMap((instance) => instance.merchantSpawns || []);
}

export function setVillageDoorTileOverride(worldTileX, worldTileY, gid) {
  const key = createTileKey(worldTileX, worldTileY);
  const normalizedGid = normalizeGid(gid);
  if (!normalizedGid) {
    villageDoorTileOverrides.delete(key);
    _villageDoorStateVersion += 1;
    return;
  }

  villageDoorTileOverrides.set(key, normalizedGid);
  _villageDoorStateVersion += 1;
}

export function clearVillageDoorTileOverride(worldTileX, worldTileY) {
  villageDoorTileOverrides.delete(createTileKey(worldTileX, worldTileY));
  _villageDoorStateVersion += 1;
}

export function clearAllVillageDoorTileOverrides() {
  villageDoorTileOverrides.clear();
  _villageDoorStateVersion += 1;
}

export function getVillageDoorById(doorId) {
  if (!doorId) {
    return null;
  }

  return getVillageDoors().find((door) => door.id === doorId) || null;
}

export function getNearestVillageDoor(x, y, maxDistance = Infinity) {
  let nearestDoor = null;
  let nearestDistance = Infinity;

  getVillageDoors().forEach((door) => {
    const centerX = (door.bounds.left + door.bounds.right) * 0.5;
    const centerY = (door.bounds.top + door.bounds.bottom) * 0.5;
    const distance = Math.hypot(centerX - x, centerY - y);
    if (distance <= maxDistance && distance < nearestDistance) {
      nearestDoor = door;
      nearestDistance = distance;
    }
  });

  return nearestDoor;
}

export function isPointBlockedByVillage(x, y) {
  for (const instance of WORLD_VILLAGE_INSTANCES) {
    if (instance.usesCollisionLayer) {
      if (instance.collisionRects.some((rect) => pointInsideBounds(x, y, rect))) {
        return true;
      }
      continue;
    }

    const worldTileX = Math.floor(x / VILLAGE_WORLD_TILE_SIZE);
    const worldTileY = Math.floor(y / VILLAGE_WORLD_TILE_SIZE);
    if (isVillageBlockingTile(worldTileX, worldTileY)) {
      return true;
    }
  }

  return false;
}

export function isRectBlockedByVillage(x, y, width, height) {
  const bounds = {
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
  };

  const collisionLayerInstances = WORLD_VILLAGE_INSTANCES.filter(
    (instance) => instance.usesCollisionLayer
  );

  if (collisionLayerInstances.length > 0) {
    return collisionLayerInstances.some((instance) =>
      instance.collisionRects.some((rect) => boundsIntersect(bounds, rect))
    );
  }

  const tileRange = getWorldTileRangeForBounds(bounds);
  if (!tileRange) {
    return false;
  }

  for (let worldTileX = tileRange.startX; worldTileX <= tileRange.endX; worldTileX += 1) {
    for (let worldTileY = tileRange.startY; worldTileY <= tileRange.endY; worldTileY += 1) {
      if (isVillageBlockingTile(worldTileX, worldTileY)) {
        return true;
      }
    }
  }

  return false;
}

export function isVillageBlockingBounds(bounds) {
  if (!bounds) {
    return false;
  }

  return isRectBlockedByVillage(
    bounds.left,
    bounds.top,
    bounds.right - bounds.left,
    bounds.bottom - bounds.top
  );
}

export function getVillageDoorAtWorldTile(worldTileX, worldTileY) {
  return (
    getVillageDoors().find(
      (door) => door.worldTileX === worldTileX && door.worldTileY === worldTileY
    ) || null
  );
}

export function getVillageDoorAtWorldPoint(worldX, worldY) {
  const worldTileX = Math.floor(worldX / VILLAGE_WORLD_TILE_SIZE);
  const worldTileY = Math.floor(worldY / VILLAGE_WORLD_TILE_SIZE);
  return getVillageDoorAtWorldTile(worldTileX, worldTileY);
}
