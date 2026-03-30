import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, Eye, EyeOff, ChevronDown, LogIn,
  UserPlus, Phone, Lock, User, CheckCircle, MapPin, Search,
} from "lucide-react";
import { get, post } from "@/lib/admin-api";
import { SanadBrand } from "@/components/sanad-brand";
import { setSession, type Role } from "@/lib/auth";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Supplier   { id: number; name: string; nameAr: string; }
interface Staff      { id: number; name: string; nameAr: string; phone: string; }

type ProfileOption = { value: Role; labelAr: string; labelFr: string; color: string };

const LOGIN_PROFILES: ProfileOption[] = [
  { value: "client",   labelAr: "عميل",       labelFr: "Client",      color: "#2E7D32" },
  { value: "provider", labelAr: "مزود خدمة",  labelFr: "Fournisseur", color: "#4CAF50" },
  { value: "delivery", labelAr: "سائق توصيل", labelFr: "Livreur",     color: "#388E3C" },
  { value: "admin",    labelAr: "مسؤول",       labelFr: "Admin",       color: "#1B5E20" },
];

const SIGNUP_PROFILES: ProfileOption[] = [
  { value: "client",   labelAr: "عميل",       labelFr: "Client",      color: "#2E7D32" },
  { value: "provider", labelAr: "مزود خدمة",  labelFr: "Fournisseur", color: "#4CAF50" },
  { value: "delivery", labelAr: "سائق توصيل", labelFr: "Livreur",     color: "#388E3C" },
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
    <label className="block text-[11px] font-black text-[#2E7D32]/50 uppercase tracking-widest mb-2">
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
      <Icon size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#2E7D32]/30" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full ps-10 pe-4 py-3.5 rounded-xl border text-[#2E7D32] font-bold outline-none transition-all placeholder:text-[#2E7D32]/20 text-right"
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
      <Lock size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#2E7D32]/30" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full ps-10 pe-11 py-3.5 rounded-xl border text-[#2E7D32] font-bold outline-none transition-all placeholder:text-[#2E7D32]/20 text-right"
        style={{
          background: "#FFFFFF",
          borderColor: hasValue ? "rgba(46,125,50,0.8)" : "rgba(46,125,50,0.18)",
        }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute top-1/2 -translate-y-1/2 end-3.5 text-[#2E7D32]/30 hover:text-[#2E7D32]/60 transition-colors"
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
        className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#2E7D32]/30 pointer-events-none"
      />
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full ps-9 pe-4 py-3.5 rounded-xl border transition-all outline-none text-right font-bold text-[#2E7D32] flex items-center justify-between"
        style={{
          background: "#FFFFFF",
          borderColor: open ? "#FFA500" : "rgba(255,165,0,0.3)",
        }}
      >
        <ChevronDown
          size={14}
          className={cn("text-[#2E7D32]/25 transition-transform", open && "rotate-180")}
        />
        <span>
          {selected.labelAr}
          <span className="text-[#2E7D32]/30 font-normal"> · {selected.labelFr}</span>
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
                  value === p.value ? "bg-[#2E7D32]/6" : "hover:bg-[#2E7D32]/4"
                )}
              >
                <span className="font-bold text-[#2E7D32] text-sm">
                  {p.labelAr}
                  <span className="text-[#2E7D32]/30 font-normal"> · {p.labelFr}</span>
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
  const [role, setRole]         = useState<Role>("client");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

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
        // Try DB-backed authentication first
        try {
          const res = await fetch(`${import.meta.env.BASE_URL}api/auth/admin-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username.trim(), password: password.trim() }),
          });
          if (res.ok) {
            const user = await res.json();
            const adminRoles = ["super_admin", "manager", "admin"];
            if (adminRoles.includes(user.role)) {
              setSession({ role: user.role, name: user.name, userId: user.id });
              navigate("/admin");
              return;
            } else {
              setError("ليس لديك صلاحية الوصول للوحة التحكم · Accès refusé");
              return;
            }
          }
        } catch {
          // API unreachable — fall through to hardcoded fallback
        }
        // Hardcoded fallback (for backward compat)
        if (username.trim().toLowerCase() !== "admin") {
          setError("اسم المستخدم غير صحيح · Identifiant incorrect");
          return;
        }
        if (password.trim() !== "Abc1234") {
          setError("كلمة المرور غير صحيحة · Mot de passe incorrect");
          return;
        }
        setSession({ role: "admin", name: "Admin" });
        navigate("/admin");
        return;
      }
      if (role === "provider") {
        const list = await get<Supplier[]>("/admin/suppliers");
        const found = list.find(
          s =>
            s.nameAr.toLowerCase() === username.trim().toLowerCase() ||
            s.name.toLowerCase()   === username.trim().toLowerCase()
        );
        if (!found) { setError("اسم المزود غير موجود · Fournisseur introuvable"); return; }
        setSession({ role: "provider", name: found.nameAr, supplierId: found.id });
        navigate("/provider");
        return;
      }
      if (role === "delivery") {
        const list = await get<Staff[]>("/admin/delivery-staff");
        const found = list.find(
          s =>
            s.nameAr.toLowerCase() === username.trim().toLowerCase() ||
            s.name.toLowerCase()   === username.trim().toLowerCase()
        );
        if (!found) { setError("اسم السائق غير موجود · Livreur introuvable"); return; }
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
    <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
      {/* Role */}
      <div>
        <FieldLabel>الدور · Profil</FieldLabel>
        <RoleDropdown
          value={role}
          onChange={r => { setRole(r); setError(null); }}
          options={LOGIN_PROFILES}
          open={dropOpen}
          setOpen={setDropOpen}
        />
      </div>

      {/* Username */}
      <div>
        <FieldLabel>اسم المستخدم · Pseudo</FieldLabel>
        <TextInput
          value={username}
          onChange={v => { setUsername(v); setError(null); }}
          placeholder={
            role === "admin"    ? "admin" :
            role === "provider" ? "اسم المزود كما هو مسجل" :
            role === "delivery" ? "اسم السائق كما هو مسجل" :
            "اسمك"
          }
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
          background: "#2E7D32",
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

      {(role === "provider" || role === "delivery") && (
        <p className="text-center text-[#2E7D32]/25 text-xs">
          {role === "provider"
            ? "أدخل اسمك كما هو مسجل في قائمة المزودين"
            : "أدخل اسمك كما هو مسجل في قائمة السائقين"}
        </p>
      )}
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign Up sub-form
// ─────────────────────────────────────────────────────────────────────────────
function SignUpForm() {
  const [, navigate] = useLocation();
  const [role, setRole]         = useState<Role>("client");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [phone, setPhone]       = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  const [delegationName, setDelegationName]   = useState<string>("بنقردان");
  const [delegationOpen, setDelegationOpen]   = useState(false);
  const [delegationSearch, setDelegationSearch] = useState("");

  const needsPhone = role === "provider" || role === "delivery";
  const canSubmit  =
    username.trim() !== "" &&
    password.trim() !== "" &&
    confirm.trim()  !== "" &&
    delegationName  !== "" &&
    (!needsPhone || phone.trim() !== "") &&
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
    if (needsPhone && !/^\+?[\d\s]{8,}$/.test(phone.trim())) {
      setError("رقم الهاتف غير صحيح · Numéro de téléphone invalide");
      return;
    }

    setLoading(true);
    try {
      const pseudo = username.trim();

      if (role === "client") {
        setSession({
          role: "client",
          name: pseudo,
          delegationName,
          delegationFee: DELEGATION_FEE_MAP[delegationName] ?? DEFAULT_DELIVERY_FEE,
        });
        setSuccess(true);
        setTimeout(() => navigate("/"), 900);
        return;
      }

      if (role === "provider") {
        // Check duplicate
        const existing = await get<Supplier[]>("/admin/suppliers");
        const dup = existing.find(
          s => s.nameAr.toLowerCase() === pseudo.toLowerCase() ||
               s.name.toLowerCase()   === pseudo.toLowerCase()
        );
        if (dup) { setError("هذا الاسم مسجل مسبقاً · Ce nom est déjà utilisé"); return; }

        // Create supplier
        const newSupplier = await post<Supplier>("/admin/suppliers", {
          name: pseudo,
          nameAr: pseudo,
          category: "restaurant",
          description: "",
          descriptionAr: "",
          address: "بن قردان",
          phone: phone.trim(),
          isAvailable: true,
        });
        setSession({
          role: "provider",
          name: newSupplier.nameAr,
          supplierId: newSupplier.id,
          delegationName,
          delegationFee: DELEGATION_FEE_MAP[delegationName] ?? DEFAULT_DELIVERY_FEE,
        });
        setSuccess(true);
        setTimeout(() => navigate("/provider"), 900);
        return;
      }

      if (role === "delivery") {
        // Check duplicate
        const existing = await get<Staff[]>("/admin/delivery-staff");
        const dup = existing.find(
          s => s.nameAr.toLowerCase() === pseudo.toLowerCase() ||
               s.name.toLowerCase()   === pseudo.toLowerCase()
        );
        if (dup) { setError("هذا الاسم مسجل مسبقاً · Ce nom est déjà utilisé"); return; }

        // Create delivery staff
        const newStaff = await post<Staff>("/admin/delivery-staff", {
          name: pseudo,
          nameAr: pseudo,
          phone: phone.trim(),
          isAvailable: true,
        });
        setSession({
          role: "delivery",
          name: newStaff.nameAr,
          staffId: newStaff.id,
          delegationName,
          delegationFee: DELEGATION_FEE_MAP[delegationName] ?? DEFAULT_DELIVERY_FEE,
        });
        setSuccess(true);
        setTimeout(() => navigate("/delivery"), 900);
        return;
      }
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
          style={{ background: "rgba(46,125,50,0.2)", border: "2px solid #2E7D32" }}
        >
          <CheckCircle size={32} className="text-[#2E7D32]" />
        </div>
        <p className="font-black text-[#2E7D32] text-lg text-center">تم إنشاء الحساب!</p>
        <p className="text-[#2E7D32]/40 text-sm text-center">Compte créé avec succès</p>
        <div className="w-5 h-5 rounded-full border-2 border-[#2E7D32] border-t-transparent animate-spin mt-2" />
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
      {/* Role */}
      <div>
        <FieldLabel>الدور · Profil</FieldLabel>
        <RoleDropdown
          value={role}
          onChange={r => { setRole(r); setError(null); }}
          options={SIGNUP_PROFILES}
          open={dropOpen}
          setOpen={setDropOpen}
        />
        {role === "provider" && (
          <p className="text-[11px] text-[#2E7D32]/35 mt-1.5 text-right">
            سيُضاف كمزود خدمة · Vous serez ajouté comme fournisseur
          </p>
        )}
        {role === "delivery" && (
          <p className="text-[11px] text-[#2E7D32]/35 mt-1.5 text-right">
            سيُضاف كسائق توصيل · Vous serez ajouté comme livreur
          </p>
        )}
      </div>

      {/* Delegation */}
      <div>
        <FieldLabel>المعتمدية · Délégation</FieldLabel>
        <div className="relative">
          <MapPin size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#2E7D32]/30 pointer-events-none z-10" />
          <button
            type="button"
            onClick={() => { setDelegationOpen(o => !o); setDelegationSearch(""); }}
            className="w-full ps-10 pe-4 py-3.5 rounded-xl border transition-all outline-none text-right font-bold text-[#2E7D32] flex items-center justify-between"
            style={{
              background: "#FFFFFF",
              borderColor: delegationOpen ? "#FFA500" : delegationName ? "rgba(255,165,0,0.8)" : "rgba(255,165,0,0.3)",
            }}
          >
            <ChevronDown size={14} className={cn("text-[#2E7D32]/25 transition-transform flex-shrink-0", delegationOpen && "rotate-180")} />
            <span className="truncate">
              {delegationName || <span className="text-[#2E7D32]/30 font-normal">اختر منطقتك · Choisissez votre zone</span>}
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
                    <Search size={13} className="absolute top-1/2 -translate-y-1/2 start-2.5 text-[#2E7D32]/40 pointer-events-none" />
                    <input
                      type="text"
                      autoFocus
                      value={delegationSearch}
                      onChange={e => setDelegationSearch(e.target.value)}
                      placeholder="ابحث عن معتمديتك..."
                      className="w-full ps-8 pe-3 py-2 rounded-lg text-sm font-bold text-[#2E7D32] outline-none placeholder:text-[#2E7D32]/30 text-right"
                      style={{ background: "rgba(255,253,231,0.9)", border: "1px solid rgba(46,125,50,0.4)" }}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                </div>
                {/* Scrollable list grouped by governorate */}
                <div className="max-h-56 overflow-y-auto">
                  {filteredDelegations.length === 0 && (
                    <div className="px-4 py-4 text-sm text-[#2E7D32]/40 text-center">لا توجد نتائج</div>
                  )}
                  {filteredDelegations.map(group => (
                    <div key={group.gov}>
                      <div className="px-4 py-1.5 text-[10px] font-black text-[#2E7D32]/35 uppercase tracking-widest text-right sticky top-0"
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
                              ? "bg-[#2E7D32]/15 text-[#2E7D32]"
                              : "hover:bg-[#2E7D32]/5 text-[#2E7D32]/80"
                          )}
                        >
                          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", delegationName === d ? "bg-[#2E7D32]" : "bg-transparent")} />
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
          <p className="text-[11px] text-[#2E7D32] font-bold mt-1.5 text-right flex items-center justify-end gap-1">
            <MapPin size={10} />
            {delegationName}
          </p>
        )}
      </div>

      {/* Username */}
      <div>
        <FieldLabel>الاسم · Pseudo</FieldLabel>
        <TextInput
          value={username}
          onChange={v => { setUsername(v); setError(null); }}
          placeholder={
            role === "provider" ? "اسم المحل أو الخدمة" :
            role === "delivery" ? "اسمك الكامل" :
            "اسمك"
          }
          icon={User}
          hasValue={username.length > 0}
        />
      </div>

      {/* Phone — only for Frs & Livreur */}
      <AnimatePresence>
        {needsPhone && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <FieldLabel>رقم الهاتف · Téléphone</FieldLabel>
            <TextInput
              value={phone}
              onChange={v => { setPhone(v); setError(null); }}
              placeholder="+216 XX XXX XXX"
              icon={Phone}
              hasValue={phone.length > 0}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
                <CheckCircle size={14} className="text-[#2E7D32]" />
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
          background: "#2E7D32",
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

      <p className="text-center text-[#2E7D32]/20 text-[11px]">
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
                  style={{ fontFamily: "'Cairo','Tajawal',sans-serif", color: "#1B5E20", fontSize: "1.35rem" }}
                >
                  <SanadBrand color="#1B5E20" innerColor="#FFA500" />
                </h1>
                <p
                  className="font-bold text-center leading-snug px-4"
                  style={{ fontFamily: "'Cairo','Tajawal',sans-serif", color: "rgba(27,94,32,0.82)", fontSize: "0.62rem" }}
                >
                  <SanadBrand color="#1B5E20" innerColor="#FFA500" style={{ opacity: 0.85 }} />{"ك في التوصيل.. لباب الدار"}
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
                  ? "text-[#2E7D32]"
                  : "text-[#2E7D32]/35 hover:text-[#2E7D32]/60"
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
                  ? "text-[#2E7D32]"
                  : "text-[#2E7D32]/35 hover:text-[#2E7D32]/60"
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
        <p className="text-center text-[#2E7D32]/20 text-xs mt-5 font-medium" style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}>
          <SanadBrand color="#2E7D32" innerColor="white" style={{ opacity: 0.2 }} />{" · Sanad — بن قردان، تونس"}
        </p>
      </motion.div>
    </div>
  );
}
