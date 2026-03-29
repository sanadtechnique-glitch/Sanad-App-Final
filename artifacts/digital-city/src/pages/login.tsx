import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, Eye, EyeOff, ChevronDown, LogIn,
  UserPlus, Phone, Lock, User, CheckCircle, MapPin,
} from "lucide-react";
import { get, post } from "@/lib/admin-api";
import { setSession, type Role } from "@/lib/auth";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Supplier   { id: number; name: string; nameAr: string; }
interface Staff      { id: number; name: string; nameAr: string; phone: string; }
interface Delegation { id: number; name: string; nameAr: string; deliveryFee: number; }

type ProfileOption = { value: Role; labelAr: string; labelFr: string; color: string };

const LOGIN_PROFILES: ProfileOption[] = [
  { value: "client",   labelAr: "عميل",       labelFr: "Client",      color: "#66BB6A" },
  { value: "provider", labelAr: "مزود خدمة",  labelFr: "Fournisseur", color: "#4CAF50" },
  { value: "delivery", labelAr: "سائق توصيل", labelFr: "Livreur",     color: "#388E3C" },
  { value: "admin",    labelAr: "مسؤول",       labelFr: "Admin",       color: "#1B5E20" },
];

const SIGNUP_PROFILES: ProfileOption[] = [
  { value: "client",   labelAr: "عميل",       labelFr: "Client",      color: "#66BB6A" },
  { value: "provider", labelAr: "مزود خدمة",  labelFr: "Fournisseur", color: "#4CAF50" },
  { value: "delivery", labelAr: "سائق توصيل", labelFr: "Livreur",     color: "#388E3C" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Reusable sub-components
// ─────────────────────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-black text-[#004D40]/50 uppercase tracking-widest mb-2">
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
      <Icon size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#004D40]/30" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full ps-10 pe-4 py-3.5 rounded-xl border text-[#004D40] font-bold outline-none transition-all placeholder:text-[#004D40]/20 text-right"
        style={{
          background: "#FFFDE7",
          borderColor: hasValue ? "#66BB6A" : "rgba(0,77,64,0.18)",
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
      <Lock size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#004D40]/30" />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full ps-10 pe-11 py-3.5 rounded-xl border text-[#004D40] font-bold outline-none transition-all placeholder:text-[#004D40]/20 text-right"
        style={{
          background: "#FFFDE7",
          borderColor: hasValue ? "rgba(102,187,106,0.8)" : "rgba(0,77,64,0.18)",
        }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        className="absolute top-1/2 -translate-y-1/2 end-3.5 text-[#004D40]/30 hover:text-[#004D40]/60 transition-colors"
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
        className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#004D40]/30 pointer-events-none"
      />
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full ps-9 pe-4 py-3.5 rounded-xl border transition-all outline-none text-right font-bold text-[#004D40] flex items-center justify-between"
        style={{
          background: "#FFFDE7",
          borderColor: open ? "#66BB6A" : "rgba(0,77,64,0.18)",
        }}
      >
        <ChevronDown
          size={14}
          className={cn("text-[#004D40]/25 transition-transform", open && "rotate-180")}
        />
        <span>
          {selected.labelAr}
          <span className="text-[#004D40]/30 font-normal"> · {selected.labelFr}</span>
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
            style={{ background: "#E1AD01", borderColor: "rgba(102,187,106,0.3)" }}
          >
            {options.map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => { onChange(p.value); setOpen(false); }}
                className={cn(
                  "w-full px-4 py-3 flex items-center justify-end gap-3 text-right transition-colors",
                  value === p.value ? "bg-[#004D40]/6" : "hover:bg-[#004D40]/4"
                )}
              >
                <span className="font-bold text-[#004D40] text-sm">
                  {p.labelAr}
                  <span className="text-[#004D40]/30 font-normal"> · {p.labelFr}</span>
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
        className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black text-black text-base transition-all disabled:opacity-30"
        style={{
          background: "#66BB6A",
          boxShadow: canSubmit ? "0 0 28px rgba(102,187,106,0.35)" : "none",
        }}
      >
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

      {(role === "provider" || role === "delivery") && (
        <p className="text-center text-[#004D40]/25 text-xs">
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

  const [delegations, setDelegations]         = useState<Delegation[]>([]);
  const [delegationId, setDelegationId]       = useState<number | null>(null);
  const [delegationOpen, setDelegationOpen]   = useState(false);

  useEffect(() => {
    get<Delegation[]>("/admin/delegations").then(list => {
      setDelegations(list);
      const ben = list.find(d =>
        d.nameAr?.includes("بنقردان") || d.nameAr?.includes("بن قردان") ||
        d.name?.toLowerCase().includes("ben gard")
      );
      setDelegationId(ben?.id ?? list[0]?.id ?? null);
    }).catch(() => {});
  }, []);

  const selectedDelegation = delegations.find(d => d.id === delegationId);

  const needsPhone = role === "provider" || role === "delivery";
  const canSubmit  =
    username.trim() !== "" &&
    password.trim() !== "" &&
    confirm.trim()  !== "" &&
    delegationId !== null &&
    (!needsPhone || phone.trim() !== "") &&
    !loading;

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
          delegationId:   delegationId ?? undefined,
          delegationFee:  selectedDelegation?.deliveryFee ?? 0,
          delegationName: selectedDelegation?.nameAr ?? selectedDelegation?.name ?? "",
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
          delegationId:   delegationId ?? undefined,
          delegationFee:  selectedDelegation?.deliveryFee ?? 0,
          delegationName: selectedDelegation?.nameAr ?? selectedDelegation?.name ?? "",
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
          delegationId:   delegationId ?? undefined,
          delegationFee:  selectedDelegation?.deliveryFee ?? 0,
          delegationName: selectedDelegation?.nameAr ?? selectedDelegation?.name ?? "",
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
          style={{ background: "rgba(102,187,106,0.2)", border: "2px solid #66BB6A" }}
        >
          <CheckCircle size={32} className="text-[#66BB6A]" />
        </div>
        <p className="font-black text-[#004D40] text-lg text-center">تم إنشاء الحساب!</p>
        <p className="text-[#004D40]/40 text-sm text-center">Compte créé avec succès</p>
        <div className="w-5 h-5 rounded-full border-2 border-[#66BB6A] border-t-transparent animate-spin mt-2" />
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
          <p className="text-[11px] text-[#004D40]/35 mt-1.5 text-right">
            سيُضاف كمزود خدمة · Vous serez ajouté comme fournisseur
          </p>
        )}
        {role === "delivery" && (
          <p className="text-[11px] text-[#004D40]/35 mt-1.5 text-right">
            سيُضاف كسائق توصيل · Vous serez ajouté comme livreur
          </p>
        )}
      </div>

      {/* Delegation */}
      <div>
        <FieldLabel>المعتمدية · Délégation</FieldLabel>
        <div className="relative">
          <MapPin size={15} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-[#004D40]/30 pointer-events-none" />
          <button
            type="button"
            onClick={() => setDelegationOpen(o => !o)}
            className="w-full ps-10 pe-4 py-3.5 rounded-xl border transition-all outline-none text-right font-bold text-[#004D40] flex items-center justify-between"
            style={{
              background: "#FFFDE7",
              borderColor: delegationOpen ? "#66BB6A" : selectedDelegation ? "rgba(102,187,106,0.8)" : "rgba(0,77,64,0.18)",
            }}
          >
            <ChevronDown size={14} className={cn("text-[#004D40]/25 transition-transform", delegationOpen && "rotate-180")} />
            <span>
              {selectedDelegation
                ? <>{selectedDelegation.nameAr}<span className="text-[#004D40]/30 font-normal"> — {selectedDelegation.deliveryFee} DT</span></>
                : <span className="text-[#004D40]/30 font-normal">اختر منطقتك · Choisissez votre zone</span>
              }
            </span>
          </button>
          <AnimatePresence>
            {delegationOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scaleY: 0.9 }}
                animate={{ opacity: 1, y: 0, scaleY: 1 }}
                exit={{ opacity: 0, y: -4, scaleY: 0.95 }}
                transition={{ duration: 0.14 }}
                className="absolute top-full mt-1 w-full rounded-xl border z-50 overflow-hidden shadow-xl max-h-52 overflow-y-auto"
                style={{ background: "#E1AD01", borderColor: "rgba(102,187,106,0.3)" }}
              >
                {delegations.length === 0 && (
                  <div className="px-4 py-3 text-sm text-[#004D40]/40 text-right">جاري التحميل...</div>
                )}
                {delegations.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => { setDelegationId(d.id); setDelegationOpen(false); setError(null); }}
                    className={cn(
                      "w-full px-4 py-3 flex items-center justify-end gap-3 text-right transition-colors",
                      delegationId === d.id ? "bg-[#004D40]/8" : "hover:bg-[#004D40]/4"
                    )}
                  >
                    <span className="font-bold text-[#004D40] text-sm">
                      {d.nameAr}
                      <span className="text-[#004D40]/40 font-normal text-xs"> — {d.deliveryFee} DT</span>
                    </span>
                    {delegationId === d.id && (
                      <div className="w-2 h-2 rounded-full bg-[#66BB6A] flex-shrink-0" />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {selectedDelegation && (
          <p className="text-[11px] text-[#66BB6A]/70 font-bold mt-1.5 text-right">
            رسوم التوصيل: {selectedDelegation.deliveryFee} DT · Frais de livraison
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
                <CheckCircle size={14} className="text-[#66BB6A]" />
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
        className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black text-black text-base transition-all disabled:opacity-30 mt-1"
        style={{
          background: "#66BB6A",
          boxShadow: canSubmit ? "0 0 28px rgba(102,187,106,0.35)" : "none",
        }}
      >
        {loading ? (
          <>
            <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
            <span>جاري إنشاء الحساب...</span>
          </>
        ) : (
          <>
            <UserPlus size={18} />
            <span>إنشاء الحساب · Créer le compte</span>
          </>
        )}
      </button>

      <p className="text-center text-[#004D40]/20 text-[11px]">
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
      style={{ background: "#E1AD01" }}
      dir="rtl"
    >
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(102,187,106,0.07) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div
          className="rounded-[26px] border overflow-hidden"
          style={{
            background: "#FFFDE7",
            borderColor: "#66BB6A",
            boxShadow:
              "0 0 60px -15px rgba(102,187,106,0.35), 0 8px 32px rgba(0,77,64,0.1)",
          }}
        >
          {/* ── Header ── */}
          <div
            className="px-8 pt-7 pb-5 border-b"
            style={{ borderColor: "rgba(102,187,106,0.12)" }}
          >
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center"
                style={{
                  background: "rgba(0,77,64,0.07)",
                  border: "2.5px solid rgba(0,77,64,0.25)",
                  boxShadow: "0 0 32px -8px rgba(0,77,64,0.30)",
                }}
              >
                <span
                  className="font-black text-[#004D40] text-2xl leading-none"
                  style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}
                >
                  سند
                </span>
              </div>
              <div className="text-center">
                <h1
                  className="text-2xl font-black text-[#004D40] tracking-tight leading-tight"
                  style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}
                >
                  سند
                </h1>
                <p className="text-[#004D40]/60 text-sm mt-1 font-bold" style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}>
                  سندك الرسمي ... من السوق للدار
                </p>
              </div>
            </div>
          </div>

          {/* ── Tab Switcher ── */}
          <div
            className="flex border-b"
            style={{ borderColor: "rgba(102,187,106,0.15)", background: "rgba(102,187,106,0.04)" }}
          >
            <button
              type="button"
              onClick={() => setTab("login")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-black transition-all relative",
                tab === "login"
                  ? "text-[#004D40]"
                  : "text-[#004D40]/35 hover:text-[#004D40]/60"
              )}
            >
              <LogIn size={15} />
              تسجيل الدخول
              {tab === "login" && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                  style={{ background: "#66BB6A" }}
                />
              )}
            </button>
            <div className="w-px my-3" style={{ background: "rgba(102,187,106,0.2)" }} />
            <button
              type="button"
              onClick={() => setTab("signup")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-black transition-all relative",
                tab === "signup"
                  ? "text-[#004D40]"
                  : "text-[#004D40]/35 hover:text-[#004D40]/60"
              )}
            >
              <UserPlus size={15} />
              إنشاء حساب
              {tab === "signup" && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                  style={{ background: "#66BB6A" }}
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
        <p className="text-center text-[#004D40]/20 text-xs mt-5 font-medium" style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}>
          سند · Sanad — بن قردان، تونس
        </p>
      </motion.div>
    </div>
  );
}
