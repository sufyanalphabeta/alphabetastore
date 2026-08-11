import Link from "next/link";
import Image from "next/image";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import StorefrontOutlined from "@mui/icons-material/StorefrontOutlined";

// GLOBAL CUSTOM COMPONENT
import FlexBetween from "components/flex-box/flex-between";
import useSettings from "hooks/useSettings";

// LOCAL CUSTOM HOOK
import { useLayout } from "../dashboard-layout-context";

// STYLED COMPONENT
import { ChevronLeftIcon } from "./styles";

// DEFAULT ICON
import alphabetaIcon from "../../../../../public/assets/images/alphabeta-icon.svg";

export default function LogoArea() {
  const {
    TOP_HEADER_AREA,
    COMPACT,
    sidebarCompact,
    handleSidebarCompactToggle
  } = useLayout();
  const { settings } = useSettings();
  const logoUrl = settings?.site_logo_url?.trim() || "";
  const siteName = settings?.site_name || "Alphabeta Store";

  const logoElement = logoUrl ? (
    <Avatar alt={siteName} src={logoUrl} sx={{ borderRadius: 0, width: "auto", height: 36, marginLeft: COMPACT ? 0 : 1 }} />
  ) : (
    <Box display="flex" alignItems="center" gap={1} ml={COMPACT ? 0 : 1} overflow="hidden">
      <Image
        src={alphabetaIcon}
        alt="Alphabeta Store"
        width={32}
        height={32}
        style={{ objectFit: "contain", borderRadius: 6 }}
      />
      {!COMPACT && (
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "primary.main", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>
          {siteName}
        </Typography>
      )}
    </Box>
  );

  return (
    <Box>
      <FlexBetween p={2} maxHeight={TOP_HEADER_AREA} justifyContent={COMPACT ? "center" : "space-between"}>
        {logoElement}
        <ChevronLeftIcon color="disabled" compact={COMPACT} onClick={handleSidebarCompactToggle} sidebar_compact={sidebarCompact ? 1 : 0} />
      </FlexBetween>

      {/* Back-to-store shortcut */}
      <Tooltip title="Back to Store" placement="left">
        <Box
          component={Link}
          href="/market-1"
          display="flex"
          alignItems="center"
          gap={1}
          mx={2}
          mb={1}
          px={1.5}
          py={0.75}
          borderRadius={1.5}
          sx={{
            textDecoration: "none",
            color: "text.secondary",
            fontSize: 13,
            border: "1px dashed",
            borderColor: "grey.300",
            "&:hover": { bgcolor: "grey.100", color: "primary.main", borderColor: "primary.main" },
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          <StorefrontOutlined sx={{ fontSize: 18, flexShrink: 0 }} />
          {!COMPACT && <Typography variant="caption" fontWeight={600} noWrap>Back to Store</Typography>}
        </Box>
      </Tooltip>
    </Box>
  );
}
