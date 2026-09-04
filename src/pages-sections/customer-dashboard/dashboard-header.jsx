"use client";

import Link from "next/link";

// MUI
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import { styled } from "@mui/material/styles";
import Menu from "@mui/icons-material/Menu";
import ChevronLeft from "@mui/icons-material/ChevronLeft";

// GLOBAL CUSTOM COMPONENTS
import SideNav from "components/side-nav";
import { Navigation } from "components/layouts/customer-dashboard";


// STYLED COMPONENT
const StyledRoot = styled("div")(({
  theme
}) => ({
  gap: "1rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "1.5rem",
  ".left": {
    gap: ".75rem",
    display: "flex",
    alignItems: "center"
  },
  ".avatar": {
    width: 35,
    height: 35,
    backgroundColor: theme.palette.grey[100]
  },
  [theme.breakpoints.up("lg")]: {
    ".right": {
      display: "none"
    }
  },
  [theme.breakpoints.down("lg")]: {
    ".right": {
      display: "none"
    }
  },
  [theme.breakpoints.down("sm")]: {
    marginBottom: "1rem"
  }
}));


// ==============================================================


// ==============================================================

export default function DashboardHeader({
  title,
  href,
  Icon
}) {
  return <StyledRoot>
      <div className="left">
        {Icon && <Avatar variant="rounded" className="avatar">
            <Icon color="primary" />
          </Avatar>}

        {href && <IconButton color="primary" href={href} LinkComponent={Link}>
            <ChevronLeft />
          </IconButton>}

        <Typography noWrap variant="h2">
          {title}
        </Typography>
      </div>

      {/* SHOW ONLY SMALL DEVICE */}
      <div className="right">
        <SideNav position="left" handler={close => <IconButton onClick={close}>
              <Menu fontSize="small" />
            </IconButton>}>
          <Navigation />
        </SideNav>
      </div>
    </StyledRoot>;
}
