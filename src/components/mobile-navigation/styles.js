import Drawer from "@mui/material/Drawer";
import { styled } from "@mui/material/styles";
import { NavLink } from "components/nav-link";
import { layoutConstant } from "utils/constants";


// STYLED COMPONENTS
const Wrapper = styled("div")(({
  theme
}) => ({
  left: 0,
  right: 0,
  bottom: 0,
  display: "none",
  position: "fixed",
  justifyContent: "space-around",
  zIndex: theme.zIndex.drawer + 1,
  height: layoutConstant.mobileNavHeight,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[3],
  borderTop: `2px solid ${theme.palette.primary.main}`,
  [theme.breakpoints.down("lg")]: {
    display: "flex",
    width: "100vw"
  }
}));
const StyledNavLink = styled(NavLink)({
  flex: "1 1 0",
  display: "flex",
  fontSize: "13px",
  alignItems: "center",
  flexDirection: "column",
  justifyContent: "center",
  "& .icon": {
    display: "flex",
    marginBottom: "4px",
    alignItems: "center",
    justifyContent: "center"
  }
});
const StyledBox = styled("div")(({
  theme
}) => ({
  flex: "1 1 0",
  display: "flex",
  fontSize: "13px",
  cursor: "pointer",
  alignItems: "center",
  flexDirection: "column",
  justifyContent: "center",
  transition: "color 150ms ease-in-out",
  "&:hover": {
    color: `${theme.palette.primary.main} !important`
  }
}));
const StyledDrawer = styled(Drawer)(({
  theme
}) => ({
  width: 250,
  zIndex: 1501,
  flexShrink: 0,
  "& .MuiDrawer-paper": {
    width: 250,
    boxSizing: "border-box",
    boxShadow: theme.shadows[2]
  }
}));
export { Wrapper, StyledBox, StyledNavLink, StyledDrawer };
