"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export const REVIEW_ISSUES = {
  MISSING_IMAGE: { label: "الصورة الأساسية مفقودة", section: "review-media" },
  MISSING_CATEGORY: { label: "الفئة مفقودة", section: "review-classification" },
  INVALID_CATEGORY: { label: "الفئة غير صالحة للنشر", section: "review-classification" },
  INACTIVE_CATEGORY: { label: "الفئة غير متاحة للنشر", section: "review-classification" },
  INVALID_PRICE: { label: "السعر غير صالح", section: "review-pricing" },
  MISSING_SHORT_DESCRIPTION: { label: "الوصف المختصر مفقود", section: "review-content" },
  MISSING_DESCRIPTION: { label: "الوصف مفقود", section: "review-content" },
  INVALID_NAME: { label: "اسم المنتج غير صالح", section: "review-basic" },
  MISSING_BRAND: { label: "العلامة التجارية مفقودة", section: "review-classification" },
  MISSING_SPECS: { label: "المواصفات مفقودة", section: "review-specs" },
  MISSING_WARRANTY: { label: "بيانات الضمان مفقودة", section: "review-content" },
  LOW_RESOLUTION_IMAGE: { label: "دقة إحدى الصور منخفضة", section: "review-media" },
  ONLY_ONE_IMAGE: { label: "يوجد صورة واحدة فقط", section: "review-media" },
  MISSING_SKU: { label: "رمز المنتج الداخلي مفقود", section: "review-classification" },
  MISSING_SOURCE_BARCODE: { label: "باركود المصدر مفقود", section: "review-source" },
  SOURCE_NAME_UNCHANGED: { label: "اسم المصدر لم يُحسّن بعد", section: "review-source" }
};

function labelFor(code) {
  return REVIEW_ISSUES[code]?.label || code;
}

function formatSourcePrice(value) {
  if (value === null || value === undefined || value === "") return "غير متوفر";
  return Number(value).toLocaleString("ar-LY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value) {
  if (!value) return "غير متوفر";
  return new Intl.DateTimeFormat("ar-LY", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function ReadinessIssues({ title, issues, color, onIssueClick }) {
  return <Box>
    <Typography variant="subtitle2" fontWeight={800} mb={0.75}>{title} ({issues.length.toLocaleString("ar-LY")})</Typography>
    <Stack direction="row" gap={0.75} flexWrap="wrap">
      {issues.length ? issues.map(code => <Chip key={code} clickable color={color} variant="outlined" label={labelFor(code)} onClick={() => onIssueClick(REVIEW_ISSUES[code]?.section || "review-basic")} />) : <Typography variant="body2" color="text.secondary">لا توجد</Typography>}
    </Stack>
  </Box>;
}

export function ReviewReadinessPanel({ product, onIssueClick, onReturn, onMarkReviewed, markingReviewed }) {
  const readiness = product?.readiness || { readyToPublish: false, blockers: [], warnings: [] };
  const activeBlocked = product?.status === "ACTIVE" && !readiness.readyToPublish;

  return <Card variant="outlined" dir="rtl" sx={{ p: { xs: 1.5, md: 2.5 }, mb: 2, borderColor: readiness.readyToPublish ? "success.main" : "warning.main" }}>
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={900}>مراجعة المنتج</Typography>
          <Typography color="text.secondary">افحص جودة بيانات المتجر قبل الانتقال إلى المنتج التالي.</Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          <Chip color={readiness.readyToPublish ? "success" : "warning"} label={readiness.readyToPublish ? "جاهز للنشر" : "يحتاج استكمال"} />
          <Button color="inherit" variant="outlined" onClick={onReturn}>العودة إلى طابور المراجعة</Button>
        </Stack>
      </Stack>
      {activeBlocked ? <Alert severity="warning">هذا المنتج نشط حاليًا لكنه لا يستوفي متطلبات الجاهزية. راجع العوائق أدناه.</Alert> : null}
      <Alert severity={product.reviewed ? "success" : "info"} action={!product.reviewed ? <Button color="inherit" loading={markingReviewed} disabled={!readiness.readyToPublish || markingReviewed} onClick={onMarkReviewed}>اعتماد المراجعة</Button> : null}>
        {product.reviewed
          ? <>تمت المراجعة {product.reviewedBy?.name ? `بواسطة ${product.reviewedBy.name}` : "سابقًا"}{product.catalogReviewedAt ? ` بتاريخ ${formatDate(product.catalogReviewedAt)}` : ""}.</>
          : readiness.readyToPublish
            ? "لم تتم المراجعة البشرية بعد. يمكنك اعتمادها الآن."
            : "لم تتم المراجعة البشرية بعد. أكمل موانع النشر أولًا."}
      </Alert>
      <Divider />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}><ReadinessIssues title="العوائق" issues={readiness.blockers || []} color="warning" onIssueClick={onIssueClick} /></Grid>
        <Grid size={{ xs: 12, md: 6 }}><ReadinessIssues title="التنبيهات" issues={readiness.warnings || []} color="default" onIssueClick={onIssueClick} /></Grid>
      </Grid>
    </Stack>
  </Card>;
}

export function ReviewSectionHeading({ id, title, description }) {
  return <Grid size={12}>
    <Box id={id} tabIndex={-1} sx={{ scrollMarginTop: 96, pt: 0.5, outline: "none", "&:focus-visible": { boxShadow: theme => `0 0 0 3px ${theme.palette.primary.light}`, borderRadius: 1 } }}>
      <Typography variant="h6" fontWeight={900}>{title}</Typography>
      {description ? <Typography variant="body2" color="text.secondary">{description}</Typography> : null}
      <Divider sx={{ mt: 1 }} />
    </Box>
  </Grid>;
}

function ValueRow({ label, value }) {
  return <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={0.5} py={0.75}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>{value || "غير متوفر"}</Typography>
  </Stack>;
}

export function ProductSourceReview({ product }) {
  const source = product?.source;
  const imported = product?.origin === "IMPORTED" && source;
  const nameDiffers = imported && String(source.lastImportedName || "").trim() && String(source.lastImportedName).trim() !== String(product.name || "").trim();
  const priceDiffers = imported && source.lastImportedPrice != null && Number(source.lastImportedPrice) !== Number(product.price);

  return <Grid size={12}>
    <Card id="review-source" tabIndex={-1} variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, scrollMarginTop: 96, outline: "none" }}>
      <Typography variant="h6" fontWeight={900}>معلومات المصدر</Typography>
      {!imported ? <Alert severity="info" sx={{ mt: 1.5 }}>هذا منتج يدوي ولا توجد له هوية أو لقطة بيانات من مصدر خارجي.</Alert> : <Grid container spacing={2} mt={0.25}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle1" fontWeight={800}>هوية Rakiza</Typography>
          <ValueRow label="نظام المصدر" value={source.sourceSystem} />
          <ValueRow label="رقم الصنف في المصدر (External ID)" value={source.externalId} />
          <ValueRow label="باركود المصدر" value={source.sourceBarcode} />
          <ValueRow label="فئة المصدر" value={source.lastImportedSourceCategory} />
          <ValueRow label="آخر استيراد" value={formatDate(source.lastImportedAt)} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Typography variant="subtitle1" fontWeight={800}>المتجر مقابل آخر لقطة مصدر</Typography>
          <ValueRow label="اسم المتجر" value={product.name} />
          <ValueRow label="اسم المصدر" value={source.lastImportedName} />
          {nameDiffers ? <Alert severity="info" sx={{ my: 1 }}>اسم المتجر يختلف عن آخر اسم مستورد. قد يكون قد تم تحسينه يدويًا.</Alert> : null}
          <ValueRow label="سعر المتجر الأساسي" value={formatSourcePrice(product.price)} />
          <ValueRow label="آخر سعر من المصدر" value={formatSourcePrice(source.lastImportedPrice)} />
          {priceDiffers ? <Alert severity="info" sx={{ mt: 1 }}>توجد قيمة سعر مختلفة في آخر لقطة للمصدر. راجع السعر الحالي قبل الحفظ.</Alert> : null}
        </Grid>
      </Grid>}
    </Card>
  </Grid>;
}
