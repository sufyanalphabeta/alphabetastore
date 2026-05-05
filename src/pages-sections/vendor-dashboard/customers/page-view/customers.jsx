"use client";

import { Suspense, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";

// GLOBAL CUSTOM COMPONENTS
import OverlayScrollbar from "components/overlay-scrollbar";
import { TableHeader, TablePagination } from "components/data-table";

// GLOBAL CUSTOM HOOK
import useMuiTable from "hooks/useMuiTable";

// LOCAL CUSTOM COMPONENT
import SearchArea from "../../search-box";
import CustomerRow from "../customer-row";
import PageWrapper from "../../page-wrapper";

// TABLE HEAD COLUMN DATA
import { tableHeading } from "../table-heading";
import { apiGet } from "utils/api";


// =============================================================================


// =============================================================================

async function fetchAdminCustomers() {
  const data = await apiGet("/users/admin/users");
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  return items.map(u => ({
    id: u.id || "",
    name: u.name || "",
    email: u.email || "",
    phone: u.phone || "",
    status: u.status || "ACTIVE",
    orderCount: u._count?.orders ?? 0,
    createdAt: u.createdAt || null
  }));
}

export default function CustomersPageView() {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchAdminCustomers()
      .then(data => { if (!cancelled) setCustomers(data); })
      .catch(err => { if (!cancelled) setPageError(err instanceof Error ? err.message : "Failed to load customers."); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const {
    order,
    orderBy,
    rowsPerPage,
    filteredList,
    handleChangePage,
    handleRequestSort
  } = useMuiTable({
    listData: customers
  });

  return <PageWrapper title="Customers">
      <Suspense fallback={null}>
        <SearchArea buttonText="" url="/admin/customers" searchPlaceholder="Search Customer..." />
      </Suspense>

      {pageError ? <Alert severity="error" sx={{ mb: 2 }}>{pageError}</Alert> : null}

      {isLoading ? <Stack alignItems="center" justifyContent="center" py={6}><CircularProgress color="info" /></Stack> : <Card>
        <OverlayScrollbar>
          <TableContainer sx={{ minWidth: 900 }}>
            <Table>
              <TableHeader order={order} orderBy={orderBy} heading={tableHeading} onRequestSort={handleRequestSort} />
              <TableBody>
                {filteredList.map(customer => <CustomerRow customer={customer} key={customer.id} />)}
              </TableBody>
            </Table>
          </TableContainer>
        </OverlayScrollbar>

        <Stack alignItems="center" my={4}>
          <TablePagination onChange={handleChangePage} count={Math.ceil(filteredList.length / rowsPerPage)} />
        </Stack>
      </Card>}
    </PageWrapper>;
}