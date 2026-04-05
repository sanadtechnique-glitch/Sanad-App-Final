import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale, Phone, ChevronRight, X, Check, Clock,
  Camera, Trash2, ArrowRight, AlertCircle, Star, FileText,
} from "lucide-react";
import { useLang } from "@/lib/language";
import { getSession } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/compress-image";

const API = (p: string) => `/api${p}`;
const token = () => getSession()?.token || "";

interface Lawyer {
  id: number;
  name: string;
  nameAr: string;
  category: string;
  description?: string;
  descriptionAr?: string;
  logoUrl?: string;
  phone?: string;
  rating?: number;
  isAvailable: boolean;
}

interface LawyerRequest {
  id: number;
  lawyerName: string;
  caseType: string;
  court: string;
  status: string;
  createdAt: string;
}

const CASE_TYPES = [
  { id: "criminal",       ar: "جنائي",      fr: "Pénal" },
  { id: "civil",          ar: "مدني",        fr: "Civil" },
  { id: "administrative", ar: "إداري",       fr: "Administratif" },
  { id: "commercial",     ar: "تجاري",       fr: "Commercial" },
  { id: "family",         ar: "أسري",        fr: "Familial" },
  { id: "real_estate",    ar: "عقاري",       fr: "Immobilier" },
  { id: "other",          ar: "أخرى",        fr: "Autre" },
];

const STATUS_MAP: Record<string, { ar: string; fr: string; bg: string; color: string }> = {
  pending:  { ar: "في الانتظار", fr: "En attente",  bg: "#FEF3C7", color: "#92400E" },
  accepted: { ar: "مقبول",       fr: "Accepté",     bg: "#D1FAE5", color: "#059669" },
  rejected: { ar: "مرفوض",       fr: "Refusé",      bg: "#FEE2E2", color: "#DC2626" },
};

function timeAgo(dateStr: string, lang: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return lang === "ar" ? "الآن" : "Maintenant";
  if (diff < 60) return lang === "ar" ? `${diff} د` : `${diff}min`;
  if (diff < 1440) return lang === "ar" ? `${Math.floor(diff / 60)} س` : `${Math.floor(diff / 60)}h`;
  return lang === "ar" ? `${Math.floor(diff / 1440)} ي` : `${Math.floor(diff / 1440)}j`;
}

export default function LawyerPage() {
  const { t, lang, isRTL } = useLang();
  const [, navigate] = useLocation();
  const session = getSession();
  const fileRef = useRef<HTMLInputElement>(null);

  const [lawyers, setLawyers]         = useState<Lawyer[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<Lawyer | null>(null);
  const [myRequests, setMyRequests]   = useState<LawyerRequest[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [done, setDone]               = useState(false);

  // Form state
  const [customerName, setName]     = useState(session?.name || "");
  const [customerPhone, setPhone]   = useState(session?.phone || "");
  const [caseType, setCaseType]     = useState("civil");
  const [court, setCourt]           = useState("");
  const [notes, setNotes]           = useState("");
  const [photos, setPhotos]         = useState<string[]>([]);
  const [uploading, setUploading]   = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(API("/lawyers"))
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setLawyers(d); })
      .catch(() => {})
      .finally(() => setLoading(false));

    if (session) {
      fetch(API(`/lawyer-requests/my-customer/${session.userId}`), {
        headers: { "x-session-token": token() },
      }).then(r => r.json()).then(d => { if (Array.isArray(d)) setMyRequests(d); }).catch(() => {});
    }
  }, []);

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImage(file, 1024 * 1024, 1400);
        const fd = new FormData();
        fd.append("photo", compressed, file.name);
        const res = await fetch(API("/lawyer-requests/upload"), {
          method: "POST",
          body: fd,
        });
        const json = await res.json();
        if (json.url) urls.push(json.url);
      } catch {}
    }
    setPhotos(prev => [...prev, ...urls]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!customerName.trim()) e.name = t("الاسم مطلوب", "Nom requis");
    if (!customerPhone.trim()) e.phone = t("رقم الهاتف مطلوب", "Téléphone requis");
    if (!court.trim()) e.court = t("اسم المحكمة مطلوب", "Tribunal requis");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!selected || !validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch(API("/lawyer-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token() },
        body: JSON.stringify({
          customerId: session?.userId,
          customerName,
          customerPhone,
          lawyerId: selected.id,
          lawyerName: selected.nameAr || selected.name,
          caseType,
          court,
          photos,
          notes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMyRequests(prev => [data, ...prev]);
        setDone(true);
      } else {
        alert(t("حدث خطأ، حاول مرة أخرى", "Erreur, veuillez réessayer"));
      }
    } catch {
      alert(t("خطأ في الاتصال", "Erreur de connexion"));
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setSelected(null);
    setDone(false);
    setCourt("");
    setNotes("");
    setPhotos([]);
    setErrors({});
  };

  return (
    <Layout>
      <div className="min-h-screen pb-10" style={{ background: "#FFF3E0" }} dir={isRTL ? "rtl" : "ltr"}>

        {/* Header */}
        <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{ background: "#FFF3E0" }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/home")}
              className="p-2.5 rounded-xl border border-[#1A4D1F]/15 text-[#1A4D1F]/50 hover:text-[#1A4D1F] hover:border-[#1A4D1F]/40 transition-all"
            >
              <ArrowRight size={18} className={isRTL ? "rotate-180" : ""} />
            </button>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "#1A4D1F" }}>
                <Scale size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-black text-[#1A4D1F]">{t("المحامون", "Avocats")}</h1>
                <p className="text-xs text-[#1A4D1F]/40">{t("اختر محامياً وأرسل طلبك", "Choisissez un avocat")}</p>
              </div>
            </div>
            {session && myRequests.length > 0 && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-xs transition-all border",
                  showHistory
                    ? "bg-[#1A4D1F] text-white border-[#1A4D1F]"
                    : "border-[#1A4D1F]/20 text-[#1A4D1F]/50"
                )}
              >
                <FileText size={12} />
                {t("طلباتي", "Mes demandes")}
                <span className="px-1.5 py-0.5 rounded-full text-xs font-black"
                  style={{ background: showHistory ? "rgba(255,255,255,0.2)" : "#1A4D1F22", color: showHistory ? "white" : "#1A4D1F" }}>
                  {myRequests.length}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="px-4 space-y-4">

          {/* My requests history */}
          <AnimatePresence>
            {showHistory && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="space-y-2">
                {myRequests.map(req => {
                  const st = STATUS_MAP[req.status] || STATUS_MAP.pending;
                  const ct = CASE_TYPES.find(c => c.id === req.caseType);
                  return (
                    <div key={req.id} className="rounded-2xl p-4 border border-[#1A4D1F]/10" style={{ background: "white" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-sm text-[#1A4D1F]">{req.lawyerName}</p>
                          <p className="text-xs text-[#1A4D1F]/40 mt-0.5">
                            {lang === "ar" ? ct?.ar : ct?.fr} · {req.court}
                          </p>
                          <p className="text-xs text-[#1A4D1F]/30 mt-1 flex items-center gap-1">
                            <Clock size={10} /> {timeAgo(req.createdAt, lang)}
                          </p>
                        </div>
                        <span className="text-xs font-black px-2.5 py-1 rounded-full flex-shrink-0"
                          style={{ background: st.bg, color: st.color }}>
                          {lang === "ar" ? st.ar : st.fr}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lawyers list */}
          {loading ? (
            <div className="flex flex-col items-center py-20 gap-3 opacity-40">
              <Scale size={40} className="text-[#1A4D1F] animate-pulse" />
              <p className="text-sm font-bold text-[#1A4D1F]">{t("جارٍ التحميل...", "Chargement...")}</p>
            </div>
          ) : lawyers.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3 opacity-30">
              <Scale size={40} className="text-[#1A4D1F]" />
              <p className="text-sm font-bold text-[#1A4D1F]">{t("لا يوجد محامون متاحون حالياً", "Aucun avocat disponible")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-black text-[#1A4D1F]/40 uppercase tracking-widest"
                style={{ fontFamily: "'Outfit',sans-serif" }}>
                {lawyers.length} {t("محامٍ", "avocats")}
              </p>
              {lawyers.map(lawyer => (
                <motion.button
                  key={lawyer.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelected(lawyer); setDone(false); }}
                  className="w-full text-right rounded-2xl overflow-hidden border transition-all"
                  style={{
                    background: "white",
                    borderColor: selected?.id === lawyer.id ? "#1A4D1F" : "rgba(26,77,31,0.08)",
                  }}
                >
                  <div className="flex items-center gap-4 p-4">
                    {/* Avatar / Logo */}
                    <div
                      className="w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center overflow-hidden"
                      style={{ background: "#1A4D1F15" }}
                    >
                      {lawyer.logoUrl ? (
                        <img src={lawyer.logoUrl} alt={lawyer.nameAr} className="w-full h-full object-contain p-1" />
                      ) : (
                        <Scale size={22} className="text-[#1A4D1F]/50" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 justify-between">
                        <p className="font-black text-sm text-[#1A4D1F]">{lawyer.nameAr}</p>
                        <span
                          className="text-xs font-black px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            background: lawyer.isAvailable ? "#D1FAE5" : "#FEE2E2",
                            color: lawyer.isAvailable ? "#059669" : "#DC2626",
                          }}
                        >
                          {lawyer.isAvailable ? t("متاح", "Disponible") : t("غير متاح", "Indisponible")}
                        </span>
                      </div>
                      {lawyer.descriptionAr && (
                        <p className="text-xs text-[#1A4D1F]/40 mt-0.5 line-clamp-2">{lawyer.descriptionAr}</p>
                      )}
                      {lawyer.rating && (
                        <div className="flex items-center gap-0.5 mt-1">
                          {[1,2,3,4,5].map(i => (
                            <Star key={i} size={10}
                              className={i <= Math.round(lawyer.rating!) ? "text-[#FFA500] fill-[#FFA500]" : "text-[#1A4D1F]/20"} />
                          ))}
                          <span className="text-xs text-[#1A4D1F]/30 ml-1">{lawyer.rating.toFixed(1)}</span>
                        </div>
                      )}
                      {lawyer.phone && (
                        <p className="flex items-center gap-1 text-xs text-[#1A4D1F]/30 mt-1">
                          <Phone size={9} /> {lawyer.phone}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={14} className={cn("text-[#1A4D1F]/25 flex-shrink-0", isRTL && "rotate-180")} />
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Request Form Modal */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center"
              style={{ background: "rgba(0,0,0,0.65)" }}
              onClick={e => { if (e.target === e.currentTarget) resetForm(); }}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="w-full max-w-lg rounded-t-3xl overflow-hidden"
                style={{ background: "#FFF3E0", maxHeight: "92vh", overflowY: "auto" }}
                dir={isRTL ? "rtl" : "ltr"}
              >
                {/* Modal Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-[#1A4D1F]/10"
                  style={{ background: "#FFF3E0" }}>
                  <div>
                    <h2 className="font-black text-[#1A4D1F] text-base">{selected.nameAr}</h2>
                    <p className="text-xs text-[#1A4D1F]/40">{t("إرسال طلب استشارة", "Demande de consultation")}</p>
                  </div>
                  <button onClick={resetForm}
                    className="p-2 rounded-xl border border-[#1A4D1F]/15 text-[#1A4D1F]/40 hover:text-[#1A4D1F]">
                    <X size={16} />
                  </button>
                </div>

                {/* Done State */}
                {done ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center py-16 px-8 gap-5"
                  >
                    <div className="w-20 h-20 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center">
                      <Check size={36} className="text-emerald-600" />
                    </div>
                    <div className="text-center">
                      <p className="font-black text-xl text-[#1A4D1F] mb-2">
                        {t("تم إرسال طلبك!", "Demande envoyée!")}
                      </p>
                      <p className="text-sm text-[#1A4D1F]/50">
                        {t(
                          `سيقوم ${selected.nameAr} بمراجعة طلبك والرد عليك قريباً`,
                          `${selected.nameAr} examinera votre demande et vous répondra bientôt`
                        )}
                      </p>
                    </div>
                    <button onClick={resetForm}
                      className="mt-2 px-8 py-3 rounded-2xl font-black text-white text-sm"
                      style={{ background: "#1A4D1F" }}>
                      {t("حسناً", "OK")}
                    </button>
                  </motion.div>
                ) : (
                  <div className="p-5 space-y-5 pb-8">

                    {/* Personal Info */}
                    <div className="space-y-3">
                      <p className="text-xs font-black text-[#1A4D1F]/50 uppercase tracking-widest"
                        style={{ fontFamily: "'Outfit',sans-serif" }}>
                        {t("بياناتك الشخصية", "Vos informations")}
                      </p>

                      <div>
                        <label className="block text-xs font-black text-[#1A4D1F]/60 mb-1.5">
                          {t("الاسم الكامل *", "Nom complet *")}
                        </label>
                        <input
                          value={customerName}
                          onChange={e => setName(e.target.value)}
                          placeholder={t("أدخل اسمك الكامل", "Votre nom complet")}
                          className="w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none transition-all text-[#1A4D1F]"
                          style={{
                            background: "white",
                            borderColor: errors.name ? "#EF4444" : "rgba(26,77,31,0.15)",
                          }}
                        />
                        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                      </div>

                      <div>
                        <label className="block text-xs font-black text-[#1A4D1F]/60 mb-1.5">
                          {t("رقم الهاتف *", "Téléphone *")}
                        </label>
                        <input
                          value={customerPhone}
                          onChange={e => setPhone(e.target.value)}
                          type="tel"
                          placeholder="216XXXXXXXX"
                          className="w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none transition-all text-[#1A4D1F]"
                          style={{
                            background: "white",
                            borderColor: errors.phone ? "#EF4444" : "rgba(26,77,31,0.15)",
                          }}
                        />
                        {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                      </div>
                    </div>

                    {/* Case Info */}
                    <div className="space-y-3">
                      <p className="text-xs font-black text-[#1A4D1F]/50 uppercase tracking-widest"
                        style={{ fontFamily: "'Outfit',sans-serif" }}>
                        {t("معلومات القضية", "Informations sur l'affaire")}
                      </p>

                      {/* Case Type */}
                      <div>
                        <label className="block text-xs font-black text-[#1A4D1F]/60 mb-2">
                          {t("نوع القضية *", "Type d'affaire *")}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {CASE_TYPES.map(ct => (
                            <button
                              key={ct.id}
                              onClick={() => setCaseType(ct.id)}
                              className="py-2.5 px-2 rounded-xl font-black text-xs border transition-all"
                              style={{
                                background: caseType === ct.id ? "#1A4D1F" : "white",
                                color: caseType === ct.id ? "white" : "#1A4D1F",
                                borderColor: caseType === ct.id ? "#1A4D1F" : "rgba(26,77,31,0.12)",
                              }}
                            >
                              {lang === "ar" ? ct.ar : ct.fr}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Court */}
                      <div>
                        <label className="block text-xs font-black text-[#1A4D1F]/60 mb-1.5">
                          {t("المحكمة الراجعة بالنظر *", "Tribunal compétent *")}
                        </label>
                        <input
                          value={court}
                          onChange={e => setCourt(e.target.value)}
                          placeholder={t("مثال: المحكمة الابتدائية ببن قردان", "Ex: Tribunal de Ben Guerdane")}
                          className="w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none transition-all text-[#1A4D1F]"
                          style={{
                            background: "white",
                            borderColor: errors.court ? "#EF4444" : "rgba(26,77,31,0.15)",
                          }}
                        />
                        {errors.court && <p className="text-xs text-red-500 mt-1">{errors.court}</p>}
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-xs font-black text-[#1A4D1F]/60 mb-1.5">
                          {t("ملاحظات إضافية (اختياري)", "Notes supplémentaires (optionnel)")}
                        </label>
                        <textarea
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          placeholder={t("وصف مختصر لقضيتك...", "Brève description de votre affaire...")}
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl border text-sm font-bold outline-none transition-all text-[#1A4D1F] resize-none"
                          style={{ background: "white", borderColor: "rgba(26,77,31,0.15)" }}
                        />
                      </div>
                    </div>

                    {/* Photos */}
                    <div className="space-y-3">
                      <p className="text-xs font-black text-[#1A4D1F]/50 uppercase tracking-widest"
                        style={{ fontFamily: "'Outfit',sans-serif" }}>
                        {t("صور الوثائق (اختياري)", "Photos de documents (optionnel)")}
                      </p>

                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={pickPhoto}
                        className="hidden"
                      />

                      <div className="flex flex-wrap gap-2">
                        {photos.map((url, i) => (
                          <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-[#1A4D1F]/10">
                            <img src={url} alt="doc" className="w-full h-full object-cover" />
                            <button
                              onClick={() => setPhotos(p => p.filter((_, idx) => idx !== i))}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"
                            >
                              <Trash2 size={10} className="text-white" />
                            </button>
                          </div>
                        ))}

                        {photos.length < 5 && (
                          <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all"
                            style={{ borderColor: "rgba(26,77,31,0.25)", color: "#1A4D1F" }}
                          >
                            {uploading ? (
                              <div className="w-5 h-5 border-2 border-[#1A4D1F]/30 border-t-[#1A4D1F] rounded-full animate-spin" />
                            ) : (
                              <>
                                <Camera size={18} className="opacity-40" />
                                <span className="text-xs font-bold opacity-40">{t("صورة", "Photo")}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {photos.length > 0 && (
                        <p className="text-xs text-[#1A4D1F]/30 flex items-center gap-1">
                          <AlertCircle size={10} />
                          {t(`${photos.length} صورة مرفوعة`, `${photos.length} photo(s) jointe(s)`)}
                        </p>
                      )}
                    </div>

                    {/* Submit */}
                    <button
                      onClick={submit}
                      disabled={submitting || uploading}
                      className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-base transition-all"
                      style={{
                        background: submitting ? "rgba(26,77,31,0.5)" : "#1A4D1F",
                        color: "white",
                      }}
                    >
                      {submitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Scale size={18} />
                          {t("إرسال الطلب", "Envoyer la demande")}
                        </>
                      )}
                    </button>

                    {!selected.isAvailable && (
                      <div className="flex items-center gap-2 p-3 rounded-xl"
                        style={{ background: "#FEF3C7", border: "1px solid #F59E0B33" }}>
                        <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
                        <p className="text-xs font-bold text-amber-700">
                          {t("المحامي غير متاح حالياً، قد يتأخر الرد", "L'avocat est actuellement indisponible, la réponse peut être tardive")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
