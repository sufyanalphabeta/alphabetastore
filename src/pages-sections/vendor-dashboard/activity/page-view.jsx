"use client";

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from 'next/link';

import PageWrapper from '../page-wrapper';
import { applyActivityPreset, previewActivityPreset } from 'utils/admin-activity';

const labels = { CREATE: 'سيتم إنشاؤه', REUSE: 'موجود وسيُعاد استخدامه', LINK: 'سيتم ربطه', SKIP: 'سيُحافظ عليه', CONFLICT: 'تعارض' };

export default function ActivityPresetPageView() {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadPreview = useCallback(async () => {
    setLoading(true); setError('');
    try { setPreview(await previewActivityPreset()); }
    catch (err) { setError(err instanceof Error ? err.message : 'تعذر تحميل معاينة النشاط.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadPreview(); }, [loadPreview]);

  const handleApply = async () => {
    setApplying(true); setError(''); setMessage('');
    try { const result = await applyActivityPreset(); setMessage(`تم تطبيق النشاط. أُنشئت ${result.createdDefinitions} خصائص و${result.createdProfiles} ملفات، وتم إنشاء ${result.createdLinks} روابط.`); await loadPreview(); }
    catch (err) { setError(err instanceof Error ? err.message : 'تعذر تطبيق النشاط.'); }
    finally { setApplying(false); }
  };

  return <PageWrapper title="إعداد النشاط">
    <Stack spacing={2} dir="rtl">
      <Card sx={{ p: 3 }}>
        <Stack spacing={1.5}>
          <Typography variant="h5">النشاط الحالي</Typography>
          <Typography variant="h6" color="primary">الإلكترونيات والكمبيوتر</Typography>
          <Typography color="text.secondary">قالب جاهز للفئات والخصائص والفلاتر المناسبة لمتجر الإلكترونيات.</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="contained" onClick={loadPreview} disabled={loading}>معاينة القالب</Button>
            <Button variant="outlined" onClick={handleApply} disabled={applying || loading}>{applying ? <CircularProgress size={20} /> : 'تطبيق القالب'}</Button>
            <Button component={Link} href="/admin/attributes">إعدادات الخصائص المتقدمة</Button>
          </Stack>
        </Stack>
      </Card>
      {message ? <Alert severity="success">{message}</Alert> : null}
      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? <CircularProgress /> : preview ? <>
        <Card sx={{ p: 3 }}><Typography variant="h6" mb={2}>ملخص المعاينة — بدون تغيير البيانات</Typography><Grid container spacing={1.5}>{Object.entries({ 'خصائص جديدة': preview.summary.attributesToCreate, 'خصائص موجودة': preview.summary.attributesToReuse, 'ملفات جديدة': preview.summary.profilesToCreate, 'ملفات موجودة': preview.summary.profilesToReuse, 'روابط جديدة': preview.summary.linksToCreate, 'تعارضات': preview.summary.conflicts, 'تخطي آمن': preview.summary.skips }).map(([label, value]) => <Grid key={label} size={{ xs: 6, sm: 3 }}><Card variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}><Typography color="text.secondary" variant="body2">{label}</Typography><Typography variant="h5">{value}</Typography></Card></Grid>)}</Grid></Card>
        <Card sx={{ p: 3 }}><Typography variant="h6" mb={2}>الفئات المطابقة</Typography><Stack direction="row" flexWrap="wrap" gap={1}>{preview.categoriesMatched.map(category => <Chip key={category.slug} color="success" label={`${category.name} · ${category.slug}`} />)}{preview.categoriesUnmatched.map(slug => <Chip key={slug} color="warning" label={`غير مطابقة: ${slug}`} />)}</Stack><Divider sx={{ my: 2 }} /><Typography variant="h6" mb={1}>ما سيحدث</Typography><Stack spacing={0.5}>{preview.items.map(item => <Typography key={`${item.kind}-${item.key}`} variant="body2"><strong>{item.label}</strong> — {labels[item.classification] || item.classification}{item.reason ? ` (${item.reason})` : ''}</Typography>)}</Stack></Card>
      </> : null}
    </Stack>
  </PageWrapper>;
}
