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
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import StarIcon from "@mui/icons-material/Star";

// UTILS
import { currency } from "lib";
import {
  adminFetchVariants,
  adminCreateVariant,
  adminUpdateVariant,
  adminDeleteVariant,
} from "utils/admin-catalog";

// ── Attribute Editor ──────────────────────────────────────────────────────────

function AttributeEditor({ value = {}, onChange }) {
  const entries = Object.entries(value);

  const updateKey = (oldKey, newKey) => {
    const updated = {};
    for (const [k, v] of Object.entries(value)) {
      updated[k === oldKey ? newKey : k] = v;
    }
    onChange(updated);
  };

  const updateVal = (key, val) => onChange({ ...value, [key]: val });

  const addRow = () => {
    const key = `Attribute ${entries.length + 1}`;
    onChange({ ...value, [key]: "" });
  };

  const removeRow = (key) => {
    const updated = { ...value };
    delete updated[key];
    onChange(updated);
  };

  return (
    <Box>
      <Stack spacing={1} mb={1}>
        {entries.map(([k, v]) => (
          <Stack key={k} direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              label="Attribute"
              value={k}
              onChange={e => updateKey(k, e.target.value)}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Value"
              value={v}
              onChange={e => updateVal(k, e.target.value)}
              sx={{ flex: 1 }}
            />
            <IconButton size="small" color="error" onClick={() => removeRow(k)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
        ))}
      </Stack>
      <Button size="small" startIcon={<AddIcon />} onClick={addRow} variant="text">
        Add Attribute
      </Button>
    </Box>
  );
}

// ── Default form state ────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  name: "", sku: "", attributes: { RAM: "", Storage: "" },
  price: "", comparePrice: "", stockQty: "", isDefault: false, sortOrder: 0,
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function VariantsManager({ productId, productName }) {
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = create
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetchVariants(productId);
      setVariants(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Failed to load variants.");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (v) => {
    setEditTarget(v);
    setForm({
      name: v.name ?? "",
      sku: v.sku ?? "",
      attributes: v.attributes ?? {},
      price: String(v.price ?? ""),
      comparePrice: v.comparePrice ? String(v.comparePrice) : "",
      stockQty: String(v.stockQty ?? ""),
      isDefault: v.isDefault ?? false,
      sortOrder: v.sortOrder ?? 0,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name || undefined,
        sku: form.sku || undefined,
        attributes: form.attributes,
        price: Number(form.price),
        comparePrice: form.comparePrice ? Number(form.comparePrice) : undefined,
        stockQty: Number(form.stockQty),
        isDefault: form.isDefault,
        sortOrder: Number(form.sortOrder),
      };
      if (editTarget) {
        await adminUpdateVariant(productId, editTarget.id, payload);
      } else {
        await adminCreateVariant(productId, payload);
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      setError(e?.message || "Failed to save variant.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v) => {
    if (!confirm(`Delete variant "${v.name || v.id}"?`)) return;
    try {
      await adminDeleteVariant(productId, v.id);
      load();
    } catch (e) {
      setError(e?.message || "Failed to delete variant.");
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" fontWeight={700}>
          Variants {productName ? `— ${productName}` : ""}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} size="small" onClick={openCreate}>
          Add Variant
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box textAlign="center" py={4}><CircularProgress /></Box>
      ) : variants.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>
          No variants yet. Click "Add Variant" to create the first one.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {variants.map(v => (
            <Card key={v.id} variant="outlined">
              <CardContent>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
                  <Box flex={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" mb={0.5}>
                      {v.isDefault && (
                        <Chip icon={<StarIcon fontSize="small" />} label="Default" color="primary" size="small" />
                      )}
                      {v.name && (
                        <Typography variant="subtitle2" fontWeight={600}>{v.name}</Typography>
                      )}
                      {v.sku && (
                        <Typography variant="caption" color="text.secondary">SKU: {v.sku}</Typography>
                      )}
                    </Stack>
                    {v.attributes && typeof v.attributes === "object" && (
                      <Stack direction="row" flexWrap="wrap" gap={0.5} mb={0.5}>
                        {Object.entries(v.attributes).map(([k, val]) => (
                          <Chip key={k} label={`${k}: ${val}`} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    )}
                    <Stack direction="row" spacing={2} mt={0.5}>
                      <Typography variant="body2" color="primary.main" fontWeight={700}>
                        {currency(Number(v.price))}
                      </Typography>
                      <Typography variant="body2" color={v.stockQty > 0 ? "success.main" : "error.main"}>
                        {v.stockQty > 0 ? `${v.stockQty} in stock` : "Out of stock"}
                      </Typography>
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(v)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(v)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editTarget ? "Edit Variant" : "Add Variant"}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Stack spacing={2} mt={1}>
            <TextField
              label="Variant name (optional)"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              size="small" fullWidth
              placeholder="e.g. i7 / 16GB / 512GB"
            />
            <TextField
              label="SKU (optional)"
              value={form.sku}
              onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
              size="small" fullWidth
            />
            <Divider>Attributes</Divider>
            <AttributeEditor
              value={form.attributes}
              onChange={attrs => setForm(f => ({ ...f, attributes: attrs }))}
            />
            <Divider>Pricing & Stock</Divider>
            <Stack direction="row" spacing={2}>
              <TextField
                required label="Price" type="number" inputProps={{ min: 0, step: 0.01 }}
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                size="small" sx={{ flex: 1 }}
              />
              <TextField
                label="Compare Price" type="number" inputProps={{ min: 0, step: 0.01 }}
                value={form.comparePrice}
                onChange={e => setForm(f => ({ ...f, comparePrice: e.target.value }))}
                size="small" sx={{ flex: 1 }}
              />
            </Stack>
            <TextField
              required label="Stock Qty" type="number" inputProps={{ min: 0, step: 1 }}
              value={form.stockQty}
              onChange={e => setForm(f => ({ ...f, stockQty: e.target.value }))}
              size="small" fullWidth
            />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch
                checked={form.isDefault}
                onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                size="small"
              />
              <Typography variant="body2">Set as default variant</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.price || !form.stockQty}
          >
            {saving ? <CircularProgress size={18} color="inherit" /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
