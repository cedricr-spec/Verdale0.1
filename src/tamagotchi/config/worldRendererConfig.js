export const WORLD_RENDERER_IDS = {
  REACT: "react",
  PHASER: "phaser",
};

// Keep the legacy React renderer available as a fallback path, but make Phaser
// the authoritative world renderer by default.
export const ACTIVE_WORLD_RENDERER = WORLD_RENDERER_IDS.PHASER;

export const REACT_WORLD_RENDERER_AVAILABLE = true;

export function isPhaserWorldRendererActive(
  rendererId = ACTIVE_WORLD_RENDERER
) {
  return rendererId === WORLD_RENDERER_IDS.PHASER;
}
