import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

// MUI
import Alert from "@mui/material/Alert";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";

import useSettings from "hooks/useSettings";
import { apiGet, apiPatch } from "utils/api";
import { FormProvider, TextField } from "components/form-hook";
import { AVAILABLE_THEME_KEYS } from "theme/theme-options";

const THEME_LABELS = {
  default: "Default",
  dark: "Dark",
  electronics: "Electronics",
  fashion: "Fashion",
  red: "Red",
  green: "Green",
  orange: "Orange",
  gold: "Gold",
  gift: "Gift",
  paste: "Paste",
  health: "Health",
  bluish: "Bluish",
  yellow: "Yellow"
};

const validationSchema = yup.object().shape({
  site_name: yup.string().required("site name is required"),
  site_logo_url: yup.string().url("Must be a valid URL").optional().nullable(),
  theme: yup.string().oneOf(AVAILABLE_THEME_KEYS).required("theme is required"),
  default_language: yup.string().oneOf(["ar", "en"]).required("default language is required"),
  default_currency: yup.string().oneOf(["LYD", "USD"]).required("default currency is required"),
  exchange_rate_usd_to_lyd: yup.number().moreThan(0).required("exchange rate is required"),
  auto_round_prices: yup.string().oneOf(["true", "false"]).required("Auto round prices setting is required"),
  primary_color: yup.string().matches(/^#[\dA-Fa-f]{6}$/, "Primary color must be a valid hex color"),
  enable_whatsapp: yup.string().oneOf(["true", "false"]).required("WhatsApp setting is required")
});

export default function GeneralForm() {
  const {
    refreshSettings,
    updateSettings
  } = useSettings();
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const initialValues = {
    site_name: "",
    site_logo_url: "",
    theme: "default",
    default_language: "ar",
    default_currency: "LYD",
    exchange_rate_usd_to_lyd: 5.2,
    auto_round_prices: "false",
    primary_color: "#1976d2",
    enable_whatsapp: "true"
  };

  const methods = useForm({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema)
  });

  const {
    reset,
    handleSubmit,
    formState: {
      isSubmitting
    }
  } = methods;

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await apiGet("/settings");
        reset({
          site_name: String(response?.site_name || ""),
          site_logo_url: String(response?.site_logo_url || ""),
          theme: String(response?.theme || "default"),
          default_language: response?.default_language === "en" ? "en" : "ar",
          default_currency: String(response?.default_currency || "LYD").toUpperCase() === "USD" ? "USD" : "LYD",
          exchange_rate_usd_to_lyd: Number(response?.exchange_rate_usd_to_lyd || 5.2),
          auto_round_prices: String(response?.auto_round_prices ?? "false"),
          primary_color: String(response?.primary_color || "#1976d2"),
          enable_whatsapp: String(response?.enable_whatsapp ?? "true")
        });
      } catch {
        // Keep defaults when settings cannot be fetched.
      }
    };

    loadSettings();
  }, [reset]);

  const handleSubmitForm = handleSubmit(async values => {
    setSubmitError("");
    setSubmitSuccess("");

    const entries = [{
      key: "site_name",
      value: values.site_name
    }, {
      key: "site_logo_url",
      value: values.site_logo_url || ""
    }, {
      key: "theme",
      value: values.theme
    }, {
      key: "default_language",
      value: values.default_language
    }, {
      key: "direction",
      value: values.default_language === "ar" ? "rtl" : "ltr"
    }, {
      key: "default_currency",
      value: values.default_currency
    }, {
      key: "exchange_rate_usd_to_lyd",
      value: String(values.exchange_rate_usd_to_lyd)
    }, {
      key: "auto_round_prices",
      value: values.auto_round_prices
    }, {
      key: "primary_color",
      value: values.primary_color
    }, {
      key: "enable_whatsapp",
      value: values.enable_whatsapp
    }];

    try {
      await Promise.all(entries.map(item => apiPatch("/admin/settings", item)));

      updateSettings({
        site_name: values.site_name,
        site_logo_url: values.site_logo_url || "",
        theme: values.theme,
        default_language: values.default_language,
        direction: values.default_language === "ar" ? "rtl" : "ltr",
        default_currency: values.default_currency,
        exchange_rate_usd_to_lyd: String(values.exchange_rate_usd_to_lyd),
        auto_round_prices: values.auto_round_prices,
        primary_color: values.primary_color,
        enable_whatsapp: values.enable_whatsapp
      });

      await refreshSettings();
      setSubmitSuccess("System settings updated successfully.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update settings.");
    }
  });

  return <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      <Grid container spacing={3}>
        {submitSuccess ? <Grid size={12}>
            <Alert severity="success">{submitSuccess}</Alert>
          </Grid> : null}

        {submitError ? <Grid size={12}>
            <Alert severity="error">{submitError}</Alert>
          </Grid> : null}

        <Grid size={{
        md: 6,
        xs: 12
      }}>
          <TextField fullWidth color="info" size="medium" name="site_name" label="Site Name" />
        </Grid>

        <Grid size={12}>
          <TextField fullWidth color="info" size="medium" name="site_logo_url" label="Logo URL (optional)" placeholder="https://example.com/logo.png" />
        </Grid>

        <Grid size={{
        md: 6,
        xs: 12
      }}>
          <TextField select fullWidth color="info" size="medium" name="enable_whatsapp" label="Enable WhatsApp">
            <MenuItem value="true">Enabled</MenuItem>
            <MenuItem value="false">Disabled</MenuItem>
          </TextField>
        </Grid>

        <Grid size={12}>
          <TextField select fullWidth color="info" size="medium" name="theme" label="Store Theme">
            {AVAILABLE_THEME_KEYS.map(themeKey => <MenuItem key={themeKey} value={themeKey}>
                {THEME_LABELS[themeKey] || themeKey}
              </MenuItem>)}
          </TextField>
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField select fullWidth color="info" size="medium" name="default_language" label="Default Language">
            <MenuItem value="ar">Arabic</MenuItem>
            <MenuItem value="en">English</MenuItem>
          </TextField>
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField select fullWidth color="info" size="medium" name="default_currency" label="Default Currency">
            <MenuItem value="LYD">LYD</MenuItem>
            <MenuItem value="USD">USD</MenuItem>
          </TextField>
        </Grid>

        <Grid size={12}>
          <TextField fullWidth color="info" size="medium" name="exchange_rate_usd_to_lyd" type="number" label="USD to LYD Exchange Rate" />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField select fullWidth color="info" size="medium" name="auto_round_prices" label="Auto Round Prices">
            <MenuItem value="false">No rounding (2 decimal places)</MenuItem>
            <MenuItem value="true">Round to whole numbers</MenuItem>
          </TextField>
        </Grid>

        <Grid size={12}>
          <TextField fullWidth color="info" size="medium" name="primary_color" label="Primary Color" placeholder="#1976d2" />
        </Grid>

        <Grid size={12}>
          <Button disabled={isSubmitting} type="submit" color="info" variant="contained">
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </Grid>
      </Grid>
    </FormProvider>;
}