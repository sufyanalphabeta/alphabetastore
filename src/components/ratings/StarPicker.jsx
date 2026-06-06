"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";

/**
 * Interactive star picker for writing reviews.
 *
 * @param {object} props
 * @param {number} props.value        current rating 1–5
 * @param {function} props.onChange   called with new value (1–5)
 * @param {boolean} [props.disabled]
 */
export default function StarPicker({ value = 0, onChange, disabled = false }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  const color = "#FFA41C";
  const fontSize = 30;

  return (
    <Box display="flex" gap={0.5}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Tooltip key={star} title={LABELS[star]} placement="top">
          <Box
            component="span"
            onMouseEnter={() => !disabled && setHover(star)}
            onMouseLeave={() => !disabled && setHover(0)}
            onClick={() => !disabled && onChange?.(star)}
            sx={{
              cursor: disabled ? "default" : "pointer",
              lineHeight: 0,
              color: active >= star ? color : "grey.400",
              transition: "color 0.1s",
            }}
          >
            {active >= star ? (
              <StarIcon sx={{ fontSize }} />
            ) : (
              <StarBorderIcon sx={{ fontSize }} />
            )}
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}

const LABELS = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very Good",
  5: "Excellent",
};
