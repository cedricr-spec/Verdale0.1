import React from "react";
import { usePetStore } from "../tamagotchi/store/usePetstore";
import tinycolor from "tinycolor2";

function buildGradient(hex) {
  if (!hex) return { grad1: "#000", grad2: "#000", grad3: "#000" };
  const base = tinycolor(hex);
  return {
    grad1: base.lighten(25).toRgbString(),
    grad2: base.toRgbString(),
    grad3: base.darken(35).toRgbString(),
  };
}

export default function ThemeProvider({ children }) {
  const theme = usePetStore((s) => s.theme);

  React.useEffect(() => {
    if (!theme) return;

    const root = document.documentElement;

    const bgGradient = buildGradient(theme.background);
    const hudGradient = buildGradient(theme.modelColor);

    // 🌌 Background gradient
    root.style.setProperty("--grad-1", bgGradient.grad1);
    root.style.setProperty("--grad-2", bgGradient.grad2);
    root.style.setProperty("--grad-3", bgGradient.grad3);

    // 🧩 HUD gradient (based on model color)
    root.style.setProperty("--hud-grad-1", hudGradient.grad1);
    root.style.setProperty("--hud-grad-2", hudGradient.grad2);
    root.style.setProperty("--hud-grad-3", hudGradient.grad3);

    // 🌊 HUD gradient animation (centralized)
    const gradientAnim = theme.gradientAnimation || {
      speed: 3,
      intensity: 1.4,
      opacity: 1,
      blur: 12
    };

    root.style.setProperty("--hud-gradient-speed", `${gradientAnim.speed}s`);
    root.style.setProperty("--hud-gradient-intensity", gradientAnim.intensity);
    root.style.setProperty("--hud-gradient-opacity", gradientAnim.opacity);
    root.style.setProperty("--hud-gradient-blur", `${gradientAnim.blur}px`);

    // 🎬 Inject global HUD pulse keyframes (single source of truth)
    let styleTag = document.getElementById("hud-pulse-style");

    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "hud-pulse-style";
      document.head.appendChild(styleTag);
    }

    styleTag.innerHTML = `
@keyframes hudPulse {
  0% { scale: 1; opacity: 0.7; }
  50% { scale: var(--hud-gradient-intensity); opacity: var(--hud-gradient-opacity); }
  100% { scale: 1; opacity: 0.7; }
}
`;

    // 🐾 Pet colors (derived from petColor)
    const pet = theme.petColor || "#ffffff";
    const base = tinycolor(pet);

    const isLight = base.isLight();

    const outline = isLight
      ? base.clone().darken(60).toHexString()
      : base.clone().lighten(60).toHexString();

    const eyes = isLight
      ? base.clone().darken(35).toHexString()
      : base.clone().lighten(60).toHexString();

    const mouth = isLight
      ? base.clone().darken(50).toHexString()
      : base.clone().lighten(75).toHexString();

    root.style.setProperty("--pet-color", pet);
    root.style.setProperty("--pet-outline", outline);
    root.style.setProperty("--pet-eyes", eyes);
    root.style.setProperty("--pet-mouth", mouth);

    const stars = theme.starsColor || "#ffffff"
    const starsBase = tinycolor(stars)

    const glow = starsBase.clone().setAlpha(0.4).toRgbString()
    const glowStrong = starsBase.clone().setAlpha(0.8).toRgbString()

    root.style.setProperty("--stars-color", stars)
    root.style.setProperty("--stars-glow", glow)
    root.style.setProperty("--stars-glow-strong", glowStrong)

  }, [
    theme?.background,
    theme?.modelColor,
    theme?.petColor,
    theme?.starsColor,
    theme?.gradientAnimation
  ]);
  

  return children;
}
