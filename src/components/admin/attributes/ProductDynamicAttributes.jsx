"use client";

import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { fetchEffectiveAttributeProfile, fetchProductAttributes } from "utils/admin-attributes";

function initialValue(type) {
  if (type === "MULTI_SELECT") return [];
  if (type === "BOOLEAN") return false;
  return "";
}

export default function ProductDynamicAttributes({ categoryId, productId, value, onChange }) {
  const [state, setState] = useState({ profile: null, inheritedFrom: null, isInherited: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!categoryId) {
      setState({ profile: null, inheritedFrom: null, isInherited: false });
      onChange([]);
      return () => { active = false; };
    }
    setLoading(true);
    setError("");
    const request = productId
      ? Promise.all([fetchEffectiveAttributeProfile(categoryId), fetchProductAttributes(productId)])
          .then(([profileState, productState]) => ({ ...profileState, values: productState?.values || [] }))
      : fetchEffectiveAttributeProfile(categoryId);
    request.then(result => {
      if (!active) return;
      setState(result || { profile: null });
      const existing = new Map((result?.values || []).map(item => [item.code, item.value]));
      const next = (result?.profile?.items || []).map(item => ({
        code: item.attributeDefinition.code,
        value: existing.has(item.attributeDefinition.code)
          ? existing.get(item.attributeDefinition.code)
          : initialValue(item.attributeDefinition.dataType)
      }));
      onChange(next);
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : "تعذر تحميل خصائص الفئة.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [categoryId, productId]);

  const values = useMemo(() => new Map((value || []).map(item => [item.code, item.value])), [value]);
  const setValue = (code, nextValue) => {
    const next = (state.profile?.items || []).map(item => ({
      code: item.attributeDefinition.code,
      value: item.attributeDefinition.code === code
        ? nextValue
        : values.get(item.attributeDefinition.code) ?? initialValue(item.attributeDefinition.dataType)
    }));
    onChange(next);
  };

  if (!categoryId) return <Alert severity="info">اختر الفئة أولًا لعرض خصائص المنتج المناسبة.</Alert>;
  if (loading) return <Stack direction="row" gap={1} alignItems="center"><CircularProgress size={20} /><Typography>جاري تحميل خصائص الفئة…</Typography></Stack>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!state.profile) return <Alert severity="info">لا يوجد ملف خصائص مرتبط بهذه الفئة. يمكن الاستمرار بالمواصفات القديمة أدناه.</Alert>;

  return <Box>
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" sx={{ mb: 2 }}>
      <Box>
        <Typography variant="h6">الخصائص المنظمة</Typography>
        <Typography color="text.secondary" variant="body2">{state.profile.name}</Typography>
      </Box>
      {state.isInherited ? <Alert severity="info" sx={{ py: 0 }}>موروث من: {state.inheritedFrom?.name}</Alert> : null}
    </Stack>
    <Stack spacing={2}>
      {(state.profile.items || []).filter(item => item.attributeDefinition.isActive).map(item => {
        const definition = item.attributeDefinition;
        const current = values.get(definition.code) ?? initialValue(definition.dataType);
        const label = `${definition.nameAr}${item.required ? " *" : ""}${definition.unit ? ` (${definition.unit})` : ""}`;
        if (definition.dataType === "BOOLEAN") {
          return <FormControlLabel key={definition.code} control={<Checkbox checked={Boolean(current)} onChange={event => setValue(definition.code, event.target.checked)} />} label={label} />;
        }
        if (definition.dataType === "SELECT" || definition.dataType === "MULTI_SELECT") {
          return <TextField key={definition.code} select fullWidth label={label} value={current} SelectProps={{ multiple: definition.dataType === "MULTI_SELECT" }} onChange={event => setValue(definition.code, event.target.value)} helperText={definition.description || ""}>
            {(definition.allowedValues || []).map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
          </TextField>;
        }
        return <TextField key={definition.code} fullWidth type={definition.dataType === "NUMBER" ? "number" : "text"} label={label} value={current} onChange={event => setValue(definition.code, event.target.value)} helperText={definition.description || ""} />;
      })}
    </Stack>
  </Box>;
}
