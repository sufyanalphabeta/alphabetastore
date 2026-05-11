"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

import { apiPost, apiGet } from "utils/api";

const OPERATION_OPTIONS = [
  { value: "increase_percent", label: "Increase by %" },
  { value: "decrease_percent", label: "Decrease by %" },
  { value: "increase_fixed", label: "Increase by fixed amount" },
  { value: "decrease_fixed", label: "Decrease by fixed amount" },
  { value: "set_fixed", label: "Set fixed price" },
];

function formatLYD(amount) {
  if (amount == null) return "—";
  return `${Number(amount).toFixed(2)} د.ل`;
}

export default function BulkPricingPageView() {
  const [operation, setOperation] = useState("increase_percent");
  const [value, setValue] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brand, setBrand] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // Price history
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  const loadHistory = async (page = 1) => {
    setHistoryLoading(true);
    try {
      const data = await apiGet(`/admin/pricing/history?page=${page}&limit=20`);
      setHistory(data?.items || []);
      setHistoryTotal(data?.total || 0);
      setHistoryPage(page);
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!value || Number(value) <= 0) {
      setError("Value must be greater than 0");
      return;
    }

    setError("");
    setResult(null);
    setIsSubmitting(true);

    try {
      const payload = {
        operation,
        value: Number(value),
        ...(categoryId ? { categoryId } : {}),
        ...(brand.trim() ? { brand: brand.trim() } : {}),
      };

      const data = await apiPost("/admin/pricing/bulk", payload);
      setResult(data);
      await loadHistory(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply bulk price update");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Bulk Price Management
      </Typography>

      <Grid container spacing={3}>
        {/* BULK UPDATE FORM */}
        <Grid size={{ md: 6, xs: 12 }}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" mb={2}>Apply Bulk Price Change</Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {result && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Updated {result.updatedCount} products successfully.
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid size={12}>
                <TextField
                  select
                  fullWidth
                  size="medium"
                  label="Operation"
                  value={operation}
                  onChange={e => setOperation(e.target.value)}
                >
                  {OPERATION_OPTIONS.map(opt => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  size="medium"
                  type="number"
                  label={operation.includes("percent") ? "Percentage value" : "Amount (in product base currency)"}
                  placeholder={operation.includes("percent") ? "e.g. 10 for 10%" : "e.g. 50"}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Grid>

              <Grid size={12}>
                <Divider>
                  <Typography variant="caption" color="text.secondary">Filter (optional)</Typography>
                </Divider>
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  size="medium"
                  label="Brand (optional)"
                  placeholder="e.g. Samsung — leave blank for all brands"
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                />
              </Grid>

              <Grid size={12}>
                <Alert severity="info" sx={{ fontSize: 12 }}>
                  Leave brand blank to apply to ALL products. You can also combine with categoryId via the API.
                </Alert>
              </Grid>

              <Grid size={12}>
                <Button
                  variant="contained"
                  color="warning"
                  fullWidth
                  disabled={isSubmitting || !value}
                  onClick={handleSubmit}
                  startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
                >
                  {isSubmitting ? "Applying..." : "Apply Bulk Update"}
                </Button>
              </Grid>
            </Grid>
          </Card>
        </Grid>

        {/* PRICE HISTORY */}
        <Grid size={{ md: 6, xs: 12 }}>
          <Card sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Price Change History</Typography>
              <Button size="small" onClick={() => loadHistory(1)} disabled={historyLoading}>
                {historyLoading ? <CircularProgress size={16} /> : "Refresh"}
              </Button>
            </Box>

            {history.length === 0 ? (
              <Typography color="text.secondary" fontSize={14}>
                No price history yet. Click Refresh to load.
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="right">Old Price</TableCell>
                      <TableCell align="right">New Price</TableCell>
                      <TableCell>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product?.name || item.productId}</TableCell>
                        <TableCell align="right">{formatLYD(item.oldBasePrice)}</TableCell>
                        <TableCell align="right">{formatLYD(item.newBasePrice)}</TableCell>
                        <TableCell sx={{ fontSize: 11 }}>{item.changeReason || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {historyTotal > 20 && (
              <Box display="flex" justifyContent="flex-end" gap={1} mt={1}>
                <Button size="small" disabled={historyPage <= 1} onClick={() => loadHistory(historyPage - 1)}>
                  Prev
                </Button>
                <Typography variant="caption" sx={{ lineHeight: "30px" }}>
                  Page {historyPage}
                </Typography>
                <Button size="small" disabled={historyPage * 20 >= historyTotal} onClick={() => loadHistory(historyPage + 1)}>
                  Next
                </Button>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
