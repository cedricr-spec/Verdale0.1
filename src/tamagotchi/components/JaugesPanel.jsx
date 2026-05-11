import React, { useEffect, useState } from "react";
import { usePetStore } from "../store/usePetStore";
import GaugeV2 from "./GaugeV2";

const MOBILE_GAUGES_QUERY = "(max-width: 800px)";

function useIsMobileGaugesLayout() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MOBILE_GAUGES_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const mediaQuery = window.matchMedia(MOBILE_GAUGES_QUERY);
    const update = () => setIsMobile(mediaQuery.matches);

    update();
    mediaQuery.addEventListener?.("change", update);

    return () => {
      mediaQuery.removeEventListener?.("change", update);
    };
  }, []);

  return isMobile;
}

export default function JaugesPanel({ embedded = false, ...props }) {
  const isMobileLayout = useIsMobileGaugesLayout();

  const hunger = usePetStore((s) => s.hunger);
  const energy = usePetStore((s) => s.energy);
  const happiness = usePetStore((s) => s.happiness);
  const health = usePetStore((s) => s.health);

  const gauges = [
    ["energy", energy],
    ["food", hunger],
    ["happiness", happiness],
    ["health", health],
  ];

  return (
    <div
      className={[
        "gauges-panel",
        isMobileLayout ? "gauges-panel--mobile" : null,
        embedded ? "gauges-panel--embedded" : null,
      ].filter(Boolean).join(" ")}
      data-hud="jauges"
      {...props}
      style={{
        position: isMobileLayout ? "absolute" : "relative",
        top: isMobileLayout ? "12px" : undefined,
        left: isMobileLayout ? "12px" : undefined,
        right: isMobileLayout ? "auto" : undefined,
        bottom: isMobileLayout ? "auto" : undefined,
        inset: isMobileLayout ? undefined : "auto",
        display: "flex",
        justifyContent: isMobileLayout ? "flex-start" : "center",
        alignItems: isMobileLayout ? "flex-start" : "center",
        pointerEvents: embedded ? "auto" : "none",
        zIndex: embedded ? "auto" : 20,
        width: embedded && !isMobileLayout ? "100%" : undefined,
        height: embedded && !isMobileLayout ? "100%" : undefined,
      }}
    >
      <div
        className="gauges-panel__list"
        style={{
          width: isMobileLayout
            ? "fit-content"
            : embedded
              ? "min(100%, 760px)"
              : "max-content",
          maxWidth: isMobileLayout ? "min(calc(100vw - 24px), 520px)" : "none",
          display: "flex",
          flexDirection: "row",
          flexWrap: isMobileLayout ? "wrap" : "nowrap",
          justifyContent: isMobileLayout ? "flex-start" : "center",
          alignItems: "flex-start",
          gap: isMobileLayout ? "6px 8px" : "0px",
        }}
      >
        {gauges.map(([type, value]) => (
          <div
            className="gauges-panel__item"
            key={type}
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "fit-content",
              flex: "0 0 auto",
              marginRight: isMobileLayout ? 0 : "-16px",
            }}
          >
            <GaugeV2 type={type} value={value} />
          </div>
        ))}
      </div>
    </div>
  );
}
