import Link from "next/link";

// LOCAL CUSTOM COMPONENTS
import DiscountChip from "../discount-chip";

// GLOBAL CUSTOM COMPONENTS
import LazyImage from "components/LazyImage";

// CUSTOM UTILS LIBRARY FUNCTIONS
import { calculateDiscount, currency } from "lib";

// STYLED COMPONENTS
import { CardRoot, PriceText } from "./styles";

// CUSTOM DATA MODEL


// ==============================================================


// ==============================================================

export default function ProductCard13({
  product
}) {
  const {
    title,
    thumbnail,
    price,
    discount,
    slug
  } = product;
  return <CardRoot elevation={0}>
      <Link href={`/products/${slug}`}>
        {/* SALE CHIP */}
        <DiscountChip product={product} discount={discount} sx={{
        top: 15,
        left: 15
      }} />

        {/* PRODUCT IMAGE */}
        <LazyImage alt={title} width={380} height={379} src={thumbnail} />

        <div className="content">
          <p className="tag">Supplies</p>
          <h4 className="title">{title}</h4>

          <PriceText>
            {calculateDiscount(price, discount)}
            {discount ? <span>{currency(price)}</span> : null}
          </PriceText>
        </div>
      </Link>
    </CardRoot>;
}