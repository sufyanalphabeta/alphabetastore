import Link from "next/link";
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
  return (
    <Box>
      <FlexBetween p={2} maxHeight={TOP_HEADER_AREA} justifyContent={COMPACT ? "center" : "space-between"}>
        {logoUrl ? <Avatar alt={siteName} src={logoUrl} sx={{
          borderRadius: 0,
          width: "auto",
          marginLeft: COMPACT ? 0 : 1
        }} /> : <Typography variant="h6" sx={{
          fontWeight: 700,
          fontSize: COMPACT ? "0.85rem" : "1rem",
          color: "primary.main",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: COMPACT ? 40 : 160,
          marginLeft: COMPACT ? 0 : 1
        }}>
            {COMPACT ? siteName.charAt(0) : siteName}
          </Typography>}

        <ChevronLeftIcon color="disabled" compact={COMPACT} onClick={handleSidebarCompactToggle} sidebar_compact={sidebarCompact ? 1 : 0} />
      </FlexBetween>

      {/* Back-to-store shortcut */}
      <Tooltip title="العودة إلى المتجر" placement="left">
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
          {!COMPACT && <Typography variant="caption" fontWeight={600} noWrap>العودة إلى المتجر</Typography>}
        </Box>
      </Tooltip>
    </Box>
  );
}
