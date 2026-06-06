"use client";

import { useCallback, useEffect, useState } from "react";

// MUI
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Rating from "@mui/material/Rating";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

// UTILS
import { adminFetchReviews, adminModerateReview } from "utils/admin-reviews";
import PageWrapper from "../page-wrapper";

// ── Status chip ───────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "error",
  HIDDEN: "default",
};

// ── Main Export ───────────────────────────────────────────────────────────────

export default function ReviewModerationPageView() {
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], pagination: { totalPages: 1 } });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Moderation dialog state
  const [selectedReview, setSelectedReview] = useState(null);
  const [action, setAction] = useState("APPROVED");
  const [moderatorNote, setModeratorNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminFetchReviews({ status: statusFilter, page, limit: 15 });
      setData(res);
    } catch (e) {
      setError(e?.message || "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const openModerate = (review, defaultAction) => {
    setSelectedReview(review);
    setAction(defaultAction);
    setModeratorNote("");
  };

  const handleModerate = async () => {
    setSaving(true);
    try {
      await adminModerateReview(selectedReview.id, { status: action, moderatorNote: moderatorNote || undefined });
      setSelectedReview(null);
      load();
    } catch (e) {
      setError(e?.message || "Failed to moderate review.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageWrapper title="Review Moderation">
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Typography variant="subtitle2" color="text.secondary">Status:</Typography>
        <Select
          size="small"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {["PENDING", "APPROVED", "REJECTED", "HIDDEN"].map(s => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
        </Select>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box textAlign="center" py={6}><CircularProgress /></Box>
      ) : data.items?.length === 0 ? (
        <Typography color="text.secondary" py={4} textAlign="center">No reviews found.</Typography>
      ) : (
        <Stack spacing={2}>
          {data.items.map(review => (
            <Card key={review.id} variant="outlined">
              <CardContent>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
                  <Box flex={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" mb={0.5}>
                      <Chip
                        label={review.status}
                        color={STATUS_COLORS[review.status] ?? "default"}
                        size="small"
                      />
                      {review.isVerifiedPurchase && (
                        <Chip label="Verified Purchase" color="primary" size="small" variant="outlined" />
                      )}
                      <Rating value={review.rating} readOnly size="small" precision={0.5} />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </Typography>
                    </Stack>

                    <Typography variant="body2" fontWeight={600}>
                      {review.product?.name ?? "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      by {review.user?.name ?? review.user?.email ?? "Unknown"}
                    </Typography>

                    {review.title && (
                      <Typography variant="body2" fontWeight={600} mt={1}>
                        {review.title}
                      </Typography>
                    )}
                    {review.comment && (
                      <Typography variant="body2" color="text.secondary" mt={0.5}>
                        {review.comment}
                      </Typography>
                    )}
                    {review.moderatorNote && (
                      <Typography variant="caption" color="error.main" mt={0.5} display="block">
                        Note: {review.moderatorNote}
                      </Typography>
                    )}
                  </Box>

                  <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", md: "block" } }} />

                  <Stack spacing={1} justifyContent="center" minWidth={160}>
                    {review.status !== "APPROVED" && (
                      <Button size="small" variant="contained" color="success"
                        onClick={() => openModerate(review, "APPROVED")}>
                        Approve
                      </Button>
                    )}
                    {review.status !== "REJECTED" && (
                      <Button size="small" variant="outlined" color="error"
                        onClick={() => openModerate(review, "REJECTED")}>
                        Reject
                      </Button>
                    )}
                    {review.status !== "HIDDEN" && (
                      <Button size="small" variant="outlined" color="secondary"
                        onClick={() => openModerate(review, "HIDDEN")}>
                        Hide
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {data.pagination?.totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination
            page={page}
            count={data.pagination.totalPages}
            onChange={(_, p) => setPage(p)}
            color="primary"
            variant="outlined"
          />
        </Box>
      )}

      {/* Moderate dialog */}
      <Dialog open={Boolean(selectedReview)} onClose={() => setSelectedReview(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Moderate Review</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Select
              value={action}
              onChange={e => setAction(e.target.value)}
              size="small"
              fullWidth
            >
              <MenuItem value="APPROVED">Approve</MenuItem>
              <MenuItem value="REJECTED">Reject</MenuItem>
              <MenuItem value="HIDDEN">Hide</MenuItem>
            </Select>
            <TextField
              label="Moderator note (optional)"
              value={moderatorNote}
              onChange={e => setModeratorNote(e.target.value)}
              size="small"
              multiline rows={2}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedReview(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleModerate} disabled={saving}>
            {saving ? <CircularProgress size={16} color="inherit" /> : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageWrapper>
  );
}
