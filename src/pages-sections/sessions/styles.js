"use client";

import Card from "@mui/material/Card";
import { styled } from "@mui/material/styles";

export const Wrapper = styled(Card)(({ theme }) => ({
  width: 500,
  padding: "2.5rem 3rem",
  border: `1px solid ${theme.palette.grey[200]}`,
  borderRadius: 16,
  boxShadow: "0 8px 40px rgba(0,0,0,0.10)",
  [theme.breakpoints.down("sm")]: {
    width: "100%",
    padding: "2rem 1.5rem",
    borderRadius: 12,
  },
  ".agreement": {
    marginTop: 12,
    marginBottom: 24,
  },
  ".social-button": {
    fontWeight: 400,
    padding: "0.5rem 1rem",
    color: theme.palette.text.secondary,
    borderRadius: 8,
    "&:first-of-type": {
      marginBottom: "1rem",
    },
    "& svg": {
      fontSize: 16,
    },
  },
}));