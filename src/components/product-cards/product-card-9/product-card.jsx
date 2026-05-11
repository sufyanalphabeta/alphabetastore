import Link from "next/link";
import Rating from "@mui/material/Rating";
import Typography from "@mui/material/Typography";

// GLOBAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";

// LOCAL CUSTOM COMPONENTS
import DiscountChip from "../discount-chip";
import ProductPrice from "../product-price";
import ProductTags from "./components/tags";
import AddToCartButton from "./components/add-to-cart";
import FavoriteButton from "./components/favorite-button";

// CUSTOM DATA MODEL


// STYLED COMPONENT
import { ContentWrapper, Wrapper } from "./styles";


// ===========================================================


// ===========================================================

export default function ProductCard9({
  product
}) {
  const {
    thumbnail,
    title,
    price,
    discount,
    rating,
    slug
  } = product;
  return <Wrapper>
      {/* PRODUCT FAVORITE BUTTON */}
      <FavoriteButton productId={product.id} />

      <ContentWrapper>
        <div className="img-wrapper">
          {/* DISCOUNT PERCENT CHIP IF AVAILABLE */}
          <DiscountChip product={product} discount={discount} />

          {/* PRODUCT IMAGE / THUMBNAIL */}
          <LazyImage src={thumbnail} alt={title} width={500} height={500} />
        </div>

        <div className="content">
          <div>
            {/* PRODUCT TAG LIST */}
            <ProductTags tags={["Bike", "Motor", "Ducati"]} />

            {/* PRODUCT TITLE / NAME */}
            <Link href={`/products/${slug}`}>
              <Typography variant="h5" sx={{
              mt: 1,
              mb: 2
            }}>
                {title}
              </Typography>
            </Link>

            {/* PRODUCT RATING / REVIEW  */}
            <Rating size="small" value={rating} color="warn" readOnly />

            {/* PRODUCT PRICE */}
            <ProductPrice product={product} price={price} discount={discount} />
          </div>

          {/* PRODUCT ADD TO CART BUTTON */}
          <AddToCartButton product={product} />
        </div>
      </ContentWrapper>
    </Wrapper>;
}