import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";

// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";

// STYLED COMPONENTS
import { StyledTableCell, StyledTableRow } from "../styles";


// ========================================================================


// ========================================================================

export default function CustomerRow({
  customer
}) {
  const {
    email,
    name,
    phone,
    status,
    orderCount
  } = customer;
  const STYLE = {
    fontWeight: 400
  };
  return <StyledTableRow tabIndex={-1} role="checkbox">
      <StyledTableCell align="left">
        <FlexBox alignItems="center" gap={1.5}>
          <Avatar variant="rounded">
            {name?.slice(0, 1).toUpperCase() || "?"}
          </Avatar>

          <Typography variant="h6">{name}</Typography>
        </FlexBox>
      </StyledTableCell>

      <StyledTableCell align="left" sx={STYLE}>
        {phone || "-"}
      </StyledTableCell>

      <StyledTableCell align="left" sx={STYLE}>
        {email}
      </StyledTableCell>

      <StyledTableCell align="left" sx={STYLE}>
        <Chip size="small" label={status === "ACTIVE" ? "نشط" : "معطل"} color={status === "ACTIVE" ? "success" : "default"} />
      </StyledTableCell>

      <StyledTableCell align="left" sx={STYLE}>
        {orderCount ?? 0}
      </StyledTableCell>
    </StyledTableRow>;
}