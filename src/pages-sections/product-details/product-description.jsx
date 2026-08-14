import Typography from "@mui/material/Typography";
export default function ProductDescription({
  description
}) {
  if (!description || !description.trim() || description.trim() === "-") return null;
  return <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: "pre-line", lineHeight: 1.9 }}>
      {description}
    </Typography>;
}
