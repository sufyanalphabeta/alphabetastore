"use client";

import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import { useEffect, useState } from "react";

// LOCAL CUSTOM COMPONENT
import OrderActions from "../order-actions";
import TotalSummery from "../total-summery";
import PageWrapper from "../../page-wrapper";
import OrderedProduct from "../ordered-product";
import ShippingAddress from "../shipping-address";
import { fetchAdminOrderById } from "utils/orders";
import OrderStatusHistoryCard from "components/orders/order-status-history-card";

export default function OrderDetailsPageView({
  orderId
}) {
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadOrder = async () => {
      setPageError("");

      try {
        const nextOrder = await fetchAdminOrderById(orderId);
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

  return <PageWrapper title="Order Details">
      {pageError ? <Alert severity="error" sx={{
      mb: 3
    }}>{pageError}</Alert> : null}

      {isLoading ? <Stack alignItems="center" justifyContent="center" py={6}>
          <CircularProgress color="info" />
        </Stack> : null}

      {!isLoading && !pageError && !order ? <Alert severity="info" sx={{
      mb: 3
    }}>
          Order not found or no longer available.
        </Alert> : null}

      {!isLoading && !pageError && order ? <>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Card sx={{
          p: 3
        }}>
            <OrderActions id={order.id} createdAt={order.createdAt} status={order.rawStatus} statusLabel={order.statusLabel} onUpdated={setOrder} />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ mb: 2 }}>
              <span>رقم الطلب: <strong>{order.orderNumber || "—"}</strong></span>
              <span>كود العميل: <strong>{order.customerCode || "—"}</strong></span>
            </Stack>

            {order.items.map((item, index) => <OrderedProduct product={item} key={index} />)}
          </Card>
        </Grid>

        <Grid size={{
        md: 6,
        xs: 12
      }}>
          <ShippingAddress address={order.shippingAddress} notes={order.notes} phone={order.phone} fullName={order.fullName} />
        </Grid>

        <Grid size={{
        md: 6,
        xs: 12
      }}>
          <TotalSummery order={order} />
        </Grid>

        <Grid size={12}>
          <OrderStatusHistoryCard history={order.statusHistory} />
        </Grid>
      </Grid>
      </> : null}
    </PageWrapper>;
}
