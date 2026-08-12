"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ImageSearchOutlinedIcon from "@mui/icons-material/ImageSearchOutlined";
import SearchIcon from "@mui/icons-material/Search";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import Alert from "@mui/material/Alert";
import Backdrop from "@mui/material/Backdrop";
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
import InputAdornment from "@mui/material/InputAdornment";
import Pagination from "@mui/material/Pagination";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

import PageWrapper from "../page-wrapper";
import {
  deleteAdminMedia,
  getAdminMedia,
  listAdminMedia,
  updateAdminMedia,
  uploadAdminMedia
} from "utils/admin-media";

const PAGE_SIZE = 8;
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const FILTERS = [
  { value: "ALL", label: "الكل" },
  { value: "USED", label: "مستخدمة" },
  { value: "UNUSED", label: "غير مستخدمة" },
  { value: "READY", label: "جاهزة" },
  { value: "PROCESSING", label: "قيد المعالجة" },
  { value: "FAILED", label: "فشلت" }
];

const STATUS_LABELS = {
  READY: "جاهزة",
  PROCESSING: "قيد المعالجة",
  FAILED: "فشلت معالجة الصورة"
};

function queryFor(filter) {
  if (filter === "USED") return { used: true };
  if (filter === "UNUSED") return { used: false };
  if (["READY", "PROCESSING", "FAILED"].includes(filter)) return { processingStatus: filter };
  return {};
}

function readableError(error, action = "load") {
  if (error?.status === 401) return "انتهت جلسة الدخول. سجل الدخول مرة أخرى للمتابعة.";
  if (error?.status === 409) return error.message || "لا يمكن حذف الصورة لأنها مستخدمة في منتجات.";
  if (error?.status === 413) return "حجم الصورة أكبر من 15 ميجابايت.";
  if (error?.status === 400) return error.message || "الصورة غير صالحة أو نوعها غير مدعوم.";
  if (action === "upload") return "تعذر رفع الصورة. تحقق من الاتصال وحاول مرة أخرى.";
  if (action === "save") return "تعذر حفظ بيانات الصورة. حاول مرة أخرى.";
  if (action === "delete") return "تعذر حذف الصورة. حاول مرة أخرى.";
  return "تعذر تحميل مكتبة الوسائط. تحقق من الاتصال وحاول مرة أخرى.";
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value.toLocaleString("ar-LY")} بايت`;
  if (value < 1024 ** 2) return `${(value / 1024).toLocaleString("ar-LY", { maximumFractionDigits: 1 })} كيلوبايت`;
  return `${(value / 1024 ** 2).toLocaleString("ar-LY", { maximumFractionDigits: 1 })} ميجابايت`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-LY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function displayName(media) {
  return media?.title?.trim() || media?.originalFilename || "صورة بدون عنوان";
}

function statusColor(status) {
  if (status === "READY") return "success";
  if (status === "FAILED") return "error";
  return "warning";
}

function MediaPreview({ media, detail = false }) {
  const src = detail ? media?.productUrl || media?.cardUrl || media?.thumbnailUrl : media?.cardUrl || media?.thumbnailUrl;
  if (!src || media?.processingStatus === "FAILED") {
    return <Stack alignItems="center" justifyContent="center" sx={{ width: "100%", height: "100%", color: "text.disabled" }}>
      <BrokenImageOutlinedIcon sx={{ fontSize: detail ? 64 : 40 }} />
    </Stack>;
  }
  return <Box component="img" src={src} alt={media?.altText || displayName(media)} loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />;
}

function MediaTile({ media, onOpen }) {
  const isUsed = Number(media.usageCount || 0) > 0;
  return <Card component="button" type="button" onClick={() => onOpen(media)} variant="outlined" sx={{ p: 0, width: "100%", minWidth: 0, textAlign: "start", cursor: "pointer", overflow: "hidden", bgcolor: "background.paper", borderColor: "divider", transition: "160ms ease", "&:hover": { borderColor: "primary.main", boxShadow: 3, transform: "translateY(-2px)" } }}>
    <Box sx={{ position: "relative", aspectRatio: "1 / 1", bgcolor: "grey.50", p: 1 }}>
      <MediaPreview media={media} />
      <Stack direction="row" spacing={0.5} sx={{ position: "absolute", top: 8, insetInlineStart: 8 }}>
        {media.warning ? <Tooltip title="جودة الصورة منخفضة"><Chip size="small" color="warning" icon={<WarningAmberRoundedIcon />} label="جودة منخفضة" sx={{ bgcolor: "warning.50" }} /></Tooltip> : null}
        {media.processingStatus !== "READY" ? <Chip size="small" color={statusColor(media.processingStatus)} label={STATUS_LABELS[media.processingStatus] || "غير جاهزة"} /> : null}
      </Stack>
    </Box>
    <Stack spacing={0.7} sx={{ p: 1.5 }}>
      <Typography fontWeight={700} noWrap title={displayName(media)}>{displayName(media)}</Typography>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Chip size="small" variant={isUsed ? "filled" : "outlined"} color={isUsed ? "primary" : "default"} label={isUsed ? `مستخدمة (${Number(media.usageCount).toLocaleString("ar-LY")})` : "غير مستخدمة"} />
        <Typography variant="caption" color="text.secondary">{formatBytes(media.originalSizeBytes)}</Typography>
      </Stack>
    </Stack>
  </Card>;
}

function GridSkeleton() {
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
    {Array.from({ length: PAGE_SIZE }).map((_, index) => <Card variant="outlined" key={index} sx={{ overflow: "hidden" }}><Skeleton variant="rectangular" sx={{ aspectRatio: "1 / 1" }} /><Box p={1.5}><Skeleton width="76%" /><Skeleton width="52%" /></Box></Card>)}
  </Box>;
}

function UploadArea({ uploading, onFiles }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const selectFiles = event => {
    onFiles(Array.from(event.target.files || []));
    event.target.value = "";
  };
  const drop = event => {
    event.preventDefault();
    setDragging(false);
    onFiles(Array.from(event.dataTransfer.files || []));
  };
  return <Box onDragEnter={event => { event.preventDefault(); setDragging(true); }} onDragOver={event => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={drop} onClick={() => !uploading && inputRef.current?.click()} sx={{ border: "2px dashed", borderColor: dragging ? "primary.main" : "divider", bgcolor: dragging ? "primary.50" : "grey.50", borderRadius: 2, px: 2, py: 2.25, cursor: uploading ? "wait" : "pointer", transition: "150ms ease" }}>
    <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="center" spacing={1.5} textAlign="center">
      {uploading ? <CircularProgress size={32} /> : <AddPhotoAlternateOutlinedIcon color="primary" sx={{ fontSize: 38 }} />}
      <Box>
        <Typography fontWeight={800}>{uploading ? "جارٍ رفع وتحسين الصور..." : "اسحب الصور هنا أو اخترها من جهازك"}</Typography>
        <Typography variant="body2" color="text.secondary">سيتم تحسين الصور تلقائيًا للمتجر · JPG أو PNG أو WebP · حتى 15 ميجابايت</Typography>
      </Box>
      {!uploading ? <Button variant="contained" component="span">اختيار الصور</Button> : null}
    </Stack>
    <input ref={inputRef} hidden multiple type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={selectFiles} />
  </Box>;
}

function DetailDialog({ mediaId, open, onClose, onChanged, onDeleted }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [media, setMedia] = useState(null);
  const [form, setForm] = useState({ altText: "", title: "", caption: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !mediaId) return;
    let active = true;
    setLoading(true);
    setError("");
    getAdminMedia(mediaId).then(data => {
      if (!active) return;
      setMedia(data);
      setForm({ altText: data.altText || "", title: data.title || "", caption: data.caption || "" });
    }).catch(nextError => active && setError(readableError(nextError))).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [mediaId, open]);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await updateAdminMedia(media.id, form);
      setMedia(updated);
      onChanged(updated);
    } catch (nextError) {
      setError(readableError(nextError, "save"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setError("");
    try {
      await deleteAdminMedia(media.id);
      setConfirmDelete(false);
      onDeleted(media.id);
      onClose();
    } catch (nextError) {
      setConfirmDelete(false);
      setError(readableError(nextError, "delete"));
    } finally {
      setDeleting(false);
    }
  };

  const used = Number(media?.usageCount || 0) > 0;
  return <>
    <Dialog open={open} onClose={saving || deleting ? undefined : onClose} fullScreen={fullScreen} fullWidth maxWidth="lg" PaperProps={{ sx: { borderRadius: fullScreen ? 0 : 3 } }}>
      <DialogTitle component="div" sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Box minWidth={0}><Typography variant="h5" fontWeight={800}>تفاصيل الصورة</Typography><Typography variant="body2" color="text.secondary" noWrap>{media?.originalFilename || "جارٍ التحميل..."}</Typography></Box>
          <IconButton onClick={onClose} aria-label="إغلاق"><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: { xs: 2, md: 3 } }}>
        {loading ? <Stack alignItems="center" py={10}><CircularProgress /></Stack> : null}
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {media && !loading ? <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.05fr) minmax(340px, .95fr)" }, gap: 3 }}>
          <Stack spacing={2}>
            <Box sx={{ aspectRatio: "1 / 1", bgcolor: "grey.50", border: 1, borderColor: "divider", borderRadius: 2, p: 2, overflow: "hidden" }}><MediaPreview media={media} detail /></Box>
            {media.warning ? <Alert severity="warning" icon={<WarningAmberRoundedIcon />}>{media.warning}</Alert> : null}
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5 }}>
              <Info label="الأبعاد" value={media.originalWidth && media.originalHeight ? `${media.originalWidth.toLocaleString("ar-LY")} × ${media.originalHeight.toLocaleString("ar-LY")}` : "—"} />
              <Info label="حجم الملف" value={formatBytes(media.originalSizeBytes)} />
              <Info label="تاريخ الرفع" value={formatDate(media.createdAt)} />
              <Info label="الحالة" value={STATUS_LABELS[media.processingStatus] || media.processingStatus} />
              <Info label="الاستخدام" value={used ? `مستخدمة في ${media.usageCount.toLocaleString("ar-LY")} منتجات` : "غير مستخدمة"} />
              <Info label="رفعها" value={media.uploader?.name || media.uploader?.email || "—"} />
            </Box>
            {media.products?.length ? <Box><Typography fontWeight={800} mb={1}>المنتجات التي تستخدم الصورة</Typography><Stack spacing={0.75}>{media.products.map(product => <Chip key={product.id} label={product.name} variant="outlined" sx={{ justifyContent: "flex-start" }} />)}</Stack></Box> : null}
          </Stack>
          <Stack spacing={2}>
            <Box><Typography variant="h6" fontWeight={800}>بيانات الصورة</Typography><Typography variant="body2" color="text.secondary">ساعد العملاء ومحركات البحث على فهم محتوى الصورة.</Typography></Box>
            <TextField label="العنوان" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} fullWidth inputProps={{ maxLength: 200 }} />
            <TextField label="النص البديل" value={form.altText} onChange={event => setForm(current => ({ ...current, altText: event.target.value }))} fullWidth helperText="وصف مختصر للصورة لتحسين الوصول ومحركات البحث." inputProps={{ maxLength: 500 }} />
            <TextField label="الوصف / التعليق" value={form.caption} onChange={event => setForm(current => ({ ...current, caption: event.target.value }))} fullWidth multiline minRows={4} inputProps={{ maxLength: 1000 }} />
            <Button variant="contained" onClick={save} disabled={saving || media.processingStatus === "PROCESSING"} startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <CheckCircleOutlineIcon />}>{saving ? "جارٍ الحفظ..." : "حفظ البيانات"}</Button>
            <Divider />
            <Box><Typography fontWeight={800}>حذف الصورة</Typography><Typography variant="body2" color="text.secondary">يمكن حذف الصور غير المستخدمة فقط.</Typography></Box>
            <Tooltip title={used ? `لا يمكن حذف الصورة لأنها مستخدمة في ${media.usageCount} منتجات.` : ""}>
              <span><Button fullWidth variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} disabled={used || deleting} onClick={() => setConfirmDelete(true)}>حذف من المكتبة</Button></span>
            </Tooltip>
          </Stack>
        </Box> : null}
      </DialogContent>
    </Dialog>
    <Dialog open={confirmDelete} onClose={() => !deleting && setConfirmDelete(false)} maxWidth="xs" fullWidth>
      <DialogTitle>حذف الصورة؟</DialogTitle>
      <DialogContent><Typography>سيتم حذف الصورة ونسخ العرض الخاصة بها نهائيًا. لا يمكن التراجع عن هذا الإجراء.</Typography></DialogContent>
      <DialogActions><Button onClick={() => setConfirmDelete(false)} disabled={deleting}>إلغاء</Button><Button color="error" variant="contained" onClick={remove} disabled={deleting}>{deleting ? "جارٍ الحذف..." : "حذف"}</Button></DialogActions>
    </Dialog>
  </>;
}

function Info({ label, value }) {
  return <Box sx={{ bgcolor: "grey.50", borderRadius: 1.5, p: 1.25, minWidth: 0 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="body2" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>{value}</Typography></Box>;
}

export default function MediaLibraryPageView() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");
    try {
      const data = await listAdminMedia({ page, limit: PAGE_SIZE, search, ...queryFor(filter) });
      if (requestId !== requestRef.current) return;
      setItems(data.items || []);
      setTotal(Number(data.total || 0));
      setTotalPages(Math.max(1, Number(data.totalPages || 1)));
      if (page > Number(data.totalPages || 1) && Number(data.totalPages || 0) > 0) setPage(Number(data.totalPages));
    } catch (nextError) {
      if (requestId === requestRef.current) setError(readableError(nextError));
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [filter, page, search]);

  useEffect(() => { load(); }, [load]);

  const uploadFiles = async files => {
    if (!files.length) return;
    const invalid = files.find(file => !ACCEPTED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE);
    if (invalid) {
      setNotice({ severity: "error", text: invalid.size > MAX_FILE_SIZE ? `الصورة ${invalid.name} أكبر من 15 ميجابايت.` : `نوع الملف ${invalid.name} غير مدعوم.` });
      return;
    }
    setUploading(true);
    setNotice(null);
    let uploaded = 0;
    let duplicates = 0;
    let firstAsset = null;
    try {
      for (const file of files) {
        const result = await uploadAdminMedia(file);
        if (result.duplicate) duplicates += 1;
        else uploaded += 1;
        firstAsset ||= result;
      }
      if (duplicates && !uploaded) setNotice({ severity: "info", text: "هذه الصورة موجودة مسبقًا في مكتبة الوسائط." });
      else setNotice({ severity: "success", text: `تم رفع وتحسين ${uploaded.toLocaleString("ar-LY")} صورة بنجاح${duplicates ? `، و${duplicates.toLocaleString("ar-LY")} موجودة مسبقًا` : ""}.` });
      setPage(1);
      setFilter("ALL");
      setSearchInput("");
      setSearch("");
      await load();
      if (duplicates === files.length && firstAsset?.id) setSelectedId(firstAsset.id);
    } catch (nextError) {
      setNotice({ severity: "error", text: readableError(nextError, "upload") });
    } finally {
      setUploading(false);
    }
  };

  const emptyMessage = useMemo(() => search ? "لا توجد صور تطابق البحث الحالي." : filter !== "ALL" ? "لا توجد صور ضمن هذا الفلتر." : "مكتبة الوسائط فارغة. ارفع أول صورة للبدء.", [filter, search]);

  return <PageWrapper title="مكتبة الوسائط">
    <Stack spacing={2.5} dir="rtl">
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={1}>
        <Box><Typography variant="body1" color="text.secondary">ارفع الصور ونظّمها وعدّل بياناتها من مكان واحد.</Typography><Typography variant="caption" color="text.secondary">{total.toLocaleString("ar-LY")} صورة في النتائج الحالية</Typography></Box>
      </Stack>

      <UploadArea uploading={uploading} onFiles={uploadFiles} />
      {notice ? <Alert severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert> : null}
      {error ? <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>إعادة المحاولة</Button>}>{error}</Alert> : null}

      <Card variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, overflow: "visible" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
          <TextField value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="ابحث بالاسم أو العنوان أو النص البديل" size="small" sx={{ flex: 1, minWidth: { md: 300 } }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} />
          <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
            {FILTERS.map(option => <Chip key={option.value} label={option.label} clickable color={filter === option.value ? "primary" : "default"} variant={filter === option.value ? "filled" : "outlined"} onClick={() => { setFilter(option.value); setPage(1); }} />)}
          </Stack>
        </Stack>
      </Card>

      {loading ? <GridSkeleton /> : items.length ? <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1.25, md: 2 } }}>
        {items.map(media => <MediaTile key={media.id} media={media} onOpen={item => setSelectedId(item.id)} />)}
      </Box> : <Card variant="outlined"><Stack alignItems="center" textAlign="center" py={8} px={2} spacing={1}><ImageSearchOutlinedIcon sx={{ fontSize: 56, color: "text.disabled" }} /><Typography variant="h6" fontWeight={800}>{emptyMessage}</Typography><Typography color="text.secondary">يمكنك تغيير البحث أو الفلتر ثم المحاولة مرة أخرى.</Typography></Stack></Card>}

      {!loading && totalPages > 1 ? <Stack alignItems="center" py={1}><Pagination page={page} count={totalPages} color="primary" onChange={(_, next) => setPage(next)} siblingCount={0} /></Stack> : null}
    </Stack>

    <DetailDialog mediaId={selectedId} open={Boolean(selectedId)} onClose={() => setSelectedId(null)} onChanged={updated => { setItems(current => current.map(item => item.id === updated.id ? { ...item, ...updated } : item)); setNotice({ severity: "success", text: "تم حفظ بيانات الصورة بنجاح." }); }} onDeleted={() => { setNotice({ severity: "success", text: "تم حذف الصورة من المكتبة." }); load(); }} />
    <Backdrop open={uploading} sx={{ zIndex: theme => theme.zIndex.modal + 1, color: "common.white", flexDirection: "column", gap: 1.5 }}><CircularProgress color="inherit" /><Typography fontWeight={800}>جارٍ رفع وتحسين الصور...</Typography></Backdrop>
  </PageWrapper>;
}
