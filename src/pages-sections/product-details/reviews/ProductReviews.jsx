"use client";

import { useCallback, useEffect, useState } from "react";
import NextImage from "next/image";

// MUI
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import VerifiedIcon from "@mui/icons-material/Verified";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CloseIcon from "@mui/icons-material/Close";

// UTILS & CONTEXTS
import { getAccessToken } from "utils/auth";
import {
  fetchProductReviews,
  fetchRatingSummary,
  fetchMyReview,
  submitReview,
  updateReview,
  deleteReview,
} from "utils/catalog";
import { useAuth } from "contexts/AuthContext";

// SHARED COMPONENTS
import StarRating from "components/ratings/StarRating";
import StarPicker from "components/ratings/StarPicker";
import RatingSummary from "components/ratings/RatingSummary";

const SORT_OPTIONS = [
  { value: "newest",   label: "Newest" },
  { value: "oldest",   label: "Oldest" },
  { value: "highest",  label: "Highest Rating" },
  { value: "lowest",   label: "Lowest Rating" },
  { value: "verified", label: "Verified Purchases First" },
];

// ── Review Form ──────────────────────────────────────────────────────────────

function ReviewForm({ productId, existingReview, onSuccess, onCancel }) {
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [title, setTitle] = useState(existingReview?.title ?? "");
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files ?? []).slice(0, 5);
    setImages(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const handleSubmit = async () => {
    if (rating < 1) { setError("Please select a star rating."); return; }
    setError("");
    setSubmitting(true);
    try {
      const token = getAccessToken();
      if (existingReview) {
        await updateReview(existingReview.id, productId, { rating, title, comment, images }, token);
      } else {
        await submitReview(productId, { rating, title, comment, images }, token);
      }
      onSuccess?.();
    } catch (e) {
      setError(e?.message || "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" mb={1}>Your Rating *</Typography>
      <StarPicker value={rating} onChange={setRating} disabled={submitting} />
      {error && <FormHelperText error sx={{ mt: 0.5 }}>{error}</FormHelperText>}

      <TextField
        label="Review Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        fullWidth size="small" sx={{ mt: 2 }}
        inputProps={{ maxLength: 160 }}
        disabled={submitting}
      />
      <TextField
        label="Your Review"
        value={comment}
        onChange={e => setComment(e.target.value)}
        fullWidth multiline rows={4} size="small" sx={{ mt: 1.5 }}
        disabled={submitting}
      />

      {/* Image upload */}
      <Box mt={2}>
        <Button
          component="label"
          startIcon={<AddPhotoAlternateIcon />}
          variant="outlined"
          size="small"
          disabled={submitting}
        >
          Add Photos (max 5)
          <input type="file" accept="image/*" multiple hidden onChange={handleImageChange} />
        </Button>
        {previews.length > 0 && (
          <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
            {previews.map((src, i) => (
              <Box
                key={i}
                position="relative"
                width={64}
                height={64}
                borderRadius={1}
                overflow="hidden"
                border="1px solid"
                borderColor="divider"
              >
                <NextImage src={src} alt="" fill style={{ objectFit: "cover" }} />
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      <Stack direction="row" spacing={1} mt={3}>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
          sx={{ minWidth: 120 }}
        >
          {submitting ? <CircularProgress size={18} color="inherit" /> : existingReview ? "Update Review" : "Submit Review"}
        </Button>
        {onCancel && (
          <Button variant="outlined" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
      </Stack>

      <Typography variant="caption" color="text.secondary" mt={1} display="block">
        Reviews are subject to moderation and may take up to 24 hours to appear.
      </Typography>
    </Box>
  );
}

// ── Single Review Card ────────────────────────────────────────────────────────

function ReviewCard({ review, currentUserId, productId, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isOwn = currentUserId && review.user?.id === currentUserId;

  const handleDelete = async () => {
    if (!window.confirm("Delete your review?")) return;
    setDeleting(true);
    try {
      const token = getAccessToken();
      await deleteReview(review.id, productId, token);
      onChanged?.();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  const initials = review.user?.name
    ? review.user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Avatar sx={{ bgcolor: "primary.main", width: 38, height: 38, fontSize: 14 }}>
          {initials}
        </Avatar>
        <Box flex={1}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            <Typography variant="subtitle2">{review.user?.name ?? "Anonymous"}</Typography>
            {review.isVerifiedPurchase && (
              <Chip
                icon={<VerifiedIcon fontSize="small" />}
                label="Verified Purchase"
                size="small"
                color="success"
                variant="outlined"
                sx={{ fontSize: 11 }}
              />
            )}
            <Typography variant="caption" color="text.secondary">
              {new Date(review.createdAt).toLocaleDateString()}
            </Typography>
          </Stack>

          <StarRating value={review.rating} size="small" sx={{ mt: 0.25 }} />

          {review.title && (
            <Typography variant="subtitle2" mt={0.5} fontWeight={600}>
              {review.title}
            </Typography>
          )}
          {review.comment && (
            <Typography variant="body2" color="text.secondary" mt={0.5} sx={{ whiteSpace: "pre-line" }}>
              {review.comment}
            </Typography>
          )}

          {/* Review images */}
          {review.images?.length > 0 && (
            <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
              {review.images.map(img => (
                <Box
                  key={img.id}
                  position="relative"
                  width={72}
                  height={72}
                  borderRadius={1}
                  overflow="hidden"
                  border="1px solid"
                  borderColor="divider"
                >
                  <NextImage src={img.imageUrl} alt="" fill style={{ objectFit: "cover" }} />
                </Box>
              ))}
            </Stack>
          )}

          {isOwn && !editing && (
            <Stack direction="row" spacing={1} mt={1}>
              <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={handleDelete} disabled={deleting}>
                Delete
              </Button>
            </Stack>
          )}

          {editing && (
            <Box mt={2} p={2} bgcolor="grey.50" borderRadius={1}>
              <ReviewForm
                productId={productId}
                existingReview={review}
                onSuccess={() => { setEditing(false); onChanged?.(); }}
                onCancel={() => setEditing(false)}
              />
            </Box>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function ProductReviews({ productId }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showWriteForm, setShowWriteForm] = useState(false);
  const [myReview, setMyReview] = useState(undefined); // undefined = not yet loaded

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, reviewsData] = await Promise.all([
        fetchRatingSummary(productId),
        fetchProductReviews(productId, { page, limit: 10, sort }),
      ]);
      setSummary(summaryData);
      setReviews(reviewsData.items ?? []);
      setPagination(reviewsData.pagination ?? { page: 1, totalPages: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [productId, page, sort]);

  useEffect(() => { load(); }, [load]);

  // Load my existing review
  useEffect(() => {
    if (!user) { setMyReview(null); return; }
    const token = getAccessToken();
    fetchMyReview(productId, token).then(setMyReview);
  }, [user, productId]);

  const handleReviewSuccess = () => {
    setShowWriteForm(false);
    // Reload
    const token = getAccessToken();
    fetchMyReview(productId, token).then(setMyReview);
    load();
  };

  return (
    <Box id="reviews">
      <Typography variant="h5" fontWeight={700} mb={3}>
        Customer Reviews
      </Typography>

      {/* Rating Summary */}
      {summary && (
        <RatingSummary
          average={summary.average}
          total={summary.total}
          distribution={summary.distribution}
        />
      )}

      {/* Write a review */}
      <Box mt={3}>
        {user ? (
          myReview === undefined ? null : myReview ? (
            <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
              You have already reviewed this product.{" "}
              {myReview.status === "PENDING" && "Your review is awaiting moderation."}
              {myReview.status === "REJECTED" && `Your review was rejected. ${myReview.moderatorNote ? `Reason: ${myReview.moderatorNote}` : ""}`}
            </Alert>
          ) : (
            <>
              <Button
                variant="contained"
                onClick={() => setShowWriteForm(v => !v)}
                sx={{ mb: 2 }}
              >
                {showWriteForm ? "Close" : "Write a Review"}
              </Button>
              <Collapse in={showWriteForm}>
                <Box p={3} bgcolor="grey.50" borderRadius={2} mb={3}>
                  <Typography variant="h6" mb={2}>Write Your Review</Typography>
                  <ReviewForm
                    productId={productId}
                    onSuccess={handleReviewSuccess}
                    onCancel={() => setShowWriteForm(false)}
                  />
                </Box>
              </Collapse>
            </>
          )
        ) : (
          <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
            <a href="/login" style={{ color: "inherit", fontWeight: 600 }}>Sign in</a> to write a review.
          </Alert>
        )}
      </Box>

      {/* Sort control */}
      {(summary?.total ?? 0) > 0 && (
        <Stack direction="row" alignItems="center" spacing={2} mb={2} flexWrap="wrap">
          <Typography variant="body2" color="text.secondary">
            {summary?.total} review{summary?.total !== 1 ? "s" : ""}
          </Typography>
          <TextField
            select size="small" value={sort}
            onChange={e => { setSort(e.target.value); setPage(1); }}
            sx={{ minWidth: 200 }}
            label="Sort by"
          >
            {SORT_OPTIONS.map(o => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
        </Stack>
      )}

      {/* Review list */}
      {loading ? (
        <Box textAlign="center" py={4}><CircularProgress /></Box>
      ) : reviews.length === 0 ? (
        <Typography color="text.secondary" py={4} textAlign="center">
          No reviews yet. Be the first to review this product!
        </Typography>
      ) : (
        <Stack divider={<Divider />} spacing={3}>
          {reviews.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
              currentUserId={user?.id}
              productId={productId}
              onChanged={() => { load(); fetchMyReview(productId, getAccessToken()).then(setMyReview); }}
            />
          ))}
        </Stack>
      )}

      {pagination.totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination
            page={page}
            count={pagination.totalPages}
            onChange={(_, p) => setPage(p)}
            color="primary"
            variant="outlined"
          />
        </Box>
      )}
    </Box>
  );
}
