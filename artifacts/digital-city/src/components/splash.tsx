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
    const timer = setTimeout(() => setVisible(false), 2700);
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
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: "#FFF3E0" }}
          dir="rtl"
        >
          {/* Logo mark + wordmark */}
          <motion.div
            initial={{ opacity: 0, scale: 0.82, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.34, 1.56, 0.64, 1] }}
            className="flex flex-col items-center gap-5"
          >
            {/* Sanad logo */}
            <img
              src={appLogo}
              alt="سند · Sanad"
              style={{ height: "360px", width: "auto" }}
              draggable={false}
            />

            {/* Slogan */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              style={{
                fontFamily: "'Cairo','Tajawal',sans-serif",
                color: "#1A4D1F",
                fontSize: "1rem",
                fontWeight: 700,
                textAlign: "center",
                opacity: 0.75,
              }}
            >
              سندك في التوصيل.. لباب الدار
            </motion.p>
          </motion.div>

          {/* Animated dots loader */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="flex gap-2 mt-12"
          >
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ background: "#1A4D1F" }}
                animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.25, 0.8] }}
                transition={{
                  duration: 1.1,
                  repeat: Infinity,
                  delay: i * 0.18,
                  ease: "easeInOut",
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
