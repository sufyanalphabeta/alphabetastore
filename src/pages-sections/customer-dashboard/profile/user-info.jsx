import Link from "next/link";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";

// GLOBAL CUSTOM COMPONENTS
import FlexBox from "components/flex-box/flex-box";
import { formatPreferredPaymentMethod } from "utils/users";

// CUSTOM DATA MODEL


// ==============================================================


// ==============================================================

export default function UserInfo({
  user
}) {
  return <Link href={`/profile/${user.id}`}>
      <Card elevation={0} sx={{
      marginTop: 3,
      display: "flex",
      flexWrap: "wrap",
      border: "1px solid",
      borderColor: "grey.100",
      padding: "0.75rem 1.5rem",
      flexDirection: {
        md: "row",
        xs: "column"
      },
      alignItems: {
        md: "center",
        xs: "flex-start"
      },
      justifyContent: {
        md: "space-between",
        xs: "flex-start"
      }
    }}>
        <TableRowItem title="Name" value={user.name} />
        <TableRowItem title="Email" value={user.email} />
        <TableRowItem title="Phone" value={user.phone || "Not provided"} />
        <TableRowItem title="Customer Code" value={user.customerCode || "Not assigned"} />
        <TableRowItem title="Preferred Payment" value={formatPreferredPaymentMethod(user.preferredPaymentMethod)} />
      </Card>
    </Link>;
}
function TableRowItem({
  title,
  value
}) {
  return <FlexBox flexDirection="column" p={1}>
      <Typography variant="body1" color="text.secondary" sx={{
      mb: 0.5
    }}>
        {title}
      </Typography>

      <span>{value}</span>
    </FlexBox>;
}
