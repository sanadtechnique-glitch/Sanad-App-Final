import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, MapPin, Clock, Navigation, ChevronRight, Phone } from "lucide-react";
import { useLang } from "@/lib/language";
import { getSession } from "@/lib/auth";
import { Layout } from "@/components/layout";

const API = (path: string) => `/api${path}`;
const token = () => getSession()?.token || "";

interface SosRequest {
  id: number; customerName: string; customerPhone: string;
  lat: number; lng: number; description?: string;
  status: string; assignedProviderName?: string; createdAt: string;
}

const STATUS_MAP: Record<string, { ar: string; fr: string; color: string; bg: string }> = {
  pending:  { ar: "في الانتظار", fr: "En attente",  color: "#92400E", bg: "#FEF3C7" },
  accepted: { ar: "تم القبول",   fr: "Accepté",     color: "#059669", bg: "#D1FAE5" },
  done:     { ar: "مكتمل",       fr: "Terminé",     color: "#6D28D9", bg: "#EDE9FE" },
  cancelled:{ ar: "ملغي",        fr: "Annulé",      color: "#6B7280", bg: "#F3F4F6" },
};

function timeAgo(dateStr: string, lang: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return lang === "ar" ? "الآن" : "Maintenant";
  if (diff < 60) return lang === "ar" ? `${diff} د` : `${diff}min`;
  return lang === "ar" ? `${Math.floor(diff / 60)} س` : `${Math.floor(diff / 60)}h`;
}

export default function SosPage() {
  const { t, lang } = useLang();
  const [, navigate] = useLocation();
  const session = getSession();

  // Steps: "form" | "locating" | "done"
  const [step, setStep]       = useState<"form" | "locating" | "done">("form");
  const [description, setDesc] = useState("");
  const [customerName, setName] = useState(session?.name || "");
  const [customerPhone, setPhone] = useState(session?.phone || "");
  const [gps, setGps]         = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState<SosRequest[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [liveStatus, setLiveStatus] = useState<SosRequest | null>(null);

  useEffect(() => {
    if (session) {
      fetch(API(`/sos/my/${session.userId}`), { headers: { "x-session-token": token() } })
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setMyRequests(d); });
    }
    // Try to get GPS on page load
    getGps();
  }, []);

  // Poll live status after submission
  useEffect(() => {
    if (!createdId) return;
    const interval = setInterval(async () => {
      const res = await fetch(API(`/sos/my/${session?.userId}`), { headers: { "x-session-token": token() } });
      const data = await res.json();
      if (Array.isArray(data)) {
        const req = data.find((r: SosRequest) => r.id === createdId);
        if (req) setLiveStatus(req);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [createdId]);

  const getGps = () => {
    setGpsError("");
    if (!navigator.geolocation) {
      setGpsError(t("الجهاز لا يدعم GPS", "GPS non supporté"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGpsError(t("تعذّر تحديد الموقع", "Localisation échouée")),
      { timeout: 10000 }
    );
  };

  const submitSos = async () => {
    if (!customerName || !customerPhone) return;
    setSubmitting(true);
    try {
      const body: any = {
        customerId: session?.userId || null,
        customerName, customerPhone,
        category: "sos",
        description,
        lat: gps?.lat ?? 33.1,
        lng: gps?.lng ?? 11.1,
      };
      const res = await fetch(API("/sos"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setCreatedId(data.id);
      setLiveStatus(data);
      setStep("done");
    } finally { setSubmitting(false); }
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
                {t("سيتم إرسال طلبك لأقرب مزود", "Envoyé au prestataire le plus proche")}
              </p>
            </div>
            {session && myRequests.length > 0 && (
              <button onClick={() => setShowHistory(!showHistory)}
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
                <p className="font-black text-sm" style={{ color: "#EF4444" }}>{t("طلباتي السابقة", "Mes demandes")}</p>
              </div>
              {myRequests.map(req => {
                const s = STATUS_MAP[req.status] || STATUS_MAP.pending;
                return (
                  <div key={req.id} className="p-4 border-b last:border-0" style={{ borderColor: "#EF444411" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black" style={{ color: "#1A4D1F" }}>#{req.id}</span>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full"
                        style={{ color: s.color, background: s.bg }}>
                        {lang === "ar" ? s.ar : s.fr}
                      </span>
                    </div>
                    {req.assignedProviderName && (
                      <p className="text-xs mt-1 opacity-60" style={{ color: "#1A4D1F" }}>
                        {t("المزود:", "Prestataire:")} {req.assignedProviderName}
                      </p>
                    )}
                    <p className="text-xs mt-0.5 opacity-40" style={{ color: "#1A4D1F" }}>{timeAgo(req.createdAt, lang)}</p>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="px-4">
          <AnimatePresence mode="wait">

            {/* Form */}
            {step === "form" && (
              <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-4">

                {/* SOS Banner */}
                <div className="rounded-2xl p-5 text-center mb-2"
                  style={{ background: "#EF444415", border: "1px solid #EF444430" }}>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
                    style={{ background: "#EF444425" }}>
                    <AlertTriangle size={32} style={{ color: "#EF4444" }} className="animate-pulse" />
                  </div>
                  <p className="font-black text-base" style={{ color: "#EF4444" }}>
                    {t("طلب مساعدة عاجلة", "Demande d'aide urgente")}
                  </p>
                  <p className="text-xs mt-1 opacity-60" style={{ color: "#1A4D1F" }}>
                    {t("سيصل أقرب مزود للمساعدة في أسرع وقت", "Le prestataire le plus proche interviendra rapidement")}
                  </p>
                </div>

                {/* GPS status */}
                <div className="flex items-center gap-2 p-3 rounded-xl"
                  style={{ background: gps ? "#D1FAE5" : "#FEF3C7", border: `1px solid ${gps ? "#059669" : "#92400E"}30` }}>
                  <MapPin size={14} style={{ color: gps ? "#059669" : "#92400E" }} />
                  <span className="text-xs font-bold flex-1" style={{ color: gps ? "#059669" : "#92400E" }}>
                    {gps
                      ? t(`موقعك محدد ✓`, `Position détectée ✓`)
                      : gpsError || t("يجري تحديد موقعك...", "Localisation en cours...")}
                  </span>
                  {!gps && !gpsError && (
                    <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "#92400E", borderTopColor: "transparent" }} />
                  )}
                  {gpsError && (
                    <button onClick={getGps} className="text-xs font-black underline" style={{ color: "#92400E" }}>
                      {t("حاول مجدداً", "Réessayer")}
                    </button>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>
                    {t("الاسم الكامل *", "Nom complet *")}
                  </label>
                  <input value={customerName} onChange={e => setName(e.target.value)}
                    placeholder={t("اسمك الكامل", "Votre nom")}
                    className="w-full rounded-xl px-3 py-3 text-sm font-bold border outline-none"
                    style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>
                    {t("رقم الهاتف *", "Téléphone *")}
                  </label>
                  <div className="relative">
                    <Phone size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30" style={{ color: "#1A4D1F" }} />
                    <input type="tel" value={customerPhone} onChange={e => setPhone(e.target.value)}
                      placeholder="+216 XX XXX XXX" dir="ltr"
                      className="w-full rounded-xl px-3 py-3 pr-9 text-sm font-bold border outline-none"
                      style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>
                    {t("وصف المشكلة (اختياري)", "Description (optionnel)")}
                  </label>
                  <textarea value={description} onChange={e => setDesc(e.target.value)}
                    rows={3} placeholder={t("صف ما تحتاج إليه بإيجاز...", "Décrivez votre problème...")}
                    className="w-full rounded-xl px-3 py-3 text-sm font-bold border outline-none resize-none"
                    style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                </div>

                {/* Submit */}
                <button onClick={submitSos}
                  disabled={submitting || !customerName || !customerPhone}
                  className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                  style={{ background: "#EF4444", boxShadow: "0 8px 24px -8px #EF444455" }}>
                  {submitting
                    ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    : <AlertTriangle size={18} />}
                  {t("إرسال طلب SOS", "Envoyer SOS")}
                </button>
              </motion.div>
            )}

            {/* Done */}
            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-10 gap-5">
                <div className="w-24 h-24 rounded-full flex items-center justify-center"
                  style={{ background: "#EF444415", border: "2px solid #EF444430" }}>
                  <AlertTriangle size={40} style={{ color: "#EF4444" }} className="animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="font-black text-2xl mb-1" style={{ color: "#1A4D1F" }}>
                    {t("تم إرسال طلب SOS!", "Demande SOS envoyée !")}
                  </p>
                  <p className="text-sm opacity-60" style={{ color: "#1A4D1F" }}>
                    {t("طلبك يصل لأقرب مزود خدمة...", "Votre demande parvient au prestataire le plus proche...")}
                  </p>
                </div>

                {/* Live status */}
                {liveStatus && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="w-full rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #1A4D1F11" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black opacity-50" style={{ color: "#1A4D1F" }}>
                        {t("حالة الطلب", "Statut")}
                      </span>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full"
                        style={{ color: STATUS_MAP[liveStatus.status]?.color, background: STATUS_MAP[liveStatus.status]?.bg }}>
                        {lang === "ar" ? STATUS_MAP[liveStatus.status]?.ar : STATUS_MAP[liveStatus.status]?.fr}
                      </span>
                    </div>
                    {liveStatus.assignedProviderName && (
                      <p className="text-sm font-black" style={{ color: "#1A4D1F" }}>
                        {t("المزود:", "Prestataire:")} {liveStatus.assignedProviderName}
                      </p>
                    )}
                    {liveStatus.status === "pending" && (
                      <div className="flex items-center gap-2 mt-2 text-xs opacity-50" style={{ color: "#1A4D1F" }}>
                        <Clock size={12} /> {t("في انتظار القبول...", "En attente d'acceptation...")}
                      </div>
                    )}
                  </motion.div>
                )}

                <button
                  onClick={() => { setStep("form"); setDesc(""); setCreatedId(null); setLiveStatus(null); }}
                  className="w-full py-3 rounded-2xl font-black text-sm border-2"
                  style={{ color: "#1A4D1F", borderColor: "#1A4D1F33" }}>
                  {t("طلب جديد", "Nouvelle demande")}
                </button>

                <button onClick={() => navigate("/home")}
                  className="text-sm font-bold opacity-50" style={{ color: "#1A4D1F" }}>
                  {t("العودة للرئيسية", "Retour à l'accueil")}
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
