"use client";

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import { apiGet, apiPost } from "utils/api";

// GLOBAL CUSTOM COMPONENTS
import { Checkbox, TextField, FormProvider } from "components/form-hook";

// LOCAL CUSTOM COMPONENTS
import EyeToggleButton from "../components/eye-toggle-button";

// LOCAL CUSTOM HOOK
import Label from "../components/label";
import usePasswordVisible from "../use-password-visible";

// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";

const DEFAULT_TERMS_TEXT = "باستخدامك لهذه المنصة وتسجيل حساب جديد، فأنت توافق على الالتزام بشروط الاستخدام وسياسات المتجر.";
const DEFAULT_PRIVACY_TEXT = "نقوم بجمع البيانات الأساسية اللازمة لتقديم الخدمة ومعالجة الطلبات، مع الحفاظ على خصوصية بياناتك وعدم مشاركتها خارج نطاق التشغيل القانوني.";

// REGISTER FORM FIELD VALIDATION SCHEMA
export default function RegisterPageView() {
  const router = useRouter();
  const { t } = useTranslation();
  const [errorMessage, setErrorMessage] = useState("");
  const [termsText, setTermsText] = useState(DEFAULT_TERMS_TEXT);
  const [privacyText, setPrivacyText] = useState(DEFAULT_PRIVACY_TEXT);
  const [openPolicyDialog, setOpenPolicyDialog] = useState(null);
  const {
    visiblePassword,
    togglePasswordVisible
  } = usePasswordVisible();
  const inputProps = {
    endAdornment: <EyeToggleButton show={visiblePassword} click={togglePasswordVisible} />
  };
  const initialValues = {
    name: "",
    email: "",
    password: "",
    re_password: "",
    acceptedPolicies: false
  };
  const validationSchema = yup.object().shape({
    name: yup.string().trim().min(2, t("validationNameMin")).max(80, t("validationNameMax")).required(t("validationNameRequired")),
    email: yup.string().trim().email(t("validationEmailInvalid")).required(t("validationEmailRequired")),
    password: yup.string().min(8, t("validationPasswordMin")).max(72, t("validationPasswordMax")).required(t("validationPasswordRequired")),
    re_password: yup.string().oneOf([yup.ref("password")], t("validationPasswordsMismatch")).required(t("validationPasswordConfirmRequired")),
    acceptedPolicies: yup.bool().test("acceptedPolicies", t("validationPoliciesRequired"), value => value === true).required(t("validationPoliciesRequired"))
  });
  const methods = useForm({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema)
  });
  const {
    handleSubmit,
    formState: {
      isSubmitting
    }
  } = methods;

  useEffect(() => {
    const loadPolicySettings = async () => {
      try {
        const settings = await apiGet("/settings");

        setTermsText(String(settings?.terms_and_conditions_text || DEFAULT_TERMS_TEXT));
        setPrivacyText(String(settings?.privacy_policy_text || DEFAULT_PRIVACY_TEXT));
      } catch {
        // Keep local defaults if settings are unavailable.
      }
    };

    loadPolicySettings();
  }, []);

  const activePolicy = useMemo(() => {
    if (openPolicyDialog === "terms") {
      return {
        title: t("authTermsTitle"),
        text: termsText
      };
    }

    if (openPolicyDialog === "privacy") {
      return {
        title: t("authPrivacyTitle"),
        text: privacyText
      };
    }

    return null;
  }, [openPolicyDialog, termsText, privacyText, t]);

  const openPolicy = type => event => {
    event.preventDefault();
    event.stopPropagation();
    setOpenPolicyDialog(type);
  };

  const handleSubmitForm = handleSubmit(async values => {
    setErrorMessage("");

    try {
      await apiPost("/auth/register", {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        acceptedPolicies: values.acceptedPolicies
      });
      window.location.assign("/login");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("registerFailed"));
    }
  });
  return <FormProvider methods={methods} onSubmit={handleSubmitForm}>
      {errorMessage ? <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert> : null}

      <div className="mb-1">
        <Label>{t("authFullNameLabel")}</Label>
        <TextField fullWidth name="name" size="medium" placeholder={t("authFullNameLabel")} />
      </div>

      <div className="mb-1">
        <Label>{t("authEmailLabel")}</Label>
        <TextField fullWidth name="email" size="medium" type="email" placeholder={t("authEmailPlaceholder")} />
      </div>

      <div className="mb-1">
        <Label>{t("authPasswordLabel")}</Label>
        <TextField fullWidth size="medium" name="password" placeholder={t("authPasswordPlaceholder")} type={visiblePassword ? "text" : "password"} slotProps={{
        input: inputProps
      }} />
      </div>

      <div className="mb-1">
        <Label>{t("authConfirmPasswordLabel")}</Label>
        <TextField fullWidth size="medium" name="re_password" placeholder={t("authPasswordPlaceholder")} type={visiblePassword ? "text" : "password"} slotProps={{
        input: inputProps
      }} />
      </div>

      <div className="agreement">
        <Checkbox name="acceptedPolicies" size="small" color="secondary" label={<FlexBox flexWrap="wrap" alignItems="center" justifyContent="flex-start" gap={1}>
                <Box display={{
          sm: "inline-block",
          xs: "none"
              }}>{t("authAcceptPoliciesPrefix")}</Box>
              <Box display={{
          sm: "none",
          xs: "inline-block"
              }}>{t("authAcceptPoliciesCompact")}</Box>
                <Button onClick={openPolicy("terms")} sx={{
          p: 0,
          minWidth: "auto",
          fontWeight: 600,
          textDecoration: "underline"
        }}>
                  {t("authTermsTitle")}
                </Button>
                <Box>و</Box>
                <Button onClick={openPolicy("privacy")} sx={{
          p: 0,
          minWidth: "auto",
          fontWeight: 600,
          textDecoration: "underline"
        }}>
                  {t("authPrivacyTitle")}
                </Button>
            </FlexBox>} />
      </div>

      <Button fullWidth size="large" type="submit" color="primary" variant="contained" loading={isSubmitting}>
              {t("authRegisterAction")}
      </Button>

      <Dialog open={Boolean(activePolicy)} onClose={() => setOpenPolicyDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{activePolicy?.title}</DialogTitle>

        <DialogContent>
          <Typography sx={{ whiteSpace: "pre-line" }}>{activePolicy?.text}</Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenPolicyDialog(null)}>{t("close")}</Button>
        </DialogActions>
      </Dialog>
    </FormProvider>;
}
