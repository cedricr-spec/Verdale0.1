import { useEffect } from "react";
import { useWorldStore } from "../store/worldSlice";
import { DECOR_CONFIG, getTreesAround, getRocksAround } from "../utils/decorGenerator";

const DEBUG = false;

function getBounds(item) {
  if (item.type === "tree") {
    const width = item.width * item.scale * 1.4;
    const height = item.height * item.scale * 1.4;

    return {
      left: item.x - width / 2,
      right: item.x + width / 2,
      top: item.y - height * 0.5,
      bottom: item.y,
    };
  }

  const width = item.width * item.scale;
  const height = item.height * item.scale;

  return {
    left: item.x - width * 0.5,
    right: item.x + width * 0.5,
    top: item.y - height,
    bottom: item.y,
  };
}

function pointInBounds(point, bounds) {
  return (
    point.x > bounds.left &&
    point.x < bounds.right &&
    point.y > bounds.top &&
    point.y < bounds.bottom
  );
}

function pathIntersectsBounds(from, to, bounds) {
  const sweptLeft = Math.min(from.x, to.x);
  const sweptRight = Math.max(from.x, to.x);
  const sweptTop = Math.min(from.y, to.y);
  const sweptBottom = Math.max(from.y, to.y);

  return !(
    sweptRight < bounds.left ||
    sweptLeft > bounds.right ||
    sweptBottom < bounds.top ||
    sweptTop > bounds.bottom
  );
}

export default function CollisionSystem() {
  useEffect(() => {
    let frameId = 0;
    let lastOffset = useWorldStore.getState().worldOffset;

    const loop = () => {
      const { worldOffset } = useWorldStore.getState();
      const previousPet = {
        x: -lastOffset.x,
        y: -lastOffset.y,
      };
      const pet = {
        x: -worldOffset.x,
        y: -worldOffset.y,
      };
      const rangeX = DECOR_CONFIG.rangeX ?? DECOR_CONFIG.range;
      const rangeY = DECOR_CONFIG.rangeY ?? DECOR_CONFIG.range;

      const items = [
        ...getTreesAround(pet.x, pet.y),
        ...getRocksAround(pet.x, pet.y),
      ];

      const visibleItems = items.filter((item) => {
        const dx = item.x - pet.x;
        const dy = item.y - pet.y;
        return Math.abs(dx) < rangeX && Math.abs(dy) < rangeY;
      });

      for (const item of visibleItems) {
        const bounds = getBounds(item);

        if (
          pointInBounds(pet, bounds) ||
          pointInBounds(previousPet, bounds) ||
          pathIntersectsBounds(previousPet, pet, bounds)
        ) {
          useWorldStore.setState({ worldOffset: lastOffset });
          break;
        }
      }

      lastOffset = useWorldStore.getState().worldOffset;
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  return null;
}
