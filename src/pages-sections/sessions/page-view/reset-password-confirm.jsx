"use client";

import { Fragment, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";

import { TextField, FormProvider } from "components/form-hook";
import FlexRowCenter from "components/flex-box/flex-row-center";

import BoxLink from "../components/box-link";

import { apiPost } from "utils/api";

const schema = yup.object({
  newPassword: yup.string().min(8, "8 محارف على الأقل").required("كلمة المرور مطلوبة"),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("newPassword")], "كلمتا المرور غير متطابقتين")
    .required("تأكيد كلمة المرور مطلوب"),
});

export default function ResetPasswordConfirm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const methods = useForm({
    defaultValues: { newPassword: "", confirmPassword: "" },
    resolver: yupResolver(schema),
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    setError("");
    if (!token) {
      setError("الرابط غير صالح أو منتهي. يرجى طلب رابط جديد.");
      return;
    }

    try {
      await apiPost("/auth/reset-password", { token, newPassword });
      setSuccess("تم تحديث كلمة المرور بنجاح. سيتم تحويلك لتسجيل الدخول.");
      setTimeout(() => router.push("/login"), 1800);
    } catch (e) {
      setError(e?.message || "تعذّر تحديث كلمة المرور. الرابط غير صالح أو منتهي.");
    }
  });

  return (
    <Fragment>
      <Typography variant="h3" fontWeight={700} sx={{ mb: 4, textAlign: "center" }}>
        تعيين كلمة مرور جديدة
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : null}

      {success ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      ) : null}

      <FormProvider methods={methods} onSubmit={onSubmit}>
        <Stack spacing={3}>
          <TextField
            fullWidth
            name="newPassword"
            type="password"
            label="كلمة المرور الجديدة"
            size="medium"
          />
          <TextField
            fullWidth
            name="confirmPassword"
            type="password"
            label="تأكيد كلمة المرور"
            size="medium"
          />
          <Button
            fullWidth
            size="large"
            type="submit"
            color="primary"
            variant="contained"
            loading={isSubmitting}
            disabled={Boolean(success)}
          >
            تحديث كلمة المرور
          </Button>
        </Stack>
      </FormProvider>

      <FlexRowCenter mt={3} justifyContent="center" gap={1}>
        <Typography variant="body1" color="text.secondary">
          هل تذكرت كلمة المرور؟
        </Typography>
        <BoxLink title="تسجيل الدخول" href="/login" />
      </FlexRowCenter>
    </Fragment>
  );
}
