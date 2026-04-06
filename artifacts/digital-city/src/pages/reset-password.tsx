import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, KeyRound, ArrowRight } from "lucide-react";

function PasswordInput({
  value,
  onChange,
  placeholder,
  hasValue,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hasValue?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#1A4D1F]/30 pointer-events-none" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "••••••••"}
        className="w-full ps-10 pe-11 py-3.5 rounded-xl border text-[#1A4D1F] font-bold outline-none transition-all placeholder:text-[#1A4D1F]/20"
        style={{
          background: "#FFFFFF",
          borderColor: hasValue ? "rgba(46,125,50,0.8)" : "rgba(46,125,50,0.18)",
        }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute top-1/2 -translate-y-1/2 end-3.5 text-[#1A4D1F]/30 hover:text-[#1A4D1F]/60 transition-colors"
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();

  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid]   = useState(false);
  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setValidating(false);
      return;
    }
    fetch(`/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then((d: { valid: boolean }) => {
        setTokenValid(d.valid);
        setValidating(false);
      })
      .catch(() => {
        setTokenValid(false);
        setValidating(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("كلمة المرور قصيرة جداً (6 أحرف على الأقل) · Mot de passe trop court");
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين · Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "حدث خطأ · Une erreur s'est produite");
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate("/auth"), 2500);
    } catch {
      setError("حدث خطأ في الاتصال · Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = password.length >= 6 && confirm.length >= 1 && !loading;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#FFF3E0" }}
      dir="rtl"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Card */}
        <div
          className="rounded-3xl p-8 shadow-2xl border"
          style={{
            background: "#FFFFFF",
            borderColor: "rgba(255,165,0,0.2)",
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
              style={{ background: "#1A4D1F" }}
            >
              <KeyRound size={28} className="text-[#FFA500]" />
            </div>
            <h1 className="font-black text-[#1A4D1F] text-xl text-center">
              إعادة تعيين كلمة المرور
            </h1>
            <p className="text-[#1A4D1F]/40 text-sm text-center mt-1">
              Réinitialisation du mot de passe
            </p>
          </div>

          {/* Loading state */}
          {validating && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-8 h-8 rounded-full border-3 border-[#1A4D1F]/20 border-t-[#FFA500] animate-spin" />
              <p className="text-[#1A4D1F]/50 text-sm">جاري التحقق... · Vérification...</p>
            </div>
          )}

          {/* Invalid token */}
          {!validating && !tokenValid && (
            <div className="text-center space-y-5">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background: "rgba(239,68,68,0.1)" }}
              >
                <AlertCircle size={28} className="text-red-500" />
              </div>
              <p className="font-bold text-[#1A4D1F] text-base">
                الرابط غير صالح أو منتهي الصلاحية
              </p>
              <p className="text-[#1A4D1F]/50 text-sm">
                Lien invalide ou expiré — veuillez en demander un nouveau.
              </p>
              <button
                onClick={() => navigate("/auth")}
                className="w-full py-3 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all"
                style={{ background: "#1A4D1F" }}
              >
                <ArrowRight size={16} />
                <span>العودة لتسجيل الدخول · Retour</span>
              </button>
            </div>
          )}

          {/* Success */}
          {!validating && tokenValid && success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-4"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "rgba(46,125,50,0.15)" }}
              >
                <CheckCircle size={32} className="text-[#1A4D1F]" />
              </div>
              <p className="font-black text-[#1A4D1F] text-lg text-center">
                تم تغيير كلمة المرور!
              </p>
              <p className="text-[#1A4D1F]/40 text-sm text-center">
                Mot de passe réinitialisé avec succès
              </p>
              <div className="w-5 h-5 rounded-full border-2 border-[#1A4D1F] border-t-transparent animate-spin mt-2" />
            </motion.div>
          )}

          {/* Reset form */}
          {!validating && tokenValid && !success && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[11px] font-black text-[#1A4D1F]/50 uppercase tracking-widest mb-2">
                  كلمة المرور الجديدة · Nouveau mot de passe <span className="text-red-400">*</span>
                </label>
                <PasswordInput
                  value={password}
                  onChange={v => { setPassword(v); setError(null); }}
                  placeholder="6 أحرف على الأقل"
                  hasValue={password.length > 0}
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-[#1A4D1F]/50 uppercase tracking-widest mb-2">
                  تأكيد كلمة المرور · Confirmer <span className="text-red-400">*</span>
                </label>
                <PasswordInput
                  value={confirm}
                  onChange={v => { setConfirm(v); setError(null); }}
                  placeholder="أعد كتابة كلمة المرور"
                  hasValue={confirm.length > 0}
                />
                {confirm.length > 0 && password !== confirm && (
                  <p className="text-red-400 text-xs mt-1 font-bold">
                    كلمتا المرور غير متطابقتين · Ne correspondent pas
                  </p>
                )}
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/8"
                  >
                    <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-sm font-bold">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black text-base transition-all disabled:opacity-30"
                style={{
                  background: "#1A4D1F",
                  color: "white",
                  boxShadow: canSubmit ? "0 4px 20px rgba(46,125,50,0.45)" : "none",
                }}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <KeyRound size={17} />
                    <span>تعيين كلمة المرور الجديدة · Réinitialiser</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="w-full py-2.5 rounded-xl font-bold text-sm text-[#1A4D1F]/50 hover:text-[#1A4D1F] transition-colors"
              >
                العودة لتسجيل الدخول · Retour à la connexion
              </button>
            </form>
          )}
        </div>

        {/* Sanad branding */}
        <p className="text-center text-[#1A4D1F]/30 text-xs mt-6 font-bold">
          سند · Sanad — بن قردان، تونس
        </p>
      </motion.div>
    </div>
  );
}
