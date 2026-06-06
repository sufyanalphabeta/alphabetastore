"use client";

import { useCallback, useEffect, useState } from "react";

// MUI
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

// UTILS & CONTEXTS
import { getAccessToken } from "utils/auth";
import { fetchProductQnA, submitQuestion, deleteQuestion } from "utils/catalog";
import { useAuth } from "contexts/AuthContext";

// ── Q&A Item ─────────────────────────────────────────────────────────────────

function QnaItem({ item, currentUserId, onDelete }) {
  const initials = item.user?.name
    ? item.user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";
  const isOwn = currentUserId && item.user?.id === currentUserId;

  return (
    <Box>
      {/* Question */}
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Avatar sx={{ bgcolor: "grey.300", color: "grey.800", width: 34, height: 34, fontSize: 13 }}>
          {initials}
        </Avatar>
        <Box flex={1}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
            <Typography variant="body2" fontWeight={600}>{item.user?.name ?? "Customer"}</Typography>
            <Typography variant="caption" color="text.secondary">
              {new Date(item.createdAt).toLocaleDateString()}
            </Typography>
            {isOwn && item.status !== "ANSWERED" && (
              <IconButton size="small" color="error" onClick={() => onDelete?.(item.id)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
          <Typography variant="body2" mt={0.5}>
            <strong>Q:</strong> {item.question}
          </Typography>

          {/* Answer */}
          {item.answer && (
            <Box
              mt={1}
              pl={2}
              borderLeft="3px solid"
              borderColor="primary.main"
            >
              <Stack direction="row" alignItems="center" spacing={0.5} mb={0.25}>
                <CheckCircleIcon fontSize="small" color="primary" />
                <Typography variant="caption" fontWeight={600} color="primary.main">
                  Store Answer
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {item.answer}
              </Typography>
            </Box>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function ProductQnA({ productId }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showAskForm, setShowAskForm] = useState(false);
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Delete confirmation dialog state
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProductQnA(productId, { page, limit: 10 });
      setItems(data.items ?? []);
      setPagination(data.pagination ?? { page: 1, totalPages: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [productId, page]);

  useEffect(() => { load(); }, [load]);

  const handleAsk = async () => {
    if (!question.trim() || question.trim().length < 10) {
      setError("Please enter at least 10 characters.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const token = getAccessToken();
      await submitQuestion(productId, question.trim(), token);
      setQuestion("");
      setShowAskForm(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (e) {
      setError(e?.message || "Failed to submit question.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const token = getAccessToken();
      await deleteQuestion(productId, deleteTargetId, token);
      setDeleteTargetId(null);
      load();
    } catch (e) {
      setDeleteError(e?.message || "Failed to delete question.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box id="qna">
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <QuestionAnswerIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
          Customer Q&amp;A
        </Typography>
      </Stack>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Your question has been submitted and will be answered soon.
        </Alert>
      )}

      {/* Ask a question */}
      {user ? (
        <>
          <Button
            variant="outlined"
            onClick={() => setShowAskForm(v => !v)}
            sx={{ mb: 2 }}
          >
            {showAskForm ? "Close" : "Ask a Question"}
          </Button>
          <Collapse in={showAskForm}>
            <Box p={2} bgcolor="grey.50" borderRadius={2} mb={3}>
              <TextField
                label="Your question"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                fullWidth multiline rows={3} size="small"
                inputProps={{ maxLength: 500, minLength: 10 }}
                helperText={error || `${question.length}/500 — minimum 10 characters`}
                error={Boolean(error)}
                disabled={submitting}
              />
              <Stack direction="row" spacing={1} mt={2}>
                <Button variant="contained" onClick={handleAsk} disabled={submitting || question.trim().length < 10}>
                  {submitting ? <CircularProgress size={18} color="inherit" /> : "Submit Question"}
                </Button>
                <Button variant="text" onClick={() => setShowAskForm(false)}>Cancel</Button>
              </Stack>
            </Box>
          </Collapse>
        </>
      ) : (
        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          <a href="/login" style={{ color: "inherit", fontWeight: 600 }}>Sign in</a> to ask a question.
        </Alert>
      )}

      {/* Q&A list */}
      {loading ? (
        <Box textAlign="center" py={4}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Typography color="text.secondary" py={2} textAlign="center">
          No questions yet. Be the first to ask!
        </Typography>
      ) : (
        <Stack divider={<Divider />} spacing={3}>
          {items.map(item => (
            <QnaItem
              key={item.id}
              item={item}
              currentUserId={user?.id}
              onDelete={(id) => setDeleteTargetId(id)}
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

      {/* Delete confirmation dialog */}
      <Dialog open={Boolean(deleteTargetId)} onClose={() => !deleting && setDeleteTargetId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Question</DialogTitle>
        <DialogContent>
          {deleteError && <Alert severity="error" sx={{ mb: 1 }}>{deleteError}</Alert>}
          <Typography variant="body2">
            Are you sure you want to delete this question? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTargetId(null)} disabled={deleting}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? <CircularProgress size={16} color="inherit" /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
