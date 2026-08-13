import Link from "next/link";
import Image from "next/image";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Add from "@mui/icons-material/Add";
import Remove from "@mui/icons-material/Remove";
import Trash from "icons/Trash";
import useCart from "hooks/useCart";
import { currency } from "lib";
import { ContentWrapper, ImageWrapper, QuantityButton, Wrapper } from "./styles";

// =========================================================

// =========================================================

export default function CartItem({ item }) {
  const {
    id,
    productId,
    title,
    price,
    thumbnail,
    slug,
    qty,
    variantId,
    variantName,
    variantAttributes,
    effectiveMaxQuantity,
    availabilityChanged
  } = item;
  const { dispatch } = useCart();

  const handleCartAmountChange = (amount) => () => {
    dispatch({
      type: "CHANGE_CART_AMOUNT",
      payload: {
        id,
        productId,
        title,
        price,
        thumbnail,
        slug,
        qty: amount,
        variantId: variantId ?? null
      }
    });
  };

  // Build a human-readable variant summary from attributes object
  const variantSummary = variantName
    ? variantName
    : variantAttributes && typeof variantAttributes === "object"
      ? Object.entries(variantAttributes)
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · ")
      : null;

  return (
    <Wrapper elevation={0}>
      <ImageWrapper>
        <Image alt={title} fill src={thumbnail} sizes="100px" />
      </ImageWrapper>

      <ContentWrapper>
        <Stack spacing={0.5} overflow="hidden">
          <Link href={`/products/${slug}`}>
            <Typography noWrap variant="body1" fontSize={16}>
              {title}
            </Typography>
          </Link>

          {variantSummary && (
            <Typography noWrap variant="caption" color="text.secondary">
              {variantSummary}
            </Typography>
          )}

          <Typography noWrap variant="body1" fontWeight={600}>
            {currency(price)}
          </Typography>
        </Stack>

        <div className="quantity-buttons-wrapper">
          <QuantityButton disabled={qty === 1} onClick={handleCartAmountChange(qty - 1)}>
            <Remove fontSize="small" />
          </QuantityButton>

          <Typography variant="h6">{qty}</Typography>

          <QuantityButton
            disabled={effectiveMaxQuantity <= 0 || qty >= effectiveMaxQuantity}
            onClick={handleCartAmountChange(qty + 1)}
          >
            <Add fontSize="small" />
          </QuantityButton>
        </div>

        {availabilityChanged ? (
          <Typography variant="caption" color="warning.main">
            الكمية الحالية غير متوفرة؛ خفّضها إلى {effectiveMaxQuantity}.
          </Typography>
        ) : null}

        <Typography noWrap variant="body1" fontSize={16} fontWeight={600}>
          {currency(price * qty)}
        </Typography>

        <IconButton className="remove-item" size="small" onClick={handleCartAmountChange(0)}>
          <Trash fontSize="small" color="error" />
        </IconButton>
      </ContentWrapper>
    </Wrapper>
  );
}
