"use client";

import { Fragment, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";

// LOCAL CUSTOM COMPONENTS
import OrderSummery from "../order-summery";
import OrderProgress from "../order-progress";
import OrderedProducts from "../ordered-products";
import DashboardHeader from "../../dashboard-header";
import { cancelCustomerOrder, fetchCustomerOrderById } from "utils/orders";
import OrderStatusHistoryCard from "components/orders/order-status-history-card";

export function OrderDetailsPageView({
  orderId
}) {
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelSuccess, setCancelSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadOrder = async () => {
      setPageError("");

      try {
        const nextOrder = await fetchCustomerOrderById(orderId);
        if (!cancelled) {
          setOrder(nextOrder);
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(error instanceof Error ? error.message : "Failed to load order details.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const handleCancel = async () => {
    if (!order) return;
    if (!window.confirm("هل أنت متأكد من إلغاء هذا الطلب؟ لا يمكن التراجع.")) return;

    setCancelLoading(true);
    setCancelError("");
    setCancelSuccess("");

    try {
      const updated = await cancelCustomerOrder(orderId);
      setOrder(updated);
      setCancelSuccess("تم إلغاء الطلب بنجاح.");
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : "تعذّر إلغاء الطلب.");
    } finally {
      setCancelLoading(false);
    }
  };

  const canCancel = order?.rawStatus === "PENDING";

  return <Fragment>
      <DashboardHeader href="/orders" title="Order Details" />

      {pageError ? <Alert severity="error" sx={{
      mb: 3
    }}>{pageError}</Alert> : null}

      {cancelError ? <Alert severity="error" sx={{
      mb: 3
    }}>{cancelError}</Alert> : null}

      {cancelSuccess ? <Alert severity="success" sx={{
      mb: 3
    }}>{cancelSuccess}</Alert> : null}

      {isLoading ? <Stack alignItems="center" justifyContent="center" py={6}>
          <CircularProgress color="info" />
        </Stack> : null}

      {!isLoading && !pageError && !order ? <Alert severity="info" sx={{
      mb: 3
    }}>
          Order details are not available.
        </Alert> : null}

      {!isLoading && !pageError && order ? <>
          <OrderProgress status={order.rawStatus} statusLabel={order.statusLabel} />

          {canCancel ? <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
              <Button
                variant="outlined"
                color="error"
                disabled={cancelLoading}
                onClick={handleCancel}
              >
                {cancelLoading ? "جارٍ الإلغاء…" : "إلغاء الطلب"}
              </Button>
            </Stack> : null}

          <OrderedProducts order={order} />

          <OrderStatusHistoryCard history={order.statusHistory} />

          <OrderSummery order={order} />
        </> : null}
    </Fragment>;
}