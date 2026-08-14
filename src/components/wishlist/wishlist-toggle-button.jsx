"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Favorite from "@mui/icons-material/Favorite";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";

import { isLoggedIn } from "utils/auth";
import { addWishlistItem, removeWishlistItem } from "utils/wishlist";

export default function WishlistToggleButton({
  productId,
  initialInWishlist = false,
  onChange,
  variant = "icon",
  sx,
  size = "small",
  fullWidth = false
}) {
  const router = useRouter();
  const [isInWishlist, setIsInWishlist] = useState(initialInWishlist);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setIsInWishlist(initialInWishlist);
  }, [initialInWishlist]);

  const handleToggle = async event => {
    event.preventDefault();
    event.stopPropagation();

    if (!isLoggedIn()) {
      window.location.assign("/login");
      return;
    }

    setIsLoading(true);

    try {
      const nextValue = !isInWishlist;

      if (nextValue) {
        await addWishlistItem(productId);
      } else {
        await removeWishlistItem(productId);
      }

      setIsInWishlist(nextValue);
      onChange?.(nextValue);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "تعذر تحديث قائمة المفضلة.");
    } finally {
      setIsLoading(false);
    }
  };

  const buttonContent = variant === "button" ? (
    <Button
      color={isInWishlist ? "secondary" : "primary"}
      variant={isInWishlist ? "outlined" : "contained"}
      onClick={handleToggle}
      disabled={isLoading}
      startIcon={
        isLoading ? (
          <CircularProgress color="inherit" size={16} />
        ) : isInWishlist ? (
          <Favorite fontSize="small" />
        ) : (
          <FavoriteBorder fontSize="small" />
        )
      }
      sx={sx}
      fullWidth={fullWidth}
    >
      {isInWishlist ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
    </Button>
  ) : (
    <IconButton
      size={size}
      onClick={handleToggle}
      disabled={isLoading}
      sx={sx}
      aria-label={isInWishlist ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
    >
      {isLoading ? (
        <CircularProgress size={18} color="inherit" />
      ) : isInWishlist ? (
        <Favorite color="primary" fontSize="small" />
      ) : (
        <FavoriteBorder fontSize="small" />
      )}
    </IconButton>
  );

  return (
    <>
      {buttonContent}
      <Snackbar
        open={Boolean(errorMsg)}
        autoHideDuration={4000}
        onClose={() => setErrorMsg("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setErrorMsg("")} severity="error" variant="filled">
          {errorMsg}
        </Alert>
      </Snackbar>
    </>
  );
}
