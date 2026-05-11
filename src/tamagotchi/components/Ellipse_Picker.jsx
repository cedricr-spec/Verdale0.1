import React, { useState, useEffect, useRef } from "react";
import ELLIPSE_BG from "../../GameActions/ellipse_choix_food.svg";
import CTA_ROUNDED from "../../GameActions/CTA_rounded_Game_Action.webp";
import CTA_DISABLED from "../../GameActions/CTA_rounded_Game_Action_Disabled.webp";
import CTA_PRESSED from "../../GameActions/CTA_rounded_Game_Action_Pressed.webp";
import { usePetStore as useStore } from "../store/usePetstore";
import ICON_CLOSE from "../../hud/Icon_Close_X.svg";
import { ACTIONS } from "../../game/actions";


// ✅ GLOBAL persistent cooldowns (survive unmount)
const globalCooldowns = {};

export default function EllipsePicker({
  onClose,
  onHover,
  onAction,
  count = 10,
  radiusX = 180,
  radiusY = 180,
  debug = true,
  closeScale = 1.4 // 🔧 tweak close button size (1 = same as items)
}) {
  const applyAction = useStore((s) => s.applyAction);
  const getState = useStore.getState;

  const debugUI = useStore((s) => s.debugUI);
  const getColor = useStore((s) => s.getDebugColor);

  const grouped = {
    feed: ACTIONS.filter(a => a.type === "feed"),
    play: ACTIONS.filter(a => a.type === "play"),
    sleep: ACTIONS.filter(a => a.type === "sleep"),
  };

  const types = ["feed", "play", "sleep"];

  // build unique pool first
  const baseItems = [
    ...grouped.feed,
    ...grouped.play,
    ...grouped.sleep
  ];

  // use only available unique actions (no repetition)
  const maxAvailable = baseItems.length;
  const finalCount = count ? Math.min(count, maxAvailable) : maxAvailable;
  const items = baseItems.slice(0, finalCount);

  // ⚠️ if you want more items → add more entries in ACTIONS

  const dynamicRadius = 50; // percentage based radius
  const itemDistance = 0.745; // 🔧 tweak here (0 = center, 1 = edge)
  const btnSize = items.length > 10 ? 48 : items.length > 8 ? 52 : 56;

  const closeBtnSize = btnSize * closeScale; // 🔧 control here

  const [visible, setVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const cooldownsRef = useRef(globalCooldowns);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate(v => v + 1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setVisible(false);
    // match transition duration below (0.28s)
    setTimeout(() => {
      onClose && onClose();
    }, 280);
  };

  const getHoverScale = (pointerType, baseScale = 1) =>
    pointerType === "touch" ? baseScale : 1.1;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      {debugUI && (
        <div style={{
          position: "absolute",
          inset: 0,
          background: getColor("layout"),
          pointerEvents: "none",
          zIndex: 0
        }} />
      )}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundImage: `url(${ELLIPSE_BG})`,
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          pointerEvents: "none",
          transform: `scale(${visible ? 1 : 0.6})`,
          opacity: visible ? 1 : 0,
          transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease",
        }}
      >
        {debugUI && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: getColor("overlay"),
            pointerEvents: "none",
            zIndex: 0
          }} />
        )}
      </div>

      {/* CENTER CLOSE BUTTON */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 5
        }}
      >
        {debugUI && (
          <div style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: getColor("content"),
            pointerEvents: "none",
            zIndex: 0
          }} />
        )}
        <div
          onClick={handleClose}
          onPointerEnter={(e) => {
            if (e.pointerType === "touch") return;
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onPointerLeave={(e) => (e.currentTarget.style.transform = `scale(${visible ? 1 : 0.6})`)}
          onPointerDown={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
          onPointerUp={(e) => {
            e.currentTarget.style.transform = `scale(${getHoverScale(e.pointerType, visible ? 1 : 0.6)})`;
          }}
          onPointerCancel={(e) => (e.currentTarget.style.transform = `scale(${visible ? 1 : 0.6})`)}
          style={{
            width: closeBtnSize,
            height: closeBtnSize,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundImage: `url(${CTA_ROUNDED})`,
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            cursor: "pointer",
            transform: `scale(${visible ? 1 : 0.6})`,
            opacity: visible ? 1 : 0,
            transition: "transform 0.22s ease, opacity 0.18s ease",
            transformOrigin: "center",
            pointerEvents: "auto",
            touchAction: "manipulation",
          }}
        >
          <img src={ICON_CLOSE} alt="close" style={{ width: "35%", height: "35%" }} />
        </div>
      </div>

      {/* Points distributed on ellipse */}
      {items.map((item, i) => {
        const angle = (i / items.length) * Math.PI * 2;

        const x = Math.cos(angle) * dynamicRadius * itemDistance;
        const y = Math.sin(angle) * dynamicRadius * itemDistance;

        const isDisabled = (cooldownsRef.current[`${item.id}_${i}`] && cooldownsRef.current[`${item.id}_${i}`] > Date.now()) || (item.condition && !item.condition(getState()));

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(50% + ${visible ? x : 0}%)`,
              top: `calc(50% + ${visible ? y : 0}%)`,
              transform: `translate(-50%, -50%) scale(${visible ? 1 : 0.6})`,
              opacity: visible ? 1 : 0,
              filter: visible ? "blur(0px)" : "blur(6px)",
              transition: `transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease, filter 0.25s ease`,
              zIndex: 5,
              pointerEvents: "none",
            }}
          >
            {debugUI && (
              <div style={{
                position: "absolute",
                inset: 0,
                background: getColor("content"),
                pointerEvents: "none",
                zIndex: 0
              }} />
            )}
            {/* CTA placeholder (emoji) */}
            <div
              onClick={() => {
                const now = Date.now();
                const state = getState();
                if (item.condition && !item.condition(state)) return;
                if (cooldownsRef.current[`${item.id}_${i}`] && cooldownsRef.current[`${item.id}_${i}`] > now) return;

                onAction && onAction(item);
                applyAction && applyAction(item);

                cooldownsRef.current[`${item.id}_${i}`] = now + item.cooldown * 1000;
                forceUpdate(v => v + 1);
              }}
              onPointerEnter={(e) => {
                if (isDisabled) return;
                if (e.pointerType === "touch") return;
                onHover && onHover(item);
                e.currentTarget.dataset.hover = "true";
                e.currentTarget.style.transform = "scale(1.1)";
              }}
              onPointerLeave={(e) => {
                e.currentTarget.dataset.hover = "false";
                e.currentTarget.dataset.pressed = "false";
                e.currentTarget.style.transform = "scale(1)";
              }}
              onPointerDown={(e) => {
                if (isDisabled) return;
                e.currentTarget.dataset.pressed = "true";
                e.currentTarget.style.transform = "scale(0.92)";
              }}
              onPointerUp={(e) => {
                if (isDisabled) return;
                e.currentTarget.dataset.pressed = "false";
                e.currentTarget.style.transform = `scale(${getHoverScale(e.pointerType)})`;
              }}
              onPointerCancel={(e) => {
                e.currentTarget.dataset.hover = "false";
                e.currentTarget.dataset.pressed = "false";
                e.currentTarget.style.transform = "scale(1)";
              }}
              style={{
                width: btnSize,
                height: btnSize,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundImage: `url(${CTA_ROUNDED})`,
                backgroundSize: "100% 100%",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                cursor: isDisabled ? "default" : "pointer",
                transform: "scale(1)",
                transition: "transform 0.2s ease",
                position: "relative",
                fontSize: "clamp(14px, 1.6vw, 22px)",
                backgroundColor: "transparent",
                filter: "none",
                opacity: 1,
                pointerEvents: "auto",
                touchAction: "manipulation",
              }}
              ref={(el) => {
                if (!el) return;

                const now = Date.now();
                const disabled = (cooldownsRef.current[`${item.id}_${i}`] && cooldownsRef.current[`${item.id}_${i}`] > now) || (item.condition && !item.condition(getState()));

                if (disabled) {
                  el.style.backgroundImage = `url(${CTA_DISABLED})`;
                  return;
                }

                const pressed = el.dataset.pressed === "true";
                const hover = el.dataset.hover === "true";

                if (pressed) {
                  el.style.backgroundImage = `url(${CTA_PRESSED})`;
                } else if (hover) {
                  el.style.backgroundImage = `url(${CTA_ROUNDED})`;
                } else {
                  el.style.backgroundImage = `url(${CTA_ROUNDED})`;
                }
              }}
            >
              {debugUI && (
                <div style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: getColor("overlay"),
                  pointerEvents: "none",
                  zIndex: 0
                }} />
              )}
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isDisabled ? 0.4 : 1,
                  filter: isDisabled ? "grayscale(1)" : "none"
                }}
              >
                <span>
                  {item.icon || "❓"}
                </span>
              </div>
              {cooldownsRef.current[`${item.id}_${i}`] && cooldownsRef.current[`${item.id}_${i}`] > Date.now() && (
                <span
                  className="cooldown-text"
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    pointerEvents: "none",
                    zIndex: 2,
                    color: "#ffffff",
                    fontWeight: "600"
                  }}
                >
                  {Math.ceil((cooldownsRef.current[`${item.id}_${i}`] - Date.now()) / 1000)}
                </span>
              )}
              {cooldownsRef.current[`${item.id}_${i}`] && cooldownsRef.current[`${item.id}_${i}`] > Date.now() && (
                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    width: "calc(100% - 12px)",
                    height: "calc(100% - 12px)",
                    borderRadius: "50%",
                    background: `conic-gradient(rgba(255,255,255,0.25) ${(1 - (cooldownsRef.current[`${item.id}_${i}`] - Date.now()) / (item.cooldown * 1000)) * 360}deg, transparent 0deg)`,
                    pointerEvents: "none",
                    zIndex: 1
                  }}
                />
              )}
            </div>
          </div>
        );
      })} 
    </div>
  );
}
