"use client";

import { useState } from "react";

// MUI
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import VariantsManager from "pages-sections/vendor-dashboard/variants/VariantsManager";
import PageWrapper from "pages-sections/vendor-dashboard/page-wrapper";
import ProductSearchPicker from "components/admin/ProductSearchPicker";

export default function AdminVariantsPage() {
  const [selectedProduct, setSelectedProduct] = useState(null);

  return (
    <PageWrapper title="Product Variants">
      <Box mb={3} maxWidth={500}>
        <ProductSearchPicker
          label="Search and select a product"
          value={selectedProduct}
          onChange={setSelectedProduct}
          helperText="Search by product name or SKU"
        />
      </Box>

      {selectedProduct ? (
        <VariantsManager productId={selectedProduct.id} productName={selectedProduct.name} />
      ) : (
        <Typography color="text.secondary" textAlign="center" py={6}>
          Search for a product above to manage its variants.
        </Typography>
      )}
    </PageWrapper>
  );
}

