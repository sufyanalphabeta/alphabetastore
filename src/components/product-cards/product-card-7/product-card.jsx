import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

// GLOBAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";

// LOCAL CUSTOM COMPONENTS
import ProductPrice from "../product-price";
import DiscountChip from "../discount-chip";
import AddToCart from "./add-to-cart";
import ProductStatus from "./product-status";

// STYLED COMPONENTS
import { StyledCard, ContentWrapper, ImageWrapper, ColorsWrapper } from "./styles";

// CUSTOM DATA MODEL


// =======================================================


// =======================================================

export default function ProductCard7({
  product
}) {
  const {
    discount,
    status,
    title,
    price,
    thumbnail,
    colors,
    slug
  } = product;
  return <StyledCard>
      <Link href={`/products/${slug}`}>
        <ImageWrapper>
          {/* PRODUCT BADGE STATUS IF STATUS AVAILABLE */}
          <ProductStatus status={status} />

          {/* DISCOUNT PERCENT CHIP IF AVAILABLE */}
          <DiscountChip product={product} discount={discount} shape="square" />

          {/* PRODUCT IMAGE / THUMBNAIL */}
          <div className="img-wrapper">
            <LazyImage alt={title} width={300} height={273} src={thumbnail} />
          </div>
        </ImageWrapper>
      </Link>

      <ContentWrapper>
        <div className="content">
          {/* PRODUCT TITLE / NAME */}
          <Link href={`/products/${slug}`}>
            <Typography noWrap variant="h3">
              {title}
            </Typography>
          </Link>

          {/* PRODUCT COLORS */}
          {colors?.length ? <ColorsWrapper>
              {colors.map((color, ind) => <Box key={ind} bgcolor={color} />)}
            </ColorsWrapper> : null}

          {/* PRODUCT PRICE WITH DISCOUNT */}
          <ProductPrice product={product} discount={discount} price={price} />
        </div>

        {/* ADD TO CART BUTTON */}
        <AddToCart product={product} />
      </ContentWrapper>
    </StyledCard>;
}