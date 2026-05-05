"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { uploadBankTransferReceipt } from "utils/payments";

// STYLED COMPONENT
import { Wrapper, StyledButton } from "./styles";
export default function OrderConfirmationPageView() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId")?.trim() || "";
  const orderNumber = searchParams.get("orderNumber")?.trim() || "";
  const paymentId = searchParams.get("paymentId")?.trim() || "";
  const paymentMethod = searchParams.get("paymentMethod")?.trim() || "";
  const orderLabel = orderNumber || (orderId ? `#${orderId.slice(0, 8).toUpperCase()}` : null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const isBankTransfer = paymentMethod === "BANK_TRANSFER";
  const isCod = paymentMethod === "COD";
  const hasOrderReference = Boolean(orderId);

  const handleUploadReceipt = async () => {
    if (!paymentId || !receiptFile) {
      setUploadError(t("orderConfirmationReceiptRequired"));
      return;
    }

    setIsUploading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      await uploadBankTransferReceipt(paymentId, receiptFile);
      setUploadSuccess(t("orderConfirmationUploadSuccess"));
      setReceiptFile(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("orderConfirmationUploadFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  return <Container className="mt-2 mb-5">
      <Wrapper>
        <Image width={116} height={116} alt="complete" src="/assets/images/illustrations/party-popper.svg" />

        <Typography variant="h1" fontWeight={700}>
          {isBankTransfer ? t("orderConfirmationUploadTitle") : t("orderConfirmationSuccessTitle")}
        </Typography>

        <Typography fontSize={16} variant="body1" color="text.secondary" sx={{
        padding: ".5rem 2rem"
      }}>
          {isBankTransfer ? t("orderConfirmationBankTransferBody") : isCod ? t("orderConfirmationCodBody") : t("orderConfirmationGenericBody")}
        </Typography>

        {!hasOrderReference ? <Alert severity="warning" sx={{
        mb: 1,
        width: "100%",
        maxWidth: 440
      }}>
            {t("orderConfirmationMissingReference")}
          </Alert> : null}

        {orderLabel ? <Typography fontSize={16} variant="body1" color="text.secondary">
            {t("orderConfirmationOrderNumber")} <strong>{orderLabel}</strong>.
          </Typography> : null}

        {orderId ? <Typography fontSize={14} variant="body2" color="text.secondary" sx={{
        mt: 1
      }}>
        {t("orderConfirmationReferenceId")} {orderId}
          </Typography> : null}

        {isBankTransfer ? <Stack spacing={2} sx={{
        width: "100%",
        maxWidth: 440,
        mt: 3
      }}>
            {uploadError ? <Alert severity="error">{uploadError}</Alert> : null}
            {uploadSuccess ? <Alert severity="success">{uploadSuccess}</Alert> : null}

            <Button component="label" variant="outlined" color="inherit">
              {receiptFile ? `${t("orderConfirmationSelectedReceipt")} ${receiptFile.name}` : t("orderConfirmationChooseReceipt")}
              <input hidden type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" onChange={event => {
              setReceiptFile(event.target.files?.[0] || null);
              setUploadError("");
              setUploadSuccess("");
            }} />
            </Button>

            <Button variant="contained" color="primary" onClick={handleUploadReceipt} disabled={!receiptFile || isUploading || !paymentId}>
              {isUploading ? t("orderConfirmationUploading") : t("orderConfirmationUploadReceipt")}
            </Button>
          </Stack> : null}

        <StyledButton color="primary" disableElevation variant="contained" className="button-link" LinkComponent={Link} href="/market-1">
          {t("orderConfirmationBrowseProducts")}
        </StyledButton>
      </Wrapper>
    </Container>;
}