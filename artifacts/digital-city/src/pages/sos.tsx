import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, MapPin, ChevronRight, Phone, Wrench, Stethoscope, Zap, HelpCircle, Check, X, Clock, Navigation } from "lucide-react";
import { useLang } from "@/lib/language";
import { getSession } from "@/lib/auth";
import { Layout } from "@/components/layout";

const API = (path: string) => `/api${path}`;
const token = () => getSession()?.token || "";

const CATEGORIES = [
  { id: "mechanic",  icon: Wrench,       ar: "ميكانيكي",      fr: "Mécanicien",   color: "#F59E0B" },
  { id: "doctor",    icon: Stethoscope,  ar: "طبيب",           fr: "Médecin",      color: "#3B82F6" },
  { id: "emergency", icon: Zap,          ar: "طوارئ",          fr: "Urgence",      color: "#EF4444" },
  { id: "other",     icon: HelpCircle,   ar: "أخرى",           fr: "Autre",        color: "#6B7280" },
];

interface SosRequest {
  id: number; customerName: string; customerPhone: string;
  lat: number; lng: number; description?: string;
  category: string; status: string;
  assignedProviderName?: string; createdAt: string;
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

  const [step, setStep]           = useState<"category" | "details" | "locating" | "done">("category");
  const [category, setCategory]   = useState("");
  const [description, setDesc]    = useState("");
  const [customerName, setName]   = useState(session?.name || "");
  const [customerPhone, setPhone] = useState(session?.phone || "");
  const [gps, setGps]             = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError]   = useState("");
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
  }, []);

  // Poll live status if there's a pending/accepted request
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
    setStep("locating");
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStep("details");
      },
      () => {
        setGpsError(t("تعذّر تحديد الموقع — حاول مرة أخرى", "Localisation échouée — réessayez"));
        setStep("details");
      },
      { timeout: 10000 }
    );
  };

  const submitSos = async () => {
    if (!customerName || !customerPhone || !category) return;
    setSubmitting(true);
    try {
      const body: any = {
        customerId: session?.userId || null,
        customerName, customerPhone, category, description,
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

  const catInfo = CATEGORIES.find(c => c.id === category);

  return (
    <Layout>
      <div className="min-h-screen pb-24" style={{ background: "#FFF3E0" }}>
        {/* Header */}
        <div className="sticky top-0 z-40 px-4 pt-4 pb-3" style={{ background: "#FFF3E0" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/home")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#EF444422" }}>
              <ChevronRight size={18} style={{ color: "#EF4444" }} className="rtl:rotate-180" />
            </button>
            <div className="flex-1">
              <h1 className="font-black text-base flex items-center gap-2" style={{ color: "#EF4444" }}>
                <AlertTriangle size={16} /> {t("خدمة SOS", "Service SOS")}
              </h1>
              <p className="text-xs opacity-50" style={{ color: "#1A4D1F" }}>{t("ستصل إلى أقرب مزود خدمة", "Envoyé au prestataire le plus proche")}</p>
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
              className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #EF444422" }}>
              <div className="p-4 border-b" style={{ borderColor: "#EF444411" }}>
                <p className="font-black text-sm" style={{ color: "#EF4444" }}>{t("طلباتي السابقة", "Mes demandes")}</p>
              </div>
              {myRequests.map(req => {
                const s = STATUS_MAP[req.status] || STATUS_MAP.pending;
                const cat = CATEGORIES.find(c => c.id === req.category);
                return (
                  <div key={req.id} className="p-4 border-b last:border-0" style={{ borderColor: "#EF444411" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black" style={{ color: "#1A4D1F" }}>
                        #{req.id} · {lang === "ar" ? cat?.ar : cat?.fr}
                      </span>
                      <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>
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

            {/* Step 1: Choose category */}
            {step === "category" && (
              <motion.div key="cat" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="mb-6 p-4 rounded-2xl" style={{ background: "#EF444415", border: "1px solid #EF444430" }}>
                  <p className="font-black text-sm text-center" style={{ color: "#EF4444" }}>
                    {t("ما نوع المساعدة التي تحتاج؟", "Quel type d'aide recherchez-vous ?")}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {CATEGORIES.map((cat, i) => {
                    const Icon = cat.icon;
                    return (
                      <motion.button key={cat.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                        onClick={() => { setCategory(cat.id); getGps(); }}
                        className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-3 border-2 transition-all active:scale-95"
                        style={{ background: "#fff", borderColor: cat.color + "33" }}>
                        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: cat.color + "20" }}>
                          <Icon size={28} style={{ color: cat.color }} />
                        </div>
                        <span className="font-black text-sm" style={{ color: "#1A4D1F" }}>
                          {lang === "ar" ? cat.ar : cat.fr}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Step: Locating */}
            {step === "locating" && (
              <motion.div key="loc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-24 gap-5">
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "#EF444415" }}>
                  <Navigation size={36} style={{ color: "#EF4444" }} className="animate-pulse" />
                </div>
                <p className="font-black text-base" style={{ color: "#1A4D1F" }}>{t("جاري تحديد موقعك...", "Localisation en cours...")}</p>
                <p className="text-xs opacity-50 text-center" style={{ color: "#1A4D1F" }}>{t("الرجاء السماح بالوصول للموقع", "Veuillez autoriser la localisation")}</p>
              </motion.div>
            )}

            {/* Step 2: Details */}
            {step === "details" && (
              <motion.div key="details" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-4">
                {/* Category badge */}
                {catInfo && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: catInfo.color + "15", border: `1px solid ${catInfo.color}30` }}>
                    <catInfo.icon size={20} style={{ color: catInfo.color }} />
                    <span className="font-black text-sm" style={{ color: catInfo.color }}>{lang === "ar" ? catInfo.ar : catInfo.fr}</span>
                    <button onClick={() => setStep("category")} className="ms-auto text-xs opacity-60" style={{ color: "#1A4D1F" }}>
                      {t("تغيير", "Changer")}
                    </button>
                  </div>
                )}

                {/* GPS status */}
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: gps ? "#D1FAE5" : "#FEF3C7", border: `1px solid ${gps ? "#059669" : "#92400E"}30` }}>
                  <MapPin size={14} style={{ color: gps ? "#059669" : "#92400E" }} />
                  <span className="text-xs font-bold" style={{ color: gps ? "#059669" : "#92400E" }}>
                    {gps
                      ? t(`موقعك: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`, `Position: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`)
                      : gpsError || t("لم يتم تحديد الموقع", "Position non disponible")}
                  </span>
                  {!gps && (
                    <button onClick={getGps} className="ms-auto text-xs font-black underline" style={{ color: "#92400E" }}>
                      {t("حاول مجدداً", "Réessayer")}
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>{t("الاسم الكامل", "Nom complet")}</label>
                  <input value={customerName} onChange={e => setName(e.target.value)}
                    placeholder={t("اسمك", "Votre nom")}
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border outline-none"
                    style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                </div>

                <div>
                  <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>{t("رقم الهاتف", "Téléphone")}</label>
                  <input type="tel" value={customerPhone} onChange={e => setPhone(e.target.value)}
                    placeholder="+216 XX XXX XXX" dir="ltr"
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border outline-none"
                    style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                </div>

                <div>
                  <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>{t("وصف المشكلة", "Description du problème")}</label>
                  <textarea value={description} onChange={e => setDesc(e.target.value)}
                    rows={3} placeholder={t("صف المشكلة بإيجاز...", "Décrivez le problème...")}
                    className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border outline-none resize-none"
                    style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                </div>

                <button onClick={submitSos} disabled={submitting || !customerName || !customerPhone}
                  className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: "#EF4444" }}>
                  {submitting
                    ? <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    : <AlertTriangle size={18} />}
                  {t("إرسال طلب المساعدة", "Envoyer la demande")}
                </button>
              </motion.div>
            )}

            {/* Step 3: Done */}
            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-10 gap-5">
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "#EF444415" }}>
                  <AlertTriangle size={36} style={{ color: "#EF4444" }} className="animate-pulse" />
                </div>
                <div className="text-center">
                  <p className="font-black text-xl mb-1" style={{ color: "#1A4D1F" }}>{t("تم إرسال طلب SOS!", "Demande SOS envoyée!")}</p>
                  <p className="text-sm opacity-60" style={{ color: "#1A4D1F" }}>
                    {t("طلبك يصل لأقرب مزود خدمة...", "Votre demande est transmise au prestataire le plus proche...")}
                  </p>
                </div>

                {/* Live status */}
                {liveStatus && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="w-full rounded-2xl p-4" style={{ background: "#fff", border: "1px solid #1A4D1F11" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black opacity-50" style={{ color: "#1A4D1F" }}>{t("حالة الطلب", "Statut")}</span>
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

                <button onClick={() => { setStep("category"); setCategory(""); setGps(null); setDesc(""); setCreatedId(null); setLiveStatus(null); }}
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
