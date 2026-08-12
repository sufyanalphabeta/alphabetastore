"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
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
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import MuiTextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";

import ProductMediaSection from "components/admin/media/ProductMediaSection";
import { FormProvider, TextField } from "components/form-hook";
import useSettings from "hooks/useSettings";
import { buildPricingSettings, computeStorefrontPrice, formatPrice } from "utils/pricing";
import { fetchBrands } from "utils/admin-brands";
import {
  ACTIVE_STATUS,
  INACTIVE_STATUS,
  createAdminProduct,
  deleteAdminProductImage,
  fetchAdminCategories,
  fetchAdminProductBySlug,
  updateAdminProduct
} from "utils/admin-catalog";
import { attachProductMedia, listProductMedia, reorderProductMedia } from "utils/admin-media";


// FORM FIELDS VALIDATION SCHEMA
const validationSchema = yup.object({
  name: yup.string().trim().required("Name is required"),
  slug: yup.string().trim().optional(),
  categoryId: yup.string().required("Category is required"),
  shortDescription: yup.string().trim().required("Short description is required"),
  description: yup.string().trim().required("Description is required"),
  stockQty: yup.number().transform((value, originalValue) => originalValue === "" ? NaN : value).typeError("Stock quantity must be a number").integer("Stock quantity must be an integer").min(0, "Stock quantity cannot be negative").required("Stock quantity is required"),
  price: yup.number().transform((value, originalValue) => originalValue === "" ? NaN : value).typeError("Price must be a number").min(0, "Price cannot be negative").required("Price is required"),
  baseCurrency: yup.string().oneOf(["LYD", "USD"]).required("Base currency is required"),
  exchangeRateOverride: yup.number().transform((value, originalValue) => originalValue === "" ? null : value).typeError("Exchange rate must be a number").moreThan(0, "Exchange rate must be greater than 0").nullable().optional(),
  comparePrice: yup.number().transform((value, originalValue) => originalValue === "" ? NaN : value).typeError("Compare price must be a number").min(0, "Compare price cannot be negative").nullable().optional(),
  discountType: yup.string().oneOf(["NONE", "PERCENTAGE", "FIXED"]).optional(),
  discountValue: yup.number().transform((value, originalValue) => originalValue === "" ? NaN : value).typeError("Discount value must be a number").min(0, "Discount value cannot be negative").nullable().optional(),
  discountStartAt: yup.string().optional().nullable(),
  discountEndAt: yup.string().optional().nullable(),
  status: yup.string().oneOf([ACTIVE_STATUS, INACTIVE_STATUS]).required("Status is required"),
  sku: yup.string().trim().optional(),
  warrantyText: yup.string().trim().max(120).optional(),
  datasheetUrl: yup.string().trim().test("datasheet-url", "Datasheet URL must be a valid URL", value => {
    if (!value) return true;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }).optional(),
  brand: yup.string().trim().optional(),
  brandId: yup.string().optional().nullable()
});


// ================================================================


// ================================================================

export default function ProductForm(props) {
  const {
    slug
  } = props;
  const router = useRouter();
  const { settings } = useSettings();
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [productMedia, setProductMedia] = useState([]);

  // ── Highlights state ──────────────────────────────────────────────────────
  const [highlights, setHighlights] = useState([]); // string[]
  const [highlightInput, setHighlightInput] = useState("");

  const addHighlight = () => {
    const trimmed = highlightInput.trim();
    if (trimmed) { setHighlights(h => [...h, trimmed]); setHighlightInput(""); }
  };
  const removeHighlight = i => setHighlights(h => h.filter((_, idx) => idx !== i));

  // ── Specs state ───────────────────────────────────────────────────────────
  const [specs, setSpecs] = useState([]); // { key, value }[]
  const [specKey, setSpecKey] = useState("");
  const [specValue, setSpecValue] = useState("");

  const addSpec = () => {
    const k = specKey.trim(); const v = specValue.trim();
    if (k) {
      setSpecs(s => {
        const existing = s.findIndex(r => r.key === k);
        if (existing >= 0) { const next = [...s]; next[existing] = { key: k, value: v }; return next; }
        return [...s, { key: k, value: v }];
      });
      setSpecKey(""); setSpecValue("");
    }
  };
  const removeSpec = i => setSpecs(s => s.filter((_, idx) => idx !== i));

  const initialValues = {
    name: "",
    slug: "",
    categoryId: "",
    shortDescription: "",
    description: "",
    stockQty: "",
    price: "",
    baseCurrency: "LYD",
    exchangeRateOverride: "",
    comparePrice: "",
    discountType: "NONE",
    discountValue: "",
    discountStartAt: "",
    discountEndAt: "",
    status: ACTIVE_STATUS,
    sku: "",
    warrantyText: "",
    datasheetUrl: "",
    brand: "",
    brandId: ""
  };
  const methods = useForm({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema)
  });
  const {
    handleSubmit,
    reset,
    control,
    formState: {
      isSubmitting
    }
  } = methods;

  // Watch pricing fields for live preview
  const watchedPrice = useWatch({ control, name: "price" });
  const watchedBaseCurrency = useWatch({ control, name: "baseCurrency" });
  const watchedDiscountType = useWatch({ control, name: "discountType" });
  const watchedDiscountValue = useWatch({ control, name: "discountValue" });

  // Compute live price preview
  const pricePreview = useMemo(() => {
    const priceNum = Number(watchedPrice);
    if (!priceNum || priceNum <= 0) return null;
    const pricingSettings = buildPricingSettings(settings);
    const syntheticProduct = {
      price: priceNum,
      baseCurrency: watchedBaseCurrency || "LYD",
      discountType: watchedDiscountType === "NONE" ? undefined : watchedDiscountType,
      discountValue: watchedDiscountValue ? Number(watchedDiscountValue) : undefined,
    };
    return computeStorefrontPrice(syntheticProduct, pricingSettings);
  }, [watchedPrice, watchedBaseCurrency, watchedDiscountType, watchedDiscountValue, settings]);

  const categoryOptions = useMemo(() => [...categories].sort((left, right) => left.name.localeCompare(right.name)), [categories]);
  useEffect(() => {
    let isMounted = true;

    const loadForm = async () => {
      setPageError("");
      setIsLoading(true);

      try {
        const [categoryData, productData, brandData] = await Promise.all([
            fetchAdminCategories(),
            slug ? fetchAdminProductBySlug(slug) : Promise.resolve(null),
            fetchBrands()
          ]);

        if (!isMounted) return;

        setCategories(Array.isArray(categoryData) ? categoryData : []);
        setBrands(Array.isArray(brandData) ? brandData : []);
        setProduct(productData);
        setProductMedia(Array.isArray(productData?.gallery) ? productData.gallery : []);

        // Hydrate highlights and specs
        setHighlights(Array.isArray(productData?.highlights) ? productData.highlights : []);
        const rawSpecs = productData?.specs;
        setSpecs(
          rawSpecs && typeof rawSpecs === "object" && !Array.isArray(rawSpecs)
            ? Object.entries(rawSpecs).map(([key, value]) => ({ key, value: String(value) }))
            : []
        );

        if (productData) {
          reset({
            name: productData.name || "",
            slug: productData.slug || "",
            categoryId: productData.categoryId || productData.category?.id || "",
            shortDescription: productData.shortDescription || "",
            description: productData.description || "",
            stockQty: String(productData.stockQty ?? ""),
            price: String(productData.price ?? ""),
            baseCurrency: productData.baseCurrency || "LYD",
            exchangeRateOverride: productData.exchangeRateOverride != null ? String(productData.exchangeRateOverride) : "",
            comparePrice: productData.comparePrice != null ? String(productData.comparePrice) : "",
            discountType: productData.discountType || "NONE",
            discountValue: productData.discountValue != null ? String(productData.discountValue) : "",
            discountStartAt: productData.discountStartAt ? productData.discountStartAt.slice(0, 16) : "",
            discountEndAt: productData.discountEndAt ? productData.discountEndAt.slice(0, 16) : "",
            status: productData.status || ACTIVE_STATUS,
            sku: productData.sku || "",
            warrantyText: productData.warrantyText || "",
            datasheetUrl: productData.datasheetUrl || "",
            brand: productData.brand || "",
            brandId: productData.brandId || ""
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

  const removeLegacyImage = async imageId => {
    if (product?.id) await deleteAdminProductImage(product.id, imageId);
  };

  const attachCreateMedia = async (productId, selectedItems) => {
    const attached = [];
    for (let index = 0; index < selectedItems.length; index += 1) {
      attached.push(await attachProductMedia(productId, selectedItems[index].mediaAssetId, index === 0 ? "PRIMARY" : "GALLERY"));
    }
    if (attached.length > 1) await reorderProductMedia(productId, attached.map(item => item.id));
    return listProductMedia(productId);
  };

// FORM SUBMIT HANDLER
  const handleSubmitForm = handleSubmit(async values => {
    const payload = {
      categoryId: values.categoryId,
      name: values.name.trim(),
      description: values.description.trim(),
      shortDescription: values.shortDescription.trim(),
      price: Number(values.price),
      baseCurrency: values.baseCurrency || "LYD",
      ...(values.exchangeRateOverride ? { exchangeRateOverride: Number(values.exchangeRateOverride) } : { exchangeRateOverride: null }),
      stockQty: Number(values.stockQty),
      status: values.status,
      ...(values.comparePrice ? { comparePrice: Number(values.comparePrice) } : { comparePrice: null }),
      ...(values.discountType && values.discountType !== "NONE"
        ? {
            discountType: values.discountType,
            discountValue: values.discountValue ? Number(values.discountValue) : null,
            discountStartAt: values.discountStartAt || null,
            discountEndAt: values.discountEndAt || null,
          }
        : {
            discountType: null,
            discountValue: null,
            discountStartAt: null,
            discountEndAt: null,
          }),
      ...(values.slug?.trim() ? { slug: values.slug.trim() } : {}),
      ...(values.sku?.trim() ? { sku: values.sku.trim() } : {}),
      ...(values.warrantyText?.trim() ? { warrantyText: values.warrantyText.trim() } : { warrantyText: null }),
      ...(values.datasheetUrl?.trim() ? { datasheetUrl: values.datasheetUrl.trim() } : { datasheetUrl: null }),
      ...(values.brand?.trim() ? { brand: values.brand.trim() } : {}),
      ...(values.brandId ? { brandId: values.brandId } : { brandId: null }),
      highlights: highlights.length ? highlights : null,
      specs: specs.length ? Object.fromEntries(specs.map(r => [r.key, r.value])) : null
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

      if (!product?.id && productId && productMedia.length) {
        try {
          setProductMedia(await attachCreateMedia(productId, productMedia));
        } catch {
          setProduct(savedProduct);
          try { setProductMedia(await listProductMedia(productId)); } catch { /* retain local selections for retry */ }
          setPageError("تم إنشاء المنتج، لكن تعذر ربط بعض الصور. المنتج محفوظ ويمكنك إعادة إضافة الصور من هذه الصفحة.");
          return;
        }
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
            <TextField select fullWidth color="info" size="medium" name="baseCurrency" label="Base Currency">
              <MenuItem value="LYD">LYD (Libyan Dinar)</MenuItem>
              <MenuItem value="USD">USD (US Dollar)</MenuItem>
            </TextField>
          </Grid>

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <TextField fullWidth name="exchangeRateOverride" color="info" size="medium" type="number" label="Product Exchange Rate (optional)" placeholder="Uses global rate" helperText="For USD products only. Leave blank to use the store rate." inputProps={{ min: 0.000001, step: 0.000001 }} />
          </Grid>

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <TextField fullWidth name="comparePrice" color="info" size="medium" type="number" label="Compare Price (optional)" placeholder="Original price before discount" helperText="Show a crossed-out reference price (e.g. RRP). Leave blank to hide." />
          </Grid>

          <Grid size={{ sm: 6, xs: 12 }}>
            <TextField fullWidth name="warrantyText" color="info" size="medium" label="Warranty" placeholder="e.g. 1 year" />
          </Grid>

          <Grid size={{ sm: 6, xs: 12 }}>
            <TextField fullWidth name="datasheetUrl" color="info" size="medium" label="Datasheet URL (optional)" placeholder="https://..." />
          </Grid>

          <Grid size={{
          sm: 6,
          xs: 12
        }}>
            <TextField select fullWidth color="info" size="medium" name="discountType" label="Discount Type">
              <MenuItem value="NONE">No discount</MenuItem>
              <MenuItem value="PERCENTAGE">Percentage (%)</MenuItem>
              <MenuItem value="FIXED">Fixed amount</MenuItem>
            </TextField>
          </Grid>

          {watchedDiscountType && watchedDiscountType !== "NONE" && <>
            <Grid size={{
            sm: 6,
            xs: 12
          }}>
              <TextField fullWidth name="discountValue" color="info" size="medium" type="number" label={watchedDiscountType === "PERCENTAGE" ? "Discount %" : `Discount amount (${watchedBaseCurrency || "LYD"})`} placeholder={watchedDiscountType === "PERCENTAGE" ? "e.g. 20 for 20%" : "e.g. 50"} />
            </Grid>

            <Grid size={{
            sm: 6,
            xs: 12
          }}>
              <TextField fullWidth name="discountStartAt" color="info" size="medium" type="datetime-local" label="Discount Start (optional)" InputLabelProps={{ shrink: true }} helperText="Leave blank to start immediately" />
            </Grid>

            <Grid size={{
            sm: 6,
            xs: 12
          }}>
              <TextField fullWidth name="discountEndAt" color="info" size="medium" type="datetime-local" label="Discount End (optional)" InputLabelProps={{ shrink: true }} helperText="Leave blank for no expiry" />
            </Grid>
          </>}

          {/* LIVE PRICE PREVIEW */}
          {pricePreview && (
            <Grid size={12}>
              <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "grey.50" }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Price Preview ({pricePreview.currency})
                </Typography>
                <Box display="flex" gap={3} flexWrap="wrap">
                  <Box>
                    <Typography variant="caption" color="text.secondary">Store price</Typography>
                    <Typography variant="h6" color="primary" fontWeight={700}>
                      {formatPrice(pricePreview.finalPrice, pricePreview.currency)}
                    </Typography>
                  </Box>
                  {pricePreview.hasActiveDiscount && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Before discount</Typography>
                      <Typography variant="body2" sx={{ textDecoration: "line-through", color: "grey.500" }}>
                        {formatPrice(pricePreview.displayBasePrice, pricePreview.currency)}
                      </Typography>
                    </Box>
                  )}
                  {pricePreview.hasActiveDiscount && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Savings</Typography>
                      <Typography variant="body2" color="success.main" fontWeight={600}>
                        -{Math.round(pricePreview.discountPercent)}% ({formatPrice(pricePreview.savings, pricePreview.currency)})
                      </Typography>
                    </Box>
                  )}
                  <Box>
                    <Typography variant="caption" color="text.secondary">Rate used</Typography>
                    <Typography variant="body2" color="text.secondary">
                      1 USD = {pricePreview.exchangeRateUsed} LYD
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>
          )}

          <Grid size={12}>
            <Divider />
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
            <TextField fullWidth name="brand" color="info" size="medium" label="Brand (text)" placeholder="e.g. Samsung" helperText="Free-text brand name. Use Brand selector below to link to a brand record." />
          </Grid>

          <Grid size={{ sm: 6, xs: 12 }}>
            <TextField select fullWidth color="info" size="medium" name="brandId" label="Brand (linked record)">
              <MenuItem value="">— None —</MenuItem>
              {brands.map(b => (
                <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={12}>
            <Divider />
          </Grid>

          {/* ── Highlights ── */}
          <Grid size={12}>
            <Typography variant="h6" sx={{ mb: 1 }}>Key Features / Highlights</Typography>
            <Stack spacing={1}>
              {highlights.map((h, i) => (
                <Stack key={i} direction="row" alignItems="center" spacing={1}>
                  <Typography variant="body2" sx={{ flex: 1, bgcolor: "grey.100", px: 1.5, py: 0.75, borderRadius: 1 }}>{h}</Typography>
                  <IconButton size="small" color="error" onClick={() => removeHighlight(i)}><Delete fontSize="small" /></IconButton>
                </Stack>
              ))}
              <Stack direction="row" spacing={1}>
                <MuiTextField
                  size="small"
                  fullWidth
                  placeholder="e.g. Intel Core i7-1355U"
                  value={highlightInput}
                  onChange={e => setHighlightInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addHighlight(); } }}
                  InputProps={{ endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={addHighlight} disabled={!highlightInput.trim()}>
                        <Add fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  )}}
                />
              </Stack>
            </Stack>
          </Grid>

          <Grid size={12}>
            <Divider />
          </Grid>

          {/* ── Specifications ── */}
          <Grid size={12}>
            <Typography variant="h6" sx={{ mb: 1 }}>Specifications</Typography>
            {specs.length > 0 && (
              <Box sx={{ mb: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1, overflow: "hidden" }}>
                {specs.map((row, i) => (
                  <Stack key={i} direction="row" alignItems="center"
                    sx={{ px: 1.5, py: 0.75, borderBottom: i < specs.length - 1 ? "1px solid" : "none", borderColor: "divider", "&:hover": { bgcolor: "grey.50" } }}
                  >
                    <Typography variant="body2" fontWeight={600} sx={{ width: "35%", color: "text.secondary" }}>{row.key}</Typography>
                    <Typography variant="body2" sx={{ flex: 1 }}>{row.value}</Typography>
                    <IconButton size="small" color="error" onClick={() => removeSpec(i)}><Delete fontSize="small" /></IconButton>
                  </Stack>
                ))}
              </Box>
            )}
            <Stack direction={{ sm: "row", xs: "column" }} spacing={1}>
              <MuiTextField
                size="small"
                placeholder="Spec name (e.g. CPU)"
                value={specKey}
                onChange={e => setSpecKey(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSpec(); } }}
                sx={{ width: { sm: "35%", xs: "100%" } }}
              />
              <MuiTextField
                size="small"
                fullWidth
                placeholder="Value (e.g. Intel Core i7)"
                value={specValue}
                onChange={e => setSpecValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSpec(); } }}
              />
              <Button variant="outlined" size="small" onClick={addSpec} disabled={!specKey.trim()} startIcon={<Add />}
                sx={{ flexShrink: 0, height: 40 }}>
                Add
              </Button>
            </Stack>
          </Grid>

          <Grid size={12}>
            <ProductMediaSection productId={product?.id || null} items={productMedia} onChange={setProductMedia} onRemoveLegacy={removeLegacyImage} />
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
