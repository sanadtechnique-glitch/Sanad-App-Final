import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Camera, X, Navigation, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MapPickerModal, type MapPickerResult } from "@/components/MapPickerModal";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Supplier {
  id: number; name: string; nameAr: string; category: string;
  description: string; descriptionAr: string; address: string;
  rating?: number; isAvailable: boolean;
  latitude?: number | null; longitude?: number | null;
  deliveryFee?: number | null; delegationAr?: string | null;
}
interface DistanceResult {
  distanceKm: number; etaMinutes: number; deliveryFee: number;
  baseFee: number; kmFee: number; isNight: boolean; source: string;
  providerCoordsSet?: boolean; // [E-2] false = city-centre fallback used, fee may be inaccurate
}
// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_FARE        = 4.800; // DT — shown when GPS is unavailable
const MAX_DELIVERY_FEE = 15;    // DT — hard cap; orders above this are blocked
const GPS_SESSION_KEY  = "sanad_gps_coords"; // sessionStorage key for coord caching
const GPS_STORE_KEY    = "sanad_gps_v2";     // delegation store key

// Read user's current delegation (written by gpsStore in home.tsx)
function getUserDelegation(): string {
  try {
    const raw = sessionStorage.getItem(GPS_STORE_KEY);
    if (raw) { const p = JSON.parse(raw); if (p?.delegation) return p.delegation; }
  } catch {}
  return "بن قردان";
}

// ─── Zod schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  customerName:    z.string().min(2),
  customerPhone:   z.string().min(8),
  customerAddress: z.string().min(5),
  notes:           z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

// ─── Sub-components ───────────────────────────────────────────────────────────
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

// ─── Main component ───────────────────────────────────────────────────────────
export default function Order() {
  const { id }           = useParams<{ id: string }>();
  const [, setLocation]  = useLocation();
  const { lang, t, isRTL } = useLang();
  const { cart, clearCart, setDeliveryFee: setCartDeliveryFee } = useCart();
  const session = getSession();

  // Provider
  const [supplier, setSupplier]           = useState<Supplier | null>(null);
  const [loadingProvider, setLoadingProvider] = useState(true);
  const [notFound, setNotFound]           = useState(false);

  // Order flow
  const [submitting, setSubmitting]       = useState(false);
  const [success, setSuccess]             = useState(false);
  const [orderId, setOrderId]             = useState<number | null>(null);

  // Prescription photo
  const [prescriptionPhoto, setPrescriptionPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto]       = useState(false);
  const [uploadError, setUploadError]             = useState<string | null>(null);

  // Address mode
  const [addressMode, setAddressMode]     = useState<"gps" | "manual">("gps");

  // GPS state
  const [gpsStatus, setGpsStatus]         = useState<"idle" | "watching" | "ok" | "error">("idle");
  const [customerLat, setCustomerLat]     = useState<number | null>(null);
  const [customerLng, setCustomerLng]     = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy]     = useState<number | null>(null);

  // Distance / fee
  const [distInfo, setDistInfo]           = useState<DistanceResult | null>(null);
  const [distLoading, setDistLoading]     = useState(false);

  // Map picker modal (fallback when GPS denied or always available)
  const [showPicker, setShowPicker] = useState(false);

  // Refs
  const watchIdRef      = useRef<number | null>(null);
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstFixRef     = useRef(false); // reverse-geocode only once
  const supplierRef     = useRef<Supplier | null>(null);

  // Keep supplierRef in sync so callbacks can always access latest supplier
  useEffect(() => { supplierRef.current = supplier; }, [supplier]);

  // ── Memos ──────────────────────────────────────────────────────────────────
  const cartItems = useMemo(
    () => (cart.supplierId === parseInt(id || "0") ? cart.items : []),
    [cart, id],
  );
  const subtotal = useMemo(
    () => cartItems.reduce((s, i) => s + (parseFloat(String(i.price)) || 0) * (parseInt(String(i.qty)) || 1), 0),
    [cartItems],
  );
  // GPS-calculated fee takes priority; base fare is shown until GPS resolves
  const deliveryFee = useMemo(
    () => distInfo?.deliveryFee ?? BASE_FARE,
    [distInfo],
  );
  const finalTotal = useMemo(() => subtotal + deliveryFee, [subtotal, deliveryFee]);

  const prefilledNotes = decodeURIComponent(new URLSearchParams(window.location.search).get("notes") || "");
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { notes: prefilledNotes || undefined, customerName: session?.name || "" },
  });

  // ── Calculate distance from server (debounced) ─────────────────────────────
  const calculateFee = useCallback(async (lat: number, lng: number) => {
    const sup = supplierRef.current;
    if (!sup) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setDistLoading(true);
      try {
        const params = new URLSearchParams({
          providerId:  String(sup.id),
          customerLat: String(lat),
          customerLng: String(lng),
        });
        const res = await get<DistanceResult>(`/distance?${params}`);
        setDistInfo(res);
        setCartDeliveryFee(res.deliveryFee); // sync cart drawer in real-time
      } catch { /* silent — keep last known fee */ }
      finally { setDistLoading(false); }
    }, 350); // 350ms debounce — avoids hammering server on every GPS tick
  }, [setCartDeliveryFee]);

  // ── Apply a confirmed position (GPS or picker) ─────────────────────────────
  const applyPosition = useCallback(async (lat: number, lng: number, accuracy?: number) => {
    setCustomerLat(lat);
    setCustomerLng(lng);
    if (accuracy !== undefined) setGpsAccuracy(accuracy);

    // Persist to sessionStorage so fee survives brief signal drops
    try { sessionStorage.setItem(GPS_SESSION_KEY, JSON.stringify({ lat, lng })); } catch { /* quota */ }

    // Reverse-geocode only on the first GPS fix (not every watchPosition tick)
    if (!firstFixRef.current) {
      firstFixRef.current = true;
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=${lang}`,
          { headers: { "Accept-Language": lang } },
        );
        if (r.ok) {
          const geo = await r.json() as { display_name?: string };
          const addr = geo.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setValue("customerAddress", addr, { shouldValidate: true });
        }
      } catch { /* leave address blank */ }
    }

    // Recalculate fee every time position updates
    calculateFee(lat, lng);
  }, [lang, setValue, calculateFee]);

  // ── Start watchPosition ────────────────────────────────────────────────────
  const startWatchingGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      setCartDeliveryFee(BASE_FARE);
      return;
    }

    // Restore last known coords immediately so fee doesn't jump back to 2.500
    try {
      const cached = sessionStorage.getItem(GPS_SESSION_KEY);
      if (cached) {
        const { lat, lng } = JSON.parse(cached) as { lat: number; lng: number };
        setCustomerLat(lat);
        setCustomerLng(lng);
        calculateFee(lat, lng); // refresh fee with cached position
      }
    } catch { /* invalid cache — ignore */ }

    setGpsStatus("watching");

    // Clear previous watcher if any
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsStatus("ok");
        applyPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      (_err) => {
        // Error callback — keep last known coords, show fallback
        setGpsStatus("error");
        // If we already have coords (from cache or previous fix), keep them
        if (!customerLat) {
          setCartDeliveryFee(BASE_FARE);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
  }, [applyPosition, calculateFee, setCartDeliveryFee, customerLat]);

  // ── Stop watcher ───────────────────────────────────────────────────────────
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopWatching();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [stopWatching]);

  // ── Load supplier, then auto-start GPS ────────────────────────────────────
  useEffect(() => {
    get<Supplier[]>("/services").then(providers => {
      const found = providers.find(p => p.id === parseInt(id || "0"));
      if (!found) { setNotFound(true); setLoadingProvider(false); return; }
      setSupplier(found);
      setLoadingProvider(false);
    }).catch(() => { setNotFound(true); setLoadingProvider(false); });
  }, [id]);

  // Auto-start GPS watch once supplier is loaded
  useEffect(() => {
    if (supplier && addressMode === "gps" && gpsStatus === "idle") {
      startWatchingGPS();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier]);

  // ── Map picker confirm handler ─────────────────────────────────────────────
  const handleMapPickerConfirm = useCallback(({ lat, lng, address }: MapPickerResult) => {
    firstFixRef.current = true; // prevent reverse-geocode from overwriting the picker address
    setGpsStatus("ok");
    setCustomerLat(lat);
    setCustomerLng(lng);
    setValue("customerAddress", address, { shouldValidate: true });
    try { sessionStorage.setItem(GPS_SESSION_KEY, JSON.stringify({ lat, lng })); } catch { /* quota */ }
    calculateFee(lat, lng);
    setShowPicker(false);
  }, [setValue, calculateFee]);

  // ── Prescription photo upload ─────────────────────────────────────────────
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = ev => setPrescriptionPhoto(ev.target?.result as string);
    reader.readAsDataURL(file);
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/upload/prescription", { method: "POST", body: fd });
      if (!res.ok) throw new Error("upload_failed");
      const { url } = await res.json() as { url: string };
      setPrescriptionPhoto(url);
    } catch {
      setUploadError(lang === "ar" ? "فشل رفع الصورة، ستُرسل مع الطلب" : "Échec upload, envoi avec commande");
    } finally { setUploadingPhoto(false); }
  };

  // ── Order submit ──────────────────────────────────────────────────────────
  const onSubmit = async (data: FormValues) => {
    if (!supplier) return;
    setSubmitting(true);
    try {
      const orderItems = cartItems.map(i => ({
        articleId: i.id, nameAr: i.nameAr, nameFr: i.name, price: i.price, qty: i.qty,
      }));
      await post<{ id: number }>("/orders", {
        customerName:      data.customerName,
        customerPhone:     data.customerPhone,
        customerAddress:   data.customerAddress,
        notes:             data.notes || null,
        serviceProviderId: supplier.id,
        serviceType:       supplier.category,
        photoUrl:          prescriptionPhoto || null,
        customerId:        session?.userId ?? null,
        customerLat:       customerLat ?? undefined,
        customerLng:       customerLng ?? undefined,
        deliveryFee,
        totalAmount:       finalTotal,
        items:             orderItems,
        // [H-2] Send user's zone so server can enforce delegation match
        userDelegation:    userDelegation,
      }).then(res => {
        setOrderId(res.id);
        setSuccess(true);
        stopWatching();
        clearCart();
        setTimeout(() => setLocation("/services"), 4000);
      });
    } catch { setSubmitting(false); }
  };

  // ── GPS status helpers ────────────────────────────────────────────────────
  const isGpsOk      = gpsStatus === "ok";
  const isGpsWatching = gpsStatus === "watching";
  const isGpsError   = gpsStatus === "error";

  // ── Zone + fee guards ─────────────────────────────────────────────────────
  // [H-3] Normalize delegation strings — trim and collapse spaces to prevent false mismatches
  const normDel = (s?: string | null) => (s ?? "").trim().replace(/\s+/g, " ");
  const userDelegation   = getUserDelegation();
  const vendorDelegation = supplier?.delegationAr ?? "";
  // Block if vendor is in a different delegation than user (normalized comparison)
  const zoneMismatch = Boolean(normDel(vendorDelegation)) && normDel(vendorDelegation) !== normDel(userDelegation);
  // Block if GPS-calculated fee exceeds the hard cap
  const feeBlocked   = distInfo !== null && distInfo.deliveryFee > MAX_DELIVERY_FEE;
  const orderBlocked = zoneMismatch || feeBlocked;

  // ── Render: loading / not found ───────────────────────────────────────────
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

  // ── Render: main ──────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="pt-6 px-4 sm:px-6 max-w-xl mx-auto pb-28" dir={isRTL ? "rtl" : "ltr"}>

        {/* Back */}
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
            /* ── Success screen ── */
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
              <h2 className="text-3xl font-black text-[#1A4D1F] mb-2">{t("تم تأكيد طلبك!", "Commande confirmée !")}</h2>
              {orderId && (
                <div className="flex items-center gap-2 mb-3">
                  <Hash size={14} className="text-[#1A4D1F]/60" />
                  <span className="text-[#1A4D1F] font-mono font-black">{orderId.toString().padStart(5, "0")}</span>
                </div>
              )}
              <p className="text-[#1A4D1F]/40 text-sm mb-8 leading-relaxed max-w-xs">
                {t("سيتواصل معك المزود قريباً. يتم تحويلك للرئيسية...","Le prestataire vous contactera bientôt. Redirection...")}
              </p>
              <div className="w-32 h-1 bg-[#1A4D1F]/5 rounded-full overflow-hidden">
                <motion.div className="h-full bg-[#1A4D1F] rounded-full"
                  initial={{ width: "0%" }} animate={{ width: "100%" }}
                  transition={{ duration: 4, ease: "linear" }} />
              </div>
            </motion.div>
          ) : (
            /* ── Order form ── */
            <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>

              {/* Provider card */}
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

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

                {/* Name */}
                <InputBase error={errors.customerName && t("الاسم مطلوب (٢ أحرف على الأقل)","Nom requis (2 caractères min)")}>
                  <FieldLabel>{t("الاسم الكامل", "Nom complet")}</FieldLabel>
                  <div className="relative">
                    <User size={15} className={cn("absolute top-1/2 -translate-y-1/2 text-[#1A4D1F]/20 pointer-events-none", isRTL ? "right-3.5" : "left-3.5")} />
                    <input {...register("customerName")}
                      placeholder={t("أدخل اسمك الكامل","Votre nom complet")}
                      className={cn(
                        "w-full bg-[#FFFDE7] border rounded-xl py-3.5 text-sm text-[#1A4D1F] placeholder:text-[#1A4D1F]/30 focus:outline-none focus:border-[#1A4D1F] transition-colors",
                        isRTL ? "pr-10 pl-4" : "pl-10 pr-4",
                        errors.customerName ? "border-red-500" : "border-[#1A4D1F]/40",
                      )} />
                  </div>
                </InputBase>

                {/* Phone */}
                <InputBase error={errors.customerPhone && t("رقم الهاتف مطلوب","Téléphone requis")}>
                  <FieldLabel>{t("رقم الهاتف", "Numéro de téléphone")}</FieldLabel>
                  <div className="relative">
                    <Phone size={15} className={cn("absolute top-1/2 -translate-y-1/2 text-[#1A4D1F]/20 pointer-events-none", isRTL ? "right-3.5" : "left-3.5")} />
                    <input {...register("customerPhone")} type="tel"
                      placeholder="+216 __ ___ ___"
                      className={cn(
                        "w-full bg-[#FFFDE7] border rounded-xl py-3.5 text-sm text-[#1A4D1F] placeholder:text-[#1A4D1F]/30 focus:outline-none focus:border-[#1A4D1F] transition-colors",
                        isRTL ? "pr-10 pl-4" : "pl-10 pr-4",
                        errors.customerPhone ? "border-red-500" : "border-[#1A4D1F]/40",
                      )} />
                  </div>
                </InputBase>

                {/* ── Address section ── */}
                <div className="space-y-2">
                  <FieldLabel>{t("عنوان التوصيل", "Adresse de livraison")}</FieldLabel>

                  {/* Toggle GPS / Manual */}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => {
                        setAddressMode("gps");
                        if (gpsStatus === "idle" || gpsStatus === "error") startWatchingGPS();
                      }}
                      className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black border transition-all",
                        addressMode === "gps" ? "border-[#FFA500] text-[#1A4D1F]" : "border-[#1A4D1F]/20 text-[#1A4D1F]/40"
                      )}
                      style={addressMode === "gps" ? { background: "rgba(255,165,0,0.12)" } : { background: "transparent" }}
                    >
                      <Navigation size={12} className={addressMode === "gps" ? "text-[#FFA500]" : ""} />
                      {t("موقع GPS", "GPS actuel")}
                    </button>
                    <button type="button" onClick={() => { setAddressMode("manual"); stopWatching(); }}
                      className={cn("flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black border transition-all",
                        addressMode === "manual" ? "border-[#1A4D1F] text-[#1A4D1F]" : "border-[#1A4D1F]/20 text-[#1A4D1F]/40"
                      )}
                      style={addressMode === "manual" ? { background: "rgba(26,77,31,0.08)" } : { background: "transparent" }}
                    >
                      <MapPin size={12} className={addressMode === "manual" ? "text-[#1A4D1F]" : ""} />
                      {t("إدخال يدوي", "Saisie manuelle")}
                    </button>
                  </div>

                  {/* GPS mode UI */}
                  {addressMode === "gps" && (
                    <div className="space-y-2">

                      {/* Watching / acquiring */}
                      {isGpsWatching && !customerLat && (
                        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-[#FFA500]/30"
                          style={{ background: "rgba(255,165,0,0.06)" }}>
                          <Loader2 size={14} className="animate-spin text-[#FFA500] flex-shrink-0" />
                          <p className="text-xs font-black text-[#1A4D1F]/70">
                            {t("جاري تحديد موقعك تلقائياً...","Localisation GPS en cours...")}
                          </p>
                        </div>
                      )}

                      {/* GPS OK — live tracking badge */}
                      {isGpsOk && customerLat && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-400/30"
                            style={{ background: "rgba(52,211,153,0.06)" }}>
                            <div className="relative flex-shrink-0">
                              <Navigation size={14} className="text-emerald-500" />
                              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-emerald-600">
                                {t("GPS نشط · يتتبع موقعك","GPS actif · Suivi en temps réel")}
                              </p>
                              <p className="text-[10px] text-[#1A4D1F]/40 mt-0.5 font-mono">
                                {customerLat.toFixed(5)}, {customerLng?.toFixed(5)}
                                {gpsAccuracy !== null && <span className="opacity-60"> ±{Math.round(gpsAccuracy)}m</span>}
                              </p>
                            </div>
                            <button type="button" onClick={() => { stopWatching(); startWatchingGPS(); }}
                              className="text-[10px] text-emerald-600/60 underline flex-shrink-0">
                              {t("تحديث","Actualiser")}
                            </button>
                          </div>
                          {/* Always-visible map button */}
                          <button type="button" onClick={() => setShowPicker(true)}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border border-[#1A4D1F]/15 text-[#1A4D1F]/60 transition-all hover:border-[#FFA500]/40 hover:text-[#1A4D1F]"
                            style={{ background: "rgba(26,77,31,0.03)" }}>
                            <MapPin size={11} className="text-[#FFA500]" />
                            {t("ضبط الموقع على الخريطة","Ajuster sur la carte")}
                          </button>
                        </div>
                      )}

                      {/* GPS error — fallback options */}
                      {isGpsError && (
                        <div className="space-y-2">
                          <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border border-amber-400/40"
                            style={{ background: "rgba(255,193,7,0.08)" }}>
                            <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs font-black text-amber-700">
                                {t("تعذّر الوصول إلى GPS","Impossible d'accéder au GPS")}
                              </p>
                              <p className="text-[10px] text-amber-600/70 mt-0.5">
                                {t(
                                  `الأجرة الأساسية ${BASE_FARE.toFixed(3)} د.ت · اختر موقعك يدوياً للحصول على السعر الدقيق`,
                                  `Tarif de base ${BASE_FARE.toFixed(3)} DT · Choisissez votre emplacement pour le prix exact`,
                                )}
                              </p>
                            </div>
                          </div>
                          {/* Map picker button */}
                          <button type="button" onClick={() => setShowPicker(true)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs border border-[#1A4D1F]/30 text-[#1A4D1F] transition-all hover:bg-[#1A4D1F]/5"
                            style={{ background: "rgba(26,77,31,0.04)" }}>
                            <MapPin size={13} className="text-[#FFA500]" />
                            {t("📍 اختر موقعك على الخريطة","📍 Choisir sur la carte")}
                          </button>
                          {/* Retry GPS */}
                          <button type="button" onClick={() => { firstFixRef.current = false; startWatchingGPS(); }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs border border-[#FFA500]/30 text-[#1A4D1F]/60 transition-all hover:bg-[#FFA500]/5">
                            <Navigation size={12} className="text-[#FFA500]" />
                            {t("إعادة محاولة GPS","Réessayer GPS")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Address textarea */}
                  <InputBase error={errors.customerAddress && t("العنوان مطلوب","Adresse requise")}>
                    <div className="relative">
                      <MapPin size={15} className={cn("absolute top-4 text-[#1A4D1F]/20 pointer-events-none", isRTL ? "right-3.5" : "left-3.5")} />
                      <textarea {...register("customerAddress")} rows={2}
                        readOnly={addressMode === "gps" && isGpsOk && !!customerLat}
                        placeholder={addressMode === "gps"
                          ? t("سيتم تعبئته تلقائياً عند تحديد الموقع...","Se remplira automatiquement avec le GPS...")
                          : t("الشارع، الحي، المعلم القريب...","Rue, quartier, repère...")}
                        className={cn(
                          "w-full border rounded-xl py-3.5 text-sm text-[#1A4D1F] placeholder:text-[#1A4D1F]/30 focus:outline-none focus:border-[#1A4D1F] transition-colors resize-none",
                          isRTL ? "pr-10 pl-4" : "pl-10 pr-4",
                          errors.customerAddress ? "border-red-500" : "border-[#1A4D1F]/40",
                          addressMode === "gps" && isGpsOk && customerLat ? "bg-emerald-50/60" : "bg-[#FFFDE7]",
                        )} />
                    </div>
                  </InputBase>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <FieldLabel>{t("ملاحظات (اختياري)", "Notes (optionnel)")}</FieldLabel>
                  <div className="relative">
                    <StickyNote size={15} className={cn("absolute top-4 text-[#1A4D1F]/20 pointer-events-none", isRTL ? "right-3.5" : "left-3.5")} />
                    <textarea {...register("notes")} rows={3}
                      placeholder={t("أي تفاصيل إضافية...","Détails supplémentaires...")}
                      className={cn(
                        "w-full bg-[#FFFDE7] border border-[#1A4D1F]/40 rounded-xl py-3.5 text-sm text-[#1A4D1F] placeholder:text-[#1A4D1F]/30 focus:outline-none focus:border-[#1A4D1F] transition-colors resize-none",
                        isRTL ? "pr-10 pl-4" : "pl-10 pr-4",
                      )} />
                  </div>
                </div>

                {/* Pharmacy prescription */}
                {supplier?.category === "pharmacy" && (
                  <div className="space-y-2">
                    <FieldLabel>{t("صورة الوصفة الطبية (اختياري)", "Ordonnance médicale (optionnel)")}</FieldLabel>
                    {prescriptionPhoto ? (
                      <div className="relative rounded-xl overflow-hidden border border-[#1A4D1F]/30">
                        <img src={prescriptionPhoto} alt="prescription" className="w-full h-40 object-cover" />
                        {uploadingPhoto && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
                            <div className="w-8 h-8 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                        <button type="button" onClick={() => { setPrescriptionPhoto(null); setUploadError(null); }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500/90 text-white flex items-center justify-center hover:bg-red-600 transition-colors">
                          <X size={13} />
                        </button>
                        <div className="absolute bottom-2 left-2 text-xs px-2 py-1 rounded-lg backdrop-blur-sm font-bold"
                          style={{ background: uploadingPhoto ? "rgba(0,0,0,0.5)" : "rgba(255,165,0,0.75)", color: "#1A4D1F" }}>
                          {uploadingPhoto ? t("⬆️ جارٍ الرفع...", "⬆️ Envoi...") : t("✓ تم رفع الوصفة", "✓ Ordonnance jointe")}
                        </div>
                      </div>
                    ) : (
                      <label className={cn(
                        "flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed transition-all group",
                        uploadingPhoto ? "border-[#FFA500]/40 cursor-wait" : "border-[#1A4D1F]/15 cursor-pointer hover:border-[#1A4D1F]/40",
                      )}>
                        <div className="w-12 h-12 rounded-xl bg-[#1A4D1F]/10 border border-[#1A4D1F]/20 flex items-center justify-center group-hover:bg-[#1A4D1F]/20 transition-colors">
                          <Camera size={20} className="text-[#1A4D1F]/60" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-[#1A4D1F]/50 group-hover:text-[#1A4D1F]/70 transition-colors">
                            {t("اضغط لرفع صورة الوصفة","Cliquez pour télécharger")}
                          </p>
                          <p className="text-xs text-[#1A4D1F]/25 mt-0.5">JPG, PNG, WEBP · max 5MB</p>
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={uploadingPhoto} />
                      </label>
                    )}
                    {uploadError && (
                      <p className="text-xs text-amber-500 font-bold flex items-center gap-1">
                        <AlertTriangle size={11} />{uploadError}
                      </p>
                    )}
                  </div>
                )}

                {/* ── Order Summary ── */}
                <div className="rounded-2xl border border-[#1A4D1F]/15 overflow-hidden" style={{ background: "rgba(26,77,31,0.03)" }}>
                  <div className="px-4 py-3 border-b border-[#1A4D1F]/10 flex items-center gap-2" style={{ background: "rgba(26,77,31,0.05)" }}>
                    <Zap size={13} className="text-[#FFA500]" />
                    <p className="text-xs font-black text-[#1A4D1F] uppercase tracking-widest">{t("ملخص الطلب","Récapitulatif")}</p>
                    {distInfo && (
                      <span className="mr-auto text-[10px] font-bold"
                        style={{ color: distInfo.providerCoordsSet === false ? "#B45309" : "#10b981" }}>
                        {distInfo.providerCoordsSet === false
                          ? t("⚠️ موقع المزود تقريبي","⚠️ Position vendeur approx.")
                          : `${t("محسوب بـ GPS","Calculé par GPS")} ✓`}
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-2.5">

                    {/* Distance + ETA chips */}
                    {distLoading && (
                      <div className="flex items-center justify-center gap-2 py-2 text-[#1A4D1F]/40 text-xs">
                        <Loader2 size={13} className="animate-spin" />
                        {t("جاري حساب رسوم التوصيل...","Calcul en cours...")}
                      </div>
                    )}
                    {distInfo && !distLoading && (
                      <div className="flex gap-2">
                        <div className="flex-1 text-center p-2 rounded-xl border border-[#1A4D1F]/10 bg-white/50">
                          <p className="text-sm font-black text-[#FFA500]">
                            {distInfo.distanceKm.toFixed(2)}<span className="text-[9px] font-bold"> km</span>
                          </p>
                          <p className="text-[9px] text-[#1A4D1F]/35 font-bold">{t("المسافة","Distance")}</p>
                        </div>
                        <div className="flex-1 text-center p-2 rounded-xl border border-[#1A4D1F]/10 bg-white/50">
                          <p className="text-sm font-black text-emerald-500">
                            {distInfo.etaMinutes}<span className="text-[9px] font-bold"> {t("د","min")}</span>
                          </p>
                          <p className="text-[9px] text-[#1A4D1F]/35 font-bold">{t("الوقت المتوقع","ETA")}</p>
                        </div>
                        {distInfo.isNight && (
                          <div className="flex-1 text-center p-2 rounded-xl border border-indigo-400/20 bg-indigo-50/50">
                            <p className="text-sm font-black text-indigo-500">+20%</p>
                            <p className="text-[9px] text-indigo-400/70 font-bold">{t("رسوم ليلية","Nuit")}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pricing formula display */}
                    {distInfo && !distLoading && (
                      <div className="text-[10px] text-[#1A4D1F]/40 text-center font-mono">
                        {distInfo.baseFee.toFixed(3)} + ({distInfo.distanceKm.toFixed(2)} × 0.500)
                        {distInfo.isNight ? " + ليلي" : ""} = <span className="text-[#FFA500] font-black">{distInfo.deliveryFee.toFixed(3)} DT</span>
                      </div>
                    )}

                    {/* Price rows */}
                    <div className="space-y-1.5 pt-1">
                      {cartItems.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#1A4D1F]/50">{t("مجموع المنتجات","Sous-total produits")}</span>
                          <span className="text-xs font-black text-[#1A4D1F]">{subtotal.toFixed(3)} DT</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#1A4D1F]/50 flex items-center gap-1">
                          <Navigation size={10} />
                          {t("رسوم التوصيل","Frais de livraison")}
                          {distInfo && !distLoading && (
                            <span className="text-[9px] text-emerald-500 font-black">
                              · {distInfo.distanceKm.toFixed(2)} km{distInfo.isNight ? ` · ${t("ليلي","nuit")}` : ""}
                            </span>
                          )}
                          {!distInfo && !distLoading && (
                            <span className="text-[9px] opacity-50">({t("أجرة أساسية","de base")})</span>
                          )}
                        </span>
                        <span className="text-xs font-black text-[#FFA500]">{deliveryFee.toFixed(3)} DT</span>
                      </div>
                      <div className="border-t border-[#1A4D1F]/10 pt-1.5 flex items-center justify-between">
                        <span className="text-sm font-black text-[#1A4D1F]">{t("الإجمالي","Total")}</span>
                        <span className="text-base font-black text-[#1A4D1F]">
                          {finalTotal.toFixed(3)} <span className="text-xs">DT</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Zone / Fee block warnings ── */}
                {feeBlocked && (
                  <div className="rounded-2xl px-4 py-3 flex items-start gap-3 text-sm font-black"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#dc2626" }} dir="rtl">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <p>{t("المسافة بعيدة جداً للتوصيل حالياً", "Distance trop grande pour la livraison")}</p>
                      <p className="text-xs font-medium opacity-70 mt-0.5">
                        {t(`رسوم التوصيل (${distInfo?.deliveryFee.toFixed(2)} DT) تتجاوز الحد الأقصى المسموح به (${MAX_DELIVERY_FEE} DT)`,
                           `Frais de livraison (${distInfo?.deliveryFee.toFixed(2)} DT) dépassent le plafond (${MAX_DELIVERY_FEE} DT)`)}
                      </p>
                    </div>
                  </div>
                )}
                {zoneMismatch && !feeBlocked && (
                  <div className="rounded-2xl px-4 py-3 flex items-start gap-3 text-sm font-black"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#dc2626" }} dir="rtl">
                    <MapPin size={18} className="shrink-0 mt-0.5" />
                    <p>{t(
                      `هذا المزود خارج منطقتك (${userDelegation}) — لا يمكن إتمام الطلب`,
                      `Ce prestataire est hors de votre zone (${userDelegation})`
                    )}</p>
                  </div>
                )}

                {/* Submit */}
                <motion.button type="submit" disabled={submitting || orderBlocked}
                  whileTap={orderBlocked ? {} : { scale: 0.98 }}
                  className="w-full py-4 rounded-2xl font-black text-base text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: (submitting || orderBlocked) ? "#9ca3af" : "linear-gradient(135deg,#1A4D1F,#2E7D32)" }}>
                  {submitting
                    ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" />{t("جاري الإرسال...","Envoi...")}</span>
                    : orderBlocked
                      ? t("⛔ الطلب محظور", "⛔ Commande bloquée")
                      : t("تأكيد الطلب →","Confirmer la commande →")}
                </motion.button>

              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Full-screen Leaflet map picker ── */}
      <AnimatePresence>
        {showPicker && supplier && (
          <MapPickerModal
            initialLat={customerLat}
            initialLng={customerLng}
            supplierId={supplier.id}
            onConfirm={handleMapPickerConfirm}
            onClose={() => setShowPicker(false)}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
