import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Fingerprint, X, ShieldCheck, Loader2 } from "lucide-react";
import { registerBiometric } from "@/lib/biometric";

interface Props {
  visible: boolean;
  sessionJson: string;
  onClose: () => void;
}

export function BiometricEnrollPrompt({ visible, sessionJson, onClose }: Props) {
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);

  const handleEnable = async () => {
    setLoading(true);
    setError(null);
    const ok = await registerBiometric(sessionJson);
    setLoading(false);
    if (ok) {
      setSuccess(true);
      setTimeout(onClose, 1800);
    } else {
      setError("تعذّر التسجيل. حاول مرة أخرى · Échec de l'enregistrement");
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(26,77,31,0.6)", backdropFilter: "blur(8px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            className="relative w-full max-w-sm rounded-3xl p-7 shadow-2xl text-center"
            style={{ background: "#FFFDE7", border: "1.5px solid rgba(255,165,0,0.3)" }}
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 end-4 p-1.5 rounded-xl transition-colors"
              style={{ color: "#1A4D1F", opacity: 0.3 }}
            >
              <X size={16} />
            </button>

            {success ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="space-y-3"
              >
                <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ background: "#1A4D1F" }}>
                  <ShieldCheck size={30} className="text-[#FFA500]" />
                </div>
                <p className="font-black text-[#1A4D1F] text-lg">تم التفعيل!</p>
                <p className="text-[#1A4D1F]/50 text-sm">Biométrie activée avec succès</p>
              </motion.div>
            ) : (
              <>
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                  style={{ background: "#1A4D1F" }}
                >
                  <Fingerprint size={30} className="text-[#FFA500]" />
                </div>

                <h2 className="font-black text-[#1A4D1F] text-lg mb-1">
                  تفعيل الدخول بالبصمة
                </h2>
                <p className="text-[#1A4D1F]/40 text-xs mb-1">Activer la connexion biométrique</p>
                <p className="text-[#1A4D1F]/60 text-sm mb-6 leading-relaxed">
                  ادخل بسرعة في المرات القادمة باستخدام بصمة الإصبع أو Face ID
                  <span className="block text-xs text-[#1A4D1F]/35 mt-1" dir="ltr">
                    Next time, sign in instantly with your fingerprint or Face ID.
                  </span>
                </p>

                {error && (
                  <p className="text-red-400 text-sm mb-4 font-bold">{error}</p>
                )}

                <button
                  onClick={handleEnable}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl font-black text-base flex items-center justify-center gap-2.5 mb-3 transition-all disabled:opacity-60"
                  style={{ background: "#1A4D1F", color: "white", boxShadow: "0 4px 20px rgba(26,77,31,0.4)" }}
                >
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /> جاري التسجيل...</>
                  ) : (
                    <><Fingerprint size={18} /> تفعيل البصمة · Activer</>
                  )}
                </button>

                <button
                  onClick={onClose}
                  className="w-full py-2.5 text-sm font-bold transition-colors"
                  style={{ color: "#1A4D1F", opacity: 0.35 }}
                >
                  لاحقاً · Plus tard
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
