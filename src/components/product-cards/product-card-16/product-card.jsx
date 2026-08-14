import Link from "next/link";
import Rating from "@mui/material/Rating";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// GLOBAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";
import WishlistToggleButton from "components/wishlist/wishlist-toggle-button";

// LOCAL CUSTOM COMPONENTS
import AddToCart from "./add-to-cart";
import DiscountChip from "../discount-chip";

// CUSTOM UTILS LIBRARY FUNCTIONS
import ProductPrice from "../product-price";

// STYLED COMPONENTS
import { StyledRoot } from "./styles";

// CUSTOM DATA MODEL


// ==============================================================


// ==============================================================

export default function ProductCard16({
  product
}) {
  const { slug, title, thumbnail, discount, rating, ratingCount } = product;
  const brandName = product.brandRef?.name || product.brand || "";
  const inStock = product.inStock ?? product.availability !== "OUT_OF_STOCK";
  return <StyledRoot>
      <Link href={`/products/${slug}`}>
        <div className="img-wrapper">
          <div className="wishlist-btn">
            <WishlistToggleButton productId={product.id} sx={{
            backgroundColor: "common.white",
            boxShadow: 1
          }} />
          </div>

          <LazyImage alt={title} width={380} height={379} src={thumbnail} />
          {discount ? <DiscountChip product={product} discount={discount} sx={{
          left: 20,
          top: 20
        }} /> : null}
        </div>
      </Link>

      <div className="content">
        <div className="details">
          {brandName ? <Typography className="brand" variant="caption">{brandName}</Typography> : null}
          <Link href={`/products/${slug}`}>
            <Typography className="title" variant="h6">
              {title}
            </Typography>
          </Link>

          {ratingCount > 0 ? <Box display="flex" alignItems="center" gap={0.5}>
              <Rating readOnly value={rating} size="small" precision={0.5} />
              <Typography variant="caption" color="text.secondary">({ratingCount})</Typography>
            </Box> : null}

          <ProductPrice product={product} price={product.price} discount={discount} />
          <Typography className={inStock ? "availability in-stock" : "availability out-of-stock"}>
            {inStock ? "متوفر" : "غير متوفر"}
          </Typography>
        </div>

        {/* ADD TO CART BUTTON */}
        <AddToCart product={product} />
      </div>
    </StyledRoot>;
}
