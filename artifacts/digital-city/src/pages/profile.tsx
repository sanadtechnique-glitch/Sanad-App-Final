import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Phone, MapPin, Save, ArrowRight, Fingerprint,
  CheckCircle, AlertCircle, Loader2, Trash2, ShieldCheck,
  ChevronLeft,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { useLang } from "@/lib/language";
import { getSession, setSession, type DcSession } from "@/lib/auth";
import {
  isBiometricAvailable, hasBiometricRegistered,
  registerBiometric, clearBiometric,
} from "@/lib/biometric";
import { BiometricEnrollPrompt } from "@/components/biometric-prompt";

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

// ─────────────────────────────────────────────────────────────────────────────
// Helper: fetch with session token
// ─────────────────────────────────────────────────────────────────────────────
function authHeaders(): HeadersInit {
  const session = getSession();
  return session?.token
    ? { "Content-Type": "application/json", "x-session-token": session.token }
    : { "Content-Type": "application/json" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Field components
// ─────────────────────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-black text-[#1A4D1F]/50 uppercase tracking-widest mb-1.5 block text-right">
      {children}
    </label>
  );
}

interface InputFieldProps {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  disabled?: boolean;
}

function InputField({ icon, value, onChange, placeholder, type = "text", inputMode, disabled }: InputFieldProps) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 transition-all"
      style={{
        background: disabled ? "#f5f5f5" : "#FAFEF5",
        borderColor: disabled ? "rgba(26,77,31,0.08)" : "rgba(26,77,31,0.15)",
      }}
    >
      <span className="text-[#1A4D1F]/30 flex-shrink-0">{icon}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        dir="auto"
        className="flex-1 bg-transparent outline-none text-sm font-bold text-right placeholder:text-[#1A4D1F]/25 disabled:text-[#1A4D1F]/40"
        style={{ fontFamily: "'Cairo','Tajawal',sans-serif", color: "#1A4D1F" }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Biometrics Section
// ─────────────────────────────────────────────────────────────────────────────
function BiometricsSection({ sessionJson }: { sessionJson: string }) {
  const { t } = useLang();
  const [bioAvail, setBioAvail]         = useState(false);
  const [registered, setRegistered]     = useState(hasBiometricRegistered());
  const [showEnroll, setShowEnroll]     = useState(false);
  const [removing, setRemoving]         = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setBioAvail);
  }, []);

  if (!bioAvail) return null;

  const handleToggle = () => {
    if (registered) {
      setRemoving(true);
    } else {
      setShowEnroll(true);
    }
  };

  const confirmRemove = () => {
    clearBiometric();
    setRegistered(false);
    setRemoving(false);
  };

  return (
    <>
      <BiometricEnrollPrompt
        visible={showEnroll}
        sessionJson={sessionJson}
        onClose={() => { setShowEnroll(false); setRegistered(hasBiometricRegistered()); }}
      />

      {/* Confirm removal sheet */}
      <AnimatePresence>
        {removing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
            style={{ background: "rgba(26,77,31,0.6)", backdropFilter: "blur(8px)" }}
            onClick={() => setRemoving(false)}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", damping: 24, stiffness: 320 }}
              className="w-full max-w-sm rounded-3xl p-6 text-center"
              style={{ background: "#FFFDE7", border: "1.5px solid rgba(255,165,0,0.3)" }}
              dir="rtl"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-red-50">
                <Trash2 size={24} className="text-red-400" />
              </div>
              <p className="font-black text-[#1A4D1F] text-base mb-1">إلغاء تسجيل البصمة؟</p>
              <p className="text-[#1A4D1F]/40 text-xs mb-5">Supprimer la connexion biométrique ?</p>
              <button onClick={confirmRemove}
                className="w-full py-3.5 rounded-xl font-black text-sm mb-2"
                style={{ background: "#ef4444", color: "white" }}>
                نعم، احذف البصمة · Oui, supprimer
              </button>
              <button onClick={() => setRemoving(false)}
                className="w-full py-2.5 text-sm font-bold"
                style={{ color: "#1A4D1F", opacity: 0.4 }}>
                إلغاء · Annuler
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-2xl p-5 border-2" style={{ borderColor: "rgba(26,77,31,0.12)", background: "#FAFEF5" }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: registered ? "#1A4D1F" : "rgba(26,77,31,0.08)" }}>
              <Fingerprint size={22} style={{ color: registered ? "#FFA500" : "#1A4D1F" }} />
            </div>
            <div className="text-right">
              <p className="font-black text-[#1A4D1F] text-sm">
                {t("الدخول بالبصمة", "Connexion biométrique")}
              </p>
              <p className="text-[#1A4D1F]/40 text-xs mt-0.5">
                {registered
                  ? t("مفعّل على هذا الجهاز", "Activé sur cet appareil")
                  : t("غير مفعّل", "Non activé")}
              </p>
            </div>
          </div>

          {/* Toggle switch */}
          <button
            onClick={handleToggle}
            className="relative flex-shrink-0 w-12 h-6 rounded-full transition-all duration-300"
            style={{ background: registered ? "#1A4D1F" : "rgba(26,77,31,0.15)" }}
          >
            <motion.div
              animate={{ x: registered ? 24 : 2 }}
              transition={{ type: "spring", damping: 18, stiffness: 280 }}
              className="absolute top-0.5 w-5 h-5 rounded-full shadow-md bg-white"
            />
          </button>
        </div>

        {registered && (
          <div className="mt-3 pt-3 border-t border-[#1A4D1F]/8 flex items-center gap-2 justify-end">
            <ShieldCheck size={13} className="text-[#1A4D1F]/40" />
            <p className="text-[10px] font-bold text-[#1A4D1F]/40">
              {t("محمي ببيانات المصادقة البيومترية للجهاز", "Protégé par l'authentification biométrique de l'appareil")}
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

  const [profile,  setProfile]   = useState<UserProfile | null>(null);
  const [loading,  setLoading]   = useState(true);
  const [saving,   setSaving]    = useState(false);
  const [toast,    setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  // Form fields
  const [name,    setName]    = useState("");
  const [phone,   setPhone]   = useState("");
  const [address, setAddress] = useState("");

  // Track dirty state
  const isDirty = profile
    ? name    !== (profile.name ?? "")
      || phone   !== (profile.phone ?? "")
      || address !== (profile.defaultAddress ?? "")
    : false;

  // ── Fetch profile on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!session) { navigate("/auth"); return; }
    fetch("/api/me", { headers: authHeaders() })
      .then(r => r.json())
      .then((data: UserProfile) => {
        setProfile(data);
        setName(data.name ?? "");
        setPhone(data.phone ?? "");
        setAddress(data.defaultAddress ?? "");
      })
      .catch(() => showToast(t("تعذّر تحميل البيانات", "Chargement échoué"), false))
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Save changes ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isDirty || saving || !profile) return;
    setSaving(true);

    const body: Record<string, string> = {};
    if (name    !== profile.name)             body.name    = name;
    if (phone   !== (profile.phone ?? ""))    body.phone   = phone;
    if (address !== (profile.defaultAddress ?? "")) body.defaultAddress = address;

    try {
      const res  = await fetch("/api/me", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || t("خطأ في الحفظ", "Erreur de sauvegarde"), false);
        return;
      }
      setProfile(data);
      setName(data.name ?? "");
      setPhone(data.phone ?? "");
      setAddress(data.defaultAddress ?? "");

      // Update the session name if it changed
      if (session && data.name && data.name !== session.name) {
        setSession({ ...session, name: data.name } as DcSession);
      }

      showToast(t("تم الحفظ بنجاح ✓", "Sauvegarde réussie ✓"), true);
    } catch {
      showToast(t("خطأ في الاتصال", "Erreur réseau"), false);
    } finally {
      setSaving(false);
    }
  };

  // ── Session JSON for biometric re-enrollment ─────────────────────────────
  const sessionJson = localStorage.getItem("dc_session") ?? "";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div
        className="min-h-screen pb-28"
        style={{ background: "linear-gradient(180deg,#f0f7f0 0%,#FFFFFF 180px)", fontFamily: "'Cairo','Tajawal',sans-serif" }}
        dir="rtl"
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
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
            <div className="w-9" /> {/* spacer */}
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
          {/* ── Avatar / Role card ────────────────────────────────────────── */}
          {session && (
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center font-black text-white text-3xl shadow-lg"
                style={{ background: "#1A4D1F" }}
              >
                {session.name?.charAt(0)?.toUpperCase() ?? "؟"}
              </div>
              <div className="text-center">
                <p className="font-black text-[#1A4D1F] text-lg">{profile?.name ?? session.name}</p>
                <span
                  className="text-[10px] font-black px-3 py-1 rounded-full text-white"
                  style={{ background: "#1A4D1F" }}
                >
                  {profile?.role === "customer" ? (t("عميل", "Client")) : profile?.role ?? "—"}
                </span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={32} className="animate-spin text-[#1A4D1F]/40" />
            </div>
          ) : (
            <>
              {/* ── Edit Form ────────────────────────────────────────────── */}
              <div className="rounded-3xl p-5 shadow-sm space-y-4"
                style={{ background: "#fff", border: "1.5px solid rgba(26,77,31,0.1)" }}>
                <h2 className="font-black text-[#1A4D1F] text-sm text-right mb-1 flex items-center justify-end gap-2">
                  <User size={15} />
                  {t("تعديل البيانات الشخصية", "Modifier les informations")}
                </h2>

                <div>
                  <FieldLabel>{t("الاسم الكامل · Nom complet", "Nom complet · الاسم الكامل")}</FieldLabel>
                  <InputField
                    icon={<User size={16} />}
                    value={name}
                    onChange={setName}
                    placeholder={t("الاسم الكامل", "Nom complet")}
                  />
                </div>

                <div>
                  <FieldLabel>{t("رقم الهاتف · Téléphone", "Téléphone · رقم الهاتف")}</FieldLabel>
                  <InputField
                    icon={<Phone size={16} />}
                    value={phone}
                    onChange={setPhone}
                    placeholder="+216 XX XXX XXX"
                    type="tel"
                    inputMode="tel"
                  />
                </div>

                <div>
                  <FieldLabel>{t("عنوان التوصيل الافتراضي", "Adresse de livraison par défaut")}</FieldLabel>
                  <InputField
                    icon={<MapPin size={16} />}
                    value={address}
                    onChange={setAddress}
                    placeholder={t("مثال: شارع الحبيب بورقيبة، بن قردان", "Ex: Rue Habib Bourguiba, Ben Guerdane")}
                  />
                  <p className="text-[10px] text-[#1A4D1F]/35 font-bold text-right mt-1.5">
                    {t("سيتم ملء هذا العنوان تلقائياً عند تقديم طلب جديد",
                       "Cette adresse sera préremplie lors d'une nouvelle commande")}
                  </p>
                </div>

                {/* Save button */}
                <motion.button
                  onClick={handleSave}
                  disabled={!isDirty || saving}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-4 rounded-xl font-black text-base flex items-center justify-center gap-2.5 transition-all"
                  style={{
                    background: isDirty ? "#1A4D1F" : "rgba(26,77,31,0.12)",
                    color: isDirty ? "white" : "rgba(26,77,31,0.3)",
                    boxShadow: isDirty ? "0 4px 20px rgba(26,77,31,0.35)" : "none",
                  }}
                >
                  {saving ? (
                    <><Loader2 size={18} className="animate-spin" />{t("جاري الحفظ...", "Sauvegarde...")}</>
                  ) : (
                    <><Save size={18} />{t("حفظ التغييرات", "Enregistrer")}</>
                  )}
                </motion.button>
              </div>

              {/* ── Biometrics section ───────────────────────────────────── */}
              <div className="rounded-3xl p-5 shadow-sm"
                style={{ background: "#fff", border: "1.5px solid rgba(26,77,31,0.1)" }}>
                <h2 className="font-black text-[#1A4D1F] text-sm text-right mb-4 flex items-center justify-end gap-2">
                  <ShieldCheck size={15} />
                  {t("إدارة الأمان", "Sécurité")}
                </h2>
                <BiometricsSection sessionJson={sessionJson} />
              </div>

              {/* ── Read-only info ───────────────────────────────────────── */}
              {profile?.email && (
                <div className="px-1">
                  <p className="text-[10px] font-bold text-[#1A4D1F]/30 text-right">
                    {t("البريد الإلكتروني", "E-mail")} · <span dir="ltr">{profile.email}</span>
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Toast ───────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2.5 px-5 py-3.5 rounded-2xl shadow-xl"
              style={{ background: toast.ok ? "#1A4D1F" : "#ef4444", color: "white", minWidth: 220, maxWidth: "90vw" }}
            >
              {toast.ok
                ? <CheckCircle size={18} className="flex-shrink-0" />
                : <AlertCircle size={18} className="flex-shrink-0" />}
              <span className="text-sm font-black">{toast.msg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
