import Link from "next/link";

// LOCAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";

// LOCAL CUSTOM COMPONENTS
import HoverActions from "./hover-actions";
import ProductTitle from "../product-title";
import ProductPrice from "../product-price";
import DiscountChip from "../discount-chip";
import ProductRating from "../product-rating";

// STYLED COMPONENTS
import { ContentWrapper, ImgBox, StyledRoot } from "./styles";

// CUSTOM DATA MODEL


// ============================================================


// ============================================================

export default function ProductCard6({
  hideRating,
  product
}) {
  const {
    discount,
    slug,
    title,
    price,
    thumbnail,
    rating
  } = product;
  return <StyledRoot>
      <ImgBox>
        {/* DISCOUNT PERCENT CHIP IF AVAILABLE */}
        <DiscountChip product={product} discount={discount} shape="square" />

        {/* PRODUCT IMAGE / THUMBNAIL */}
        <Link href={`/products/${slug}`}>
          <LazyImage alt={title} width={550} height={550} src={thumbnail} style={{
          height: 190,
          objectFit: "contain",
          display: "block"
        }} />
        </Link>

        {/* HOVER ACTION ICONS */}
        <HoverActions product={product} />
      </ImgBox>

      <ContentWrapper>
        {/* PRODUCT PRICE WITH DISCOUNT */}
        <ProductPrice product={product} discount={discount} price={price} />

        {/* PRODUCT NAME / TITLE */}
        <ProductTitle slug={slug} title={title} />

        {/* PRODUCT RATINGS IF AVAILABLE */}
        <ProductRating rating={rating} showRating={!hideRating} />
      </ContentWrapper>
    </StyledRoot>;
}