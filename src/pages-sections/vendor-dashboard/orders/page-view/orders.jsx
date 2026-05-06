"use client";

import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import Pagination from "@mui/material/Pagination";
import RemoveRedEye from "@mui/icons-material/RemoveRedEye";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// GLOBAL CUSTOM HOOK
import { getComparator, stableSort } from "hooks/useMuiTable";

import PageWrapper from "../../page-wrapper";
import { fetchAdminOrdersPage } from "utils/orders";

const PAGE_SIZE = 10;

const TABLE_COLUMNS = [{
  id: "id",
  label: "Order ID",
  align: "left"
}, {
  id: "qty",
  label: "Qty",
  align: "left"
}, {
  id: "purchaseDate",
  label: "Purchase Date",
  align: "left"
}, {
  id: "billingAddress",
  label: "Billing Address",
  align: "left"
}, {
  id: "amount",
  label: "Amount",
  align: "left"
}, {
  id: "status",
  label: "Status",
  align: "left"
}, {
  id: "action",
  label: "Action",
  align: "center"
}];

function getStatusColor(status) {
  if (status === "Confirmed" || status === "Delivered") return "success";
  if (status === "Cancelled") return "error";
  if (status === "Processing") return "warning";
  return "info";
}

export default function OrdersPageView(props) {
  return (
    <Suspense fallback={null}>
      <OrdersContent {...props} />
    </Suspense>
  );
}

function OrdersContent({
  orders: initialOrders = []
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPage = Math.max(Number(searchParams.get("page") || 1), 1);
  const searchTerm = searchParams.get("q")?.trim() || "";
  const [orders, setOrders] = useState(Array.isArray(initialOrders) ? initialOrders : []);
  const [pagination, setPagination] = useState({
    page: currentPage,
    limit: PAGE_SIZE,
    total: Array.isArray(initialOrders) ? initialOrders.length : 0,
    totalPages: 1
  });
  const [isLoading, setIsLoading] = useState(!initialOrders?.length);
  const [pageError, setPageError] = useState("");
  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState("purchaseDate");
  const [searchInput, setSearchInput] = useState(searchTerm);

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setPageError("");

    try {
      const response = await fetchAdminOrdersPage({
        q: searchTerm,
        page: currentPage,
        limit: PAGE_SIZE
      });
      setOrders(Array.isArray(response?.items) ? response.items : []);
      setPagination(response?.pagination || {
        page: currentPage,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 1
      });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to load orders.");
      setOrders([]);
      setPagination({
        page: currentPage,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 1
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchTerm]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => stableSort(orders.map(item => ({
    id: item.id,
    status: item.statusLabel,
    qty: item.items.length,
    amount: item.totalAmount,
    purchaseDate: item.createdAt,
    billingAddress: item.shippingAddress
  })), getComparator(order, orderBy)), [order, orderBy, orders]);

  const handleRequestSort = property => {
    if (property === "action") {
      return;
    }

    const isAsc = orderBy === property && order === "asc";
    setOrder(isAsc ? "desc" : "asc");
    setOrderBy(property);
  };

  const handleChangePage = (_, nextPage) => {
    const params = new URLSearchParams(searchParams);

    if (nextPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const handleSearchChange = event => {
    const nextValue = event.target.value;
    setSearchInput(nextValue);

    const params = new URLSearchParams(searchParams.toString());
    const normalizedQuery = nextValue.trim();

    params.delete("page");

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    } else {
      params.delete("q");
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  return <PageWrapper title="Orders">
      <TextField fullWidth margin="normal" placeholder="Search Order..." value={searchInput} onChange={handleSearchChange} sx={{
      mb: 2
    }} />

      {pageError ? <Alert severity="error" sx={{
      mb: 3
    }}>{pageError}</Alert> : null}

      <Card>
        <TableContainer sx={{
        minWidth: 900
      }}>
          <Table>
            <TableHead>
              <TableRow sx={{
              backgroundColor: "grey.50"
            }}>
                {TABLE_COLUMNS.map(column => <TableCell key={column.id} align={column.align} sortDirection={orderBy === column.id ? order : false} sx={{
              fontWeight: 600
            }}>
                    {column.id === "action" ? column.label : <button type="button" onClick={() => handleRequestSort(column.id)} style={{
                background: "none",
                border: 0,
                cursor: "pointer",
                font: "inherit",
                fontWeight: 600,
                padding: 0,
                color: "inherit"
              }}>
                        {column.label}
                      </button>}
                  </TableCell>)}
              </TableRow>
            </TableHead>

            <TableBody>
              {isLoading ? <TableRow>
                  <TableCell colSpan={7}>
                    <Stack alignItems="center" justifyContent="center" py={6}>
                      <CircularProgress color="info" />
                    </Stack>
                  </TableCell>
                </TableRow> : filteredOrders.length ? filteredOrders.map(currentOrder => <TableRow key={currentOrder.id} hover>
                    <TableCell align="left">#{currentOrder.id.split("-")[0]}</TableCell>
                    <TableCell align="left">{currentOrder.qty}</TableCell>
                    <TableCell align="left" sx={{
                fontWeight: 400
              }}>{new Date(currentOrder.purchaseDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
              })}</TableCell>
                    <TableCell align="left" sx={{
                fontWeight: 400
              }}>{currentOrder.billingAddress}</TableCell>
                    <TableCell align="left">{currentOrder.amount}</TableCell>
                    <TableCell align="left">
                      <Chip label={currentOrder.status} color={getStatusColor(currentOrder.status)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      <Link href={`/admin/orders/${currentOrder.id}`}>
                        <IconButton size="small" color="info">
                          <RemoveRedEye fontSize="small" />
                        </IconButton>
                      </Link>
                    </TableCell>
                  </TableRow>) : <TableRow>
                  <TableCell colSpan={7}>
                    <Stack alignItems="center" justifyContent="center" py={6}>
                      <Typography color="text.secondary">No orders found for the current search.</Typography>
                    </Stack>
                  </TableCell>
                </TableRow>}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack alignItems="center" my={4}>
          <Pagination color="primary" onChange={handleChangePage} page={pagination.page} count={Math.max(1, Number(pagination.totalPages || 1))} />
        </Stack>
      </Card>
    </PageWrapper>;
}