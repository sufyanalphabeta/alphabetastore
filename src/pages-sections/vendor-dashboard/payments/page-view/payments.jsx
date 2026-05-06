"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { currency } from "lib";
import PageWrapper from "pages-sections/vendor-dashboard/page-wrapper";
import { fetchAdminPayments, reviewAdminPayment } from "utils/payments";

const PAGE_SIZE = 10;

function formatPaymentDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default function PaymentsPageView() {
  return (
    <Suspense fallback={null}>
      <PaymentsContent />
    </Suspense>
  );
}

function PaymentsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPage = Math.max(Number(searchParams.get("page") || 1), 1);
  const searchTerm = searchParams.get("q")?.trim() || "";
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [searchInput, setSearchInput] = useState(searchTerm);
  const [actionState, setActionState] = useState({});

  useEffect(() => {
    setSearchInput(searchTerm);
  }, [searchTerm]);

  const loadPayments = useCallback(async () => {
    setIsLoading(true);
    setPageError("");

    try {
      const data = await fetchAdminPayments();
      setPayments(Array.isArray(data) ? data : []);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to load payments.");
      setPayments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const filteredPayments = useMemo(() => {
    const normalizedQuery = searchTerm.toLowerCase();

    return payments
      .map(payment => ({
        ...payment,
        customer: payment.order?.fullName || "Customer",
        method: payment.paymentMethodName || "Payment",
        receiptUrl: payment.receipt?.fileUrl || ""
      }))
      .filter(payment => {
        if (!normalizedQuery) {
          return true;
        }

        return [payment.orderId, payment.customer, payment.method, payment.statusLabel, payment.receiptUrl]
          .some(value => String(value || "").toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
  }, [payments, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const visiblePayments = filteredPayments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateQuery = useCallback((nextQuery, nextPage = 1) => {
    const params = new URLSearchParams(searchParams.toString());
    const normalizedQuery = nextQuery.trim();

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    } else {
      params.delete("q");
    }

    if (nextPage > 1) {
      params.set("page", String(nextPage));
    } else {
      params.delete("page");
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }, [pathname, router, searchParams]);

  const handleSearchChange = event => {
    const nextValue = event.target.value;
    setSearchInput(nextValue);
    updateQuery(nextValue, 1);
  };

  const handlePageChange = (_, nextPage) => {
    updateQuery(searchInput, nextPage);
  };

  const handleReview = async (paymentId, status) => {
    setActionState(current => ({
      ...current,
      [paymentId]: status
    }));

    try {
      const updatedPayment = await reviewAdminPayment(paymentId, {
        status
      });

      setPayments(current => current.map(item => item.id === updatedPayment.id ? updatedPayment : item));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to review payment.");
    } finally {
      setActionState(current => {
        const nextState = {
          ...current
        };

        delete nextState[paymentId];
        return nextState;
      });
    }
  };

  return <PageWrapper title="Payments">
      <TextField fullWidth margin="normal" placeholder="Search Payment..." value={searchInput} onChange={handleSearchChange} sx={{
      mb: 2
    }} />

      {pageError ? <Alert severity="error" sx={{
      mb: 3
    }}>{pageError}</Alert> : null}

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{
              backgroundColor: "grey.50"
            }}>
                <TableCell sx={{ fontWeight: 600 }}>Order</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Customer</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Method</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Receipt</TableCell>
                <TableCell align="center" sx={{ fontWeight: 600 }}>Action</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {isLoading ? <TableRow>
                  <TableCell colSpan={8}>
                    <Stack alignItems="center" justifyContent="center" py={6}>
                      <CircularProgress color="info" />
                    </Stack>
                  </TableCell>
                </TableRow> : visiblePayments.length ? visiblePayments.map(payment => <TableRow key={payment.id} hover>
                    <TableCell>#{payment.orderId.slice(0, 8).toUpperCase()}</TableCell>
                    <TableCell>{payment.customer}</TableCell>
                    <TableCell>{payment.method}</TableCell>
                    <TableCell>{currency(payment.amount)}</TableCell>
                    <TableCell>{formatPaymentDate(payment.createdAt)}</TableCell>
                    <TableCell>{payment.statusLabel}</TableCell>
                    <TableCell>
                      {payment.receiptUrl ? <Link href={payment.receiptUrl} target="_blank" rel="noreferrer">View receipt</Link> : <Typography variant="body2" color="text.secondary">No receipt</Typography>}
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Button size="small" variant="contained" color="success" disabled={payment.status !== "PENDING" || Boolean(actionState[payment.id])} onClick={() => handleReview(payment.id, "APPROVED")}>
                          {actionState[payment.id] === "APPROVED" ? "Approving..." : "Approve"}
                        </Button>

                        <Button size="small" variant="outlined" color="error" disabled={payment.status !== "PENDING" || Boolean(actionState[payment.id])} onClick={() => handleReview(payment.id, "REJECTED")}>
                          {actionState[payment.id] === "REJECTED" ? "Rejecting..." : "Reject"}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>) : <TableRow>
                  <TableCell colSpan={8}>
                    <Stack alignItems="center" justifyContent="center" py={6}>
                      <Typography color="text.secondary">No payments found for the current search.</Typography>
                    </Stack>
                  </TableCell>
                </TableRow>}
            </TableBody>
          </Table>
        </TableContainer>

        <Stack alignItems="center" my={4}>
          <Pagination color="primary" page={page} count={totalPages} onChange={handlePageChange} />
        </Stack>
      </Card>
    </PageWrapper>;
}