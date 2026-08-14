"use client";

import { styled } from "@mui/material/styles";
export const StyledRoot = styled("div")(({
  theme
}) => ({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  borderRadius: 12,
  overflow: "hidden",
  border: `1px solid ${theme.palette.divider}`,
  "&:hover .img-wrapper img": {
    scale: 1.1
  },
  "& .img-wrapper": {
    display: "flex",
    position: "relative",
    aspectRatio: "1 / 1",
    backgroundColor: theme.palette.grey[50],
    ".wishlist-btn": {
      top: 12,
      right: 12,
      zIndex: 2,
      position: "absolute"
    },
    img: {
      width: "100%",
      height: "100%",
      objectFit: "contain",
      padding: theme.spacing(1.5),
      transition: "0.3s"
    }
  },
  "& .content": {
    padding: "1rem",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: theme.spacing(1.25)
  },
  "& .details": {
    minWidth: 0
  },
  "& .brand": {
    color: theme.palette.text.secondary,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: ".04em"
  },
  "& .title": {
    minHeight: "2.8em",
    margin: theme.spacing(.5, 0),
    fontSize: 15,
    lineHeight: 1.4,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden"
  },
  "& .availability": {
    margin: theme.spacing(.75, 0, 0),
    fontSize: 12,
    fontWeight: 700
  },
  "& .in-stock": {
    color: theme.palette.success.main
  },
  "& .out-of-stock": {
    color: theme.palette.error.main
  },
  [theme.breakpoints.down("sm")]: {
    borderRadius: 10,
    "& .content": { padding: theme.spacing(1.25) },
    "& .title": { fontSize: 13, minHeight: "2.8em" },
    "& .wishlist-btn": { top: 6, right: 6 }
  }
}));
export const PriceText = styled("p")(({
  theme
}) => ({
  fontSize: 17,
  lineHeight: 1,
  fontWeight: 600,
  marginTop: ".75rem",
  color: theme.palette.primary.main,
  ".base-price": {
    fontSize: 13,
    marginLeft: 8,
    textDecoration: "line-through",
    color: theme.palette.grey[600]
  }
}));
