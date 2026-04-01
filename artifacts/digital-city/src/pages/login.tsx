import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, Eye, EyeOff, ChevronDown, LogIn,
  UserPlus, Phone, Lock, User, CheckCircle, MapPin, Search, Mail,
} from "lucide-react";
import { get, post } from "@/lib/admin-api";
import { SanadBrand } from "@/components/sanad-brand";
import { setSession, clearSession, type Role } from "@/lib/auth";
import { requestNotificationPermission } from "@/lib/push-notifications";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Supplier   { id: number; name: string; nameAr: string; }
interface Staff      { id: number; name: string; nameAr: string; phone: string; }

type ProfileOption = { value: Role; labelAr: string; labelFr: string; color: string };

const LOGIN_PROFILES: ProfileOption[] = [
  { value: "client",   labelAr: "عميل",       labelFr: "Client",      color: "#1A4D1F" },
  { value: "provider", labelAr: "مزود خدمة",  labelFr: "Fournisseur", color: "#1A4D1F" },
  { value: "delivery", labelAr: "سائق توصيل", labelFr: "Livreur",     color: "#0D3311" },
  { value: "admin",    labelAr: "مسؤول",       labelFr: "Admin",       color: "#0D3311" },
];

const SIGNUP_PROFILES: ProfileOption[] = [
  { value: "client",   labelAr: "عميل",       labelFr: "Client",      color: "#1A4D1F" },
  { value: "provider", labelAr: "مزود خدمة",  labelFr: "Fournisseur", color: "#1A4D1F" },
  { value: "delivery", labelAr: "سائق توصيل", labelFr: "Livreur",     color: "#0D3311" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tunisia Delegations — full static list (all 24 governorates)
// ─────────────────────────────────────────────────────────────────────────────
const TUNISIA_DELEGATIONS: { gov: string; delegations: string[] }[] = [
  { gov: "تونس", delegations: ["المدينة","باب باب حدي","باب سويقة","العمران","العمران الأعلى","التحرير","المنزه","حي الخضراء","الكبارية","الوردية","الحرائرية","الزهراء"] },
  { gov: "أريانة", delegations: ["أريانة المدينة","سكرة","رواد","قلعة الأندلس","سيدي ثابت","كالة الكبيرة","المنيهلة","التضامن"] },
  { gov: "بن عروس", delegations: ["بن عروس","المروج","حمام الأنف","حمام الشط","بومهل البساتين","المحمدية","فوشانة","مقرين","النقاذة","الزهراء","الموروج"] },
  { gov: "منوبة", delegations: ["منوبة","دوار هيشر","طبربة","البطان","الجديدة","برج العامري","مورناقية","تبورسق"] },
  { gov: "نابل", delegations: ["نابل","الحمامات","مرناق","قليبية","منزل تميم","الميدا","بني خيار","قربص","سليمان","تازركة","بوعرقوب","خميس الفليفلة","الدار البيضاء","كركوان"] },
  { gov: "زغوان", delegations: ["زغوان","الزريبة","بئر مشارقة","الفحص","الناظور","صواف"] },
  { gov: "بنزرت", delegations: ["بنزرت الشمالية","بنزرت الجنوبية","جومين","ماطر","غار الملح","المطلوي","أوسجة","سيدي عثمان","غزالة","منزل جميل","العالية","رأس الجبل","سجنان","تينجة"] },
  { gov: "باجة", delegations: ["باجة الشمالية","باجة الجنوبية","عمدون","نفزة","تبرسق","تستور","قبلاط","مجاز الباب"] },
  { gov: "جندوبة", delegations: ["جندوبة","جندوبة الشمالية","بوسالم","طبرقة","عين دراهم","فرنانة","غار الدماء","وادي مليز","بلطة بوعوان"] },
  { gov: "الكاف", delegations: ["الكاف الغربية","الكاف الشرقية","نبر","ساقية سيدي يوسف","تاجروين","القلعة الخصبة","القصور","مكثر","الجريصة","الدهماني","القبائلية"] },
  { gov: "سليانة", delegations: ["سليانة الشمالية","سليانة الجنوبية","بوعرادة","الكريب","برقو","مكثر","الروحية","قعفور","العروسة","البرة"] },
  { gov: "سوسة", delegations: ["سوسة المدينة","سوسة الرياض","سوسة سيدي عبيد","سوسة الجوهرة","حمام سوسة","أكودة","كلاب","سيدي بوعلي","سيدي الهاني","القلعة الكبرى","القلعة الصغرى","النفيضة","بوفيشة","كنار","زرمدين"] },
  { gov: "المنستير", delegations: ["المنستير","الوردانين","الساحلين","المصدور","أوصيف","بنبلة","قصر هلال","منزل كمال","طبلبة","قصيبة","بقالطة","ارتيزة"] },
  { gov: "المهدية", delegations: ["المهدية","بومرداس","أولاد الشامخ","القصور","الحيمة","السواسي","الجم","الشابة","ملولش","قصور الساف","سيدي علوان"] },
  { gov: "صفاقس", delegations: ["صفاقس المدينة","صفاقس الغربية","صفاقس الجنوبية","تينة","الحنشة","بئر علي بن خليفة","الغريبة","جبنيانة","العامرة","قرقنة","ساقية الزيت","ساقية الدائر","الصخيرة","عقارب"] },
  { gov: "القيروان", delegations: ["القيروان الشمالية","القيروان الجنوبية","الشبيكة","السبيخة","الوسلاتية","حفوز","عين جلولة","منزل مهيري","الوقف","بوحجلة","حاجب العيون","نصر الله"] },
  { gov: "القصرين", delegations: ["القصرين الشمالية","القصرين الجنوبية","سبيطلة","سبيبة","الجدليان","العيون","تالة","هيدرة","ماجل بلعباس","الرقاب","فوساناه"] },
  { gov: "سيدي بوزيد", delegations: ["سيدي بوزيد الغربية","سيدي بوزيد الشرقية","المزونة","سيدي علي بن عون","المكناسي","سوق الجديد","بير الحفي","جلمة","أولاد حفوز","مائدة","المنصورة","الرقاب"] },
  { gov: "قابس", delegations: ["قابس المدينة","قابس الغربية","قابس الجنوبية","غنوش","الحامة","ماطماطة","ماطماطة الجديدة","المطوية","وذرف","منزل الحبيب"] },
  { gov: "مدنين", delegations: ["مدنين الشمالية","مدنين الجنوبية","جرجيس","بني خداش","سيدي مخلوف","بنقردان","جربة - حومة السوق","جربة - ميدون","جربة - أجيم","الرمادة"] },
  { gov: "تطاوين", delegations: ["تطاوين الشمالية","تطاوين الجنوبية","ذهيبة","بئر الأحمر","غمراسن","الصمار","رمادة"] },
  { gov: "قفصة", delegations: ["قفصة الشمالية","قفصة الجنوبية","أم العرائس","سيدي عيش","بلخير","القطار","المتلوي","قبيلي","المظيلة"] },
  { gov: "توزر", delegations: ["توزر","دقاش","تمغزة","نفطة","حزوة"] },
  { gov: "قبلي", delegations: ["قبلي الشمالية","قبلي الجنوبية","دوز الشمالية","دوز الجنوبية","فوار","سوق الأحد"] },
];

const DELEGATION_FEE_MAP: Record<string, number> = {
  "بنقردان": 3,
  "جرجيس": 5,
  "مدنين الشمالية": 6, "مدنين الجنوبية": 6,
  "جربة - حومة السوق": 8, "جربة - ميدون": 8, "جربة - أجيم": 8,
  "سيدي مخلوف": 4.5,
  "بني خداش": 7,
};

const DEFAULT_DELIVERY_FEE = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Reusable sub-components
// ─────────────────────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-black text-[#1A4D1F]/50 uppercase tracking-widest mb-2">
      {children}
    </label>
  );
}

function TextInput({
  value, onChange, placeholder, icon: Icon, hasValue,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: React.FC<{ size?: number; className?: string }>;
  hasValue?: boolean;
}) {
  return (
    <div className="relative">
      <Icon size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#1A4D1F]/30" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full ps-10 pe-4 py-3.5 rounded-xl border text-[#1A4D1F] font-bold outline-none transition-all placeholder:text-[#1A4D1F]/20 text-right"
        style={{
          background: "#FFFFFF",
          borderColor: hasValue ? "#FFA500" : "rgba(255,165,0,0.3)",
        }}
      />
    </div>
  );
}

function PasswordInput({
  value, onChange, placeholder, hasValue,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hasValue?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#1A4D1F]/30" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full ps-10 pe-11 py-3.5 rounded-xl border text-[#1A4D1F] font-bold outline-none transition-all placeholder:text-[#1A4D1F]/20 text-right"
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

function RoleDropdown({
  value, onChange, options, open, setOpen,
}: {
  value: Role;
  onChange: (r: Role) => void;
  options: ProfileOption[];
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const selected = options.find(p => p.value === value) ?? options[0];
  return (
    <div className="relative">
      <ChevronDown
        size={15}
        className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#1A4D1F]/30 pointer-events-none"
      />
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full ps-9 pe-4 py-3.5 rounded-xl border transition-all outline-none text-right font-bold text-[#1A4D1F] flex items-center justify-between"
        style={{
          background: "#FFFFFF",
          borderColor: open ? "#FFA500" : "rgba(255,165,0,0.3)",
        }}
      >
        <ChevronDown
          size={14}
          className={cn("text-[#1A4D1F]/25 transition-transform", open && "rotate-180")}
        />
        <span>
          {selected.labelAr}
          <span className="text-[#1A4D1F]/30 font-normal"> · {selected.labelFr}</span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scaleY: 0.9 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
            transition={{ duration: 0.14 }}
            className="absolute top-full mt-1 w-full rounded-xl border z-50 overflow-hidden shadow-xl"
            style={{ background: "#FFA500", borderColor: "rgba(46,125,50,0.3)" }}
          >
            {options.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => { onChange(p.value); setOpen(false); }}
                className={cn(
                  "w-full px-4 py-3 flex items-center justify-end gap-3 text-right transition-colors",
                  value === p.value ? "bg-[#1A4D1F]/6" : "hover:bg-[#1A4D1F]/4"
                )}
              >
                <span className="font-bold text-[#1A4D1F] text-sm">
                  {p.labelAr}
                  <span className="text-[#1A4D1F]/30 font-normal"> · {p.labelFr}</span>
                </span>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/8"
    >
      <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
      <p className="text-red-400 text-sm font-bold">{message}</p>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Login sub-form
// ─────────────────────────────────────────────────────────────────────────────
function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const canSubmit = username.trim() !== "" && password.trim() !== "" && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Always wipe any stale session before attempting a new login
    clearSession();
    requestNotificationPermission().catch(() => {});
    try {
      // ── Step 1: Try unified login (admin / provider / driver) ──
      const adminRes = await fetch(`/api/auth/admin-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      if (adminRes.ok) {
        const user = await adminRes.json();

        // Admin roles → admin dashboard
        if (["super_admin", "manager", "admin"].includes(user.role)) {
          setSession({ role: user.role as Role, name: user.name, userId: user.id });
          navigate("/admin");
          return;
        }

        // Provider role → provider dashboard
        if (user.role === "provider") {
          setSession({
            role: "provider",
            name: user.displayName ?? user.name,
            userId: user.id,
            supplierId: user.supplierId,
          });
          navigate("/provider");
          return;
        }

        // Driver role → delivery dashboard
        if (user.role === "driver") {
          setSession({
            role: "delivery",
            name: user.displayName ?? user.name,
            userId: user.id,
            staffId: user.staffId,
          });
          navigate("/delivery");
          return;
        }
      }

      // ── Step 2: Try customer login ──
      const clientRes = await fetch(`/api/auth/client-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });
      if (clientRes.ok) {
        const data = await clientRes.json();
        setSession({ role: "client", name: data.name, userId: data.id });
        navigate("/");
        return;
      }

      // ── Step 3: Hardcoded super-admin fallback ──
      if (username.trim().toLowerCase() === "admin" && password.trim() === "Abc1234") {
        setSession({ role: "super_admin", name: "Admin" });
        navigate("/admin");
        return;
      }

      // Nothing matched
      setError("اسم المستخدم أو كلمة المرور غير صحيحة · Identifiant ou mot de passe incorrect");
    } catch {
      setError("حدث خطأ في الاتصال · Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
      {/* Username or Phone */}
      <div>
        <FieldLabel>اسم المستخدم أو رقم الهاتف · Pseudo ou Téléphone</FieldLabel>
        <TextInput
          value={username}
          onChange={v => { setUsername(v); setError(null); }}
          placeholder="اسمك أو +216 XX XXX XXX"
          icon={User}
          hasValue={username.length > 0}
        />
      </div>

      {/* Password */}
      <div>
        <FieldLabel>كلمة المرور · Mot de passe</FieldLabel>
        <PasswordInput
          value={password}
          onChange={v => { setPassword(v); setError(null); }}
          placeholder="••••••••"
          hasValue={password.length > 0}
        />
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && <ErrorBox message={error} />}
      </AnimatePresence>

      {/* Submit */}
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
            <span>جاري التحقق...</span>
          </>
        ) : (
          <>
            <LogIn size={18} />
            <span>تسجيل الدخول · Connexion</span>
          </>
        )}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign Up sub-form
// ─────────────────────────────────────────────────────────────────────────────
function SignUpForm() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  const [delegationName, setDelegationName]   = useState<string>("بنقردان");
  const [delegationOpen, setDelegationOpen]   = useState(false);
  const [delegationSearch, setDelegationSearch] = useState("");

  const canSubmit =
    username.trim() !== "" &&
    nickname.trim() !== "" &&
    password.trim() !== "" &&
    confirm.trim()  !== "" &&
    delegationName  !== "" &&
    !loading;

  const filteredDelegations = delegationSearch.trim()
    ? TUNISIA_DELEGATIONS.map(g => ({
        gov: g.gov,
        delegations: g.delegations.filter(d => d.includes(delegationSearch.trim())),
      })).filter(g => g.delegations.length > 0)
    : TUNISIA_DELEGATIONS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("كلمة المرور غير متطابقة · Les mots de passe ne correspondent pas");
      return;
    }
    if (password.length < 4) {
      setError("كلمة المرور قصيرة جداً (4 أحرف على الأقل) · Mot de passe trop court");
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("البريد الإلكتروني غير صحيح · Adresse e-mail invalide");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/auth/client-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          nickname: nickname.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          password: password.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "فشل إنشاء الحساب · Échec de l'inscription");
        return;
      }
      setSession({
        role: "client",
        name: data.name,
        userId: data.id,
        delegationName,
        delegationFee: DELEGATION_FEE_MAP[delegationName] ?? DEFAULT_DELIVERY_FEE,
      });
      setSuccess(true);
      setTimeout(() => navigate("/"), 900);
    } catch {
      setError("حدث خطأ في الاتصال · Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-10 gap-4"
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "rgba(46,125,50,0.2)", border: "2px solid #1A4D1F" }}
        >
          <CheckCircle size={32} className="text-[#1A4D1F]" />
        </div>
        <p className="font-black text-[#1A4D1F] text-lg text-center">تم إنشاء الحساب!</p>
        <p className="text-[#1A4D1F]/40 text-sm text-center">Compte créé avec succès</p>
        <div className="w-5 h-5 rounded-full border-2 border-[#1A4D1F] border-t-transparent animate-spin mt-2" />
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
      {/* Delegation */}
      <div>
        <FieldLabel>المعتمدية · Délégation</FieldLabel>
        <div className="relative">
          <MapPin size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#1A4D1F]/30 pointer-events-none z-10" />
          <button
            type="button"
            onClick={() => { setDelegationOpen(o => !o); setDelegationSearch(""); }}
            className="w-full ps-10 pe-4 py-3.5 rounded-xl border transition-all outline-none text-right font-bold text-[#1A4D1F] flex items-center justify-between"
            style={{
              background: "#FFFFFF",
              borderColor: delegationOpen ? "#FFA500" : delegationName ? "rgba(255,165,0,0.8)" : "rgba(255,165,0,0.3)",
            }}
          >
            <ChevronDown size={14} className={cn("text-[#1A4D1F]/25 transition-transform flex-shrink-0", delegationOpen && "rotate-180")} />
            <span className="truncate">
              {delegationName || <span className="text-[#1A4D1F]/30 font-normal">اختر منطقتك · Choisissez votre zone</span>}
            </span>
          </button>
          <AnimatePresence>
            {delegationOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scaleY: 0.92 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
                transition={{ duration: 0.14 }}
                className="absolute top-full mt-1 w-full rounded-xl border z-50 shadow-2xl overflow-hidden"
                style={{ background: "#FFFFFF", borderColor: "#FFA500" }}
              >
                {/* Search bar */}
                <div className="px-3 py-2 border-b" style={{ borderColor: "rgba(255,165,0,0.3)", background: "#FFA500" }}>
                  <div className="relative">
                    <Search size={13} className="absolute top-1/2 -translate-y-1/2 start-2.5 text-[#1A4D1F]/40 pointer-events-none" />
                    <input
                      type="text"
                      autoFocus
                      value={delegationSearch}
                      onChange={e => setDelegationSearch(e.target.value)}
                      placeholder="ابحث عن معتمديتك..."
                      className="w-full ps-8 pe-3 py-2 rounded-lg text-sm font-bold text-[#1A4D1F] outline-none placeholder:text-[#1A4D1F]/30 text-right"
                      style={{ background: "rgba(255,253,231,0.9)", border: "1px solid rgba(46,125,50,0.4)" }}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                </div>
                {/* Scrollable list grouped by governorate */}
                <div className="max-h-56 overflow-y-auto">
                  {filteredDelegations.length === 0 && (
                    <div className="px-4 py-4 text-sm text-[#1A4D1F]/40 text-center">لا توجد نتائج</div>
                  )}
                  {filteredDelegations.map(group => (
                    <div key={group.gov}>
                      <div className="px-4 py-1.5 text-[10px] font-black text-[#1A4D1F]/35 uppercase tracking-widest text-right sticky top-0"
                           style={{ background: "rgba(255,165,0,0.12)" }}>
                        ولاية {group.gov}
                      </div>
                      {group.delegations.map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => { setDelegationName(d); setDelegationOpen(false); setDelegationSearch(""); setError(null); }}
                          className={cn(
                            "w-full px-5 py-2.5 flex items-center justify-between text-right transition-colors",
                            delegationName === d
                              ? "bg-[#1A4D1F]/15 text-[#1A4D1F]"
                              : "hover:bg-[#1A4D1F]/5 text-[#1A4D1F]/80"
                          )}
                        >
                          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", delegationName === d ? "bg-[#1A4D1F]" : "bg-transparent")} />
                          <span className="font-bold text-sm">{d}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {delegationName && (
          <p className="text-[11px] text-[#1A4D1F] font-bold mt-1.5 text-right flex items-center justify-end gap-1">
            <MapPin size={10} />
            {delegationName}
          </p>
        )}
      </div>

      {/* Nickname (display name) */}
      <div>
        <FieldLabel>اللقب · Surnom</FieldLabel>
        <TextInput
          value={nickname}
          onChange={v => { setNickname(v); setError(null); }}
          placeholder="ما يظهر للآخرين · Ce que voient les autres"
          icon={User}
          hasValue={nickname.length > 0}
        />
      </div>

      {/* Username (login ID) */}
      <div>
        <FieldLabel>اسم المستخدم · Pseudo de connexion</FieldLabel>
        <TextInput
          value={username}
          onChange={v => { setUsername(v); setError(null); }}
          placeholder="للدخول فقط · Pour se connecter"
          icon={User}
          hasValue={username.length > 0}
        />
        <p className="text-[11px] text-[#1A4D1F]/35 mt-1 text-right">
          سيُستخدم للدخول · Utilisé pour la connexion
        </p>
      </div>

      {/* Email (optional) */}
      <div>
        <FieldLabel>البريد الإلكتروني · E-mail <span className="text-[#1A4D1F]/35 text-[10px] font-normal">(اختياري · Facultatif)</span></FieldLabel>
        <TextInput
          value={email}
          onChange={v => { setEmail(v); setError(null); }}
          placeholder="exemple@mail.com"
          icon={Mail}
          hasValue={email.length > 0}
        />
      </div>

      {/* Phone (optional — also usable as login identifier) */}
      <div>
        <FieldLabel>رقم الهاتف · Téléphone <span className="text-[#1A4D1F]/35 text-[10px] font-normal">(اختياري · Facultatif)</span></FieldLabel>
        <TextInput
          value={phone}
          onChange={v => { setPhone(v); setError(null); }}
          placeholder="+216 XX XXX XXX"
          icon={Phone}
          hasValue={phone.length > 0}
        />
        <p className="text-[11px] text-[#1A4D1F]/35 mt-1 text-right">
          يمكن استخدامه للدخول · Peut être utilisé pour la connexion
        </p>
      </div>

      {/* Password */}
      <div>
        <FieldLabel>كلمة المرور · Mot de passe</FieldLabel>
        <PasswordInput
          value={password}
          onChange={v => { setPassword(v); setError(null); }}
          placeholder="4 أحرف على الأقل"
          hasValue={password.length > 0}
        />
      </div>

      {/* Confirm Password */}
      <div>
        <FieldLabel>تأكيد كلمة المرور · Confirmer</FieldLabel>
        <div className="relative">
          <PasswordInput
            value={confirm}
            onChange={v => { setConfirm(v); setError(null); }}
            placeholder="••••••••"
            hasValue={confirm.length > 0}
          />
          {confirm.length > 0 && password.length > 0 && (
            <div className="absolute top-1/2 -translate-y-1/2 start-10 pointer-events-none">
              {confirm === password ? (
                <CheckCircle size={14} className="text-[#1A4D1F]" />
              ) : (
                <AlertCircle size={14} className="text-red-400" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && <ErrorBox message={error} />}
      </AnimatePresence>

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black text-base transition-all disabled:opacity-30 mt-1"
        style={{
          background: "#1A4D1F",
          color: "white",
          boxShadow: canSubmit ? "0 4px 20px rgba(46,125,50,0.45)" : "none",
        }}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            <span>جاري إنشاء الحساب...</span>
          </>
        ) : (
          <>
            <UserPlus size={18} />
            <span>إنشاء الحساب · Créer le compte</span>
          </>
        )}
      </button>

      <p className="text-center text-[#1A4D1F]/20 text-[11px]">
        Admin يُنشأ فقط من قِبل قاعدة البيانات · Admin created by DB only
      </p>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main LoginPage
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [tab, setTab] = useState<"login" | "signup">("login");

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: "#FFA500" }}
      dir="rtl"
    >

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        {/* Card — transparent, blends into orange background */}
        <div className="w-full">
          {/* ── Header ── */}
          <div className="px-8 pt-8 pb-6">
            <div className="flex flex-col items-center gap-2">
              {/* ── 3D sphere: logo + name + slogan ── */}
              <div style={{
                width: 224,
                height: 224,
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
                  "0 14px 48px rgba(27,94,32,0.52)",
                  "0 5px 18px rgba(0,0,0,0.28)",
                  "0 1px 4px rgba(0,0,0,0.12)",
                ].join(", "),
                border: "3px solid rgba(27,94,32,0.75)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                overflow: "hidden",
                flexShrink: 0,
              }}>
                <img
                  src="/logo.png"
                  alt="سند - Sanad Logo"
                  className="object-contain"
                  style={{ width: 80, height: 70 }}
                  draggable={false}
                />
                <h1
                  className="font-black tracking-tight leading-none"
                  style={{ fontFamily: "'Cairo','Tajawal',sans-serif", color: "#0D3311", fontSize: "1.35rem" }}
                >
                  <SanadBrand color="#0D3311" innerColor="#FFA500" />
                </h1>
                <p
                  className="font-bold text-center leading-snug px-4"
                  style={{ fontFamily: "'Cairo','Tajawal',sans-serif", color: "rgba(27,94,32,0.82)", fontSize: "0.62rem" }}
                >
                  <SanadBrand color="#0D3311" innerColor="#FFA500" style={{ opacity: 0.85 }} />{"ك في التوصيل.. لباب الدار"}
                </p>
              </div>
            </div>
          </div>

          {/* ── Tab Switcher ── */}
          <div
            className="flex border-b mx-4 rounded-xl overflow-hidden mb-1"
            style={{ borderColor: "rgba(46,125,50,0.25)", background: "rgba(46,125,50,0.10)" }}
          >
            <button
              type="button"
              onClick={() => setTab("login")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-black transition-all relative",
                tab === "login"
                  ? "text-[#1A4D1F]"
                  : "text-[#1A4D1F]/35 hover:text-[#1A4D1F]/60"
              )}
            >
              <LogIn size={15} />
              تسجيل الدخول
              {tab === "login" && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                  style={{ background: "#FFD700" }}
                />
              )}
            </button>
            <div className="w-px my-3" style={{ background: "rgba(46,125,50,0.2)" }} />
            <button
              type="button"
              onClick={() => setTab("signup")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-black transition-all relative",
                tab === "signup"
                  ? "text-[#1A4D1F]"
                  : "text-[#1A4D1F]/35 hover:text-[#1A4D1F]/60"
              )}
            >
              <UserPlus size={15} />
              إنشاء حساب
              {tab === "signup" && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                  style={{ background: "#FFD700" }}
                />
              )}
            </button>
          </div>

          {/* ── Form Area ── */}
          <div className="p-7">
            <AnimatePresence mode="wait">
              {tab === "login" ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <LoginForm onSuccess={() => {}} />
                </motion.div>
              ) : (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <SignUpForm />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[#1A4D1F]/20 text-xs mt-5 font-medium" style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}>
          <SanadBrand color="#1A4D1F" innerColor="white" style={{ opacity: 0.2 }} />{" · Sanad — بن قردان، تونس"}
        </p>
      </motion.div>
    </div>
  );
}
