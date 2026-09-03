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
import Divider from "@mui/material/Divider";
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
import MediaPicker from "components/admin/media/MediaPicker";
import {
  HOMEPAGE_BLOCK_TYPES,
  createHomepageBlock,
  deleteHomepageBlock,
  fetchHomepageBlocks,
  reorderHomepageBlocks,
  updateHomepageBlock
} from "utils/admin-homepage";

const TYPE_LABEL = Object.fromEntries(HOMEPAGE_BLOCK_TYPES.map(t => [t.value, t.label]));

/** Product-list blocks that only need a "limit" field. */
const PRODUCT_LIST_TYPES = new Set([
  "NEW_ARRIVALS",
  "BEST_SELLERS",
  "PROMOTIONS",
  "RECENTLY_ADDED"
]);

function defaultConfig(type) {
  if (type === "HERO_BANNER") return { imageUrl: "", href: "", headline: "" };
  if (type === "CUSTOM_PRODUCTS") return { productIds: "" };
  if (type === "FEATURED_CATEGORIES") return { limit: 12 };
  if (type === "FEATURED_BRANDS") return { limit: 12 };
  return { limit: 12 };
}

/** Typed config editor — renders different fields per block type. */
function BlockConfigEditor({ type, config, onChange, onPickImage }) {
  const set = (key, value) => onChange({ ...config, [key]: value });

  if (type === "HERO_BANNER") {
    return (
      <Stack spacing={2}>
        <Typography variant="subtitle2" color="text.secondary">Hero Banner</Typography>
        <TextField
          label="Image URL"
          value={config.imageUrl || ""}
          onChange={e => set("imageUrl", e.target.value)}
          fullWidth
          placeholder="https://example.com/banner.jpg"
        />
        <Button
          variant="outlined"
          onClick={onPickImage}
          sx={{ alignSelf: "flex-start" }}
        >
          اختيار الصورة من مكتبة الوسائط
        </Button>
        <TextField
          label="Link (href)"
          value={config.href || ""}
          onChange={e => set("href", e.target.value)}
          fullWidth
          placeholder="/products/search?category=laptops"
        />
        <TextField
          label="Headline (optional)"
          value={config.headline || ""}
          onChange={e => set("headline", e.target.value)}
          fullWidth
        />
      </Stack>
    );
  }

  if (type === "CUSTOM_PRODUCTS") {
    return (
      <Stack spacing={1}>
        <Typography variant="subtitle2" color="text.secondary">Custom Products</Typography>
        <TextField
          label="Product IDs (comma-separated)"
          value={Array.isArray(config.productIds) ? config.productIds.join(", ") : (config.productIds || "")}
          onChange={e => set("productIds", e.target.value)}
          multiline
          minRows={3}
          fullWidth
          helperText="Paste product UUIDs separated by commas"
        />
      </Stack>
    );
  }

  if (type === "FEATURED_CATEGORIES" || type === "FEATURED_BRANDS" || PRODUCT_LIST_TYPES.has(type)) {
    return (
      <Stack spacing={1}>
        <Typography variant="subtitle2" color="text.secondary">Display Settings</Typography>
        <TextField
          label="Max items to display"
          type="number"
          value={config.limit ?? 12}
          onChange={e => set("limit", Math.max(1, Math.min(50, Number(e.target.value) || 12)))}
          inputProps={{ min: 1, max: 50 }}
          sx={{ width: 180 }}
        />
      </Stack>
    );
  }

  return null;
}

function normalizeConfigForSave(type, config) {
  if (type === "CUSTOM_PRODUCTS") {
    const raw = Array.isArray(config.productIds) ? config.productIds : String(config.productIds || "");
    const ids = (Array.isArray(raw) ? raw : raw.split(",")).map(s => s.trim()).filter(Boolean);
    return { productIds: ids };
  }
  if (type === "HERO_BANNER") {
    return {
      imageUrl: (config.imageUrl || "").trim(),
      href: (config.href || "").trim(),
      headline: (config.headline || "").trim() || undefined
    };
  }
  return { limit: Number(config.limit) || 12 };
}

function emptyBlock(type = "NEW_ARRIVALS") {
  return {
    id: null,
    type,
    title: "",
    subtitle: "",
    isActive: true,
    sortOrder: 0,
    config: defaultConfig(type)
  };
}

export default function HomepageBlocksPageView() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

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
    setEditing(emptyBlock());
    setFormError("");
  };

  const startEdit = block => {
    setEditing({
      ...block,
      config: block.config && typeof block.config === "object" ? { ...block.config } : defaultConfig(block.type)
    });
    setFormError("");
  };

  const closeEditor = () => {
    setEditing(null);
    setFormError("");
  };

  const onTypeChange = newType => {
    setEditing(curr => ({ ...curr, type: newType, config: defaultConfig(newType) }));
  };

  const onConfigChange = newConfig => {
    setEditing(curr => ({ ...curr, config: newConfig }));
  };

  const onHeroMediaConfirm = selected => {
    const media = selected?.[0];
    if (media) {
      setEditing(curr => ({
        ...curr,
        config: { ...curr.config, imageUrl: media.productUrl || media.cardUrl || media.thumbnailUrl }
      }));
    }
    setMediaPickerOpen(false);
  };

  const onSave = async () => {
    if (!editing) return;
    const config = normalizeConfigForSave(editing.type, editing.config || {});
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
              onChange={e => onTypeChange(e.target.value)}
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
            <Divider />
            <BlockConfigEditor
              type={editing?.type || "NEW_ARRIVALS"}
              config={editing?.config || defaultConfig(editing?.type || "NEW_ARRIVALS")}
              onChange={onConfigChange}
              onPickImage={() => setMediaPickerOpen(true)}
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
      <MediaPicker
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        remaining={1}
        onConfirm={onHeroMediaConfirm}
      />
    </PageWrapper>
  );
}
