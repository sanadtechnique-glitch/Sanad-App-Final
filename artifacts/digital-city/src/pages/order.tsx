import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { useLang } from "@/lib/language";
import { get, post } from "@/lib/admin-api";
import { useCart } from "@/lib/cart";
import { getSession } from "@/lib/auth";
import {
  ChevronRight, CheckCircle2, MapPin, User, StickyNote,
  Phone, Loader2, AlertTriangle, Star, Building2, Hash,
  Camera, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Supplier {
  id: number; name: string; nameAr: string; category: string;
  description: string; descriptionAr: string; address: string;
  rating?: number; isAvailable: boolean;
}
interface Delegation { id: number; name: string; nameAr: string; deliveryFee: number; }

const schema = z.object({
  customerName:    z.string().min(2),
  customerPhone:   z.string().min(8),
  customerAddress: z.string().min(5),
  delegationId:    z.string().optional(),
  notes:           z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-black text-[#1A4D1F]/50 mb-1.5 uppercase tracking-widest">{children}</label>;
}

function InputBase({ error, children }: { error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {children}
      {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
    </div>
  );
}

export default function Order() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { lang, t, isRTL } = useLang();
  const { clearCart } = useCart();
  const session = getSession();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loadingProvider, setLoadingProvider] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [prescriptionPhoto, setPrescriptionPhoto] = useState<string | null>(null);

  const prefilledNotes = decodeURIComponent(new URLSearchParams(window.location.search).get("notes") || "");
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      notes: prefilledNotes || undefined,
      customerName: session?.name || "",
    },
  });

  useEffect(() => {
    Promise.all([
      get<Supplier[]>("/services"),
      get<Delegation[]>("/admin/delegations"),
    ]).then(([providers, dels]) => {
      const found = providers.find(p => p.id === parseInt(id || "0"));
      if (!found) { setNotFound(true); setLoadingProvider(false); return; }
      setSupplier(found);
      setDelegations(dels);
      // Pre-fill delegation from session or default to Ben Gardane
      const sessionDelId = session?.delegationId;
      if (sessionDelId) {
        const match = dels.find(d => d.id === sessionDelId);
        if (match) setValue("delegationId", match.id.toString());
      } else {
        const benGardane = dels.find(d =>
          d.nameAr?.includes("بنقردان") || d.nameAr?.includes("بن قردان") ||
          d.name?.toLowerCase().includes("ben gard")
        );
        if (benGardane) setValue("delegationId", benGardane.id.toString());
        else if (dels.length > 0) setValue("delegationId", dels[0].id.toString());
      }
      setLoadingProvider(false);
    }).catch(() => { setNotFound(true); setLoadingProvider(false); });
  }, [id]);

  const selectedDelegationId = watch("delegationId");
  const selectedDelegation = delegations.find(d => d.id.toString() === selectedDelegationId);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPrescriptionPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: FormValues) => {
    if (!supplier) return;
    setSubmitting(true);
    try {
      const payload = {
        customerName:    data.customerName,
        customerPhone:   data.customerPhone,
        customerAddress: data.customerAddress,
        delegationId:    data.delegationId ? parseInt(data.delegationId) : null,
        deliveryFee:     selectedDelegation?.deliveryFee ?? 0,
        notes:           data.notes || null,
        serviceProviderId: supplier.id,
        serviceType: supplier.category,
        photoUrl: prescriptionPhoto || null,
        customerId:      session?.userId ?? null,
      };
      const res = await post<{ id: number }>("/orders", payload);
      setOrderId(res.id);
      setSuccess(true);
      clearCart();
      setTimeout(() => setLocation("/services"), 4000);
    } catch {
      setSubmitting(false);
    }
  };

  if (loadingProvider) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-[#1A4D1F] border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (notFound || !supplier) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle size={28} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-black text-[#1A4D1F]">{t("المزود غير موجود", "Prestataire introuvable")}</h2>
          <Link href="/services">
            <button className="px-5 py-2.5 rounded-xl bg-[#1A4D1F]/10 border border-[#1A4D1F]/30 text-[#1A4D1F] font-bold text-sm hover:bg-[#1A4D1F]/20 transition-colors">
              {t("العودة للخدمات", "Retour aux services")}
            </button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="pt-6 px-4 sm:px-6 max-w-xl mx-auto pb-28" dir={isRTL ? "rtl" : "ltr"}>

        {/* ── Back ── */}
        <div className="flex items-center gap-4 mb-7">
          <Link href="/services">
            <div className="w-11 h-11 rounded-2xl glass-panel border border-[#1A4D1F]/10 flex items-center justify-center hover:bg-[#1A4D1F]/10 hover:border-[#1A4D1F]/30 transition-all cursor-pointer">
              <ChevronRight size={18} className={cn("text-[#1A4D1F]/60", !isRTL && "rotate-180")} />
            </div>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-[#1A4D1F]">{t("تأكيد الطلب", "Confirmer la commande")}</h1>
            <p className="text-[#1A4D1F]/30 text-sm">{t("أدخل بياناتك لإتمام الطلب", "Remplissez vos informations")}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {success ? (
            /* ── Success ── */
            <motion.div key="success"
              initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
              className="glass-panel rounded-3xl p-12 text-center flex flex-col items-center border border-[#1A4D1F]/25"
            >
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                className="w-24 h-24 rounded-full bg-[#1A4D1F]/15 border border-[#1A4D1F]/30 flex items-center justify-center mb-6"
                style={{ boxShadow: "0 0 40px -10px rgba(46,125,50,0.4)" }}
              >
                <CheckCircle2 size={44} className="text-[#1A4D1F]" />
              </motion.div>
              <h2 className="text-3xl font-black text-[#1A4D1F] mb-2">
                {t("تم تأكيد طلبك!", "Commande confirmée !")}
              </h2>
              {orderId && (
                <div className="flex items-center gap-2 mb-3">
                  <Hash size={14} className="text-[#1A4D1F]/60" />
                  <span className="text-[#1A4D1F] font-mono font-black">
                    {orderId.toString().padStart(5, "0")}
                  </span>
                </div>
              )}
              <p className="text-[#1A4D1F]/40 text-sm mb-8 leading-relaxed max-w-xs">
                {t(
                  "سيتواصل معك المزود قريباً. يتم تحويلك للرئيسية...",
                  "Le prestataire vous contactera bientôt. Redirection..."
                )}
              </p>
              <div className="w-32 h-1 bg-[#1A4D1F]/5 rounded-full overflow-hidden">
                <motion.div className="h-full bg-[#1A4D1F] rounded-full"
                  initial={{ width: "0%" }} animate={{ width: "100%" }}
                  transition={{ duration: 4, ease: "linear" }} />
              </div>
            </motion.div>
          ) : (
            /* ── Form ── */
            <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              {/* Provider card — reference spec: #121212 bg, gold border */}
              <div className="rounded-[15px] p-4 mb-6 border border-[#1A4D1F]/30 flex items-center gap-4" style={{ background: "#FFFFFF" }}>
                <div className="w-12 h-12 rounded-xl bg-[#1A4D1F]/10 border border-[#1A4D1F]/20 flex items-center justify-center flex-shrink-0">
                  <Building2 size={20} className="text-[#1A4D1F]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-[#1A4D1F] leading-tight">
                    {lang === "ar" ? supplier.nameAr : (supplier.name || supplier.nameAr)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <MapPin size={10} className="text-[#1A4D1F]/30 flex-shrink-0" />
                    <p className="text-xs text-[#1A4D1F]/30 truncate">{supplier.address}</p>
                  </div>
                  {supplier.rating && (
                    <div className="flex items-center gap-0.5 mt-1">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} size={10} className={i <= Math.round(supplier.rating!) ? "text-[#1A4D1F] fill-[#1A4D1F]" : "text-[#1A4D1F]/15"} />
                      ))}
                      <span className="text-xs text-[#1A4D1F]/30 ml-1">{supplier.rating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 flex-shrink-0">
                  {t("متاح","Dispo")}
                </span>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                {/* Name */}
                <InputBase error={errors.customerName && t("الاسم مطلوب (٣ أحرف على الأقل)","Nom requis (3 caractères min)")}>
                  <FieldLabel>{t("الاسم الكامل", "Nom complet")}</FieldLabel>
                  <div className="relative">
                    <User size={15} className={cn("absolute top-1/2 -translate-y-1/2 text-[#1A4D1F]/20 pointer-events-none", isRTL ? "right-3.5" : "left-3.5")} />
                    <input {...register("customerName")}
                      placeholder={t("أدخل اسمك الكامل","Votre nom complet")}
                      className={cn(
                        "w-full bg-[#FFFDE7] border-[#1A4D1F]/40 rounded-xl py-3.5 text-sm text-[#1A4D1F] placeholder:text-[#1A4D1F]/30 focus:outline-none focus:border-[#1A4D1F] transition-colors",
                        isRTL ? "pr-10 pl-4" : "pl-10 pr-4",
                        errors.customerName ? "border-red-500" : "border-[#1A4D1F]/40"
                      )} />
                  </div>
                </InputBase>

                {/* Phone */}
                <InputBase error={errors.customerPhone && t("رقم الهاتف مطلوب","Téléphone requis")}>
                  <FieldLabel>{t("رقم الهاتف", "Numéro de téléphone")}</FieldLabel>
                  <div className="relative">
                    <Phone size={15} className={cn("absolute top-1/2 -translate-y-1/2 text-[#1A4D1F]/20 pointer-events-none", isRTL ? "right-3.5" : "left-3.5")} />
                    <input {...register("customerPhone")} type="tel"
                      placeholder={t("+216 __ ___ ___","+216 __ ___ ___")}
                      className={cn(
                        "w-full bg-[#FFFDE7] border-[#1A4D1F]/40 rounded-xl py-3.5 text-sm text-[#1A4D1F] placeholder:text-[#1A4D1F]/30 focus:outline-none focus:border-[#1A4D1F] transition-colors",
                        isRTL ? "pr-10 pl-4" : "pl-10 pr-4",
                        errors.customerPhone ? "border-red-500" : "border-[#1A4D1F]/40"
                      )} />
                  </div>
                </InputBase>

                {/* Delegation */}
                {delegations.length > 0 && (
                  <div className="space-y-1.5">
                    <FieldLabel>{t("المعتمدية (المنطقة)", "Délégation (Zone)")}</FieldLabel>
                    <select {...register("delegationId")}
                      className="w-full bg-[#FFFDE7] border border-[#1A4D1F]/40 rounded-xl px-4 py-3.5 text-sm text-[#1A4D1F] focus:outline-none focus:border-[#1A4D1F] transition-colors">
                      <option value="" className="bg-zinc-900">{t("اختر منطقتك","Choisissez votre zone")}</option>
                      {delegations.map(d => (
                        <option key={d.id} value={d.id.toString()} className="bg-zinc-900">
                          {lang === "ar" ? d.nameAr : d.name} — {d.deliveryFee} TND
                        </option>
                      ))}
                    </select>
                    {selectedDelegation && (
                      <p className="text-xs text-[#1A4D1F]/70 font-bold">
                        {t("رسوم التوصيل","Frais de livraison")}: {selectedDelegation.deliveryFee} TND
                      </p>
                    )}
                  </div>
                )}

                {/* Address */}
                <InputBase error={errors.customerAddress && t("العنوان مطلوب","Adresse requise")}>
                  <FieldLabel>{t("عنوان التوصيل", "Adresse de livraison")}</FieldLabel>
                  <div className="relative">
                    <MapPin size={15} className={cn("absolute top-4 text-[#1A4D1F]/20 pointer-events-none", isRTL ? "right-3.5" : "left-3.5")} />
                    <textarea {...register("customerAddress")} rows={2}
                      placeholder={t("الشارع، الحي، المعلم القريب...","Rue, quartier, repère...")}
                      className={cn(
                        "w-full bg-[#FFFDE7] border-[#1A4D1F]/40 rounded-xl py-3.5 text-sm text-[#1A4D1F] placeholder:text-[#1A4D1F]/30 focus:outline-none focus:border-[#1A4D1F] transition-colors resize-none",
                        isRTL ? "pr-10 pl-4" : "pl-10 pr-4",
                        errors.customerAddress ? "border-red-500" : "border-[#1A4D1F]/40"
                      )} />
                  </div>
                </InputBase>

                {/* Notes */}
                <div className="space-y-1.5">
                  <FieldLabel>{t("ملاحظات (اختياري)", "Notes (optionnel)")}</FieldLabel>
                  <div className="relative">
                    <StickyNote size={15} className={cn("absolute top-4 text-[#1A4D1F]/20 pointer-events-none", isRTL ? "right-3.5" : "left-3.5")} />
                    <textarea {...register("notes")} rows={3}
                      placeholder={t("أي تفاصيل إضافية...","Détails supplémentaires...")}
                      className={cn(
                        "w-full bg-[#FFFDE7] border border-[#1A4D1F]/40 rounded-xl py-3.5 text-sm text-[#1A4D1F] placeholder:text-[#1A4D1F]/30 focus:outline-none focus:border-[#1A4D1F] transition-colors resize-none",
                        isRTL ? "pr-10 pl-4" : "pl-10 pr-4"
                      )} />
                  </div>
                </div>

                {/* Pharmacy prescription photo upload */}
                {supplier?.category === "pharmacy" && (
                  <div className="space-y-2">
                    <FieldLabel>{t("صورة الوصفة الطبية (اختياري)", "Ordonnance médicale (optionnel)")}</FieldLabel>
                    {prescriptionPhoto ? (
                      <div className="relative rounded-xl overflow-hidden border border-[#1A4D1F]/30">
                        <img src={prescriptionPhoto} alt="prescription" className="w-full h-40 object-cover" />
                        <button type="button" onClick={() => setPrescriptionPhoto(null)}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/90 text-[#1A4D1F] flex items-center justify-center hover:bg-red-600 transition-colors">
                          <X size={13} />
                        </button>
                        <div className="absolute bottom-2 left-2 text-xs bg-[#FFA500]/60 text-[#1A4D1F] px-2 py-1 rounded-lg backdrop-blur-sm">
                          {t("✓ تم رفع الوصفة", "✓ Ordonnance jointe")}
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed border-[#1A4D1F]/15 cursor-pointer hover:border-[#1A4D1F]/40 hover:bg-[#1A4D1F]/3 transition-all group">
                        <div className="w-12 h-12 rounded-xl bg-[#1A4D1F]/10 border border-[#1A4D1F]/20 flex items-center justify-center group-hover:bg-[#1A4D1F]/20 transition-colors">
                          <Camera size={20} className="text-[#1A4D1F]/60" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-[#1A4D1F]/50 group-hover:text-[#1A4D1F]/70 transition-colors">
                            {t("اضغط لرفع صورة الوصفة", "Cliquez pour télécharger")}
                          </p>
                          <p className="text-xs text-[#1A4D1F]/25 mt-0.5">JPG, PNG, WEBP</p>
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                      </label>
                    )}
                  </div>
                )}

                {/* Privacy note */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-[#1A4D1F]/3 border border-[#1A4D1F]/5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <p className="text-xs text-[#1A4D1F]/30 leading-relaxed">
                    {t(
                      "لا يتم مشاركة أرقام الهاتف مع مقدمي الخدمات. تواصلنا داخلي وآمن.",
                      "Aucun numéro de téléphone n'est partagé avec les prestataires. Communication interne sécurisée."
                    )}
                  </p>
                </div>

                {/* Submit */}
                <button type="submit" disabled={submitting}
                  className="w-full h-14 rounded-2xl font-black text-base transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  style={{ background: submitting ? "rgba(46,125,50,0.5)" : "#1A4D1F", color: "white", boxShadow: submitting ? "none" : "0 0 30px -8px rgba(46,125,50,0.5)" }}
                >
                  {submitting ? (
                    <><Loader2 size={20} className="animate-spin" />{t("جاري الإرسال...","Envoi en cours...")}</>
                  ) : (
                    t("تأكيد الطلب", "Confirmer la commande")
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
