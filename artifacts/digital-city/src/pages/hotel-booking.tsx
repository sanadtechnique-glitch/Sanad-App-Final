import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLang } from "@/lib/language";
import { get, post } from "@/lib/admin-api";
import { getSession } from "@/lib/auth";
import {
  Hotel, Calendar, Phone, MapPin, CheckCircle2, Loader2,
  Star, Plus, Minus, BedDouble, ImageIcon, ChevronRight, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ── */
interface HotelSupplier {
  id: number; name: string; nameAr: string;
  description: string; descriptionAr: string;
  address: string; rating?: number; isAvailable: boolean; photoUrl?: string;
}
interface Room {
  id: number; nameAr: string; nameFr: string;
  descriptionAr: string; descriptionFr: string;
  price: number; originalPrice?: number | null; photoUrl?: string | null;
  isAvailable: boolean;
}
interface SelectedRoom { roomId: number; nameAr: string; nameFr: string; qty: number; pricePerNight: number; photoUrl?: string | null; }

/* ── Helpers ── */
function diffDays(a: string, b: string) {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

const today = new Date().toISOString().split("T")[0];

function Stars({ val }: { val: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={10} className={i <= Math.round(val) ? "text-[#FFA500] fill-[#FFA500]" : "text-[#1A4D1F]/15"} />
      ))}
      <span className="text-xs text-[#1A4D1F]/30 ms-1">{val.toFixed(1)}</span>
    </div>
  );
}

export default function HotelBooking() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { lang, t } = useLang();
  const session = getSession();

  const [hotel, setHotel]       = useState<HotelSupplier | null>(null);
  const [rooms, setRooms]       = useState<Room[]>([]);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Selection state
  const [selected, setSelected] = useState<Record<number, number>>({}); // roomId → qty

  // Booking form
  const [name, setName]         = useState(session?.name || "");
  const [phone, setPhone]       = useState(session?.phone || "");
  const [checkIn, setCheckIn]   = useState("");
  const [checkOut, setCheckOut] = useState("");

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]   = useState(false);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [errMsg, setErrMsg]     = useState("");

  /* ── Load hotel + rooms ── */
  useEffect(() => {
    const hotelId = parseInt(id || "0");
    Promise.all([
      get<HotelSupplier[]>("/services").catch(() => []),
      get<Room[]>(`/provider/${hotelId}/articles`).catch(() => []),
    ]).then(([providers, arts]) => {
      const found = providers.find(p => p.id === hotelId);
      if (!found) { setNotFound(true); setLoading(false); return; }
      setHotel(found);
      setRooms(arts.filter(a => a.isAvailable));
      setLoading(false);
    });
  }, [id]);

  /* ── Computed ── */
  const nights = diffDays(checkIn, checkOut);
  const selectedRooms: SelectedRoom[] = Object.entries(selected)
    .filter(([, qty]) => qty > 0)
    .map(([roomId, qty]) => {
      const r = rooms.find(x => x.id === parseInt(roomId))!;
      return { roomId: parseInt(roomId), nameAr: r.nameAr, nameFr: r.nameFr, qty, pricePerNight: r.price, photoUrl: r.photoUrl };
    });

  const totalPerNight = selectedRooms.reduce((s, r) => s + r.qty * r.pricePerNight, 0);
  const totalPrice    = totalPerNight * (nights || 1);

  const setQty = (roomId: number, delta: number) => {
    setSelected(prev => {
      const next = Math.max(0, (prev[roomId] || 0) + delta);
      return { ...prev, [roomId]: next };
    });
  };

  /* ── Submit ── */
  const submit = async () => {
    setErrMsg("");
    if (!name.trim()) { setErrMsg(t("الاسم الكامل مطلوب", "Nom complet requis")); return; }
    if (!phone.trim()) { setErrMsg(t("رقم الهاتف مطلوب", "Téléphone requis")); return; }
    if (!checkIn) { setErrMsg(t("تاريخ الوصول مطلوب", "Date d'arrivée requise")); return; }
    if (!checkOut || checkOut <= checkIn) { setErrMsg(t("تاريخ المغادرة يجب أن يكون بعد الوصول", "Date de départ invalide")); return; }
    if (selectedRooms.length === 0) { setErrMsg(t("يجب اختيار غرفة واحدة على الأقل", "Choisissez au moins une chambre")); return; }

    setSubmitting(true);
    try {
      const res = await post<{ id: number }>("/hotel-bookings", {
        hotelId: hotel!.id,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        checkIn, checkOut,
        guests: selectedRooms.reduce((s, r) => s + r.qty, 0),
        selectedRooms,
        totalPrice,
      });
      setBookingId(res.id);
      setSuccess(true);
    } catch (err: any) {
      setErrMsg(err?.message || t("فشل الإرسال، حاول مجدداً", "Erreur, réessayez"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ── States ── */
  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="w-8 h-8 border-[3px] border-[#1A4D1F] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (notFound || !hotel) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <Hotel size={48} className="text-[#1A4D1F]/10 mb-4" />
          <p className="text-[#1A4D1F]/30 font-bold">{t("الفندق غير موجود", "Hôtel introuvable")}</p>
        </div>
      </Layout>
    );
  }

  /* ── Success screen ── */
  if (success) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto px-4 py-12 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl p-8" style={{ background: "#fff", border: "1px solid #1A4D1F22" }}>
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={36} className="text-emerald-500" />
            </div>
            <h2 className="text-2xl font-black text-[#1A4D1F] mb-2">{t("تم إرسال طلب الحجز ✓", "Demande envoyée ✓")}</h2>
            {bookingId && (
              <p className="text-[#1A4D1F]/40 text-sm mb-1">
                {t("رقم الحجز", "Réf.")}: <span className="font-mono font-bold text-[#1A4D1F]">#{String(bookingId).padStart(4, "0")}</span>
              </p>
            )}
            <div className="bg-[#FFF3E0] rounded-2xl p-4 my-4 text-right">
              {selectedRooms.map(r => (
                <div key={r.roomId} className="flex justify-between text-sm font-bold text-[#1A4D1F] py-0.5">
                  <span>{r.qty}× {lang === "ar" ? r.nameAr : r.nameFr}</span>
                  <span>{(r.qty * r.pricePerNight).toFixed(3)} TND/ليلة</span>
                </div>
              ))}
              {nights > 0 && (
                <div className="border-t border-[#1A4D1F]/10 mt-2 pt-2 flex justify-between font-black text-[#1A4D1F]">
                  <span>{nights} {t("ليلة", "nuit(s)")}</span>
                  <span className="text-[#FFA500]">{totalPrice.toFixed(3)} TND</span>
                </div>
              )}
            </div>
            <p className="text-[#1A4D1F]/40 text-sm mb-6">
              {t("سيتواصل معك الفندق لتأكيد الحجز", "L'hôtel vous contactera pour confirmer.")}
            </p>
            <button onClick={() => navigate("/home")}
              className="w-full py-3 rounded-2xl font-black text-white"
              style={{ background: "#1A4D1F" }}>
              {t("العودة للرئيسية", "Retour à l'accueil")}
            </button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  /* ── Main booking page ── */
  return (
    <Layout>
      <div className="max-w-lg mx-auto pb-32" style={{ background: "#FFF3E0", minHeight: "100vh" }}>

        {/* Header */}
        <div className="sticky top-0 z-30 px-4 pt-4 pb-3" style={{ background: "#FFF3E0" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1 as any)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-white border border-[#1A4D1F]/10">
              <ChevronRight size={18} className="text-[#1A4D1F] rtl:rotate-180" />
            </button>
            <div>
              <h1 className="font-black text-base text-[#1A4D1F]">{t("حجز فندق", "Réservation hôtel")}</h1>
              <p className="text-xs text-[#1A4D1F]/40">{lang === "ar" ? hotel.nameAr : hotel.name}</p>
            </div>
          </div>
        </div>

        <div className="px-4 space-y-5">
          {/* Hotel card */}
          <div className="rounded-2xl overflow-hidden bg-white border border-[#1A4D1F]/10">
            {hotel.photoUrl && (
              <img src={hotel.photoUrl} alt={hotel.nameAr} className="w-full h-32 object-cover" />
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-black text-[#1A4D1F]">{lang === "ar" ? hotel.nameAr : hotel.name}</p>
                  {hotel.rating && <Stars val={hotel.rating} />}
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#1A4D1F]/5 flex items-center justify-center flex-shrink-0">
                  <Hotel size={18} className="text-[#1A4D1F]" />
                </div>
              </div>
              {hotel.address && (
                <div className="flex items-center gap-1.5 mt-2">
                  <MapPin size={11} className="text-[#1A4D1F]/30" />
                  <p className="text-xs text-[#1A4D1F]/40 truncate">{hotel.address}</p>
                </div>
              )}
              {(lang === "ar" ? hotel.descriptionAr : hotel.description) && (
                <p className="text-xs text-[#1A4D1F]/50 mt-2 leading-relaxed">
                  {lang === "ar" ? hotel.descriptionAr : hotel.description}
                </p>
              )}
            </div>
          </div>

          {/* Rooms list */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BedDouble size={16} className="text-[#1A4D1F]" />
              <h2 className="font-black text-[#1A4D1F]">{t("أنواع الغرف", "Types de chambres")}</h2>
            </div>

            {rooms.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-[#1A4D1F]/10">
                <BedDouble size={32} className="mx-auto mb-2 text-[#1A4D1F]/20" />
                <p className="text-sm font-bold text-[#1A4D1F]/30">{t("لا توجد غرف متاحة حالياً", "Aucune chambre disponible")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rooms.map(room => {
                  const qty = selected[room.id] || 0;
                  return (
                    <motion.div key={room.id} layout
                      className={cn(
                        "rounded-2xl overflow-hidden border-2 transition-all",
                        qty > 0 ? "border-[#FFA500] bg-white" : "border-[#1A4D1F]/10 bg-white"
                      )}>
                      <div className="flex gap-3 p-3">
                        {/* Room image */}
                        <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#1A4D1F]/5 border border-[#1A4D1F]/10 flex items-center justify-center">
                          {room.photoUrl
                            ? <img src={room.photoUrl} alt={room.nameAr} className="w-full h-full object-cover" />
                            : <ImageIcon size={20} className="text-[#1A4D1F]/20" />
                          }
                        </div>
                        {/* Room info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm text-[#1A4D1F]">
                            {lang === "ar" ? room.nameAr : room.nameFr}
                          </p>
                          {(lang === "ar" ? room.descriptionAr : room.descriptionFr) && (
                            <p className="text-xs text-[#1A4D1F]/50 mt-0.5 leading-relaxed">
                              {lang === "ar" ? room.descriptionAr : room.descriptionFr}
                            </p>
                          )}
                          <div className="flex items-end gap-2 mt-1.5">
                            <span className="font-black text-[#1A4D1F]">{room.price.toFixed(3)} TND</span>
                            <span className="text-xs text-[#1A4D1F]/40">{t("/ ليلة", "/ nuit")}</span>
                            {room.originalPrice && room.originalPrice > room.price && (
                              <span className="text-xs line-through text-[#1A4D1F]/30">{room.originalPrice.toFixed(3)}</span>
                            )}
                          </div>
                        </div>
                        {/* Qty selector */}
                        <div className="flex flex-col items-center justify-center gap-1.5 flex-shrink-0">
                          <button onClick={() => setQty(room.id, 1)}
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-all",
                              qty > 0 ? "bg-[#FFA500] text-white" : "bg-[#1A4D1F]/10 text-[#1A4D1F]"
                            )}>
                            <Plus size={14} />
                          </button>
                          <span className={cn("font-black text-sm", qty > 0 ? "text-[#FFA500]" : "text-[#1A4D1F]/30")}>
                            {qty}
                          </span>
                          <button onClick={() => setQty(room.id, -1)}
                            disabled={qty === 0}
                            className="w-8 h-8 rounded-full flex items-center justify-center bg-[#1A4D1F]/5 text-[#1A4D1F]/30 disabled:opacity-30 transition-all">
                            <Minus size={14} />
                          </button>
                        </div>
                      </div>
                      {/* Selection summary */}
                      {qty > 0 && (
                        <div className="px-3 pb-3">
                          <div className="text-xs font-bold text-[#FFA500] bg-[#FFA500]/10 rounded-xl px-3 py-1.5 flex justify-between">
                            <span>{qty} {lang === "ar" ? room.nameAr : room.nameFr}</span>
                            <span>{(qty * room.price).toFixed(3)} TND {t("/ ليلة", "/ nuit")}</span>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Booking form */}
          <div className="space-y-4">
            <h2 className="font-black text-[#1A4D1F] flex items-center gap-2">
              <Users size={16} /> {t("بيانات الحجز", "Détails de la réservation")}
            </h2>

            {/* Name */}
            <div>
              <label className="block text-xs font-black mb-1.5 text-[#1A4D1F]/50 uppercase tracking-wide">
                {t("الاسم الكامل *", "Nom complet *")}
              </label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder={t("أدخل اسمك الكامل", "Votre nom complet")}
                className="w-full bg-white border border-[#1A4D1F]/20 rounded-xl px-4 py-3 text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-black mb-1.5 text-[#1A4D1F]/50 uppercase tracking-wide">
                {t("رقم الهاتف *", "Téléphone *")}
              </label>
              <div className="relative">
                <Phone size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A4D1F]/25" />
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+216 XX XXX XXX" dir="ltr"
                  className="w-full bg-white border border-[#1A4D1F]/20 rounded-xl px-4 py-3 pr-10 text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" />
              </div>
            </div>

            {/* Check-in / Check-out */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black mb-1.5 text-[#1A4D1F]/50 uppercase tracking-wide">
                  {t("تاريخ الوصول *", "Arrivée *")}
                </label>
                <div className="relative">
                  <Calendar size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A4D1F]/25" />
                  <input type="date" value={checkIn} min={today}
                    onChange={e => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut(""); }}
                    className="w-full bg-white border border-[#1A4D1F]/20 rounded-xl py-3 px-3 pr-9 text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50 [color-scheme:light]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black mb-1.5 text-[#1A4D1F]/50 uppercase tracking-wide">
                  {t("تاريخ المغادرة *", "Départ *")}
                </label>
                <div className="relative">
                  <Calendar size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A4D1F]/25" />
                  <input type="date" value={checkOut} min={checkIn || today}
                    onChange={e => setCheckOut(e.target.value)}
                    className="w-full bg-white border border-[#1A4D1F]/20 rounded-xl py-3 px-3 pr-9 text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50 [color-scheme:light]" />
                </div>
              </div>
            </div>
          </div>

          {/* Price summary */}
          {(selectedRooms.length > 0 || nights > 0) && (
            <motion.div layout className="rounded-2xl bg-white border border-[#1A4D1F]/10 p-4 space-y-2">
              <p className="text-xs font-black text-[#1A4D1F]/50 uppercase tracking-wide">{t("ملخص الحجز", "Récapitulatif")}</p>
              {selectedRooms.map(r => (
                <div key={r.roomId} className="flex justify-between text-sm text-[#1A4D1F] font-bold">
                  <span>{r.qty}× {lang === "ar" ? r.nameAr : r.nameFr}</span>
                  <span>{(r.qty * r.pricePerNight).toFixed(3)} TND/ليلة</span>
                </div>
              ))}
              {nights > 0 && selectedRooms.length > 0 && (
                <>
                  <div className="border-t border-[#1A4D1F]/10 pt-2 flex justify-between text-sm text-[#1A4D1F]/60 font-bold">
                    <span>{t("عدد الليالي", "Nuits")}</span>
                    <span>× {nights}</span>
                  </div>
                  <div className="flex justify-between font-black text-base">
                    <span className="text-[#1A4D1F]">{t("المجموع", "Total")}</span>
                    <span className="text-[#FFA500]">{totalPrice.toFixed(3)} TND</span>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Error */}
          {errMsg && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-500 font-bold text-center">
              ⚠️ {errMsg}
            </div>
          )}

          {/* Submit button */}
          <button onClick={submit} disabled={submitting}
            className="w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all disabled:opacity-50 active:scale-95"
            style={{
              background: submitting ? "#1A4D1F88" : "#1A4D1F",
              color: "white",
              boxShadow: submitting ? "none" : "0 8px 24px -8px rgba(26,77,31,0.4)",
            }}>
            {submitting
              ? <><Loader2 size={20} className="animate-spin" />{t("جاري الإرسال...", "Envoi...")}</>
              : <><Hotel size={20} />{t("تأكيد الحجز", "Confirmer la réservation")}</>
            }
          </button>
        </div>
      </div>
    </Layout>
  );
}
