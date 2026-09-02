"use client";

import Container from "@mui/material/Container";
import { styled } from "@mui/material/styles";

// CONSTANT VARIABLES
import { layoutConstant } from "utils/constants";
export const HeaderWrapper = styled("div")(({
  theme
}) => ({
  zIndex: 3,
  position: "relative",
  height: layoutConstant.headerHeight,
  transition: "height 250ms ease-in-out",
  background: theme.palette.background.paper,
  boxShadow: theme.shadows[2],
  borderBottom: `1px solid ${theme.palette.divider}`,
  [theme.breakpoints.down("sm")]: {
    height: layoutConstant.mobileHeaderHeight
  }
}));
export const StyledContainer = styled(Container)(({
  theme
}) => ({
  height: "100%",
  "& > div": {
    gap: 2,
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  "& .mobile-header": {
    display: "none"
  },
  [theme.breakpoints.down(1150)]: {
    "& .mobile-header": {
      display: "flex"
    },
    "& .main-header": {
      display: "none"
    }
  }
}));
