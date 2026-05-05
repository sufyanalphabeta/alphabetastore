"use client";

import Link from "next/link";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ArrowForward from "@mui/icons-material/ArrowForward";
import { styled } from "@mui/material/styles";

// STYLED COMPONENTS
const StyledCard = styled(Link)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing(1.25),
  padding: theme.spacing(2.5, 1.5),
  borderRadius: 12,
  textDecoration: "none",
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  transition: "all 0.2s ease",
  cursor: "pointer",
  "&:hover": {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.primary.lighter || theme.palette.action.hover,
    transform: "translateY(-2px)",
    boxShadow: theme.shadows[4],
    ".icon-box": { color: theme.palette.primary.main },
    ".arrow-icon": { opacity: 1, transform: "translateX(0)" },
  },
}));

const IconBox = styled(Box)(({ theme }) => ({
  width: 56,
  height: 56,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  backgroundColor: theme.palette.grey[100],
  color: theme.palette.grey[700],
  transition: "color 0.2s ease",
  fontSize: 28,
  span: { fontSize: "inherit", fontVariationSettings: "'wght' 300" },
}));

// ==============================================================

export default function Card({ name, icon, link }) {
  return (
    <StyledCard href={link} aria-label={`Go to ${name} category`}>
      <IconBox className="icon-box">
        {icon ? (
          <span className="material-symbols-outlined">{icon}</span>
        ) : (
          <span className="material-symbols-outlined">category</span>
        )}
      </IconBox>

      <Typography
        variant="body2"
        fontWeight={600}
        textAlign="center"
        color="text.primary"
        sx={{ lineHeight: 1.3, fontSize: 13 }}
      >
        {name}
      </Typography>
    </StyledCard>
  );
}
