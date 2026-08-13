"use client";

import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Tune from "@mui/icons-material/Tune";
import WarningAmber from "@mui/icons-material/WarningAmber";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import PageWrapper from "../../page-wrapper";
import { fetchBrands } from "utils/admin-brands";
import {
  fetchAdminCategories,
  fetchAdminProductReview,
  fetchAdminProductReviewSummary,
  publishAdminProduct,
  unpublishAdminProduct
} from "utils/admin-catalog";

const PAGE_SIZE = 20;
const FILTER_KEYS = ["q", "status", "origin", "sourceSystem", "readiness", "reviewed", "workspace", "importSessionId", "issue", "categoryId", "brandId", "sort"];

const WORKSPACE_TABS = [
  ["ALL", "جميع المنتجات", "total"],
  ["NEEDS_REVIEW", "تحتاج مراجعة", "needsReview"],
  ["READY_TO_PUBLISH", "جاهزة للنشر", "readyToPublish"],
  ["PUBLISHED", "منشورة", "published"]
];

const ISSUE_LABELS = {
  MISSING_IMAGE: "بدون صورة",
  INVALID_PRICE: "السعر غير صالح",
  INVALID_CATEGORY: "التصنيف غير صالح",
  MISSING_BRAND: "بدون علامة تجارية",
  MISSING_SPECS: "بدون مواصفات",
  MISSING_SHORT_DESCRIPTION: "بدون وصف مختصر",
  MISSING_DESCRIPTION: "بدون وصف",
  LOW_RESOLUTION_IMAGE: "صورة منخفضة الجودة",
  INVALID_NAME: "الاسم غير صالح",
  ONLY_ONE_IMAGE: "صورة واحدة فقط",
  MISSING_WARRANTY: "بدون ضمان",
  MISSING_SKU: "بدون SKU",
  MISSING_SOURCE_BARCODE: "بدون باركود مصدر",
  SOURCE_NAME_UNCHANGED: "اسم المصدر لم يُراجع"
};

const QUICK_FILTERS = [
  { label: "كل المنتجات", values: {} },
  { label: "تحتاج صورة", values: { issue: "MISSING_IMAGE" } },
  { label: "تحتاج علامة", values: { issue: "MISSING_BRAND" } },
  { label: "تحتاج مواصفات", values: { issue: "MISSING_SPECS" } },
  { label: "جاهزة للنشر", values: { workspace: "READY_TO_PUBLISH" } },
  { label: "مستوردة", values: { origin: "IMPORTED" } },
  { label: "غير مراجعة", values: { reviewed: "false" } },
  { label: "غير نشطة", values: { status: "INACTIVE" } }
];

const SUMMARY_METRICS = [
  { key: "total", label: "إجمالي المنتجات", values: {} },
  { key: "needsReview", label: "تحتاج مراجعة", values: { workspace: "NEEDS_REVIEW" }, tone: "warning.main" },
  { key: "readyToPublish", label: "جاهزة للنشر", values: { workspace: "READY_TO_PUBLISH" }, tone: "success.main" },
  { key: "unreviewed", label: "غير مراجعة", values: { reviewed: "false" }, tone: "warning.main" },
  { key: "reviewed", label: "تمت مراجعتها", values: { reviewed: "true" }, tone: "success.main" },
  { key: "missingImage", label: "بدون صورة", values: { issue: "MISSING_IMAGE" } },
  { key: "missingBrand", label: "بدون علامة", values: { issue: "MISSING_BRAND" } },
  { key: "missingSpecs", label: "بدون مواصفات", values: { issue: "MISSING_SPECS" } },
  { key: "active", label: "نشطة", values: { status: "ACTIVE" } },
  { key: "inactive", label: "غير نشطة", values: { status: "INACTIVE" } }
];

function formatPrice(value, currency = "LYD") {
  const amount = Number(value || 0).toLocaleString("ar-LY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === "LYD" ? `${amount} د.ل` : `${amount} ${currency}`;
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("ar-LY", { dateStyle: "medium" }).format(new Date(value)) : "—";
}

function issuesFor(product) {
  return [...(product?.readiness?.blockers || []), ...(product?.readiness?.warnings || [])];
}

function IssueChips({ product }) {
  const issues = issuesFor(product);
  const visible = issues.slice(0, 3);
  const hidden = issues.slice(3);

  if (!issues.length) return <Typography variant="body2" color="success.main">لا توجد نواقص</Typography>;

  return <Stack direction="row" gap={0.5} flexWrap="wrap">
      {visible.map(issue => <Chip key={issue} size="small" variant="outlined" color={product.readiness?.blockers?.includes(issue) ? "warning" : "default"} label={ISSUE_LABELS[issue] || issue} />)}
      {hidden.length ? <Tooltip title={hidden.map(issue => ISSUE_LABELS[issue] || issue).join("، ")} arrow>
          <Chip size="small" label={`+${hidden.length}`} aria-label={`عرض ${hidden.length} نواقص إضافية`} />
        </Tooltip> : null}
    </Stack>;
}

function SourceBadges({ product }) {
  const imported = product.origin === "IMPORTED";
  const sources = product.sourceSystems || [];
  return <Stack direction="row" gap={0.5} flexWrap="wrap">
      <Chip size="small" color={imported ? "info" : "default"} label={imported ? "مستورد" : "يدوي"} />
      {sources.slice(0, 2).map(source => <Chip key={source} size="small" variant="outlined" label={source === "RAKIZA" ? "Rakiza" : source} />)}
    </Stack>;
}

function Readiness({ product }) {
  const blocked = !product.readiness?.readyToPublish;
  const activeBlocked = product.status === "ACTIVE" && blocked;

  if (activeBlocked) return <Chip icon={<WarningAmber />} color="warning" label="منشور ويحتاج مراجعة" sx={{ height: "auto", py: 0.5, "& .MuiChip-label": { whiteSpace: "normal" } }} />;
  return <Chip size="small" color={blocked ? "warning" : "success"} variant={blocked ? "outlined" : "filled"} label={blocked ? "يحتاج استكمال" : "جاهز للنشر"} />;
}

function ReviewAudit({ product }) {
  return <Chip size="small" color={product.reviewed ? "success" : "default"} variant={product.reviewed ? "filled" : "outlined"} label={product.reviewed ? "تمت المراجعة" : "لم تتم المراجعة"} />;
}

function ProductIdentity({ product }) {
  return <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
      <Avatar variant="rounded" src={product.thumbnailUrl} alt={product.name} sx={{ width: 58, height: 58, bgcolor: "grey.100", flexShrink: 0, "& img": { objectFit: "contain" } }} />
      <Box minWidth={0}>
        <Typography fontWeight={700} lineHeight={1.35} sx={{ overflowWrap: "anywhere" }}>{product.name}</Typography>
        <Typography variant="caption" color="text.secondary">#{String(product.id).split("-")[0]}</Typography>
      </Box>
    </Stack>;
}

function EmptyState({ hasFilters }) {
  return <Stack alignItems="center" spacing={1} py={7} px={2} textAlign="center">
      <Typography variant="h6">{hasFilters ? "لا توجد منتجات تطابق هذه المرشحات" : "لا توجد منتجات للمراجعة بعد"}</Typography>
      <Typography color="text.secondary">{hasFilters ? "جرّب إزالة بعض المرشحات أو البحث بكلمة أخرى." : "ستظهر المنتجات هنا بعد إنشائها أو استيرادها."}</Typography>
    </Stack>;
}

function reviewHref(product, searchParams) {
  const next = new URLSearchParams(searchParams.toString());
  next.set("from", "review");
  next.delete("page");
  return `/admin/products/${product.slug}?${next.toString()}`;
}

export default function ProductReviewQueuePageView() {
  return <Suspense fallback={<Stack alignItems="center" py={8}><CircularProgress /></Stack>}><ReviewQueueContent /></Suspense>;
}

function ReviewQueueContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsKey = searchParams.toString();
  const page = Math.max(Number(searchParams.get("page") || 1), 1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publicationActionId, setPublicationActionId] = useState("");

  const filters = useMemo(() => {
    const currentParams = new URLSearchParams(paramsKey);
    const result = { page, limit: PAGE_SIZE };
    FILTER_KEYS.forEach(key => {
      const value = currentParams.get(key);
      if (value) result[key] = value;
    });
    return result;
  }, [page, paramsKey]);

  const navigate = useCallback((changes, clearReviewFilters = false) => {
    const next = clearReviewFilters ? new URLSearchParams() : new URLSearchParams(searchParams.toString());
    if (clearReviewFilters) setSearchInput("");
    Object.entries(changes).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    next.delete("page");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    setSearchInput(searchParams.get("q") || "");
  }, [paramsKey, searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const current = searchParams.get("q") || "";
      if (searchInput.trim() !== current) navigate({ q: searchInput.trim() });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [navigate, searchInput, searchParams]);

  useEffect(() => {
    let live = true;
    Promise.all([fetchAdminProductReviewSummary(), fetchAdminCategories(), fetchBrands()])
      .then(([summaryData, categoryData, brandData]) => {
        if (!live) return;
        setSummary(summaryData);
        setCategories(categoryData);
        setBrands(brandData);
      })
      .catch(requestError => live && setError(requestError instanceof Error ? requestError.message : "تعذر تحميل بيانات المراجعة."));
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    fetchAdminProductReview(filters)
      .then(data => {
        if (!live) return;
        setItems(data.items);
        setPagination(data.pagination);
      })
      .catch(requestError => {
        if (!live) return;
        setItems([]);
        setError(requestError instanceof Error ? requestError.message : "تعذر تحميل المنتجات.");
      })
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [filters]);

  const hasFilters = FILTER_KEYS.some(key => searchParams.has(key));
  const filterValue = key => searchParams.get(key) || "";
  const applyQuickFilter = values => navigate(values, true);

  const selectWorkspace = value => {
    const next = new URLSearchParams(searchParams.toString());
    ["page", "status", "readiness", "reviewed"].forEach(key => next.delete(key));
    if (value === "ALL") next.delete("workspace");
    else next.set("workspace", value);
    router.push(`${pathname}${next.toString() ? `?${next.toString()}` : ""}`);
  };

  const handlePublication = async (product, shouldPublish) => {
    setPublicationActionId(product.id);
    setError("");
    try {
      if (shouldPublish) await publishAdminProduct(product.id);
      else await unpublishAdminProduct(product.id);
      const [listData, summaryData] = await Promise.all([fetchAdminProductReview(filters), fetchAdminProductReviewSummary()]);
      setItems(listData.items);
      setPagination(listData.pagination);
      setSummary(summaryData);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "تعذر تحديث حالة نشر المنتج.");
    } finally {
      setPublicationActionId("");
    }
  };

  const workspace = filterValue("workspace") || "ALL";

  return <PageWrapper title="إدارة المنتجات">
    <Box dir="rtl">
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1.5} mb={2}>
        <Typography color="text.secondary">مساحة واحدة لمراجعة المنتجات واعتمادها ونشرها.</Typography>
        <Button component={Link} href="/admin/products/create" variant="contained">إضافة منتج</Button>
      </Stack>

      <Card sx={{ mb: 2, px: { xs: 0.5, sm: 1 } }}>
        <Tabs value={workspace} onChange={(_, value) => selectWorkspace(value)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="حالات إدارة المنتجات">
          {WORKSPACE_TABS.map(([value, label, countKey]) => <Tab key={value} value={value} label={`${label}${summary ? ` (${Number(summary[countKey] || 0).toLocaleString("ar-LY")})` : ""}`} />)}
        </Tabs>
      </Card>

      {filterValue("importSessionId") ? <Alert severity="info" sx={{ mb: 2 }}>تعرض هذه القائمة منتجات جلسة الاستيراد المحددة فقط.</Alert> : null}

      <Box display="grid" gridTemplateColumns={{ xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }} gap={1.25} mb={2.5}>
        {SUMMARY_METRICS.map(metric => <Paper key={metric.key} component="button" type="button" onClick={() => applyQuickFilter(metric.values)} elevation={0} sx={{ p: 1.5, border: 1, borderColor: "divider", borderRadius: 2, bgcolor: "background.paper", textAlign: "right", cursor: "pointer", color: "text.primary", font: "inherit", "&:focus-visible": { outline: "3px solid", outlineColor: "primary.light" } }}>
            <Typography variant="h5" fontWeight={800} color={metric.tone || "text.primary"}>{summary ? Number(summary[metric.key] || 0).toLocaleString("ar-LY") : "—"}</Typography>
            <Typography variant="caption" color="text.secondary">{metric.label}</Typography>
          </Paper>)}
      </Box>

      <Card sx={{ p: { xs: 1.5, md: 2 }, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
          <TextField fullWidth size="small" label="البحث" placeholder="الاسم، SKU، المعرّف الخارجي أو الباركود" value={searchInput} onChange={event => setSearchInput(event.target.value)} inputProps={{ "aria-label": "البحث في المنتجات" }} />
          <TextField select size="small" label="الترتيب" value={filterValue("sort") || "updatedAt"} onChange={event => navigate({ sort: event.target.value })} sx={{ minWidth: 185 }}>
            <MenuItem value="updatedAt">الأحدث تحديثًا</MenuItem><MenuItem value="name">الاسم</MenuItem><MenuItem value="price">السعر</MenuItem><MenuItem value="status">الحالة</MenuItem>
          </TextField>
          <Button variant={advancedOpen ? "contained" : "outlined"} startIcon={<Tune />} onClick={() => setAdvancedOpen(value => !value)} aria-expanded={advancedOpen} sx={{ minWidth: 160 }}>مرشحات متقدمة</Button>
        </Stack>
        <Stack direction="row" gap={0.75} flexWrap="wrap" mt={1.5}>
          {QUICK_FILTERS.map(filter => <Chip key={filter.label} clickable label={filter.label} color={Object.entries(filter.values).every(([key, value]) => filterValue(key) === value) && Object.keys(filter.values).length ? "primary" : "default"} variant="outlined" onClick={() => applyQuickFilter(filter.values)} />)}
        </Stack>
        <Collapse in={advancedOpen}>
          <Divider sx={{ my: 2 }} />
          <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }} gap={1.25}>
            <FilterSelect label="الحالة" value={filterValue("status")} onChange={value => navigate({ status: value })} options={[["ACTIVE", "نشطة"], ["INACTIVE", "غير نشطة"]]} />
            <FilterSelect label="المصدر" value={filterValue("origin")} onChange={value => navigate({ origin: value })} options={[["MANUAL", "يدوي"], ["IMPORTED", "مستورد"]]} />
            <FilterSelect label="نظام المصدر" value={filterValue("sourceSystem")} onChange={value => navigate({ sourceSystem: value })} options={[["RAKIZA", "Rakiza"]]} />
            <FilterSelect label="الجاهزية" value={filterValue("readiness")} onChange={value => navigate({ readiness: value })} options={[["READY", "جاهز للنشر"], ["BLOCKED", "يحتاج استكمال"]]} />
            <FilterSelect label="نوع النقص" value={filterValue("issue")} onChange={value => navigate({ issue: value })} options={Object.entries(ISSUE_LABELS)} />
            <FilterSelect label="الفئة" value={filterValue("categoryId")} onChange={value => navigate({ categoryId: value })} options={categories.map(item => [item.id, item.name])} />
            <FilterSelect label="العلامة التجارية" value={filterValue("brandId")} onChange={value => navigate({ brandId: value })} options={brands.map(item => [item.id, item.name])} />
            <Button color="inherit" onClick={() => applyQuickFilter({})}>مسح جميع المرشحات</Button>
          </Box>
        </Collapse>
      </Card>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Card>
        {loading ? <Stack alignItems="center" py={8}><CircularProgress /><Typography mt={1.5} color="text.secondary">جارٍ تحميل المنتجات…</Typography></Stack> : items.length ? <>
          <TableContainer sx={{ display: { xs: "none", md: "block" } }}>
            <Table size="small" aria-label="طابور مراجعة المنتجات">
              <TableHead><TableRow sx={{ bgcolor: "grey.50" }}>
                {['المنتج','المصدر','الفئة','السعر','الحالة','الجاهزية','المراجعة البشرية','النواقص','آخر تحديث','الإجراء'].map(label => <TableCell key={label} sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>{label}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>{items.map(product => <TableRow key={product.id} hover sx={product.status === "ACTIVE" && !product.readiness?.readyToPublish ? { bgcolor: "warning.50" } : undefined}>
                <TableCell sx={{ minWidth: 230, maxWidth: 320 }}><ProductIdentity product={product} /></TableCell>
                <TableCell><SourceBadges product={product} /></TableCell>
                <TableCell sx={{ maxWidth: 170 }}><Typography variant="body2" title={product.category?.name}>{product.category?.name || "غير مصنف"}</Typography></TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>{formatPrice(product.price, product.baseCurrency)}</TableCell>
                <TableCell><Chip size="small" color={product.status === "ACTIVE" ? "success" : "default"} label={product.status === "ACTIVE" ? "منشور" : "غير نشط"} /></TableCell>
                <TableCell sx={{ minWidth: 155 }}><Readiness product={product} /></TableCell>
                <TableCell><ReviewAudit product={product} /></TableCell>
                <TableCell sx={{ minWidth: 235 }}><IssueChips product={product} /></TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(product.updatedAt)}</TableCell>
                <TableCell><Stack direction="row" spacing={0.75}>
                  <Button component={Link} href={reviewHref(product, searchParams)} size="small" variant="outlined">مراجعة</Button>
                  {product.status === "ACTIVE"
                    ? <Button size="small" color="warning" loading={publicationActionId === product.id} onClick={() => handlePublication(product, false)}>إلغاء النشر</Button>
                    : product.readiness?.readyToPublish && product.reviewed
                      ? <Button size="small" color="success" variant="contained" loading={publicationActionId === product.id} onClick={() => handlePublication(product, true)}>نشر</Button>
                      : null}
                </Stack></TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </TableContainer>

          <Stack spacing={1.25} sx={{ display: { xs: "flex", md: "none" }, p: 1.25 }}>
            {items.map(product => <Paper key={product.id} variant="outlined" sx={{ p: 1.5, borderColor: product.status === "ACTIVE" && !product.readiness?.readyToPublish ? "warning.main" : "divider" }}>
              <ProductIdentity product={product} />
              <Divider sx={{ my: 1.25 }} />
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" gap={1}><SourceBadges product={product} /><Typography fontWeight={700}>{formatPrice(product.price, product.baseCurrency)}</Typography></Stack>
                <Typography variant="body2"><b>الفئة:</b> {product.category?.name || "غير مصنف"}</Typography>
                <Readiness product={product} />
                <ReviewAudit product={product} />
                <IssueChips product={product} />
                <Typography variant="caption" color="text.secondary">آخر تحديث: {formatDate(product.updatedAt)}</Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75}>
                  <Button fullWidth component={Link} href={reviewHref(product, searchParams)} size="small" variant="outlined">مراجعة</Button>
                  {product.status === "ACTIVE"
                    ? <Button fullWidth size="small" color="warning" loading={publicationActionId === product.id} onClick={() => handlePublication(product, false)}>إلغاء النشر</Button>
                    : product.readiness?.readyToPublish && product.reviewed
                      ? <Button fullWidth size="small" color="success" variant="contained" loading={publicationActionId === product.id} onClick={() => handlePublication(product, true)}>نشر</Button>
                      : null}
                </Stack>
              </Stack>
            </Paper>)}
          </Stack>
        </> : <EmptyState hasFilters={hasFilters} />}

        {!loading && pagination.total > 0 ? <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" gap={1.5} p={2} borderTop={1} borderColor="divider">
          <Typography variant="body2" color="text.secondary">عرض {items.length.toLocaleString("ar-LY")} من {pagination.total.toLocaleString("ar-LY")} منتج</Typography>
          <Pagination color="primary" page={pagination.page} count={Math.max(1, pagination.totalPages)} onChange={(_, nextPage) => {
            const next = new URLSearchParams(searchParams.toString());
            if (nextPage > 1) next.set("page", String(nextPage));
            else next.delete("page");
            const query = next.toString();
            router.push(query ? `${pathname}?${query}` : pathname);
          }} />
        </Stack> : null}
      </Card>
    </Box>
  </PageWrapper>;
}

function FilterSelect({ label, value, onChange, options }) {
  return <TextField select size="small" label={label} value={value} onChange={event => onChange(event.target.value)}>
      <MenuItem value="">الكل</MenuItem>
      {options.map(([optionValue, optionLabel]) => <MenuItem key={optionValue} value={optionValue}>{optionLabel}</MenuItem>)}
    </TextField>;
}
