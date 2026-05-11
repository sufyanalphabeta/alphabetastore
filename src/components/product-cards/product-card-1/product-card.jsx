import Link from "next/link";
import Rating from "@mui/material/Rating";
import IconButton from "@mui/material/IconButton";
import RemoveRedEye from "@mui/icons-material/RemoveRedEye";

// GLOBAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";

// LOCAL CUSTOM COMPONENTS
import AddToCart from "./add-to-cart";
import ProductPrice from "../product-price";
import ProductTitle from "../product-title";
import DiscountChip from "../discount-chip";
import FavoriteButton from "./favorite-button";

// STYLED COMPONENTS
import { ImageWrapper, ContentWrapper, StyledCard, HoverIconWrapper } from "./styles";

// CUSTOM DATA MODEL


// ========================================================


// ========================================================

export default function ProductCard1({
  product,
  showProductSize,
  showRating = true
}) {
  const {
    slug,
    title,
    price,
    thumbnail,
    rating,
    discount
  } = product;
  return <StyledCard>
      <ImageWrapper>
        {/* DISCOUNT PERCENT CHIP IF AVAILABLE */}
        <DiscountChip product={product} discount={discount} />

        {/* HOVER ACTION ICONS */}
        <HoverIconWrapper className="hover-box">
          <Link href={`/products/${slug}/view`} scroll={false}>
            <IconButton color="inherit">
              <RemoveRedEye fontSize="small" color="inherit" />
            </IconButton>
          </Link>

          <FavoriteButton />
        </HoverIconWrapper>

        {/* PRODUCT IMAGE / THUMBNAIL */}
        <Link href={`/products/${slug}`}>
          <LazyImage priority alt={title} width={500} height={500} src={thumbnail} className="thumbnail" />
        </Link>
      </ImageWrapper>

      <ContentWrapper>
        <div className="content">
          {/* PRODUCT NAME / TITLE */}
          <ProductTitle title={title} slug={slug} />

          {/* PRODUCT RATINGS IF AVAILABLE */}
          {showRating && <Rating size="small" value={rating} color="warn" readOnly />}

          {/* PRODUCT SIZE IF AVAILABLE */}
          {showProductSize ? <p className="size">Liter</p> : null}

          {/* PRODUCT PRICE WITH DISCOUNT */}
          <ProductPrice product={product} discount={discount} price={price} />
        </div>

        {/* ADD TO CART BUTTON */}
        <AddToCart product={product} />
      </ContentWrapper>
    </StyledCard>;
}