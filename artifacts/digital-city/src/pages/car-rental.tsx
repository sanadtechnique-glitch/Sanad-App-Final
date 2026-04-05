import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Car, ChevronRight, Calendar, Fuel, Users, Settings2, ArrowRight, Check, X, Clock, Phone, MapPin } from "lucide-react";
import { useLang } from "@/lib/language";
import { getSession } from "@/lib/auth";
import { Layout } from "@/components/layout";

const API = (path: string) => `/api${path}`;
const token = () => getSession()?.token || "";

interface CarItem {
  id: number; agencyId: number; make: string; model: string; year?: number;
  color?: string; pricePerDay: number; seats?: number; transmission?: string;
  fuelType?: string; imageUrl?: string; description?: string; descriptionAr?: string;
  isAvailable: boolean;
}

interface Agency {
  id: number; name: string; nameAr: string; phone?: string; address?: string; photoUrl?: string;
}

interface Booking {
  id: number; carId: number; agencyId: number; customerName: string; customerPhone: string;
  startDate: string; endDate: string; durationDays: number; totalPrice: number;
  status: string; notes?: string; createdAt: string;
}

const STATUS_MAP: Record<string, { ar: string; fr: string; color: string; bg: string }> = {
  pending:   { ar: "في الانتظار", fr: "En attente",   color: "#92400E", bg: "#FEF3C7" },
  confirmed: { ar: "مؤكد",        fr: "Confirmé",     color: "#1D4ED8", bg: "#DBEAFE" },
  rejected:  { ar: "مرفوض",       fr: "Refusé",       color: "#DC2626", bg: "#FEE2E2" },
  active:    { ar: "نشط",         fr: "Actif",        color: "#059669", bg: "#D1FAE5" },
  completed: { ar: "مكتمل",       fr: "Terminé",      color: "#6D28D9", bg: "#EDE9FE" },
  cancelled: { ar: "ملغي",        fr: "Annulé",       color: "#6B7280", bg: "#F3F4F6" },
};

export default function CarRentalPage() {
  const { t, lang } = useLang();
  const [, navigate] = useLocation();
  const [cars, setCars]           = useState<CarItem[]>([]);
  const [agencies, setAgencies]   = useState<Agency[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<CarItem | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [myBookings, setMyBookings]   = useState<Booking[]>([]);
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [booking, setBooking] = useState({ startDate: "", endDate: "", customerName: "", customerPhone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const session = getSession();
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    Promise.all([
      fetch(API("/car-rental/cars")).then(r => r.json()),
      fetch(API("/car-rental/agencies")).then(r => r.json()),
    ]).then(([carsData, agenciesData]) => {
      setCars(Array.isArray(carsData) ? carsData : []);
      setAgencies(Array.isArray(agenciesData) ? agenciesData : []);
    }).finally(() => setLoading(false));

    if (session) {
      setBooking(b => ({ ...b, customerName: session.name || "", customerPhone: session.phone || "" }));
      fetch(API(`/car-rental/bookings/my/${session.userId}`))
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setMyBookings(d); });
    }
  }, []);

  const agencyName = (id: number) => {
    const a = agencies.find(x => x.id === id);
    return a ? (lang === "ar" ? a.nameAr : a.name) : "";
  };

  const calcDuration = () => {
    if (!booking.startDate || !booking.endDate) return 0;
    const ms = new Date(booking.endDate).getTime() - new Date(booking.startDate).getTime();
    return Math.max(1, Math.ceil(ms / 86400000));
  };

  const totalPrice = () => selected ? calcDuration() * selected.pricePerDay : 0;

  const submitBooking = async () => {
    if (!selected || !booking.startDate || !booking.endDate || !booking.customerName || !booking.customerPhone) return;
    setSubmitting(true);
    try {
      const duration = calcDuration();
      await fetch(API("/car-rental/bookings"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": token() },
        body: JSON.stringify({
          customerId: session?.userId || null,
          customerName: booking.customerName,
          customerPhone: booking.customerPhone,
          carId: selected.id, agencyId: selected.agencyId,
          startDate: booking.startDate, endDate: booking.endDate,
          durationDays: duration, totalPrice: totalPrice(),
          notes: booking.notes || null,
        }),
      });
      setDone(true);
      setTimeout(() => { setDone(false); setShowBooking(false); setSelected(null); }, 2500);
    } finally { setSubmitting(false); }
  };

  return (
    <Layout>
      <div className="min-h-screen pb-24" style={{ background: "#FFF3E0" }}>
        {/* Header */}
        <div className="sticky top-0 z-40 px-4 pt-4 pb-3" style={{ background: "#FFF3E0" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/home")} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#1A4D1F22" }}>
              <ChevronRight size={18} style={{ color: "#1A4D1F" }} className="rtl:rotate-180" />
            </button>
            <div className="flex-1">
              <h1 className="font-black text-base" style={{ color: "#1A4D1F" }}>{t("كراء السيارات", "Location de voitures")}</h1>
              <p className="text-xs opacity-50" style={{ color: "#1A4D1F" }}>{t("اختر سيارتك واحجز مباشرة", "Choisissez et réservez directement")}</p>
            </div>
            {session && (
              <button onClick={() => setShowMyBookings(!showMyBookings)}
                className="text-xs font-black px-3 py-1.5 rounded-full border"
                style={{ color: "#1A4D1F", borderColor: "#1A4D1F44" }}>
                {t("حجوزاتي", "Mes réservations")}
              </button>
            )}
          </div>
        </div>

        {/* My Bookings Panel */}
        <AnimatePresence>
          {showMyBookings && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #1A4D1F22" }}>
              <div className="p-4 border-b" style={{ borderColor: "#1A4D1F11" }}>
                <p className="font-black text-sm" style={{ color: "#1A4D1F" }}>{t("حجوزاتي", "Mes réservations")}</p>
              </div>
              {myBookings.length === 0 ? (
                <div className="p-6 text-center text-sm opacity-40" style={{ color: "#1A4D1F" }}>{t("لا توجد حجوزات", "Aucune réservation")}</div>
              ) : (
                <div className="divide-y" style={{ borderColor: "#1A4D1F11" }}>
                  {myBookings.map(b => {
                    const s = STATUS_MAP[b.status] || STATUS_MAP.pending;
                    return (
                      <div key={b.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black" style={{ color: "#1A4D1F" }}>#{b.id} · {b.durationDays} {t("يوم", "j")} · {b.totalPrice} {t("د.ت", "TND")}</span>
                          <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ color: s.color, background: s.bg }}>{lang === "ar" ? s.ar : s.fr}</span>
                        </div>
                        <p className="text-xs mt-1 opacity-50" style={{ color: "#1A4D1F" }}>{b.startDate} → {b.endDate}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cars Grid */}
        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-[#1A4D1F]/20 border-t-[#1A4D1F] animate-spin" /></div>
        ) : cars.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-40">
            <Car size={40} style={{ color: "#1A4D1F" }} />
            <p className="text-sm font-bold" style={{ color: "#1A4D1F" }}>{t("لا توجد سيارات متاحة", "Aucune voiture disponible")}</p>
          </div>
        ) : (
          <div className="px-4 grid grid-cols-1 gap-4">
            {cars.map((car, i) => (
              <motion.div key={car.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                onClick={() => { setSelected(car); setShowBooking(true); }}
                className="rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
                style={{ background: "#fff", border: "1px solid #1A4D1F11" }}>
                {/* Car image */}
                <div className="relative h-44 overflow-hidden" style={{ background: "#FFF3E0" }}>
                  {car.imageUrl ? (
                    <img src={car.imageUrl} alt={`${car.make} ${car.model}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Car size={64} style={{ color: "#1A4D1F", opacity: 0.2 }} />
                    </div>
                  )}
                  <div className="absolute top-3 end-3 px-2.5 py-1 rounded-full text-xs font-black" style={{ background: "#FFA500", color: "#fff" }}>
                    {car.pricePerDay} {t("د.ت/يوم", "TND/j")}
                  </div>
                  {car.year && (
                    <div className="absolute top-3 start-3 px-2 py-0.5 rounded-full text-xs font-black" style={{ background: "#1A4D1F", color: "#fff" }}>
                      {car.year}
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-black text-base" style={{ color: "#1A4D1F" }}>{car.make} {car.model}</h3>
                      <p className="text-xs opacity-50" style={{ color: "#1A4D1F" }}>{agencyName(car.agencyId)}</p>
                    </div>
                    {car.color && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#FFF3E0", color: "#1A4D1F" }}>{car.color}</span>
                    )}
                  </div>

                  {/* Specs row */}
                  <div className="flex gap-3 flex-wrap">
                    {car.seats && (
                      <div className="flex items-center gap-1 text-xs" style={{ color: "#1A4D1F88" }}>
                        <Users size={12} /> {car.seats} {t("مقاعد", "places")}
                      </div>
                    )}
                    {car.transmission && (
                      <div className="flex items-center gap-1 text-xs" style={{ color: "#1A4D1F88" }}>
                        <Settings2 size={12} /> {car.transmission === "automatic" ? t("أوتوماتيك", "Automatique") : t("يدوي", "Manuelle")}
                      </div>
                    )}
                    {car.fuelType && (
                      <div className="flex items-center gap-1 text-xs" style={{ color: "#1A4D1F88" }}>
                        <Fuel size={12} /> {car.fuelType === "diesel" ? t("ديزل", "Diesel") : car.fuelType === "electrique" ? t("كهربائي", "Électrique") : t("بنزين", "Essence")}
                      </div>
                    )}
                  </div>

                  {(lang === "ar" ? car.descriptionAr : car.description) && (
                    <p className="text-xs mt-2 opacity-60 leading-relaxed" style={{ color: "#1A4D1F" }}>
                      {lang === "ar" ? car.descriptionAr : car.description}
                    </p>
                  )}

                  <button className="mt-3 w-full py-2.5 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2"
                    style={{ background: "#1A4D1F" }}>
                    {t("احجز الآن", "Réserver maintenant")} <ArrowRight size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Booking Modal */}
        <AnimatePresence>
          {showBooking && selected && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={e => { if (e.target === e.currentTarget) { setShowBooking(false); setDone(false); } }}>
              <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28 }}
                className="w-full max-h-[90vh] overflow-y-auto rounded-t-3xl p-6"
                style={{ background: "#FFF3E0" }}>
                {done ? (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center py-10 gap-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#1A4D1F" }}>
                      <Check size={32} className="text-white" />
                    </div>
                    <p className="font-black text-lg" style={{ color: "#1A4D1F" }}>{t("تم إرسال طلب الحجز!", "Demande envoyée!")}</p>
                    <p className="text-sm opacity-60 text-center" style={{ color: "#1A4D1F" }}>{t("سيتواصل معك صاحب الوكالة لتأكيد الحجز", "L'agence vous contactera pour confirmer")}</p>
                  </motion.div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="font-black text-lg" style={{ color: "#1A4D1F" }}>{selected.make} {selected.model}</h2>
                        <p className="text-sm opacity-50" style={{ color: "#1A4D1F" }}>{agencyName(selected.agencyId)}</p>
                      </div>
                      <button onClick={() => setShowBooking(false)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#1A4D1F22" }}>
                        <X size={16} style={{ color: "#1A4D1F" }} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>{t("تاريخ الاستلام", "Date début")}</label>
                          <input type="date" min={today} value={booking.startDate}
                            onChange={e => setBooking(b => ({ ...b, startDate: e.target.value }))}
                            className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border outline-none"
                            style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                        </div>
                        <div>
                          <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>{t("تاريخ الإرجاع", "Date fin")}</label>
                          <input type="date" min={booking.startDate || today} value={booking.endDate}
                            onChange={e => setBooking(b => ({ ...b, endDate: e.target.value }))}
                            className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border outline-none"
                            style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                        </div>
                      </div>

                      {/* Duration & Price */}
                      {booking.startDate && booking.endDate && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="flex items-center justify-between rounded-xl p-3"
                          style={{ background: "#FFA50020", border: "1px solid #FFA50033" }}>
                          <div className="flex items-center gap-2 text-sm font-black" style={{ color: "#1A4D1F" }}>
                            <Calendar size={14} /> {calcDuration()} {t("يوم/أيام", "jour(s)")}
                          </div>
                          <div className="text-sm font-black" style={{ color: "#FFA500" }}>
                            {totalPrice().toFixed(0)} {t("د.ت", "TND")}
                          </div>
                        </motion.div>
                      )}

                      {/* Customer info */}
                      <div>
                        <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>{t("الاسم الكامل", "Nom complet")}</label>
                        <input value={booking.customerName} onChange={e => setBooking(b => ({ ...b, customerName: e.target.value }))}
                          placeholder={t("اسمك", "Votre nom")}
                          className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border outline-none"
                          style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                      </div>
                      <div>
                        <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>{t("رقم الهاتف", "Téléphone")}</label>
                        <input type="tel" value={booking.customerPhone} onChange={e => setBooking(b => ({ ...b, customerPhone: e.target.value }))}
                          placeholder="+216 XX XXX XXX" dir="ltr"
                          className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border outline-none"
                          style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                      </div>
                      <div>
                        <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>{t("ملاحظات (اختياري)", "Notes (optionnel)")}</label>
                        <textarea value={booking.notes} onChange={e => setBooking(b => ({ ...b, notes: e.target.value }))}
                          rows={2} placeholder={t("أي ملاحظات إضافية...", "Notes supplémentaires...")}
                          className="w-full rounded-xl px-3 py-2.5 text-sm font-bold border outline-none resize-none"
                          style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }} />
                      </div>

                      <button onClick={submitBooking} disabled={submitting || !booking.startDate || !booking.endDate || !booking.customerName || !booking.customerPhone}
                        className="w-full py-3.5 rounded-2xl font-black text-white text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                        style={{ background: "#1A4D1F" }}>
                        {submitting ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : null}
                        {t("تأكيد طلب الحجز", "Confirmer la réservation")}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
