"use client";

import Image from "next/image";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ArrowBack from "@mui/icons-material/ArrowBackIos";
import ArrowForward from "@mui/icons-material/ArrowForwardIos";
import Close from "@mui/icons-material/Close";
import ZoomIn from "@mui/icons-material/ZoomIn";
import { FALLBACK_PRODUCT_IMAGE } from "utils/catalog";

// STYLED COMPONENTS
import { PreviewImage, PreviewList, ProductImageWrapper } from "./styles";

function NavBtn({ onClick, icon, label, sx = {} }) {
  return (
    <IconButton
      onClick={e => { e.stopPropagation(); onClick(); }}
      aria-label={label}
      sx={{
        position: "absolute", top: "50%", transform: "translateY(-50%)",
        bgcolor: "rgba(255,255,255,0.85)", "&:hover": { bgcolor: "white" },
        zIndex: 2, ...sx
      }}
      size="small"
    >
      {icon}
    </IconButton>
  );
}

function GalleryImage({ src, alt, sizes, onError, priority = false }) {
  const imageUrl = src || FALLBACK_PRODUCT_IMAGE;
  if (!imageUrl.startsWith("/uploads/")) {
    return (
      <Box
        component="img"
        src={imageUrl}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
      />
    );
  }

  return <Image fill alt={alt} src={imageUrl} sizes={sizes} onError={onError} priority={priority} style={{ objectFit: "contain" }} />;
}

// ── touch / swipe helpers ─────────────────────────────────────────────────────
function useSwipe(onLeft, onRight) {
  const startX = useRef(null);
  const onTouchStart = e => { startX.current = e.touches[0].clientX; };
  const onTouchEnd = e => {
    if (startX.current === null) return;
    const diff = startX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) onLeft();
      else onRight();
    }
    startX.current = null;
  };
  return { onTouchStart, onTouchEnd };
}

const fallbackGalleryItem = {
  id: "product-placeholder",
  thumbnailUrl: FALLBACK_PRODUCT_IMAGE,
  productUrl: FALLBACK_PRODUCT_IMAGE,
  zoomUrl: FALLBACK_PRODUCT_IMAGE,
  altText: null
};

export default function ProductGallery({ gallery, productName = "Product" }) {
  const galleryImages = gallery?.length ? gallery : [fallbackGalleryItem];
  const [current, setCurrent] = useState(0);
  const [failedImages, setFailedImages] = useState(() => new Set());
  const [zoomOpen, setZoomOpen] = useState(false);
  const resolved = galleryImages.map((item, index) => failedImages.has(index) ? fallbackGalleryItem : item);

  useEffect(() => {
    setFailedImages(new Set());
    setCurrent(0);
  }, [gallery]);

  const handleImageError = index =>
    setFailedImages(prev => new Set(prev).add(index));

  const total = resolved.length;
  const prev = useCallback(() => setCurrent(c => (c - 1 + total) % total), [total]);
  const next = useCallback(() => setCurrent(c => (c + 1) % total), [total]);

  // Keyboard navigation
  useEffect(() => {
    if (!zoomOpen) return;
    const handler = e => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape") setZoomOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [zoomOpen, prev, next]);

  const swipeMain = useSwipe(next, prev);
  const swipeDialog = useSwipe(next, prev);

  return (
    <Fragment>
      {/* ── Main image ── */}
      <Box sx={{ position: "relative" }} {...swipeMain}>
        <ProductImageWrapper type="button" aria-label="تكبير صورة المنتج" onClick={() => setZoomOpen(true)}>
          <GalleryImage
            alt={resolved[current]?.altText || productName}
            src={resolved[current]?.productUrl || FALLBACK_PRODUCT_IMAGE}
            sizes="(max-width: 768px) 100vw, 50vw"
            onError={() => handleImageError(current)}
            priority={current === 0}
          />
        </ProductImageWrapper>

        {total > 1 && (
          <>
            <NavBtn onClick={prev} icon={<ArrowBack fontSize="small" />} label="الصورة السابقة" sx={{ left: 8 }} />
            <NavBtn onClick={next} icon={<ArrowForward fontSize="small" />} label="الصورة التالية" sx={{ right: 8 }} />
          </>
        )}

        {/* Image counter */}
        {total > 1 && (
          <Box sx={{
            position: "absolute", bottom: 10, right: 10,
            bgcolor: "rgba(0,0,0,0.45)", color: "white",
            px: 1, py: 0.25, borderRadius: 1, fontSize: 12, pointerEvents: "none"
          }}>
            {current + 1} / {total}
          </Box>
        )}

        {/* Zoom hint */}
        <Box sx={{
          position: "absolute", bottom: 10, left: 10,
          bgcolor: "rgba(0,0,0,0.35)", color: "white",
          px: 0.75, py: 0.25, borderRadius: 1, display: "flex", alignItems: "center",
          gap: 0.5, fontSize: 11, pointerEvents: "none"
        }}>
          <ZoomIn sx={{ fontSize: 14 }} /> تكبير
        </Box>
      </Box>

      {/* ── Thumbnails ── */}
      {total > 1 && (
        <PreviewList aria-label="صور المنتج المصغرة">
          {resolved.map((item, i) => (
            <PreviewImage type="button" aria-label={`عرض صورة المنتج ${i + 1}`} key={item.id || i} onClick={() => setCurrent(i)} selected={current === i}>
              <GalleryImage
                alt={`${productName} view ${i + 1}`}
                src={item.thumbnailUrl || item.productUrl || FALLBACK_PRODUCT_IMAGE}
                sizes="64px"
                onError={() => handleImageError(i)}
              />
            </PreviewImage>
          ))}
        </PreviewList>
      )}

      {/* ── Fullscreen viewer ── */}
      {zoomOpen && <Dialog open onClose={() => setZoomOpen(false)} maxWidth="xl" fullWidth
        PaperProps={{ sx: { bgcolor: "#111", m: 1 } }}
      >
        <DialogContent sx={{ p: 0, position: "relative", bgcolor: "#111" }} {...swipeDialog}>
          {/* Close */}
          <IconButton
            onClick={() => setZoomOpen(false)}
            aria-label="إغلاق عرض الصورة"
            sx={{ position: "absolute", top: 8, right: 8, zIndex: 10, color: "white", bgcolor: "rgba(255,255,255,0.15)" }}
          >
            <Close />
          </IconButton>

          {/* Counter */}
          {total > 1 && (
            <Typography variant="caption" sx={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              color: "rgba(255,255,255,0.75)", zIndex: 10
            }}>
              {current + 1} / {total}
            </Typography>
          )}

          {/* Main viewer */}
          <Box sx={{ position: "relative", height: { md: 680, sm: 460, xs: 320 } }}>
            <GalleryImage
              alt={`${productName} fullscreen`}
              src={resolved[current]?.zoomUrl || resolved[current]?.productUrl || FALLBACK_PRODUCT_IMAGE}
              sizes="100vw"
              onError={() => handleImageError(current)}
            />
          </Box>

          {/* Nav arrows */}
          {total > 1 && (
            <>
              <NavBtn onClick={prev} icon={<ArrowBack />} label="الصورة السابقة" sx={{ left: 12, color: "white", bgcolor: "rgba(255,255,255,0.12)" }} />
              <NavBtn onClick={next} icon={<ArrowForward />} label="الصورة التالية" sx={{ right: 12, color: "white", bgcolor: "rgba(255,255,255,0.12)" }} />
            </>
          )}

          {/* Thumbnail strip at bottom */}
          {total > 1 && (
            <Box sx={{ display: "flex", gap: 1, justifyContent: "center", p: 1.5, flexWrap: "nowrap", overflowX: "auto" }}>
              {resolved.map((item, i) => (
                <Box
                  key={item.id || i}
                  onClick={() => setCurrent(i)}
                  sx={{
                    width: 56, height: 56, flexShrink: 0, borderRadius: 1, overflow: "hidden",
                    position: "relative", cursor: "pointer",
                    border: `2px solid ${i === current ? "white" : "transparent"}`,
                    opacity: i === current ? 1 : 0.5,
                    transition: "all 0.15s",
                    bgcolor: "rgba(255,255,255,0.08)"
                  }}
                >
                  <GalleryImage alt="" src={item.thumbnailUrl || item.productUrl || FALLBACK_PRODUCT_IMAGE} sizes="56px" onError={() => handleImageError(i)} />
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
      </Dialog>}
    </Fragment>
  );
}
