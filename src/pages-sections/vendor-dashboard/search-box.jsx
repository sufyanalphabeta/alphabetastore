import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import debounce from "lodash/debounce";

// MUI
import Add from "@mui/icons-material/Add";
import Button from "@mui/material/Button";
import useMediaQuery from "@mui/material/useMediaQuery";

// GLOBAL CUSTOM COMPONENTS
import SearchInput from "components/SearchInput";
import FlexBox from "components/flex-box/flex-box";


// ===============================================================


// ===============================================================

export default function SearchArea(props) {
  return (
    <Suspense fallback={null}>
      <SearchAreaInner {...props} />
    </Suspense>
  );
}

function SearchAreaInner({
  url = "/",
  buttonText = "Add Product",
  searchPlaceholder = "Search Product...",
  extraContent = null
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const downSM = useMediaQuery(theme => theme.breakpoints.down("sm"));
  const [inputValue, setInputValue] = useState(searchParams.get("q") || "");

  useEffect(() => {
    setInputValue(searchParams.get("q") || "");
  }, [searchParams]);

  const handleSearch = useMemo(() => debounce(value => {
    const params = new URLSearchParams(searchParams);
    const nextValue = value.trim();

    params.delete("page");

    if (nextValue) {
      params.set("q", nextValue);
    } else {
      params.delete("q");
    }

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  }, 100), [pathname, router, searchParams]);

  useEffect(() => () => {
    handleSearch.cancel();
  }, [handleSearch]);

  return <FlexBox mb={2} gap={2} justifyContent="space-between" flexWrap="wrap">
      <FlexBox gap={2} flex="1 1 0" flexWrap="wrap">
        <SearchInput value={inputValue} placeholder={searchPlaceholder} onChange={e => {
        const nextValue = e.target.value;
        setInputValue(nextValue);
        handleSearch(nextValue);
      }} />
        {extraContent}
      </FlexBox>

      {buttonText ? <Button href={url} color="info" fullWidth={downSM} variant="contained" startIcon={<Add />} LinkComponent={Link} sx={{
      minHeight: 44
    }}>
          {buttonText}
        </Button> : null}
    </FlexBox>;
}