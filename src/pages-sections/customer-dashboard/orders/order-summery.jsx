"use client";

import { useRef, useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";

// GLOBAL CUSTOM COMPONENTS
import FlexBetween from "components/flex-box/flex-between";

// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";
import { uploadBankTransferReceipt } from "utils/payments";

// CUSTOM DATA MODEL


// ==============================================================


// ==============================================================

export default function OrderSummery({
  order
}) {
  const fileInputRef = useRef(null);
  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [receipt, setReceipt] = useState(order.paymentReceipt ?? null);

  const isBankTransfer = order.paymentMethodCode === "BANK_TRANSFER";
  const transactionId = order.paymentTransactionId;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !transactionId) return;
    setUploadError("");
    setIsUploading(true);
    try {
      const result = await uploadBankTransferReceipt(transactionId, file);
      setReceipt(result?.receipt ?? { reviewStatus: "PENDING" });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "فشل رفع الإيصال.");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const receiptStatusColor = (status) => {
    if (status === "APPROVED") return "success";
    if (status === "REJECTED") return "error";
    return "warning";
  };

  const receiptStatusLabel = (status) => {
    if (status === "APPROVED") return "مقبول";
    if (status === "REJECTED") return "مرفوض";
    return "قيد المراجعة";
  };
  return <Grid container spacing={3}>
      <Grid size={{
      md: 6,
      xs: 12
    }}>
        <Card elevation={0} sx={{
        p: 3,
        border: "1px solid",
        borderColor: "grey.100"
      }}>
          <Typography variant="h5" sx={{
          mb: 2
        }}>
            Shipping Address
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            رقم الطلب: <strong>{order.orderNumber || "—"}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            كود العميل: <strong>{order.customerCode || "—"}</strong>
          </Typography>

          <Typography variant="body1">{order.shippingAddress || "No address provided."}</Typography>
        </Card>
      </Grid>

      <Grid size={{
      md: 6,
      xs: 12
    }}>
        <Card elevation={0} sx={{
        p: 3,
        border: "1px solid",
        borderColor: "grey.100"
      }}>
          <Typography variant="h5" sx={{
          mb: 2
        }}>
            Total Summary
          </Typography>

          <ListItem title="Subtotal:" value={currency(order.totalAmount)} />
          <ListItem title="Shipping fee:" value={currency(0)} />
          <ListItem title="Discount:" value={currency(0)} />

          <Divider sx={{
          mb: 1
        }} />

          <FlexBetween mb={2}>
            <Typography variant="h6">Total</Typography>
            <Typography variant="h6">{currency(order.totalAmount)}</Typography>
          </FlexBetween>

          <p>{order.paymentMethod}</p>
          <Button size="small" variant="outlined" onClick={() => window.print()} sx={{ mb: 1 }}>
            طباعة ملخص الطلب
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{
          mb: order.notes ? 1 : 0
        }}>
            Payment status: {order.paymentStatusLabel}
          </Typography>

          {isBankTransfer && transactionId ? <>
              {receipt ? <Chip size="small" label={receiptStatusLabel(receipt.reviewStatus)} color={receiptStatusColor(receipt.reviewStatus)} sx={{ mb: 1 }} /> : null}

              {uploadError ? <Typography variant="caption" color="error" display="block" sx={{ mb: 1 }}>{uploadError}</Typography> : null}

              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,application/pdf,image/webp" style={{ display: "none" }} onChange={handleFileChange} />

              <Button size="small" variant="outlined" color="info" startIcon={<UploadFileOutlined />} disabled={isUploading || receipt?.reviewStatus === "APPROVED"} onClick={() => fileInputRef.current?.click()} sx={{ mt: 1 }}>
                {isUploading ? "جاري الرفع..." : receipt ? "تحديث الإيصال" : "رفع إيصال التحويل"}
              </Button>
            </> : null}

          {order.notes ? <Typography variant="body2" color="text.secondary">Customer note: {order.notes}</Typography> : null}
        </Card>
      </Grid>
    </Grid>;
}
function ListItem({
  title,
  value
}) {
  return <FlexBetween mb={1}>
      <Typography color="text.secondary" variant="body1">
        {title}
      </Typography>

      <Typography variant="h6">{value}</Typography>
    </FlexBetween>;
}
