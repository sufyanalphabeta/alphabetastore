"use client";

import Link from "next/link";
import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";
export const MainContainer = styled(Card)(({
  theme
}) => ({
  border: "1px solid #E2E8F0",
  borderRadius: 16,
  boxShadow: "0 8px 24px rgba(15, 23, 42, .06)",
  backgroundColor: "#FFFFFF",
  paddingBottom: "1rem",
  [theme.breakpoints.down("md")]: {
    boxShadow: "none",
    overflow: "visible",
    height: "auto",
    maxHeight: "none"
  }
}));
export const StyledLink = styled(Link, {
  shouldForwardProp: prop => prop !== "isActive"
})(({
  theme,
  isActive
}) => ({
  display: "flex",
  alignItems: "center",
  margin: ".25rem .75rem",
  padding: ".7rem 1rem",
  borderRadius: 12,
  borderLeft: "none",
  borderRight: "3px solid transparent",
  borderLeft: "3px solid transparent",
  justifyContent: "space-between",
  transition: "all 0.2s ease-in-out",
  color: "#64748B",
  ".title": {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1)
  },
  ":hover": {
    color: theme.palette.primary.main,
    borderColor: "#2563EB",
    backgroundColor: "#F1F5F9",
    ".nav-icon": {
      color: theme.palette.primary.main
    }
  },
  ...(isActive && {
    color: "#2563EB",
    borderColor: "#2563EB",
    backgroundColor: "#DBEAFE",
    fontWeight: 700,
    "& .nav-icon": {
      color: theme.palette.primary.main
    }
  })
}));
