"use client";

import Link from "next/link";
import { styled } from "@mui/material/styles";
import IconButton from "@mui/material/IconButton";
export const StyledLink = styled(Link)(() => ({
  borderRadius: 4,
  display: "block",
  cursor: "pointer",
  position: "relative",
  padding: "0.4rem 0rem",
  ":hover": {
    textDecoration: "underline"
  }
}));
export const StyledFooter = styled("footer")(({
  theme
}) => ({
  color: "white",
  borderRadius: 12,
  padding: "2.5rem",
  marginBottom: "1rem",
  backgroundColor: theme.palette.secondary.dark,
  "& .links": {
    marginTop: "4rem",
    marginBottom: "1rem",
    [theme.breakpoints.down("sm")]: {
      marginTop: 0
    }
  },
  [theme.breakpoints.down("lg")]: {
    marginBottom: "5rem"
  }
}));
export const Heading = styled("h6")({
  fontSize: 18,
  lineHeight: 1,
  fontWeight: 500,
  marginBottom: 12
});
export const StyledIconButton = styled(IconButton, {
  shouldForwardProp: prop => prop !== "variant"
})(({
  variant,
  theme
}) => ({
  margin: 4,
  fontSize: 16,
  borderRadius: 6,
  padding: "10px",
  transition: "all 0.3s ease",
  ".icon": {
    color: "white"
  },
  ...(variant === "light" && {
    backgroundColor: theme.palette.grey[900],
    ":hover": {
      backgroundColor: theme.palette.common.white,
      ".icon": {
        color: theme.palette.grey[900]
      }
    }
  }),
  ...(variant === "dark" && {
    backgroundColor: theme.palette.grey[900],
    ":hover": {
      backgroundColor: theme.palette.grey[700]
    }
  })
}));
export const AppItem = styled("div")(({ theme }) => ({
  gap: 8,
  margin: 8,
  color: "white",
  display: "flex",
  borderRadius: 8,
  padding: "12px 16px",
  alignItems: "center",
  backgroundColor: theme.palette.primary.dark,
  "& .title": {
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: 1.3
  },
  "& .subtitle": {
    lineHeight: 1,
    fontSize: "8px"
  }
}));
