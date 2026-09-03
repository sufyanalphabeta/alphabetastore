"use client";

import Link from "next/link";
import IconButton from "@mui/material/IconButton";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";

export default function HeaderWishlist() {
  return <IconButton LinkComponent={Link} href="/wish-list" aria-label="المفضلة"><FavoriteBorder /></IconButton>;
}
