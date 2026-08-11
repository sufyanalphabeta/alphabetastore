import Link from "next/link";
import Image from "next/image";
import Box from "@mui/material/Box";

// CUSTOM COMPONENT
import LazyImage from "components/LazyImage";
import { HeaderCategoryDropdown } from "./header-category-dropdown";

// STYLED COMPONENTS
import { HeaderWrapper, StyledContainer } from "./styles";

// DEFAULT ALPHABETA ICON
import alphabetaIcon from "../../../public/assets/images/alphabeta-icon.svg";


// ==============================================================


// ==============================================================

export function Header({
  children,
  mobileHeader,
  ...props
}) {
  return <HeaderWrapper {...props}>
      <StyledContainer>
        <div className="main-header">{children}</div>
        <div className="mobile-header">{mobileHeader}</div>
      </StyledContainer>
    </HeaderWrapper>;
}


// ==============================================================


// ==============================================================

Header.Left = function ({
  children,
  ...props
}) {
  return <Box display="flex" minWidth={100} alignItems="center" {...props}>
      {children}
    </Box>;
};


// ==============================================================


// ==============================================================

Header.Logo = function ({
  url,
  siteName
}) {
  if (url) {
    return <Link href="/">
        <LazyImage priority src={url} alt={siteName || "logo"} width={105} height={50} sizes="(max-width: 768px) 80px, 105px" sx={{
        objectFit: "contain"
      }} />
      </Link>;
  }
  return (
    <Link href="/" style={{ textDecoration: "none" }}>
      <Box display="flex" alignItems="center" gap={1}>
        <Image src={alphabetaIcon} alt="Alphabeta Store" width={36} height={36} style={{ objectFit: "contain" }} />
        <Box sx={{ fontWeight: 700, fontSize: "1.1rem", color: "primary.main", whiteSpace: "nowrap" }}>
          {siteName || "Alphabeta Store"}
        </Box>
      </Box>
    </Link>
  );
};
Header.CategoryDropdown = function ({
  children
}) {
  return <HeaderCategoryDropdown>{children}</HeaderCategoryDropdown>;
};
Header.Mid = function ({
  children
}) {
  return children;
};


// ==============================================================


// ==============================================================

Header.Right = function ({
  children,
  ...props
}) {
  return <Box {...props}>{children}</Box>;
};