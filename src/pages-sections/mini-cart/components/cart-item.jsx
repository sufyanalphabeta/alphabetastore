import Link from "next/link";
import Image from "next/image";

// MUI
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";
import Add from "@mui/icons-material/Add";
import Remove from "@mui/icons-material/Remove";

// CUSTOM COMPONENTS
import Trash from "icons/Trash";
import FlexBox from "components/flex-box/flex-box";

// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";

// CUSTOM DATA MODEL

// STYLED COMPONENTS
const StyledRoot = styled("div")(({ theme }) => ({
  gap: "1rem",
  display: "flex",
  alignItems: "center",
  padding: "1rem 1.5rem",
  borderBottom: `1px dashed ${theme.palette.divider}`
}));
const StyledAvatar = styled(Avatar)(({ theme }) => ({
  width: 80,
  height: 80,
  borderRadius: 6,
  backgroundColor: theme.palette.grey[100]
}));
const ContentWrapper = styled("div")(() => ({
  flex: 1,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis"
}));
const QuantityWrapper = styled("div")(({ theme }) => ({
  gap: "0.5rem",
  display: "flex",
  alignItems: "center",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 6,
  "& .MuiButtonBase-root": {
    height: 24,
    width: 24,
    borderRadius: 6,
    "& svg": {
      fontSize: 16
    }
  }
}));

// ==============================================================

// ==============================================================

export default function MiniCartItem({ item, onCart }) {
  return (
    <StyledRoot>
      <Link href={`/products/${item.slug}`}>
        <StyledAvatar variant="rounded">
          <Image alt={item.title} src={item.thumbnail} fill sizes="(100px, 100px)" />
        </StyledAvatar>
      </Link>

      <ContentWrapper>
        <Typography noWrap variant="body1">
          {item.title}
        </Typography>

        {/* Variant summary */}
        {(item.variantName || item.variantAttributes) && (
          <Typography noWrap variant="caption" color="text.secondary" display="block">
            {item.variantName ||
              (item.variantAttributes && typeof item.variantAttributes === "object"
                ? Object.entries(item.variantAttributes)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")
                : null)}
          </Typography>
        )}

        <Typography
          variant="body1"
          fontWeight={500}
          sx={{
            mt: 0.25,
            mb: 1.5
          }}
        >
          {currency(item.price * item.qty)}
        </Typography>

        <FlexBox alignItems="center" justifyContent="space-between" gap={1}>
          <QuantityWrapper>
            <Button
              size="small"
              color="primary"
              variant="text"
              disabled={item.effectiveMaxQuantity <= 0 || item.qty >= item.effectiveMaxQuantity}
              onClick={onCart(item.qty + 1, item)}
            >
              <Add fontSize="small" />
            </Button>

            <Typography variant="body1" fontSize={13}>
              {item.qty}
            </Typography>

            <Button
              size="small"
              color="primary"
              variant="text"
              disabled={item.qty === 1}
              onClick={onCart(item.qty - 1, item)}
            >
              <Remove fontSize="small" />
            </Button>
          </QuantityWrapper>

          <IconButton size="small" onClick={onCart(0, item)}>
            <Trash
              sx={{
                fontSize: "1rem"
              }}
            />
          </IconButton>
        </FlexBox>
      </ContentWrapper>
    </StyledRoot>
  );
}
