const COUNTER_KEYS = [
  "worldAtlasLayer",
  "chunkTileLayer",
  "worldDebugOverlay",
];

const counters = Object.fromEntries(COUNTER_KEYS.map((key) => [key, 0]));
let lastSampleAt = 0;
let lastSnapshot = {
  elapsedMs: 0,
  worldAtlasLayerRendersPerSecond: 0,
  chunkTileLayerRendersPerSecond: 0,
  worldDebugOverlayRendersPerSecond: 0,
};

export function recordWorldPerfRender(counterKey) {
  if (!COUNTER_KEYS.includes(counterKey)) {
    return;
  }

  counters[counterKey] += 1;
}

export function sampleWorldPerfRenderRates() {
  const now =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();

  if (!lastSampleAt) {
    lastSampleAt = now;
    return lastSnapshot;
  }

  const elapsedMs = Math.max(1, now - lastSampleAt);
  const nextSnapshot = {
    elapsedMs,
    worldAtlasLayerRendersPerSecond:
      (counters.worldAtlasLayer * 1000) / elapsedMs,
    chunkTileLayerRendersPerSecond:
      (counters.chunkTileLayer * 1000) / elapsedMs,
    worldDebugOverlayRendersPerSecond:
      (counters.worldDebugOverlay * 1000) / elapsedMs,
  };

  COUNTER_KEYS.forEach((key) => {
    counters[key] = 0;
  });
  lastSampleAt = now;
  lastSnapshot = nextSnapshot;

  return nextSnapshot;
}
