"use client";

import { useEffect } from "react";

import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import merge from "lodash/merge";
import useSettings from "hooks/useSettings";
import customThemeOptions from "./theme-options";
export default function ThemeProvider({
  children
}) {
  const {
    settings
  } = useSettings();
  const themeOptions = customThemeOptions({
    themeKey: settings.theme,
    primaryColor: settings.primary_color
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
          {children}
        </MuiThemeProvider>
      </AppRouterCacheProvider>
    </LocalizationProvider>;
}
