import springAtlasImage from "../../spritesheets/atlas/All tiles Spring.png";
import summerAtlasImage from "../../spritesheets/atlas/All tiles Summer.png";
import autumnAtlasImage from "../../spritesheets/atlas/All tiles Autumn.png";
import winterAtlasImage from "../../spritesheets/atlas/All tiles Winter.png";
import {
  DEFAULT_WORLD_SEASON,
  WORLD_SEASON_IDS,
} from "./worldSeasonConfig";
import { WORLD_ATLAS_DATA } from "../utils/worldAtlasData";

export const WORLD_THEME_IDS = WORLD_SEASON_IDS;

export const DEFAULT_WORLD_THEME = DEFAULT_WORLD_SEASON;

export const WORLD_THEME_CONFIG = {
  [WORLD_THEME_IDS.SPRING]: {
    id: WORLD_THEME_IDS.SPRING,
    label: "Spring",
    atlasImage: springAtlasImage,
    atlasData: WORLD_ATLAS_DATA,
    backgroundColor: "#75ad4c",
  },
  [WORLD_THEME_IDS.SUMMER]: {
    id: WORLD_THEME_IDS.SUMMER,
    label: "Summer",
    atlasImage: summerAtlasImage,
    atlasData: WORLD_ATLAS_DATA,
    backgroundColor: "#6eaf48",
  },
  [WORLD_THEME_IDS.AUTUMN]: {
    id: WORLD_THEME_IDS.AUTUMN,
    label: "Autumn",
    atlasImage: autumnAtlasImage,
    atlasData: WORLD_ATLAS_DATA,
    backgroundColor: "#8e7b41",
  },
  [WORLD_THEME_IDS.WINTER]: {
    id: WORLD_THEME_IDS.WINTER,
    label: "Winter",
    atlasImage: winterAtlasImage,
    atlasData: WORLD_ATLAS_DATA,
    backgroundColor: "#8ba6b5",
  },
};

export function getWorldThemeConfig(themeId = DEFAULT_WORLD_THEME) {
  return WORLD_THEME_CONFIG[themeId] || WORLD_THEME_CONFIG[DEFAULT_WORLD_THEME];
}

export function isWorldThemeAvailable(themeId) {
  return Boolean(WORLD_THEME_CONFIG[themeId]);
}
