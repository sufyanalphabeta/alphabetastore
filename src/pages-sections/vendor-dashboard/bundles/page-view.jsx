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
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import LinkIcon from "@mui/icons-material/Link";

// UTILS
import { currency } from "lib";
import {
  adminFetchBundles,
  adminCreateBundle,
  adminUpdateBundle,
  adminDeleteBundle,
  adminAddBundleItem,
  adminRemoveBundleItem,
} from "utils/admin-catalog";
import ProductSearchPicker from "components/admin/ProductSearchPicker";
import PageWrapper from "../page-wrapper";

// ── Bundle form dialog ────────────────────────────────────────────────────────

const EMPTY_FORM = { name: "", slug: "", description: "", bundlePrice: "", isActive: true, sortOrder: 0 };

function BundleFormDialog({ open, bundle, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (bundle) {
      setForm({
        name: bundle.name ?? "",
        slug: bundle.slug ?? "",
        description: bundle.description ?? "",
        bundlePrice: bundle.bundlePrice ? String(bundle.bundlePrice) : "",
        isActive: bundle.isActive ?? true,
        sortOrder: bundle.sortOrder ?? 0,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [bundle, open]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        slug: form.slug || undefined,
        description: form.description || undefined,
        bundlePrice: form.bundlePrice ? Number(form.bundlePrice) : undefined,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder),
      };
      if (bundle) {
        await adminUpdateBundle(bundle.id, payload);
      } else {
        await adminCreateBundle(payload);
      }
      onSaved();
    } catch (e) {
      setError(e?.message || "Failed to save bundle.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{bundle ? "Edit Bundle" : "Create Bundle"}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} mt={1}>
          <TextField required label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} size="small" fullWidth />
          <TextField label="Slug (auto-generated if empty)" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} size="small" fullWidth />
          <TextField label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} size="small" fullWidth multiline rows={2} />
          <TextField label="Bundle Price (optional)" type="number" inputProps={{ min: 0, step: 0.01 }} value={form.bundlePrice} onChange={e => setForm(f => ({ ...f, bundlePrice: e.target.value }))} size="small" fullWidth />
          <Stack direction="row" alignItems="center" spacing={1}>
            <Switch checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} size="small" />
            <Typography variant="body2">Active</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name}>
          {saving ? <CircularProgress size={16} color="inherit" /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Bundle item adder ─────────────────────────────────────────────────────────

function AddItemDialog({ open, bundleId, existingIds, onClose, onAdded }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!selectedProduct?.id) return;
    setSaving(true);
    setError("");
    try {
      await adminAddBundleItem(bundleId, { productId: selectedProduct.id, quantity: Number(quantity) || 1 });
      setSelectedProduct(null); setQuantity(1);
      onAdded();
    } catch (e) {
      setError(e?.message || "Failed to add item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add Product to Bundle</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} mt={1}>
          <ProductSearchPicker
            label="Search product"
            value={selectedProduct}
            onChange={setSelectedProduct}
            helperText="Search by product name or SKU"
          />
          <TextField
            label="Quantity" type="number" inputProps={{ min: 1 }}
            value={quantity} onChange={e => setQuantity(e.target.value)}
            size="small" fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd} disabled={saving || !selectedProduct?.id}>
          {saving ? <CircularProgress size={16} color="inherit" /> : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Bundle card ───────────────────────────────────────────────────────────────

function BundleCardAdmin({ bundle, onEdit, onDelete, onAddItem, onRemoveItem, onRefresh }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" fontWeight={700}>{bundle.name}</Typography>
            <Chip label={bundle.isActive ? "Active" : "Inactive"} color={bundle.isActive ? "success" : "default"} size="small" />
            {bundle.bundlePrice && (
              <Chip label={`Bundle: ${currency(Number(bundle.bundlePrice))}`} color="primary" size="small" />
            )}
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Edit"><IconButton size="small" onClick={() => onEdit(bundle)}><EditIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => onDelete(bundle.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
          </Stack>
        </Stack>

        {bundle.description && (
          <Typography variant="body2" color="text.secondary" mb={1}>{bundle.description}</Typography>
        )}

        <Divider sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary">Items</Typography>
        </Divider>

        <Stack spacing={0.5} mb={1}>
          {(bundle.items || []).map(item => (
            <Stack key={item.id} direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="body2">
                {item.quantity > 1 ? `${item.quantity}× ` : ""}{item.product?.name ?? item.productId}
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="body2" color="primary.main">{currency(Number(item.product?.price ?? 0))}</Typography>
                <Tooltip title="Remove from bundle">
                  <IconButton size="small" color="error" onClick={() => onRemoveItem(bundle.id, item.productId)}>
                    <LinkOffIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          ))}
        </Stack>

        <Button size="small" startIcon={<AddIcon />} onClick={() => onAddItem(bundle.id)}>
          Add Product
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function BundlesPageView() {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editBundle, setEditBundle] = useState(null);
  const [addItemBundleId, setAddItemBundleId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetchBundles();
      setBundles(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Failed to load bundles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!confirm("Delete this bundle?")) return;
    try { await adminDeleteBundle(id); load(); }
    catch (e) { setError(e?.message || "Failed to delete."); }
  };

  const handleRemoveItem = async (bundleId, productId) => {
    if (!confirm("Remove this product from the bundle?")) return;
    try { await adminRemoveBundleItem(bundleId, productId); load(); }
    catch (e) { setError(e?.message || "Failed to remove item."); }
  };

  return (
    <PageWrapper title="Product Bundles">
      <Stack direction="row" justifyContent="flex-end" mb={3}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditBundle(null); setFormOpen(true); }}>
          Create Bundle
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box textAlign="center" py={6}><CircularProgress /></Box>
      ) : bundles.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>No bundles yet.</Typography>
      ) : (
        <Stack spacing={2}>
          {bundles.map(b => (
            <BundleCardAdmin
              key={b.id}
              bundle={b}
              onEdit={bundle => { setEditBundle(bundle); setFormOpen(true); }}
              onDelete={handleDelete}
              onAddItem={id => setAddItemBundleId(id)}
              onRemoveItem={handleRemoveItem}
              onRefresh={load}
            />
          ))}
        </Stack>
      )}

      <BundleFormDialog
        open={formOpen}
        bundle={editBundle}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); load(); }}
      />

      <AddItemDialog
        open={Boolean(addItemBundleId)}
        bundleId={addItemBundleId}
        onClose={() => setAddItemBundleId(null)}
        onAdded={() => { setAddItemBundleId(null); load(); }}
      />
    </PageWrapper>
  );
}
