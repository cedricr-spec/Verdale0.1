export function updateWorldOffset(worldOffset, movement) {
  return {
    x: worldOffset.x + movement.x,
    y: worldOffset.y + movement.y,
  };
}
