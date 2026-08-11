"use client";

import Image from "next/image";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";

// CUSTOM COMPONENTS
import FlexRowCenter from "components/flex-box/flex-row-center";

// IMPORT IMAGES
import alphabetaIcon from "../../../../public/assets/images/alphabeta-icon.svg";

export default function LogoWithTitle() {
  const { t } = useTranslation();
  return (
    <FlexRowCenter flexDirection="column" gap={1.5} mb={4}>
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: "16px",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "primary.main",
          p: 1
        }}
      >
        <Image width={56} height={56} src={alphabetaIcon} alt="Alphabeta Store" style={{ objectFit: "contain" }} />
      </Box>

      <Typography fontWeight={700} variant="h5" color="primary.main">
        Alphabeta Store
      </Typography>

      <Typography fontWeight={600} variant="body1" color="text.secondary">
        {t("authWelcomeTitle")}
      </Typography>
    </FlexRowCenter>
  );
}
