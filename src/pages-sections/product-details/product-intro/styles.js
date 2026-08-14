"use client";

import { styled } from "@mui/material/styles";

export const StyledRoot = styled("section")(({ theme }) => ({
  width: "100%",
  padding: theme.spacing(3),
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1.5),
  backgroundColor: theme.palette.background.paper,
  "& .product-intro-layout": {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)",
    alignItems: "start",
    gap: theme.spacing(4)
  },
  "& h1": {
    fontSize: "clamp(1.6rem, 3vw, 2.35rem)",
    lineHeight: 1.3
  },
  "& strong": { fontWeight: 700 },
  "& .purchase-panel": {
    marginTop: theme.spacing(1),
    padding: theme.spacing(2),
    borderRadius: theme.spacing(1),
    backgroundColor: theme.palette.grey[50],
    border: `1px solid ${theme.palette.divider}`
  },
  "& .variant-group": {
    gap: "0.5rem",
    display: "flex",
    alignItems: "center",
    "& .MuiChip-root": { height: 28, cursor: "pointer", borderRadius: "6px" }
  },
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(1.5),
    "& h1": { fontSize: "1.55rem" }
  },
  "@media (max-width: 767px)": {
    "& .product-intro-layout": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: theme.spacing(2.5)
    }
  }
}));

export const ProductImageWrapper = styled("button")(({ theme }) => ({
  width: "100%",
  aspectRatio: "1 / 1",
  maxHeight: 520,
  display: "flex",
  overflow: "hidden",
  position: "relative",
  justifyContent: "center",
  borderRadius: theme.spacing(1),
  backgroundColor: theme.palette.common.white,
  border: `1px solid ${theme.palette.divider}`,
  cursor: "zoom-in",
  padding: 0,
  "& img": { objectFit: "contain" },
  [theme.breakpoints.down("sm")]: { maxHeight: 340 },
  "@media (min-width: 768px) and (max-width: 899px)": { maxHeight: 420 }
}));

export const PreviewList = styled("div")(({ theme }) => ({
  overflowX: "auto",
  overflowY: "hidden",
  display: "flex",
  gap: theme.spacing(1),
  justifyContent: "center",
  padding: theme.spacing(1, 0, 0.5),
  scrollbarWidth: "thin",
  [theme.breakpoints.down("sm")]: { justifyContent: "flex-start" }
}));

export const PreviewImage = styled("button", {
  shouldForwardProp: prop => prop !== "selected"
})(({ theme, selected }) => ({
  flex: "0 0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "10px",
  overflow: "hidden",
  width: 64,
  height: 64,
  padding: 0,
  cursor: "pointer",
  position: "relative",
  backgroundColor: theme.palette.common.white,
  opacity: selected ? 1 : 0.62,
  transition: "all 0.2s ease-in-out",
  border: `2px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
  "& img": { objectFit: "contain" },
  "&:focus-visible": { outline: `3px solid ${theme.palette.primary.light}`, outlineOffset: 2 }
}));
