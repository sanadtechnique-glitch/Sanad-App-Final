import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, Eye, EyeOff, ChevronDown, LogIn,
  UserPlus, Phone, Lock, User, CheckCircle, MapPin, Search,
} from "lucide-react";
import { setSession, clearSession, type Role } from "@/lib/auth";
import { requestNotificationPermission } from "@/lib/push-notifications";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Tunisia Delegations
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
  "بنقردان": 3, "جرجيس": 5,
  "مدنين الشمالية": 6, "مدنين الجنوبية": 6,
  "جربة - حومة السوق": 8, "جربة - ميدون": 8, "جربة - أجيم": 8,
  "سيدي مخلوف": 4.5, "بني خداش": 7,
};
const DEFAULT_DELIVERY_FEE = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI Components
// ─────────────────────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-black text-[#1A4D1F]/50 uppercase tracking-widest mb-2">
      {children}
    </label>
  );
}

function PhoneInput({
  value, onChange, hasValue,
}: {
  value: string; onChange: (v: string) => void; hasValue?: boolean;
}) {
  return (
    <div className="relative">
      <Phone size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#1A4D1F]/30" />
      <input
        type="tel"
        inputMode="numeric"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="+216 XX XXX XXX"
        dir="ltr"
        className="w-full ps-10 pe-4 py-3.5 rounded-xl border text-[#1A4D1F] font-bold outline-none transition-all placeholder:text-[#1A4D1F]/20 text-left"
        style={{
          background: "#FFFFFF",
          borderColor: hasValue ? "#FFA500" : "rgba(255,165,0,0.3)",
        }}
      />
    </div>
  );
}

function NameInput({
  value, onChange, placeholder, hasValue,
}: {
  value: string; onChange: (v: string) => void; placeholder: string; hasValue?: boolean;
}) {
  return (
    <div className="relative">
      <User size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#1A4D1F]/30" />
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
  value: string; onChange: (v: string) => void; placeholder?: string; hasValue?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#1A4D1F]/30" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "••••••••"}
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
// Login Form — phone + password only
// ─────────────────────────────────────────────────────────────────────────────
function LoginForm() {
  const [, navigate] = useLocation();
  const [phone, setPhone]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const canSubmit = phone.trim() !== "" && password.trim() !== "" && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    clearSession();
    requestNotificationPermission().catch(() => {});

    try {
      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), password: password.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "خطأ في تسجيل الدخول · Erreur de connexion");
        return;
      }

      const role: string = data.role;

      if (["super_admin", "manager", "admin"].includes(role)) {
        setSession({ role: role as Role, name: data.name, userId: data.id, token: data.token });
        navigate("/admin");
        return;
      }

      if (role === "provider") {
        setSession({
          role: "provider",
          name: data.displayName ?? data.name,
          userId: data.id,
          supplierId: data.supplierId,
          token: data.token,
        });
        navigate("/provider");
        return;
      }

      if (role === "driver") {
        setSession({
          role: "delivery",
          name: data.displayName ?? data.name,
          userId: data.id,
          staffId: data.staffId,
          token: data.token,
        });
        navigate("/delivery");
        return;
      }

      if (role === "customer" || role === "client") {
        setSession({ role: "client", name: data.name, userId: data.id, token: data.token });
        navigate("/");
        return;
      }

      if (role === "taxi_driver") {
        setSession({ role: "taxi_driver", name: data.name, userId: data.id, token: data.token });
        navigate("/taxi-driver");
        return;
      }

      setError("دور المستخدم غير معروف · Rôle utilisateur inconnu");
    } catch {
      setError("حدث خطأ في الاتصال · Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
      {/* Phone */}
      <div>
        <FieldLabel>رقم الهاتف · Téléphone</FieldLabel>
        <PhoneInput
          value={phone}
          onChange={v => { setPhone(v); setError(null); }}
          hasValue={phone.length > 0}
        />
      </div>

      {/* Password */}
      <div>
        <FieldLabel>كلمة السر · Mot de passe</FieldLabel>
        <PasswordInput
          value={password}
          onChange={v => { setPassword(v); setError(null); }}
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
// Sign Up Form — phone as unique ID, name, delegation, password
// ─────────────────────────────────────────────────────────────────────────────
function SignUpForm() {
  const [, navigate] = useLocation();
  const [phone, setPhone]         = useState("");
  const [name, setName]           = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);

  const [delegationName, setDelegationName]     = useState<string>("بنقردان");
  const [delegationOpen, setDelegationOpen]     = useState(false);
  const [delegationSearch, setDelegationSearch] = useState("");
  const [dateOfBirth, setDateOfBirth]           = useState("");

  // Max date: must be 18+ years old (today minus 18 years)
  const today = new Date();
  const maxDobDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
    .toISOString().split("T")[0];

  const isUnder18 = (dob: string): boolean => {
    if (!dob) return false;
    const d = new Date(dob);
    if (isNaN(d.getTime())) return false;
    const threshold = new Date(d.getFullYear() + 18, d.getMonth(), d.getDate());
    return new Date() < threshold;
  };

  const canSubmit =
    phone.trim() !== "" &&
    name.trim()  !== "" &&
    dateOfBirth  !== "" &&
    !isUnder18(dateOfBirth) &&
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

    if (!dateOfBirth) {
      setError("تاريخ الميلاد مطلوب · La date de naissance est requise");
      return;
    }
    if (isUnder18(dateOfBirth)) {
      setError("يجب أن يكون عمرك 18 سنة على الأقل · Vous devez avoir au moins 18 ans");
      return;
    }
    if (password !== confirm) {
      setError("كلمة المرور غير متطابقة · Les mots de passe ne correspondent pas");
      return;
    }
    if (password.length < 6) {
      setError("كلمة المرور قصيرة جداً (6 أحرف على الأقل) · Mot de passe trop court (min. 6 caractères)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/auth/client-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          name: name.trim(),
          password: password.trim(),
          dateOfBirth: dateOfBirth.trim(),
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
        token: data.token,
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
      {/* Phone — primary ID */}
      <div>
        <FieldLabel>رقم الهاتف · Téléphone <span className="text-red-400 font-black">*</span></FieldLabel>
        <PhoneInput
          value={phone}
          onChange={v => { setPhone(v); setError(null); }}
          hasValue={phone.length > 0}
        />
        <p className="text-[11px] text-[#1A4D1F]/35 mt-1 text-right">
          سيُستخدم لتسجيل الدخول · Utilisé pour se connecter
        </p>
      </div>

      {/* Name */}
      <div>
        <FieldLabel>الاسم الكامل · Prénom &amp; Nom <span className="text-red-400 font-black">*</span></FieldLabel>
        <NameInput
          value={name}
          onChange={v => { setName(v); setError(null); }}
          placeholder="ما يظهر في طلباتك · Nom affiché"
          hasValue={name.length > 0}
        />
      </div>

      {/* Date of Birth */}
      <div>
        <FieldLabel>تاريخ الميلاد · Date de naissance <span className="text-red-400 font-black">*</span></FieldLabel>
        <div className="relative">
          <svg className="absolute top-1/2 -translate-y-1/2 start-3.5 pointer-events-none z-10 text-[#1A4D1F]/30" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <input
            type="date"
            value={dateOfBirth}
            max={maxDobDate}
            onChange={e => { setDateOfBirth(e.target.value); setError(null); }}
            className="w-full ps-10 pe-4 py-3.5 rounded-xl border-2 text-right font-bold text-[#1A4D1F] outline-none transition-all appearance-none"
            style={{
              background: "#FFFFFF",
              borderColor: dateOfBirth
                ? isUnder18(dateOfBirth)
                  ? "#ef4444"
                  : "rgba(255,165,0,0.8)"
                : "rgba(255,165,0,0.3)",
              colorScheme: "light",
            }}
          />
        </div>
        {dateOfBirth && isUnder18(dateOfBirth) && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-xs font-bold text-red-500 text-right">
              يجب أن يكون عمرك 18 سنة على الأقل · Vous devez avoir au moins 18 ans
            </p>
          </div>
        )}
        {!dateOfBirth && (
          <p className="text-[11px] text-[#1A4D1F]/35 mt-1 text-right">
            يجب أن يكون عمرك 18 سنة فأكثر · Vous devez avoir 18 ans ou plus
          </p>
        )}
      </div>

      {/* Delegation */}
      <div>
        <FieldLabel>المعتمدية · Délégation <span className="text-red-400 font-black">*</span></FieldLabel>
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
              {delegationName || <span className="text-[#1A4D1F]/30 font-normal">اختر منطقتك · Choisissez</span>}
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
                            delegationName === d ? "bg-[#1A4D1F]/15 text-[#1A4D1F]" : "hover:bg-[#1A4D1F]/5 text-[#1A4D1F]/80"
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
      </div>

      {/* Password */}
      <div>
        <FieldLabel>كلمة السر · Mot de passe <span className="text-red-400 font-black">*</span></FieldLabel>
        <PasswordInput
          value={password}
          onChange={v => { setPassword(v); setError(null); }}
          placeholder="6 أحرف على الأقل"
          hasValue={password.length > 0}
        />
      </div>

      {/* Confirm Password */}
      <div>
        <FieldLabel>تأكيد كلمة السر · Confirmer <span className="text-red-400 font-black">*</span></FieldLabel>
        <div className="relative">
          <PasswordInput
            value={confirm}
            onChange={v => { setConfirm(v); setError(null); }}
            placeholder="••••••••"
            hasValue={confirm.length > 0}
          />
          {confirm.length > 0 && password.length > 0 && (
            <div className="absolute top-1/2 -translate-y-1/2 start-10 pointer-events-none">
              {confirm === password
                ? <CheckCircle size={14} className="text-[#1A4D1F]" />
                : <AlertCircle size={14} className="text-red-400" />
              }
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
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Login Page
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"login" | "signup">("login");

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#FFA500" }}
      dir="rtl"
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center mb-8"
        >
          <img
            src="/sanad-logo.svg?v=5"
            alt="سند · Sanad"
            style={{ height: "280px", width: "auto" }}
            draggable={false}
          />
          <p className="text-[#1A4D1F]/50 text-sm mt-3 font-medium text-center">
            سندك في التوصيل.. لباب الدار
          </p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-[20px] border border-[#1A4D1F]/10 shadow-2xl overflow-hidden"
          style={{ background: "#FFFDE7" }}
        >
          {/* Tabs */}
          <div className="flex border-b border-[#1A4D1F]/8" style={{ background: "rgba(255,165,0,0.08)" }}>
            {([
              { id: "login",  labelAr: "تسجيل الدخول", labelFr: "Connexion"   },
              { id: "signup", labelAr: "حساب جديد",     labelFr: "Inscription" },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex-1 py-4 font-black text-sm transition-all border-b-2",
                  tab === t.id
                    ? "text-[#1A4D1F] border-[#1A4D1F]"
                    : "text-[#1A4D1F]/30 border-transparent hover:text-[#1A4D1F]/50"
                )}
              >
                {t.labelAr}
                <span className="block text-[10px] font-normal opacity-50">{t.labelFr}</span>
              </button>
            ))}
          </div>

          {/* Form area */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {tab === "login" ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <LoginForm />
                </motion.div>
              ) : (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <SignUpForm />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center text-[#1A4D1F]/30 text-xs mt-6 font-medium"
        >
          سند · Sanad — بنقردان
        </motion.p>
      </div>
    </div>
  );
}
