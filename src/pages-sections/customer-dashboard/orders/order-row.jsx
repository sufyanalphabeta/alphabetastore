import Link from "next/link";
import { format } from "date-fns/format";

// MUI
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import East from "@mui/icons-material/East";

// LOCAL CUSTOM COMPONENT
import TableRow from "../table-row";

// CUSTOM UTILS LIBRARY FUNCTION
import { currency } from "lib";

// CUSTOM DATA MODEL


// =================================================


// =================================================

const getColor = status => {
  if (status === "PENDING") return "secondary";
  if (status === "CONFIRMED") return "info";
  if (status === "PROCESSING") return "warning";
  if (status === "DELIVERED") return "success";
  if (status === "CANCELLED") return "error";
  return "default";
};
export default function OrderRow({
  order
}) {
  return <Link href={`/orders/${order.id}`}>
      <TableRow elevation={0} sx={{
      gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr"
    }}>
        <Typography noWrap variant="h5">
          {order.orderNumber || `#${order.id.substring(0, 8)}`}
        </Typography>

        <Box textAlign={{
        sm: "center",
        xs: "right"
      }}>
          <Chip size="small" label={order.statusLabel} color={getColor(order.rawStatus)} />
        </Box>

        <Typography noWrap variant="body1" sx={{
        textAlign: {
          sm: "center",
          xs: "left"
        }
      }}>
          {format(new Date(order.createdAt), "MMM dd, yyyy")}
        </Typography>

        <Typography variant="body1" fontWeight={500} sx={{
        textAlign: {
          sm: "center",
          xs: "right"
        }
      }}>
          {currency(order.totalAmount)}
        </Typography>

        <Box justifyContent="end" display={{
        sm: "inline-flex",
        xs: "none"
      }}>
          <IconButton>
            <East className="east" fontSize="small" />
          </IconButton>
        </Box>
      </TableRow>
    </Link>;
}