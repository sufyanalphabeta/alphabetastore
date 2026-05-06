"use client";

import { Suspense, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// MUI
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";

// STYLED COMPONENT
import { SearchOutlinedIcon } from "./styles";
export function SearchInput2() {
  return (
    <Suspense fallback={null}>
      <SearchInput2Inner />
    </Suspense>
  );
}

function SearchInput2Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const handleSearch = useCallback(() => {
    if (search.trim()) {
      const params = new URLSearchParams(searchParams);
      params.set("q", search);
      router.push(`/products/search?${params.toString()}`);
      setSearch("");
    }
  }, [router, searchParams, search]);
  const INPUT_PROPS = {
    sx: {
      border: 0,
      height: 44,
      paddingRight: 0,
      overflow: "hidden",
      backgroundColor: "grey.50",
      "& .MuiOutlinedInput-notchedOutline": {
        border: 0
      }
    },
    endAdornment: <Button color="primary" disableElevation variant="contained" onClick={handleSearch} sx={{
      px: "3rem",
      height: "100%",
      borderRadius: "0 4px 4px 0"
    }}>
        Search
      </Button>,
    startAdornment: <SearchOutlinedIcon fontSize="small" />
  };
  return <Box position="relative" flex="1 1 0" maxWidth={670} mx="auto">
      <TextField fullWidth variant="outlined" placeholder="Searching for..." onChange={e => setSearch(e.target.value)} slotProps={{
      input: INPUT_PROPS
    }} />
    </Box>;
}