"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AddIcon from "@mui/icons-material/Add";
import Autocomplete from "@mui/material/Autocomplete";

import PageWrapper from "../page-wrapper";
import {
  applyCatalogImport,
  formatIssue,
  getAdminCategoryTree,
  getCatalogImport,
  getCatalogImportRows,
  getUnmappedCategories,
  IMPORT_STATUS,
  listCatalogImports,
  resolveImportCategory,
  SESSION_STATUS_LABELS,
  summarizeSession,
  translateStatus,
  uploadCatalogImport
} from "utils/admin-catalog-import";

const steps = ["رفع الملف", "تحليل البيانات", "مراجعة التصنيفات", "مراجعة المنتجات", "اعتماد الاستيراد", "النتيجة"];

function messageForError(error) {
  if (error?.status === 400) return error.message || "تعذر تنفيذ العملية. راجع البيانات.";
  if (error?.status === 404) return "جلسة الاستيراد غير موجودة.";
  return "تعذر الاتصال بالخادم. حاول مرة أخرى.";
}

function flattenCategories(nodes, parent = []) {
  return (Array.isArray(nodes) ? nodes : []).flatMap(node => {
    const path = [...parent, node.name];
    return [{ id: node.id, name: node.name, path }, ...flattenCategories(node.children, path)];
  });
}

function valueFromRow(row, names) {
  const values = { ...(row?.rawValues || {}), ...(row?.normalizedValues || {}) };
  for (const name of names) {
    const needle = name.toLowerCase();
    const key = Object.keys(values).find(item => item.toLowerCase() === needle || item.toLowerCase().includes(needle));
    if (key && values[key] !== null && values[key] !== undefined && String(values[key]).trim() !== "") return values[key];
  }
  return "—";
}

function SummaryCards({ session }) {
  const summary = summarizeSession(session);
  const cards = [
    ["إجمالي الصفوف", summary.total, "primary"],
    ["منتجات جديدة", summary.newCount, "success"],
    ["بدون تغيير", summary.unchanged, "default"],
    ["التغييرات", summary.changed, "warning"],
    ["التعارضات", summary.conflicts, "error"],
    ["تحتاج مراجعة", summary.needsReview, summary.needsReview ? "error" : "success"]
  ];
  return <Grid container spacing={1.5}>{cards.map(([label, value, color]) => <Grid size={{ xs: 6, sm: 4, md: 2 }} key={label}>
    <Card variant="outlined"><CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h5" fontWeight={700} color={color === "default" ? "text.primary" : `${color}.main`}>{value}</Typography>
    </CardContent></Card>
  </Grid>)}</Grid>;
}

function UploadStep({ onUploaded, busy, error }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const choose = event => {
    const next = event.target.files?.[0];
    if (next) setFile(next);
  };
  const submit = async () => {
    if (!file) return;
    await onUploaded(file);
  };
  return <Stack spacing={2}>
    <Alert severity="info">يمكنك تصدير قائمة المنتجات من نظام الركيزة بصيغة CSV ثم رفعها هنا.</Alert>
    <Box onClick={() => inputRef.current?.click()} sx={{ border: "2px dashed", borderColor: "primary.light", borderRadius: 2, p: { xs: 3, md: 6 }, textAlign: "center", cursor: "pointer", bgcolor: "primary.50" }}>
      <UploadFileIcon color="primary" sx={{ fontSize: 48 }} />
      <Typography fontWeight={700}>{file ? file.name : "اسحب ملف CSV هنا أو اختره من جهازك"}</Typography>
      <Typography variant="caption" color="text.secondary">CSV فقط · الحد الأقصى 25 ميجابايت</Typography>
      <input ref={inputRef} hidden type="file" accept=".csv,text/csv" onChange={choose} />
    </Box>
    {file && <Stack direction="row" spacing={1} justifyContent="center"><Chip label={`${file.name} · ${(file.size / 1024).toFixed(0)} KB`} onDelete={() => setFile(null)} /></Stack>}
    {error && <Alert severity="error">{error}</Alert>}
    <Button variant="contained" disabled={!file || busy} onClick={submit} startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <UploadFileIcon />}>
      {busy ? "جارٍ التحليل..." : "رفع وتحليل الملف"}
    </Button>
  </Stack>;
}

function CategoryStep({ session, onChanged, error }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [categoryId, setCategoryId] = useState("");
  const [newName, setNewName] = useState("");
  const [parentId, setParentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState("");
  const selectedCategory = categories.find(cat => cat.id === categoryId) || null;
  const selectedParentCategory = categories.find(cat => cat.id === parentId) || null;
  useEffect(() => {
    setLocalError("");
    Promise.all([getUnmappedCategories(session.id), getAdminCategoryTree()])
      .then(([next, tree]) => { setItems(next || []); setCategories(flattenCategories(tree)); })
      .catch(err => setLocalError(messageForError(err)));
  }, [session.id]);
  const resolve = async payload => {
    setBusy(true);
    setLocalError("");
    try { await resolveImportCategory(session.id, payload); const [next, refreshed] = await Promise.all([getUnmappedCategories(session.id), getCatalogImport(session.id)]); setItems(next || []); onChanged(refreshed); setSelected(null); setCategoryId(""); setNewName(""); setParentId(""); } catch (err) { setLocalError(messageForError(err)); } finally { setBusy(false); }
  };
  return <Stack spacing={2}>
    {(error || localError) && <Alert severity="error">{error || localError}</Alert>}
    {!items.length ? <Alert severity="success" icon={<CheckCircleOutlineIcon />}>تم ربط جميع التصنيفات. يمكنك الانتقال لمراجعة المنتجات.</Alert> : items.map(item => <Card variant="outlined" key={item.sourceCategory}>
      <CardContent><Stack spacing={1}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}><Box><Typography fontWeight={700}>{item.sourceCategory}</Typography><Typography variant="body2" color="text.secondary">{item.affectedRows} منتج · {item.sampleProductNames?.slice(0, 3).join("، ")}</Typography></Box><Chip size="small" color="warning" label="يحتاج ربطًا" /></Stack>
        {selected === item.sourceCategory ? <Stack spacing={1} sx={{ mt: 1 }}>
          <Autocomplete
            size="small"
            options={categories}
            value={selectedCategory}
            getOptionLabel={option => option?.path?.join(" / ") || ""}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_, next) => setCategoryId(next?.id || "")}
            renderInput={params => <TextField {...params} label="ابحث واختر تصنيفًا موجودًا" />}
          />
          <Button variant="contained" disabled={!categoryId || busy} onClick={() => resolve({ sourceCategory: item.sourceCategory, categoryId })}>حفظ الربط</Button>
          <Divider><Typography variant="caption">أو أنشئ تصنيفًا جديدًا</Typography></Divider>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}><TextField size="small" label="اسم التصنيف" value={newName} onChange={event => setNewName(event.target.value)} fullWidth /><Autocomplete
            size="small"
            options={categories}
            value={selectedParentCategory}
            getOptionLabel={option => option?.path?.join(" / ") || ""}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            onChange={(_, next) => setParentId(next?.id || "")}
            sx={{ minWidth: { xs: "100%", sm: 260 } }}
            renderInput={params => <TextField {...params} label="تصنيف أب اختياري" />}
          /></Stack>
          <Button variant="outlined" disabled={!newName.trim() || busy} onClick={() => resolve({ sourceCategory: item.sourceCategory, create: { name: newName, parentCategoryId: parentId || undefined } })} startIcon={<AddIcon />}>إنشاء وربط</Button>
        </Stack> : <Button size="small" onClick={() => setSelected(item.sourceCategory)}>ربط التصنيف</Button>}
      </Stack></CardContent>
    </Card>)}
  </Stack>;
}

function RowValueList({ values }) {
  const entries = Object.entries(values || {}).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "");
  if (!entries.length) return <Typography color="text.secondary">لا توجد بيانات قابلة للعرض.</Typography>;
  return <Stack spacing={1}>{entries.map(([key, value]) => <Box key={key} sx={{ p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
    <Typography variant="caption" color="text.secondary">{key}</Typography>
    <ReadableValue value={value} />
  </Box>)}</Stack>;
}

function ReadableValue({ value }) {
  if (value && typeof value === "object") {
    const labels = { current: "الحالي", incoming: "الوارد", currentId: "الحالي", incomingId: "الوارد", manualEnrichmentUnknown: "حماية التعديل اليدوي" };
    return <Stack spacing={0.5}>{Object.entries(value).map(([key, item]) => <Typography key={key} variant="body2" sx={{ wordBreak: "break-word" }}>
      <Box component="span" color="text.secondary">{labels[key] || key}: </Box>{String(item)}
    </Typography>)}</Stack>;
  }
  return <Typography variant="body2" sx={{ wordBreak: "break-word" }}>{String(value)}</Typography>;
}

function RowDetails({ row, onClose }) {
  const errors = [...(row?.validationErrors?.errors || []), ...(row?.validationErrors?.warnings || [])];
  const changes = row?.detectedChanges || {};
  return <Dialog open onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>تفاصيل الصف رقم {row.rowNumber}</DialogTitle><DialogContent dividers><Stack spacing={2}>
    <Box><Typography fontWeight={700} mb={1}>بيانات الملف</Typography><RowValueList values={row.rawValues} /></Box>
    <Box><Typography fontWeight={700} mb={1}>التغييرات المكتشفة</Typography>{Object.keys(changes).length ? <RowValueList values={changes} /> : <Typography color="text.secondary">لا توجد تغييرات.</Typography>}</Box>
    {errors.length > 0 && <Alert severity="warning"><Stack>{errors.map((issue, index) => <span key={index}>{formatIssue(issue)}</span>)}</Stack></Alert>}
    {row.applyResult?.protectedChanges?.length > 0 && <Alert severity="info">تم الحفاظ على التعديل اليدوي للمنتج.</Alert>}
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>إغلاق</Button></DialogActions></Dialog>;
}

function ReviewStep({ session, onApplyReady }) {
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ items: [], total: 0 });
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    getCatalogImportRows(session.id, { page: page + 1, pageSize: 25, status })
      .then(next => setData({ items: next?.items || next?.rows || [], total: next?.total || 0 }))
      .catch(() => {});
  }, [session.id, page, status]);
  const summary = summarizeSession(session);
  return <Stack spacing={2}>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}><Select size="small" value={status} onChange={event => { setStatus(event.target.value); setPage(0); }} sx={{ minWidth: 200 }}><MenuItem value="ALL">كل الحالات</MenuItem>{Object.keys({ NEW: 1, UNCHANGED: 1, PRICE_CHANGED: 1, CATEGORY_CHANGED: 1, CONFLICT: 1, INVALID: 1, APPLIED: 1, SKIPPED: 1 }).map(item => <MenuItem key={item} value={item}>{translateStatus(item)}</MenuItem>)}</Select><Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>{summary.needsReview} صف سيبقى غير مطبق حتى تُصحح بياناته في ملف لاحق</Typography></Stack>
    <TableContainer component={Card} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>اسم المنتج</TableCell><TableCell>رقم المصدر</TableCell><TableCell>الباركود</TableCell><TableCell>التصنيف</TableCell><TableCell>السعر</TableCell><TableCell>الحالة</TableCell></TableRow></TableHead><TableBody>{data.items.map(row => <TableRow hover key={row.id} onClick={() => setSelected(row)} sx={{ cursor: "pointer" }}><TableCell>{row.rowNumber}</TableCell><TableCell>{valueFromRow(row, ["tbitemname", "name", "product", "description"])}</TableCell><TableCell>{valueFromRow(row, ["tbitemno", "externalid", "item", "number", "code", "id"])}</TableCell><TableCell>{valueFromRow(row, ["tbitemcode", "barcode", "bar"] )}</TableCell><TableCell>{valueFromRow(row, ["tbcategoryname", "category", "type"])}</TableCell><TableCell>{valueFromRow(row, ["price", "cost", "tbsmallunitquantity", "smallunitquantity"])} د.ل</TableCell><TableCell><Chip size="small" color={row.status === "INVALID" || row.status === "CONFLICT" ? "error" : row.status === "NEW" || row.status === "APPLIED" ? "success" : row.status === "SKIPPED" ? "warning" : "default"} label={translateStatus(row.status)} /></TableCell></TableRow>)}</TableBody></Table><TablePagination component="div" count={data.total} page={page} onPageChange={(_, next) => setPage(next)} rowsPerPage={25} rowsPerPageOptions={[25]} labelDisplayedRows={({ from, to, count }) => `${from}–${to} من ${count}`} /></TableContainer>
    {summary.needsReview > 0 && <Alert severity="warning">سيتم تطبيق الصفوف الصالحة فقط. الصفوف غير الصالحة أو المتعارضة ستظهر كتجاوز ولن تنشئ منتجات.</Alert>}
    <Button variant="contained" disabled={session.status !== IMPORT_STATUS.READY_FOR_REVIEW} onClick={onApplyReady}>الانتقال إلى اعتماد الاستيراد</Button>
    {selected && <RowDetails row={selected} onClose={() => setSelected(null)} />}
  </Stack>;
}

function ConfirmationStep({ session, onApplied, busy, error }) {
  const summary = summarizeSession(session);
  const confirm = async () => { await onApplied(); };
  return <Stack spacing={2}><Alert severity="warning">سيتم إنشاء {summary.newCount} منتج جديد بحالة غير نشطة حتى تتم مراجعته.</Alert><Alert severity="info">لن يتم تحديث كميات المخزون من ملف الركيزة.</Alert>{summary.needsReview > 0 && <Alert severity="warning">سيتم تجاوز {summary.needsReview} صف غير صالح أو متعارض، ولن يتم تطبيقه في هذا الاستيراد.</Alert>}{error && <Alert severity="error">{error}</Alert>}<Button variant="contained" color="success" disabled={busy || session.status !== IMPORT_STATUS.READY_FOR_REVIEW} onClick={confirm}>{busy ? "جارٍ تنفيذ الاستيراد..." : "اعتماد وتنفيذ الاستيراد"}</Button></Stack>;
}

function CompletionStep({ session, result, onNew, onReview }) {
  const applied = result?.appliedCount ?? session.appliedCount ?? 0;
  const skipped = result?.skippedCount ?? session.skippedCount ?? 0;
  const cards = [
    ["تم تطبيقه", applied, "success"],
    ["تم تجاوزه", skipped, "warning"],
    ["غير صالح", session.invalidCount || 0, "error"],
    ["تعارضات", session.conflictCount || 0, "error"]
  ];
  const reviewHref = `/admin/products?workspace=NEEDS_REVIEW&origin=IMPORTED&sourceSystem=RAKIZA&importSessionId=${encodeURIComponent(session.id)}`;
  return <Stack spacing={2}><Alert severity="success" icon={<CheckCircleOutlineIcon />}><Typography fontWeight={700}>تم الاستيراد بنجاح</Typography></Alert><Grid container spacing={1.5}>{cards.map(([label, value, color]) => <Grid size={{ xs: 6, sm: 3 }} key={label}><Card variant="outlined"><CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography variant="h5" fontWeight={700} color={`${color}.main`}>{value}</Typography></CardContent></Card></Grid>)}</Grid><Typography>تم تطبيق {applied} صف، وتجاوز {skipped} صف للمراجعة أو لعدم وجود تغيير.</Typography><Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Button component={Link} href={reviewHref} variant="contained">مراجعة منتجات هذا الاستيراد</Button><Button variant="outlined" onClick={onNew}>بدء استيراد جديد</Button><Button variant="text" onClick={onReview}>عرض تفاصيل العملية</Button></Stack></Stack>;
}

export default function CatalogImportsView() {
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const refreshHistory = useCallback(() => listCatalogImports().then(data => setSessions(Array.isArray(data) ? data : [])).catch(() => setSessions([])), []);
  useEffect(() => { refreshHistory(); }, [refreshHistory]);
  const openSession = async id => { setBusy(true); setError(""); try { const next = await getCatalogImport(id); setSession(next); setStep(next.status === IMPORT_STATUS.COMPLETED ? 5 : next.status === IMPORT_STATUS.READY_FOR_REVIEW ? 2 : 0); setResult(null); } catch (err) { setError(messageForError(err)); } finally { setBusy(false); } };
  const upload = async file => { setBusy(true); setError(""); try { const next = await uploadCatalogImport(file); setSession(next); setStep(2); refreshHistory(); } catch (err) { setError(messageForError(err)); } finally { setBusy(false); } };
  const apply = async () => { setBusy(true); setError(""); try { const next = await applyCatalogImport(session.id); setResult(next); setSession({ ...session, status: next.status, appliedCount: next.appliedCount, skippedCount: next.skippedCount }); setStep(5); refreshHistory(); } catch (err) { setError(messageForError(err)); } finally { setBusy(false); } };
  const startNew = () => { setSession(null); setStep(0); setResult(null); setError(""); };
  const sessionIsReadOnly = session?.status === IMPORT_STATUS.COMPLETED || session?.status === IMPORT_STATUS.FAILED;
  const title = useMemo(() => session ? `${session.originalFilename || "جلسة استيراد"} · ${SESSION_STATUS_LABELS[session.status] || session.status}` : "استيراد المنتجات", [session]);
  return <PageWrapper title={title}>
    <Stack spacing={3} dir="rtl">
      {!session && <>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}><Typography color="text.secondary">استيراد قوائم المنتجات ومراجعتها قبل إضافتها للمتجر.</Typography><Button variant="contained" onClick={() => setSession(null)}>استيراد جديد</Button></Stack>
        <Card variant="outlined"><CardContent><Typography variant="h6" fontWeight={700} mb={2}>سجل الاستيراد</Typography><TableContainer><Table size="small"><TableHead><TableRow><TableCell>الملف</TableCell><TableCell>المصدر</TableCell><TableCell>التاريخ</TableCell><TableCell>الحالة</TableCell><TableCell>الصفوف</TableCell><TableCell /></TableRow></TableHead><TableBody>{sessions.map(item => <TableRow key={item.id}><TableCell>{item.originalFilename}</TableCell><TableCell>{item.profile?.name || item.profile?.sourceSystem || "Rakiza"}</TableCell><TableCell>{item.createdAt ? new Date(item.createdAt).toLocaleDateString("ar-LY") : "—"}</TableCell><TableCell><Chip size="small" label={SESSION_STATUS_LABELS[item.status] || item.status} color={item.status === "COMPLETED" ? "success" : item.status === "FAILED" ? "error" : "default"} /></TableCell><TableCell>{item.totalRows || 0}</TableCell><TableCell><Stack direction="row" spacing={0.5}><Button size="small" onClick={() => openSession(item.id)}>التفاصيل</Button>{item.status === "COMPLETED" ? <Button size="small" component={Link} href={`/admin/products?workspace=NEEDS_REVIEW&origin=IMPORTED&sourceSystem=${encodeURIComponent(item.profile?.sourceSystem || "RAKIZA")}&importSessionId=${encodeURIComponent(item.id)}`}>مراجعة المنتجات</Button> : null}</Stack></TableCell></TableRow>)}</TableBody></Table></TableContainer></CardContent></Card>
        <Card variant="outlined"><CardContent><Typography variant="h6" fontWeight={700} mb={2}>رفع ملف جديد</Typography><UploadStep onUploaded={upload} busy={busy} error={error} /></CardContent></Card>
      </>}
      {session && <>
        <Stepper activeStep={step} alternativeLabel sx={{ overflowX: "auto", pb: 1 }}>{steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper>
        {step >= 2 && step !== 5 && <SummaryCards session={session} />}
        {step === 2 && !sessionIsReadOnly && <CategoryStep session={session} onChanged={setSession} error={error} />}
        {step === 2 && sessionIsReadOnly && <Alert severity={session.status === "COMPLETED" ? "success" : "error"}>هذه الجلسة للقراءة فقط.</Alert>}
        {step === 3 && <ReviewStep session={session} onApplyReady={() => setStep(4)} />}
        {step === 4 && !sessionIsReadOnly && <ConfirmationStep session={session} onApplied={apply} busy={busy} error={error} />}
        {step === 5 && <CompletionStep session={session} result={result} onNew={startNew} onReview={() => setStep(3)} />}
        <Stack direction="row" justifyContent="space-between"><Button onClick={() => { setSession(null); refreshHistory(); }}>العودة للسجل</Button>{step === 2 && !sessionIsReadOnly && <Button variant="outlined" onClick={() => setStep(3)}>مراجعة المنتجات</Button>}{step === 3 && <Button onClick={() => setStep(2)}>مراجعة التصنيفات</Button>}</Stack>
      </>}
    </Stack>
  </PageWrapper>;
}
