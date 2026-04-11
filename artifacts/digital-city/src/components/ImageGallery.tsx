import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, ZoomIn, Package } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Fullscreen lightbox (portal — rendered at document.body) ─────────────────
function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx]   = useState(startIndex);
  const touchStartX     = useRef<number | null>(null);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape")      onClose();
      if (e.key === "ArrowLeft")   setIdx(i => (i - 1 + images.length) % images.length);
      if (e.key === "ArrowRight")  setIdx(i => (i + 1) % images.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [images.length, onClose]);

  // Prevent body scroll while lightbox is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 44)
      setIdx(i => delta > 0
        ? (i - 1 + images.length) % images.length
        : (i + 1) % images.length);
    touchStartX.current = null;
  };

  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[90] flex flex-col"
      style={{ background: "rgba(0,0,0,0.96)" }}
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Top bar ── */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-white/40 text-sm font-mono select-none">
          {idx + 1} / {images.length}
        </p>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ background: "rgba(255,255,255,0.12)" }}
        >
          <X size={18} className="text-white" />
        </button>
      </div>

      {/* ── Image + arrows ── */}
      <div
        className="flex-1 flex items-center justify-center relative px-12 min-h-0"
        onClick={e => e.stopPropagation()}
      >
        {images.length > 1 && (
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors z-10 select-none"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
        )}

        <AnimatePresence mode="wait">
          <motion.img
            key={idx}
            src={images[idx]}
            alt=""
            draggable={false}
            className="max-w-full max-h-full object-contain rounded-xl select-none"
            style={{ maxHeight: "65vh" }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
          />
        </AnimatePresence>

        {images.length > 1 && (
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors z-10 select-none"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <ChevronRight size={20} className="text-white" />
          </button>
        )}
      </div>

      {/* ── Thumbnail strip ── */}
      {images.length > 1 && (
        <div
          className="flex-shrink-0 flex justify-center gap-2 px-4 py-3 overflow-x-auto"
          onClick={e => e.stopPropagation()}
        >
          {images.map((url, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={cn(
                "w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 transition-all border-2",
                i === idx
                  ? "border-[#FFA500] opacity-100 scale-105"
                  : "border-transparent opacity-40 hover:opacity-70",
              )}
            >
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
      )}

      {/* ── Dot pills ── */}
      {images.length > 1 && (
        <div
          className="flex justify-center gap-1.5 pb-3 flex-shrink-0"
          onClick={e => e.stopPropagation()}
        >
          {images.slice(0, 12).map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={cn(
                "rounded-full transition-all",
                i === idx ? "w-4 h-1.5 bg-[#FFA500]" : "w-1.5 h-1.5 bg-white/25",
              )}
            />
          ))}
        </div>
      )}
    </motion.div>,
    document.body,
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface GalleryProps {
  images: string[];
  alt?: string;
  aspectRatio?: string;
  showDots?: boolean;
  enableFullscreen?: boolean;
  className?: string;
}

// ─── Main Gallery component ───────────────────────────────────────────────────
export function ImageGallery({
  images,
  alt = "",
  aspectRatio = "4/3",
  showDots = true,
  enableFullscreen = true,
  className,
}: GalleryProps) {
  const [idx, setIdx]             = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX               = useRef<number | null>(null);
  const dragStartX                = useRef<number | null>(null);
  const isDragging                = useRef(false);

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 44)
      setIdx(i => delta > 0
        ? (i - 1 + images.length) % images.length
        : (i + 1) % images.length);
    touchStartX.current = null;
  }, [images.length]);

  // Mouse drag (desktop)
  const onMouseDown = (e: React.MouseEvent) => { dragStartX.current = e.clientX; isDragging.current = false; };
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragStartX.current !== null && Math.abs(e.clientX - dragStartX.current) > 6)
      isDragging.current = true;
  };
  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragStartX.current === null) return;
    const delta = e.clientX - dragStartX.current;
    if (Math.abs(delta) > 44)
      setIdx(i => delta > 0
        ? (i - 1 + images.length) % images.length
        : (i + 1) % images.length);
    dragStartX.current = null;
  }, [images.length]);

  const handleClick = () => {
    if (isDragging.current) { isDragging.current = false; return; }
    if (enableFullscreen) setLightboxOpen(true);
  };

  // Empty state
  if (images.length === 0) {
    return (
      <div
        className={cn("w-full flex items-center justify-center bg-[#FFF8E7]", className)}
        style={{ aspectRatio }}
      >
        <Package size={28} className="text-[#1A4D1F]/15" />
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "relative w-full overflow-hidden bg-[#FFF8E7] select-none",
          enableFullscreen && "cursor-zoom-in",
          "group",
          className,
        )}
        style={{ aspectRatio }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onClick={handleClick}
      >
        {/* Current image */}
        <AnimatePresence initial={false} mode="wait">
          <motion.img
            key={idx}
            src={images[idx]}
            alt={alt}
            draggable={false}
            loading={idx === 0 ? "eager" : "lazy"}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
        </AnimatePresence>

        {/* Preload next & prev (hidden) */}
        {images.length > 1 && (
          <>
            <img
              src={images[(idx + 1) % images.length]}
              alt=""
              className="hidden"
              loading="lazy"
              aria-hidden
            />
            {idx > 0 && (
              <img
                src={images[(idx - 1 + images.length) % images.length]}
                alt=""
                className="hidden"
                loading="lazy"
                aria-hidden
              />
            )}
          </>
        )}

        {/* Zoom hint overlay (desktop hover) */}
        {enableFullscreen && (
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ background: "rgba(0,0,0,0.12)" }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.38)" }}
            >
              <ZoomIn size={16} className="text-white" />
            </div>
          </div>
        )}

        {/* Multiple images — arrows + counter + dots */}
        {images.length > 1 && (
          <>
            {/* Prev */}
            <button
              onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <ChevronLeft size={13} />
            </button>
            {/* Next */}
            <button
              onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
              <ChevronRight size={13} />
            </button>

            {/* Counter badge */}
            <div
              className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-black text-white select-none"
              style={{ background: "rgba(0,0,0,0.38)" }}
            >
              {idx + 1}/{images.length}
            </div>

            {/* Dot pills */}
            {showDots && (
              <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1 pointer-events-none">
                {images.slice(0, 8).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "rounded-full transition-all",
                      i === idx ? "w-3.5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/45",
                    )}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Fullscreen lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <Lightbox
            images={images}
            startIndex={idx}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
