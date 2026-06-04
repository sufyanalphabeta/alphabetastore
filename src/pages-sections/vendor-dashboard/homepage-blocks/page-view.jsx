"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import PageWrapper from "../page-wrapper";
import {
  HOMEPAGE_BLOCK_TYPES,
  createHomepageBlock,
  deleteHomepageBlock,
  fetchHomepageBlocks,
  reorderHomepageBlocks,
  updateHomepageBlock
} from "utils/admin-homepage";

const TYPE_LABEL = Object.fromEntries(HOMEPAGE_BLOCK_TYPES.map(t => [t.value, t.label]));

function emptyBlock(type = "NEW_ARRIVALS") {
  return {
    id: null,
    type,
    title: "",
    subtitle: "",
    isActive: true,
    sortOrder: 0,
    config: { limit: 12 }
  };
}

function parseConfigText(value) {
  const text = String(value || "").trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    throw new Error("Config must be a JSON object");
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Invalid JSON");
  }
}

export default function HomepageBlocksPageView() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [editing, setEditing] = useState(null); // block being edited (or new draft)
  const [formError, setFormError] = useState("");
  const [configText, setConfigText] = useState("{}");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchHomepageBlocks();
      setBlocks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load blocks");
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(
    () => [...blocks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [blocks]
  );

  const startCreate = () => {
    const draft = emptyBlock();
    setEditing(draft);
    setConfigText(JSON.stringify(draft.config || {}, null, 2));
    setFormError("");
  };

  const startEdit = block => {
    setEditing({ ...block });
    setConfigText(JSON.stringify(block.config || {}, null, 2));
    setFormError("");
  };

  const closeEditor = () => {
    setEditing(null);
    setFormError("");
  };

  const onSave = async () => {
    if (!editing) return;
    let config;
    try {
      config = parseConfigText(configText);
    } catch (e) {
      setFormError(e.message);
      return;
    }
    const payload = {
      type: editing.type,
      title: editing.title?.trim() || undefined,
      subtitle: editing.subtitle?.trim() || undefined,
      isActive: Boolean(editing.isActive),
      sortOrder: Number(editing.sortOrder) || 0,
      config
    };
    setSaving(true);
    setFormError("");
    try {
      if (editing.id) {
        await updateHomepageBlock(editing.id, payload);
      } else {
        await createHomepageBlock(payload);
      }
      await load();
      closeEditor();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save block");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async block => {
    setBusyId(block.id);
    try {
      await updateHomepageBlock(block.id, { isActive: !block.isActive });
      setBlocks(curr => curr.map(b => (b.id === block.id ? { ...b, isActive: !block.isActive } : b)));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed to toggle block");
    } finally {
      setBusyId("");
    }
  };

  const onDelete = async block => {
    if (!window.confirm(`Delete block "${block.title || TYPE_LABEL[block.type]}"?`)) return;
    setBusyId(block.id);
    try {
      await deleteHomepageBlock(block.id);
      setBlocks(curr => curr.filter(b => b.id !== block.id));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed to delete block");
    } finally {
      setBusyId("");
    }
  };

  const move = async (block, direction) => {
    const idx = sorted.findIndex(b => b.id === block.id);
    const swap = sorted[idx + direction];
    if (!swap) return;
    setBusyId(block.id);
    try {
      await reorderHomepageBlocks([
        { id: block.id, sortOrder: swap.sortOrder ?? 0 },
        { id: swap.id, sortOrder: block.sortOrder ?? 0 }
      ]);
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed to reorder");
    } finally {
      setBusyId("");
    }
  };

  return (
    <PageWrapper title="Homepage Blocks">
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="body2" color="text.secondary">
          Build the storefront homepage from blocks. Drag the order with the arrows; toggle visibility per block.
        </Typography>
        <Button onClick={startCreate} variant="contained" startIcon={<Add />}>
          Add Block
        </Button>
      </Stack>

      <Card>
        {error ? (
          <Box p={2}>
            <Alert severity="error">{error}</Alert>
          </Box>
        ) : null}

        {loading ? (
          <Box display="flex" justifyContent="center" p={6}>
            <CircularProgress color="info" />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Order</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell>Subtitle</TableCell>
                  <TableCell align="center">Active</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                      No blocks yet. Add one to start building the homepage.
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((block, idx) => (
                    <TableRow key={block.id} hover>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <IconButton size="small" onClick={() => move(block, -1)} disabled={idx === 0 || busyId === block.id}>
                            ▲
                          </IconButton>
                          <Box minWidth={24} textAlign="center">{block.sortOrder ?? 0}</Box>
                          <IconButton
                            size="small"
                            onClick={() => move(block, 1)}
                            disabled={idx === sorted.length - 1 || busyId === block.id}
                          >
                            ▼
                          </IconButton>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={TYPE_LABEL[block.type] || block.type} />
                      </TableCell>
                      <TableCell>{block.title || <em style={{ color: "#999" }}>—</em>}</TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>{block.subtitle || ""}</TableCell>
                      <TableCell align="center">
                        <Switch
                          color="info"
                          checked={Boolean(block.isActive)}
                          onChange={() => toggleActive(block)}
                          disabled={busyId === block.id}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton onClick={() => startEdit(block)}>
                          <Edit />
                        </IconButton>
                        <IconButton onClick={() => onDelete(block)} disabled={busyId === block.id} color="error">
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Dialog open={Boolean(editing)} onClose={closeEditor} maxWidth="sm" fullWidth>
        <DialogTitle>{editing?.id ? "Edit Block" : "New Block"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} pt={1}>
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <TextField
              select
              label="Type"
              value={editing?.type || "NEW_ARRIVALS"}
              onChange={e => setEditing(curr => ({ ...curr, type: e.target.value }))}
              fullWidth
            >
              {HOMEPAGE_BLOCK_TYPES.map(t => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Title"
              value={editing?.title || ""}
              onChange={e => setEditing(curr => ({ ...curr, title: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Subtitle"
              value={editing?.subtitle || ""}
              onChange={e => setEditing(curr => ({ ...curr, subtitle: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Sort Order"
              type="number"
              value={editing?.sortOrder ?? 0}
              onChange={e => setEditing(curr => ({ ...curr, sortOrder: Number(e.target.value) || 0 }))}
              fullWidth
            />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                checked={Boolean(editing?.isActive)}
                onChange={e => setEditing(curr => ({ ...curr, isActive: e.target.checked }))}
              />
              <Typography variant="body2">Active</Typography>
            </Stack>
            <TextField
              label="Config (JSON)"
              value={configText}
              onChange={e => setConfigText(e.target.value)}
              multiline
              minRows={6}
              fullWidth
              helperText='Examples: {"limit":12} · {"productIds":["…"]} · {"categoryIds":["…"]}'
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditor}>Cancel</Button>
          <Button variant="contained" color="info" onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageWrapper>
  );
}
