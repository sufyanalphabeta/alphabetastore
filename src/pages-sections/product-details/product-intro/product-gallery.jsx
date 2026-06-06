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
import { PreviewImage, ProductImageWrapper } from "./styles";

// ── touch / swipe helpers ─────────────────────────────────────────────────────
function useSwipe(onLeft, onRight) {
  const startX = useRef(null);
  const onTouchStart = e => { startX.current = e.touches[0].clientX; };
  const onTouchEnd = e => {
    if (startX.current === null) return;
    const diff = startX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) { diff > 0 ? onLeft() : onRight(); }
    startX.current = null;
  };
  return { onTouchStart, onTouchEnd };
}

export default function ProductGallery({ images, productName = "Product" }) {
  const galleryImages = images?.length ? images : [FALLBACK_PRODUCT_IMAGE];
  const [current, setCurrent] = useState(0);
  const [resolved, setResolved] = useState(galleryImages);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    setResolved(galleryImages);
    setCurrent(0);
  }, [images]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImageError = index =>
    setResolved(prev => prev.map((item, i) => i === index ? FALLBACK_PRODUCT_IMAGE : item));

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

  const NavBtn = ({ onClick, icon, sx = {} }) => (
    <IconButton
      onClick={e => { e.stopPropagation(); onClick(); }}
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

  return (
    <Fragment>
      {/* ── Main image ── */}
      <Box sx={{ position: "relative" }} {...swipeMain}>
        <ProductImageWrapper onClick={() => setZoomOpen(true)}>
          <Image
            fill
            alt={productName}
            src={resolved[current] || FALLBACK_PRODUCT_IMAGE}
            sizes="(max-width: 768px) 100vw, 50vw"
            onError={() => handleImageError(current)}
            style={{ objectFit: "contain" }}
          />
        </ProductImageWrapper>

        {total > 1 && (
          <>
            <NavBtn onClick={prev} icon={<ArrowBack fontSize="small" />} sx={{ left: 8 }} />
            <NavBtn onClick={next} icon={<ArrowForward fontSize="small" />} sx={{ right: 8 }} />
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
          <ZoomIn sx={{ fontSize: 14 }} /> Zoom
        </Box>
      </Box>

      {/* ── Thumbnails ── */}
      {total > 1 && (
        <div className="preview-images">
          {resolved.map((url, i) => (
            <PreviewImage key={i} onClick={() => setCurrent(i)} selected={current === i}>
              <Image
                fill
                alt={`${productName} view ${i + 1}`}
                src={url || FALLBACK_PRODUCT_IMAGE}
                sizes="64px"
                onError={() => handleImageError(i)}
                style={{ objectFit: "contain" }}
              />
            </PreviewImage>
          ))}
        </div>
      )}

      {/* ── Fullscreen viewer ── */}
      <Dialog open={zoomOpen} onClose={() => setZoomOpen(false)} maxWidth="xl" fullWidth
        PaperProps={{ sx: { bgcolor: "#111", m: 1 } }}
      >
        <DialogContent sx={{ p: 0, position: "relative", bgcolor: "#111" }} {...swipeDialog}>
          {/* Close */}
          <IconButton
            onClick={() => setZoomOpen(false)}
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
            <Image
              fill
              alt={`${productName} fullscreen`}
              src={resolved[current] || FALLBACK_PRODUCT_IMAGE}
              sizes="100vw"
              onError={() => handleImageError(current)}
              style={{ objectFit: "contain" }}
            />
          </Box>

          {/* Nav arrows */}
          {total > 1 && (
            <>
              <NavBtn onClick={prev} icon={<ArrowBack />} sx={{ left: 12, color: "white", bgcolor: "rgba(255,255,255,0.12)" }} />
              <NavBtn onClick={next} icon={<ArrowForward />} sx={{ right: 12, color: "white", bgcolor: "rgba(255,255,255,0.12)" }} />
            </>
          )}

          {/* Thumbnail strip at bottom */}
          {total > 1 && (
            <Box sx={{ display: "flex", gap: 1, justifyContent: "center", p: 1.5, flexWrap: "nowrap", overflowX: "auto" }}>
              {resolved.map((url, i) => (
                <Box
                  key={i}
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
                  <Image fill alt="" src={url || FALLBACK_PRODUCT_IMAGE} sizes="56px" style={{ objectFit: "contain" }} />
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Fragment>
  );
}
