export const HUD_GAUGE_FRAMES = {
  full:    { x: 0,   y: 240, w: 48, h: 16 },

  level1:  { x: 0,   y: 256, w: 48, h: 16 },
  level2:  { x: 0,   y: 272, w: 48, h: 16 },
  level3:  { x: 0,   y: 288, w: 48, h: 16 },
  level4:  { x: 0,   y: 304, w: 48, h: 16 },

  level5:  { x: 48,  y: 320, w: 48, h: 16 },
  level6:  { x: 48,  y: 336, w: 48, h: 16 },
  level7:  { x: 48,  y: 352, w: 48, h: 16 },

  level8:  { x: 96,  y: 368, w: 48, h: 16 },
  level9:  { x: 96,  y: 384, w: 48, h: 16 },
  level10: { x: 96,  y: 400, w: 48, h: 16 },

  empty:   { x: 144, y: 208, w: 48, h: 16 },
};

export function getGaugeFrameFromPercent(percent) {
  if (percent >= 100) return HUD_GAUGE_FRAMES.full;
  if (percent >= 90)  return HUD_GAUGE_FRAMES.level1;
  if (percent >= 80)  return HUD_GAUGE_FRAMES.level2;
  if (percent >= 70)  return HUD_GAUGE_FRAMES.level3;
  if (percent >= 60)  return HUD_GAUGE_FRAMES.level4;
  if (percent >= 50)  return HUD_GAUGE_FRAMES.level5;
  if (percent >= 40)  return HUD_GAUGE_FRAMES.level6;
  if (percent >= 30)  return HUD_GAUGE_FRAMES.level7;
  if (percent >= 20)  return HUD_GAUGE_FRAMES.level8;
  if (percent >= 10)  return HUD_GAUGE_FRAMES.level9;
  if (percent >= 1)   return HUD_GAUGE_FRAMES.level10;
  return HUD_GAUGE_FRAMES.empty;
}
