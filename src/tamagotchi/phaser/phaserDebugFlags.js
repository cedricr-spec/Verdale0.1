// Reactive bridge for debug flags that cross the Phaser ↔ React boundary.
// Phaser writes via setPhaserDebugFlag(); React subscribes to re-render.

import {
  ACTIVE_WORLD_RENDERER,
  isPhaserWorldRendererActive,
} from "../config/worldRendererConfig";

const PHASER_ACTIVE_BY_DEFAULT = isPhaserWorldRendererActive(
  ACTIVE_WORLD_RENDERER
);

const _state = {
  // Terrain
  renderMode: PHASER_ACTIVE_BY_DEFAULT ? 'phaser' : 'react', // 'react' | 'hybrid' | 'phaser'
  showViewportTerrain: PHASER_ACTIVE_BY_DEFAULT,
  hideReactWorldLayer: PHASER_ACTIVE_BY_DEFAULT,
  // Entity layers — hidden by default to avoid confusion
  showPhaserEntityLayer: true,
  hideReactEntityLayer: PHASER_ACTIVE_BY_DEFAULT,
  // Player — hidden by default to avoid duplication confusion.
  // showPhaserPlayerPreview is kept as a legacy alias while old React/Phaser
  // code paths are being renamed progressively.
  showPhaserPlayer: true,
  showPhaserPlayerPreview: true,
  // Debug overlays
  showPlayerMarker: true,
  showEntityMarkers: true,
  // Hard visibility test: fills entire Phaser viewport with red at depth 999.
  // If this is not visible, the CSS layering is broken — do not hide React terrain.
  forceRedCanvas: false,
};

const _listeners = new Set();

export function getPhaserDebugFlags() {
  return { ..._state };
}

export function setPhaserDebugFlag(key, value) {
  const normalizedValue = Boolean(value);

  if (key === 'showPhaserPlayer' || key === 'showPhaserPlayerPreview') {
    if (
      _state.showPhaserPlayer === normalizedValue &&
      _state.showPhaserPlayerPreview === normalizedValue
    ) {
      return;
    }

    _state.showPhaserPlayer = normalizedValue;
    _state.showPhaserPlayerPreview = normalizedValue;
    const snapshot = { ..._state };
    _listeners.forEach((fn) => fn(snapshot));
    return;
  }

  if (_state[key] === value) return;
  _state[key] = value;
  const snapshot = { ..._state };
  _listeners.forEach((fn) => fn(snapshot));
}

export function subscribePhaserDebugFlags(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
