"use client";

import { useEffect, useState } from "react";

import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import { createTheme, ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import merge from "lodash/merge";
import useSettings from "hooks/useSettings";
import customThemeOptions from "./theme-options";
import { normalizeThemeKey, THEME_PRESETS } from "./theme-presets";
export default function ThemeProvider({
  children
}) {
  const {
    settings
  } = useSettings();
  const [previewTheme, setPreviewTheme] = useState("");
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setPreviewTheme(query.get("themePreview") || "");
  }, []);
  const activeThemeKey = previewTheme ? normalizeThemeKey(previewTheme) : settings.theme;
  const activeTheme = THEME_PRESETS[activeThemeKey];
  const themeOptions = customThemeOptions({
    themeKey: activeThemeKey,
    primaryColor: previewTheme ? "" : settings.primary_color
  });
  const mergedThemeOptions = merge({}, themeOptions, {
    direction: settings.direction
  });
  const theme = createTheme(mergedThemeOptions);

  useEffect(() => {
    document.documentElement.dataset.storeTheme = theme.custom?.presetCode || "BAZAAR_GENERAL";
  }, [theme.custom?.presetCode]);
  return <LocalizationProvider dateAdapter={AdapterDateFns}>
      <AppRouterCacheProvider options={{
      key: "css"
    }}>
        <MuiThemeProvider theme={theme}>
          <CssBaseline />
          {previewTheme && activeTheme ? <Box sx={{ position: "fixed", top: 8, left: "50%", transform: "translateX(-50%)", zIndex: theme.zIndex.tooltip + 1, display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75, borderRadius: 2, bgcolor: "#111827", color: "white", boxShadow: 4, fontSize: 13 }}>
            <span>معاينة قالب: {activeTheme.nameAr}</span>
            <Button size="small" variant="contained" color="warning" href="/vendor/site-settings">تطبيق القالب</Button>
            <Button size="small" sx={{ color: "white" }} onClick={() => window.history.back()}>خروج</Button>
          </Box> : null}
          {children}
        </MuiThemeProvider>
      </AppRouterCacheProvider>
    </LocalizationProvider>;
}
