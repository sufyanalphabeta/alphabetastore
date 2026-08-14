"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

// MUI
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";

import { Checkbox, FormProvider, TextField } from "components/form-hook";
import { fetchAdminCategories } from "utils/admin-catalog";
import { apiPatch, apiPost } from "utils/api";


// FORM FIELDS VALIDATION
const validationSchema = yup.object().shape({
  name: yup.string().required("Name required"),
  slug: yup.string().required("Slug required"),
  parentId: yup.string().nullable(),
  isActive: yup.boolean().required(),
  isVisible: yup.boolean().required(),
  sortOrder: yup.number().integer().min(0).required(),
  icon: yup.string().nullable()
});


// ================================================================


// ================================================================

export default function CategoryForm({
  slug
}) {
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(slug));
  const [pageError, setPageError] = useState("");
  const initialValues = {
    name: "",
    slug: "",
    parentId: "",
    isActive: true,
    isVisible: true,
    sortOrder: 0,
    icon: ""
  };
  const methods = useForm({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema)
  });
  const {
    handleSubmit,
    reset,
    formState: {
      isSubmitting
    }
  } = methods;
  const editingCategory = useMemo(() => categories.find(item => item.slug === slug) || null, [categories, slug]);

  const parentOptions = useMemo(() => {
    const excluded = new Set(editingCategory ? [editingCategory.id] : []);
    if (editingCategory) {
      const pending = [editingCategory.id];
      while (pending.length) {
        const parentId = pending.shift();
        for (const category of categories) {
          if (category.parentId === parentId && !excluded.has(category.id)) {
            excluded.add(category.id);
            pending.push(category.id);
          }
        }
      }
    }

    const byId = new Map(categories.map(category => [category.id, category]));
    const pathFor = category => {
      const path = [category.name];
      const visited = new Set([category.id]);
      let parentId = category.parentId;
      while (parentId && byId.has(parentId) && !visited.has(parentId)) {
        const parent = byId.get(parentId);
        path.unshift(parent.name);
        visited.add(parentId);
        parentId = parent.parentId;
      }
      return path.join(" / ");
    };

    return categories
      .filter(category => !excluded.has(category.id))
      .map(category => ({ ...category, pathLabel: pathFor(category) }))
      .sort((left, right) => left.pathLabel.localeCompare(right.pathLabel));
  }, [categories, editingCategory]);

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      setPageError("");
      setIsLoading(true);

      try {
        const data = await fetchAdminCategories();

        if (!isMounted) return;

        setCategories(Array.isArray(data) ? data : []);

        if (slug) {
          const currentCategory = data.find(item => item.slug === slug);

          if (!currentCategory) {
            setPageError("Category not found");
            return;
          }

          reset({
            name: currentCategory.name || "",
            slug: currentCategory.slug || "",
            parentId: currentCategory.parentId || "",
            isActive: currentCategory.isActive ?? true,
            isVisible: currentCategory.isVisible ?? true,
            sortOrder: currentCategory.sortOrder ?? 0,
            icon: currentCategory.icon || ""
          });
        }
      } catch (error) {
        if (!isMounted) return;
        setPageError(error instanceof Error ? error.message : "Failed to load categories");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, [reset, slug]);

  
// FORM SUBMIT HANDLER
  const handleSubmitForm = handleSubmit(async values => {
    const payload = {
      name: values.name.trim(),
      slug: values.slug.trim(),
      parentId: values.parentId || null,
      isActive: Boolean(values.isActive),
      isVisible: Boolean(values.isVisible),
      sortOrder: Number(values.sortOrder) || 0,
      icon: values.icon?.trim() || undefined
    };

    setPageError("");

    try {
      if (editingCategory) {
        await apiPatch(`/categories/${editingCategory.id}`, payload);
      } else {
        await apiPost("/categories", payload);
      }

      router.replace(`/admin/categories?updated=${Date.now()}`);
      router.refresh();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to save category");
    }
  });

  if (isLoading) {
    return <Card className="p-3" sx={{
      display: "flex",
      justifyContent: "center",
      py: 6
    }}>
        <CircularProgress color="info" />
      </Card>;
  }

  return <Card className="p-3">
      <FormProvider methods={methods} onSubmit={handleSubmitForm}>
        <Grid container spacing={3}>
          {pageError ? <Grid size={12}>
              <Alert severity="error">{pageError}</Alert>
            </Grid> : null}

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <TextField fullWidth name="name" label="Name" color="info" size="medium" placeholder="Name" />
          </Grid>

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <TextField fullWidth name="slug" label="Slug" color="info" size="medium" placeholder="category-slug" />
          </Grid>

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <TextField select fullWidth color="info" size="medium" name="parentId" placeholder="Parent Category" label="Select Parent Category">
              <MenuItem value="">None</MenuItem>
              {parentOptions.map(option => <MenuItem key={option.id} value={option.id}>{option.pathLabel}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <Checkbox color="info" name="isActive" label="Active Category" />
          </Grid>

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <Checkbox color="info" name="isVisible" label="Visible in Navbar / Menu" />
          </Grid>

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <TextField fullWidth type="number" name="sortOrder" label="Sort Order" color="info" size="medium" placeholder="0" helperText="Lower numbers appear first" inputProps={{ min: 0 }} />
          </Grid>

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <TextField fullWidth name="icon" label="Icon Name (Material Icons)" color="info" size="medium" placeholder="e.g. laptop, router, videocam" helperText="Material Symbols icon name (optional)" />
          </Grid>

          <Grid size={12}>
            <Button variant="outlined" color="inherit" onClick={() => router.push("/admin/categories") } sx={{
            mr: 2
          }}>
              Cancel
            </Button>

            <Button loading={isSubmitting} variant="contained" color="info" type="submit">
              {editingCategory ? "Update category" : "Save category"}
            </Button>
          </Grid>
        </Grid>
      </FormProvider>
    </Card>;
}
