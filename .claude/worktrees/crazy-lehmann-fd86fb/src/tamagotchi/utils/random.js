export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

// 🔥 deterministic random based on coords
export function randFromSeed(x = 0, y = 0, seed = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 101.3) * 43758.5453;
  return n - Math.floor(n);
}
