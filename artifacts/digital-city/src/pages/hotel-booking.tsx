import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLang } from "@/lib/language";
import { get, post } from "@/lib/admin-api";
import { Hotel, Calendar, Users, Phone, MapPin, CheckCircle2, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface HotelSupplier {
  id: number; name: string; nameAr: string;
  description: string; descriptionAr: string;
  address: string; rating?: number; isAvailable: boolean;
}

const schema = z.object({
  customerName:  z.string().min(2),
  customerPhone: z.string().min(8),
  checkIn:       z.string().min(1, "required"),
  checkOut:      z.string().min(1, "required"),
  guests:        z.coerce.number().min(1).max(20),
  notes:         z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-black text-white/50 mb-1.5 uppercase tracking-widest">{children}</label>;
}

export default function HotelBooking() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { lang, t, isRTL } = useLang();

  const [hotel, setHotel] = useState<HotelSupplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    get<HotelSupplier[]>("/services")
      .then(all => {
        const found = all.find(s => s.id === parseInt(id || "0") && s.category === "hotel");
        if (!found) { setNotFound(true); setLoading(false); return; }
        setHotel(found); setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [id]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { guests: 1 },
  });

  const today = new Date().toISOString().split("T")[0];

  const onSubmit = async (data: FormValues) => {
    if (!hotel) return;
    setSubmitting(true);
    try {
      const res = await post<{ id: number }>("/hotel-bookings", {
        hotelId: hotel.id,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        guests: data.guests,
        notes: data.notes,
      });
      setBookingId(res.id);
      setSuccess(true);
    } catch {
      alert(t("فشل إرسال الحجز. حاول مجدداً.", "Échec de la réservation. Réessayez."));
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="w-8 h-8 border-[3px] border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (notFound || !hotel) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <Hotel size={48} className="text-white/10 mb-4" />
          <p className="text-white/30 font-bold">{t("الفندق غير موجود", "Hôtel introuvable")}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={cn("max-w-lg mx-auto px-4 py-6", isRTL ? "text-right" : "text-left")}>
        {/* Page header */}
        <div className={`mb-6 ${isRTL ? "text-right" : "text-left"}`}>
          <h1 className="text-2xl font-black text-white mb-1">{t("حجز فندق", "Réservation Hôtel")}</h1>
          <p className="text-white/40 text-sm">{t("أدخل تفاصيل حجزك", "Saisissez les détails de votre réservation")}</p>
        </div>

        <AnimatePresence mode="wait">
          {success ? (
            /* ── Success screen ── */
            <motion.div key="success"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="rounded-[20px] border border-[#D4AF37]/30 p-8 text-center"
              style={{ background: "#121212" }}>
              <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={36} className="text-emerald-400" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">{t("تم إرسال الحجز! ✓", "Réservation envoyée! ✓")}</h2>
              {bookingId && (
                <p className="text-white/30 text-sm mb-1">
                  {t("رقم الحجز", "N° de réservation")}: <span className="font-mono text-[#D4AF37] font-bold">#{bookingId.toString().padStart(4, "0")}</span>
                </p>
              )}
              <p className="text-white/50 text-sm mb-6 leading-relaxed">
                {t("سيتواصل معك فريق الفندق لتأكيد الحجز.", "L'équipe de l'hôtel vous contactera pour confirmer.")}
              </p>
              <button onClick={() => setLocation("/services")}
                className="gold-btn px-8 py-3 rounded-xl">
                {t("العودة للخدمات", "Retour aux services")}
              </button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              {/* Hotel card */}
              <div className="rounded-[15px] p-4 mb-5 border border-[#D4AF37]/25 flex items-center gap-4"
                style={{ background: "#121212" }}>
                <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center flex-shrink-0">
                  <Hotel size={20} className="text-[#D4AF37]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white truncate">{lang === "ar" ? hotel.nameAr : (hotel.name || hotel.nameAr)}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <MapPin size={10} className="text-white/30" />
                    <p className="text-xs text-white/30 truncate">{hotel.address}</p>
                  </div>
                  {hotel.rating && (
                    <div className="flex items-center gap-0.5 mt-1">
                      {[1,2,3,4,5].map(i => <Star key={i} size={10} className={i <= Math.round(hotel.rating!) ? "text-[#D4AF37] fill-[#D4AF37]" : "text-white/15"} />)}
                      <span className="text-xs text-white/30 ml-1">{hotel.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <FieldLabel>{t("الاسم الكامل", "Nom complet")}</FieldLabel>
                  <input {...register("customerName")}
                    placeholder={t("أدخل اسمك الكامل", "Votre nom")}
                    className={cn("w-full bg-[#1a1a1a] border rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-white/30",
                      errors.customerName ? "border-red-500" : "border-[#444]")} />
                  {errors.customerName && <p className="text-xs text-red-400">{t("الاسم مطلوب", "Nom requis")}</p>}
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <FieldLabel>{t("رقم الهاتف", "Téléphone")}</FieldLabel>
                  <div className="relative">
                    <Phone size={14} className={cn("absolute top-1/2 -translate-y-1/2 text-white/25", isRTL ? "right-3.5" : "left-3.5")} />
                    <input {...register("customerPhone")} type="tel"
                      placeholder="+216 __ ___ ___"
                      className={cn("w-full bg-[#1a1a1a] border rounded-xl py-3.5 text-sm text-white placeholder:text-white/30",
                        isRTL ? "pr-10 pl-4" : "pl-10 pr-4",
                        errors.customerPhone ? "border-red-500" : "border-[#444]")} />
                  </div>
                  {errors.customerPhone && <p className="text-xs text-red-400">{t("رقم الهاتف مطلوب", "Téléphone requis")}</p>}
                </div>

                {/* Check-in / Check-out */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <FieldLabel>{t("تاريخ الوصول", "Arrivée")}</FieldLabel>
                    <div className="relative">
                      <Calendar size={13} className={cn("absolute top-1/2 -translate-y-1/2 text-white/25", isRTL ? "right-3" : "left-3")} />
                      <input {...register("checkIn")} type="date" min={today}
                        className={cn("w-full bg-[#1a1a1a] border rounded-xl py-3.5 text-sm text-white",
                          isRTL ? "pr-9 pl-3" : "pl-9 pr-3",
                          errors.checkIn ? "border-red-500" : "border-[#444]",
                          "[color-scheme:dark]")} />
                    </div>
                    {errors.checkIn && <p className="text-xs text-red-400">{t("مطلوب", "Requis")}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>{t("تاريخ المغادرة", "Départ")}</FieldLabel>
                    <div className="relative">
                      <Calendar size={13} className={cn("absolute top-1/2 -translate-y-1/2 text-white/25", isRTL ? "right-3" : "left-3")} />
                      <input {...register("checkOut")} type="date" min={today}
                        className={cn("w-full bg-[#1a1a1a] border rounded-xl py-3.5 text-sm text-white",
                          isRTL ? "pr-9 pl-3" : "pl-9 pr-3",
                          errors.checkOut ? "border-red-500" : "border-[#444]",
                          "[color-scheme:dark]")} />
                    </div>
                    {errors.checkOut && <p className="text-xs text-red-400">{t("مطلوب", "Requis")}</p>}
                  </div>
                </div>

                {/* Guests */}
                <div className="space-y-1.5">
                  <FieldLabel>{t("عدد الضيوف", "Nombre de personnes")}</FieldLabel>
                  <div className="relative">
                    <Users size={14} className={cn("absolute top-1/2 -translate-y-1/2 text-white/25", isRTL ? "right-3.5" : "left-3.5")} />
                    <input {...register("guests")} type="number" min="1" max="20"
                      className={cn("w-full bg-[#1a1a1a] border rounded-xl py-3.5 text-sm text-white",
                        isRTL ? "pr-10 pl-4" : "pl-10 pr-4",
                        errors.guests ? "border-red-500" : "border-[#444]")} />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <FieldLabel>{t("ملاحظات (اختياري)", "Notes (optionnel)")}</FieldLabel>
                  <textarea {...register("notes")} rows={3}
                    placeholder={t("نوع الغرفة، متطلبات خاصة...", "Type de chambre, besoins spéciaux...")}
                    className="w-full bg-[#1a1a1a] border border-[#444] rounded-xl px-4 py-3.5 text-sm text-white placeholder:text-white/25 resize-none" />
                </div>

                {/* Privacy note */}
                <div className="flex items-center gap-2 p-3 rounded-xl border border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <p className="text-xs text-white/30">
                    {t("سيتم التواصل معك للتأكيد. لا يتم مشاركة بياناتك.", "Nous vous contacterons pour confirmer. Données confidentielles.")}
                  </p>
                </div>

                {/* Submit */}
                <button type="submit" disabled={submitting}
                  className="w-full h-14 rounded-2xl font-black text-base text-black flex items-center justify-center gap-3 transition-all disabled:opacity-50"
                  style={{ background: submitting ? "rgba(212,175,55,0.5)" : "linear-gradient(135deg,#D4AF37,#B8962E)", boxShadow: submitting ? "none" : "0 0 30px -8px rgba(212,175,55,0.5)" }}>
                  {submitting
                    ? <><Loader2 size={20} className="animate-spin" />{t("جاري الإرسال...", "Envoi...")}</>
                    : <><Hotel size={20} />{t("تأكيد الحجز", "Confirmer la réservation")}</>}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
