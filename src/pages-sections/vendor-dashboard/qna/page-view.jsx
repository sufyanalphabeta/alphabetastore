"use client";

import { useCallback, useEffect, useState } from "react";

// MUI
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

// UTILS
import { adminFetchQnA, adminAnswerQuestion, adminHideQuestion } from "utils/admin-reviews";
import PageWrapper from "../page-wrapper";

// ── Status chip ───────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  PENDING: "warning",
  ANSWERED: "success",
  HIDDEN: "default",
};

// ── Q&A Item Card ─────────────────────────────────────────────────────────────

function QnACard({ item, onAnswer, onHide }) {
  const [answer, setAnswer] = useState(item.answer ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAnswer = async () => {
    if (answer.trim().length < 5) return;
    setSaving(true);
    try {
      await onAnswer(item.id, answer.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" mb={1} flexWrap="wrap">
          <Chip label={item.status} color={STATUS_COLORS[item.status] ?? "default"} size="small" />
          <Typography variant="caption" color="text.secondary">
            {new Date(item.createdAt).toLocaleDateString()}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            · {item.product?.name ?? "—"}
          </Typography>
        </Stack>

        <Typography variant="body2" fontWeight={600}>Q: {item.question}</Typography>
        <Typography variant="caption" color="text.secondary">
          by {item.user?.name ?? item.user?.email ?? "Unknown"}
        </Typography>

        {item.answer && !editing && (
          <Box mt={1} pl={2} borderLeft="3px solid" borderColor="primary.main">
            <Typography variant="body2" color="text.secondary">A: {item.answer}</Typography>
          </Box>
        )}

        <Stack direction="row" spacing={1} mt={2} flexWrap="wrap">
          {item.status !== "ANSWERED" && !editing && (
            <Button size="small" variant="contained" color="primary" onClick={() => setEditing(true)}>
              Answer
            </Button>
          )}
          {item.status === "ANSWERED" && !editing && (
            <Button size="small" variant="outlined" onClick={() => setEditing(true)}>
              Edit Answer
            </Button>
          )}
          {item.status !== "HIDDEN" && (
            <Button size="small" variant="outlined" color="error" onClick={() => onHide(item.id)}>
              Hide
            </Button>
          )}
        </Stack>

        {editing && (
          <Box mt={2}>
            <TextField
              label="Answer"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              fullWidth multiline rows={3} size="small"
              inputProps={{ maxLength: 2000, minLength: 5 }}
            />
            <Stack direction="row" spacing={1} mt={1}>
              <Button size="small" variant="contained" onClick={handleAnswer} disabled={saving || answer.trim().length < 5}>
                {saving ? <CircularProgress size={14} color="inherit" /> : "Save Answer"}
              </Button>
              <Button size="small" variant="text" onClick={() => setEditing(false)}>Cancel</Button>
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

export default function QnAModerationPageView() {
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], pagination: { totalPages: 1 } });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await adminFetchQnA({ status: statusFilter, page, limit: 15 });
      setData(res);
    } catch (e) {
      setError(e?.message || "Failed to load Q&A.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  const handleAnswer = async (questionId, answer) => {
    await adminAnswerQuestion(questionId, answer);
    load();
  };

  const handleHide = async (questionId) => {
    await adminHideQuestion(questionId);
    load();
  };

  return (
    <PageWrapper title="Product Q&A">
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <Typography variant="subtitle2" color="text.secondary">Status:</Typography>
        <Select
          size="small"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
        >
          {["PENDING", "ANSWERED", "HIDDEN"].map(s => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
        </Select>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box textAlign="center" py={6}><CircularProgress /></Box>
      ) : data.items?.length === 0 ? (
        <Typography color="text.secondary" py={4} textAlign="center">No questions found.</Typography>
      ) : (
        <Stack spacing={2}>
          {data.items.map(item => (
            <QnACard key={item.id} item={item} onAnswer={handleAnswer} onHide={handleHide} />
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
    </PageWrapper>
  );
}
