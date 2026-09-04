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
export const AVAILABLE_THEME_KEYS = Object.keys(THEME_PRESETS);

function isValidHexColor(value) {
  return /^#([\da-fA-F]{6})$/.test(String(value || "").trim());
}

export default function themeOptions({
  themeKey,
  primaryColor,
  colorOverrides = {}
  } = {}) {
  const preset = THEME_PRESETS[normalizeThemeKey(themeKey)] || THEME_PRESETS.DEFAULT;
  const selectedPalette = getPalette(COLORS.DARK);
  const tokens = { ...preset.tokens };
  const overrideMap = { primary: "primary", secondary: "secondary", accent: "accent", headerBackground: "headerBackground", headerText: "headerText", navBackground: "navBackground", navText: "navText", pageBackground: "background", surface: "surface", cardBackground: "cardBackground", textPrimary: "text", textSecondary: "muted", border: "border", footerBackground: "footerBackground", footerText: "footerText", link: "link", ctaBackground: "ctaBackground", ctaText: "ctaText", ctaHover: "ctaHover" };
  Object.entries(overrideMap).forEach(([overrideKey, tokenKey]) => { if (isValidHexColor(colorOverrides[overrideKey])) tokens[tokenKey] = colorOverrides[overrideKey].trim(); });
  const primaryMain = isValidHexColor(primaryColor) ? primaryColor.trim() : tokens.primary;
  selectedPalette.primary = { ...selectedPalette.primary, main: primaryMain, light: lighten(primaryMain, 0.4), dark: darken(primaryMain, 0.25), contrastText: "#FFFFFF" };
  selectedPalette.secondary = { ...selectedPalette.secondary, main: tokens.secondary, dark: tokens.secondary, contrastText: "#FFFFFF" };
  selectedPalette.background = { default: tokens.background, paper: tokens.surface };
  selectedPalette.text = { primary: tokens.text, secondary: tokens.muted, disabled: tokens.muted };
  selectedPalette.divider = tokens.border;
  selectedPalette.success = { ...selectedPalette.success, main: tokens.success || selectedPalette.success.main };
  selectedPalette.warning = { ...selectedPalette.warning, main: tokens.warning || selectedPalette.warning.main };
  selectedPalette.error = { ...selectedPalette.error, main: tokens.error || selectedPalette.error.main };
  selectedPalette.info = { ...selectedPalette.info, main: tokens.info || selectedPalette.info.main };

  const themeOption = {
    typography: { ...typography, fontFamily: tokens.font },
    components: {
      ...components,
      MuiCssBaseline: {
        ...components.MuiCssBaseline,
        styleOverrides: {
          ...components.MuiCssBaseline.styleOverrides,
          body: { backgroundColor: tokens.background, color: tokens.text, "--store-primary": tokens.primary, "--store-primary-hover": tokens.primaryHover || tokens.primary, "--store-secondary": tokens.secondary, "--store-deep-tech-blue": tokens.deepTechBlue || tokens.secondary, "--store-accent": tokens.accent, "--store-page-bg": tokens.background, "--store-surface": tokens.surface, "--store-surface-subtle": tokens.surfaceSubtle || tokens.secondarySurface || tokens.surface, "--store-secondary-surface": tokens.secondarySurface || tokens.surface, "--store-card-bg": tokens.cardBackground || tokens.surface, "--store-text-primary": tokens.text, "--store-text-secondary": tokens.muted, "--store-border": tokens.border, "--store-header-bg": tokens.headerBackground || tokens.surface, "--store-header-text": tokens.headerText || tokens.text, "--store-nav-bg": tokens.navBackground || tokens.surface, "--store-nav-text": tokens.navText || tokens.text, "--store-cta-bg": tokens.ctaBackground || tokens.primary, "--store-cta-text": tokens.ctaText || "#FFFFFF", "--store-cta-hover": tokens.ctaHover || tokens.primaryHover || tokens.primary, "--store-link": tokens.link || tokens.primary, "--store-price": tokens.price || tokens.text, "--store-price-muted": tokens.priceMuted || tokens.muted, "--store-footer-bg": tokens.footerBackground || tokens.secondary, "--store-footer-text": tokens.footerText || "#FFFFFF", "--store-success": tokens.success || "#10B981", "--store-warning": tokens.warning || "#F59E0B", "--store-error": tokens.error || "#EF4444", "--store-info": tokens.info || "#0284C7", "--store-promo": tokens.promo || "#F97316", "--store-card-radius": `${tokens.radius}px`, "--store-control-radius": `${tokens.controlRadius ?? Math.max(4, tokens.radius / 2)}px`, "--store-card-shadow": tokens.shadow },
          '[data-store-theme="BAZAAR_ELECTRONICS"] .homepage-products-block .MuiCard-root': { borderRadius: 2, boxShadow: tokens.shadow },
          '[data-store-theme="BAZAAR_ELECTRONICS"] .homepage-category-block .MuiCard-root': { borderTop: `3px solid ${tokens.primary}` },
          '[data-store-theme="BAZAAR_FASHION"] .homepage-products-block .MuiCard-root': { borderRadius: 1, boxShadow: "none", border: `1px solid ${tokens.border}` },
          '[data-store-theme="BAZAAR_GROCERY"] .homepage-products-block .MuiCard-root': { borderRadius: 1, boxShadow: tokens.shadow },
          '[data-store-theme="BAZAAR_HEALTH"] .homepage-trust-strip': { backgroundColor: tokens.background },
          '[data-store-theme="BAZAAR_GIFT"] .homepage-products-block .MuiCard-root': { borderRadius: 3, boxShadow: tokens.shadow },
          '[data-store-theme="BAZAAR_GENERAL"] .homepage-products-block .MuiCard-root': { borderRadius: 2, boxShadow: tokens.shadow }
        }
      },
      MuiCard: {
        ...components.MuiCard,
        styleOverrides: { ...components.MuiCard.styleOverrides, root: { ...components.MuiCard.styleOverrides.root, borderRadius: tokens.radius } }
      },
      MuiOutlinedInput: {
        ...components.MuiOutlinedInput,
        styleOverrides: { ...components.MuiOutlinedInput.styleOverrides, root: { ...components.MuiOutlinedInput.styleOverrides.root, borderRadius: tokens.radius / 2 } }
      }
    },
    breakpoints,
    palette: selectedPalette,
    shape: { borderRadius: tokens.radius },
    shadows: Array.from({ length: 25 }, (_, index) => index === 0 ? "none" : tokens.shadow),
    custom: {
      presetCode: preset.code,
      variants: preset.variants,
      density: tokens.density,
      accent: tokens.accent,
      resolvedTokens: tokens,
      colorOverrides
    }
  };
  return themeOption;
}
