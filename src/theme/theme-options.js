import { darken, lighten } from "@mui/material/styles";
import { components, typography, getPalette } from "./core";
import { COLORS } from "./types";
import { normalizeThemeKey, THEME_PRESETS } from "./theme-presets";
const breakpoints = {
  values: {
    xs: 0,
    sm: 600,
    md: 960,
    lg: 1280,
    xl: 1600,
    xxl: 1920
  }
};
const themeColorMap = {
  default: COLORS.BLUISH,
  dark: COLORS.DARK,
  electronics: COLORS.BLUISH,
  fashion: COLORS.GOLD,
  red: COLORS.RED,
  green: COLORS.GREEN,
  orange: COLORS.ORANGE,
  gold: COLORS.GOLD,
  gift: COLORS.GIFT,
  paste: COLORS.PASTE,
  health: COLORS.HEALTH,
  bluish: COLORS.BLUISH,
  yellow: COLORS.YELLOW
};

export const AVAILABLE_THEME_KEYS = Object.keys(THEME_PRESETS);

function isValidHexColor(value) {
  return /^#([\da-fA-F]{6})$/.test(String(value || "").trim());
}

function resolveThemeColor(themeKey) {
  const key = normalizeThemeKey(themeKey).toLowerCase();
  return themeColorMap[key] || COLORS.DARK;
}

export default function themeOptions({
  themeKey,
  primaryColor
} = {}) {
  const preset = THEME_PRESETS[normalizeThemeKey(themeKey)] || THEME_PRESETS.DEFAULT;
  const selectedPalette = getPalette(resolveThemeColor(themeKey));
  const { tokens } = preset;
  const primaryMain = isValidHexColor(primaryColor) ? primaryColor.trim() : tokens.primary;
  selectedPalette.primary = { ...selectedPalette.primary, main: primaryMain, light: lighten(primaryMain, 0.4), dark: darken(primaryMain, 0.25), contrastText: "#FFFFFF" };
  selectedPalette.secondary = { ...selectedPalette.secondary, main: tokens.secondary, dark: tokens.secondary, contrastText: "#FFFFFF" };
  selectedPalette.background = { default: tokens.background, paper: tokens.surface };
  selectedPalette.text = { primary: tokens.text, secondary: tokens.muted, disabled: tokens.muted };
  selectedPalette.divider = tokens.border;

  const themeOption = {
    typography,
    components,
    breakpoints,
    palette: selectedPalette,
    shape: { borderRadius: tokens.radius },
    shadows: Array.from({ length: 25 }, (_, index) => index === 0 ? "none" : tokens.shadow)
  };
  return themeOption;
}
