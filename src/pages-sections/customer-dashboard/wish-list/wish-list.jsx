"use client";

import { Fragment, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddShoppingCart from "@mui/icons-material/AddShoppingCart";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import Favorite from "@mui/icons-material/Favorite";

import Pagination from "../pagination";
import DashboardHeader from "../dashboard-header";
import { useCart } from "contexts/CartContext";
import { currency } from "lib";
import { fetchWishlistItemsPage, removeWishlistItem } from "utils/wishlist";

const PAGE_SIZE = 8;

export default function WishListPageView({ initialPage = 1 }) {
  const searchParams = useSearchParams();
  const pageFromQuery = Number.parseInt(searchParams.get("page") || "", 10);
  const currentPage = Number.isFinite(pageFromQuery) && pageFromQuery > 0 ? pageFromQuery : Math.max(Number(initialPage) || 1, 1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: currentPage, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [pageError, setPageError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState(new Set());
  const { addItem } = useCart();

  useEffect(() => {
    let cancelled = false;
    const loadWishlist = async () => {
      try {
        setIsLoading(true);
        setPageError("");
        const response = await fetchWishlistItemsPage({ page: currentPage, limit: PAGE_SIZE });
        if (!cancelled) {
          setItems(response?.items || []);
          setPagination(response?.pagination || { page: currentPage, limit: PAGE_SIZE, total: 0, totalPages: 1 });
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(error instanceof Error ? error.message : "تعذر تحميل قائمة المفضلة.");
          setItems([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadWishlist();
    return () => { cancelled = true; };
  }, [currentPage]);

  const runAction = async (productId, action) => {
    setPendingIds(current => new Set(current).add(productId));
    setPageError("");
    try {
      await action();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "تعذر تنفيذ العملية.");
    } finally {
      setPendingIds(current => {
        const next = new Set(current);
        next.delete(productId);
        return next;
      });
    }
  };

  const removeItem = item => runAction(item.product.id, async () => {
    await removeWishlistItem(item.product.id);
    setItems(current => current.filter(candidate => candidate.id !== item.id));
    setPagination(current => ({ ...current, total: Math.max(0, current.total - 1) }));
  });

  return <Fragment>
    <DashboardHeader title="قائمة المفضلة" Icon={Favorite} />
    {pageError ? <Alert severity="error" sx={{ mb: 2 }}>{pageError}</Alert> : null}
    {isLoading ? <Stack alignItems="center" py={6}><CircularProgress /></Stack> : null}
    {!isLoading && !pageError && items.length === 0 ? <Alert severity="info">قائمة المفضلة فارغة حاليًا.</Alert> : null}

    {!isLoading && items.length > 0 ? <Stack spacing={1.5}>
      {items.map(item => {
        const product = item.product;
        const pending = pendingIds.has(product.id);
        const inStock = Number(product.stockQty || 0) > 0 && product.status !== "INACTIVE";
        return <Paper key={item.id} variant="outlined" sx={{ p: { xs: 1.25, sm: 1.5 }, display: "flex", alignItems: "center", gap: { xs: 1.25, sm: 2 }, borderRadius: 2, overflow: "hidden" }}>
          <Box component={Link} href={`/products/${product.slug}`} sx={{ position: "relative", width: { xs: 76, sm: 104 }, height: { xs: 76, sm: 104 }, flexShrink: 0, bgcolor: "grey.50", borderRadius: 1.5, overflow: "hidden" }}>
            <Image src={product.thumbnail} alt={product.title} fill sizes="(max-width: 600px) 76px, 104px" style={{ objectFit: "contain" }} />
          </Box>
          <Box minWidth={0} flex={1}>
            <Typography component={Link} href={`/products/${product.slug}`} variant="subtitle1" fontWeight={700} sx={{ display: "block", color: "text.primary", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis" }}>{product.title}</Typography>
            <Stack direction="row" alignItems="center" spacing={1} mt={0.5} flexWrap="wrap" useFlexGap>
              {product.categories?.[0] ? <Typography variant="caption" color="text.secondary">{product.categories[0]}</Typography> : null}
              <Chip size="small" color={inStock ? "success" : "default"} variant="outlined" label={inStock ? "متوفر" : "غير متوفر"} />
            </Stack>
            <Typography color="primary.main" fontWeight={800} mt={0.75}>{currency(product.price)}</Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center" flexShrink={0}>
            <Button variant="contained" size="small" disabled={!inStock || pending} startIcon={<AddShoppingCart />} onClick={() => runAction(product.id, () => addItem(product.id, 1))} sx={{ display: { xs: "none", sm: "inline-flex" } }}>أضف للسلة</Button>
            <IconButton color="primary" disabled={!inStock || pending} onClick={() => runAction(product.id, () => addItem(product.id, 1))} sx={{ display: { xs: "inline-flex", sm: "none" } }} aria-label="أضف للسلة"><AddShoppingCart /></IconButton>
            <IconButton color="error" disabled={pending} onClick={() => removeItem(item)} aria-label="حذف من المفضلة">{pending ? <CircularProgress size={20} /> : <DeleteOutline />}</IconButton>
          </Stack>
        </Paper>;
      })}
    </Stack> : null}

    <Pagination count={Math.max(1, Number(pagination.totalPages || 1))} page={Math.max(currentPage, 1)} />
  </Fragment>;
}
