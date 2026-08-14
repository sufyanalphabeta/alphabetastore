import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import StarIcon from "@mui/icons-material/Star";
import StarRating from "./StarRating";

/**
 * Rating summary block: average, star distribution bars, total count.
 *
 * @param {object} props
 * @param {number}  props.average        0–5
 * @param {number}  props.total          number of reviews
 * @param {object}  props.distribution   { 1: n, 2: n, 3: n, 4: n, 5: n }
 */
export default function RatingSummary({ average = 0, total = 0, distribution = {} }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        gap: 4,
        p: 3,
        bgcolor: "grey.50",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* Big average */}
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minWidth={120}
      >
        <Typography variant="h2" fontWeight={700} lineHeight={1}>
          {Number(average).toFixed(1)}
        </Typography>
        <StarRating value={average} size="medium" sx={{ mt: 0.5 }} />
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          {total} تقييم
        </Typography>
      </Box>

      <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" } }} />

      {/* Distribution bars */}
      <Box flex={1} minWidth={180}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = distribution[star] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <Box key={star} display="flex" alignItems="center" gap={1} mb={0.5}>
              <Box display="flex" alignItems="center" gap={0.25} minWidth={28}>
                <Typography variant="caption" fontWeight={600}>{star}</Typography>
                <StarIcon sx={{ fontSize: 13, color: "#FFA41C" }} />
              </Box>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  bgcolor: "grey.200",
                  "& .MuiLinearProgress-bar": {
                    bgcolor: "#FFA41C",
                    borderRadius: 4,
                  },
                }}
              />
              <Typography variant="caption" color="text.secondary" minWidth={28}>
                {count}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
