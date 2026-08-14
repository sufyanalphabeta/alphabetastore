"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import ArrowBack from "@mui/icons-material/ArrowBack";
import ChevronLeft from "@mui/icons-material/ChevronLeft";

import IconComponent from "components/IconComponent";
import { MobileNavigationBar } from "components/mobile-navigation";
import { HeaderCart, HeaderLogin, MobileHeader, HeaderSearch } from "components/header";
import { MobileMenu } from "components/mobile-navbar/mobile-menu";
import SearchInput from "components/SearchInput";
import useSettings from "hooks/useSettings";
import { fetchCategoriesTree } from "utils/catalog";

export default function MobileCategoriesPageView({ data }) {
  const { header, mobileNavigation, topbar } = data;
  const { settings } = useSettings();
  const isArabic = settings.default_language !== "en";
  const router = useRouter();
  const [roots, setRoots] = useState([]);
  const [path, setPath] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchCategoriesTree(true)
      .then(tree => {
        if (!active) return;
        setRoots(Array.isArray(tree) ? tree : []);
        setError("");
      })
      .catch(loadError => active && setError(loadError.message || (isArabic ? "تعذر تحميل الفئات" : "Unable to load categories")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [isArabic]);

  const current = path[path.length - 1] || null;
  const visibleItems = useMemo(() => current?.children || roots, [current, roots]);
  const openCategory = category => {
    if (category.children?.length) setPath(previous => [...previous, category]);
    else router.push(`/categories/${category.slug}`);
  };

  return <Box sx={{ minHeight: "100dvh", pb: 10, bgcolor: "grey.50" }}>
      <Paper square elevation={1} sx={{ position: "sticky", top: 0, zIndex: 10, px: 1, py: 0.5 }}>
        <MobileHeader>
          <MobileHeader.Left>
            <MobileMenu navigation={header.mobileNavigation || header.navigation} languages={topbar?.languageOptions} />
          </MobileHeader.Left>
          <MobileHeader.Logo logoUrl={mobileNavigation.logo} siteName={mobileNavigation.siteName} />
          <MobileHeader.Right>
            <HeaderSearch><SearchInput /></HeaderSearch>
            <HeaderLogin />
            <HeaderCart />
          </MobileHeader.Right>
        </MobileHeader>
      </Paper>

      <Container maxWidth="sm" sx={{ py: 2 }}>
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          {current ? <IconButton aria-label={isArabic ? "رجوع" : "Back"} onClick={() => setPath(previous => previous.slice(0, -1))}>
              <ArrowBack sx={{ transform: isArabic ? "rotate(180deg)" : "none" }} />
            </IconButton> : null}
          <Box minWidth={0} flex={1}>
            <Typography variant="h5" fontWeight={800} noWrap>
              {current?.name || (isArabic ? "جميع الفئات" : "All categories")}
            </Typography>
            {path.length > 1 ? <Typography variant="caption" color="text.secondary" noWrap>
                {path.slice(0, -1).map(item => item.name).join(" / ")}
              </Typography> : null}
          </Box>
        </Box>

        {current ? <Button
            component={Link}
            href={`/categories/${current.slug}`}
            fullWidth
            variant="contained"
            sx={{ mb: 2, minHeight: 46 }}
          >
            {isArabic ? "عرض كل منتجات الفئة" : "View all category products"} ({current.productCount ?? 0})
          </Button> : null}

        {loading ? <Box py={8} textAlign="center"><CircularProgress size={32} /></Box> : null}
        {!loading && error ? <Paper sx={{ p: 3, textAlign: "center", color: "error.main" }}>{error}</Paper> : null}
        {!loading && !error ? <Box display="grid" gap={1.25}>
            {visibleItems.map(category => <Paper
                component="button"
                type="button"
                key={category.id}
                onClick={() => openCategory(category)}
                elevation={0}
                sx={{
                  width: "100%",
                  minHeight: 66,
                  p: 1.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.paper",
                  color: "text.primary",
                  textAlign: "start",
                  cursor: "pointer"
                }}
              >
                <Box sx={{ width: 40, height: 40, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "primary.50", color: "primary.main", flexShrink: 0 }}>
                  <IconComponent icon={category.icon || "CategoryOutline"} fontSize="small" />
                </Box>
                <Box flex={1} minWidth={0}>
                  <Typography fontWeight={700}>{category.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {category.productCount ?? 0} {isArabic ? "منتج" : "products"}
                  </Typography>
                </Box>
                {category.children?.length ? <ChevronLeft sx={{ transform: isArabic ? "none" : "rotate(180deg)", color: "text.secondary" }} /> : null}
              </Paper>)}
          </Box> : null}
      </Container>

      <MobileNavigationBar navigation={mobileNavigation.version1} />
    </Box>;
}
