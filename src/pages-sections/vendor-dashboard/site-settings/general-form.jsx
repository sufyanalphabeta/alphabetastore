import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

// MUI
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

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
  theme: yup.string().oneOf(AVAILABLE_THEME_KEYS).required("theme is required"),
  default_language: yup.string().oneOf(["ar", "en"]).required("default language is required"),
  default_currency: yup.string().oneOf(["LYD", "USD"]).required("default currency is required"),
  exchange_rate_usd_to_lyd: yup.number().moreThan(0).required("exchange rate is required"),
  auto_round_prices: yup.string().oneOf(["true", "false"]).required("Auto round prices setting is required"),
  primary_color: yup.string().matches(/^#[\dA-Fa-f]{6}$/, "Primary color must be a valid hex color"),
  enable_whatsapp: yup.string().oneOf(["true", "false"]).required("WhatsApp setting is required")
});

// â”€â”€ Image upload helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ImageUploadField({ label, settingKey, accept = "image/png,image/jpeg,image/jpg,image/svg+xml,image/webp" }) {
  const [preview, setPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inputRef = useRef(null);
  const { settings, refreshSettings } = useSettings();
  const currentUrl = settings?.[settingKey] || "";

  useEffect(() => {
    setPreview(currentUrl);
  }, [currentUrl]);

  const handleFileChange = async e => {
    const file = e.target.files?.[0];
    if (!file) return;

    // local preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setError("");
    setSuccess("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const endpoint = settingKey === "site_logo_url" ? "/admin/settings/logo" : "/admin/settings/favicon";
      const { getAccessToken } = await import("utils/auth");
      const token = getAccessToken();
      const res = await fetch(
        (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api/v1") + endpoint,
        { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Upload failed");
      }
      await refreshSettings();
      setSuccess(`${label} uploaded successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setPreview(currentUrl);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" mb={1}>{label}</Typography>
      <Stack direction="row" alignItems="center" gap={2}>
        {preview && (
          <Box
            component="img"
            src={preview}
            alt={label}
            sx={{ width: settingKey === "site_favicon_url" ? 32 : 80, height: settingKey === "site_favicon_url" ? 32 : 48, objectFit: "contain", border: "1px solid", borderColor: "grey.300", borderRadius: 1, p: 0.5, bgcolor: "grey.50" }}
          />
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <Button
          variant="outlined"
          size="small"
          color="info"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          startIcon={uploading ? <CircularProgress size={14} /> : undefined}
        >
          {uploading ? "Uploadingâ€¦" : preview ? "Replace" : "Upload"}
        </Button>
      </Stack>
      {success && <Typography variant="caption" color="success.main" display="block" mt={0.5}>{success}</Typography>}
      {error && <Typography variant="caption" color="error.main" display="block" mt={0.5}>{error}</Typography>}
      <Typography variant="caption" color="text.secondary">Supported: png, jpg, jpeg, svg, webp</Typography>
    </Box>
  );
}

// â”€â”€ Main form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function GeneralForm() {
  const {
    refreshSettings,
    updateSettings
  } = useSettings();
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const initialValues = {
    site_name: "",
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

        {/* Branding section */}
        <Grid size={12}>
          <Divider textAlign="left"><Typography variant="overline" color="text.secondary">Branding</Typography></Divider>
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField fullWidth color="info" size="medium" name="site_name" label="Site Name" />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <ImageUploadField label="Store Logo" settingKey="site_logo_url" />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <ImageUploadField label="Favicon" settingKey="site_favicon_url" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/x-icon" />
        </Grid>

        {/* Store settings section */}
        <Grid size={12}>
          <Divider textAlign="left"><Typography variant="overline" color="text.secondary">Store Settings</Typography></Divider>
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
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
