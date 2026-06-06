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
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";

// UTILS
import {
  adminFetchRelations,
  adminAddRelation,
  adminRemoveRelation,
} from "utils/admin-catalog";
import ProductSearchPicker from "components/admin/ProductSearchPicker";
import PageWrapper from "../page-wrapper";

const RELATION_TYPES = [
  { value: "ACCESSORY", label: "Accessory" },
  { value: "FREQUENTLY_BOUGHT_TOGETHER", label: "Frequently Bought Together" },
  { value: "RECOMMENDED", label: "Recommended" },
  { value: "COMPATIBLE", label: "Compatible" },
];

const TYPE_COLORS = {
  ACCESSORY: "info",
  FREQUENTLY_BOUGHT_TOGETHER: "success",
  RECOMMENDED: "primary",
  COMPATIBLE: "secondary",
};

// â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function RelationsPageView() {
  const [sourceProduct, setSourceProduct] = useState(null);
  const [relations, setRelations] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addTargetProduct, setAddTargetProduct] = useState(null);
  const [addRelationType, setAddRelationType] = useState("ACCESSORY");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!sourceProduct?.id) return;
    setLoading(true);
    setError("");
    try {
      const data = await adminFetchRelations(sourceProduct.id);
      setRelations(data ?? {});
    } catch (e) {
      setError(e?.message || "Failed to load relations.");
    } finally {
      setLoading(false);
    }
  }, [sourceProduct]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!addTargetProduct?.id) return;
    setSaving(true);
    setError("");
    try {
      await adminAddRelation(sourceProduct.id, { targetId: addTargetProduct.id, relationType: addRelationType });
      setAddOpen(false);
      setAddTargetProduct(null);
      setAddRelationType("ACCESSORY");
      load();
    } catch (e) {
      setError(e?.message || "Failed to add relation.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (targetId, type) => {
    if (!confirm("Remove this relation?")) return;
    try {
      await adminRemoveRelation(sourceProduct.id, targetId, type);
      load();
    } catch (e) {
      setError(e?.message || "Failed to remove relation.");
    }
  };

  const allRelations = Object.entries(relations).flatMap(([type, items]) =>
    (Array.isArray(items) ? items : []).map(item => ({ ...item, relationType: type }))
  );

  return (
    <PageWrapper title="Product Relations">
      <Stack spacing={2} mb={3} maxWidth={500}>
        <ProductSearchPicker
          label="Source product"
          value={sourceProduct}
          onChange={(product) => { setSourceProduct(product); setRelations({}); }}
          helperText="Search for the product whose relations you want to manage"
        />
        {sourceProduct && (
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddOpen(true)}
            >
              Add Relation
            </Button>
          </Stack>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box textAlign="center" py={4}><CircularProgress /></Box>
      ) : !sourceProduct ? (
        <Typography color="text.secondary" textAlign="center" py={4}>
          Select a product above to manage its relations.
        </Typography>
      ) : allRelations.length === 0 ? (
        <Typography color="text.secondary" textAlign="center" py={4}>
          No relations found for this product.
        </Typography>
      ) : (
        <Stack spacing={2}>
          {allRelations.map(item => (
            <Card key={`${item.id}-${item.relationType}`} variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Chip
                      label={RELATION_TYPES.find(t => t.value === item.relationType)?.label ?? item.relationType}
                      color={TYPE_COLORS[item.relationType] ?? "default"}
                      size="small"
                    />
                    <Typography variant="body2" fontWeight={600}>{item.name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                      {item.id?.slice(0, 8)}â€¦
                    </Typography>
                  </Stack>
                  <Tooltip title="Remove relation">
                    <IconButton size="small" color="error" onClick={() => handleDelete(item.id, item.relationType)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Add relation dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Product Relation</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <ProductSearchPicker
              label="Target product"
              value={addTargetProduct}
              onChange={setAddTargetProduct}
              helperText="Search for the product to link to"
            />
            <Select
              value={addRelationType}
              onChange={e => setAddRelationType(e.target.value)}
              size="small" fullWidth
            >
              {RELATION_TYPES.map(t => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant="contained" onClick={handleAdd}
            disabled={saving || !addTargetProduct?.id}
          >
            {saving ? <CircularProgress size={16} color="inherit" /> : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageWrapper>
  );
}
