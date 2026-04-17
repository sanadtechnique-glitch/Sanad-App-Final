import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, ChevronRight, ArrowRight } from "lucide-react";

// ─── Links ───────────────────────────────────────────────────────────────────
const LINKS = {
  playStore:     "https://play.google.com/store",   // ← replace with your Play Store URL
  appStore:      "https://apps.apple.com",           // ← replace with your App Store URL
  directAndroid: "/downloads/sanad.apk",             // served by Express → uploads/downloads/
  directIos:     "/downloads/sanad.ipa",             // served by Express → uploads/downloads/
};

// ─── Inline SVG brand icons ──────────────────────────────────────────────────
function AndroidIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M17.523 15.341A5 5 0 0 0 20 11a5 5 0 0 0-2.477-4.341l1.292-2.237a.5.5 0 0 0-.868-.5l-1.312 2.27A9.965 9.965 0 0 0 12 5a9.965 9.965 0 0 0-4.635 1.192L6.053 3.922a.5.5 0 1 0-.868.5l1.292 2.237A5 5 0 0 0 4 11a5 5 0 0 0 2.477 4.341C5.57 16.5 5 18.185 5 20h14c0-1.815-.57-3.5-1.477-4.659zM9 13a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
    </svg>
  );
}

function AppleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
}

// ─── Button definitions ───────────────────────────────────────────────────────
type Level = "closed" | "l1" | "l2";

interface SubBtn {
  key:       string;
  labelAr:   string;
  icon:      React.ReactNode;
  bg:        string;
  color:     string;
  shadow:    string;
  href?:     string;
  download?: string;   // filename for HTML download attribute
  action?:   () => void;
  badge?:    string;
}

// ─── Animation variants ───────────────────────────────────────────────────────
const pill = {
  hidden:  { opacity: 0, y: 16, x: 8, scale: 0.82 },
  show: (i: number) => ({
    opacity: 1, y: 0, x: 0, scale: 1,
    transition: {
      delay: i * 0.075,
      type: "spring" as const,
      stiffness: 420, damping: 30,
    },
  }),
  exit: (i: number) => ({
    opacity: 0, x: 20, scale: 0.88,
    transition: { delay: i * 0.04, duration: 0.14 },
  }),
};

// ─── Pill button component ────────────────────────────────────────────────────
function PillBtn({
  btn, index, total, onClose,
}: {
  btn: SubBtn; index: number; total: number; onClose: () => void;
}) {
  const delay = total - 1 - index; // bottom button appears first

  const inner = (
    <motion.div
      custom={delay}
      variants={pill}
      initial="hidden"
      animate="show"
      exit="exit"
      whileHover={{ scale: 1.05, x: -3 }}
      whileTap={{ scale: 0.95 }}
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            "9px",
        background:     btn.bg,
        color:          btn.color,
        borderRadius:   "40px",
        padding:        "9px 18px 9px 13px",
        boxShadow:      btn.shadow,
        whiteSpace:     "nowrap",
        fontSize:       "13px",
        fontWeight:     800,
        fontFamily:     "'Cairo','Tajawal',sans-serif",
        cursor:         "pointer",
        userSelect:     "none" as const,
        direction:      "rtl",
        minWidth:       "170px",
        justifyContent: "flex-start",
      }}
    >
      <span style={{ flexShrink: 0, display: "flex" }}>{btn.icon}</span>
      <span style={{ flex: 1 }}>{btn.labelAr}</span>
      {btn.badge && (
        <span style={{
          fontSize: 9, fontWeight: 900, background: "rgba(255,255,255,0.22)",
          borderRadius: 6, padding: "2px 6px", letterSpacing: "0.02em",
        }}>
          {btn.badge}
        </span>
      )}
      <ChevronRight size={13} style={{ opacity: 0.55, flexShrink: 0, transform: "scaleX(-1)" }} />
    </motion.div>
  );

  if (btn.href && btn.href !== "#") {
    const isDirectDownload = !!btn.download;
    return (
      <a
        href={btn.href}
        target={isDirectDownload ? "_self" : "_blank"}
        rel="noopener noreferrer"
        download={btn.download || undefined}
        style={{ textDecoration: "none" }}
        onClick={onClose}
      >
        {inner}
      </a>
    );
  }

  return (
    <div
      onClick={() => {
        if (btn.action) btn.action();
        else onClose();
      }}
      style={{ textDecoration: "none" }}
    >
      {inner}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function DownloadFAB() {
  const [level, setLevel] = useState<Level>("closed");
  const ref = useRef<HTMLDivElement>(null);

  const open    = level !== "closed";
  const isL2    = level === "l2";

  // Click outside → close
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setLevel("closed");
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // ── Level-1 buttons ─────────────────────────────────────────────────────────
  const l1Buttons: SubBtn[] = [
    {
      key:     "direct",
      labelAr: "تحميل مباشر",
      icon:    <Download size={17} />,
      bg:      "linear-gradient(135deg,#92400E 0%,#B45309 100%)",
      color:   "#fff",
      shadow:  "0 4px 14px rgba(146,64,14,0.45)",
      badge:   "APK · IPA",
      action:  () => setLevel("l2"),
    },
    {
      key:     "appstore",
      labelAr: "متجر آيفون",
      icon:    <AppleIcon />,
      bg:      "linear-gradient(135deg,#1c1c1e 0%,#3a3a3c 100%)",
      color:   "#fff",
      shadow:  "0 4px 14px rgba(0,0,0,0.4)",
      href:    LINKS.appStore,
    },
    {
      key:     "playstore",
      labelAr: "متجر أندرويد",
      icon:    <AndroidIcon />,
      bg:      "linear-gradient(135deg,#14532d 0%,#166534 100%)",
      color:   "#fff",
      shadow:  "0 4px 14px rgba(20,83,45,0.45)",
      href:    LINKS.playStore,
    },
  ];

  // ── Level-2 buttons ─────────────────────────────────────────────────────────
  const l2Buttons: SubBtn[] = [
    {
      key:     "back",
      labelAr: "رجوع للمتاجر",
      icon:    <ArrowRight size={16} style={{ transform: "scaleX(-1)" }} />,
      bg:      "rgba(255,255,255,0.92)",
      color:   "#555",
      shadow:  "0 2px 8px rgba(0,0,0,0.12)",
      action:  () => setLevel("l1"),
    },
    {
      key:      "direct-ios",
      labelAr:  "تحميل مباشر آيفون",
      icon:     <AppleIcon />,
      bg:       "linear-gradient(135deg,#1c1c1e 0%,#3a3a3c 100%)",
      color:    "#fff",
      shadow:   "0 4px 14px rgba(0,0,0,0.4)",
      badge:    "IPA",
      href:     LINKS.directIos,
      download: "sanad.ipa",
    },
    {
      key:      "direct-android",
      labelAr:  "تحميل مباشر أندرويد",
      icon:     <AndroidIcon />,
      bg:       "linear-gradient(135deg,#14532d 0%,#166534 100%)",
      color:    "#fff",
      shadow:   "0 4px 14px rgba(20,83,45,0.45)",
      badge:    "APK",
      href:     LINKS.directAndroid,
      download: "sanad.apk",
    },
  ];

  const current = isL2 ? l2Buttons : l1Buttons;

  return (
    <div
      ref={ref}
      style={{
        position:      "fixed",
        bottom:        "150px",
        right:         "16px",
        zIndex:        998,
        display:       "flex",
        flexDirection: "column",
        alignItems:    "flex-end",
        gap:           "9px",
      }}
    >
      {/* ── Sub-buttons with cascading swap between L1 / L2 ─────────────────── */}
      <AnimatePresence mode="sync">
        {open && current.map((btn, i) => (
          <PillBtn
            key={`${level}-${btn.key}`}
            btn={btn}
            index={i}
            total={current.length}
            onClose={() => setLevel("closed")}
          />
        ))}
      </AnimatePresence>

      {/* ── Level indicator dots ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: "flex", gap: 4, alignSelf: "center",
              marginBottom: -2, marginTop: -2,
            }}
          >
            {(["l1","l2"] as Level[]).map(l => (
              <div key={l} style={{
                width: 5, height: 5, borderRadius: "50%",
                background: level === l ? "#FFA500" : "rgba(255,255,255,0.35)",
                transition: "background 0.25s",
                boxShadow: level === l ? "0 0 6px rgba(255,165,0,0.6)" : "none",
              }} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Primary FAB ──────────────────────────────────────────────────────── */}
      <motion.button
        onClick={() => setLevel(v => v === "closed" ? "l1" : "closed")}
        aria-label={open ? "إغلاق قائمة التنزيل" : "تنزيل التطبيق"}
        animate={{
          rotate:     open ? 45 : 0,
          background: open
            ? ["#B45309", "#B45309"]
            : ["#FFA500", "#FFA500"],
        }}
        transition={{ type: "spring", stiffness: 380, damping: 26 }}
        whileHover={{ scale: 1.10 }}
        whileTap={{ scale: 0.92 }}
        style={{
          width:          "54px",
          height:         "54px",
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
            ? "0 4px 22px rgba(180,83,9,0.55)"
            : "0 4px 22px rgba(255,165,0,0.55)",
          transition:     "background 0.25s ease, box-shadow 0.25s ease",
          flexShrink:     0,
          position:       "relative",
          overflow:       "visible",
        }}
      >
        {/* Ping ring when closed */}
        {!open && (
          <motion.span
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            style={{
              position:     "absolute",
              inset:        0,
              borderRadius: "50%",
              background:   "rgba(255,165,0,0.35)",
              pointerEvents: "none",
            }}
          />
        )}

        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x"
              initial={{ opacity: 0, rotate: -45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 45 }}
              transition={{ duration: 0.18 }}
              style={{ display: "flex" }}
            >
              <X size={22} color="#fff" strokeWidth={2.5} />
            </motion.span>
          ) : (
            <motion.span key="dl"
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
