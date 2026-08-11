import Link from "next/link";
import Image from "next/image";
import Box from "@mui/material/Box";

// DEFAULT ALPHABETA ICON
import alphabetaIcon from "../../../../public/assets/images/alphabeta-icon.svg";


// ==============================================================


// ==============================================================

export function MobileHeader({
  children,
  ...props
}) {
  return <Box display="flex" alignItems="center" justifyContent="space-between" width="100%" {...props}>
      {children}
    </Box>;
}


// ==================================================================


// ==================================================================

MobileHeader.Left = function ({
  children,
  ...props
}) {
  return <Box flex={1} {...props}>
      {children}
    </Box>;
};
MobileHeader.Logo = function ({
  logoUrl,
  siteName
}) {
  if (logoUrl) {
    return <Link href="/">
        <Image width={60} height={44} src={logoUrl} alt={siteName || "logo"} style={{ objectFit: "contain" }} />
      </Link>;
  }
  return (
    <Link href="/" style={{ textDecoration: "none" }}>
      <Image src={alphabetaIcon} alt="Alphabeta Store" width={38} height={38} style={{ objectFit: "contain" }} />
    </Link>
  );
};


// ==================================================================


// ==================================================================

MobileHeader.Right = function ({
  children,
  ...props
}) {
  return <Box display="flex" justifyContent="end" flex={1} {...props}>
      {children}
    </Box>;
};