import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { useWorldStore } from "../store/worldSlice";
import { useWorldFxStore } from "../store/worldFxStore";
import useWorldTheme from "../hooks/useWorldTheme";
import { getPhaserDebugFlags } from "../phaser/phaserDebugFlags";
import axeSlashSheet from "../../spritesheets/fx/attacks/Hslash1.png";
import pickaxeSlashSheet from "../../spritesheets/fx/attacks/VslashSmall1.png";

const DEFAULT_VIEWPORT_FRAME = Object.freeze({
  left: 0,
  top: 0,
  width: 500,
  height: 500,
});

const WORLD_LAYER_STYLE = {
  position: "absolute",
  left: 0,
  top: 0,
  pointerEvents: "none",
};

const FX_CONFIG = {
  axe_slash: {
    asset: axeSlashSheet,
    frameWidth: 64,
    frameHeight: 32,
    renderScale: 2,
    frames: 5,
    frameDurationMs: 70,
    verticalOffsetY: 0,
  },
  pickaxe_slash: {
    asset: pickaxeSlashSheet,
    frameWidth: 32,
    frameHeight: 48,
    renderScale: 2,
    frames: 4,
    frameDurationMs: 70,
    verticalOffsetY: 10,
  },
};

const IMPACT_STYLES = `
@keyframes worldObjectImpactJiggle {
  0% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  50% { transform: translateX(2px); }
  75% { transform: translateX(-1px); }
  100% { transform: translateX(0); }
}
`;

function createWorldTransform(viewportFrame, worldOffset = { x: 0, y: 0 }) {
  return `translate3d(${Math.round((viewportFrame.width || 0) * 0.5 + (worldOffset?.x || 0))}px, ${Math.round(
    (viewportFrame.height || 0) * 0.5 + (worldOffset?.y || 0)
  )}px, 0)`;
}

function applyWorldTransform(node, viewportFrame, worldOffset) {
  if (!node) return;

  const nextTransform = createWorldTransform(viewportFrame, worldOffset);
  if (node.style.transform !== nextTransform) {
    node.style.transform = nextTransform;
  }
  if (node.style.willChange !== "transform") {
    node.style.willChange = "transform";
  }
}

const WorldInteractionFxSprite = memo(function WorldInteractionFxSprite({
  fx,
  config,
  removeFx,
}) {
  const [frameIndex, setFrameIndex] = useState(() => {
    const elapsedMs = Math.max(0, Date.now() - (fx.createdAt || Date.now()));
    return Math.min(
      config.frames - 1,
      Math.floor(elapsedMs / config.frameDurationMs)
    );
  });

  useEffect(() => {
    let currentFrame = Math.max(
      0,
      Math.min(
        config.frames - 1,
        Math.floor(
          Math.max(0, Date.now() - (fx.createdAt || Date.now())) /
            config.frameDurationMs
        )
      )
    );
    let removalTimeoutId = 0;

    setFrameIndex(currentFrame);

    const removeAfterLastFrame = () => {
      removalTimeoutId = window.setTimeout(() => {
        removeFx(fx.id);
      }, config.frameDurationMs);
    };

    if (currentFrame >= config.frames - 1) {
      removeAfterLastFrame();
      return () => {
        if (removalTimeoutId) {
          window.clearTimeout(removalTimeoutId);
        }
      };
    }

    const intervalId = window.setInterval(() => {
      currentFrame += 1;
      if (currentFrame >= config.frames - 1) {
        setFrameIndex(config.frames - 1);
        window.clearInterval(intervalId);
        removeAfterLastFrame();
        return;
      }

      setFrameIndex(currentFrame);
    }, config.frameDurationMs);

    return () => {
      window.clearInterval(intervalId);
      if (removalTimeoutId) {
        window.clearTimeout(removalTimeoutId);
      }
    };
  }, [config.frameDurationMs, config.frames, fx.createdAt, fx.id, removeFx]);

  const renderWidth = config.frameWidth * config.renderScale;
  const renderHeight = config.frameHeight * config.renderScale;

  return (
    <div
      data-world-fx={fx.type}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: renderWidth,
        height: renderHeight,
        backgroundImage: `url(${config.asset})`,
        backgroundPosition: `-${frameIndex * renderWidth}px 0px`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${config.frameWidth * config.frames * config.renderScale}px ${renderHeight}px`,
        imageRendering: "pixelated",
        pointerEvents: "none",
        transform: `translate(${Math.round(fx.x)}px, ${Math.round((fx.y || 0) + config.verticalOffsetY)}px) translate(-50%, -50%) scaleX(${fx.flipX ? -1 : 1})`,
        transformOrigin: "center",
        zIndex: Math.max(1, Math.round(fx.y || 0)),
      }}
    />
  );
});

function getImpactItemTransform(item) {
  const scale = Number.isFinite(item?.scale) && item.scale > 0 ? item.scale : 1;

  if (item?.anchorMode === "tile") {
    return `translate(${item.x || 0}px, ${item.y || 0}px) scale(${scale})`;
  }

  return `translate(${item?.x || 0}px, ${item?.y || 0}px) translate(${
    -(Number.isFinite(item?.anchorX) ? item.anchorX : 0.5) * 100
  }%, ${-(Number.isFinite(item?.anchorY) ? item.anchorY : 1) * 100}%) scale(${scale})`;
}

const WorldObjectImpactSprite = memo(function WorldObjectImpactSprite({
  impact,
  atlasImage,
  removeObjectImpact,
}) {
  const item = impact.item;
  const width = item?.renderWidth || item?.entry?.width || 0;
  const height = item?.renderHeight || item?.entry?.height || 0;

  useEffect(() => {
    const elapsedMs = Math.max(0, Date.now() - (impact.startedAt || Date.now()));
    const remainingMs = Math.max(0, (impact.durationMs || 140) - elapsedMs);
    const timeoutId = window.setTimeout(() => {
      removeObjectImpact(impact.objectId);
    }, remainingMs);

    return () => window.clearTimeout(timeoutId);
  }, [impact.durationMs, impact.objectId, impact.startedAt, removeObjectImpact]);

  if (!atlasImage || !item?.entry || width <= 0 || height <= 0) {
    return null;
  }

  return (
    <div
      data-world-object-impact={impact.objectId}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width,
        height,
        pointerEvents: "none",
        overflow: "visible",
        transform: getImpactItemTransform(item),
        transformOrigin:
          item.anchorMode === "tile"
            ? "top left"
            : `${(Number.isFinite(item.anchorX) ? item.anchorX : 0.5) * 100}% ${
                (Number.isFinite(item.anchorY) ? item.anchorY : 1) * 100
              }%`,
        zIndex: Math.max(1, Math.round(item.y || 0)),
      }}
    >
      <div
        style={{
          width,
          height,
          backgroundImage: `url(${atlasImage})`,
          backgroundPosition: `-${item.entry.x || 0}px -${item.entry.y || 0}px`,
          backgroundRepeat: "no-repeat",
          filter: "brightness(0) invert(1)",
          imageRendering: "pixelated",
          animation: `worldObjectImpactJiggle ${Math.max(80, impact.durationMs || 140)}ms steps(4, end) both`,
        }}
      />
    </div>
  );
});

export default function WorldInteractionFxLayer({
  viewportFrame = DEFAULT_VIEWPORT_FRAME,
}) {
    const phaserFlags = getPhaserDebugFlags();
  const isPhaserWorldRendering =
    phaserFlags.renderMode === "phaser" && phaserFlags.hideReactWorldLayer;

  if (isPhaserWorldRendering) {
    return null;
  }
  const activeFx = useWorldFxStore((state) => state.activeFx);
  const activeObjectImpacts = useWorldFxStore((state) => state.activeObjectImpacts);
  const removeFx = useWorldFxStore((state) => state.removeFx);
  const removeObjectImpact = useWorldFxStore((state) => state.removeObjectImpact);
  const theme = useWorldTheme();
  const worldLayerRef = useRef(null);

  useEffect(() => {
    const initialOffset = useWorldStore.getState().worldOffset || { x: 0, y: 0 };
    applyWorldTransform(worldLayerRef.current, viewportFrame, initialOffset);
  }, [viewportFrame.height, viewportFrame.width]);

  useEffect(() => {
    const unsubscribe = useWorldStore.subscribe((state, previousState) => {
      if (state.worldOffset === previousState.worldOffset) {
        return;
      }

      applyWorldTransform(worldLayerRef.current, viewportFrame, state.worldOffset);
    });

    return () => unsubscribe();
  }, [viewportFrame.height, viewportFrame.width]);

  const sortedFx = useMemo(
    () =>
      [...activeFx].sort((a, b) => {
        const yDelta = (a?.y || 0) - (b?.y || 0);
        if (yDelta !== 0) return yDelta;
        return (a?.createdAt || 0) - (b?.createdAt || 0);
      }),
    [activeFx]
  );

  const sortedImpacts = useMemo(
    () =>
      [...activeObjectImpacts].sort((a, b) => {
        const yDelta = (a?.item?.y || 0) - (b?.item?.y || 0);
        if (yDelta !== 0) return yDelta;
        return (a?.startedAt || 0) - (b?.startedAt || 0);
      }),
    [activeObjectImpacts]
  );

  const frameStyle = useMemo(
    () => ({
      position: "absolute",
      left: Math.round(viewportFrame.left || 0),
      top: Math.round(viewportFrame.top || 0),
      width: Math.max(1, Math.round(viewportFrame.width || DEFAULT_VIEWPORT_FRAME.width)),
      height: Math.max(1, Math.round(viewportFrame.height || DEFAULT_VIEWPORT_FRAME.height)),
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: 30,
    }),
    [viewportFrame.height, viewportFrame.left, viewportFrame.top, viewportFrame.width]
  );

  return (
    <div style={frameStyle}>
      <style>{IMPACT_STYLES}</style>
      <div ref={worldLayerRef} data-world-interaction-fx-layer style={WORLD_LAYER_STYLE}>
        {sortedImpacts.map((impact) => (
          <WorldObjectImpactSprite
            key={impact.objectId}
            impact={impact}
            atlasImage={theme.atlasImage}
            removeObjectImpact={removeObjectImpact}
          />
        ))}
        {sortedFx.map((fx) => {
          const config = FX_CONFIG[fx.type];
          if (!config) return null;

          return (
            <WorldInteractionFxSprite
              key={fx.id}
              fx={fx}
              config={config}
              removeFx={removeFx}
            />
          );
        })}
      </div>
    </div>
  );
}
