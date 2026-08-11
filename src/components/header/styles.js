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
  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
  boxShadow: "0 2px 14px rgba(13, 71, 161, 0.08)",
  borderBottom: "1px solid rgba(21, 101, 192, 0.08)",
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
