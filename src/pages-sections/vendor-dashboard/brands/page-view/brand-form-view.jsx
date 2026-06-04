"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

import { Checkbox, FormProvider, TextField } from "components/form-hook";
import {
  createBrand,
  fetchBrandBySlug,
  updateBrand,
  uploadBrandLogo
} from "utils/admin-brands";

const schema = yup.object().shape({
  name: yup.string().trim().min(2).required("Name required"),
  slug: yup.string().trim().min(2).required("Slug required"),
  description: yup.string().max(2000).nullable(),
  isVisible: yup.boolean().required(),
  isFeatured: yup.boolean().required(),
  sortOrder: yup.number().integer().min(0).required()
});

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function BrandFormView({ slug }) {
  const router = useRouter();
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(Boolean(slug));
  const [pageError, setPageError] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const methods = useForm({
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      isVisible: true,
      isFeatured: false,
      sortOrder: 0
    },
    resolver: yupResolver(schema)
  });

  const { handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = methods;
  const nameValue = watch("name");

  // Auto-generate slug from name when creating a new brand
  useEffect(() => {
    if (!slug && nameValue) {
      setValue("slug", slugify(nameValue), { shouldValidate: false });
    }
  }, [nameValue, slug, setValue]);

  useEffect(() => {
    let active = true;
    if (!slug) return;
    (async () => {
      try {
        const data = await fetchBrandBySlug(slug);
        if (!active) return;
        setBrand(data);
        setLogoUrl(data?.logoUrl || "");
        reset({
          name: data?.name || "",
          slug: data?.slug || "",
          description: data?.description || "",
          isVisible: data?.isVisible !== false,
          isFeatured: Boolean(data?.isFeatured),
          sortOrder: data?.sortOrder ?? 0
        });
      } catch (e) {
        if (active) setPageError(e instanceof Error ? e.message : "Failed to load brand");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, reset]);

  const onLogoSelected = useCallback(
    async file => {
      if (!file) return;
      if (!brand?.id) {
        setPageError("Save the brand first, then upload a logo.");
        return;
      }
      setUploading(true);
      setPageError("");
      try {
        const updated = await uploadBrandLogo(brand.id, file);
        setLogoUrl(updated.logoUrl || "");
      } catch (e) {
        setPageError(e instanceof Error ? e.message : "Failed to upload logo");
      } finally {
        setUploading(false);
      }
    },
    [brand?.id]
  );

  const onSubmit = handleSubmit(async values => {
    setPageError("");
    const payload = {
      name: values.name.trim(),
      slug: values.slug.trim() || slugify(values.name),
      description: values.description?.trim() || undefined,
      isVisible: Boolean(values.isVisible),
      isFeatured: Boolean(values.isFeatured),
      sortOrder: Number(values.sortOrder) || 0
    };
    try {
      if (brand?.id) {
        await updateBrand(brand.id, payload);
      } else {
        const created = await createBrand(payload);
        // route to edit so logo upload becomes possible
        router.replace(`/admin/brands/${created.slug}`);
        router.refresh();
        return;
      }
      router.replace(`/admin/brands?updated=${Date.now()}`);
      router.refresh();
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Failed to save brand");
    }
  });

  if (loading) {
    return (
      <Card className="p-3" sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress color="info" />
      </Card>
    );
  }

  return (
    <Card className="p-3">
      <FormProvider methods={methods} onSubmit={onSubmit}>
        <Grid container spacing={3}>
          {pageError ? (
            <Grid size={12}>
              <Alert severity="error">{pageError}</Alert>
            </Grid>
          ) : null}

          <Grid size={{ sm: 6, xs: 12 }}>
            <TextField fullWidth name="name" label="Name" color="info" size="medium" />
          </Grid>

          <Grid size={{ sm: 6, xs: 12 }}>
            <TextField fullWidth name="slug" label="Slug" color="info" size="medium" placeholder="brand-slug" />
          </Grid>

          <Grid size={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              name="description"
              label="Description"
              color="info"
              size="medium"
            />
          </Grid>

          <Grid size={{ sm: 4, xs: 6 }}>
            <Checkbox color="info" name="isVisible" label="Visible" />
          </Grid>

          <Grid size={{ sm: 4, xs: 6 }}>
            <Checkbox color="info" name="isFeatured" label="Featured" />
          </Grid>

          <Grid size={{ sm: 4, xs: 12 }}>
            <TextField
              fullWidth
              type="number"
              name="sortOrder"
              label="Sort Order"
              color="info"
              size="medium"
            />
          </Grid>

          <Grid size={12}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Logo
            </Typography>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar
                variant="rounded"
                src={logoUrl || undefined}
                alt="logo"
                sx={{ width: 80, height: 80, bgcolor: "grey.200" }}
              >
                {nameValue?.charAt(0)?.toUpperCase()}
              </Avatar>
              <Button
                variant="outlined"
                disabled={!brand?.id || uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? "Uploading…" : logoUrl ? "Replace Logo" : "Upload Logo"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={e => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) onLogoSelected(file);
                }}
              />
              {!brand?.id ? (
                <Typography variant="caption" color="text.secondary">
                  Save the brand first to enable logo upload.
                </Typography>
              ) : null}
            </Stack>
          </Grid>

          <Grid size={12}>
            <Stack direction="row" spacing={2}>
              <Button variant="contained" color="info" type="submit" disabled={isSubmitting}>
                {brand?.id ? "Save Changes" : "Create Brand"}
              </Button>
              <Button variant="text" onClick={() => router.push("/admin/brands")}>
                Cancel
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </FormProvider>
    </Card>
  );
}
