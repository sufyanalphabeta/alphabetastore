"use client";

import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import { styled } from "@mui/material/styles";
export const StyledRoot = styled("div", {
  shouldForwardProp: prop => prop !== "bgColor"
})(({
  theme,
  bgColor
}) => ({
  fontSize: 12,
  paddingBlock: 10,
  color: theme.palette.secondary.contrastText,
  background: bgColor || theme.palette.secondary.main
}));
export const StyledContainer = styled(Container)(() => ({
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem"
}));
export const StyledChip = styled(Chip)(({
  theme
}) => ({
  color: "white",
  fontWeight: 600,
  backgroundColor: theme.palette.primary.main,
  "& .MuiChip-label": {
    paddingInline: ".8rem"
  }
}));
export const LeftContent = styled("div")(() => ({
  overflow: "hidden",
  ".tag": {
    fontSize: 13,
    gap: ".5rem",
    display: "flex",
    alignItems: "center"
  },
  span: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis"
  }
}));
export const RightContent = styled("div")(() => ({
  gap: "1rem",
  flexShrink: 0,
  display: "flex",
  alignItems: "center"
}));
