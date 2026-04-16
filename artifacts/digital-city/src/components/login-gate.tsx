import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { LogIn, UserPlus } from "lucide-react";
import { clearGuestMode } from "@/lib/guest";

interface Props {
  visible: boolean;
  onClose: () => void;
  reason?: string;
  reasonFr?: string;
}

export function LoginGateModal({ visible, onClose, reason, reasonFr }: Props) {
  const [, navigate] = useLocation();

  const goLogin = () => {
    clearGuestMode();
    navigate("/auth");
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(26,77,31,0.65)", backdropFilter: "blur(8px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            className="w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden"
            style={{ background: "#FFFDE7", border: "1.5px solid rgba(255,165,0,0.3)" }}
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            {/* Top banner */}
            <div className="px-6 py-5 text-center" style={{ background: "#1A4D1F" }}>
              <img
                src="/sanad-logo-white.svg"
                alt="سند"
                className="h-10 mx-auto mb-3"
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <p className="font-black text-white text-base">مرحباً بك في سند</p>
              <p className="text-white/50 text-xs mt-0.5">Bienvenue sur Sanad</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center space-y-1.5">
                <p className="font-black text-[#1A4D1F] text-base">
                  {reason || "يجب تسجيل الدخول للمتابعة"}
                </p>
                <p className="text-[#1A4D1F]/40 text-sm">
                  {reasonFr || "Connexion requise pour continuer"}
                </p>
              </div>

              <button
                onClick={goLogin}
                className="w-full py-3.5 rounded-xl font-black text-base flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                style={{ background: "#1A4D1F", color: "white", boxShadow: "0 4px 20px rgba(26,77,31,0.4)" }}
              >
                <LogIn size={18} />
                تسجيل الدخول · Se connecter
              </button>

              <button
                onClick={goLogin}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                style={{ background: "rgba(255,165,0,0.12)", color: "#1A4D1F", border: "1px solid rgba(255,165,0,0.3)" }}
              >
                <UserPlus size={15} />
                إنشاء حساب جديد · Créer un compte
              </button>

              <button
                onClick={onClose}
                className="w-full py-2.5 text-center text-sm font-bold transition-colors"
                style={{ color: "#1A4D1F", opacity: 0.4 }}
              >
                متابعة التصفح · Continuer à parcourir
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
