import Link from "next/link";

// GLOBAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";

// LOCAL CUSTOM COMPONENTS
import AddToCart from "./add-to-cart";
import HoverActions from "./hover-actions";
import DiscountChip from "../discount-chip";
import ProductPrice from "../product-price";
import ProductTitle from "../product-title";
import ProductRating from "../product-rating";

// STYLED COMPONENTS
import { ContentWrapper, ImageWrapper, StyledCard } from "./styles";

// CUSTOM DATA MODEL


// ===============================================================


// ===============================================================

export default function ProductCard4({
  product
}) {
  const {
    discount,
    title,
    price,
    thumbnail,
    rating,
    slug
  } = product;
  return <StyledCard>
      <ImageWrapper>
        {/* DISCOUNT PERCENT CHIP IF AVAILABLE */}
        <DiscountChip product={product} discount={discount} />

        {/* PRODUCT IMAGE / THUMBNAIL */}
        <Link href={`/products/${slug}`}>
          <LazyImage alt={title} src={thumbnail} width={450} height={450} />
        </Link>

        {/* HOVER ACTION ICONS */}
        <HoverActions product={product} />
      </ImageWrapper>

      <ContentWrapper>
        <div className="content">
          {/* PRODUCT NAME / TITLE */}
          <ProductTitle title={title} slug={slug} />

          {/* PRODUCT RATING / REVIEW  */}
          <ProductRating my={1} rating={rating} />

          {/* PRODUCT PRICE WITH DISCOUNT */}
          <ProductPrice product={product} discount={discount} price={price} />
        </div>

        {/* ADD TO CART BUTTON */}
        <AddToCart product={product} />
      </ContentWrapper>
    </StyledCard>;
}