"use client";

import { Fragment, Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// MUI
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

// GLOBAL CUSTOM COMPONENTS
import AccordionHeader from "components/accordion";

// CUSTOM LOCAL HOOK
import useProductFilterCard from "./use-product-filter-card";

// TYPES

export default function ProductFilters(props) {
  return (
    <Suspense fallback={null}>
      <ProductFiltersInner {...props} />
    </Suspense>
  );
}

function ProductFiltersInner({
  filters
}) {
  const {
    categories: CATEGORIES = [],
    brands: BRANDS = [],
    inStock: inStockProp = false,
  } = filters || {};
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCategory = searchParams.get("category") || "";
  const selectedBrand = searchParams.get("brand") || "";
  const selectedBrandId = searchParams.get("brandId") || "";
  const initialMinPrice = Number(searchParams.get("minPrice") || 0);
  const initialMaxPrice = Number(searchParams.get("maxPrice") || 0);
  const currentInStock = searchParams.get("inStock") === "true";
  const [priceRange, setPriceRange] = useState([initialMinPrice, initialMaxPrice || 5000]);
  const [maxPriceInput, setMaxPriceInput] = useState(initialMaxPrice || "");
  const [minPriceInput, setMinPriceInput] = useState(initialMinPrice || "");

  const {
    collapsed,
    setCollapsed,
    handleChangeSearchParams
  } = useProductFilterCard();

  const handleSelectCategory = slug => {
    handleChangeSearchParams("category", selectedCategory === slug ? "" : slug);
  };

  const handleSelectBrand = (brand) => {
    const params = new URLSearchParams(searchParams);
    // Determine if brand is object (from API) or legacy string
    if (brand && typeof brand === "object") {
      const isSelected = selectedBrandId === brand.id;
      if (isSelected) {
        params.delete("brandId");
        params.delete("brand");
      } else {
        params.set("brandId", brand.id);
        params.set("brand", brand.slug);
      }
    } else {
      const isSelected = selectedBrand === brand;
      if (isSelected) {
        params.delete("brand");
      } else {
        params.set("brand", brand);
      }
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleToggleInStock = () => {
    const params = new URLSearchParams(searchParams);
    if (currentInStock) {
      params.delete("inStock");
    } else {
      params.set("inStock", "true");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleApplyPriceFilter = () => {
    const params = new URLSearchParams(searchParams);
    const min = Number(minPriceInput);
    const max = Number(maxPriceInput);

    if (min > 0) {
      params.set("minPrice", String(min));
    } else {
      params.delete("minPrice");
    }

    if (max > 0) {
      params.set("maxPrice", String(max));
    } else {
      params.delete("maxPrice");
    }

    params.delete("page");
    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  };

  const renderCategoryItem = item => {
    const title = typeof item === "string" ? item : item?.title;
    const slug = typeof item === "string" ? item : item?.slug;
    const isSelected = Boolean(slug) && selectedCategory === slug;

    return <Typography variant="body1" key={slug || title} onClick={slug ? () => handleSelectCategory(slug) : undefined} sx={{
      py: 0.75,
      fontSize: 14,
      cursor: slug ? "pointer" : "default",
      color: isSelected ? "primary.main" : "grey.600",
      fontWeight: isSelected ? 600 : 400
    }}>
        {title}
      </Typography>;
  };

  const handleClearFilters = () => {
    router.push(pathname);
    setPriceRange([0, 5000]);
    setMinPriceInput("");
    setMaxPriceInput("");
  };

  const hasActiveFilters = searchParams.size > 0;

  return <div>
      {/* CATEGORIES FILTER */}
      <Typography variant="h6" sx={{ mb: 1.25 }}>
        الفئات
      </Typography>

      {CATEGORIES.map(item => item.children ? <Fragment key={item.slug || item.title}>
            <AccordionHeader open={collapsed} onClick={() => setCollapsed(state => !state)} sx={{
        padding: ".5rem 0",
        cursor: "pointer",
        color: "grey.600"
      }}>
              <Typography component="span" onClick={event => {
          event.stopPropagation();
          if (item.slug) handleSelectCategory(item.slug);
        }} sx={{
          color: selectedCategory === item.slug ? "primary.main" : "inherit",
          fontWeight: selectedCategory === item.slug ? 600 : 400
        }}>{item.title}</Typography>
            </AccordionHeader>

            <Collapse in={collapsed}>
              {item.children.map(child => <Box key={(typeof child === "string" ? child : child?.slug) || (typeof child === "string" ? child : child?.title)} pl="22px">
                  {renderCategoryItem(child)}
                </Box>)}
            </Collapse>
          </Fragment> : renderCategoryItem(item))}

      <Divider sx={{ my: 2 }} />

      {/* AVAILABILITY FILTER */}
      <Typography variant="h6" sx={{ mb: 1 }}>
        التوفر
      </Typography>
      <FormControlLabel
        label="متوفر في المخزون"
        control={<Checkbox
          size="small"
          color="success"
          checked={currentInStock}
          onChange={handleToggleInStock}
        />}
        sx={{ display: "flex", "& .MuiFormControlLabel-label": { fontSize: 14 } }}
      />

      <Divider sx={{ my: 2 }} />

      {/* PRICE RANGE FILTER */}
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        نطاق السعر
      </Typography>

      <Stack direction="row" spacing={1} mb={1.5}>
        <TextField
          size="small"
          type="number"
          label="من"
          value={minPriceInput}
          onChange={e => setMinPriceInput(e.target.value)}
          inputProps={{ min: 0 }}
          sx={{ flex: 1 }}
        />
        <TextField
          size="small"
          type="number"
          label="إلى"
          value={maxPriceInput}
          onChange={e => setMaxPriceInput(e.target.value)}
          inputProps={{ min: 0 }}
          sx={{ flex: 1 }}
        />
      </Stack>

      <Button size="small" variant="outlined" color="primary" onClick={handleApplyPriceFilter} fullWidth sx={{ mb: 0.5 }}>
        تطبيق السعر
      </Button>

      {BRANDS.length > 0 && <>
        <Divider sx={{ my: 2 }} />

        {/* BRAND FILTER */}
        <Typography variant="h6" sx={{ mb: 1 }}>
          الماركة / العلامة التجارية
        </Typography>

        {BRANDS.map(brand => {
          const isObj = brand && typeof brand === "object";
          const key = isObj ? brand.id : brand;
          const label = isObj ? brand.name : brand;
          const isSelected = isObj ? selectedBrandId === brand.id : selectedBrand === brand;
          return <FormControlLabel
            key={key}
            label={label}
            control={<Checkbox
              size="small"
              color="info"
              checked={isSelected}
              onChange={() => handleSelectBrand(brand)}
            />}
            sx={{ display: "flex", "& .MuiFormControlLabel-label": { fontSize: 14 } }}
          />;
        })}
      </>}

      {hasActiveFilters && <Button fullWidth disableElevation color="error" variant="contained" onClick={handleClearFilters} sx={{ mt: 3 }}>
          مسح الفلاتر
        </Button>}
    </div>;
}