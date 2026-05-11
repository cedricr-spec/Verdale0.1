import React, { useEffect, useMemo, useRef, useState } from "react";
import useWorldTheme from "../hooks/useWorldTheme";
import useWorldAtlasStreaming from "../hooks/useWorldAtlasStreaming";
import { getPetCollisionBounds } from "../systems/CollisionSystem";
import {
  CHUNK_TILE_SIZE,
  SHOW_AUTOTILE_CATEGORY_DEBUG,
  SHOW_OBJECT_SPAWN_DEBUG,
  SHOW_SPAWN_DESPAWN_BUFFER_DEBUG,
  SHOW_TERRAIN_TYPE_DEBUG,
  SHOW_VIEWPORT_CULLING_DEBUG,
  SHOW_WORLD_ITEM_BOUNDS_DEBUG,
  SHOW_WORLD_STREAMING_DEBUG,
  WORLD_RENDER_MODE,
} from "../config/worldStreamingConfig";
import { useWorldStore } from "../store/worldSlice";
import { useWorldDebugStore } from "../store/worldDebugStore";
import { useBrokenObjectsStore } from "../store/brokenObjectsStore";
import {
  getWorldAtlasCollisionBounds,
  getWorldAtlasLayoutKey,
  WORLD_ATLAS_TILE_SIZE,
} from "../utils/worldAtlasFamilies";
import {
  WORLD_ATLAS_DATA,
  applyWorldAtlasObjectState,
  createWorldAtlasStumpRenderItem,
} from "../utils/worldAtlasData";
import {
  recordWorldPerfRender,
  sampleWorldPerfRenderRates,
} from "../utils/worldPerfMetrics";
import {
  getVillageAtlasImageForTheme,
  getVillageViewportWorldBounds,
  visitVillageRenderTiles,
} from "../utils/worldVillage";
import WorldDebugOverlay from "./WorldDebugOverlay";

const DEFAULT_VIEWPORT = { width: 500, height: 500 };
const DEFAULT_VIEWPORT_FRAME = Object.freeze({
  left: 0,
  top: 0,
  width: DEFAULT_VIEWPORT.width,
  height: DEFAULT_VIEWPORT.height,
  centerX: DEFAULT_VIEWPORT.width * 0.5,
  centerY: DEFAULT_VIEWPORT.height * 0.5,
});

const ROOT_STYLE = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  pointerEvents: "none",
};

const LAYER_STYLE = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
};

const RENDER_LAYER_ORDER = {
  ground: 0,
  terrain_variation: 1,
  feature: 2,
  path: 3,
  water: 4,
  bridge: 5,
  decor_ground: 6,
  decor: 7,
  landmark: 8,
  water_overlay: 9,
  overlay: 10,
};

function compareWorldRenderItems(a, b) {
  const layerDelta =
    (RENDER_LAYER_ORDER[a?.renderLayer] ?? 0) -
    (RENDER_LAYER_ORDER[b?.renderLayer] ?? 0);
  if (layerDelta !== 0) return layerDelta;

  const priorityDelta = (a?.renderPriority || 0) - (b?.renderPriority || 0);
  if (priorityDelta !== 0) return priorityDelta;

  const yDelta = (a?.zSortY || 0) - (b?.zSortY || 0);
  if (yDelta !== 0) return yDelta;

  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

function normalizeViewportFrame(viewportFrame = DEFAULT_VIEWPORT_FRAME) {
  const width = Math.max(1, Math.ceil(viewportFrame.width || DEFAULT_VIEWPORT.width));
  const height = Math.max(1, Math.ceil(viewportFrame.height || DEFAULT_VIEWPORT.height));
  const left = Math.round(viewportFrame.left || 0);
  const top = Math.round(viewportFrame.top || 0);

  return {
    left,
    top,
    width,
    height,
    centerX: left + width * 0.5,
    centerY: top + height * 0.5,
  };
}

function useAtlasImageElement(atlasImage) {
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (!atlasImage) {
      setImage(null);
      return undefined;
    }

    const nextImage = new Image();
    nextImage.decoding = "async";
    nextImage.src = atlasImage;

    const handleLoad = () => setImage(nextImage);
    const handleError = () => setImage(null);

    if (nextImage.complete) {
      handleLoad();
    } else {
      nextImage.addEventListener("load", handleLoad);
      nextImage.addEventListener("error", handleError);
    }

    return () => {
      nextImage.removeEventListener("load", handleLoad);
      nextImage.removeEventListener("error", handleError);
    };
  }, [atlasImage]);

  return image;
}

function useAtlasAnimationClock(enabled) {
  const [frameTick, setFrameTick] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;

    let rafId = 0;
    let lastFrameAt = performance.now();

    const loop = (timestamp) => {
      if (timestamp - lastFrameAt >= 125) {
        setFrameTick((value) => value + 1);
        lastFrameAt = timestamp;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafId);
  }, [enabled]);

  return frameTick;
}

function hashForItem(item) {
  let hash = 2166136261;
  const value = item.id;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function createLocalWorldTransform(viewport, worldOffset) {
  return {
    transform: `translate3d(${Math.round((viewport?.width || 0) * 0.5 + (worldOffset?.x || 0))}px, ${Math.round((viewport?.height || 0) * 0.5 + (worldOffset?.y || 0))}px, 0)`,
    willChange: "transform",
  };
}

function createScreenWorldTransform(viewportFrame, worldOffset) {
  return {
    transform: `translate3d(${Math.round((viewportFrame?.centerX || 0) + (worldOffset?.x || 0))}px, ${Math.round((viewportFrame?.centerY || 0) + (worldOffset?.y || 0))}px, 0)`,
    willChange: "transform",
  };
}

function createCameraSample(viewport, worldOffset) {
  const nextWorldOffset = worldOffset || { x: 0, y: 0 };
  const playerX = -(nextWorldOffset.x || 0);
  const playerY = -(nextWorldOffset.y || 0);

  return {
    worldOffset: nextWorldOffset,
    playerX,
    playerY,
    tileX: Math.floor(playerX / WORLD_ATLAS_TILE_SIZE),
    tileY: Math.floor(playerY / WORLD_ATLAS_TILE_SIZE),
    layoutKey: getWorldAtlasLayoutKey(playerX, playerY, viewport),
  };
}

function shouldResampleCamera(prevSample, nextSample, fineGrainedDebugSampling) {
  if (!prevSample) return true;
  if (prevSample.layoutKey !== nextSample.layoutKey) return true;
  if (!fineGrainedDebugSampling) return false;

  return prevSample.tileX !== nextSample.tileX || prevSample.tileY !== nextSample.tileY;
}

function applyWorldTransform(node, viewport, worldOffset, createTransform = createLocalWorldTransform) {
  if (!node) return;

  const nextTransform = createTransform(viewport, worldOffset).transform;
  if (node.style.transform !== nextTransform) {
    node.style.transform = nextTransform;
  }
  if (node.style.willChange !== "transform") {
    node.style.willChange = "transform";
  }
}

function getAnimationFrame(item, frameTick) {
  if (!item.animation) return 0;

  const frameCount =
    item.animation.frameCount || item.animation.frames?.length || 1;
  const ticksPerFrame = Math.max(1, item.animation.ticksPerFrame || 1);
  const phaseOffsetFrames =
    item.animation.loop !== false
      ? Math.floor(hashForItem(item) * frameCount)
      : 0;
  const animationTick = Math.floor(frameTick / ticksPerFrame) + phaseOffsetFrames;
  const shouldLoop =
    item.animation.loop || !item.animation.playOnce || item.renderLayer === "overlay";

  if (shouldLoop) {
    return animationTick % frameCount;
  }

  return Math.min(animationTick, frameCount - 1);
}

function getAnimatedBackgroundStyle(item, atlasImage, frameTick) {
  const frameIndex = getAnimationFrame(item, frameTick);
  const frameData = item.animation?.frames?.[frameIndex] || null;
  const offsetX =
    frameData?.atlas?.x ?? item.entry.x + frameIndex * (item.animation?.frameWidth || 0);
  const offsetY = frameData?.atlas?.y ?? item.entry.y;

  return {
    backgroundImage: `url(${atlasImage})`,
    backgroundPosition: `-${offsetX}px -${offsetY}px`,
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated",
  };
}

function getItemDrift(item, frameTick) {
  return item.animation?.verticalDrift
    ? Math.sin((frameTick + hashForItem(item) * 10) * 0.4) * 4
    : 0;
}

function boundsContainPoint(bounds, x, y) {
  if (!bounds) return false;
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
}

function getItemTransform(item, frameTick) {
  const drift = getItemDrift(item, frameTick);

  if (item.anchorMode === "tile") {
    return `translate(${item.x}px, ${item.y + drift}px) scale(${item.scale})`;
  }

  return `translate(${item.x}px, ${item.y + drift}px) translate(${
    -item.anchorX * 100
  }%, ${-item.anchorY * 100}%) scale(${item.scale})`;
}

function getRenderItemBounds(item, frameTick) {
  const scale = item.scale || 1;
  const width = (item.renderWidth || item.entry?.width || 0) * scale;
  const height = (item.renderHeight || item.entry?.height || 0) * scale;
  const drift = getItemDrift(item, frameTick);

  if (item.anchorMode === "tile") {
    return {
      left: item.x,
      top: item.y + drift,
      width,
      height,
    };
  }

  return {
    left: item.x - (item.anchorX || 0) * width,
    top: item.y + drift - (item.anchorY || 1) * height,
    width,
    height,
  };
}

function projectWorldBoundsToScreen(bounds, viewportFrame, worldOffset) {
  return {
    left: Math.round((viewportFrame?.centerX || 0) + (worldOffset?.x || 0) + bounds.left),
    top: Math.round((viewportFrame?.centerY || 0) + (worldOffset?.y || 0) + bounds.top),
    width: Math.max(1, Math.round(bounds.right - bounds.left)),
    height: Math.max(1, Math.round(bounds.bottom - bounds.top)),
  };
}

function isMetadataDebugItem(item) {
  return Boolean(
    item?.isWorldMetadata ||
      item?.entry?.group === "world_metadata" ||
      item?.entry?.group === "world_metadata_animation"
  );
}

function isLegacyDecorDebugItem(item) {
  return item?.entry?.group === "trees" || item?.entry?.group === "rocks";
}

function getDecorDebugColor(item) {
  const familyId =
    item?.worldDecorFamily || item?.entry?.family || item?.entry?.name || "";
  const lowerFamilyId = String(familyId).toLowerCase();

  if (item?.entry?.group === "trees") {
    return "rgba(80, 255, 140, 0.96)";
  }

  if (
    item?.entry?.group === "rocks" ||
    lowerFamilyId.includes("rock") ||
    lowerFamilyId.includes("pebble")
  ) {
    return "rgba(210, 214, 224, 0.96)";
  }

  if (lowerFamilyId.includes("variation")) {
    return "rgba(255, 222, 92, 0.96)";
  }

  if (lowerFamilyId.includes("water_idle_sparkle")) {
    return "rgba(90, 235, 255, 0.98)";
  }

  if (lowerFamilyId.includes("fountain")) {
    return "rgba(90, 140, 255, 0.98)";
  }

  if (
    lowerFamilyId.includes("flower") ||
    lowerFamilyId.includes("herb") ||
    lowerFamilyId.includes("shroom") ||
    lowerFamilyId.includes("mushroom")
  ) {
    return "rgba(255, 116, 214, 0.96)";
  }

  return "rgba(255, 255, 255, 0.96)";
}

function getDecorDebugLabel(item) {
  return (
    item?.worldDecorFamily ||
    item?.entry?.family ||
    item?.entry?.name ||
    item?.entry?.group ||
    "item"
  );
}

function getWorldSparkleCount(worldDecorStats) {
  if (!worldDecorStats?.byFamily) return 0;

  return (
    (worldDecorStats.byFamily?.water_idle_sparkle_loop_a?.placed || 0) +
    (worldDecorStats.byFamily?.water_idle_sparkle_loop_b?.placed || 0)
  );
}

function getItemChunkKey(item) {
  const gridX = Number.isFinite(item.gridX)
    ? item.gridX
    : Math.floor((Number.isFinite(item.baseX) ? item.baseX : item.x || 0) / WORLD_ATLAS_TILE_SIZE);
  const gridY = Number.isFinite(item.gridY)
    ? item.gridY
    : Math.floor((Number.isFinite(item.baseY) ? item.baseY : item.y || 0) / WORLD_ATLAS_TILE_SIZE);

  return `${Math.floor(gridX / CHUNK_TILE_SIZE)},${Math.floor(gridY / CHUNK_TILE_SIZE)}`;
}

let _invalidDomRenderCount = 0;
let _invalidDomRenderLogAt = 0;

function warnInvalidDomRender(item, details) {
  if (!import.meta.env.DEV) return;
  _invalidDomRenderCount += 1;
  const now =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();

  if (now - _invalidDomRenderLogAt < 2000) {
    return;
  }

  _invalidDomRenderLogAt = now;
  console.warn("[world-atlas-invalid-dom-render]", {
    count: _invalidDomRenderCount,
    id: item?.id,
    family: item?.worldDecorFamily || item?.entry?.family || item?.entry?.name,
    details,
  });
}

function isFinitePositiveRect(value) {
  return Number.isFinite(value) && value > 0;
}

function isRenderableAtlasItem(item, frameTick) {
  if (!item?.entry) {
    warnInvalidDomRender(item, { reason: "missing_entry" });
    return false;
  }

  const bounds = getRenderItemBounds(item, item.animation ? frameTick : 0);
  const source = getItemFrameSourceRect(item, frameTick);

  if (
    !Number.isFinite(bounds.left) ||
    !Number.isFinite(bounds.top) ||
    !isFinitePositiveRect(bounds.width) ||
    !isFinitePositiveRect(bounds.height)
  ) {
    warnInvalidDomRender(item, {
      reason: "invalid_target_bounds",
      bounds,
    });
    return false;
  }

  if (
    !Number.isFinite(source.x) ||
    !Number.isFinite(source.y) ||
    !isFinitePositiveRect(source.width) ||
    !isFinitePositiveRect(source.height)
  ) {
    warnInvalidDomRender(item, {
      reason: "invalid_source_rect",
      source,
    });
    return false;
  }

  return true;
}

function renderAtlasItem(item, atlasImage, frameTick, extraStyle = {}) {
  if (!isRenderableAtlasItem(item, frameTick)) {
    return null;
  }

  return (
    <div
      key={item.id}
      data-atlas-entry={item.entry.name}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: item.renderWidth,
        height: item.renderHeight,
        overflow: "visible",
        transform: getItemTransform(item, frameTick),
        transformOrigin:
          item.anchorMode === "tile"
            ? "top left"
            : `${item.anchorX * 100}% ${item.anchorY * 100}%`,
        ...getAnimatedBackgroundStyle(item, atlasImage, frameTick),
        ...extraStyle,
      }}
    />
  );
}

const loggedDecorClipDebugIds = new Set();

function shouldApplySplitClip(item) {
  return Boolean(item?.entry?.group === "trees" && Number(item?.splitDepth) > 0);
}

function getSplitClipStyle(item, side) {
  if (!shouldApplySplitClip(item)) {
    return undefined;
  }

  if (side === "front") {
    return { clipPath: `inset(0 0 ${100 - item.splitDepth}% 0)` };
  }

  return { clipPath: `inset(${item.splitDepth}% 0 0 0)` };
}

function maybeLogDecorClipDebug(item, clipStyle, frameTick = 0) {
  if (!import.meta.env.DEV) {
    return;
  }

  if (!item?.splitDepth && !clipStyle?.clipPath) {
    return;
  }

  const logKey = `${item?.id || "unknown"}|${clipStyle?.clipPath || "none"}|${
    item?.splitDepth || 0
  }`;
  if (loggedDecorClipDebugIds.has(logKey)) {
    return;
  }

  loggedDecorClipDebugIds.add(logKey);
  console.debug("[decor-clip-debug]", {
    itemId: item?.id || null,
    entryId: item?.entry?.name || null,
    renderWidth: item?.renderWidth || null,
    renderHeight: item?.renderHeight || null,
    splitDepth: item?.splitDepth || 0,
    clipPath: clipStyle?.clipPath || null,
    atlasRect: getItemFrameSourceRect(item, frameTick),
  });
}

function getItemFrameSourceRect(item, frameTick) {
  const frameIndex = getAnimationFrame(item, frameTick);
  const frameData = item.animation?.frames?.[frameIndex] || null;
  const sourceWidth = item.animation?.frameWidth || item.entry.width;
  const sourceHeight = item.animation?.frameHeight || item.entry.height;

  return {
    x: frameData?.atlas?.x ?? item.entry.x + frameIndex * sourceWidth,
    y: frameData?.atlas?.y ?? item.entry.y,
    width: sourceWidth,
    height: sourceHeight,
  };
}

const loggedAtlasRectDebugIds = new Set();
const STATIC_CHUNK_CANVAS_PADDING = WORLD_ATLAS_TILE_SIZE * 2;

function maybeLogAtlasRectDebug(
  item,
  source,
  atlasImage,
  reason = "unknown",
  extra = {}
) {
  if (!import.meta.env.DEV) {
    return;
  }

  const key = `${reason}|${item?.id || "unknown"}|${source?.x || 0}|${source?.y || 0}|${
    source?.width || 0
  }|${source?.height || 0}`;
  if (loggedAtlasRectDebugIds.has(key)) {
    return;
  }

  loggedAtlasRectDebugIds.add(key);
  console.debug("[atlas-rect-debug]", {
    itemId: item?.id || null,
    entryId: item?.entry?.id || item?.entry?.name || null,
    entryName: item?.entry?.name || null,
    atlasX: source?.x ?? item?.entry?.x ?? null,
    atlasY: source?.y ?? item?.entry?.y ?? null,
    atlasWidth: source?.width ?? item?.entry?.width ?? null,
    atlasHeight: source?.height ?? item?.entry?.height ?? null,
    renderWidth: item?.renderWidth ?? null,
    renderHeight: item?.renderHeight ?? null,
    spritePath: atlasImage || null,
    source: atlasImage || null,
    family: item?.worldDecorFamily || item?.entry?.family || null,
    group: item?.entry?.group || null,
    reason,
    ...extra,
  });
}

let _invalidCanvasDrawCount = 0;
let _invalidCanvasDrawLogAt = 0;

function isValidSourceRect(src, img) {
  if (
    !Number.isFinite(src.x) || !Number.isFinite(src.y) ||
    !Number.isFinite(src.width) || !Number.isFinite(src.height)
  ) return false;
  if (src.width <= 0 || src.height <= 0 || src.x < 0 || src.y < 0) return false;
  const maxW = img.naturalWidth || 0;
  const maxH = img.naturalHeight || 0;
  if (maxW > 0 && src.x + src.width > maxW + 0.5) return false;
  if (maxH > 0 && src.y + src.height > maxH + 0.5) return false;
  return true;
}


function isValidTargetDims(w, h) {
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
}


function warnInvalidCanvasDraw(item, source) {
  if (!import.meta.env.DEV) return;
  _invalidCanvasDrawCount += 1;
  const now = performance.now();
  if (now - _invalidCanvasDrawLogAt > 2000) {
    _invalidCanvasDrawLogAt = now;
    console.warn("[canvas-draw-invalid]", {
      count: _invalidCanvasDrawCount,
      id: item?.id,
      family: item?.entry?.name,
      source,
    });
  }
}

function getItemCanvasDrawRect(item, viewport, worldOffset, frameTick = 0) {
  const bounds = getRenderItemBounds(item, frameTick);

  return {
    left: Math.round(bounds.left + (viewport?.width || 0) * 0.5 + (worldOffset?.x || 0)),
    top: Math.round(bounds.top + (viewport?.height || 0) * 0.5 + (worldOffset?.y || 0)),
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  };
}

function drawItemToCanvas(ctx, atlasImageElement, item, viewport, worldOffset, frameTick = 0) {
  if (!ctx || !atlasImageElement) return;

  const source = getItemFrameSourceRect(item, frameTick);
  const target = getItemCanvasDrawRect(item, viewport, worldOffset, frameTick);

  if (!isValidTargetDims(target.width, target.height)) {
    return;
  }

  if (
    target.left > ctx.canvas.width ||
    target.top > ctx.canvas.height ||
    target.left + target.width < 0 ||
    target.top + target.height < 0
  ) {
    return;
  }

  if (!isValidSourceRect(source, atlasImageElement)) {
    warnInvalidCanvasDraw(item, source);
    return;
  }

  ctx.drawImage(
    atlasImageElement,
    source.x,
    source.y,
    source.width,
    source.height,
    target.left,
    target.top,
    target.width,
    target.height
  );
}

function drawVillagePassToCanvas(
  ctx,
  atlasImageElement,
  pass,
  viewport,
  worldOffset
) {
  if (!ctx || !atlasImageElement) {
    return;
  }

  const worldBounds = getVillageViewportWorldBounds(worldOffset, viewport);

  visitVillageRenderTiles(pass, ({ layerName, tile, worldTileX, worldTileY, worldX, worldY, renderWidth, renderHeight }) => {
    const source = {
      x: tile.sx,
      y: tile.sy,
      width: tile.sw,
      height: tile.sh,
    };

    if (!isValidSourceRect(source, atlasImageElement)) {
      warnInvalidCanvasDraw(
        {
          id: `village_${layerName}_${worldTileX}_${worldTileY}`,
          entry: { name: layerName },
        },
        source
      );
      return;
    }

    const targetLeft = Math.round(
      worldX + (viewport?.width || 0) * 0.5 + (worldOffset?.x || 0)
    );
    const targetTop = Math.round(
      worldY + (viewport?.height || 0) * 0.5 + (worldOffset?.y || 0)
    );

    if (
      targetLeft > ctx.canvas.width ||
      targetTop > ctx.canvas.height ||
      targetLeft + renderWidth < 0 ||
      targetTop + renderHeight < 0
    ) {
      return;
    }

    ctx.drawImage(
      atlasImageElement,
      source.x,
      source.y,
      source.width,
      source.height,
      targetLeft,
      targetTop,
      renderWidth,
      renderHeight
    );
  }, { worldBounds });
}

function renderVillageTileNode(tileData, atlasImage) {
  return (
    <div
      key={`village_${tileData.instance.id}_${tileData.layerName}_${tileData.worldTileX}_${tileData.worldTileY}`}
      data-village-layer={tileData.layerName}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: tileData.tile.sw,
        height: tileData.tile.sh,
        transform: `translate(${tileData.worldX}px, ${tileData.worldY}px) scale(2)`,
        transformOrigin: "top left",
        backgroundImage: `url(${atlasImage})`,
        backgroundPosition: `-${tileData.tile.sx}px -${tileData.tile.sy}px`,
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
      }}
    />
  );
}

function createChunkTileSignature(items) {
  if (!items?.length) return "empty";
  return items.map((item) => item.id).join("|");
}

function getOrCreateStaticChunkCanvas(chunk, side, atlasImageElement, cache) {
  if (!atlasImageElement) return null;

  const items = side === "front" ? chunk.tileFrontItems : chunk.tileBackItems;
  const signature = `${chunk.key}:${side}:${createChunkTileSignature(items)}`;
  const cached = cache.get(signature);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  const baseChunkCanvasWidth = CHUNK_TILE_SIZE * WORLD_ATLAS_TILE_SIZE;
  const baseChunkCanvasHeight = CHUNK_TILE_SIZE * WORLD_ATLAS_TILE_SIZE;
  canvas.width = baseChunkCanvasWidth + STATIC_CHUNK_CANVAS_PADDING * 2;
  canvas.height = baseChunkCanvasHeight + STATIC_CHUNK_CANVAS_PADDING * 2;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  ctx.imageSmoothingEnabled = false;
  items.forEach((item) => {
    const source = getItemFrameSourceRect(item, 0);
    const width = Math.round(item.renderWidth * item.scale);
    const height = Math.round(item.renderHeight * item.scale);
    const unpaddedLocalX = Math.round(item.x - chunk.bounds.left);
    const unpaddedLocalY = Math.round(item.y - chunk.bounds.top);
    const localX = unpaddedLocalX + STATIC_CHUNK_CANVAS_PADDING;
    const localY = unpaddedLocalY + STATIC_CHUNK_CANVAS_PADDING;

    if (!isValidTargetDims(width, height)) {
      return;
    }

    if (!isValidSourceRect(source, atlasImageElement)) {
      warnInvalidCanvasDraw(item, source);
      return;
    }

    if (
      unpaddedLocalX < 0 ||
      unpaddedLocalY < 0 ||
      unpaddedLocalX + width > baseChunkCanvasWidth ||
      unpaddedLocalY + height > baseChunkCanvasHeight
    ) {
      maybeLogAtlasRectDebug(item, source, atlasImageElement?.src || null, "chunk_canvas_overflow", {
        localX: unpaddedLocalX,
        localY: unpaddedLocalY,
        width,
        height,
        chunkKey: chunk.key,
        chunkCanvasWidth: baseChunkCanvasWidth,
        chunkCanvasHeight: baseChunkCanvasHeight,
      });
    }

    ctx.drawImage(
      atlasImageElement,
      source.x,
      source.y,
      source.width,
      source.height,
      localX,
      localY,
      width,
      height
    );
  });

  cache.set(signature, canvas);
  if (cache.size > 256) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  return canvas;
}

const ChunkTileLayer = React.memo(function ChunkTileLayer({
  chunk,
  atlasImage,
  frameTick,
  front = false,
}) {
  if (import.meta.env.DEV) {
    recordWorldPerfRender("chunkTileLayer");
  }

  const staticItems = front ? chunk.tileFrontItems : chunk.tileBackItems;
  const animatedItems = front
    ? chunk.animatedTileFrontItems
    : chunk.animatedTileBackItems;

  const staticNodes = useMemo(
    () => staticItems.map((item) => renderAtlasItem(item, atlasImage, 0)),
    [atlasImage, staticItems]
  );
  const animatedNodes = useMemo(
    () => animatedItems.map((item) => renderAtlasItem(item, atlasImage, frameTick)),
    [animatedItems, atlasImage, frameTick]
  );

  return (
    <>
      {staticNodes}
      {animatedNodes}
    </>
  );
});

export default function WorldAtlasLayer({ viewportFrame = DEFAULT_VIEWPORT_FRAME }) {
  const normalizedViewportFrame = useMemo(
    () => normalizeViewportFrame(viewportFrame),
    [viewportFrame]
  );
  const viewport = useMemo(
    () => ({
      width: normalizedViewportFrame.width,
      height: normalizedViewportFrame.height,
    }),
    [normalizedViewportFrame.height, normalizedViewportFrame.width]
  );
  const theme = useWorldTheme();
  const atlasImageElement = useAtlasImageElement(theme.atlasImage);
  const villageAtlasImage = useMemo(
    () => getVillageAtlasImageForTheme(theme.id),
    [theme.id]
  );
  const villageAtlasImageElement = useAtlasImageElement(villageAtlasImage);
  const debugFlags = useWorldDebugStore((state) => state.flags);
  const decorSettings = useWorldDebugStore((state) => state.decorSettings);
  // TEMP PERF TEST: disable collision debug rendering only.
  // This does not disable actual collisions.
  const collisionRectsOnlyMode = false;
  const showCollisionBounds = false;
  const frontWorldRef = useRef(null);
  const backWorldRef = useRef(null);
  const debugWorldRef = useRef(null);
  const backCanvasRef = useRef(null);
  const frontCanvasRef = useRef(null);
  // Tracks the worldOffset most recently applied to DOM transforms — used for sync debug.
  const lastDOMTransformOffsetRef = useRef(null);
  const chunkCanvasCacheRef = useRef(new Map());
  const canvasPerfAccumulatorRef = useRef({
    backDrawCount: 0,
    frontDrawCount: 0,
    backDrawDurationMs: 0,
    frontDrawDurationMs: 0,
  });
  const fineGrainedDebugSampling =
    debugFlags.showWorldDebugOverlay ||
    debugFlags.showWorldDecorDebug ||
    debugFlags.showWorldDecorBoundsDebug ||
    debugFlags.showWorldItemBoundsDebug ||
    showCollisionBounds ||
    collisionRectsOnlyMode ||
    debugFlags.showWorldSpawnRadiusDebug ||
    debugFlags.showSpawnDespawnBufferDebug ||
    debugFlags.showViewportCullingDebug ||
    debugFlags.showWaterCollisionDebug ||
    SHOW_TERRAIN_TYPE_DEBUG ||
    SHOW_AUTOTILE_CATEGORY_DEBUG ||
    SHOW_OBJECT_SPAWN_DEBUG;
  const [cameraSample, setCameraSample] = useState(() =>
    createCameraSample(DEFAULT_VIEWPORT, useWorldStore.getState().worldOffset)
  );
  const cameraSampleRef = useRef(cameraSample);
  const [renderPerf, setRenderPerf] = useState(null);
  const [canvasPerf, setCanvasPerf] = useState(null);
  // Safety fallback: canvas-terrain currently produces black flickering rectangles.
  // Keep WORLD_RENDER_MODE imported, but force DOM terrain until the canvas renderer is fixed.
  const isCanvasTerrainMode = true;

  if (import.meta.env.DEV) {
    recordWorldPerfRender("worldAtlasLayer");
  }

  useEffect(() => {
    cameraSampleRef.current = cameraSample;
  }, [cameraSample]);

  useEffect(() => {
    const syncedSample = createCameraSample(viewport, useWorldStore.getState().worldOffset);
    cameraSampleRef.current = syncedSample;
    setCameraSample(syncedSample);
    applyWorldTransform(
      backWorldRef.current,
      viewport,
      syncedSample.worldOffset,
      createLocalWorldTransform
    );
    applyWorldTransform(
      frontWorldRef.current,
      viewport,
      syncedSample.worldOffset,
      createLocalWorldTransform
    );
    applyWorldTransform(
      debugWorldRef.current,
      normalizedViewportFrame,
      syncedSample.worldOffset,
      createScreenWorldTransform
    );
  }, [
    fineGrainedDebugSampling,
    normalizedViewportFrame,
    viewport.height,
    viewport.width,
  ]);

  useEffect(() => {
    const unsubscribe = useWorldStore.subscribe((state, previousState) => {
      if (state.worldOffset === previousState.worldOffset) {
        return;
      }

      const nextOffset = state.worldOffset || { x: 0, y: 0 };
      lastDOMTransformOffsetRef.current = nextOffset;
      applyWorldTransform(
        backWorldRef.current,
        viewport,
        nextOffset,
        createLocalWorldTransform
      );
      applyWorldTransform(
        frontWorldRef.current,
        viewport,
        nextOffset,
        createLocalWorldTransform
      );
      applyWorldTransform(
        debugWorldRef.current,
        normalizedViewportFrame,
        nextOffset,
        createScreenWorldTransform
      );

      const nextSample = createCameraSample(viewport, nextOffset);
      if (
        shouldResampleCamera(
          cameraSampleRef.current,
          nextSample,
          fineGrainedDebugSampling
        )
      ) {
        cameraSampleRef.current = nextSample;
        setCameraSample(nextSample);
      }
    });

    return () => unsubscribe();
  }, [
    fineGrainedDebugSampling,
    normalizedViewportFrame,
    viewport.height,
    viewport.width,
  ]);

  useEffect(() => {
    if (!import.meta.env.DEV || !debugFlags.showWorldPerfDebug) {
      setRenderPerf(null);
      setCanvasPerf(null);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setRenderPerf(sampleWorldPerfRenderRates());
      const nextCanvasPerf = canvasPerfAccumulatorRef.current;
      setCanvasPerf({
        backDrawsPerSecond: nextCanvasPerf.backDrawCount,
        frontDrawsPerSecond: nextCanvasPerf.frontDrawCount,
        backDrawDurationMs:
          nextCanvasPerf.backDrawCount > 0
            ? nextCanvasPerf.backDrawDurationMs / nextCanvasPerf.backDrawCount
            : 0,
        frontDrawDurationMs:
          nextCanvasPerf.frontDrawCount > 0
            ? nextCanvasPerf.frontDrawDurationMs / nextCanvasPerf.frontDrawCount
            : 0,
      });
      canvasPerfAccumulatorRef.current = {
        backDrawCount: 0,
        frontDrawCount: 0,
        backDrawDurationMs: 0,
        frontDrawDurationMs: 0,
      };
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [debugFlags.showWorldPerfDebug]);

  const playerX = cameraSample.playerX;
  const playerY = cameraSample.playerY;

  const { layout, debug: streamingDebug } = useWorldAtlasStreaming(
    playerX,
    playerY,
    theme.atlasData,
    viewport
  );

  const hiddenObjectIds = useBrokenObjectsStore((s) => s.hiddenObjectIds);
  const replacedObjectIds = useBrokenObjectsStore((s) => s.replacedObjectIds);
  const stumpObjects = useBrokenObjectsStore((s) => s.stumpObjects);
  const brokenObjectIds = useBrokenObjectsStore((s) => s.brokenObjectIds);
  const objectStateRevision = useBrokenObjectsStore((s) => s.objectStateRevision);

  const brokenObjectState = useMemo(
    () => ({
      hiddenObjectIds,
      replacedObjectIds,
      objectStateRevision,
    }),
    [hiddenObjectIds, objectStateRevision, replacedObjectIds]
  );

  const filteredBaseRenderItems = useMemo(
    () => applyWorldAtlasObjectState(layout.renderItems, theme.atlasData, brokenObjectState),
    [brokenObjectState, layout.renderItems, objectStateRevision, theme.atlasData]
  );

  const stumpRenderItems = useMemo(
    () =>
      Object.values(stumpObjects || {})
        .map((stumpObject) =>
          createWorldAtlasStumpRenderItem(stumpObject, WORLD_ATLAS_DATA)
        )
        .filter(Boolean)
        .sort(compareWorldRenderItems),
    [stumpObjects]
  );

  const filteredRenderItems = useMemo(
    () =>
      [...filteredBaseRenderItems, ...stumpRenderItems].sort(compareWorldRenderItems),
    [filteredBaseRenderItems, stumpRenderItems]
  );

  const filteredBaseCollisionItems = useMemo(
    () => applyWorldAtlasObjectState(layout.collisionItems, theme.atlasData, brokenObjectState),
    [brokenObjectState, layout.collisionItems, objectStateRevision, theme.atlasData]
  );

  const filteredCollisionItems = useMemo(
    () => [...filteredBaseCollisionItems, ...stumpRenderItems],
    [filteredBaseCollisionItems, stumpRenderItems]
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    Object.entries(replacedObjectIds).forEach(([originalObjectId, replacementState]) => {
      const replacementItem = stumpRenderItems.find(
        (item) => item?.originalObjectId === originalObjectId
      );
      const originalMatched = layout.renderItems.some(
        (item) => item?.id === originalObjectId
      );
      const originalSkipped = !filteredBaseRenderItems.some(
        (item) => item?.id === originalObjectId
      );

      console.debug("[render-replacement-check]", {
        "did original item id match replacedObjectIds?": originalMatched,
        "was original skipped?": originalSkipped,
        "was stump item created?": Boolean(replacementItem),
        "stump item id": replacementItem?.id || replacementState?.stumpObjectId || null,
        "stump entry id": replacementItem?.entry?.id || null,
        "stump entry name": replacementItem?.entry?.name || null,
        "stump atlas x": replacementItem?.entry?.x ?? null,
        "stump atlas y": replacementItem?.entry?.y ?? null,
        "stump atlas width": replacementItem?.entry?.width ?? null,
        "stump atlas height": replacementItem?.entry?.height ?? null,
      });
    });
  }, [
    filteredBaseRenderItems,
    layout.renderItems,
    objectStateRevision,
    replacedObjectIds,
    stumpRenderItems,
  ]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    stumpRenderItems.forEach((item) => {
      console.debug("[stump-rendered]", {
        id: item.id,
        entryId: item.entry?.id || item.entry?.name || null,
        atlasX: item.entry?.x ?? null,
        atlasY: item.entry?.y ?? null,
        atlasWidth: item.entry?.width ?? null,
        atlasHeight: item.entry?.height ?? null,
        baseX: item.baseX ?? null,
        baseY: item.baseY ?? null,
      });
    });
  }, [stumpRenderItems]);


  const filteredTileChunks = useMemo(
    () =>
      Object.keys(brokenObjectIds).length === 0
        ? layout.tileChunks
        : layout.tileChunks.map((chunk) => ({
            ...chunk,
            tileBackItems: chunk.tileBackItems.filter((item) => !brokenObjectIds[item.id]),
            tileFrontItems: chunk.tileFrontItems.filter((item) => !brokenObjectIds[item.id]),
          })),
    [layout.tileChunks, brokenObjectIds]
  );

  const [staticBackItems, animatedBackItems, staticFrontItems, animatedFrontItems] =
    useMemo(() => {
      const nextStaticBackItems = [];
      const nextAnimatedBackItems = [];
      const nextStaticFrontItems = [];
      const nextAnimatedFrontItems = [];

      filteredRenderItems.forEach((item) => {
        const targetBackList = item.animation ? nextAnimatedBackItems : nextStaticBackItems;
        const targetFrontList = item.animation ? nextAnimatedFrontItems : nextStaticFrontItems;

        const isAtlasTree =
          item?.worldDecorFamily === "atlas_trees" ||
          item?.entry?.family === "atlas_trees";

        // Atlas trees and overlays render as a single full sprite in the front layer
        // (z=5), which sits above EntityLayer (z=3). No splitDepth, no clipPath.
        if (item.renderLayer === "overlay" || isAtlasTree) {
          targetFrontList.push(item);
          return;
        }

        targetBackList.push(item);

        if (item.splitDepth) {
          targetFrontList.push(item);
        }
      });

      return [
        nextStaticBackItems,
        nextAnimatedBackItems,
        nextStaticFrontItems,
        nextAnimatedFrontItems,
      ];
    }, [filteredRenderItems]);

  const hasAnimatedCanvasItems = filteredTileChunks.some(
    (chunk) =>
      chunk.animatedTileBackItems.length > 0 || chunk.animatedTileFrontItems.length > 0
  );

  const hasAnimatedItems =
    animatedBackItems.length > 0 ||
    animatedFrontItems.length > 0 ||
    (!isCanvasTerrainMode && hasAnimatedCanvasItems);
  const frameTick = useAtlasAnimationClock(hasAnimatedItems);

  const tileBackChunks = useMemo(
    () =>
      isCanvasTerrainMode
        ? []
        : filteredTileChunks.map((chunk) => (
            <ChunkTileLayer
              key={`tile_back_${chunk.key}`}
              chunk={chunk}
              atlasImage={theme.atlasImage}
              frameTick={chunk.animatedTileBackItems.length > 0 ? frameTick : 0}
            />
          )),
    [frameTick, isCanvasTerrainMode, filteredTileChunks, theme.atlasImage]
  );

  const tileFrontChunks = useMemo(
    () =>
      isCanvasTerrainMode
        ? []
        : filteredTileChunks.map((chunk) => (
            <ChunkTileLayer
              key={`tile_front_${chunk.key}`}
              chunk={chunk}
              atlasImage={theme.atlasImage}
              frameTick={chunk.animatedTileFrontItems.length > 0 ? frameTick : 0}
              front
            />
          )),
    [frameTick, isCanvasTerrainMode, filteredTileChunks, theme.atlasImage]
  );

  const [visibleVillageBackTiles, visibleVillageFrontTiles] = useMemo(() => {
    if (isCanvasTerrainMode) {
      return [[], []];
    }

    const worldBounds = getVillageViewportWorldBounds(
      cameraSample.worldOffset,
      viewport
    );
    const nextBackTiles = [];
    const nextFrontTiles = [];

    visitVillageRenderTiles(
      "back",
      (tileData) => {
        nextBackTiles.push(tileData);
      },
      { worldBounds }
    );
    visitVillageRenderTiles(
      "front",
      (tileData) => {
        nextFrontTiles.push(tileData);
      },
      { worldBounds }
    );

    return [nextBackTiles, nextFrontTiles];
  }, [
    cameraSample.worldOffset,
    isCanvasTerrainMode,
    viewport.height,
    viewport.width,
  ]);

  useEffect(() => {
    if (!isCanvasTerrainMode) {
      return undefined;
    }

    const backCanvas = backCanvasRef.current;
    const frontCanvas = frontCanvasRef.current;
    if (!backCanvas || !frontCanvas || !atlasImageElement) {
      return undefined;
    }

    const nextCanvasWidth = Math.max(1, Math.ceil(viewport.width));
const nextCanvasHeight = Math.max(1, Math.ceil(viewport.height));

if (backCanvas.width !== nextCanvasWidth) {
  backCanvas.width = nextCanvasWidth;
}
if (backCanvas.height !== nextCanvasHeight) {
  backCanvas.height = nextCanvasHeight;
}
if (frontCanvas.width !== nextCanvasWidth) {
  frontCanvas.width = nextCanvasWidth;
}
if (frontCanvas.height !== nextCanvasHeight) {
  frontCanvas.height = nextCanvasHeight;
}

    const backCtx = backCanvas.getContext("2d");
    const frontCtx = frontCanvas.getContext("2d");
    if (!backCtx || !frontCtx) {
      return undefined;
    }

    backCtx.imageSmoothingEnabled = false;
    frontCtx.imageSmoothingEnabled = false;

    let rafId = 0;
    let cancelled = false;
    let queued = false;
    let animationFrameTick = 0;

    const drawLayer = (ctx, side, nextWorldOffset, nextFrameTick) => {
      if (!atlasImageElement) {
        return;
      }
      const startedAt = performance.now();
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      filteredTileChunks.forEach((chunk) => {
        const staticCanvas = getOrCreateStaticChunkCanvas(
          chunk,
          side,
          atlasImageElement,
          chunkCanvasCacheRef.current
        );

        if (staticCanvas) {
          ctx.drawImage(
            staticCanvas,
            Math.round(
              chunk.bounds.left +
                viewport.width * 0.5 +
                (nextWorldOffset?.x || 0) -
                STATIC_CHUNK_CANVAS_PADDING
            ),
            Math.round(
              chunk.bounds.top +
                viewport.height * 0.5 +
                (nextWorldOffset?.y || 0) -
                STATIC_CHUNK_CANVAS_PADDING
            )
          );
        }

        const animatedItems =
          side === "front"
            ? chunk.animatedTileFrontItems
            : chunk.animatedTileBackItems;

        animatedItems.forEach((item) => {
          drawItemToCanvas(
            ctx,
            atlasImageElement,
            item,
            viewport,
            nextWorldOffset,
            nextFrameTick
          );
        });
      });

      drawVillagePassToCanvas(
        ctx,
        villageAtlasImageElement,
        side,
        viewport,
        nextWorldOffset
      );

      const durationMs = performance.now() - startedAt;
      if (debugFlags.showWorldPerfDebug) {
        if (side === "front") {
          canvasPerfAccumulatorRef.current.frontDrawCount += 1;
          canvasPerfAccumulatorRef.current.frontDrawDurationMs += durationMs;
        } else {
          canvasPerfAccumulatorRef.current.backDrawCount += 1;
          canvasPerfAccumulatorRef.current.backDrawDurationMs += durationMs;
        }
      }
    };

    // Throttle state for the DEV offset-sync log.
    let _lastSyncLogAt = 0;

    // Draw the canvas immediately with the given offset — no rAF deferral.
    // Called from the zustand subscription so it always uses the same offset
    // that was just applied to the DOM transforms (eliminating the 1-frame lag).
    const drawImmediate = (nextWorldOffset) => {
      if (cancelled) return;

      if (import.meta.env.DEV) {
        const domOffset = lastDOMTransformOffsetRef.current;
        if (domOffset !== null) {
          const delta = Math.max(
            Math.abs(nextWorldOffset.x - domOffset.x),
            Math.abs(nextWorldOffset.y - domOffset.y)
          );
          if (delta > 0.5) {
            const now = performance.now();
            if (now - _lastSyncLogAt > 500) {
              _lastSyncLogAt = now;
              console.log("[world-offset-sync]", {
                storeOffset: nextWorldOffset,
                terrainCanvasOffset: nextWorldOffset,
                domWorldOffset: domOffset,
                entityLayerOffset: "synchronized",
                resolvedOffset: nextWorldOffset,
                deltaBetweenLayers: delta,
              });
            }
          }
        }
      }

      drawLayer(backCtx, "back", nextWorldOffset, animationFrameTick);
      drawLayer(frontCtx, "front", nextWorldOffset, animationFrameTick);
    };

    // Deferred draw — used only for animation ticks and the initial paint.
    const draw = () => {
      queued = false;
      if (cancelled) return;
      drawImmediate(useWorldStore.getState().worldOffset || { x: 0, y: 0 });
    };

    const queueDraw = () => {
      if (queued || cancelled) return;
      queued = true;
      rafId = requestAnimationFrame(draw);
    };

    // Initial paint (deferred so canvas refs are guaranteed mounted).
    queueDraw();

    // On every worldOffset change: draw synchronously so canvas and DOM transforms
    // always use the exact same resolved offset in the same frame.
    const unsubscribe = useWorldStore.subscribe((state, previousState) => {
      if (state.worldOffset !== previousState.worldOffset) {
        drawImmediate(state.worldOffset || { x: 0, y: 0 });
      }
    });

    let animationIntervalId = 0;
    if (hasAnimatedCanvasItems) {
      animationIntervalId = window.setInterval(() => {
        animationFrameTick += 1;
        queueDraw(); // Animation ticks still deferred — timing precision not critical here.
      }, 125);
    }

    return () => {
      cancelled = true;
      unsubscribe();
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (animationIntervalId) {
        window.clearInterval(animationIntervalId);
      }
    };
  }, [
    atlasImageElement,
    debugFlags.showWorldPerfDebug,
    hasAnimatedCanvasItems,
    isCanvasTerrainMode,
    filteredTileChunks,
    villageAtlasImageElement,
    viewport.height,
    viewport.width,
  ]);

  const staticBackNodes = useMemo(
    () =>
      staticBackItems.map((item) =>
        (() => {
          const clipStyle = getSplitClipStyle(item, "back");
          maybeLogDecorClipDebug(item, clipStyle, 0);
          return renderAtlasItem(item, theme.atlasImage, 0, clipStyle);
        })()
      ),
    [staticBackItems, theme.atlasImage]
  );

  const animatedBackNodes = useMemo(
    () =>
      animatedBackItems.map((item) =>
        (() => {
          const clipStyle = getSplitClipStyle(item, "back");
          maybeLogDecorClipDebug(item, clipStyle, frameTick);
          return renderAtlasItem(item, theme.atlasImage, frameTick, clipStyle);
        })()
      ),
    [animatedBackItems, frameTick, theme.atlasImage]
  );

  const staticFrontNodes = useMemo(
    () =>
      staticFrontItems.map((item) =>
        (() => {
          const clipStyle = getSplitClipStyle(item, "front");
          maybeLogDecorClipDebug(item, clipStyle, 0);
          return renderAtlasItem(item, theme.atlasImage, 0, clipStyle);
        })()
      ),
    [staticFrontItems, theme.atlasImage]
  );

  const animatedFrontNodes = useMemo(
    () =>
      animatedFrontItems.map((item) =>
        (() => {
          const clipStyle = getSplitClipStyle(item, "front");
          maybeLogDecorClipDebug(item, clipStyle, frameTick);
          return renderAtlasItem(item, theme.atlasImage, frameTick, clipStyle);
        })()
      ),
    [animatedFrontItems, frameTick, theme.atlasImage]
  );

  const villageBackNodes = useMemo(
    () =>
      isCanvasTerrainMode
        ? []
        : visibleVillageBackTiles.map((tileData) =>
            renderVillageTileNode(tileData, villageAtlasImage)
          ),
    [isCanvasTerrainMode, villageAtlasImage, visibleVillageBackTiles]
  );

  const villageFrontNodes = useMemo(
    () =>
      isCanvasTerrainMode
        ? []
        : visibleVillageFrontTiles.map((tileData) =>
            renderVillageTileNode(tileData, villageAtlasImage)
          ),
    [isCanvasTerrainMode, villageAtlasImage, visibleVillageFrontTiles]
  );


  const decorLabelRenderLimit = Math.max(
    0,
    Number.isFinite(Number(decorSettings?.labelRenderLimit))
      ? Number(decorSettings.labelRenderLimit)
      : 0
  );
  const visibleDecorDebugItems = useMemo(() => {
    if (
      !import.meta.env.DEV ||
      (!debugFlags.showWorldDebugOverlay &&
        !debugFlags.showWorldDecorDebug &&
        !debugFlags.showWorldDecorBoundsDebug &&
        !debugFlags.showWorldItemBoundsDebug)
    ) {
      return [];
    }

    const worldBounds =
      layout.debug?.despawnBounds ||
      layout.debug?.activeBounds || {
        left: playerX - viewport.width * 0.5 - WORLD_ATLAS_TILE_SIZE * 2,
        right: playerX + viewport.width * 0.5 + WORLD_ATLAS_TILE_SIZE * 2,
        top: playerY - viewport.height * 0.5 - WORLD_ATLAS_TILE_SIZE * 2,
        bottom: playerY + viewport.height * 0.5 + WORLD_ATLAS_TILE_SIZE * 2,
      };

    const items = [];
    const maybePushItem = (item) => {
      const bounds = getRenderItemBounds(item, item.animation ? frameTick : 0);
      if (
        bounds.left > worldBounds.right ||
        bounds.left + bounds.width < worldBounds.left ||
        bounds.top > worldBounds.bottom ||
        bounds.top + bounds.height < worldBounds.top
      ) {
        return;
      }

      items.push(item);
    };

    layout.tileChunks.forEach((chunk) => {
      [
        chunk.tileBackItems,
        chunk.tileFrontItems,
        chunk.animatedTileBackItems,
        chunk.animatedTileFrontItems,
      ].forEach((group) => {
        group.forEach((item) => {
          if (isMetadataDebugItem(item) || isLegacyDecorDebugItem(item)) {
            maybePushItem(item);
          }
        });
      });
    });

    layout.renderItems.forEach((item) => {
      if (isMetadataDebugItem(item) || isLegacyDecorDebugItem(item)) {
        maybePushItem(item);
      }
    });

    return items;
  }, [
    debugFlags.showWorldDebugOverlay,
    debugFlags.showWorldDecorBoundsDebug,
    debugFlags.showWorldDecorDebug,
    debugFlags.showWorldItemBoundsDebug,
    frameTick,
    layout.debug?.activeBounds,
    layout.debug?.despawnBounds,
    layout.renderItems,
    layout.tileChunks,
    playerX,
    playerY,
    viewport.height,
    viewport.width,
  ]);
  const visibleWorldDecorSummary = useMemo(() => {
    if (!visibleDecorDebugItems.length) {
      return null;
    }

    const metadataItems = visibleDecorDebugItems.filter(isMetadataDebugItem);
    const legacyObjectItems = visibleDecorDebugItems.filter(isLegacyDecorDebugItem);
    const familyCounts = {};
    const terrainCounts = {};
    const chunkCounts = {};

    visibleDecorDebugItems.forEach((item) => {
      const familyId =
        item.worldDecorFamily ||
        item.entry?.family ||
        item.entry?.group ||
        item.entry?.name ||
        "unknown";
      const terrainType = item.sourceTerrainType || item.terrainType || "unknown";
      const chunkKey = getItemChunkKey(item);

      familyCounts[familyId] = (familyCounts[familyId] || 0) + 1;
      terrainCounts[terrainType] = (terrainCounts[terrainType] || 0) + 1;
      chunkCounts[chunkKey] = (chunkCounts[chunkKey] || 0) + 1;
    });

    const topChunkCounts = Object.entries(chunkCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return {
      metadataDecorCount: metadataItems.filter((item) => !item.isWorldMetadataAnimation).length,
      animationCount: metadataItems.filter((item) => item.isWorldMetadataAnimation).length,
      objectCount: legacyObjectItems.length,
      familyCounts,
      terrainCounts,
      chunkCounts: topChunkCounts,
      maxItemsPerVisibleChunk: Math.max(0, ...Object.values(chunkCounts)),
      visibleWindowCount: visibleDecorDebugItems.length,
      collisionCount: layout.collisionItems.length,
      budget: layout.debug?.visibleDecorBudget || null,
    };
  }, [layout.collisionItems.length, layout.debug?.visibleDecorBudget, visibleDecorDebugItems]);
  const collisionDebugItems = useMemo(() => {
    if (Array.isArray(filteredCollisionItems) && filteredCollisionItems.length > 0) {
      return filteredCollisionItems.filter((item) => item?.blocksMovement && item?.collisionBox);
    }

    return filteredRenderItems.filter((item) => item?.blocksMovement && item?.collisionBox);
  }, [filteredCollisionItems, filteredRenderItems]);

  useEffect(() => {
    if (!import.meta.env.DEV || !collisionRectsOnlyMode) {
      return undefined;
    }

    const logSummary = () => {
      const sample = collisionDebugItems.slice(0, 4).map((item) => ({
        id: item.id,
        family:
          item.worldDecorFamily ||
          item.entry?.family ||
          item.entry?.group ||
          item.entry?.name ||
          "unknown",
        bounds: getWorldAtlasCollisionBounds(item),
      }));

      console.debug("[collision-rects]", {
        count: collisionDebugItems.length,
        sample,
      });
    };

    logSummary();
    const intervalId = window.setInterval(logSummary, 2000);
    return () => window.clearInterval(intervalId);
  }, [collisionDebugItems, collisionRectsOnlyMode]);
  const labeledDecorDebugIds = useMemo(() => {
    if (!debugFlags.showWorldDecorLabelsDebug || decorLabelRenderLimit <= 0) {
      return new Set();
    }

    return new Set(
      visibleDecorDebugItems
        .slice(0, decorLabelRenderLimit)
        .map((item) => item.id)
    );
  }, [
    debugFlags.showWorldDecorLabelsDebug,
    decorLabelRenderLimit,
    visibleDecorDebugItems,
  ]);
  const worldDecorBoundsDebugNodes = useMemo(() => {
    if (
      !import.meta.env.DEV ||
      collisionRectsOnlyMode ||
      (!debugFlags.showWorldDecorBoundsDebug && !debugFlags.showWorldItemBoundsDebug)
    ) {
      return null;
    }

    return visibleDecorDebugItems.map((item) => {
      const bounds = getRenderItemBounds(item, item.animation ? frameTick : 0);
      const color = getDecorDebugColor(item);
      const label = `${getDecorDebugLabel(item)} ${Math.max(
        0.1,
        item.scale || 1
      ).toFixed(2)}x @ ${getItemChunkKey(item)}`;
      const shouldShowLabel = labeledDecorDebugIds.has(item.id);

      return (
        <div
          key={`world_decor_bounds_${item.id}`}
          style={{
            position: "absolute",
            left: bounds.left,
            top: bounds.top,
            width: Math.max(1, bounds.width),
            height: Math.max(1, bounds.height),
            border: `3px solid ${color}`,
            boxShadow: `0 0 0 1px rgba(0, 0, 0, 0.92), 0 0 12px ${color.replace("0.96", "0.45").replace("0.98", "0.5")}`,
            background: "transparent",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        >
          {shouldShowLabel ? (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: "translateY(-100%)",
                padding: "1px 3px",
                fontSize: 9,
                lineHeight: 1.2,
                color: "#ffffff",
                background: "rgba(0,0,0,0.72)",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </div>
          ) : null}
        </div>
      );
    });
  }, [
    collisionRectsOnlyMode,
    debugFlags.showWorldDecorBoundsDebug,
    debugFlags.showWorldItemBoundsDebug,
    frameTick,
    labeledDecorDebugIds,
    visibleDecorDebugItems,
  ]);
  const waterCollisionDebugNodes = useMemo(() => {
    if (!import.meta.env.DEV || collisionRectsOnlyMode || !debugFlags.showWaterCollisionDebug) {
      return null;
    }

    const visibleBounds =
      layout.debug?.activeBounds ||
      layout.debug?.despawnBounds ||
      null;
    const waterItems = [];
    layout.tileChunks.forEach((chunk) => {
      [chunk.tileBackItems, chunk.tileFrontItems].forEach((group) => {
        group.forEach((item) => {
          if (item.terrainType === "water") {
            const centerX = item.x + item.renderWidth * 0.5;
            const centerY = item.y + item.renderHeight * 0.5;
            if (visibleBounds && !boundsContainPoint(visibleBounds, centerX, centerY)) {
              return;
            }
            waterItems.push(item);
          }
        });
      });
    });

    return waterItems.map((item) => {
      const bounds = getRenderItemBounds(item, 0);

      return (
        <div
          key={`water_collision_${item.id}`}
          style={{
            position: "absolute",
            left: bounds.left,
            top: bounds.top,
            width: Math.max(1, bounds.width),
            height: Math.max(1, bounds.height),
            border: "2px solid rgba(72, 146, 255, 0.98)",
            boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.88), 0 0 8px rgba(72, 146, 255, 0.55)",
            background: "rgba(72, 146, 255, 0.14)",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        />
      );
    });
  }, [
    collisionRectsOnlyMode,
    debugFlags.showWaterCollisionDebug,
    layout.debug?.activeBounds,
    layout.debug?.despawnBounds,
    layout.tileChunks,
  ]);
  const collisionDebugNodes = useMemo(() => {
    if (!import.meta.env.DEV || !showCollisionBounds) {
      return null;
    }

    return collisionDebugItems.flatMap((item) => {
      const entryId = item.entry?.id || item.entry?.name || "?";
      const colSrc = item.entry?.collisionBox
        ? "json"
        : item.collisionBoxSource || "fallback";

      // Sprite / render bounds — green
      const rb = getRenderItemBounds(item, 0);
      const spriteBounds = projectWorldBoundsToScreen(
        { left: rb.left, top: rb.top, right: rb.left + rb.width, bottom: rb.top + rb.height },
        normalizedViewportFrame,
        cameraSample.worldOffset
      );

      // Gameplay collision bounds — red
      const colBounds = projectWorldBoundsToScreen(
        getWorldAtlasCollisionBounds(item),
        normalizedViewportFrame,
        cameraSample.worldOffset
      );

      const labelStyle = {
        position: "absolute",
        bottom: "100%",
        left: 0,
        padding: "1px 3px",
        fontSize: 7,
        lineHeight: 1.3,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        background: "rgba(0,0,0,0.82)",
      };

      return [
        <div
          key={`render_${item.id}`}
          style={{
            position: "absolute",
            left: spriteBounds.left,
            top: spriteBounds.top,
            width: Math.max(1, spriteBounds.width),
            height: Math.max(1, spriteBounds.height),
            border: "2px solid rgba(80, 220, 80, 0.85)",
            boxSizing: "border-box",
            pointerEvents: "none",
            zIndex: 40,
          }}
        >
          <div style={{ ...labelStyle, color: "#80ff80" }}>
            {`render bounds | ${entryId}`}
          </div>
        </div>,
        <div
          key={`col_${item.id}`}
          style={{
            position: "absolute",
            left: colBounds.left,
            top: colBounds.top,
            width: Math.max(1, colBounds.width),
            height: Math.max(1, colBounds.height),
            border: "3px solid rgba(255, 40, 40, 0.99)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.96), 0 0 10px rgba(255,40,40,0.6)",
            background: "rgba(255, 0, 0, 0.12)",
            boxSizing: "border-box",
            pointerEvents: "none",
            zIndex: 41,
          }}
        >
          <div style={{ ...labelStyle, color: "#ff9090" }}>
            {`collision | ${item.id} | src=${colSrc}`}
          </div>
        </div>,
      ];
    });
  }, [
    cameraSample.worldOffset,
    collisionDebugItems,
    normalizedViewportFrame,
    showCollisionBounds,
  ]);
  const petCollisionDebugNode = useMemo(() => {
    if (!import.meta.env.DEV || !showCollisionBounds) {
      return null;
    }

    const petBounds = getPetCollisionBounds({ x: 0, y: 0 });

    return (
      <div
        key="pet_collision_footprint"
        style={{
          position: "absolute",
          left: Math.round(normalizedViewportFrame.centerX + petBounds.left),
          top: Math.round(normalizedViewportFrame.centerY + petBounds.top),
          width: petBounds.right - petBounds.left,
          height: petBounds.bottom - petBounds.top,
          border: "3px solid rgba(255, 162, 54, 0.99)",
          boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.94), 0 0 10px rgba(255, 162, 54, 0.55)",
          background: "rgba(255, 162, 54, 0.14)",
          boxSizing: "border-box",
          pointerEvents: "none",
          zIndex: 41,
        }}
      />
    );
  }, [normalizedViewportFrame.centerX, normalizedViewportFrame.centerY, showCollisionBounds]);
  const viewportCullingDebugNodes = useMemo(() => {
    if (
      !import.meta.env.DEV ||
      collisionRectsOnlyMode ||
      (!debugFlags.showWorldSpawnRadiusDebug &&
        !debugFlags.showViewportCullingDebug &&
        !debugFlags.showSpawnDespawnBufferDebug)
    ) {
      return null;
    }

    const makeBoundsRect = (bounds, color, label, dashed = false) => {
      if (!bounds) return null;

      return (
        <div
          key={label}
          style={{
            position: "absolute",
            left: bounds.left,
            top: bounds.top,
            width: Math.max(1, bounds.right - bounds.left),
            height: Math.max(1, bounds.bottom - bounds.top),
            border: `${dashed ? 2 : 3}px ${dashed ? "dashed" : "solid"} ${color}`,
            boxShadow: `0 0 0 1px rgba(0, 0, 0, 0.9), 0 0 10px ${color.replace("0.96", "0.4").replace("0.92", "0.35")}`,
            background: "transparent",
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        >
          {debugFlags.showWorldDecorLabelsDebug ? (
            <div
              style={{
                position: "absolute",
                left: 6,
                top: 6,
                padding: "1px 4px",
                fontSize: 10,
                lineHeight: 1.2,
                color: "#ffffff",
                background: "rgba(0,0,0,0.72)",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </div>
          ) : null}
        </div>
      );
    };

    return [
      makeBoundsRect(layout.debug?.despawnBounds, "rgba(255, 215, 80, 0.92)", "despawn buffer", true),
      makeBoundsRect(layout.debug?.activeBounds, "rgba(120, 255, 160, 0.96)", "active buffer", true),
      makeBoundsRect(layout.debug?.viewportBounds, "rgba(255, 255, 255, 0.96)", "viewport"),
    ].filter(Boolean);
  }, [
    collisionRectsOnlyMode,
    debugFlags.showSpawnDespawnBufferDebug,
    debugFlags.showViewportCullingDebug,
    debugFlags.showWorldDecorLabelsDebug,
    debugFlags.showWorldSpawnRadiusDebug,
    layout.debug?.activeBounds,
    layout.debug?.despawnBounds,
    layout.debug?.viewportBounds,
  ]);
  const terrainDebugText = useMemo(() => {
    if (!import.meta.env.DEV) return null;
    if (collisionRectsOnlyMode) return null;
    if (
      !SHOW_TERRAIN_TYPE_DEBUG &&
      !SHOW_AUTOTILE_CATEGORY_DEBUG &&
      !debugFlags.showWaterCollisionDebug &&
      !SHOW_OBJECT_SPAWN_DEBUG &&
      !debugFlags.showWorldDecorDebug
    ) {
      return null;
    }

    const lines = [];
    const playerTerrain = layout.debug?.playerTerrain;
    const objectSpawnStats = layout.debug?.objectSpawnStats;
    const worldDecorStats = layout.debug?.worldDecorStats;

    if (SHOW_TERRAIN_TYPE_DEBUG && playerTerrain) {
      lines.push(
        `terrain ${playerTerrain.terrainType} @ ${playerTerrain.gridX},${playerTerrain.gridY}`
      );
    }

    if (SHOW_AUTOTILE_CATEGORY_DEBUG && playerTerrain) {
      lines.push(
        `autotile ${playerTerrain.category}/${playerTerrain.patternId || "full"}`
      );
    }

    if (debugFlags.showWaterCollisionDebug && playerTerrain) {
      lines.push(`walkable ${playerTerrain.walkable ? "yes" : "no"}`);
    }

    if (SHOW_OBJECT_SPAWN_DEBUG && objectSpawnStats) {
      lines.push(
        `spawn placed ${objectSpawnStats.placed}/${objectSpawnStats.attempted}`
      );
      lines.push(
        `reject water ${objectSpawnStats.rejected?.water || 0} | non_full ${
          objectSpawnStats.rejected?.non_full_autotile || 0
        }`
      );
      lines.push(
        `reject overlap ${objectSpawnStats.rejected?.collision_overlap || 0} | invalid ${
          objectSpawnStats.rejected?.invalid_terrain || 0
        }`
      );
    }

    if (debugFlags.showWorldDecorDebug && worldDecorStats) {
      const sparkleCount = getWorldSparkleCount(worldDecorStats);
      const fountainCount = worldDecorStats.byFamily?.fountain_loop?.placed || 0;
      const treeScaleAverage =
        worldDecorStats.treeCount > 0
          ? worldDecorStats.treeScaleTotal / worldDecorStats.treeCount
          : 0;

      lines.push(
        `decor ${worldDecorStats.totalPlaced} | sparkle ${sparkleCount} | fountain ${fountainCount}`
      );
      lines.push(
        `water ${worldDecorStats.waterCellCount || 0} | full ${worldDecorStats.fullWaterCellCount || 0} | lakes ${
          worldDecorStats.waterPatchCount || 0
        }`
      );
      lines.push(
        `tree ${worldDecorStats.treeCount || 0} @ ${treeScaleAverage.toFixed(
          2
        )}x`
      );
      lines.push(
        `decor reject close ${worldDecorStats.rejected?.too_close || 0} | non_full ${
          worldDecorStats.rejected?.non_full_autotile || 0
        }`
      );
      lines.push(
        `decor reject overlap ${worldDecorStats.rejected?.overlap || 0} | cap ${
          (worldDecorStats.rejected?.chunk_total_cap || 0) +
          (worldDecorStats.rejected?.chunk_animation_cap || 0) +
          (worldDecorStats.rejected?.window_cap || 0)
        }`
      );
      lines.push(
        `decor candidates ${worldDecorStats.candidateAttempts || 0} | exact overlap ${
          worldDecorStats.exactOverlapChecks || 0
        } | occupied ${worldDecorStats.occupiedCellCount || 0}`
      );
      lines.push(
        `decor skip empty ${worldDecorStats.skipped?.empty_pool || 0} | occupied ${
          worldDecorStats.skipped?.occupied_pool || 0
        } | budget ${worldDecorStats.skipped?.budget || 0}`
      );

      if (visibleWorldDecorSummary) {
        const visibleBudget = visibleWorldDecorSummary.budget;
        lines.push(
          `visible meta ${visibleWorldDecorSummary.metadataDecorCount} | anim ${visibleWorldDecorSummary.animationCount}`
        );
        lines.push(
          `visible objects ${visibleWorldDecorSummary.objectCount} | collision ${visibleWorldDecorSummary.collisionCount}`
        );
        lines.push(
          `visible terrain ${Object.entries(visibleWorldDecorSummary.terrainCounts)
            .map(([terrain, count]) => `${terrain}:${count}`)
            .join(" | ")}`
        );
        lines.push(
          `visible family ${Object.entries(visibleWorldDecorSummary.familyCounts)
            .map(([family, count]) => `${family}:${count}`)
            .join(" | ")}`
        );
        lines.push(
          `visible chunk max ${visibleWorldDecorSummary.maxItemsPerVisibleChunk} | window ${visibleWorldDecorSummary.visibleWindowCount}`
        );
        lines.push(
          `chunk top ${visibleWorldDecorSummary.chunkCounts
            .map(([chunkKey, count]) => `${chunkKey}:${count}`)
            .join(" | ")}`
        );
        if (visibleBudget) {
          lines.push(
            `budget skip distance ${visibleBudget.skippedByDistance || 0} | budget ${
              visibleBudget.skippedByBudget || 0
            } | family ${visibleBudget.skippedByFamilyCap || 0} | nearby ${
              visibleBudget.skippedByNearby || 0
            }`
          );
          lines.push(
            `viewport ${visibleBudget.viewportItemCount || 0} | buffer ${
              visibleBudget.bufferItemCount || 0
            } | culled ${visibleBudget.culledItemCount || 0}`
          );
          lines.push(
            `active buffer ${visibleBudget.activeBufferTiles} | despawn ${visibleBudget.despawnBufferTiles}`
          );
        }
      }

      if (layout.debug?.playerChunk && layout.debug?.activeChunkRange) {
        lines.push(
          `player chunk ${layout.debug.playerChunk.x},${layout.debug.playerChunk.y} | active ${layout.debug.activeChunkRange.minChunkX},${layout.debug.activeChunkRange.minChunkY} -> ${layout.debug.activeChunkRange.maxChunkX},${layout.debug.activeChunkRange.maxChunkY}`
        );
      }
    }

    return lines.length ? lines.join("\n") : null;
  }, [
    collisionRectsOnlyMode,
    debugFlags.showWaterCollisionDebug,
    debugFlags.showWorldDecorDebug,
    layout.debug,
    visibleWorldDecorSummary,
  ]);
    const worldFrameStyle = useMemo(
    () => ({
      position: "absolute",
      left: normalizedViewportFrame.left,
      top: normalizedViewportFrame.top,
      width: normalizedViewportFrame.width,
      height: normalizedViewportFrame.height,
      // overflow:hidden (not clipPath) so this div does NOT create a CSS stacking
      // context — the inner z=0 (back) and z=5 (front) divs participate in the
      // parent stacking context alongside EntityLayer (z=3).
      overflow: "hidden",
      pointerEvents: "none",
    }),
    [
      normalizedViewportFrame.height,
      normalizedViewportFrame.left,
      normalizedViewportFrame.top,
      normalizedViewportFrame.width,
    ]
  );

  useEffect(() => {
    chunkCanvasCacheRef.current.clear();
  }, [theme.atlasImage]);

  return (
    <div
      data-world-atlas-layer
      data-world-theme={theme.id}
      data-world-render-mode={WORLD_RENDER_MODE}
      style={ROOT_STYLE}
    >
      <div style={worldFrameStyle}>
        <div style={{ ...LAYER_STYLE, zIndex: 0 }}>
          {isCanvasTerrainMode ? (
            <>
              <canvas
                ref={backCanvasRef}
                data-world-terrain-canvas="back"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  imageRendering: "pixelated",
                  pointerEvents: "none",
                }}
              />
              <div
                ref={backWorldRef}
                style={createLocalWorldTransform(viewport, cameraSample.worldOffset)}
              >
                {staticBackNodes}
                {animatedBackNodes}
              </div>
            </>
          ) : (
            <div
              ref={backWorldRef}
              style={createLocalWorldTransform(viewport, cameraSample.worldOffset)}
            >
              {/* {tileBackChunks} */}
              {villageBackNodes}
              {staticBackNodes}
              {animatedBackNodes}
            </div>
          )}
        </div>

        <div style={{ ...LAYER_STYLE, zIndex: 5 }}>
          {isCanvasTerrainMode ? (
            <>
              <canvas
                ref={frontCanvasRef}
                data-world-terrain-canvas="front"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  imageRendering: "pixelated",
                  pointerEvents: "none",
                }}
              />
              <div
                ref={frontWorldRef}
                style={createLocalWorldTransform(viewport, cameraSample.worldOffset)}
              >
                {staticFrontNodes}
                {animatedFrontNodes}
              </div>
            </>
          ) : (
            <div
              ref={frontWorldRef}
              style={createLocalWorldTransform(viewport, cameraSample.worldOffset)}
            >
              {/* {tileFrontChunks} */}
              {villageFrontNodes}
              {staticFrontNodes}
              {animatedFrontNodes}
            </div>
          )}
        </div>
      </div>

      <div style={{ ...LAYER_STYLE, zIndex: 8 }}>
        <div
          ref={debugWorldRef}
          style={createScreenWorldTransform(normalizedViewportFrame, cameraSample.worldOffset)}
        >
          {viewportCullingDebugNodes}
          {worldDecorBoundsDebugNodes}
          {waterCollisionDebugNodes}
        </div>
      </div>

      {showCollisionBounds ? (
        <div style={{ ...LAYER_STYLE, zIndex: 40 }}>
          {collisionDebugNodes}
          {petCollisionDebugNode}
        </div>
      ) : null}

      {!collisionRectsOnlyMode && SHOW_WORLD_STREAMING_DEBUG && layout.debug ? (
        <div
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            zIndex: 20,
            padding: "8px 10px",
            background: "rgba(0, 0, 0, 0.72)",
            color: "#ffffff",
            fontSize: 10,
            lineHeight: 1.5,
            whiteSpace: "pre-line",
          }}
        >
          {`chunk ${layout.debug.chunkTileSize}t\nactive ${layout.debug.activeChunkCount}\npreload ${layout.debug.preloadChunkCount}\ncached ${layout.debug.cachedChunkCount}\nrendered ${layout.debug.renderedItemCount}\ntiles ${layout.debug.renderedTileItemCount || 0}\nfloat ${layout.debug.renderedFloatingItemCount || 0}\ncollision ${layout.debug.collisionItemCount}\nbatch ${streamingDebug?.generatedCount || 0}/${streamingDebug?.missingCount || 0}\nbatch ms ${streamingDebug?.durationMs?.toFixed?.(1) || "0.0"}`}
        </div>
      ) : null}

      {terrainDebugText ? (
        <div
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            zIndex: 20,
            padding: "8px 10px",
            background: "rgba(0, 0, 0, 0.72)",
            color: "#ffffff",
            fontSize: 10,
            lineHeight: 1.5,
            whiteSpace: "pre-line",
          }}
        >
          {terrainDebugText}
        </div>
      ) : null}

      {debugFlags.showWorldDebugOverlay && !collisionRectsOnlyMode ? (
        <WorldDebugOverlay
          layoutDebug={layout.debug}
          visibleWorldDecorSummary={visibleWorldDecorSummary}
          renderPerf={renderPerf}
          canvasPerf={canvasPerf}
          invalidCanvasDrawCount={_invalidCanvasDrawCount}
        />
      ) : null}
    </div>
  );
}
