import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Phone, MapPin, Save, ArrowRight, Fingerprint,
  CheckCircle, AlertCircle, Loader2, Trash2, ShieldCheck,
  ChevronLeft, Lock, Eye, EyeOff, Mail, Link2, Unlink,
  KeyRound, ChevronRight, RefreshCw,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { useLang } from "@/lib/language";
import { getSession, setSession, type DcSession } from "@/lib/auth";
import {
  isBiometricAvailable, hasBiometricRegistered,
  registerBiometric, clearBiometric,
} from "@/lib/biometric";
import { BiometricEnrollPrompt } from "@/components/biometric-prompt";

// ── Google Identity Services ──────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: Record<string, unknown>) => void;
          prompt: (cb?: (n: { isNotDisplayed: () => boolean }) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}
function loadGIS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("GIS load failed"));
    document.head.appendChild(s);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface UserProfile {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  defaultAddress: string | null;
  dateOfBirth: string | null;
  createdAt: string;
}

interface SecurityStatus {
  googleLinked: boolean;
  hasEmail: boolean;
  maskedEmail: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function authHeaders(): HeadersInit {
  const session = getSession();
  return session?.token
    ? { "Content-Type": "application/json", "x-session-token": session.token }
    : { "Content-Type": "application/json" };
}

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Components
// ─────────────────────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-black text-[#1A4D1F]/50 uppercase tracking-widest mb-1.5 block text-right">
      {children}
    </label>
  );
}

function InputField({
  icon, value, onChange, placeholder, type = "text", inputMode, disabled,
}: {
  icon: React.ReactNode; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all"
      style={{ background: disabled ? "#f5f5f5" : "#FAFEF5", borderColor: disabled ? "rgba(26,77,31,0.08)" : "rgba(26,77,31,0.15)" }}>
      <span className="text-[#1A4D1F]/30 flex-shrink-0">{icon}</span>
      <input type={type} inputMode={inputMode} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled} dir="auto"
        className="flex-1 bg-transparent outline-none text-sm font-bold text-right placeholder:text-[#1A4D1F]/25 disabled:text-[#1A4D1F]/40"
        style={{ fontFamily: "'Cairo','Tajawal',sans-serif", color: "#1A4D1F" }} />
    </div>
  );
}

function PasswordInput({
  value, onChange, placeholder, disabled,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all"
      style={{ background: disabled ? "#f5f5f5" : "#FAFEF5", borderColor: value ? "rgba(26,77,31,0.4)" : "rgba(26,77,31,0.15)" }}>
      <Lock size={15} className="text-[#1A4D1F]/30 flex-shrink-0" />
      <input
        type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "••••••••"} disabled={disabled}
        className="flex-1 bg-transparent outline-none text-sm font-bold text-right placeholder:text-[#1A4D1F]/25"
        style={{ fontFamily: "'Cairo','Tajawal',sans-serif", color: "#1A4D1F" }} />
      <button type="button" onClick={() => setShow(v => !v)}
        className="text-[#1A4D1F]/30 hover:text-[#1A4D1F]/60 transition-colors flex-shrink-0">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Password Strength Indicator
// ─────────────────────────────────────────────────────────────────────────────
function PasswordStrength({ pw }: { pw: string }) {
  if (!pw) return null;
  const score = [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^a-zA-Z0-9]/.test(pw)].filter(Boolean).length;
  const labels = ["ضعيف جداً", "ضعيف", "مقبول", "قوي", "ممتاز"];
  const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#15803d"];
  return (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1">
        {[0,1,2,3].map(i => (
          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i < score ? colors[score] : "rgba(26,77,31,0.08)" }} />
        ))}
      </div>
      <p className="text-[10px] font-bold text-right" style={{ color: colors[score] }}>{labels[score]}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Change Password Section
// ─────────────────────────────────────────────────────────────────────────────
function ChangePasswordSection({ onSuccess }: { onSuccess: (msg: string) => void }) {
  const { t } = useLang();
  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [expanded,   setExpanded]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPw !== confirmPw) {
      setError(t("كلمتا المرور غير متطابقتين", "Les mots de passe ne correspondent pas"));
      return;
    }
    if (newPw.length < 6) {
      setError(t("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "Minimum 6 caractères requis"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setExpanded(false);
      onSuccess(t("تم تغيير كلمة المرور بنجاح ✓", "Mot de passe modifié avec succès ✓"));
    } catch {
      setError(t("خطأ في الاتصال", "Erreur réseau"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden border-2 transition-all"
      style={{ borderColor: expanded ? "rgba(26,77,31,0.2)" : "rgba(26,77,31,0.1)", background: "#FAFEF5" }}>
      {/* Header row */}
      <button type="button" onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-4 transition-colors hover:bg-[#1A4D1F]/3">
        <ChevronRight size={16} className="text-[#1A4D1F]/30 transition-transform"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }} />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(26,77,31,0.08)" }}>
            <KeyRound size={18} style={{ color: "#1A4D1F" }} />
          </div>
          <div className="text-right">
            <p className="font-black text-[#1A4D1F] text-sm">{t("تغيير كلمة المرور", "Modifier le mot de passe")}</p>
            <p className="text-[#1A4D1F]/40 text-xs mt-0.5">{t("اضبط كلمة مرور جديدة لحسابك", "Définir un nouveau mot de passe")}</p>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden">
            <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3">
              <div className="h-px bg-[#1A4D1F]/8 mb-2" />
              <div>
                <FieldLabel>{t("كلمة المرور الحالية", "Mot de passe actuel")}</FieldLabel>
                <PasswordInput value={currentPw} onChange={setCurrentPw}
                  placeholder={t("أدخل كلمة المرور الحالية", "Entrez votre mot de passe actuel")} />
              </div>
              <div>
                <FieldLabel>{t("كلمة المرور الجديدة", "Nouveau mot de passe")}</FieldLabel>
                <PasswordInput value={newPw} onChange={setNewPw}
                  placeholder={t("6 أحرف على الأقل", "Minimum 6 caractères")} />
                <PasswordStrength pw={newPw} />
              </div>
              <div>
                <FieldLabel>{t("تأكيد كلمة المرور الجديدة", "Confirmer le nouveau mot de passe")}</FieldLabel>
                <PasswordInput value={confirmPw} onChange={setConfirmPw}
                  placeholder={t("أعد إدخال كلمة المرور", "Répétez le mot de passe")} />
                {confirmPw && newPw && (
                  <p className={cn("text-[10px] font-bold text-right mt-1", newPw === confirmPw ? "text-emerald-600" : "text-red-500")}>
                    {newPw === confirmPw
                      ? t("✓ كلمتا المرور متطابقتان", "✓ Les mots de passe correspondent")
                      : t("✗ كلمتا المرور غير متطابقتين", "✗ Les mots de passe ne correspondent pas")}
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
                  <AlertCircle size={14} className="text-red-500 shrink-0" />
                  <p className="text-xs font-bold text-red-600 text-right flex-1">{error}</p>
                </div>
              )}

              <motion.button type="submit" disabled={loading || !currentPw || !newPw || !confirmPw}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all"
                style={{
                  background: (currentPw && newPw && confirmPw && !loading) ? "#1A4D1F" : "rgba(26,77,31,0.12)",
                  color: (currentPw && newPw && confirmPw && !loading) ? "white" : "rgba(26,77,31,0.3)",
                  boxShadow: (currentPw && newPw && confirmPw && !loading) ? "0 4px 16px rgba(26,77,31,0.3)" : "none",
                }}>
                {loading
                  ? <><Loader2 size={16} className="animate-spin" />{t("جاري التغيير...", "Modification...")}</>
                  : <><KeyRound size={16} />{t("تغيير كلمة المرور", "Changer le mot de passe")}</>}
              </motion.button>

              <p className="text-[10px] font-bold text-[#1A4D1F]/30 text-center">
                {t("سيتم إرسال تأكيد بريدي إذا كان بريدك مسجلاً","Un email de confirmation sera envoyé si votre adresse est enregistrée")}
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Link Section
// ─────────────────────────────────────────────────────────────────────────────
function GoogleLinkSection({
  securityStatus, onStatusChange, onSuccess, onError,
}: {
  securityStatus: SecurityStatus | null;
  onStatusChange: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useLang();
  const [loading, setLoading] = useState(false);

  const handleLink = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
      onError(t("تسجيل الدخول بـ Google غير مُفعَّل حالياً", "Connexion Google non activée pour le moment"));
      return;
    }
    setLoading(true);
    try {
      await loadGIS();
      window.google!.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: { credential: string }) => {
          try {
            const res = await fetch("/api/auth/link-google", {
              method: "POST",
              headers: authHeaders(),
              body: JSON.stringify({ credential: resp.credential }),
            });
            const data = await res.json();
            if (!res.ok) { onError(data.message); return; }
            onSuccess(t("تم ربط حساب Google بنجاح ✓", "Compte Google lié avec succès ✓"));
            onStatusChange();
          } catch {
            onError(t("خطأ أثناء ربط Google", "Erreur lors de la liaison Google"));
          }
        },
        cancel_on_tap_outside: true,
      });
      window.google!.accounts.id.prompt(notification => {
        if (notification.isNotDisplayed()) {
          setLoading(false);
          onError(t("تعذّر فتح نافذة Google. يرجى المحاولة مرة أخرى.", "Impossible d'ouvrir la fenêtre Google. Réessayez."));
        }
      });
    } catch {
      setLoading(false);
      onError(t("تعذّر تحميل Google Sign-In", "Impossible de charger Google Sign-In"));
    }
  }, [onSuccess, onError, onStatusChange, t]);

  const isLinked = securityStatus?.googleLinked ?? false;

  return (
    <div className="rounded-2xl border-2 px-4 py-4 transition-all"
      style={{ borderColor: isLinked ? "rgba(66,133,244,0.3)" : "rgba(26,77,31,0.1)", background: isLinked ? "rgba(66,133,244,0.04)" : "#FAFEF5" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-shrink-0">
          {isLinked ? (
            <motion.button
              onClick={() => onError(t("لإلغاء ربط Google، تواصل مع الدعم", "Pour délier Google, contactez le support"))}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border transition-all"
              style={{ borderColor: "rgba(239,68,68,0.3)", color: "#ef4444", background: "rgba(239,68,68,0.06)" }}>
              <Unlink size={13} />
              {t("مرتبط", "Lié")}
            </motion.button>
          ) : (
            <motion.button
              onClick={handleLink}
              disabled={loading || !GOOGLE_CLIENT_ID}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border transition-all"
              style={{
                borderColor: "rgba(66,133,244,0.5)",
                color: GOOGLE_CLIENT_ID ? "#4285F4" : "rgba(26,77,31,0.3)",
                background: GOOGLE_CLIENT_ID ? "rgba(66,133,244,0.06)" : "transparent",
              }}>
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
              {loading ? t("جاري الربط...", "Liaison...") : t("ربط الحساب", "Lier")}
            </motion.button>
          )}
        </div>
        <div className="flex items-center gap-3 flex-1 justify-end">
          <div className="text-right">
            <p className="font-black text-[#1A4D1F] text-sm">{t("حساب Google", "Compte Google")}</p>
            <p className="text-[#1A4D1F]/40 text-xs mt-0.5">
              {isLinked
                ? t("مرتبط · تسجيل دخول سريع مفعّل", "Lié · Connexion rapide activée")
                : t("غير مرتبط · اربط للدخول السريع", "Non lié · Associer pour connexion rapide")}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: isLinked ? "rgba(66,133,244,0.12)" : "rgba(26,77,31,0.08)" }}>
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
              <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107"/>
              <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00"/>
              <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
              <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2"/>
            </svg>
          </div>
        </div>
      </div>
      {!GOOGLE_CLIENT_ID && (
        <p className="text-[10px] font-bold text-[#1A4D1F]/30 text-right mt-2">
          {t("ميزة Google Sign-In غير مُفعّلة في هذه البيئة", "Google Sign-In non activé dans cet environnement")}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Biometrics Row
// ─────────────────────────────────────────────────────────────────────────────
function BiometricRow({ sessionJson }: { sessionJson: string }) {
  const { t } = useLang();
  const [bioAvail,   setBioAvail]   = useState(false);
  const [registered, setRegistered] = useState(hasBiometricRegistered());
  const [showEnroll, setShowEnroll] = useState(false);
  const [removing,   setRemoving]   = useState(false);

  useEffect(() => { isBiometricAvailable().then(setBioAvail); }, []);
  if (!bioAvail) return null;

  return (
    <>
      <BiometricEnrollPrompt visible={showEnroll} sessionJson={sessionJson}
        onClose={() => { setShowEnroll(false); setRegistered(hasBiometricRegistered()); }} />

      {/* Confirm removal */}
      <AnimatePresence>
        {removing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
            style={{ background: "rgba(26,77,31,0.6)", backdropFilter: "blur(8px)" }}
            onClick={() => setRemoving(false)}>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 24, stiffness: 320 }}
              className="w-full max-w-sm rounded-3xl p-6 text-center"
              style={{ background: "#FFFDE7", border: "1.5px solid rgba(255,165,0,0.3)" }}
              dir="rtl" onClick={e => e.stopPropagation()}>
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-red-50">
                <Trash2 size={24} className="text-red-400" />
              </div>
              <p className="font-black text-[#1A4D1F] text-base mb-1">
                {t("إلغاء تسجيل البصمة؟", "Supprimer la connexion biométrique ?")}
              </p>
              <p className="text-[#1A4D1F]/40 text-xs mb-5">
                {t("ستحتاج إلى إدخال كلمة المرور في المرة القادمة", "Vous devrez saisir votre mot de passe la prochaine fois")}
              </p>
              <button onClick={() => { clearBiometric(); setRegistered(false); setRemoving(false); }}
                className="w-full py-3.5 rounded-xl font-black text-sm mb-2"
                style={{ background: "#ef4444", color: "white" }}>
                {t("نعم، احذف البصمة", "Oui, supprimer")}
              </button>
              <button onClick={() => setRemoving(false)}
                className="w-full py-2.5 text-sm font-bold"
                style={{ color: "#1A4D1F", opacity: 0.4 }}>
                {t("إلغاء", "Annuler")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-2xl border-2 px-4 py-4 transition-all"
        style={{ borderColor: registered ? "rgba(26,77,31,0.25)" : "rgba(26,77,31,0.1)", background: "#FAFEF5" }}>
        <div className="flex items-center justify-between gap-4">
          <button type="button" onClick={() => registered ? setRemoving(true) : setShowEnroll(true)}
            className="relative flex-shrink-0 w-12 h-6 rounded-full transition-all duration-300"
            style={{ background: registered ? "#1A4D1F" : "rgba(26,77,31,0.15)" }}>
            <motion.div animate={{ x: registered ? 24 : 2 }} transition={{ type: "spring", damping: 18, stiffness: 280 }}
              className="absolute top-0.5 w-5 h-5 rounded-full shadow-md bg-white" />
          </button>
          <div className="flex items-center gap-3 flex-1 justify-end">
            <div className="text-right">
              <p className="font-black text-[#1A4D1F] text-sm">{t("الدخول بالبصمة", "Connexion biométrique")}</p>
              <p className="text-[#1A4D1F]/40 text-xs mt-0.5">
                {registered
                  ? t("مفعّل على هذا الجهاز · بصمة / وجه", "Activé · Empreinte / Face ID")
                  : t("غير مفعّل على هذا الجهاز", "Non activé sur cet appareil")}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: registered ? "#1A4D1F" : "rgba(26,77,31,0.08)" }}>
              <Fingerprint size={20} style={{ color: registered ? "#FFA500" : "#1A4D1F" }} />
            </div>
          </div>
        </div>
        {registered && (
          <div className="mt-3 pt-3 border-t border-[#1A4D1F]/8 flex items-center gap-2 justify-end">
            <ShieldCheck size={12} className="text-emerald-500" />
            <p className="text-[10px] font-bold text-[#1A4D1F]/40">
              {t("محمي بمصادقة الجهاز البيومترية", "Protégé par l'authentification biométrique de l'appareil")}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { t, isRTL } = useLang();
  const [, navigate]  = useLocation();
  const session       = getSession();

  const [profile,         setProfile]         = useState<UserProfile | null>(null);
  const [securityStatus,  setSecurityStatus]  = useState<SecurityStatus | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [saving,          setSaving]          = useState(false);
  const [toast,           setToast]           = useState<{ msg: string; ok: boolean } | null>(null);
  const [activeTab,       setActiveTab]       = useState<"profile" | "security">("profile");

  // Profile form fields
  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [address, setAddress] = useState("");

  const isDirty = profile
    ? name !== (profile.name ?? "") || phone !== (profile.phone ?? "") || address !== (profile.defaultAddress ?? "")
    : false;

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadSecurityStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/security-status", { headers: authHeaders() });
      if (res.ok) setSecurityStatus(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!session) { navigate("/auth"); return; }
    Promise.all([
      fetch("/api/me", { headers: authHeaders() }).then(r => r.json()),
      fetch("/api/auth/security-status", { headers: authHeaders() }).then(r => r.ok ? r.json() : null),
    ]).then(([profileData, secData]: [UserProfile, SecurityStatus | null]) => {
      setProfile(profileData);
      setName(profileData.name ?? "");
      setPhone(profileData.phone ?? "");
      setAddress(profileData.defaultAddress ?? "");
      if (secData) setSecurityStatus(secData);
    }).catch(() => showToast(t("تعذّر تحميل البيانات", "Chargement échoué"), false))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!isDirty || saving || !profile) return;
    setSaving(true);
    const body: Record<string, string> = {};
    if (name    !== profile.name)              body.name    = name;
    if (phone   !== (profile.phone ?? ""))     body.phone   = phone;
    if (address !== (profile.defaultAddress ?? "")) body.defaultAddress = address;

    try {
      const res  = await fetch("/api/me", { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { showToast(data.message || t("خطأ في الحفظ", "Erreur de sauvegarde"), false); return; }
      setProfile(data);
      setName(data.name ?? ""); setPhone(data.phone ?? ""); setAddress(data.defaultAddress ?? "");
      if (session && data.name && data.name !== session.name) setSession({ ...session, name: data.name } as DcSession);
      showToast(t("تم الحفظ بنجاح ✓", "Sauvegarde réussie ✓"), true);
    } catch {
      showToast(t("خطأ في الاتصال", "Erreur réseau"), false);
    } finally {
      setSaving(false);
    }
  };

  const sessionJson = localStorage.getItem("dc_session") ?? "";

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      customer: t("عميل", "Client"),
      provider: t("تاجر", "Vendeur"),
      driver:   t("سائق", "Chauffeur"),
      manager:  t("مدير", "Manager"),
      super_admin: t("مشرف", "Super Admin"),
    };
    return map[role] ?? role;
  };

  return (
    <Layout>
      <div className="min-h-screen pb-28"
        style={{ background: "linear-gradient(180deg,#f0f7f0 0%,#FFFFFF 180px)", fontFamily: "'Cairo','Tajawal',sans-serif" }}
        dir="rtl">

        {/* ── Sticky Header ──────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 px-4 pt-4 pb-3"
          style={{ background: "rgba(240,247,240,0.92)", backdropFilter: "blur(12px)" }}>
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <button onClick={() => window.history.back()}
              className="p-2 rounded-xl transition-colors"
              style={{ color: "#1A4D1F", background: "rgba(26,77,31,0.08)" }}>
              {isRTL ? <ArrowRight size={20} /> : <ChevronLeft size={20} />}
            </button>
            <h1 className="font-black text-[#1A4D1F] text-lg">
              {t("الملف الشخصي", "Mon profil")}
            </h1>
            <div className="w-9" />
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 pt-6 space-y-5">
          {/* ── Avatar card ─────────────────────────────────────────────────── */}
          {session && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center font-black text-white text-3xl shadow-lg"
                style={{ background: "#1A4D1F" }}>
                {session.name?.charAt(0)?.toUpperCase() ?? "؟"}
              </div>
              <div className="text-center">
                <p className="font-black text-[#1A4D1F] text-lg">{profile?.name ?? session.name}</p>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-[10px] font-black px-3 py-1 rounded-full text-white" style={{ background: "#1A4D1F" }}>
                    {profile?.role ? roleLabel(profile.role) : "—"}
                  </span>
                  {securityStatus?.googleLinked && (
                    <span className="text-[10px] font-black px-2 py-1 rounded-full text-white"
                      style={{ background: "#4285F4" }}>
                      G
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Tab Switch ──────────────────────────────────────────────────── */}
          <div className="flex gap-2 p-1.5 rounded-2xl"
            style={{ background: "rgba(26,77,31,0.06)", border: "1.5px solid rgba(26,77,31,0.08)" }}>
            {(["profile", "security"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-all"
                style={{
                  background: activeTab === tab ? "#1A4D1F" : "transparent",
                  color: activeTab === tab ? "white" : "rgba(26,77,31,0.45)",
                  boxShadow: activeTab === tab ? "0 2px 12px rgba(26,77,31,0.3)" : "none",
                }}>
                {tab === "profile" ? <User size={15} /> : <ShieldCheck size={15} />}
                {tab === "profile" ? t("بياناتي", "Mes infos") : t("الأمان", "Sécurité")}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={32} className="animate-spin text-[#1A4D1F]/40" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {/* ── Profile Tab ─────────────────────────────────────────────── */}
              {activeTab === "profile" && (
                <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}
                  className="space-y-5">
                  <div className="rounded-3xl p-5 shadow-sm space-y-4"
                    style={{ background: "#fff", border: "1.5px solid rgba(26,77,31,0.1)" }}>
                    <h2 className="font-black text-[#1A4D1F] text-sm text-right flex items-center justify-end gap-2">
                      <User size={15} />
                      {t("تعديل البيانات الشخصية", "Modifier les informations")}
                    </h2>

                    <div>
                      <FieldLabel>{t("الاسم الكامل", "Nom complet")}</FieldLabel>
                      <InputField icon={<User size={16} />} value={name} onChange={setName}
                        placeholder={t("الاسم الكامل", "Nom complet")} />
                    </div>

                    <div>
                      <FieldLabel>{t("رقم الهاتف", "Téléphone")}</FieldLabel>
                      <InputField icon={<Phone size={16} />} value={phone} onChange={setPhone}
                        placeholder="+216 XX XXX XXX" type="tel" inputMode="tel" />
                    </div>

                    <div>
                      <FieldLabel>{t("عنوان التوصيل الافتراضي", "Adresse de livraison par défaut")}</FieldLabel>
                      <InputField icon={<MapPin size={16} />} value={address} onChange={setAddress}
                        placeholder={t("مثال: شارع الحبيب بورقيبة، بن قردان", "Ex: Rue Habib Bourguiba, Ben Guerdane")} />
                      <p className="text-[10px] text-[#1A4D1F]/35 font-bold text-right mt-1.5">
                        {t("سيتم ملء هذا العنوان تلقائياً عند تقديم طلب جديد",
                           "Cette adresse sera préremplie lors d'une nouvelle commande")}
                      </p>
                    </div>

                    <motion.button onClick={handleSave} disabled={!isDirty || saving}
                      whileTap={{ scale: 0.97 }}
                      className="w-full py-4 rounded-xl font-black text-base flex items-center justify-center gap-2.5 transition-all"
                      style={{
                        background: isDirty ? "#1A4D1F" : "rgba(26,77,31,0.12)",
                        color: isDirty ? "white" : "rgba(26,77,31,0.3)",
                        boxShadow: isDirty ? "0 4px 20px rgba(26,77,31,0.35)" : "none",
                      }}>
                      {saving
                        ? <><Loader2 size={18} className="animate-spin" />{t("جاري الحفظ...", "Sauvegarde...")}</>
                        : <><Save size={18} />{t("حفظ التغييرات", "Enregistrer")}</>}
                    </motion.button>
                  </div>

                  {/* Read-only info */}
                  {profile?.email && (
                    <div className="px-1">
                      <p className="text-[10px] font-bold text-[#1A4D1F]/30 text-right">
                        <Mail size={10} className="inline ml-1" />
                        {t("البريد الإلكتروني", "E-mail")} · <span dir="ltr">{profile.email}</span>
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Security Tab ────────────────────────────────────────────── */}
              {activeTab === "security" && (
                <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}
                  className="space-y-4">

                  {/* Section heading */}
                  <div className="flex items-center justify-between">
                    <button onClick={loadSecurityStatus}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-[#1A4D1F]/40 hover:text-[#1A4D1F]/60 transition-colors">
                      <RefreshCw size={11} />
                      {t("تحديث", "Actualiser")}
                    </button>
                    <h2 className="font-black text-[#1A4D1F] text-sm flex items-center gap-2">
                      <ShieldCheck size={15} />
                      {t("إدارة الأمان", "Gestion de la sécurité")}
                    </h2>
                  </div>

                  {/* Linked email info */}
                  {securityStatus?.maskedEmail && (
                    <div className="flex items-center justify-end gap-2 px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(26,77,31,0.04)", border: "1.5px dashed rgba(26,77,31,0.12)" }}>
                      <p className="text-[11px] font-bold text-[#1A4D1F]/50" dir="ltr">
                        {securityStatus.maskedEmail}
                      </p>
                      <Mail size={12} className="text-[#1A4D1F]/30" />
                      <p className="text-[11px] font-black text-[#1A4D1F]/50">
                        {t("البريد المرتبط:", "E-mail lié :")}
                      </p>
                    </div>
                  )}

                  {/* Change password */}
                  <ChangePasswordSection onSuccess={msg => showToast(msg, true)} />

                  {/* Google link */}
                  <div>
                    <p className="text-[11px] font-black text-[#1A4D1F]/40 uppercase tracking-widest text-right mb-2">
                      {t("طرق تسجيل الدخول", "Méthodes de connexion")}
                    </p>
                    <GoogleLinkSection
                      securityStatus={securityStatus}
                      onStatusChange={loadSecurityStatus}
                      onSuccess={msg => showToast(msg, true)}
                      onError={msg => showToast(msg, false)}
                    />
                  </div>

                  {/* Biometric */}
                  <div>
                    <p className="text-[11px] font-black text-[#1A4D1F]/40 uppercase tracking-widest text-right mb-2">
                      {t("البيومترية", "Biométrie")}
                    </p>
                    <BiometricRow sessionJson={sessionJson} />
                  </div>

                  {/* Forgot password link */}
                  <div className="rounded-2xl border-2 px-4 py-4"
                    style={{ borderColor: "rgba(26,77,31,0.1)", background: "#FAFEF5" }}>
                    <div className="flex items-center justify-between gap-3">
                      <a href="/auth?forgot=1"
                        className="flex items-center gap-1.5 text-xs font-black px-3 py-2 rounded-xl transition-all"
                        style={{ color: "#1A4D1F", background: "rgba(26,77,31,0.08)" }}>
                        <Lock size={12} />
                        {t("إرسال رابط إعادة التعيين", "Envoyer le lien de réinitialisation")}
                      </a>
                      <div className="flex items-center gap-3 flex-1 justify-end">
                        <div className="text-right">
                          <p className="font-black text-[#1A4D1F] text-sm">{t("نسيت كلمة السر؟", "Mot de passe oublié ?")}</p>
                          <p className="text-[#1A4D1F]/40 text-xs mt-0.5">{t("أرسل رابط إعادة التعيين للبريد الإلكتروني", "Lien envoyé par e-mail")}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(26,77,31,0.08)" }}>
                          <KeyRound size={18} style={{ color: "#1A4D1F" }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Security tip */}
                  <div className="px-3 py-3 rounded-xl" style={{ background: "rgba(255,165,0,0.06)", border: "1.5px solid rgba(255,165,0,0.2)" }}>
                    <p className="text-[11px] font-bold text-[#1A4D1F]/60 text-right leading-relaxed">
                      🔐 {t(
                        "عند تغيير كلمة المرور أو ربط حساب Google، سيتم إرسال إشعار أمني إلى بريدك الإلكتروني تلقائياً.",
                        "Lors d'un changement de mot de passe ou d'une liaison Google, une alerte de sécurité sera envoyée automatiquement à votre adresse e-mail."
                      )}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* ── Toast ─────────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-xl"
              style={{ background: toast.ok ? "#1A4D1F" : "#ef4444", color: "white", minWidth: 220, maxWidth: "90vw" }}>
              {toast.ok ? <CheckCircle size={18} className="flex-shrink-0" /> : <AlertCircle size={18} className="flex-shrink-0" />}
              <span className="text-sm font-black">{toast.msg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
