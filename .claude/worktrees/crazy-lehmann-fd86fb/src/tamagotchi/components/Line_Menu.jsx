import React, { useState } from "react";
import CTA_DEFAULT from "../../hud/CTAs/CTA_Small_8BIT.png";
import CTA_PRESSED from "../../hud/CTAs/CTA_Small_8BIT_Pressed.png";
import bagIcon from "../../spritesheets/items_spritesheet/bagicon.webp";
import { usePetStore as useStore } from "../store/usePetstore";
import { useInventoryStore } from "../store/useInventoryStore";
import { getItemDefinition } from "../config/itemsRegistry";
import ItemVisual from "./ItemVisual";

const INVENTORY_ICON_IDLE_OFFSET_Y = -2;
const MENU_BUTTON_SIZE = 48;

export default function LineMenu({ onHover, onInventoryToggle, inventoryOpen = false }) {
  const applyEffects = useStore((s) => s.applyEffects);
  const theme = useStore((s) => s.theme);
  const color = theme?.modelColor || "#8f8f8f";
  const usableSlots = useInventoryStore((s) => s.usableSlots);
  const consumeSlotItem = useInventoryStore((s) => s.consumeSlotItem);
  const [pressedKey, setPressedKey] = useState(null);
  const inventoryButtonKey = "inventory";

  const renderMenuButton = ({
    buttonKey,
    isDisabled = false,
    onClick,
    onHoverEnter,
    onHoverLeave,
    content,
    extraStyle,
  }) => {
    const isPressed = pressedKey === buttonKey;
    const ctaImage = isPressed ? CTA_PRESSED : CTA_DEFAULT;

    return (
      <div
        key={buttonKey}
        style={{
          width: `${MENU_BUTTON_SIZE}px`,
          height: `${MENU_BUTTON_SIZE}px`,
          position: "relative",
          pointerEvents: "auto",
          ...extraStyle,
        }}
      >
        <div
          onClick={() => {
            if (isDisabled) return;
            onClick?.();
          }}
          onPointerEnter={(e) => {
            if (isDisabled) return;
            if (e.pointerType === "touch") return;
            onHoverEnter?.();
          }}
          onPointerLeave={() => {
            onHoverLeave?.();
            setPressedKey(null);
          }}
          onPointerDown={() => {
            if (isDisabled) return;
            setPressedKey(buttonKey);
          }}
          onPointerUp={() => {
            if (isDisabled) return;
            setPressedKey(null);
          }}
          onPointerCancel={() => {
            setPressedKey(null);
          }}
          style={{
            cursor: isDisabled ? "default" : "pointer",
            position: "relative",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            touchAction: "manipulation"
          }}
        >
          <img
            src={ctaImage}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              imageRendering: "pixelated",
              display: "block",
              opacity: isDisabled ? 0.55 : 1,
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: color,
              mixBlendMode: "color",
              pointerEvents: "none",
              opacity: isDisabled ? 0.55 : 1,
              WebkitMaskImage: `url(${ctaImage})`,
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              WebkitMaskSize: "contain",
              maskImage: `url(${ctaImage})`,
              maskRepeat: "no-repeat",
              maskPosition: "center",
              maskSize: "contain",
            }}
          />

          {content}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        justifyContent: "center",
        alignItems: "center",
        gap: "6px",
        padding: "4px 6px",
        width: "min(95vw, 360px)",
        pointerEvents: "auto"
      }}
    >
      {usableSlots.map((_, i) => {
        const stack = usableSlots[i] || null;
        const itemId = stack?.itemId || null;
        const definition = itemId ? getItemDefinition(itemId) : null;
        const buttonKey = `usable_${i}`;
        const isDisabled = !stack || !definition?.usable;

        return renderMenuButton({
          buttonKey,
          isDisabled,
          onClick: () => {
            if (!stack || !definition?.usable) return;
            if (definition.useEffects && applyEffects) {
              applyEffects(definition.useEffects);
              consumeSlotItem("usable", i, 1);
            }
          },
          onHoverEnter: () => {
            onHover && onHover(definition || null);
          },
          onHoverLeave: () => {
            onHover && onHover(null);
          },
          content: (
            <>
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isDisabled ? 0.4 : 1,
                  filter: isDisabled ? "grayscale(1)" : "none",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {itemId ? (
                  <ItemVisual itemId={itemId} variant="inventory" size={24} emojiSize={21} />
                ) : null}
              </div>

              {stack?.quantity > 1 && (
                <span
                  style={{
                    position: "absolute",
                    right: "6px",
                    bottom: "6px",
                    minWidth: "18px",
                    height: "18px",
                    padding: "0 4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#fff",
                    background: "rgba(0,0,0,0.55)",
                    borderRadius: "4px",
                    textShadow: "0 1px 2px rgba(0,0,0,0.7)",
                    pointerEvents: "none",
                  }}
                >
                  {stack.quantity}
                </span>
              )}
            </>
          ),
        });
      })}

      {renderMenuButton({
        buttonKey: inventoryButtonKey,
        onClick: () => {
          onHover && onHover(null);
          onInventoryToggle?.();
        },
        content: (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              zIndex: 1,
              opacity: inventoryOpen ? 0.92 : 1,
            }}
          >
            <img
              src={bagIcon}
              alt=""
              style={{
                width: "26px",
                height: "26px",
                objectFit: "contain",
                imageRendering: "pixelated",
                display: "block",
                transform: `translateY(${pressedKey === inventoryButtonKey ? 0 : INVENTORY_ICON_IDLE_OFFSET_Y}px)`,
                pointerEvents: "none",
              }}
            />
          </div>
        ),
        extraStyle: {
          marginLeft: "10px",
        },
      })}
    </div>
  );
}
