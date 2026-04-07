import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppLogo } from "@/lib/useAppLogo";

interface SplashProps {
  onDone: () => void;
}

export function Splash({ onDone }: SplashProps) {
  const [visible, setVisible] = useState(true);
  const appLogo = useAppLogo();

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-between"
          style={{ background: "#FFF3E0" }}
          dir="rtl"
        >
          {/* Top spacer */}
          <div style={{ flex: "0 0 6vh" }} />

          {/* Logo — fills most of the screen */}
          <motion.div
            initial={{ opacity: 0, scale: 0.78, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.85, ease: [0.34, 1.56, 0.64, 1] }}
            className="flex flex-col items-center"
            style={{ flex: 1, justifyContent: "center" }}
          >
            <img
              src={appLogo}
              alt="سند · Sanad"
              style={{
                width: "88vw",
                maxWidth: "420px",
                height: "auto",
                maxHeight: "72vh",
                objectFit: "contain",
              }}
              draggable={false}
            />
          </motion.div>

          {/* Bottom area — slogan + dots */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.55 }}
            className="flex flex-col items-center gap-4 pb-10"
          >
            <p
              style={{
                fontFamily: "'Cairo','Tajawal',sans-serif",
                color: "#1A4D1F",
                fontSize: "1.05rem",
                fontWeight: 700,
                textAlign: "center",
                opacity: 0.8,
                letterSpacing: 0.3,
              }}
            >
              سندك في التوصيل.. لباب الدار
            </p>

            {/* Animated dots loader */}
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: "#1A4D1F" }}
                  animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.3, 0.8] }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    delay: i * 0.18,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
