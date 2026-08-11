import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

// MUI
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";

// GLOBAL CUSTOM COMPONENTS
import { FormProvider, TextField } from "components/form-hook";
import { apiGet, apiPatch } from "utils/api";
import useSettings from "hooks/useSettings";
const validationSchema = yup.object().shape({
  shopPhone: yup.string().trim().required("Shop phone is required"),
  shopAddress: yup.string().trim().required("Shop address is required"),
  supportEmail: yup.string().trim().email("Invalid email").required("Support email is required"),
  appStoreUrl: yup.string().trim().url("Invalid App Store URL").nullable(),
  googlePlayUrl: yup.string().trim().url("Invalid Google Play URL").nullable(),
  minOrder: yup.number().min(0).required("Minimum order is required"),
  termsAndConditionsText: yup.string().trim().min(20, "Terms text is too short").required("Terms and conditions text is required"),
  privacyPolicyText: yup.string().trim().min(20, "Privacy policy text is too short").required("Privacy policy text is required")
});
export default function SettingsForm() {
  const {
    refreshSettings,
    updateSettings
  } = useSettings();
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  const initialValues = {
    shopPhone: "",
    shopAddress: "",
    supportEmail: "",
    appStoreUrl: "",
    googlePlayUrl: "",
    minOrder: 0,
    termsAndConditionsText: "",
    privacyPolicyText: ""
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
        const settings = await apiGet("/settings");
        reset({
          shopPhone: String(settings?.shop_phone || ""),
          shopAddress: String(settings?.shop_address || ""),
          supportEmail: String(settings?.support_email || ""),
          appStoreUrl: String(settings?.app_store_url || ""),
          googlePlayUrl: String(settings?.google_play_url || ""),
          minOrder: Number(settings?.min_order || 0),
          termsAndConditionsText: String(settings?.terms_and_conditions_text || ""),
          privacyPolicyText: String(settings?.privacy_policy_text || "")
        });
      } catch {
        // Keep local defaults when remote settings cannot be loaded.
      }
    };

    loadSettings();
  }, [reset]);

  const handleSubmitForm = handleSubmit(async values => {
    setSubmitError("");
    setSubmitSuccess("");

    const payload = [{
      key: "shop_phone",
      value: values.shopPhone.trim()
    }, {
      key: "shop_address",
      value: values.shopAddress.trim()
    }, {
      key: "support_email",
      value: values.supportEmail.trim()
    }, {
      key: "app_store_url",
      value: values.appStoreUrl?.trim() || ""
    }, {
      key: "google_play_url",
      value: values.googlePlayUrl?.trim() || ""
    }, {
      key: "min_order",
      value: String(values.minOrder)
    }, {
      key: "terms_and_conditions_text",
      value: values.termsAndConditionsText.trim()
    }, {
      key: "privacy_policy_text",
      value: values.privacyPolicyText.trim()
    }];

    try {
      await Promise.all(payload.map(item => apiPatch("/admin/settings", item)));

      updateSettings({
        shop_phone: values.shopPhone,
        shop_address: values.shopAddress,
        support_email: values.supportEmail,
        app_store_url: values.appStoreUrl,
        google_play_url: values.googlePlayUrl,
        min_order: String(values.minOrder),
        terms_and_conditions_text: values.termsAndConditionsText,
        privacy_policy_text: values.privacyPolicyText,
      });

      await refreshSettings();
      setSubmitSuccess("Settings saved successfully.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save settings.");
    }
  });
  return <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      {submitSuccess ? <Alert severity="success" sx={{ mb: 3 }}>{submitSuccess}</Alert> : null}
      {submitError ? <Alert severity="error" sx={{ mb: 3 }}>{submitError}</Alert> : null}
      <Alert severity="info" sx={{ mb: 3 }}>
        إعدادات الثيم واللغة والعملة وسعر الصرف موجودة في إعدادات الموقع.
      </Alert>
      <Alert severity="info" sx={{ mb: 3 }}>
        نصوص الاتفاقية وسياسة الخصوصية هنا ستظهر للعميل في صفحة التسجيل، ولن يكتمل إنشاء الحساب بدون الموافقة عليها.
      </Alert>

      <Grid container spacing={3} mb={3}>
        <Grid size={{ md: 6, xs: 12 }}>
          <TextField color="info" size="medium" name="shopPhone" label="Shop Phone *" fullWidth />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField color="info" size="medium" name="shopAddress" label="Shop Address *" fullWidth />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField color="info" size="medium" name="supportEmail" label="Support Email *" fullWidth />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField color="info" size="medium" name="appStoreUrl" label="App Store URL (optional)" fullWidth />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField color="info" size="medium" name="googlePlayUrl" label="Google Play URL (optional)" fullWidth />
        </Grid>

        <Grid size={{ md: 6, xs: 12 }}>
          <TextField name="minOrder" color="info" size="medium" type="number" label="Minimum Order *" fullWidth />
        </Grid>

        <Grid size={12}>
          <TextField
            color="info"
            size="medium"
            name="termsAndConditionsText"
            label="Terms and Conditions Text *"
            multiline
            minRows={4}
            fullWidth
          />
        </Grid>

        <Grid size={12}>
          <TextField
            color="info"
            size="medium"
            name="privacyPolicyText"
            label="Privacy Policy Text *"
            multiline
            minRows={4}
            fullWidth
          />
        </Grid>
      </Grid>

      <Button loading={isSubmitting} type="submit" color="info" variant="contained">
        Save Changes
      </Button>
    </FormProvider>;
}
