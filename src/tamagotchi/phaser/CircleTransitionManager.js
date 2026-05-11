import { CIRCLE_TRANSITION_DEPTH } from './renderDepths';

// ─── Dither config ────────────────────────────────────────────────────────────
// All values are in screen pixels (before any device-pixel-ratio scaling).

/** Enable/disable the pixel-art dither edge entirely. */
const IRIS_DITHER_ENABLED = true;

/**
 * Quantization grid size.  dx at each scanline is rounded to the nearest
 * multiple of this value, creating the stepped / blocky edge look.
 * 12 → large obvious pixel blocks; 4 → subtle.
 */
const IRIS_DITHER_SIZE = 12;

/**
 * Alternating ±offset applied per dither group.
 * Controls tooth depth. Larger = chunkier teeth.
 */
const IRIS_EDGE_NOISE_PX = 4;

/**
 * Vertical scanline resolution.
 * 4 px = coarser strips matching the chunky pixel aesthetic.
 * Should evenly divide IRIS_DITHER_SIZE for clean groups.
 */
const IRIS_SCANLINE_STEP = 16;

// Number of scanline steps per dither group (e.g. 12 px / 4 px = 3 steps).
// Each group gets the same ± offset, creating IRIS_DITHER_SIZE-tall teeth.
const DITHER_GROUP_STEPS = Math.max(1, Math.round(IRIS_DITHER_SIZE / IRIS_SCANLINE_STEP));

// ─── CircleTransitionManager ─────────────────────────────────────────────────
/**
 * Iris / circle-wipe transition — scanline + deterministic dither.
 *
 * No masks, no RenderTexture.erase(), no pipeline tricks.
 *
 * Each frame, _drawIris() fills the screen black EXCEPT a circular hole whose
 * edge is quantized to IRIS_DITHER_SIZE and notched with ±IRIS_EDGE_NOISE_PX
 * offsets keyed on the absolute screen-y group → no animation flicker.
 *
 * Depth: CIRCLE_TRANSITION_DEPTH (150) — above all gameplay, below React DOM.
 */
export default class CircleTransitionManager {
  constructor(scene) {
    this._scene     = scene;
    this._isPlaying = false;
    this._dummy     = { r: 0 }; // persistent tween target — killed on destroy

    const cam = scene.cameras.main;

    this._gfx = scene.add
      .graphics()
      .setScrollFactor(0)
      .setDepth(CIRCLE_TRANSITION_DEPTH)
      .setVisible(false);

    console.info(
      `[Iris] ready — depth ${CIRCLE_TRANSITION_DEPTH},`,
      `${cam.width}×${cam.height},`,
      `dither: ${IRIS_DITHER_ENABLED ? `on (size=${IRIS_DITHER_SIZE} noise=±${IRIS_EDGE_NOISE_PX})` : 'off'}`
    );
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  get isPlaying() { return this._isPlaying; }

  /** Full close → onHidden() → open cycle. */
  playCircleTransition({
    centerX,
    centerY,
    onHidden,
    durationIn  = 400,
    durationOut = 420,
    onComplete,
  } = {}) {
    if (this._isPlaying) { console.warn('[Iris] blocked — already playing'); return; }
    this._isPlaying = true;
    const { cx, cy } = this._resolveCenter(centerX, centerY);
    this._show();
    console.info('[Iris] start close');
    this._doClose(cx, cy, durationIn, () => {
      console.info('[Iris] hidden');
      onHidden?.();
      console.info('[Iris] start open');
      this._doOpen(cx, cy, durationOut, () => {
        console.info('[Iris] complete');
        onComplete?.();
      });
    });
  }

  /** Shrink iris to fully black; resets isPlaying before calling onComplete. */
  playClose({ centerX, centerY, duration = 380, onComplete } = {}) {
    if (this._isPlaying) { console.warn('[Iris] playClose blocked — already playing'); return; }
    this._isPlaying = true;
    const { cx, cy } = this._resolveCenter(centerX, centerY);
    this._show();
    console.info('[Iris] start close');
    this._doClose(cx, cy, duration, () => {
      console.info('[Iris] hidden');
      this._isPlaying = false;
      onComplete?.();
    });
  }

  /** Expand iris from fully black to full reveal. */
  playOpen({ centerX, centerY, duration = 420, onComplete } = {}) {
    if (this._isPlaying) { console.warn('[Iris] playOpen blocked — already playing'); return; }
    this._isPlaying = true;
    const { cx, cy } = this._resolveCenter(centerX, centerY);
    this._drawIris(cx, cy, 0); // pre-fill black before becoming visible
    this._show();
    console.info('[Iris] start open');
    this._doOpen(cx, cy, duration, () => {
      console.info('[Iris] complete');
      onComplete?.();
    });
  }

  /** Close → await loadingPromise → open. */
  playWithLoading({
    centerX,
    centerY,
    onHidden,
    loadingPromise,
    durationIn  = 400,
    durationOut = 420,
    onComplete,
  } = {}) {
    if (this._isPlaying) { console.warn('[Iris] playWithLoading blocked — already playing'); return; }
    this._isPlaying = true;
    const { cx, cy } = this._resolveCenter(centerX, centerY);
    this._show();
    console.info('[Iris] start close');
    this._doClose(cx, cy, durationIn, () => {
      console.info('[Iris] hidden');
      const hiddenResult = onHidden?.();
      const loading = loadingPromise ?? (hiddenResult?.then ? hiddenResult : null);
      const doOpen = () => {
        console.info('[Iris] start open');
        this._doOpen(cx, cy, durationOut, () => {
          console.info('[Iris] complete');
          onComplete?.();
        });
      };
      if (loading?.then) { loading.then(doOpen, doOpen); } else { doOpen(); }
    });
  }

  destroy() {
    this._scene?.tweens?.killTweensOf(this._dummy);
    this._gfx?.destroy();
    this._gfx   = null;
    this._scene = null;
    this._isPlaying = false;
  }

  // ── Internal ─────────────────────────────────────────────────────────────────

  _resolveCenter(centerX, centerY) {
    const cam = this._scene.cameras.main;
    return {
      cx: centerX ?? cam.width  * 0.5,
      cy: centerY ?? cam.height * 0.5,
    };
  }

  _maxRadius(cx, cy) {
    const cam = this._scene.cameras.main;
    return Math.ceil(Math.hypot(
      Math.max(cx, cam.width  - cx),
      Math.max(cy, cam.height - cy),
    ));
  }

  _show() { this._gfx.setVisible(true); }

  _hide() {
    this._gfx.setVisible(false);
    this._isPlaying = false;
  }

  _doClose(cx, cy, duration, onComplete) {
    this._tweenRadius(this._maxRadius(cx, cy), 0, duration, cx, cy, onComplete);
  }

  _doOpen(cx, cy, duration, onComplete) {
    this._tweenRadius(0, this._maxRadius(cx, cy), duration, cx, cy, () => {
      this._hide();
      onComplete?.();
    });
  }

  _tweenRadius(from, to, duration, cx, cy, onComplete) {
    this._scene.tweens.killTweensOf(this._dummy);
    this._dummy.r = from;
    this._drawIris(cx, cy, from);

    if (Math.abs(to - from) < 0.5 || duration <= 0) {
      this._drawIris(cx, cy, to);
      onComplete?.();
      return;
    }

    this._scene.tweens.add({
      targets:    this._dummy,
      r:          to,
      duration,
      ease:       'Sine.easeInOut',
      onUpdate:   () => { this._drawIris(cx, cy, this._dummy.r); },
      onComplete: () => { this._drawIris(cx, cy, to); onComplete?.(); },
    });
  }

  /**
   * Draws the iris frame: black everywhere except a circular hole.
   *
   * Zones:
   *   y < circleTop            → full black strip (above circle)
   *   circleTop ≤ y < circleBot → scanline strips:
   *                               dx = √(r²-dy²), optionally dithered
   *                               left  rect [0,       cx-dx)
   *                               right rect [cx+dx,   w)
   *   y ≥ circleBot            → full black strip (below circle)
   *
   * Dither (when IRIS_DITHER_ENABLED):
   *   1. Quantize dx to the nearest IRIS_DITHER_SIZE grid  →  stepped/blocky edge
   *   2. Look up a ±IRIS_EDGE_NOISE_PX offset from the group table
   *      Group = floor(y / IRIS_DITHER_SIZE) — keyed on ABSOLUTE screen-y so
   *      the pattern stays fixed in space during animation (zero flicker).
   *      The lookup cycles through [+noise, -noise, -noise, +noise] every 4
   *      groups, producing a stable checkerboard-style tooth pattern.
   */
  _drawIris(cx, cy, radius) {
    const gfx = this._gfx;
    const cam = this._scene.cameras.main;
    const w   = cam.width;
    const h   = cam.height;

    gfx.clear();
    gfx.fillStyle(0x000000, 1);

    if (radius <= 0.5) {
      gfx.fillRect(0, 0, w, h);
      return;
    }

    const r2        = radius * radius;
    const circleTop = Math.max(0, Math.floor(cy - radius));
    const circleBot = Math.min(h, Math.ceil(cy  + radius));

    // Zone 1 — above the circle
    if (circleTop > 0) {
      gfx.fillRect(0, 0, w, circleTop);
    }

    // Zone 2 — scanlines through the circle band
    for (let y = circleTop; y < circleBot; y += IRIS_SCANLINE_STEP) {
      const stripH = Math.min(IRIS_SCANLINE_STEP, circleBot - y);
      const dy     = y + stripH * 0.5 - cy;
      const dxSq   = r2 - dy * dy;

      if (dxSq <= 0) {
        gfx.fillRect(0, y, w, stripH);
        continue;
      }

      let dx = Math.sqrt(dxSq);

      if (IRIS_DITHER_ENABLED) {
        // ── Step 1: quantize to IRIS_DITHER_SIZE grid ─────────────────────
        dx = Math.round(dx / IRIS_DITHER_SIZE) * IRIS_DITHER_SIZE;

        // ── Step 2: deterministic ± tooth offset ──────────────────────────
        // Group index is anchored to absolute screen-y, NOT to the moving
        // circle boundary.  The group pattern therefore doesn't shift as
        // radius animates, so the teeth never flicker.
        //
        // 2-phase alternating cycle — every IRIS_DITHER_SIZE-px band flips
        // sign, producing the maximum-contrast chunky tooth pattern.
        const group = Math.floor(y / IRIS_DITHER_SIZE);
        const noise = (group % 2 === 0 ? 1 : -1) * IRIS_EDGE_NOISE_PX;
        dx = Math.max(0, dx + noise);
      }

      const leftEdge  = Math.max(0, cx - dx);
      const rightEdge = Math.min(w, cx + dx);

      if (leftEdge > 0)  gfx.fillRect(0, y, leftEdge, stripH);
      if (rightEdge < w) gfx.fillRect(rightEdge, y, w - rightEdge, stripH);
    }

    // Zone 3 — below the circle
    if (circleBot < h) {
      gfx.fillRect(0, circleBot, w, h - circleBot);
    }
  }
}
