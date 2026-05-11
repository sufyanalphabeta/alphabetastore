import Link from "next/link";

// GLOBAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";

// LOCAL CUSTOM COMPONENTS
import ProductPrice from "../product-price";
import ProductTitle from "../product-title";
import DiscountChip from "../discount-chip";
import ProductRating from "../product-rating";
import HoverActions from "./hover-actions";
import ButtonActions from "./button-actions";

// STYLED COMPONENTS
import { ContentWrapper, ImageBox, ImageWrapper, StyledCard } from "./styles";

// CUSTOM DATA MODEL


// =============================================================


// =============================================================

export default function ProductCard5({
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
  return <StyledCard elevation={0}>
      <ImageWrapper>
        <DiscountChip product={product} discount={discount} sx={{
        left: 0,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0
      }} />

        <ImageBox>
          <Link href={`/products/${slug}`}>
            <LazyImage alt={title} src={thumbnail} width={150} height={150} />
          </Link>

          <HoverActions product={product} />
        </ImageBox>
      </ImageWrapper>

      <ContentWrapper>
        <ProductTitle slug={slug} title={title} />

        <ProductRating rating={rating} />

        <ProductPrice product={product} discount={discount} price={price} />

        <ButtonActions product={product} />
      </ContentWrapper>
    </StyledCard>;
}