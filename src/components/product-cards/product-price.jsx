"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";

// HOOKS + UTILS
import useSettings from "hooks/useSettings";
import { computeProductPrice } from "lib";
import { formatStoreCurrency } from "utils/currency";


// ==============================================================
// ProductPrice — supports both the new pricing-engine fields and
// the legacy "discount" integer prop for backward compatibility.
// ==============================================================

export default function ProductPrice({ product, discount, price }) {
  const { settings } = useSettings();

  // New pricing engine: product object with baseCurrency / discountType etc.
  if (product && (product.discountType !== undefined || product.baseCurrency !== undefined)) {
    const computed = computeProductPrice(product, settings);

    return (
      <FlexBox alignItems="center" gap={1} mt={0.5}>
        <Typography color="primary" fontWeight={600}>
          {computed.finalFormatted}
        </Typography>

        {computed.hasActiveDiscount && (
          <Box component="del" fontSize={12} fontWeight={500} color="grey.400">
            {computed.baseFormatted}
          </Box>
        )}

        {!computed.hasActiveDiscount && computed.comparePrice != null && (
          <Box component="del" fontSize={12} fontWeight={500} color="grey.400">
            {computed.compareFormatted}
          </Box>
        )}
      </FlexBox>
    );
  }

  // Legacy fallback: plain price + discount percent
  const legacyDiscount = Number(discount) || 0;
  const legacyPrice = Number(price) || 0;
  const afterDiscount = Number((legacyPrice - legacyPrice * (legacyDiscount / 100)).toFixed(2));

  return (
    <FlexBox alignItems="center" gap={1} mt={0.5}>
      <Typography color="primary" fontWeight={600}>
        {formatStoreCurrency(afterDiscount)}
      </Typography>

      {legacyDiscount > 0 && (
        <Box component="del" fontSize={12} fontWeight={500} color="grey.400">
          {formatStoreCurrency(legacyPrice)}
        </Box>
      )}
    </FlexBox>
  );
}
