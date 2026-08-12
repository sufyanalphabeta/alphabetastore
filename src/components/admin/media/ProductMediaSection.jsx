"use client";

import { useState } from "react";
import ArrowBack from "@mui/icons-material/ArrowBack";
import ArrowForward from "@mui/icons-material/ArrowForward";
import CollectionsOutlined from "@mui/icons-material/CollectionsOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import StarRounded from "@mui/icons-material/StarRounded";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import MediaPicker from "./MediaPicker";
import { attachProductMedia, detachProductMedia, listProductMedia, reorderProductMedia, updateProductMediaRole } from "utils/admin-media";

const MAX_IMAGES = 4;

function remainingLabel(count) {
  if (count === 0) return "اكتمل الحد الأقصى";
  if (count === 1) return "يمكنك إضافة صورة أخرى";
  if (count === 2) return "يمكنك إضافة صورتين أخريين";
  return `يمكنك إضافة ${count.toLocaleString("ar-LY")} صور أخرى`;
}

function readableError(error) {
  const message = error instanceof Error ? error.message : "";
  if (/up to 4|4 images|أربع|4 صور/i.test(message)) return "يمكن إضافة 4 صور كحد أقصى للمنتج.";
  if (/already attached|already exists|مضافة/i.test(message)) return "هذه الصورة مضافة للمنتج بالفعل.";
  if (/ready|processing|تجهز/i.test(message)) return "الصورة لم تجهز بعد، حاول مرة أخرى بعد قليل.";
  return "تعذر تحديث صور المنتج. حاول مرة أخرى.";
}

function localItem(asset, index) {
  return {
    id: `local-${asset.id}`,
    mediaAssetId: asset.id,
    role: index === 0 ? "PRIMARY" : "GALLERY",
    sortOrder: index,
    thumbnailUrl: asset.thumbnailUrl,
    cardUrl: asset.cardUrl,
    productUrl: asset.productUrl,
    altText: asset.altText || null,
    warning: asset.warning || null
  };
}

export default function ProductMediaSection({ productId, items, onChange, onRemoveLegacy }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const modernItems = items.filter(item => item.mediaAssetId);
  const legacyItems = items.filter(item => !item.mediaAssetId);
  const legacyOnly = legacyItems.length > 0 && modernItems.length === 0;
  const remaining = legacyOnly ? MAX_IMAGES : Math.max(0, MAX_IMAGES - items.length);

  const refresh = async () => {
    if (!productId) return;
    const next = await listProductMedia(productId);
    onChange(next);
  };

  const run = async operation => {
    setBusy(true);
    setMessage(null);
    try {
      await operation();
    } catch (error) {
      setMessage({ severity: "error", text: readableError(error) });
      try { await refresh(); } catch { /* keep the actionable error and current state */ }
    } finally {
      setBusy(false);
    }
  };

  const add = selected => run(async () => {
    if (legacyOnly && !window.confirm("سيتم اعتماد مكتبة الوسائط للصور الجديدة، وستبقى الصور القديمة محفوظة للتوافق ولن تظهر مع المعرض الجديد. هل تريد المتابعة؟")) return;
    if (!productId) {
      const base = legacyOnly ? [] : items;
      const unique = selected.filter(asset => !base.some(item => item.mediaAssetId === asset.id));
      onChange([...base, ...unique].slice(0, MAX_IMAGES).map((item, index) => item.mediaAssetId ? { ...item, role: index === 0 ? "PRIMARY" : "GALLERY", sortOrder: index } : localItem(item, index)));
    } else {
      for (let index = 0; index < selected.length; index += 1) {
        await attachProductMedia(productId, selected[index].id, modernItems.length === 0 && index === 0 ? "PRIMARY" : "GALLERY");
      }
      await refresh();
    }
    setPickerOpen(false);
  });

  const makePrimary = item => run(async () => {
    if (!productId) {
      onChange([item, ...items.filter(current => current.id !== item.id)].map((current, index) => ({ ...current, role: index === 0 ? "PRIMARY" : "GALLERY", sortOrder: index })));
    } else {
      await updateProductMediaRole(productId, item.id, "PRIMARY");
      await refresh();
    }
  });

  const move = (index, delta) => run(async () => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    const primary = next.find(item => item.role === "PRIMARY");
    const ordered = [primary, ...next.filter(item => item.id !== primary?.id)].filter(Boolean);
    if (!productId) onChange(ordered.map((item, nextIndex) => ({ ...item, sortOrder: nextIndex })));
    else {
      await reorderProductMedia(productId, ordered.map(item => item.id));
      await refresh();
    }
  });

  const remove = item => run(async () => {
    if (!item.mediaAssetId) {
      await onRemoveLegacy?.(item.id);
      onChange(items.filter(current => current.id !== item.id).map((current, index) => ({ ...current, sortOrder: index })));
    } else if (!productId) {
      const next = items.filter(current => current.id !== item.id);
      onChange(next.map((current, index) => ({ ...current, role: index === 0 ? "PRIMARY" : "GALLERY", sortOrder: index })));
    } else {
      await detachProductMedia(productId, item.id);
      await refresh();
    }
  });

  return <Card variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 } }} dir="rtl">
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1.5}>
        <Box><Typography variant="h6" fontWeight={800}>صور المنتج</Typography><Typography variant="body2" color="text.secondary">4 صور كحد أقصى — {remainingLabel(remaining)}</Typography></Box>
        <Button variant="contained" startIcon={<CollectionsOutlined />} onClick={() => setPickerOpen(true)} disabled={busy || remaining === 0}>اختيار من مكتبة الوسائط</Button>
      </Stack>
      {legacyOnly ? <Alert severity="info">هذه صور قديمة ومتوافقة. لن يتم نقلها أو حذفها بمجرد فتح المنتج. عند اختيار صورة جديدة ستنتقل واجهة العرض إلى مكتبة الوسائط بصورة صريحة.</Alert> : null}
      {message ? <Alert severity={message.severity} onClose={() => setMessage(null)}>{message.text}</Alert> : null}
      {busy ? <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={18} /><Typography variant="body2">جارٍ تحديث الصور...</Typography></Stack> : null}
      {items.length ? <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", sm: "repeat(3,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" }, gap: 1.5 }}>
        {items.map((item, index) => <Box key={item.id} sx={{ minWidth: 0, border: 1, borderColor: item.role === "PRIMARY" ? "primary.main" : "divider", borderRadius: 2, p: 1, bgcolor: "background.paper" }}>
          <Box sx={{ aspectRatio: "1 / 1", bgcolor: "grey.50", borderRadius: 1.5, p: 1, overflow: "hidden", position: "relative" }}>
            <Box component="img" src={item.cardUrl || item.productUrl || item.thumbnailUrl || item.imageUrl} alt={item.altText || "صورة المنتج"} sx={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
            {item.role === "PRIMARY" ? <Chip icon={<StarRounded />} label="الصورة الرئيسية" color="primary" size="small" sx={{ position: "absolute", top: 8, right: 8, maxWidth: "calc(100% - 16px)" }} /> : null}
          </Box>
          {item.warning ? <Stack direction="row" spacing={0.5} color="warning.main" mt={0.75}><WarningAmberRounded fontSize="small" /><Typography variant="caption">جودة الصورة منخفضة، يفضل رفع صورة بدقة أعلى.</Typography></Stack> : null}
          <Stack direction="row" justifyContent="space-between" alignItems="center" mt={0.75}>
            <Typography variant="caption" color="text.secondary">الترتيب {(index + 1).toLocaleString("ar-LY")}</Typography>
            <Stack direction="row">
              <Tooltip title="السابق"><span><IconButton size="small" onClick={() => move(index, -1)} disabled={busy || index === 0 || item.role === "PRIMARY"}><ArrowForward fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="التالي"><span><IconButton size="small" onClick={() => move(index, 1)} disabled={busy || index === items.length - 1 || item.role === "PRIMARY"}><ArrowBack fontSize="small" /></IconButton></span></Tooltip>
              {item.role !== "PRIMARY" && item.mediaAssetId ? <Tooltip title="تعيين كرئيسية"><IconButton size="small" color="primary" onClick={() => makePrimary(item)} disabled={busy}><StarRounded fontSize="small" /></IconButton></Tooltip> : null}
              <Tooltip title={item.mediaAssetId ? "إزالة من المنتج فقط" : "إزالة الصورة القديمة من المنتج"}><IconButton size="small" color="error" onClick={() => remove(item)} disabled={busy}><DeleteOutline fontSize="small" /></IconButton></Tooltip>
            </Stack>
          </Stack>
        </Box>)}
      </Box> : <Stack alignItems="center" textAlign="center" py={4} spacing={0.5}><CollectionsOutlined sx={{ fontSize: 48, color: "text.disabled" }} /><Typography fontWeight={700}>لا توجد صور للمنتج</Typography><Typography variant="body2" color="text.secondary">الصور اختيارية ويمكن إضافتها الآن أو لاحقًا.</Typography></Stack>}
    </Stack>
    <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} attachedIds={modernItems.map(item => item.mediaAssetId)} remaining={remaining} onConfirm={add} />
  </Card>;
}
