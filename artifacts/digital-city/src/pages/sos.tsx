import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, MapPin, Clock, ChevronRight, Phone,
  CheckCircle2, XCircle, Truck, DollarSign,
} from "lucide-react";
import { useLang } from "@/lib/language";
import { getSession } from "@/lib/auth";
import { Layout } from "@/components/layout";

const API = (path: string) => `/api${path}`;
const tok  = () => getSession()?.token || "";

interface SosReq {
  id: number; customerName: string; customerPhone: string;
  lat: number; lng: number; description?: string;
  status: string;
  offeredPrice?: number | null;
  assignedProviderName?: string;
  createdAt: string;
}

const STATUS_MAP: Record<string, { ar: string; fr: string; color: string; bg: string }> = {
  pending:   { ar: "في الانتظار",    fr: "En attente",       color: "#92400E", bg: "#FEF3C7" },
  offered:   { ar: "عرض سعر",        fr: "Offre de prix",    color: "#1D4ED8", bg: "#DBEAFE" },
  accepted:  { ar: "تم القبول",      fr: "Accepté",          color: "#059669", bg: "#D1FAE5" },
  done:      { ar: "مكتمل",          fr: "Terminé",          color: "#6D28D9", bg: "#EDE9FE" },
  cancelled: { ar: "ملغي",           fr: "Annulé",           color: "#6B7280", bg: "#F3F4F6" },
};

function timeAgo(d: string, lang: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (diff < 1) return lang === "ar" ? "الآن" : "Maintenant";
  if (diff < 60) return lang === "ar" ? `${diff} د` : `${diff}min`;
  return lang === "ar" ? `${Math.floor(diff / 60)} س` : `${Math.floor(diff / 60)}h`;
}

export default function SosPage() {
  const { t, lang } = useLang();
  const [, navigate] = useLocation();
  const session = getSession();

  const [step, setStep]             = useState<"form" | "waiting">("form");
  const [description, setDesc]      = useState("");
  const [customerName, setName]     = useState(session?.name || "");
  const [customerPhone, setPhone]   = useState(session?.phone || "");
  const [gps, setGps]               = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState<SosReq[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [createdId, setCreatedId]   = useState<number | null>(null);
  const [liveReq, setLiveReq]       = useState<SosReq | null>(null);
  const [responding, setResponding] = useState(false);

  /* ── Load previous requests ── */
  useEffect(() => {
    if (session?.userId) {
      fetch(API(`/sos/my/${session.userId}`), { headers: { "x-session-token": tok() } })
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setMyRequests(d); });
    }
    getGps();
  }, []);

  /* ── Poll live status after submission ── */
  useEffect(() => {
    if (!createdId || !session?.userId) return;
    const poll = setInterval(async () => {
      const res  = await fetch(API(`/sos/my/${session.userId}`), { headers: { "x-session-token": tok() } });
      const data = await res.json();
      if (Array.isArray(data)) {
        const req = data.find((r: SosReq) => r.id === createdId);
        if (req) setLiveReq(req);
      }
    }, 4000);
    return () => clearInterval(poll);
  }, [createdId]);

  const getGps = () => {
    setGpsError("");
    if (!navigator.geolocation) { setGpsError(t("الجهاز لا يدعم GPS","GPS non supporté")); return; }
    navigator.geolocation.getCurrentPosition(
      pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()  => setGpsError(t("تعذّر تحديد الموقع","Localisation échouée")),
      { timeout: 10000 }
    );
  };

  const submitSos = async () => {
    if (!customerName || !customerPhone) return;
    setSubmitting(true);
    try {
      const res = await fetch(API("/sos"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": tok() },
        body: JSON.stringify({
          customerId: session?.userId || null,
          customerName, customerPhone,
          description,
          lat: gps?.lat ?? 33.1,
          lng: gps?.lng ?? 11.1,
        }),
      });
      const data = await res.json();
      setCreatedId(data.id);
      setLiveReq(data);
      setStep("waiting");
    } finally { setSubmitting(false); }
  };

  /* ── Customer responds to price offer ── */
  const respond = async (accept: boolean) => {
    if (!createdId) return;
    setResponding(true);
    try {
      const res = await fetch(API(`/sos/${createdId}/respond`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-token": tok() },
        body: JSON.stringify({ accept }),
      });
      const data = await res.json();
      setLiveReq(data);
    } finally { setResponding(false); }
  };

  const resetForm = () => {
    setStep("form"); setDesc(""); setCreatedId(null); setLiveReq(null);
  };

  /* ── Live status icon ── */
  const statusIcon = (status: string) => {
    if (status === "pending")  return <Clock size={20} className="animate-pulse text-amber-500" />;
    if (status === "offered")  return <DollarSign size={20} className="text-blue-500" />;
    if (status === "accepted") return <CheckCircle2 size={20} className="text-emerald-500" />;
    if (status === "done")     return <CheckCircle2 size={20} className="text-violet-500" />;
    return <XCircle size={20} className="text-gray-400" />;
  };

  return (
    <Layout>
      <div className="min-h-screen pb-24" style={{ background: "#FFF3E0" }}>

        {/* Header */}
        <div className="sticky top-0 z-40 px-4 pt-4 pb-3" style={{ background: "#FFF3E0" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/home")}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "#EF444422" }}>
              <ChevronRight size={18} style={{ color: "#EF4444" }} className="rtl:rotate-180" />
            </button>
            <div className="flex-1">
              <h1 className="font-black text-base flex items-center gap-2" style={{ color: "#EF4444" }}>
                <AlertTriangle size={16} /> {t("خدمة SOS", "Service SOS")}
              </h1>
              <p className="text-xs opacity-50" style={{ color: "#1A4D1F" }}>
                {t("سيُرسل طلبك لأقرب شاحنة SOS", "Envoyé à la dépanneuse la plus proche")}
              </p>
            </div>
            {session && myRequests.length > 0 && (
              <button onClick={() => setShowHistory(v => !v)}
                className="text-xs font-black px-3 py-1.5 rounded-full border"
                style={{ color: "#EF4444", borderColor: "#EF444433" }}>
                {t("طلباتي", "Mes demandes")}
              </button>
            )}
          </div>
        </div>

        {/* History Panel */}
        <AnimatePresence>
          {showHistory && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="mx-4 mb-4 rounded-2xl overflow-hidden"
              style={{ background: "#fff", border: "1px solid #EF444422" }}>
              <div className="p-4 border-b" style={{ borderColor: "#EF444411" }}>
                <p className="font-black text-sm" style={{ color: "#EF4444" }}>{t("طلباتي السابقة","Mes demandes")}</p>
              </div>
              {myRequests.map(req => {
                const s = STATUS_MAP[req.status] || STATUS_MAP.pending;
                return (
                  <div key={req.id} className="p-4 border-b last:border-0" style={{ borderColor: "#EF444411" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black" style={{ color: "#1A4D1F" }}>#{req.id}</span>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
                        {lang === "ar" ? s.ar : s.fr}
                      </span>
                    </div>
                    {req.offeredPrice && <p className="text-xs mt-1 font-bold" style={{ color: "#1D4ED8" }}>{req.offeredPrice.toFixed(3)} TND</p>}
                    {req.assignedProviderName && (
                      <p className="text-xs mt-0.5 opacity-60 flex items-center gap-1" style={{ color: "#1A4D1F" }}>
                        <Truck size={10} /> {req.assignedProviderName}
                      </p>
                    )}
                    <p className="text-xs mt-0.5 opacity-40" style={{ color: "#1A4D1F" }}>{timeAgo(req.createdAt, lang)}</p>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main */}
        <div className="px-4">
          <AnimatePresence mode="wait">

            {/* ── FORM ── */}
            {step === "form" && (
              <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-4">

                {/* Banner */}
                <div className="rounded-2xl p-5 text-center" style={{ background: "#EF444415", border: "1px solid #EF444430" }}>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#EF444425" }}>
                    <AlertTriangle size={32} style={{ color: "#EF4444" }} className="animate-pulse" />
                  </div>
                  <p className="font-black text-base" style={{ color: "#EF4444" }}>
                    {t("طلب مساعدة عاجلة - شاحنة SOS", "Demande d'aide urgente - Dépanneuse SOS")}
                  </p>
                  <p className="text-xs mt-1 opacity-60" style={{ color: "#1A4D1F" }}>
                    {t("ستُرسل لأقرب شاحنة SOS · سيقترح سعراً ولك حق القبول أو الرفض",
                       "Envoyé à la dépanneuse la plus proche · Elle proposera un prix, libre à vous d'accepter")}
                  </p>
                </div>

                {/* GPS */}
                <div className="flex items-center gap-2 p-3 rounded-xl"
                  style={{ background: gps ? "#D1FAE5" : "#FEF3C7", border: `1px solid ${gps ? "#059669" : "#92400E"}30` }}>
                  <MapPin size={14} style={{ color: gps ? "#059669" : "#92400E" }} />
                  <span className="text-xs font-bold flex-1" style={{ color: gps ? "#059669" : "#92400E" }}>
                    {gps ? t("موقعك محدد ✓","Position détectée ✓")
                         : gpsError || t("يجري تحديد موقعك...","Localisation en cours...")}
                  </span>
                  {!gps && !gpsError && <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "#92400E", borderTopColor: "transparent" }} />}
                  {gpsError && <button onClick={getGps} className="text-xs font-black underline" style={{ color: "#92400E" }}>{t("حاول مجدداً","Réessayer")}</button>}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>{t("الاسم الكامل *","Nom complet *")}</label>
                  <input value={customerName} onChange={e => setName(e.target.value)} placeholder={t("اسمك الكامل","Votre nom")}
                    className="w-full rounded-xl px-3 py-3 text-sm font-bold border outline-none"
                    style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>{t("رقم الهاتف *","Téléphone *")}</label>
                  <div className="relative">
                    <Phone size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30" style={{ color: "#1A4D1F" }} />
                    <input type="tel" value={customerPhone} onChange={e => setPhone(e.target.value)} placeholder="+216 XX XXX XXX" dir="ltr"
                      className="w-full rounded-xl px-3 py-3 pr-9 text-sm font-bold border outline-none"
                      style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>{t("وصف المشكلة (اختياري)","Description (optionnel)")}</label>
                  <textarea value={description} onChange={e => setDesc(e.target.value)} rows={3}
                    placeholder={t("صف ما تحتاج إليه...","Décrivez votre problème...")}
                    className="w-full rounded-xl px-3 py-3 text-sm font-bold border outline-none resize-none"
                    style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                </div>

                {/* Submit */}
                <button onClick={submitSos} disabled={submitting || !customerName || !customerPhone}
                  className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                  style={{ background: "#EF4444", boxShadow: "0 8px 24px -8px #EF444455" }}>
                  {submitting
                    ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    : <AlertTriangle size={18} />}
                  {t("إرسال طلب SOS","Envoyer SOS")}
                </button>
              </motion.div>
            )}

            {/* ── WAITING / OFFER / DONE ── */}
            {step === "waiting" && (
              <motion.div key="waiting" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-5 pt-4">

                {/* Animated truck */}
                <div className="w-24 h-24 rounded-full flex items-center justify-center"
                  style={{ background: "#EF444415", border: "2px solid #EF444430" }}>
                  {liveReq?.status === "accepted" || liveReq?.status === "done"
                    ? <CheckCircle2 size={40} className="text-emerald-500" />
                    : liveReq?.status === "cancelled"
                    ? <XCircle size={40} className="text-gray-400" />
                    : <Truck size={36} style={{ color: "#EF4444" }} className="animate-pulse" />
                  }
                </div>

                {/* Title */}
                <div className="text-center">
                  {(!liveReq || liveReq.status === "pending") && (
                    <>
                      <p className="font-black text-xl" style={{ color: "#1A4D1F" }}>{t("طلب SOS أُرسل ✓","Demande SOS envoyée ✓")}</p>
                      <p className="text-sm opacity-50 mt-1" style={{ color: "#1A4D1F" }}>
                        {t("في انتظار أقرب شاحنة SOS...","En attente de la dépanneuse la plus proche...")}
                      </p>
                      <div className="flex items-center justify-center gap-1.5 mt-3 text-xs opacity-40" style={{ color: "#1A4D1F" }}>
                        <Clock size={12} className="animate-spin" style={{ animationDuration: "3s" }} />
                        {t("ستصلك إشعار عند اقتراح السعر","Vous serez notifié dès qu'un prix sera proposé")}
                      </div>
                    </>
                  )}
                  {liveReq?.status === "accepted" && (
                    <>
                      <p className="font-black text-xl text-emerald-600">{t("تم قبول العرض ✓","Offre acceptée ✓")}</p>
                      <p className="text-sm opacity-50 mt-1" style={{ color: "#1A4D1F" }}>
                        {t("الشاحنة في الطريق إليك","La dépanneuse est en route")}
                      </p>
                    </>
                  )}
                  {liveReq?.status === "done" && (
                    <p className="font-black text-xl text-violet-600">{t("تمت الخدمة ✓","Service terminé ✓")}</p>
                  )}
                  {liveReq?.status === "cancelled" && (
                    <>
                      <p className="font-black text-xl" style={{ color: "#6B7280" }}>{t("تم إلغاء الطلب","Demande annulée")}</p>
                      <p className="text-sm opacity-50 mt-1" style={{ color: "#1A4D1F" }}>{t("يمكنك إرسال طلب جديد","Vous pouvez envoyer une nouvelle demande")}</p>
                    </>
                  )}
                </div>

                {/* ── PRICE OFFER CARD ── */}
                {liveReq?.status === "offered" && liveReq.offeredPrice != null && (
                  <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                    className="w-full rounded-2xl overflow-hidden"
                    style={{ background: "#fff", border: "2px solid #1D4ED8" }}>
                    <div className="px-4 py-3 flex items-center gap-2" style={{ background: "#DBEAFE" }}>
                      <DollarSign size={16} className="text-blue-700" />
                      <p className="font-black text-sm text-blue-700">{t("عرض سعر من الشاحنة","Offre de prix de la dépanneuse")}</p>
                    </div>
                    <div className="p-5 text-center space-y-4">
                      {liveReq.assignedProviderName && (
                        <p className="text-sm font-bold flex items-center justify-center gap-2" style={{ color: "#1A4D1F" }}>
                          <Truck size={15} /> {liveReq.assignedProviderName}
                        </p>
                      )}
                      <div>
                        <p className="text-xs opacity-50 mb-1" style={{ color: "#1A4D1F" }}>{t("المبلغ المقترح","Montant proposé")}</p>
                        <p className="text-4xl font-black" style={{ color: "#1D4ED8" }}>
                          {liveReq.offeredPrice.toFixed(3)} <span className="text-lg">TND</span>
                        </p>
                      </div>
                      <p className="text-xs opacity-50" style={{ color: "#1A4D1F" }}>
                        {t("هل توافق على هذا المبلغ؟","Acceptez-vous ce montant ?")}
                      </p>
                      <div className="flex gap-3">
                        <button onClick={() => respond(true)} disabled={responding}
                          className="flex-1 py-3 rounded-2xl font-black text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                          style={{ background: "#059669" }}>
                          {responding
                            ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            : <CheckCircle2 size={16} />}
                          {t("قبول", "Accepter")}
                        </button>
                        <button onClick={() => respond(false)} disabled={responding}
                          className="flex-1 py-3 rounded-2xl font-black flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                          style={{ background: "#FEE2E2", color: "#DC2626" }}>
                          <XCircle size={16} />
                          {t("رفض", "Refuser")}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Request info card */}
                {liveReq && !["offered"].includes(liveReq.status) && (
                  <div className="w-full rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #1A4D1F11" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black opacity-40" style={{ color: "#1A4D1F" }}>{t("حالة الطلب","Statut de la demande")}</span>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full"
                        style={{ color: STATUS_MAP[liveReq.status]?.color, background: STATUS_MAP[liveReq.status]?.bg }}>
                        {lang === "ar" ? STATUS_MAP[liveReq.status]?.ar : STATUS_MAP[liveReq.status]?.fr}
                      </span>
                    </div>
                    {liveReq.offeredPrice && (
                      <p className="text-sm font-black" style={{ color: "#1D4ED8" }}>
                        {t("المبلغ:","Montant:")} {liveReq.offeredPrice.toFixed(3)} TND
                      </p>
                    )}
                    {liveReq.assignedProviderName && (
                      <p className="text-sm font-bold flex items-center gap-1.5 mt-1" style={{ color: "#1A4D1F" }}>
                        <Truck size={12} /> {liveReq.assignedProviderName}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="w-full space-y-2">
                  {["cancelled", "done"].includes(liveReq?.status || "") && (
                    <button onClick={resetForm}
                      className="w-full py-3 rounded-2xl font-black text-sm border-2"
                      style={{ color: "#EF4444", borderColor: "#EF444433" }}>
                      {t("طلب جديد","Nouvelle demande")}
                    </button>
                  )}
                  <button onClick={() => navigate("/home")} className="w-full text-sm font-bold opacity-50 py-2" style={{ color: "#1A4D1F" }}>
                    {t("العودة للرئيسية","Retour à l'accueil")}
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
