import { Suspense } from "react";

import ResetPasswordConfirm from "pages-sections/sessions/page-view/reset-password-confirm";

export const metadata = {
  title: "تحديث كلمة المرور - Alphabeta Store",
};

export default function ResetPasswordConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordConfirm />
    </Suspense>
  );
}
