"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AddPhotoAlternateOutlined from "@mui/icons-material/AddPhotoAlternateOutlined";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import Close from "@mui/icons-material/Close";
import Search from "@mui/icons-material/Search";
import WarningAmberRounded from "@mui/icons-material/WarningAmberRounded";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

import { listAdminMedia, uploadAdminMedia } from "utils/admin-media";

const PAGE_SIZE = 12;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 15 * 1024 * 1024;

function friendlyError(error, mode = "select") {
  const message = error instanceof Error ? error.message : "";
  if (/ready|processing|تجهز/i.test(message)) return "الصورة لم تجهز بعد، حاول مرة أخرى بعد قليل.";
  if (mode === "upload") return "تعذر رفع الصورة. تأكد من نوع الملف وحاول مرة أخرى.";
  return "تعذر تحديث صور المنتج. حاول مرة أخرى.";
}

export default function MediaPicker({ open, onClose, attachedIds = [], remaining = 4, onConfirm }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const inputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError("");
    try {
      const data = await listAdminMedia({ page, limit: PAGE_SIZE, search, processingStatus: "READY" });
      setItems(data.items || []);
      setTotalPages(Math.max(1, Number(data.totalPages || 1)));
    } catch (nextError) {
      setError(friendlyError(nextError));
    } finally {
      setLoading(false);
    }
  }, [open, page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (open) { setSelected([]); setNotice(""); setError(""); }
  }, [open]);

  const toggle = media => {
    if (attachedIds.includes(media.id)) return;
    setSelected(current => {
      if (current.some(item => item.id === media.id)) return current.filter(item => item.id !== media.id);
      if (current.length >= remaining) { setNotice(`يمكنك اختيار ${remaining.toLocaleString("ar-LY")} صور إضافية فقط.`); return current; }
      setNotice("");
      return [...current, media];
    });
  };

  const upload = async event => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const invalid = files.find(file => !ACCEPTED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE);
    if (invalid) { setNotice(invalid.size > MAX_FILE_SIZE ? "حجم الصورة أكبر من 15 ميجابايت." : "اختر صورة JPG أو PNG أو WebP."); return; }
    setUploading(true);
    setNotice("");
    try {
      const available = Math.max(0, remaining - selected.length);
      for (const file of files.slice(0, available)) {
        const asset = await uploadAdminMedia(file);
        setSelected(current => current.some(item => item.id === asset.id) ? current : [...current, asset]);
        if (asset.duplicate) setNotice("هذه الصورة موجودة مسبقًا في مكتبة الوسائط وتم اختيارها لك.");
      }
      await load();
    } catch (nextError) {
      setNotice(friendlyError(nextError, "upload"));
    } finally {
      setUploading(false);
    }
  };

  return <Dialog open={open} onClose={uploading ? undefined : onClose} fullWidth maxWidth="lg" fullScreen={fullScreen} dir="rtl">
    <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
      <Box><Typography variant="h6" fontWeight={800}>اختيار صور المنتج</Typography><Typography variant="caption" color="text.secondary">اختر من مكتبة الوسائط — المتبقي {remaining.toLocaleString("ar-LY")}</Typography></Box>
      <IconButton onClick={onClose} disabled={uploading} aria-label="إغلاق"><Close /></IconButton>
    </DialogTitle>
    <DialogContent dividers sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
          <TextField value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="ابحث باسم الصورة أو النص البديل" size="small" fullWidth InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} />
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={upload} />
          <Button variant="outlined" startIcon={uploading ? <CircularProgress size={18} /> : <AddPhotoAlternateOutlined />} onClick={() => inputRef.current?.click()} disabled={uploading || selected.length >= remaining} sx={{ whiteSpace: "nowrap" }}>رفع صور جديدة</Button>
        </Stack>
        {notice ? <Alert severity={/تعذر|أكبر|اختر/.test(notice) ? "warning" : "info"} onClose={() => setNotice("")}>{notice}</Alert> : null}
        {error ? <Alert severity="error" action={<Button onClick={load} color="inherit">إعادة المحاولة</Button>}>{error}</Alert> : null}
        {loading ? <Stack alignItems="center" py={8}><CircularProgress /></Stack> : <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", sm: "repeat(3,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" }, gap: 1.5 }}>
          {items.map(media => {
            const attached = attachedIds.includes(media.id);
            const checked = selected.some(item => item.id === media.id);
            const blocked = !checked && !attached && selected.length >= remaining;
            return <Box component="button" type="button" key={media.id} onClick={() => toggle(media)} disabled={attached || blocked} aria-pressed={checked || attached} sx={{ position: "relative", minWidth: 0, p: 1, borderRadius: 2, border: 2, borderColor: checked ? "primary.main" : attached ? "success.main" : "divider", bgcolor: checked ? "primary.50" : "background.paper", cursor: attached || blocked ? "not-allowed" : "pointer", opacity: blocked ? 0.55 : 1, textAlign: "start", font: "inherit" }}>
              <Box sx={{ aspectRatio: "1 / 1", bgcolor: "grey.50", borderRadius: 1.5, overflow: "hidden", p: 1 }}><Box component="img" src={media.thumbnailUrl || media.cardUrl} alt={media.altText || media.title || "صورة"} sx={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} /></Box>
              <Typography variant="caption" display="block" noWrap mt={0.75}>{media.title || media.originalFilename || "صورة"}</Typography>
              {media.warning ? <Stack direction="row" spacing={0.5} alignItems="center" color="warning.main"><WarningAmberRounded fontSize="inherit" /><Typography variant="caption">جودة منخفضة</Typography></Stack> : null}
              {(checked || attached) ? <CheckCircleRounded color={attached ? "success" : "primary"} sx={{ position: "absolute", top: 8, right: 8, bgcolor: "white", borderRadius: "50%" }} /> : null}
              {attached ? <Typography variant="caption" sx={{ position: "absolute", bottom: 8, left: 8, bgcolor: "success.main", color: "white", px: 0.75, borderRadius: 1 }}>مضافة</Typography> : null}
            </Box>;
          })}
        </Box>}
        {!loading && totalPages > 1 ? <Stack alignItems="center"><Pagination count={totalPages} page={page} onChange={(_, value) => setPage(value)} color="primary" siblingCount={0} /></Stack> : null}
      </Stack>
    </DialogContent>
    <DialogActions sx={{ p: 2, gap: 1 }}><Button onClick={onClose} disabled={uploading}>إلغاء</Button><Button variant="contained" onClick={() => onConfirm(selected)} disabled={!selected.length || uploading}>إضافة {selected.length ? `(${selected.length.toLocaleString("ar-LY")})` : ""}</Button></DialogActions>
  </Dialog>;
}
