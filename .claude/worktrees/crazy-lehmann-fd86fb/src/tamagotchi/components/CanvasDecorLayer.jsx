import React, { useRef, useEffect, useState, useMemo } from "react";
import { useWorldStore } from "../store/worldSlice";
import {
  getTreesAround,
  getGrassAround,
  getRocksAround,
  getFlowersAround,
} from "../utils/decorGenerator";

import tree1 from "../../spritesheets/trees/tree1.webp";
import tree2 from "../../spritesheets/trees/tree2.webp";
import tree3 from "../../spritesheets/trees/tree3.webp";
import tree4 from "../../spritesheets/trees/tree4.webp";
import tree5 from "../../spritesheets/trees/tree5.webp";
import tree6 from "../../spritesheets/trees/tree6.webp";
import tree7 from "../../spritesheets/trees/tree7.webp";
import tree8 from "../../spritesheets/trees/tree8.webp";

import grass1 from "../../spritesheets/bushes-grass/grass1.webp";
import grass2 from "../../spritesheets/bushes-grass/grass2.webp";
import grass3 from "../../spritesheets/bushes-grass/grass3.webp";
import grass4 from "../../spritesheets/bushes-grass/grass4.webp";
import grass5 from "../../spritesheets/bushes-grass/grass5.webp";
import grass6 from "../../spritesheets/bushes-grass/grass6.webp";
import grass7 from "../../spritesheets/bushes-grass/grass7.webp";

import bigrock1 from "../../spritesheets/rocks/bigrock1.webp";
import rock1 from "../../spritesheets/rocks/rock1.webp";
import rock2 from "../../spritesheets/rocks/rock2.webp";

import flower1 from "../../spritesheets/flowers/flower1.webp";
import flower2 from "../../spritesheets/flowers/flower2.webp";
import flower3 from "../../spritesheets/flowers/flower3.webp";
import flower4 from "../../spritesheets/flowers/flower4.webp";
import flower5 from "../../spritesheets/flowers/flower5.webp";
import flower6 from "../../spritesheets/flowers/flower6.webp";
import flower7 from "../../spritesheets/flowers/flower7.webp";

const TREE_ASSETS   = [tree1, tree2, tree3, tree4, tree5, tree6, tree7, tree8];
const GRASS_ASSETS  = [grass1, grass2, grass3, grass4, grass5, grass6, grass7];
const ROCK_ASSETS   = [bigrock1, rock1, rock2];
const FLOWER_ASSETS = [flower1, flower2, flower3, flower4, flower5, flower6, flower7];

// 65 % from the top of each tree sprite belongs to the front layer (above entities).
// The bottom 35 % is the back layer (behind entities).
const TREE_DEPTH_SPLIT = 0.65;

// ─── image cache ─────────────────────────────────────────────────────────────
// Module-level so it survives hot-reload and component re-mounts.
const imgCache = new Map();

function getCachedImg(src) {
  if (!imgCache.has(src)) {
    const img = new Image();
    img.src = src;
    imgCache.set(src, img);
  }
  return imgCache.get(src);
}

// Kick off loads as soon as the module is parsed.
[...TREE_ASSETS, ...GRASS_ASSETS, ...ROCK_ASSETS, ...FLOWER_ASSETS].forEach(getCachedImg);

function isReady(img) {
  return img.complete && img.naturalWidth > 0;
}

// ─── draw helpers ─────────────────────────────────────────────────────────────

/**
 * Draw a single decor item onto ctx.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {object} item         - decor item from decorGenerator
 * @param {number} ox           - canvas-space anchor X (bottom-center of sprite)
 * @param {number} oy           - canvas-space anchor Y (bottom-center of sprite)
 * @param {number} clipFromTop  - fraction [0-1] of sprite height to hide from the top
 * @param {number} clipFromBot  - fraction [0-1] of sprite height to hide from the bottom
 */
function drawItem(ctx, img, item, ox, oy, clipFromTop = 0, clipFromBot = 0) {
  // Guard: image must be fully loaded and have valid dimensions.
  if (!isReady(img)) return;

  const sw = item.width  * item.scale;
  const sh = item.height * item.scale;

  // Guard: reject degenerate / NaN / Infinity values that cause black rects.
  if (!(sw > 0) || !(sh > 0)) return;

  // Bottom-center anchor → top-left draw position
  const dx = ox - sw / 2;
  const dy = oy - sh;

  const needsClip = clipFromTop > 0 || clipFromBot > 0;

  ctx.save();

  if (needsClip) {
    const y0 = dy + sh * clipFromTop;
    const y1 = dy + sh * (1 - clipFromBot);

    // Guard: clip band must have positive height.
    if (y1 <= y0) {
      ctx.restore();
      return;
    }

    ctx.beginPath();
    // Only Y-axis clipping matters; use a very wide rect to avoid side-clipping
    // on large or off-center sprites.
    ctx.rect(-1e6, y0, 2e6, y1 - y0);
    ctx.clip();
  }

  if (item.flip) {
    // Reflect horizontally around the anchor column.
    // ctx.transform(-1, 0, 0, 1, 2*ox, 0)  maps  x → -x + 2*ox
    ctx.transform(-1, 0, 0, 1, 2 * ox, 0);
  }

  ctx.drawImage(img, dx, dy, sw, sh);
  ctx.restore();
}

/**
 * Draw a full array of decor items, all with the same clip fractions.
 */
function drawLayer(ctx, items, assets, w, h, worldOffset, clipFromTop, clipFromBot) {
  const halfW = w / 2;
  const halfH = h / 2;
  const offX  = worldOffset?.x ?? 0;
  const offY  = worldOffset?.y ?? 0;

  for (const item of items) {
    const img     = getCachedImg(assets[item.spriteIndex % assets.length]);
    const originX = halfW + item.x + offX;
    const originY = halfH + item.y + offY;
    drawItem(ctx, img, item, originX, originY, clipFromTop, clipFromBot);
  }
}

/**
 * Resize canvas only when needed (setting canvas.width always clears it),
 * then clear and return the 2d context configured for pixel art.
 */
function prepareCtx(canvas, w, h) {
  if (canvas.width !== w)  canvas.width  = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

// ─── component ───────────────────────────────────────────────────────────────

const CANVAS_STYLE = {
  position:        "absolute",
  inset:           0,
  width:           "100%",
  height:          "100%",
  pointerEvents:   "none",
  imageRendering:  "pixelated",
};

export default function CanvasDecorLayer() {
  const backRef  = useRef(null);
  const frontRef = useRef(null);

  // Actual pixel dimensions of the canvas element (updated by ResizeObserver).
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Incremented whenever a pending image finishes loading so the draw
  // effect re-runs and fills in sprites that were skipped on the first pass.
  const [imgVersion, setImgVersion] = useState(0);

  const worldOffset = useWorldStore((s) => s.worldOffset);

  // ── size tracking ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = backRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      if (w > 0 && h > 0) {
        setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── image load tracking ───────────────────────────────────────────────────
  useEffect(() => {
    const allSrcs = [...TREE_ASSETS, ...GRASS_ASSETS, ...ROCK_ASSETS, ...FLOWER_ASSETS];
    const pending = allSrcs.map(getCachedImg).filter((img) => !isReady(img));
    if (pending.length === 0) return;

    let alive = true;
    const onLoad = () => { if (alive) setImgVersion((v) => v + 1); };
    pending.forEach((img) => img.addEventListener("load", onLoad, { once: true }));
    return () => {
      alive = false;
      pending.forEach((img) => img.removeEventListener("load", onLoad));
    };
  }, []);

  // ── decor data ─────────────────────────────────────────────────────────────
  const playerX = -(worldOffset?.x ?? 0);
  const playerY = -(worldOffset?.y ?? 0);

  const trees   = useMemo(() => getTreesAround(playerX, playerY),   [playerX, playerY]);
  const grass   = useMemo(() => getGrassAround(playerX, playerY),   [playerX, playerY]);
  const rocks   = useMemo(() => getRocksAround(playerX, playerY),   [playerX, playerY]);
  const flowers = useMemo(() => getFlowersAround(playerX, playerY), [playerX, playerY]);

  // ── draw ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const { w, h } = size;
    if (!w || !h) return;

    const backCanvas  = backRef.current;
    const frontCanvas = frontRef.current;
    if (!backCanvas || !frontCanvas) return;

    // ── back layer: flowers, grass, rocks, tree trunks/roots ──────────────
    const backCtx = prepareCtx(backCanvas, w, h);
    drawLayer(backCtx, flowers, FLOWER_ASSETS, w, h, worldOffset, 0, 0);
    drawLayer(backCtx, grass,   GRASS_ASSETS,  w, h, worldOffset, 0, 0);
    drawLayer(backCtx, rocks,   ROCK_ASSETS,   w, h, worldOffset, 0, 0);
    // Trees back: hide the top TREE_DEPTH_SPLIT fraction → show only the base
    drawLayer(backCtx, trees, TREE_ASSETS, w, h, worldOffset, TREE_DEPTH_SPLIT, 0);

    // ── front layer: tree canopies ─────────────────────────────────────────
    const frontCtx = prepareCtx(frontCanvas, w, h);
    // Trees front: hide the bottom (1 - TREE_DEPTH_SPLIT) → show only the top
    drawLayer(frontCtx, trees, TREE_ASSETS, w, h, worldOffset, 0, 1 - TREE_DEPTH_SPLIT);

  }, [worldOffset, trees, grass, rocks, flowers, size, imgVersion]);

  return (
    <>
      <canvas ref={backRef}  style={{ ...CANVAS_STYLE, zIndex: 1 }} />
      <canvas ref={frontRef} style={{ ...CANVAS_STYLE, zIndex: 3 }} />
    </>
  );
}
