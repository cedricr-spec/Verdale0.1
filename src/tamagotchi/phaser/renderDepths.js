export const WORLD_TERRAIN_DEPTH = 1;
export const CHARACTER_SHADOW_DEPTH = 52;
export const VILLAGE_SHADOW_MASK_DEPTH = 52.5;
export const FIXED_MERCHANT_DEPTH = 52.8;
export const VILLAGE_MID_DEPTH = 53;
export const FARM_READY_BUBBLE_DEPTH = 53.5;
export const ENTITY_FX_DEPTH = 53.9;
export const ENTITY_SORT_BASE_DEPTH = 54;
export const ENTITY_SORT_STEP = 0.01;
export const CHARACTER_BODY_DEPTH = ENTITY_SORT_BASE_DEPTH;
export const VILLAGE_FRONT_DEPTH = 90;
export const NPC_SLEEP_BUBBLE_DEPTH = VILLAGE_FRONT_DEPTH + 0.5;
export const NPC_SPEECH_BUBBLE_DEPTH = VILLAGE_FRONT_DEPTH + 1;
// Circle wipe transition overlay — above all gameplay, below React DOM.
export const CIRCLE_TRANSITION_DEPTH = 150;
// Startup loading overlay — above iris so it hides the uninitialized world.
export const LOADING_SCREEN_DEPTH = 160;

export function getEntityDepthFromFeetY(feetScreenY = 0) {
  const safeFeetY = Number.isFinite(feetScreenY) ? feetScreenY : 0;
  return Math.min(
    VILLAGE_FRONT_DEPTH - 1,
    ENTITY_SORT_BASE_DEPTH + safeFeetY * ENTITY_SORT_STEP
  );
}

export function getVillageRenderPassDepth(pass = 'back') {
  switch (pass) {
    case 'shadowmask':
      return VILLAGE_SHADOW_MASK_DEPTH;
    case 'mid':
      return VILLAGE_MID_DEPTH;
    case 'front':
      return VILLAGE_FRONT_DEPTH;
    case 'back':
    default:
      return WORLD_TERRAIN_DEPTH;
  }
}

export function getMerchantDepthForVillagePassBand(
  lowerPass = 'back',
  upperPass = 'mid'
) {
  const lowerDepth = getVillageRenderPassDepth(lowerPass);
  const upperDepth = getVillageRenderPassDepth(upperPass);

  if (upperDepth > CHARACTER_SHADOW_DEPTH) {
    return Math.max(lowerDepth + 0.01, upperDepth - 0.2);
  }

  return lowerDepth + Math.max(0.01, (upperDepth - lowerDepth) * 0.5);
}
