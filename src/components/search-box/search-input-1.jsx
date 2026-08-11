"use client";

import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// MUI
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";

// CUSTOM ICON COMPONENT
import Search from "icons/Search";

// CUSTOM DATA MODEL

const INPUT_PROPS = {
  sx: {
    border: 0,
    padding: 0,
    borderRadius: 1,
    borderColor: "transparent",
    overflow: "hidden",
    backgroundColor: "grey.50",
    "& .MuiOutlinedInput-notchedOutline": {
      border: 1,
      borderRadius: 1,
      borderColor: "transparent"
    }
  },
  endAdornment: <Box ml={2} px={2} display="grid" alignItems="center" justifyContent="center" borderLeft="1px solid" borderColor="grey.200">
      <Search sx={{
      fontSize: 17,
      color: "grey.400"
    }} />
    </Box>
};


// ==============================================================


// ==============================================================

export function SearchInput1() {
  return (
    <Suspense fallback={null}>
      <SearchInput1Inner />
    </Suspense>
  );
}

function SearchInput1Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const handleSearch = useCallback(() => {
    if (search.trim()) {
      const params = new URLSearchParams(searchParams);
      params.set("q", search);
      router.push(`/products/search?${params.toString()}`);
    }
  }, [search, router, searchParams]);
  const handleChange = useCallback(e => {
    setSearch(e.target.value);
  }, []);
  const handleEnter = event => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearch();
    }
  };
  return <TextField fullWidth value={search} variant="outlined" onKeyDown={handleEnter} onChange={handleChange} placeholder="ابحث عن منتج أو علامة تجارية..." slotProps={{
    input: INPUT_PROPS
  }} aria-label="Search products" role="searchbox" />;
}
