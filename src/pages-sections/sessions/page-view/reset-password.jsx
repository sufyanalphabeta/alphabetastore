"use client";

import { Fragment, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

// MUI
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";

// GLOBAL CUSTOM COMPONENTS
import { TextField, FormProvider } from "components/form-hook";
import FlexRowCenter from "components/flex-box/flex-row-center";

// LOCAL CUSTOM COMPONENT
import BoxLink from "../components/box-link";

import { apiPost } from "utils/api";


// FORM FIELD VALIDATION SCHEMA
const validationSchema = yup.object().shape({
  email: yup.string().email("invalid email").required("Email is required")
});

const GENERIC_SUCCESS_MESSAGE =
  "إذا كان هذا البريد مرتبطًا بحساب لدينا فستصلك رسالة بإرشادات إعادة تعيين كلمة المرور خلال دقائق. تأكد من فحص مجلد الرسائل غير المرغوب فيها.";

export default function ResetPassword() {
  const [notice, setNotice] = useState("");
  const [severity, setSeverity] = useState("info");
  const methods = useForm({
    defaultValues: {
      email: ""
    },
    resolver: yupResolver(validationSchema)
  });
  const {
    handleSubmit,
    formState: {
      isSubmitting
    }
  } = methods;

  const handleSubmitForm = handleSubmit(async ({ email }) => {
    try {
      await apiPost("/auth/forgot-password", { email });
      setSeverity("success");
      setNotice(GENERIC_SUCCESS_MESSAGE);
    } catch {
      // Show the same generic message even on error to avoid account enumeration.
      setSeverity("info");
      setNotice(GENERIC_SUCCESS_MESSAGE);
    }
  });

  return <Fragment>
      <Typography variant="h3" fontWeight={700} sx={{
      mb: 4,
      textAlign: "center"
    }}>
        استعادة كلمة المرور
      </Typography>

      {notice ? <Alert severity={severity} sx={{
      mb: 3
    }}>{notice}</Alert> : null}

      <FormProvider methods={methods} onSubmit={handleSubmitForm}>
        <Stack spacing={3}>
          <TextField fullWidth name="email" type="email" label="البريد الإلكتروني" size="medium" placeholder="you@example.com" />

          <Button fullWidth size="large" type="submit" color="primary" variant="contained" loading={isSubmitting}>
            إرسال الطلب
          </Button>
        </Stack>
      </FormProvider>

      <FlexRowCenter mt={3} justifyContent="center" gap={1}>
        <Typography variant="body1" color="text.secondary">
          ليس لديك حساب؟
        </Typography>

        <BoxLink title="إنشاء حساب" href="/register" />
      </FlexRowCenter>
    </Fragment>;
}