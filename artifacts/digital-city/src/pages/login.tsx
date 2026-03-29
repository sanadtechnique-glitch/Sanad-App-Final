import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Eye, EyeOff, ChevronDown, LogIn } from "lucide-react";
import { get } from "@/lib/admin-api";
import { setSession, type Role } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface Supplier { id: number; name: string; nameAr: string; }
interface Staff    { id: number; name: string; nameAr: string; phone: string; }

type ProfileOption = { value: Role; labelAr: string; labelFr: string; color: string };

const PROFILES: ProfileOption[] = [
  { value: "client",   labelAr: "عميل",         labelFr: "Client",        color: "#60a5fa" },
  { value: "provider", labelAr: "مزود خدمة",    labelFr: "Fournisseur",   color: "#66BB6A" },
  { value: "delivery", labelAr: "سائق توصيل",   labelFr: "Livreur",       color: "#a78bfa" },
  { value: "admin",    labelAr: "مسؤول",         labelFr: "Admin",         color: "#34d399" },
];

const ADMIN_USER = "admin";

export default function LoginPage() {
  const [, navigate] = useLocation();

  const [role, setRole]         = useState<Role>("client");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const profile = PROFILES.find(p => p.value === role)!;
  const canSubmit = username.trim() !== "" && password.trim() !== "" && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (role === "client") {
        setSession({ role: "client", name: username.trim() });
        navigate("/");
        return;
      }

      if (role === "admin") {
        if (username.trim().toLowerCase() !== ADMIN_USER) {
          setError("اسم المستخدم غير صحيح · Identifiant incorrect");
          return;
        }
        setSession({ role: "admin", name: "Admin" });
        navigate("/admin");
        return;
      }

      if (role === "provider") {
        const list = await get<Supplier[]>("/admin/suppliers");
        const found = list.find(
          s => s.nameAr.toLowerCase() === username.trim().toLowerCase() ||
               s.name.toLowerCase()   === username.trim().toLowerCase()
        );
        if (!found) {
          setError("اسم المزود غير موجود · Fournisseur introuvable");
          return;
        }
        setSession({ role: "provider", name: found.nameAr, supplierId: found.id });
        navigate("/provider");
        return;
      }

      if (role === "delivery") {
        const list = await get<Staff[]>("/admin/delivery-staff");
        const found = list.find(
          s => s.nameAr.toLowerCase() === username.trim().toLowerCase() ||
               s.name.toLowerCase()   === username.trim().toLowerCase()
        );
        if (!found) {
          setError("اسم السائق غير موجود · Livreur introuvable");
          return;
        }
        setSession({ role: "delivery", name: found.nameAr, staffId: found.id });
        navigate("/delivery");
        return;
      }
    } catch {
      setError("حدث خطأ في الاتصال · Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: "#E1AD01" }}
      dir="rtl">

      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 50%, rgba(102,187,106,0.06) 0%, transparent 70%)`,
        }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative w-full max-w-md">

        {/* Card */}
        <div
          className="rounded-[24px] border overflow-hidden"
          style={{
            background: "#FFFDE7",
            borderColor: "#66BB6A",
            boxShadow: "0 0 60px -15px rgba(102,187,106,0.35), 0 8px 32px rgba(0,77,64,0.1)",
          }}>

          {/* Header stripe */}
          <div
            className="px-8 pt-8 pb-6 border-b"
            style={{ borderColor: "rgba(102,187,106,0.12)" }}>
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-[68px] h-[68px] rounded-2xl flex items-center justify-center text-2xl font-black"
                style={{
                  background: "rgba(102,187,106,0.12)",
                  border: "2px solid rgba(102,187,106,0.45)",
                  color: "#66BB6A",
                  boxShadow: "0 0 35px -8px rgba(102,187,106,0.55)",
                }}>
                DC
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-black text-[#004D40] tracking-tight">المدينة الرقمية</h1>
                <p className="text-[#004D40]/30 text-xs mt-0.5 font-medium">Digital City · نظام الدخول الموحد</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-5">

            {/* Role dropdown */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black text-[#004D40]/40 uppercase tracking-widest">
                الدور · Profil
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all outline-none text-right"
                  style={{
                    background: "#FFFDE7",
                    borderColor: dropOpen ? "#66BB6A" : "rgba(0,77,64,0.2)",
                  }}>
                  <ChevronDown
                    size={16}
                    className={cn("text-[#004D40]/30 transition-transform", dropOpen && "rotate-180")} />
                  <span className="font-bold text-[#004D40]">
                    {profile.labelAr}
                    <span className="text-[#004D40]/30 font-normal"> · {profile.labelFr}</span>
                  </span>
                </button>

                <AnimatePresence>
                  {dropOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scaleY: 0.9 }}
                      animate={{ opacity: 1, y: 0, scaleY: 1 }}
                      exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full mt-1 w-full rounded-xl border z-50 overflow-hidden"
                      style={{ background: "#D4A800", borderColor: "rgba(102,187,106,0.25)" }}>
                      {PROFILES.map(p => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => { setRole(p.value); setDropOpen(false); setError(null); }}
                          className={cn(
                            "w-full px-4 py-3 flex items-center justify-end gap-3 text-right transition-colors",
                            role === p.value ? "bg-[#004D40]/5" : "hover:bg-[#004D40]/3"
                          )}>
                          <span className="font-bold text-[#004D40] text-sm">
                            {p.labelAr}
                            <span className="text-[#004D40]/30 font-normal"> · {p.labelFr}</span>
                          </span>
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: p.color }} />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black text-[#004D40]/40 uppercase tracking-widest">
                اسم المستخدم · Pseudo
              </label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(null); }}
                autoComplete="username"
                placeholder={
                  role === "admin"    ? "admin" :
                  role === "provider" ? "اسم المزود" :
                  role === "delivery" ? "اسم السائق" :
                  "اسمك"
                }
                className="w-full px-4 py-3.5 rounded-xl border text-[#004D40] font-bold outline-none transition-all placeholder:text-[#004D40]/20 text-right"
                style={{
                  background: "#FFFDE7",
                  borderColor: username ? "#66BB6A" : "rgba(0,77,64,0.2)",
                }}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="block text-[11px] font-black text-[#004D40]/40 uppercase tracking-widest">
                كلمة المرور · Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 rounded-xl border text-[#004D40] font-bold outline-none transition-all placeholder:text-[#004D40]/20 text-right pe-11"
                  style={{
                    background: "#FFFDE7",
                    borderColor: password ? "rgba(102,187,106,0.8)" : "rgba(0,77,64,0.2)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#004D40]/30 hover:text-[#004D40]/60 transition-colors">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/8">
                  <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm font-bold">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black text-black text-base transition-all disabled:opacity-30 mt-2"
              style={{
                background: "#66BB6A",
                boxShadow: canSubmit ? "0 0 30px rgba(102,187,106,0.35)" : "none",
              }}>
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                  <span>جاري التحقق...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>تسجيل الدخول · Connexion</span>
                </>
              )}
            </button>

            {/* Role hint */}
            {(role === "provider" || role === "delivery") && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-[#004D40]/20 text-xs">
                {role === "provider"
                  ? "أدخل اسمك كما هو مسجل في النظام"
                  : "أدخل اسمك كما هو مسجل في قائمة السائقين"}
              </motion.p>
            )}
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[#004D40]/12 text-xs mt-6 font-medium">
          المدينة الرقمية — Digital City · بن قردان، تونس
        </p>
      </motion.div>
    </div>
  );
}
