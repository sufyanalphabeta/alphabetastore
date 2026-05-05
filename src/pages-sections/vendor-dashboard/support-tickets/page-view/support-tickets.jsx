"use client";

import Link from "next/link";
import Alert from "@mui/material/Alert";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

// GLOBAL CUSTOM COMPONENTS
import OverlayScrollbar from "components/overlay-scrollbar";
import { TableHeader, TablePagination } from "components/data-table";

// GLOBAL CUSTOM HOOK
import useMuiTable from "hooks/useMuiTable";

// LOCAL CUSTOM COMPONENTS
import PageWrapper from "pages-sections/vendor-dashboard/page-wrapper";
import SearchArea from "pages-sections/vendor-dashboard/search-box";
import TicketRow from "../ticket-row";
import { tableHeading } from "../table-heading";
import { fetchAdminTickets } from "utils/tickets";


// =============================================================================


// =============================================================================

export default function SupportTicketsPageView() {
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get("q")?.trim().toLowerCase() || "";
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const loadTickets = useCallback(async () => {
    setPageError("");

    try {
      const data = await fetchAdminTickets();
      setTickets(Array.isArray(data) ? data : []);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to load tickets.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const filteredTickets = useMemo(() => tickets.filter(ticket => {
    if (!searchTerm) {
      return true;
    }

    return [ticket.ticketNumber, ticket.subject, ticket.customer?.name, ticket.statusLabel, ticket.priorityLabel].some(value => String(value || "").toLowerCase().includes(searchTerm));
  }), [tickets, searchTerm]);

  const {
    order,
    orderBy,
    rowsPerPage,
    filteredList,
    handleChangePage,
    handleRequestSort
  } = useMuiTable({
    listData: filteredTickets,
    defaultSort: "createdAt",
    defaultOrder: "desc"
  });

  return <PageWrapper title="Support Tickets">
      <Suspense fallback={null}>
        <SearchArea url="/admin/tickets" buttonText="" searchPlaceholder="Search Ticket..." />
      </Suspense>

      {pageError ? <Alert severity="error" sx={{
      mb: 3
    }}>{pageError}</Alert> : null}

      <Card>
        <OverlayScrollbar>
          <TableContainer sx={{
          minWidth: 800
        }}>
            <Table>
              <TableHeader order={order} orderBy={orderBy} heading={tableHeading} onRequestSort={handleRequestSort} />

              <TableBody>
                {isLoading ? <tr>
                    <td colSpan={6}>
                      <Stack alignItems="center" justifyContent="center" py={6}>
                        <CircularProgress color="info" />
                      </Stack>
                    </td>
                  </tr> : filteredList.length ? filteredList.map(ticket => <TicketRow ticket={ticket} key={ticket.id} />) : <tr>
                    <td colSpan={6}>
                      <Stack alignItems="center" justifyContent="center" py={6}>
                        <Typography color="text.secondary">No support tickets found.</Typography>
                      </Stack>
                    </td>
                  </tr>}
              </TableBody>
            </Table>
          </TableContainer>
        </OverlayScrollbar>

        <Stack alignItems="center" my={4}>
          <TablePagination onChange={handleChangePage} count={Math.max(1, Math.ceil(filteredTickets.length / rowsPerPage))} />
        </Stack>
      </Card>
    </PageWrapper>;
}