"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";

import GeneralForm from "../general-form";

export default function SiteSettingsPageView() {
  return <Box py={4}>
      <Card sx={{ px: 3, py: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          إعدادات المتجر
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          أدِر هوية المتجر، المظهر، اللغة، الأسعار، والتواصل من مساحة واحدة منظمة.
        </Typography>
        <GeneralForm />
      </Card>
    </Box>;
}
