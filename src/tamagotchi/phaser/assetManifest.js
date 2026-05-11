import { WORLD_THEME_CONFIG } from '../config/worldThemeConfig';
import { WORLD_SEASON_IDS } from '../config/worldSeasonConfig';
import { DEFAULT_CHARACTER_SHADOW } from '../config/characterRoster';
import { getVillageTextureAssets } from '../utils/worldVillage';
/**
 * World atlas textures — one PNG per season, all share the same sprite
 * coordinate layout defined in atlas-clean-v1.json.
 *
 * The URLs here are Vite-resolved (hashed) at import time, so they work
 * both in dev and in prod builds without any path remapping.
 */
export const WORLD_ATLAS_TEXTURES = [
  {
    key: 'atlas_spring',
    url: WORLD_THEME_CONFIG[WORLD_SEASON_IDS.SPRING].atlasImage,
  },
  {
    key: 'atlas_summer',
    url: WORLD_THEME_CONFIG[WORLD_SEASON_IDS.SUMMER].atlasImage,
  },
  {
    key: 'atlas_autumn',
    url: WORLD_THEME_CONFIG[WORLD_SEASON_IDS.AUTUMN].atlasImage,
  },
  {
    key: 'atlas_winter',
    url: WORLD_THEME_CONFIG[WORLD_SEASON_IDS.WINTER].atlasImage,
  },
];

export const WORLD_VILLAGE_TEXTURES = getVillageTextureAssets();

/**
 * Character shadow sprite — shared by every character in the roster.
 * Lives under public/pets/ so the path is static.
 */
export const CHARACTER_SHADOW_ASSET = {
  key: 'character_shadow',
  url: DEFAULT_CHARACTER_SHADOW.sprite,
};

export const NPC_BASIC_SPRITESHEET_ASSET = {
  key: 'npc_basic',
  url: '/npc/Basic_NPC.png',
  frameWidth: 24,
  frameHeight: 24,
};

export const MERCHANT_NPC_SPRITESHEET_ASSET = {
  key: 'merchant_npc',
  url: '/npc/Merchant_NPC.png',
  frameWidth: 24,
  frameHeight: 24,
};

export function getMerchantNpcSpritesheetAsset() {
  return MERCHANT_NPC_SPRITESHEET_ASSET;
}

export const NPC_SLEEP_BUBBLES_ASSET = {
  key: 'npc_sleep_bubbles',
  url: '/npc/NPC_sleepingbubbles.png',
  frameWidth: 16,
  frameHeight: 16,
};

export const NPC_SPEECH_BUBBLE_ASSET = {
  key: 'npc_speech_bubble',
  url: '/npc/speech_bubble.png',
};

export const NPC_EMOJI_REACTIONS_ASSET = {
  key: 'npc_emoji_reactions',
  url: '/npc/emoji_reactions_npc.png',
  frameWidth: 16,
  frameHeight: 16,
};

/** Flat list of every asset this manifest declares. */
export const ALL_ASSETS = [
  ...WORLD_ATLAS_TEXTURES,
  ...WORLD_VILLAGE_TEXTURES,
  CHARACTER_SHADOW_ASSET,
  NPC_BASIC_SPRITESHEET_ASSET,
  MERCHANT_NPC_SPRITESHEET_ASSET,
  NPC_SLEEP_BUBBLES_ASSET,
  NPC_SPEECH_BUBBLE_ASSET,
  NPC_EMOJI_REACTIONS_ASSET,
];
