import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X } from "lucide-react";

// ── Sub-button data ────────────────────────────────────────────────────────────
const STORE_LINKS = {
  android: "https://play.google.com/store",   // ← replace with real APK / Play Store URL
  ios:     "https://apps.apple.com",          // ← replace with real App Store URL
};

// ── SVG brand icons (inline, no extra package) ────────────────────────────────
function AndroidIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
      <path d="M17.523 15.341A5 5 0 0 0 20 11a5 5 0 0 0-2.477-4.341l1.292-2.237a.5.5 0 0 0-.868-.5l-1.312 2.27A9.965 9.965 0 0 0 12 5a9.965 9.965 0 0 0-4.635 1.192L6.053 3.922a.5.5 0 1 0-.868.5l1.292 2.237A5 5 0 0 0 4 11a5 5 0 0 0 2.477 4.341C5.57 16.5 5 18.185 5 20h14c0-1.815-.57-3.5-1.477-4.659zM9 13a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export function DownloadFAB() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const subButtonVariants = {
    hidden:  { opacity: 0, y: 12, scale: 0.85 },
    visible: (i: number) => ({
      opacity: 1, y: 0, scale: 1,
      transition: { delay: i * 0.07, type: "spring", stiffness: 400, damping: 28 },
    }),
    exit: (i: number) => ({
      opacity: 0, y: 8, scale: 0.88,
      transition: { delay: i * 0.04, duration: 0.15 },
    }),
  };

  const subButtons = [
    {
      key:   "ios",
      href:  STORE_LINKS.ios,
      icon:  <AppleIcon />,
      label: "App Store",
      bg:    "#111",
    },
    {
      key:   "android",
      href:  STORE_LINKS.android,
      icon:  <AndroidIcon />,
      label: "Google Play",
      bg:    "#1A7F37",
    },
  ];

  return (
    <div
      ref={containerRef}
      style={{
        position:       "fixed",
        bottom:         "150px",  // sits above the cart FAB (80px) + gap
        right:          "16px",
        zIndex:         998,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "flex-end",
        gap:            "10px",
      }}
    >
      {/* ── Sub-buttons (slide up from below the primary) ──────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            {subButtons.map((btn, i) => (
              <motion.a
                key={btn.key}
                href={btn.href}
                target="_blank"
                rel="noopener noreferrer"
                custom={subButtons.length - 1 - i}
                variants={subButtonVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={() => setOpen(false)}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            "8px",
                  background:     btn.bg,
                  color:          "#fff",
                  borderRadius:   "40px",
                  padding:        "9px 16px 9px 12px",
                  boxShadow:      "0 4px 16px rgba(0,0,0,0.25)",
                  textDecoration: "none",
                  whiteSpace:     "nowrap",
                  fontSize:       "13px",
                  fontWeight:     700,
                  fontFamily:     "'Cairo','Tajawal',sans-serif",
                  cursor:         "pointer",
                  border:         "none",
                  userSelect:     "none",
                }}
                whileHover={{ scale: 1.06, boxShadow: "0 6px 22px rgba(0,0,0,0.3)" }}
                whileTap={{ scale: 0.96 }}
              >
                {btn.icon}
                <span>{btn.label}</span>
              </motion.a>
            ))}
          </>
        )}
      </AnimatePresence>

      {/* ── Primary FAB ─────────────────────────────────────────────────────── */}
      <motion.button
        onClick={() => setOpen(prev => !prev)}
        aria-label={open ? "إغلاق التنزيل" : "تنزيل التطبيق"}
        animate={{ rotate: open ? 45 : 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        whileHover={{ scale: 1.10 }}
        whileTap={{ scale: 0.92 }}
        style={{
          width:          "52px",
          height:         "52px",
          borderRadius:   "50%",
          background:     open
            ? "linear-gradient(135deg,#B45309 0%,#D97706 100%)"
            : "linear-gradient(135deg,#FFA500 0%,#F59E0B 100%)",
          border:         "none",
          cursor:         "pointer",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          boxShadow:      open
            ? "0 4px 20px rgba(180,83,9,0.5), 0 1px 4px rgba(0,0,0,0.15)"
            : "0 4px 20px rgba(255,165,0,0.5), 0 1px 4px rgba(0,0,0,0.15)",
          transition:     "background 0.25s ease, box-shadow 0.25s ease",
          flexShrink:     0,
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ opacity: 0, rotate: -45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 45 }}
              transition={{ duration: 0.18 }}
              style={{ display: "flex" }}
            >
              <X size={22} color="#fff" strokeWidth={2.5} />
            </motion.span>
          ) : (
            <motion.span
              key="download"
              initial={{ opacity: 0, rotate: 45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -45 }}
              transition={{ duration: 0.18 }}
              style={{ display: "flex" }}
            >
              <Download size={22} color="#fff" strokeWidth={2.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
