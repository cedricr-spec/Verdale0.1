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
        top: 0,
        left: isMobileLayout ? "0px" : 0,
        right: isMobileLayout ? "auto" : undefined,
        bottom: isMobileLayout ? "auto" : undefined,
        inset: isMobileLayout ? undefined : "auto",
        display: "flex",
        justifyContent: isMobileLayout ? "flex-start" : "center",
        alignItems: isMobileLayout ? "flex-start" : "center",
        pointerEvents: embedded ? "auto" : "none",
        zIndex: embedded ? "auto" : 2,
        width: embedded && !isMobileLayout ? "100%" : undefined,
        height: embedded && !isMobileLayout ? "100%" : undefined,
      }}
    >
      <div
        className="gauges-panel__list"
        style={{
          position: "relative",
          width: isMobileLayout
            ? "fit-content"
            : embedded
              ? "min(100%, 760px)"
              : "max-content",
          maxWidth: isMobileLayout ? "calc(100vw - 24px)" : "none",
          display: isMobileLayout ? "grid" : "flex",
          gridTemplateColumns: isMobileLayout ? "repeat(2, max-content)" : undefined,
          gridAutoRows: isMobileLayout ? "max-content" : undefined,
          flexDirection: isMobileLayout ? undefined : "row",
          flexWrap: isMobileLayout ? undefined : "nowrap",
          justifyContent: isMobileLayout ? "flex-start" : "center",
          alignItems: "flex-start",
          columnGap: isMobileLayout ? "8px" : undefined,
          rowGap: isMobileLayout ? "6px" : undefined,
          gap: isMobileLayout ? undefined : "12px",
        }}
      >
        {gauges.map(([type, value], index) => (
          <div
            className="gauges-panel__item"
            key={type}
            style={{
              position: "relative",
              width: "fit-content",
              flex: "0 0 auto",
              marginRight: 0,
              marginLeft: 0,
            }}
          >
            <GaugeV2 type={type} value={value} />
          </div>
        ))}
      </div>
    </div>
  );
}
