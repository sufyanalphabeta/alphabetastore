"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Close from "@mui/icons-material/Close";
import CompareArrows from "@mui/icons-material/CompareArrows";
import { useCompare } from "contexts/CompareContext";
import { FALLBACK_PRODUCT_IMAGE } from "utils/catalog";

export default function CompareBar() {
  const { items, remove, clear, count } = useCompare();
  const router = useRouter();

  if (count === 0) return null;

  return (
    <Paper
      elevation={8}
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1300,
        px: { md: 4, xs: 2 },
        py: 1.5,
        borderTop: "2px solid",
        borderColor: "primary.main",
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexWrap: "wrap"
      }}
    >
      <CompareArrows color="primary" />
      <Typography variant="subtitle2" fontWeight={700} sx={{ mr: 1 }}>
        Compare ({count}/4)
      </Typography>

      <Stack direction="row" spacing={1.5} flexWrap="wrap" flex={1}>
        {items.map(p => (
          <Box
            key={p.id}
            sx={{
              position: "relative",
              width: 56, height: 56,
              borderRadius: 1,
              overflow: "visible",
              flexShrink: 0
            }}
          >
            <Box sx={{ width: 56, height: 56, borderRadius: 1, overflow: "hidden", border: "1px solid", borderColor: "divider", position: "relative" }}>
              <Image
                fill
                src={p.thumbnail || FALLBACK_PRODUCT_IMAGE}
                alt={p.title}
                sizes="56px"
                style={{ objectFit: "contain" }}
              />
            </Box>
            <IconButton
              size="small"
              onClick={() => remove(p.id)}
              sx={{
                position: "absolute", top: -8, right: -8,
                width: 18, height: 18, bgcolor: "error.main", color: "white",
                "&:hover": { bgcolor: "error.dark" },
                fontSize: 10
              }}
            >
              <Close sx={{ fontSize: 12 }} />
            </IconButton>
          </Box>
        ))}

        {/* Empty slots */}
        {Array.from({ length: Math.max(0, 2 - count) }).map((_, i) => (
          <Box
            key={`empty-${i}`}
            sx={{
              width: 56, height: 56, borderRadius: 1,
              border: "1px dashed", borderColor: "divider",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
          >
            <Typography variant="caption" color="text.disabled">+</Typography>
          </Box>
        ))}
      </Stack>

      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          color="primary"
          size="small"
          disabled={count < 2}
          onClick={() => router.push("/compare")}
        >
          Compare Now
        </Button>
        <Tooltip title="Clear all">
          <IconButton size="small" onClick={clear}>
            <Close fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}
