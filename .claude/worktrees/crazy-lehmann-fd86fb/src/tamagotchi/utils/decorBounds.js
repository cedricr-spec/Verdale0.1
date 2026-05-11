export function getDecorCollisionBounds(item) {
  const width = item.width * item.scale;
  const height = item.height * item.scale;

  return {
    left: item.x - width / 2,
    right: item.x + width / 2,
    top: item.y - height,
    bottom: item.y,
  };
}
