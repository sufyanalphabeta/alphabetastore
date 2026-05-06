"use client";

import { Fragment, Suspense, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import { useSearchParams } from "next/navigation";

// CUSTOM COMPONENTS
import Packages from "icons/Packages";
import OrderRow from "../order-row";
import Pagination from "../../pagination";
import DashboardHeader from "../../dashboard-header";
import EmptyState from "components/empty-state/EmptyState";
import { fetchCustomerOrdersPage } from "utils/orders";

const PAGE_SIZE = 5;

export function OrdersPageView(props) {
  return (
    <Suspense fallback={null}>
      <OrdersContent {...props} />
    </Suspense>
  );
}

function OrdersContent({
  initialPage = 1
}) {
  const searchParams = useSearchParams();
  const pageFromQuery = Number.parseInt(searchParams.get("page") || "", 10);
  const currentPage = Number.isFinite(pageFromQuery) && pageFromQuery > 0 ? pageFromQuery : Math.max(Number(initialPage) || 1, 1);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({
    page: currentPage,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1
  });
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadOrders = async () => {
      if (!cancelled) {
        setIsLoading(true);
      }
      setPageError("");

      try {
        const response = await fetchCustomerOrdersPage({
          page: currentPage,
          limit: PAGE_SIZE
        });
        if (!cancelled) {
          setOrders(Array.isArray(response?.items) ? response.items : []);
          setPagination(response?.pagination || {
            page: currentPage,
            limit: PAGE_SIZE,
            total: 0,
            totalPages: 1
          });
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(error instanceof Error ? error.message : "Failed to load orders.");
          setOrders([]);
          setPagination({
            page: currentPage,
            limit: PAGE_SIZE,
            total: 0,
            totalPages: 1
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadOrders();

    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  const totalPages = Math.max(1, Number(pagination.totalPages || 1));

  return <Fragment>
      <DashboardHeader Icon={Packages} title="طلباتي" />

      {pageError ? <Alert severity="error" sx={{
      mb: 3
    }}>{pageError}</Alert> : null}

      {isLoading ? <Stack alignItems="center" justifyContent="center" py={6}>
          <CircularProgress color="info" />
        </Stack> : null}

      {!isLoading && !pageError && orders.length === 0 ? (
        <EmptyState
          type="orders"
          title="لا توجد طلبات بعد"
          subtitle="لم تقم بأي طلبات حتى الآن. تصفح متجرنا واكتشف منتجاتنا المميزة."
          actionLabel="تسوق الآن"
          actionHref="/products/search"
        />
      ) : null}

      {!isLoading && !pageError ? orders.map(order => <OrderRow order={order} key={order.id} />) : null}

      <Pagination count={totalPages} page={Math.max(currentPage, 1)} />
    </Fragment>;
}