import React from "react";
import {
  getItemSprite,
  getItemWorldSprite,
} from "../config/itemSpriteRegistry";
import ItemVisual from "./ItemVisual";

const ENTITY_SCALE = 2;
const WORLD_PICKUP_SHADOW = "drop-shadow(1px 2px 0 rgba(0,0,0,0.45))";

const Entity = React.memo(function Entity({ entity, x = 0, y = 0 }) {
  const type = entity?.type || "food";
  const spriteKey = entity?.spriteKey || "apple";
  const itemSprite = entity?.itemKey ? getItemWorldSprite(entity.itemKey) : null;
  const sprite = itemSprite || (!entity?.itemKey ? getItemSprite(type, spriteKey) : null);
  const usesDirectAsset = Boolean(sprite?.src || sprite?.isDirectAsset);

  if (!sprite && entity?.itemKey) {
    return (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 34,
          height: 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(15, 15, 15, 0.78)",
          borderRadius: "999px",
          border: "1px solid rgba(255, 255, 255, 0.04)",
          transform: `translate(${x}px, ${y}px) translate(-50%, -100%)`,
          zIndex: 999,
          pointerEvents: "none",
        }}
      >
        <ItemVisual itemId={entity.itemKey} variant="world" size={24} emojiSize={22} />
      </div>
    );
  }

  if (!sprite) {
    // fallback (debug)
    return (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 20,
          height: 20,
          background: "red",
          transform: `translate(${x}px, ${y}px) translate(-50%, -100%)`,
          zIndex: 10,
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: sprite.width * ENTITY_SCALE,
        height: sprite.height * ENTITY_SCALE,
        ...(usesDirectAsset
          ? {}
          : {
              backgroundImage: `url(${sprite.sheet})`,
              backgroundPosition: `-${sprite.x}px -${sprite.y}px`,
              backgroundRepeat: "no-repeat",
              backgroundSize: sprite.backgroundSize || "auto",
            }),
        imageRendering: "pixelated",
        transform: `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${ENTITY_SCALE})`,
        zIndex: 10,
        filter: WORLD_PICKUP_SHADOW,
      }}
    >
      {usesDirectAsset && (
        <img
          src={sprite.src || sprite.sheet}
          alt=""
          aria-hidden="true"
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "contain",
            imageRendering: "pixelated",
          }}
        />
      )}
    </div>
  );
})

export default Entity;
