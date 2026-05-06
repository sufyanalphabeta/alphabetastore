"use client";

import { Suspense, startTransition, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// MUI
import MuiPagination from "@mui/material/Pagination";
import { styled } from "@mui/material/styles";


// STYLED COMPONENT
export const StyledPagination = styled(MuiPagination)({
  display: "flex",
  marginTop: "2.5rem",
  justifyContent: "center"
});


// ==============================================================


// ==============================================================

export default function Pagination(props) {
  return (
    <Suspense fallback={null}>
      <PaginationInner {...props} />
    </Suspense>
  );
}

function PaginationInner({
  count,
  page
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handlePageChange = useCallback((_, nextPage) => {
    if (nextPage === page) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (nextPage === 1) {
      params.delete("page");
    } else {
      params.set("page", nextPage.toString());
    }

    const queryString = params.toString();
    const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;

    startTransition(() => {
      router.push(nextUrl, {
        scroll: false
      });
      router.refresh();
    });
  }, [page, pathname, router, searchParams]);

  if (count <= 1) return null;
  return <StyledPagination color="primary" count={count} page={page} onChange={handlePageChange} />;
}