import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SanadBrand } from "@/components/sanad-brand";

interface SplashProps {
  onDone: () => void;
}

export function Splash({ onDone }: SplashProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 2700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: "#FFF3E0" }}
        >
          {/* 3D Sphere */}
          <motion.div
            initial={{ opacity: 0, scale: 0.72 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              width: 210,
              height: 210,
              borderRadius: "50%",
              background: [
                "radial-gradient(circle at 36% 28%,",
                "  rgba(255,245,130,0.72) 0%,",
                "  rgba(255,165,0,0.93)   42%,",
                "  rgba(195,108,0,0.85)   100%)",
              ].join(""),
              boxShadow: [
                "inset 0 5px 16px rgba(255,255,255,0.55)",
                "inset 0 -7px 22px rgba(0,0,0,0.22)",
                "0 16px 52px rgba(27,94,32,0.45)",
                "0 5px 18px rgba(0,0,0,0.22)",
              ].join(", "),
              border: "3px solid rgba(27,94,32,0.72)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}
          >
            <img
              src="/logo.png"
              alt="Sanad"
              style={{ width: 78, height: 68, objectFit: "contain" }}
              draggable={false}
            />
            <h1
              style={{
                fontFamily: "'Cairo','Tajawal',sans-serif",
                color: "#1B5E20",
                fontSize: "1.3rem",
                fontWeight: 900,
                lineHeight: 1,
                margin: 0,
              }}
            >
              <SanadBrand color="#1B5E20" innerColor="#FFA500" />
            </h1>
            <p
              style={{
                fontFamily: "'Cairo','Tajawal',sans-serif",
                color: "rgba(27,94,32,0.82)",
                fontSize: "0.6rem",
                fontWeight: 700,
                textAlign: "center",
                padding: "0 16px",
                margin: 0,
              }}
            >
              <SanadBrand color="#1B5E20" innerColor="#FFA500" style={{ opacity: 0.85 }} />
              {"ك في التوصيل.. لباب الدار"}
            </p>
          </motion.div>

          {/* Dots loader */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="flex gap-2 mt-10"
          >
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="w-2 h-2 rounded-full"
                style={{ background: "#2E7D32" }}
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
