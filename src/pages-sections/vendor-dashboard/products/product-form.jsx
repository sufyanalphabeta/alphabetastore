"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

// MUI
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Delete from "@mui/icons-material/Delete";

import DropZone from "components/DropZone";
import { FormProvider, TextField } from "components/form-hook";
import {
  ACTIVE_STATUS,
  INACTIVE_STATUS,
  createAdminProduct,
  deleteAdminProductImage,
  fetchAdminCategories,
  fetchAdminProductBySlug,
  uploadAdminProductImages,
  updateAdminProduct
} from "utils/admin-catalog";


// FORM FIELDS VALIDATION SCHEMA
const validationSchema = yup.object({
  name: yup.string().trim().required("Name is required"),
  slug: yup.string().trim().optional(),
  categoryId: yup.string().required("Category is required"),
  shortDescription: yup.string().trim().required("Short description is required"),
  description: yup.string().trim().required("Description is required"),
  stockQty: yup.number().transform((value, originalValue) => originalValue === "" ? NaN : value).typeError("Stock quantity must be a number").integer("Stock quantity must be an integer").min(0, "Stock quantity cannot be negative").required("Stock quantity is required"),
  price: yup.number().transform((value, originalValue) => originalValue === "" ? NaN : value).typeError("Price must be a number").min(0, "Price cannot be negative").required("Price is required"),
  status: yup.string().oneOf([ACTIVE_STATUS, INACTIVE_STATUS]).required("Status is required"),
  sku: yup.string().trim().optional(),
  brand: yup.string().trim().optional()
});


// ================================================================


// ================================================================

export default function ProductForm(props) {
  const {
    slug
  } = props;
  const router = useRouter();
  const [categories, setCategories] = useState([]);
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [existingImages, setExistingImages] = useState([]);
  const [removedImageIds, setRemovedImageIds] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const initialValues = {
    name: "",
    slug: "",
    categoryId: "",
    shortDescription: "",
    description: "",
    stockQty: "",
    price: "",
    status: ACTIVE_STATUS,
    sku: "",
    brand: ""
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
  const categoryOptions = useMemo(() => [...categories].sort((left, right) => left.name.localeCompare(right.name)), [categories]);
  const pendingImagePreviews = useMemo(() => pendingFiles.map(file => ({
    file,
    key: `${file.name}-${file.size}-${file.lastModified}`,
    previewUrl: URL.createObjectURL(file)
  })), [pendingFiles]);

  useEffect(() => () => {
    pendingImagePreviews.forEach(item => URL.revokeObjectURL(item.previewUrl));
  }, [pendingImagePreviews]);

  useEffect(() => {
    let isMounted = true;

    const loadForm = async () => {
      setPageError("");
      setIsLoading(true);

      try {
        const [categoryData, productData] = await Promise.all([fetchAdminCategories(), slug ? fetchAdminProductBySlug(slug) : Promise.resolve(null)]);

        if (!isMounted) return;

        setCategories(Array.isArray(categoryData) ? categoryData : []);
        setProduct(productData);
        setExistingImages(Array.isArray(productData?.images) ? productData.images : []);
        setRemovedImageIds([]);
        setPendingFiles([]);

        if (productData) {
          reset({
            name: productData.name || "",
            slug: productData.slug || "",
            categoryId: productData.categoryId || productData.category?.id || "",
            shortDescription: productData.shortDescription || "",
            description: productData.description || "",
            stockQty: String(productData.stockQty ?? ""),
            price: String(productData.price ?? ""),
            status: productData.status || ACTIVE_STATUS,
            sku: productData.sku || "",
            brand: productData.brand || ""
          });
        } else {
          reset(initialValues);
        }
      } catch (error) {
        if (!isMounted) return;
        setPageError(error instanceof Error ? error.message : "Failed to load product form");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadForm();

    return () => {
      isMounted = false;
    };
  }, [reset, slug]);

  const handleDropFiles = acceptedFiles => {
    setPendingFiles(current => {
      const nextFiles = [...current];

      acceptedFiles.forEach(file => {
        const alreadyExists = nextFiles.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified);

        if (!alreadyExists) {
          nextFiles.push(file);
        }
      });

      return nextFiles;
    });
  };

  const handleRemoveExistingImage = imageId => {
    setExistingImages(current => current.filter(image => image.id !== imageId));
    setRemovedImageIds(current => current.includes(imageId) ? current : [...current, imageId]);
  };

  const handleRemovePendingFile = key => {
    setPendingFiles(current => current.filter(file => `${file.name}-${file.size}-${file.lastModified}` !== key));
  };

// FORM SUBMIT HANDLER
  const handleSubmitForm = handleSubmit(async values => {
    const payload = {
      categoryId: values.categoryId,
      name: values.name.trim(),
      description: values.description.trim(),
      shortDescription: values.shortDescription.trim(),
      price: Number(values.price),
      stockQty: Number(values.stockQty),
      status: values.status,
      ...(values.slug?.trim() ? {
        slug: values.slug.trim()
      } : {}),
      ...(values.sku?.trim() ? {
        sku: values.sku.trim()
      } : {}),
      ...(values.brand?.trim() ? {
        brand: values.brand.trim()
      } : {})
    };

    setPageError("");

    try {
      let savedProduct;

      if (product?.id) {
        savedProduct = await updateAdminProduct(product.id, payload);
      } else {
        savedProduct = await createAdminProduct(payload);
      }

      const productId = savedProduct?.id || product?.id;

      if (productId && removedImageIds.length) {
        await Promise.all(removedImageIds.map(imageId => deleteAdminProductImage(productId, imageId)));
      }

      if (productId && pendingFiles.length) {
        await uploadAdminProductImages(productId, pendingFiles);
      }

      router.replace(`/admin/products?updated=${Date.now()}`);
      router.refresh();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to save product");
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
            <TextField fullWidth name="slug" label="Slug" color="info" size="medium" placeholder="product-slug" helperText="Optional. Leave blank on create to generate automatically." />
          </Grid>

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <TextField select fullWidth color="info" size="medium" name="categoryId" placeholder="Category" label="Select Category">
              {categoryOptions.map(option => <MenuItem key={option.id} value={option.id}>{option.parent?.name ? `${option.parent.name} / ${option.name}` : option.name}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <TextField select fullWidth color="info" size="medium" name="status" placeholder="Status" label="Status">
              <MenuItem value={ACTIVE_STATUS}>Active</MenuItem>
              <MenuItem value={INACTIVE_STATUS}>Inactive</MenuItem>
            </TextField>
          </Grid>

          <Grid size={12}>
            <TextField fullWidth name="shortDescription" color="info" size="medium" label="Short Description" placeholder="Short Description" />
          </Grid>

          <Grid size={12}>
            <TextField rows={6} multiline fullWidth color="info" size="medium" name="description" label="Description" placeholder="Description" />
          </Grid>

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <TextField fullWidth name="stockQty" color="info" size="medium" type="number" label="Stock Quantity" placeholder="Stock Quantity" />
          </Grid>

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <TextField fullWidth name="price" color="info" size="medium" type="number" label="Price" placeholder="Price" />
          </Grid>

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <TextField fullWidth name="sku" color="info" size="medium" label="SKU" placeholder="e.g. PROD-001" helperText="Optional. Must be unique across all products." />
          </Grid>

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <TextField fullWidth name="brand" color="info" size="medium" label="Brand" placeholder="e.g. Samsung" />
          </Grid>

          <Grid size={12}>
            <Typography variant="h6" sx={{
            mb: 2
          }}>
              Product Images
            </Typography>

            <DropZone onChange={handleDropFiles} info="Upload up to 10 images. Supported formats: PNG, JPG, JPEG, GIF, WEBP. Max 5 MB per image." />

            {existingImages.length || pendingImagePreviews.length ? <Box mt={3} display="grid" gridTemplateColumns={{
            md: "repeat(4, minmax(0, 1fr))",
            sm: "repeat(3, minmax(0, 1fr))",
            xs: "repeat(2, minmax(0, 1fr))"
          }} gap={2}>
                {existingImages.map(image => <Box key={image.id} p={1.5} border="1px solid" borderColor="divider" borderRadius={2} bgcolor="grey.50">
                    <Box component="img" src={image.imageUrl} alt="Product" sx={{
                  width: "100%",
                  height: 140,
                  objectFit: "cover",
                  borderRadius: 1,
                  display: "block",
                  mb: 1
                }} />

                    <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                      <Typography variant="caption" color="text.secondary">
                        Uploaded image
                      </Typography>

                      <IconButton color="error" onClick={() => handleRemoveExistingImage(image.id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>)}

                {pendingImagePreviews.map(item => <Box key={item.key} p={1.5} border="1px solid" borderColor="divider" borderRadius={2} bgcolor="grey.50">
                    <Box component="img" src={item.previewUrl} alt={item.file.name} sx={{
                  width: "100%",
                  height: 140,
                  objectFit: "cover",
                  borderRadius: 1,
                  display: "block",
                  mb: 1
                }} />

                    <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                      <Typography variant="caption" color="text.secondary" sx={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}>
                        Pending upload
                      </Typography>

                      <IconButton color="error" onClick={() => handleRemovePendingFile(item.key)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>)}
              </Box> : null}
          </Grid>

          <Grid size={12}>
            <Button variant="outlined" color="inherit" onClick={() => router.push("/admin/products")} sx={{
            mr: 2
          }}>
              Cancel
            </Button>

            <Button loading={isSubmitting} variant="contained" color="info" type="submit">
              {product?.id ? "Update product" : "Save product"}
            </Button>
          </Grid>
        </Grid>
      </FormProvider>
    </Card>;
}