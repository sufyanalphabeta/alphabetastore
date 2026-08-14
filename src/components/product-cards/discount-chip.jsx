"use client";

import Chip from "@mui/material/Chip";
import { styled } from "@mui/material/styles";

// HOOKS + UTILS
import useSettings from "hooks/useSettings";
import { buildPricingSettings, computeStorefrontPrice } from "utils/pricing";


// STYLED COMPONENT
const StyledChip = styled(Chip, {
  shouldForwardProp: prop => prop !== "shape"
})(({
  shape
}) => ({
  zIndex: 1,
  top: "15px",
  left: "15px",
  paddingLeft: 3,
  paddingRight: 3,
  fontWeight: 500,
  borderRadius: 8,
  fontSize: "10px",
  position: "absolute",
  ...(shape === "square" && {
    borderRadius: 0
  })
}));


// ==============================================================
// DiscountChip — supports both the new pricing-engine fields and
// the legacy "discount" integer prop for backward compatibility.
// ==============================================================

export default function DiscountChip({
  product,
  discount = 0,
  shape = "rounded",
  ...props
}) {
  const { settings } = useSettings();

  if (product?.storefrontPrice) {
    const percent = Number(product.storefrontPrice.discountPercent || 0);
    return product.storefrontPrice.hasActiveDiscount && percent > 0
      ? <StyledChip size="small" shape={shape} label={`خصم ${Math.round(percent)}%`} {...props} />
      : null;
  }

  // New pricing engine: compute actual discount % from product fields
  if (product && (product.discountType !== undefined || product.baseCurrency !== undefined)) {
    const pricingSettings = buildPricingSettings(settings);
    const computed = computeStorefrontPrice(product, pricingSettings);

    if (!computed.hasActiveDiscount || computed.discountPercent <= 0) return null;

    const label = `${Math.round(computed.discountPercent)}% off`;
    return <StyledChip size="small" shape={shape} label={label} {...props} />;
  }

  // Legacy fallback: plain discount percent integer
  return discount > 0
    ? <StyledChip size="small" shape={shape} label={`${discount}% off`} {...props} />
    : null;
}
