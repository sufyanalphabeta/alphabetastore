import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

// MUI
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";

import useSettings from "hooks/useSettings";
import { apiGet, apiPatch } from "utils/api";
import { FormProvider, TextField } from "components/form-hook";
import { THEME_PRESETS, THEME_PRESET_KEYS, normalizeThemeKey } from "theme/theme-presets";

const validationSchema = yup.object().shape({
  site_name: yup.string().required("site name is required"),
  theme: yup.string().oneOf(THEME_PRESET_KEYS).required("theme is required"),
  default_language: yup.string().oneOf(["ar", "en"]).required("default language is required"),
  default_currency: yup.string().oneOf(["LYD", "USD"]).required("default currency is required"),
  exchange_rate_usd_to_lyd: yup.number().moreThan(0).required("exchange rate is required"),
  auto_round_prices: yup.string().oneOf(["true", "false"]).required("Auto round prices setting is required"),
  primary_color: yup.string().test("hex-or-empty", "Primary color must be a valid hex color", value => !value || /^#[\dA-Fa-f]{6}$/.test(value)),
  color_overrides: yup.object().nullable(),
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

function ColorField({ name, label, value, onChange = () => {}, defaultValue }) {
  const resolved = /^#[\dA-Fa-f]{6}$/.test(value || "") ? value : defaultValue;
  return <Grid size={{ xs: 12, sm: 6, md: 4 }}><Stack direction="row" spacing={1} alignItems="center"><Box component="input" type="color" value={resolved} onChange={event => onChange(event.target.value)} aria-label={label} sx={{ width: 52, height: 42, p: 0.5, border: "1px solid", borderColor: "divider", borderRadius: 1, bgcolor: "transparent" }} /><TextField fullWidth name={name} label={`${label} HEX`} placeholder={defaultValue} /></Stack></Grid>;
}

// â”€â”€ Main form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function GeneralForm() {
  const {
    refreshSettings,
    updateSettings
  } = useSettings();
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [colorMode, setColorMode] = useState("theme");

  const initialValues = {
    site_name: "",
    theme: "DEFAULT",
    default_language: "ar",
    default_currency: "LYD",
    exchange_rate_usd_to_lyd: 5.2,
    auto_round_prices: "false",
    primary_color: "#1976d2",
    color_overrides: {},
    enable_whatsapp: "true"
    ,shop_phone: ""
    ,shop_address: ""
    ,support_email: ""
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
          theme: normalizeThemeKey(response?.theme || "DEFAULT"),
          default_language: response?.default_language === "en" ? "en" : "ar",
          default_currency: String(response?.default_currency || "LYD").toUpperCase() === "USD" ? "USD" : "LYD",
          exchange_rate_usd_to_lyd: Number(response?.exchange_rate_usd_to_lyd || 5.2),
          auto_round_prices: String(response?.auto_round_prices ?? "false"),
          primary_color: String(response?.primary_color || ""),
          color_overrides: typeof response?.color_overrides === "object" ? response.color_overrides : (() => { try { return JSON.parse(String(response?.color_overrides || "{}")); } catch { return {}; } })(),
          enable_whatsapp: String(response?.enable_whatsapp ?? "true"),
          shop_phone: String(response?.shop_phone || ""),
          shop_address: String(response?.shop_address || ""),
          support_email: String(response?.support_email || "")
        });
        setColorMode(response?.color_overrides ? "custom" : "theme");
      } catch {
        // Keep defaults when settings cannot be fetched.
      }
    };

    loadSettings();
  }, [reset]);

  const handleSubmitForm = handleSubmit(async values => {
    setSubmitError("");
    setSubmitSuccess("");

    const allowedColorKeys = ["primary", "secondary", "accent", "headerBackground", "headerText", "navBackground", "navText", "background", "surface", "text", "muted", "border", "footerBackground", "footerText", "link", "ctaBackground", "ctaText", "ctaHover"];
    const colorOverrides = colorMode === "custom" ? Object.fromEntries(allowedColorKeys.filter(key => /^#[\dA-Fa-f]{6}$/.test(values.color_overrides?.[key] || "")).map(key => [key, values.color_overrides[key]])) : {};
    const entries = [{
      key: "site_name",
      value: values.site_name
    }, {
      key: "theme",
      value: normalizeThemeKey(values.theme)
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
      value: colorOverrides.primary || ""
    }, {
      key: "color_overrides",
      value: JSON.stringify(colorOverrides)
    }, {
      key: "enable_whatsapp",
      value: values.enable_whatsapp
    }, {
      key: "shop_phone",
      value: values.shop_phone
    }, {
      key: "shop_address",
      value: values.shop_address
    }, {
      key: "support_email",
      value: values.support_email
    }];

    try {
      await Promise.all(entries.map(item => apiPatch("/admin/settings", item)));

      updateSettings({
        site_name: values.site_name,
        theme: normalizeThemeKey(values.theme),
        default_language: values.default_language,
        direction: values.default_language === "ar" ? "rtl" : "ltr",
        default_currency: values.default_currency,
        exchange_rate_usd_to_lyd: String(values.exchange_rate_usd_to_lyd),
        auto_round_prices: values.auto_round_prices,
        primary_color: colorOverrides.primary || "",
        color_overrides: colorOverrides,
        enable_whatsapp: values.enable_whatsapp,
        shop_phone: values.shop_phone,
        shop_address: values.shop_address,
        support_email: values.support_email
      });

      await refreshSettings();
      setSubmitSuccess("System settings updated successfully.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update settings.");
    }
  });

  const tabs = ["الهوية", "التصميم والمظهر", "اللغة والعملة", "التواصل", "التكاملات", "الإعدادات المتقدمة"];
  const colorField = key => ({ value: methods.watch(`color_overrides.${key}`), onChange: value => methods.setValue(`color_overrides.${key}`, value, { shouldDirty: true }) });

  return <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="scrollable" scrollButtons="auto" sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
        {tabs.map(label => <Tab key={label} label={label} />)}
      </Tabs>

      <Grid container spacing={3}>
        {submitSuccess ? <Grid size={12}>
            <Alert severity="success">{submitSuccess}</Alert>
          </Grid> : null}

        {submitError ? <Grid size={12}>
            <Alert severity="error">{submitError}</Alert>
          </Grid> : null}

        {activeTab === 0 ? <>
        <Grid size={12}><Divider textAlign="left"><Typography variant="overline" color="text.secondary">هوية المتجر</Typography></Divider></Grid>
        <Grid size={{ md: 6, xs: 12 }}><TextField fullWidth color="info" size="medium" name="site_name" label="اسم المتجر" /></Grid>
        <Grid size={{ md: 6, xs: 12 }}><ImageUploadField label="شعار المتجر" settingKey="site_logo_url" /></Grid>
        <Grid size={{ md: 6, xs: 12 }}><ImageUploadField label="أيقونة المتصفح" settingKey="site_favicon_url" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/x-icon" /></Grid>
        </> : null}

        {activeTab === 1 ? <Grid size={12}>
          <Typography variant="subtitle1" mb={1}>قالب المتجر</Typography>
          <Alert severity="info" sx={{ mb: 2 }}>ابدأ بقالب الإلكترونيات؛ القوالب الأخرى مسجلة للتوسع وستظهر بعد اعتماد تصميمها.</Alert>
          <Stack direction="row" spacing={2} mb={2} flexWrap="wrap" useFlexGap>
            <Button type="button" variant={colorMode === "theme" ? "contained" : "outlined"} onClick={() => { setColorMode("theme"); methods.setValue("color_overrides", {}); }}>● ألوان القالب</Button>
            <Button type="button" variant={colorMode === "custom" ? "contained" : "outlined"} onClick={() => setColorMode("custom")}>○ تخصيص ألوان المتجر</Button>
          </Stack>
          <Grid container spacing={1.5}>{THEME_PRESET_KEYS.filter(themeKey => ["BAZAAR_ELECTRONICS", "BAZAAR_GENERAL"].includes(themeKey)).map(themeKey => {
            const preset = THEME_PRESETS[themeKey];
            const selected = methods.watch("theme") === themeKey;
            return <Grid key={themeKey} size={{ xs: 12, sm: 6 }}><Box onClick={() => { methods.setValue("theme", themeKey, { shouldDirty: true, shouldValidate: true }); methods.setValue("primary_color", "", { shouldDirty: true, shouldValidate: true }); }} sx={{ p: 1.5, cursor: "pointer", border: "2px solid", borderColor: selected ? preset.tokens.primary : "divider", borderRadius: 2, bgcolor: preset.tokens.surface, color: preset.tokens.text, boxShadow: selected ? 3 : 0 }}><Box sx={{ height: 112, borderRadius: 1.5, mb: 1.25, p: 1, bgcolor: preset.tokens.background, border: `1px solid ${preset.tokens.border}` }}><Box sx={{ height: 14, borderRadius: 0.5, bgcolor: preset.tokens.secondary, mb: 1 }} /><Box sx={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 0.75, height: 70 }}><Box sx={{ borderRadius: 0.5, bgcolor: preset.tokens.primary, p: 1 }}><Box sx={{ bgcolor: preset.tokens.surface, height: 8, width: "65%", mt: 2 }} /></Box><Box sx={{ borderRadius: 0.5, bgcolor: preset.tokens.surface, border: `1px solid ${preset.tokens.border}` }} /><Box sx={{ borderRadius: 0.5, bgcolor: preset.tokens.accent }} /></Box></Box><Typography fontWeight={700}>{preset.nameAr}</Typography><Typography variant="caption" color="text.secondary" display="block">{preset.description}</Typography><Stack direction="row" spacing={1} alignItems="center" mt={1}><Button type="button" size="small" variant="outlined" onClick={event => { event.stopPropagation(); window.open(`/market-1?themePreview=${encodeURIComponent(themeKey)}`, "_blank", "noopener,noreferrer"); }}>معاينة المتجر</Button>{selected ? <Chip size="small" color="success" label="القالب الحالي" /> : null}</Stack></Box></Grid>;
          })}</Grid>
          {colorMode === "custom" ? <Box sx={{ mt: 3, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Typography fontWeight={700} mb={2}>تخصيص الألوان</Typography>
            <Typography variant="subtitle2" mb={1}>العلامة التجارية</Typography>
            <Grid container spacing={2}><ColorField name="color_overrides.primary" label="الأساسي" defaultValue={THEME_PRESETS.BAZAAR_ELECTRONICS.tokens.primary} {...colorField("primary")} /><ColorField name="color_overrides.secondary" label="الثانوي" defaultValue={THEME_PRESETS.BAZAAR_ELECTRONICS.tokens.secondary} {...colorField("secondary")} /><ColorField name="color_overrides.accent" label="Accent" defaultValue={THEME_PRESETS.BAZAAR_ELECTRONICS.tokens.accent} {...colorField("accent")} /></Grid>
            <Typography variant="subtitle2" mt={2} mb={1}>الرأس والتنقل</Typography>
            <Grid container spacing={2}><ColorField name="color_overrides.headerBackground" label="خلفية الهيدر" defaultValue="#FFFFFF" {...colorField("headerBackground")} /><ColorField name="color_overrides.headerText" label="نص الهيدر" defaultValue="#1F2937" {...colorField("headerText")} /><ColorField name="color_overrides.navBackground" label="خلفية القائمة" defaultValue={THEME_PRESETS.BAZAAR_ELECTRONICS.tokens.secondary} {...colorField("navBackground")} /><ColorField name="color_overrides.navText" label="نص القائمة" defaultValue="#FFFFFF" {...colorField("navText")} /></Grid>
            <Typography variant="subtitle2" mt={2} mb={1}>المحتوى والأزرار</Typography>
            <Grid container spacing={2}><ColorField name="color_overrides.background" label="خلفية الصفحة" defaultValue={THEME_PRESETS.BAZAAR_ELECTRONICS.tokens.background} {...colorField("background")} /><ColorField name="color_overrides.surface" label="البطاقات" defaultValue="#FFFFFF" {...colorField("surface")} /><ColorField name="color_overrides.text" label="النص الأساسي" defaultValue={THEME_PRESETS.BAZAAR_ELECTRONICS.tokens.text} {...colorField("text")} /><ColorField name="color_overrides.muted" label="النص الثانوي" defaultValue={THEME_PRESETS.BAZAAR_ELECTRONICS.tokens.muted} {...colorField("muted")} /><ColorField name="color_overrides.border" label="الحدود" defaultValue={THEME_PRESETS.BAZAAR_ELECTRONICS.tokens.border} {...colorField("border")} /><ColorField name="color_overrides.ctaBackground" label="خلفية CTA" defaultValue={THEME_PRESETS.BAZAAR_ELECTRONICS.tokens.primary} {...colorField("ctaBackground")} /><ColorField name="color_overrides.ctaText" label="نص CTA" defaultValue="#FFFFFF" {...colorField("ctaText")} /></Grid>
            <Button type="button" size="small" sx={{ mt: 2 }} onClick={() => { setColorMode("theme"); methods.setValue("color_overrides", {}); }}>إعادة الألوان الافتراضية</Button>
          </Box> : <Typography variant="caption" color="text.secondary">سيتم استخدام ألوان بيتا الافتراضية، ويمكنك تفعيل التخصيص عند الحاجة.</Typography>}
        </Grid> : null}

        {activeTab === 2 ? <>
        <Grid size={12}><Divider textAlign="left"><Typography variant="overline" color="text.secondary">اللغة والعملة</Typography></Divider></Grid>
        <Grid size={{ md: 6, xs: 12 }}>
          <TextField select fullWidth color="info" size="medium" name="default_language" label="Default Language">
            <MenuItem value="ar">العربية</MenuItem><MenuItem value="en">English</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ md: 6, xs: 12 }}>
          <TextField select fullWidth color="info" size="medium" name="default_currency" label="عملة العرض للعملاء">
            <MenuItem value="LYD">الدينار الليبي (د.ل)</MenuItem><MenuItem value="USD">الدولار (للاستخدام الداخلي فقط)</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ md: 6, xs: 12 }}><TextField fullWidth color="info" size="medium" name="exchange_rate_usd_to_lyd" type="number" label="سعر صرف الدولار إلى الدينار" /></Grid>
        <Grid size={{ md: 6, xs: 12 }}>
          <TextField select fullWidth color="info" size="medium" name="auto_round_prices" label="تقريب الأسعار">
            <MenuItem value="false">بدون تقريب</MenuItem><MenuItem value="true">تقريب إلى أرقام صحيحة</MenuItem>
          </TextField>
        </Grid>
        </> : null}

        {activeTab === 3 ? <>
        <Grid size={12}><Divider textAlign="left"><Typography variant="overline" color="text.secondary">بيانات التواصل</Typography></Divider></Grid>
        <Grid size={{ md: 4, xs: 12 }}><TextField fullWidth color="info" size="medium" name="shop_phone" label="الهاتف" /></Grid>
        <Grid size={{ md: 4, xs: 12 }}><TextField fullWidth color="info" size="medium" name="support_email" label="البريد الإلكتروني" type="email" /></Grid>
        <Grid size={{ md: 4, xs: 12 }}><TextField fullWidth color="info" size="medium" name="shop_address" label="عنوان المتجر" /></Grid>
        </> : null}

        {activeTab === 4 ? <>
        <Grid size={12}><Divider textAlign="left"><Typography variant="overline" color="text.secondary">التكاملات</Typography></Divider></Grid>
        <Grid size={{ md: 6, xs: 12 }}><TextField select fullWidth color="info" size="medium" name="enable_whatsapp" label="واتساب المتجر"><MenuItem value="true">مفعل</MenuItem><MenuItem value="false">غير مفعل</MenuItem></TextField></Grid>
        <Grid size={{ md: 6, xs: 12 }}><Alert severity="info">يمكن إضافة بوابات الدفع والشحن هنا لاحقًا دون خلطها مع التصميم أو التسعير.</Alert></Grid>
        </> : null}

        {activeTab === 5 ? <>
        <Grid size={12}><Divider textAlign="left"><Typography variant="overline" color="text.secondary">الإعدادات المتقدمة</Typography></Divider></Grid>
        <Grid size={12}><Alert severity="info">هذه المساحة مخصصة لإعدادات التشغيل المتقدمة. لا توجد إعدادات إضافية مطلوبة حاليًا.</Alert></Grid>
        </> : null}

        <Grid size={12}>
          <Button disabled={isSubmitting} type="submit" color="info" variant="contained">
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </Grid>
      </Grid>
    </FormProvider>;
}
