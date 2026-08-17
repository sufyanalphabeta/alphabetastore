"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import PageWrapper from "../page-wrapper";
import { fetchAdminCategories } from "utils/admin-catalog";
import {
  assignCategoryAttributeProfile,
  createAttributeDefinition,
  createAttributeProfile,
  fetchAttributeDefinitions,
  fetchAttributeProfiles,
  updateAttributeDefinition,
} from "utils/admin-attributes";

const TYPES = ["TEXT", "NUMBER", "BOOLEAN", "SELECT", "MULTI_SELECT"];
const emptyDefinition = { code: "", nameAr: "", nameEn: "", dataType: "TEXT", unit: "", allowedValues: "" };

export default function AttributesPageView() {
  const [tab, setTab] = useState(0);
  const [definitions, setDefinitions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [definition, setDefinition] = useState(emptyDefinition);
  const [profileName, setProfileName] = useState("");
  const [profileItems, setProfileItems] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [nextDefinitions, nextProfiles, nextCategories] = await Promise.all([
        fetchAttributeDefinitions(), fetchAttributeProfiles(), fetchAdminCategories()
      ]);
      setDefinitions(Array.isArray(nextDefinitions) ? nextDefinitions : []);
      setProfiles(Array.isArray(nextProfiles) ? nextProfiles : []);
      setCategories(Array.isArray(nextCategories) ? nextCategories : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل إعدادات الخصائص.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createDefinition = async event => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const usesOptions = ["SELECT", "MULTI_SELECT"].includes(definition.dataType);
      await createAttributeDefinition({
        ...definition,
        nameEn: definition.nameEn || undefined,
        unit: definition.unit || undefined,
        allowedValues: usesOptions
          ? definition.allowedValues.split(/[,\n]/).map(item => item.trim()).filter(Boolean)
          : undefined
      });
      setDefinition(emptyDefinition); setMessage("تم إنشاء تعريف الخاصية."); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر إنشاء الخاصية."); }
    finally { setBusy(false); }
  };

  const toggleProfileItem = id => {
    setProfileItems(items => items.some(item => item.attributeDefinitionId === id)
      ? items.filter(item => item.attributeDefinitionId !== id)
      : [...items, { attributeDefinitionId: id, required: false, filterable: false, comparable: false, visibleOnProduct: true, visibleInSummary: false }]);
  };
  const changeFlag = (id, key, checked) => setProfileItems(items => items.map(item => item.attributeDefinitionId === id ? { ...item, [key]: checked } : item));

  const saveProfile = async event => {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      await createAttributeProfile({ name: profileName, items: profileItems.map((item, index) => ({ ...item, sortOrder: index })) });
      setProfileName(""); setProfileItems([]); setMessage("تم إنشاء ملف الخصائص."); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "تعذر إنشاء الملف."); }
    finally { setBusy(false); }
  };

  return <PageWrapper title="الخصائص وملفات الفئات">
    <Stack spacing={2} dir="rtl">
      <Typography color="text.secondary">أنشئ خصائص عامة قابلة لإعادة الاستخدام ثم اربط ملفًا واحدًا بالفئة. ترث الفئات الفرعية أقرب ملف من الأب تلقائيًا.</Typography>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {message ? <Alert severity="success">{message}</Alert> : null}
      <Card>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable">
          <Tab label="تعريفات الخصائص" /><Tab label="ملفات الفئات" /><Tab label="ربط الفئات" />
        </Tabs>
        <Divider />
        <Box sx={{ p: 3 }}>
          {tab === 0 ? <Grid container spacing={3}>
            <Grid size={{ xs: 12, lg: 4 }}>
              <Stack component="form" spacing={2} onSubmit={createDefinition}>
                <Typography variant="h6">خاصية جديدة</Typography>
                <TextField required label="الكود الداخلي" placeholder="capacity" value={definition.code} onChange={e => setDefinition({ ...definition, code: e.target.value.toLowerCase() })} helperText="أحرف إنجليزية صغيرة وأرقام وشرطة سفلية" />
                <TextField required label="الاسم بالعربية" value={definition.nameAr} onChange={e => setDefinition({ ...definition, nameAr: e.target.value })} />
                <TextField label="الاسم بالإنجليزية" value={definition.nameEn} onChange={e => setDefinition({ ...definition, nameEn: e.target.value })} />
                <TextField select label="نوع القيمة" value={definition.dataType} onChange={e => setDefinition({ ...definition, dataType: e.target.value })}>{TYPES.map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}</TextField>
                <TextField label="الوحدة" placeholder="GB / rpm" value={definition.unit} onChange={e => setDefinition({ ...definition, unit: e.target.value })} />
                {["SELECT", "MULTI_SELECT"].includes(definition.dataType) ? <TextField multiline minRows={3} label="القيم المسموحة" helperText="افصل القيم بفاصلة أو سطر" value={definition.allowedValues} onChange={e => setDefinition({ ...definition, allowedValues: e.target.value })} /> : null}
                <Button type="submit" variant="contained" disabled={busy}>إنشاء الخاصية</Button>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, lg: 8 }}>
              <Stack spacing={1.25}>{definitions.map(item => <Card key={item.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}>
                  <Box><Typography fontWeight={800}>{item.nameAr} <Chip size="small" label={item.code} /></Typography><Typography variant="body2" color="text.secondary">{item.dataType}{item.unit ? ` · ${item.unit}` : ""}</Typography></Box>
                  <FormControlLabel label={item.isActive ? "نشطة" : "متوقفة"} control={<Switch checked={item.isActive} onChange={async e => { await updateAttributeDefinition(item.id, { isActive: e.target.checked }); load(); }} />} />
                </Stack>
              </Card>)}</Stack>
            </Grid>
          </Grid> : null}

          {tab === 1 ? <Grid container spacing={3}>
            <Grid size={{ xs: 12, lg: 7 }}>
              <Stack component="form" spacing={2} onSubmit={saveProfile}>
                <Typography variant="h6">ملف خصائص جديد</Typography>
                <TextField required label="اسم الملف" placeholder="Hard Drives" value={profileName} onChange={e => setProfileName(e.target.value)} />
                {definitions.filter(item => item.isActive).map(item => {
                  const selected = profileItems.find(row => row.attributeDefinitionId === item.id);
                  return <Card key={item.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction={{ xs: "column", md: "row" }} alignItems={{ md: "center" }} gap={1}>
                      <FormControlLabel sx={{ minWidth: 190 }} control={<Checkbox checked={Boolean(selected)} onChange={() => toggleProfileItem(item.id)} />} label={item.nameAr} />
                      {selected ? ["required", "filterable", "comparable", "visibleOnProduct", "visibleInSummary"].map(flag => <FormControlLabel key={flag} control={<Checkbox size="small" checked={Boolean(selected[flag])} onChange={e => changeFlag(item.id, flag, e.target.checked)} />} label={flag} />) : null}
                    </Stack>
                  </Card>;
                })}
                <Button type="submit" variant="contained" disabled={busy || !profileItems.length}>حفظ الملف</Button>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}><Stack spacing={1}>{profiles.map(profile => <Card key={profile.id} variant="outlined" sx={{ p: 2 }}><Typography fontWeight={800}>{profile.name}</Typography><Typography color="text.secondary">{profile.items?.length || 0} خصائص · {profile.categories?.length || 0} فئات</Typography></Card>)}</Stack></Grid>
          </Grid> : null}

          {tab === 2 ? <Stack spacing={1.5}>{categories.map(category => <Card key={category.id} variant="outlined" sx={{ p: 2 }}>
            <Grid container spacing={2} alignItems="center"><Grid size={{ xs: 12, md: 5 }}><Typography fontWeight={800}>{category.name}</Typography><Typography variant="body2" color="text.secondary">/{category.slug}</Typography></Grid><Grid size={{ xs: 12, md: 7 }}><TextField select fullWidth size="small" label="ملف الخصائص المباشر" value={category.attributeProfileId || ""} onChange={async e => { setBusy(true); try { await assignCategoryAttributeProfile(category.id, e.target.value || null); await load(); } finally { setBusy(false); } }}><MenuItem value="">بدون ملف مباشر (استخدم الوراثة)</MenuItem>{profiles.filter(profile => profile.isActive).map(profile => <MenuItem key={profile.id} value={profile.id}>{profile.name}</MenuItem>)}</TextField></Grid></Grid>
          </Card>)}</Stack> : null}
        </Box>
      </Card>
    </Stack>
  </PageWrapper>;
}
