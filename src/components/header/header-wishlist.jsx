"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import { fetchWishlistItemsPage } from "utils/wishlist";

export default function HeaderWishlist() {
  const [count, setCount] = useState(0);
  const refresh = async () => {
    try {
      const response = await fetchWishlistItemsPage({ page: 1, limit: 1 });
      setCount(Number(response?.pagination?.total || 0));
    } catch {
      setCount(0);
    }
  };

  useEffect(() => {
    refresh();
    window.addEventListener("wishlist:changed", refresh);
    return () => window.removeEventListener("wishlist:changed", refresh);
  }, []);

  return <Badge badgeContent={count} color="secondary" showZero><IconButton LinkComponent={Link} href="/wish-list" aria-label="المفضلة"><FavoriteBorder /></IconButton></Badge>;
}
