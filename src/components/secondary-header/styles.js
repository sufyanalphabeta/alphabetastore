"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import { styled } from "@mui/material/styles";
import Container from "@mui/material/Container";

// GLOBAL CUSTOM COMPONENTS
import { NavLink } from "components/nav-link";


// COMMON STYLED OBJECT
export const NAV_LINK_STYLES = {
  fontWeight: 500,
  cursor: "pointer",
  transition: "color 150ms ease-in-out",
  "&:hover": {
    color: "primary.main"
  },
  "&:last-child": {
    marginRight: 0
  }
};
export const StyledNavLink = styled(NavLink)({
  ...NAV_LINK_STYLES
});
export const ParentNav = styled(Box, {
  shouldForwardProp: prop => prop !== "active"
})(({
  theme,
  active
}) => ({
  position: "relative",
  ...(active && {
    color: theme.palette.primary.main
  }),
  "& .arrow": {
    fontSize: ".875rem"
  },
  ":dir(rtl) .arrow": {
    transform: "rotate(180deg)"
  },
  "&:hover": {
    color: theme.palette.primary.main,
    "& > .parent-nav-item": {
      display: "block"
    }
  }
}));
export const ParentNavItem = styled("div", {
  shouldForwardProp: prop => prop !== "right"
})(({
  right
}) => ({
  top: 0,
  zIndex: 5,
  left: "100%",
  paddingLeft: 8,
  display: "none",
  position: "absolute",
  ...(right && {
    right: "100%",
    left: "auto",
    paddingRight: 8
  })
}));
export const StyledRoot = styled(Card, {
  shouldForwardProp: prop => prop !== "border"
})(({
  theme,
  border
}) => ({
  height: "58px",
  display: "block",
  overflow: "unset",
  borderRadius: "0px",
  background: "#263d66",
  color: theme.palette.common.white,
  position: "relative",
  ...(border && {
    borderBottom: `1px solid ${theme.palette.grey[100]}`
  }),
  [theme.breakpoints.down(1150)]: {
    display: "none"
  }
}));
export const InnerContainer = styled(Container)(() => ({
  gap: "1.5rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between"
}));
export const CategoryMenuButton = styled(Button)(({
  theme
}) => ({
  width: 278,
  borderRadius: 4,
  backgroundColor: "rgba(255,255,255,0.12)",
  color: theme.palette.common.white,
  paddingBlock: 8,
  ".prefix": {
    gap: 8,
    flex: 1,
    display: "flex",
    alignItems: "center",
    ".icon": {
      fontSize: 16,
      color: theme.palette.primary.main
    }
  },
  ".dropdown-icon": {
    fontSize: 16,
    color: theme.palette.grey[400],
    ...(theme.direction === "rtl" && {
      rotate: "180deg"
    })
  }
}));
export const ChildNavListWrapper = styled("div")({
  zIndex: 5,
  left: "50%",
  top: "100%",
  display: "none",
  position: "absolute",
  transform: "translate(-50%, 0%)"
});
