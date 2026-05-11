import { useMemo } from "react";
import { getWorldThemeConfig } from "../config/worldThemeConfig";
import { useWorldStore } from "../store/worldSlice";

export default function useWorldTheme() {
  const themeId = useWorldStore((state) => state.currentWorldTheme);

  return useMemo(() => getWorldThemeConfig(themeId), [themeId]);
}
