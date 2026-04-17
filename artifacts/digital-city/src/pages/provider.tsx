import { useState, useEffect, useCallback, useRef } from "react";
import { compressImage } from "@/lib/compress-image";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { getSession, clearSession } from "@/lib/auth";
import {
  Power, Clock, Truck, Star, RefreshCw, MessageCircle, ChevronRight,
  Bell, LogOut, Package, Check, X, MapPin, Image as ImageIcon, History,
  Plus, Trash2, Pencil, ToggleLeft, ToggleRight, AlertTriangle, KeyRound, Calendar, Phone, Scale, FileText, Hotel,
  Camera, LocateFixed, Navigation, CheckCircle2, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/language";
import { NotificationBell } from "@/components/notification-bell";
import { get, patch, post, del } from "@/lib/admin-api";
import { pushNotification, readNotifKey, markNotifKeyRead, providerKey, type Notification } from "@/lib/notifications";
import { playProviderChime, playTaxiHorn, playTruckAlert, unlockAudio } from "@/lib/notification-sound";
import { VendorMapPicker, type VendorMapPickerResult } from "@/components/VendorMapPicker";

function playRoleSound(category: string) {
  if (category === "taxi")               { playTaxiHorn();    return; }
  if (category === "sos")                { playTruckAlert();  return; }
  playProviderChime();
}

interface Supplier { id: number; name: string; nameAr: string; category: string; isAvailable: boolean; shift?: string; rating?: number; phone?: string; photoUrl?: string | null; latitude?: number | null; longitude?: number | null; address?: string | null; }
interface Order { id: number; customerName: string; customerPhone?: string; customerAddress: string; notes?: string; status: string; createdAt: string; deliveryFee?: number; photoUrl?: string; }
interface OrderItem { id: number; orderId: number; articleId?: number | null; nameAr: string; nameFr: string; price: number; qty: number; subtotal: number; }

const STATUS: Record<string, { ar: string; fr: string; color: string }> = {
  searching_for_driver: { ar: "🔔 جديد · انتظار سائق", fr: "🔔 Nouveau · Cherche livreur", color: "text-amber-500 border-amber-500/30 bg-amber-500/10" },
  pending:         { ar: "قيد الانتظار",       fr: "En attente",          color: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  accepted:        { ar: "✅ مقبول",           fr: "✅ Accepté",           color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  prepared:        { ar: "📦 جاهز للتوصيل",   fr: "📦 Prêt à livrer",    color: "text-[#1A4D1F] border-[#1A4D1F]/30 bg-[#1A4D1F]/10" },
  driver_accepted: { ar: "🛵 سائق في الطريق", fr: "🛵 Livreur en route",  color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
  in_delivery:     { ar: "🚀 في الطريق",       fr: "🚀 En livraison",      color: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
  delivered:       { ar: "🎉 تم التوصيل",      fr: "🎉 Livré",             color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  cancelled:       { ar: "❌ ملغي",            fr: "❌ Annulé",            color: "text-red-400 border-red-400/30 bg-red-400/10" },
};

function timeAgo(dateStr: string, lang: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (diff < 1) return lang === "ar" ? "الآن" : "Maintenant";
  if (diff < 60) return lang === "ar" ? `${diff} د` : `${diff}min`;
  return lang === "ar" ? `${Math.floor(diff / 60)} س` : `${Math.floor(diff / 60)}h`;
}

// ── فئات مزودي المنتجات (يبيعون أصنافاً من كتالوج)
const PRODUCT_CATS = ["restaurant", "grocery", "pharmacy", "bakery", "butcher", "cafe", "sweets", "clothing"];
// ── فئات المزودين القادرين على الاستجابة لطلبات SOS (شاحنات SOS فقط)
const SOS_CATS     = ["sos"];

function isProductCat(cat: string)  { return PRODUCT_CATS.includes(cat); }
function isSosCat(cat: string)      { return SOS_CATS.includes(cat); }

// ── Article type (stored in articlesTable, visible to customers) ───────────────
interface Article {
  id: number; supplierId: number;
  nameAr: string; nameFr: string;
  descriptionAr: string; descriptionFr: string;
  price: number; originalPrice?: number | null;
  photoUrl?: string | null;
  images?: string | null;
  isAvailable: boolean; createdAt: string;
}

// ── Reusable Image Picker Field ───────────────────────────────────────────────
// aspect: "16:9" | "4:3" | "1:1"
async function uploadImageFile(file: File): Promise<string> {
  const compressed = await compressImage(file).catch(() => file);
  const fd = new FormData();
  fd.append("image", compressed);
  const token = getSession()?.token || "";
  const res = await fetch("/api/upload/image", {
    method: "POST",
    headers: { "X-Session-Token": token },
    body: fd,
  });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json() as { url: string };
  return data.url;
}

function ImagePickerField({
  value, onChange, label, guideAr, guideFr, aspect = "16:9", accentColor = "#1A4D1F", t,
}: {
  value: string; onChange: (v: string) => void; label: string;
  guideAr: string; guideFr: string; aspect?: "16:9" | "4:3" | "1:1";
  accentColor?: string; t: (ar: string, fr: string) => string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [imgErr, setImgErr] = useState(false);
  const isCircle = aspect === "1:1";

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadErr("");
    setImgErr(false);
    try {
      const url = await uploadImageFile(file);
      onChange(url);
    } catch {
      setUploadErr(t("فشل الرفع، حاول مجدداً", "Échec du téléchargement, réessayez"));
    } finally {
      setUploading(false);
    }
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setUploadErr("");
    setImgErr(false);
  };

  /* ── Circle picker (1:1) ── */
  if (isCircle) {
    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-black opacity-60" style={{ color: accentColor }}>{label}</label>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        <div className="flex flex-col items-center gap-3">
          <div
            className="relative w-32 h-32 rounded-full overflow-hidden border-[3px] border-dashed cursor-pointer transition-all flex items-center justify-center"
            style={{ borderColor: (value && !imgErr) ? accentColor + "80" : accentColor + "30", background: accentColor + "0A" }}
            onClick={() => !uploading && fileRef.current?.click()}
          >
            {(value && !imgErr) ? (
              <img src={value} alt="" className="w-full h-full object-cover" onError={() => setImgErr(true)} />
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <Camera size={28} style={{ color: accentColor, opacity: 0.35 }} />
                <p className="text-[10px] font-black text-center px-2 opacity-40" style={{ color: accentColor }}>
                  {imgErr ? t("فشل التحميل", "Erreur") : t("اضغط لاختيار", "Appuyer")}
                </p>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.85)" }}>
                <RefreshCw size={22} className="animate-spin" style={{ color: accentColor }} />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="px-3 py-1.5 rounded-xl text-xs font-black border transition-all"
              style={{ borderColor: accentColor + "40", color: accentColor, background: accentColor + "0A" }}>
              <Camera size={11} className="inline me-1" />
              {(value && !imgErr) ? t("تغيير", "Changer") : t("اختر صورة", "Choisir")}
            </button>
            {(value && !imgErr) && (
              <button type="button" onClick={clear}
                className="px-3 py-1.5 rounded-xl text-xs font-black border border-red-400/30 text-red-500 bg-red-50 transition-all">
                <X size={11} className="inline me-1" />{t("حذف", "Suppr.")}
              </button>
            )}
          </div>
        </div>

        {uploadErr && <p className="text-xs font-bold text-red-500 text-center">{uploadErr}</p>}
        <p className="text-[10px] font-bold opacity-25 text-center" style={{ color: accentColor }}>
          {t("صورة مربعة 1:1 للحصول على دائرة مثالية", "Image carrée 1:1 pour un cercle parfait")}
        </p>
      </div>
    );
  }

  /* ── Rectangle picker ── */
  const aspectClass = aspect === "4:3" ? "aspect-[4/3]" : "aspect-video";

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-black opacity-60" style={{ color: accentColor }}>{label}</label>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      {/* Clickable preview zone */}
      <div
        className={`relative w-full rounded-2xl overflow-hidden border-2 border-dashed cursor-pointer transition-all ${aspectClass}`}
        style={{ borderColor: (value && !imgErr) ? accentColor + "55" : accentColor + "22", background: accentColor + "08" }}
        onClick={() => !uploading && fileRef.current?.click()}
      >
        {(value && !imgErr) ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" onError={() => setImgErr(true)} />
            {!uploading && (
              <div className="absolute top-2 end-2 flex gap-1.5">
                <button
                  onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                  className="p-1.5 rounded-lg backdrop-blur-sm"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                  title={t("تغيير الصورة", "Changer l'image")}>
                  <Camera size={11} className="text-white" />
                </button>
                <button onClick={clear}
                  className="p-1.5 rounded-lg backdrop-blur-sm"
                  style={{ background: "rgba(239,68,68,0.7)" }}
                  title={t("حذف الصورة", "Supprimer")}>
                  <X size={11} className="text-white" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Camera size={36} style={{ color: accentColor, opacity: 0.4 }} />
            <div className="text-center px-4 space-y-0.5">
              <p className="text-xs font-black opacity-50" style={{ color: accentColor }}>
                {imgErr ? t("فشل التحميل — اضغط لتغيير", "Erreur — appuyer pour changer") : t("اضغط لاختيار صورة", "Appuyer pour choisir une photo")}
              </p>
              <p className="text-[10px] opacity-30 font-bold" style={{ color: accentColor }}>
                {t(guideAr, guideFr)}
              </p>
            </div>
          </div>
        )}

        {/* Upload spinner overlay */}
        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ background: "rgba(255,255,255,0.85)" }}>
            <RefreshCw size={26} className="animate-spin" style={{ color: accentColor }} />
            <p className="text-xs font-black" style={{ color: accentColor }}>
              {t("جارٍ الرفع...", "Téléchargement...")}
            </p>
          </div>
        )}
      </div>

      {uploadErr && (
        <p className="text-xs font-bold text-red-500">{uploadErr}</p>
      )}

      <p className="text-[10px] font-bold opacity-30 flex items-center gap-1" style={{ color: accentColor }}>
        <ImageIcon size={9} />
        {t(
          `من المعرض أو الكاميرا · نسبة ${aspect}`,
          `Galerie ou appareil photo · Ratio ${aspect}`
        )}
      </p>
    </div>
  );
}

// ── Multi-Image Picker (للسيارات وغيرها — يدعم أكثر من صورة) ─────────────────
function MultiImagePicker({
  images, onChange, accentColor = "#1565C0", t,
}: {
  images: string[];
  onChange: (imgs: string[]) => void;
  accentColor?: string;
  t: (ar: string, fr: string) => string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";
    setUploading(true);
    setUploadErr("");
    try {
      const uploaded = await Promise.all(files.map(f => uploadImageFile(f)));
      onChange([...images, ...uploaded]);
    } catch {
      setUploadErr(t("فشل رفع بعض الصور، حاول مجدداً", "Échec du chargement, réessayez"));
    } finally {
      setUploading(false);
    }
  };

  const remove = (idx: number) => onChange(images.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <label className="block text-xs font-black opacity-60" style={{ color: accentColor }}>
        {t("الصور", "Photos")}
        <span className="ms-1 opacity-50 font-bold">
          ({images.length} {t("صورة", "photo(s)")})
        </span>
      </label>

      {/* Grid of uploaded images */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((url, idx) => (
            <div key={idx} className="relative aspect-video rounded-xl overflow-hidden group"
              style={{ border: `1.5px solid ${accentColor}22` }}>
              <img src={url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-red-500/90"
                >
                  <X size={12} className="text-white" />
                </button>
              </div>
              {idx === 0 && (
                <div className="absolute top-1 start-1 text-[9px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: accentColor, color: "#fff" }}>
                  {t("رئيسية", "Principale")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full py-3 rounded-2xl border-2 border-dashed flex flex-col items-center gap-1.5 transition-all disabled:opacity-50"
        style={{ borderColor: accentColor + "30", background: accentColor + "06" }}
      >
        {uploading ? (
          <RefreshCw size={20} className="animate-spin" style={{ color: accentColor }} />
        ) : (
          <Camera size={20} style={{ color: accentColor, opacity: 0.5 }} />
        )}
        <span className="text-xs font-black" style={{ color: accentColor, opacity: 0.6 }}>
          {uploading
            ? t("جارٍ الرفع...", "Chargement...")
            : images.length === 0
              ? t("اضغط لاختيار صورة أو أكثر", "Appuyer pour choisir une ou plusieurs photos")
              : t("إضافة صور أخرى", "Ajouter d'autres photos")}
        </span>
        <span className="text-[10px] font-bold opacity-30" style={{ color: accentColor }}>
          {t("من المعرض أو الكاميرا", "Depuis la galerie ou l'appareil photo")}
        </span>
      </button>

      {uploadErr && <p className="text-xs font-bold text-red-500">{uploadErr}</p>}
    </div>
  );
}

// ── SOS Vehicle Photo Card ────────────────────────────────────────────────────
function SosVehiclePhotoCard({
  provider, t, onUpdated,
}: { provider: Supplier; t: (ar: string, fr: string) => string; onUpdated: (url: string) => void }) {
  const [photo, setPhoto]   = useState(provider.photoUrl || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  useEffect(() => { setPhoto(provider.photoUrl || ""); }, [provider.photoUrl]);

  const save = async () => {
    setSaving(true);
    try {
      await patch(`/provider/${provider.id}/photo`, { photoUrl: photo });
      onUpdated(photo);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: "#EF444408", border: "1.5px solid #EF444422" }}>
      <div className="flex items-center gap-2">
        <Truck size={14} style={{ color: "#EF4444" }} />
        <span className="text-xs font-black" style={{ color: "#EF4444" }}>{t("صورة الشاحنة", "Photo du camion")}</span>
        <span className="text-[10px] font-bold opacity-40 ms-1" style={{ color: "#1A4D1F" }}>
          {t("تظهر للعملاء عند الاستجابة", "Visible par les clients lors de l'intervention")}
        </span>
      </div>
      <ImagePickerField
        value={photo}
        onChange={v => { setPhoto(v); setSaved(false); }}
        label={t("صورة شاحنة الإنقاذ", "Photo du véhicule d'intervention")}
        guideAr="صورة واضحة من الواجهة للشاحنة أو السيارة"
        guideFr="Photo nette de face du camion ou véhicule"
        aspect="16:9"
        accentColor="#EF4444"
        t={t}
      />
      <button
        onClick={save}
        disabled={saving || photo === (provider.photoUrl || "")}
        className="w-full py-2.5 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
        style={{ background: saved ? "#059669" : "#EF4444" }}>
        {saving ? <RefreshCw size={13} className="animate-spin" /> : saved ? <Check size={13} /> : <Camera size={13} />}
        {saving ? t("جارٍ الحفظ...","Enregistrement...") : saved ? t("تم الحفظ ✓","Sauvegardé ✓") : t("حفظ صورة الشاحنة","Sauvegarder la photo")}
      </button>
    </div>
  );
}

// ── Products Management Component ─────────────────────────────────────────────
function ProductsManager({ providerId, t, lang, isService = false, overrideLabel }: { providerId: number; t: (ar: string, fr: string) => string; lang: string; isService?: boolean; overrideLabel?: { titleAr: string; titleFr: string; unitAr: string; unitFr: string } }) {
  const [products, setProducts]   = useState<Article[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Article | null>(null);
  const [saving, setSaving]       = useState(false);
  const EMPTY = { nameAr: "", nameFr: "", descriptionAr: "", images: [] as string[], price: "", originalPrice: "", isAvailable: true };
  const [form, setForm]           = useState(EMPTY);

  const getArticleImages = (p: Article): string[] => {
    try { return p.images ? JSON.parse(p.images) : []; } catch { return []; }
  };
  const getArticleThumb = (p: Article): string => {
    const imgs = getArticleImages(p);
    return imgs[0] || p.photoUrl || "";
  };

  const load = async () => {
    setLoading(true);
    try { setProducts(await get<Article[]>(`/provider/${providerId}/articles`)); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [providerId]);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (p: Article) => {
    setEditing(p);
    setForm({
      nameAr: p.nameAr, nameFr: p.nameFr || "",
      descriptionAr: p.descriptionAr || "",
      images: getArticleImages(p),
      price: p.price ? String(p.price) : "",
      originalPrice: p.originalPrice ? String(p.originalPrice) : "",
      isAvailable: p.isAvailable,
    });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        nameAr: form.nameAr,
        nameFr: form.nameFr || form.nameAr,
        descriptionAr: form.descriptionAr,
        descriptionFr: form.descriptionAr,
        images: form.images,
        price: form.price ? Number(form.price) : 0,
        originalPrice: form.originalPrice ? Number(form.originalPrice) : null,
        isAvailable: form.isAvailable,
      };
      if (editing) await patch(`/provider/${providerId}/articles/${editing.id}`, payload);
      else await post(`/provider/${providerId}/articles`, payload);
      await load(); setShowForm(false);
    } finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm(isService ? t("حذف الخدمة؟", "Supprimer le service?") : t("حذف المنتج؟", "Supprimer le produit?"))) return;
    await del(`/provider/${providerId}/articles/${id}`); await load();
  };

  const toggleAvail = async (p: Article) => {
    await patch(`/provider/${providerId}/articles/${p.id}`, { isAvailable: !p.isAvailable });
    await load();
  };

  const hasSale = (p: Article) => {
    const o = p.originalPrice ?? 0;
    const s = p.price ?? 0;
    return o > 0 && s > 0 && s < o;
  };

  const pct = (p: Article) => {
    const o = p.originalPrice ?? 0;
    const s = p.price ?? 0;
    return o > 0 && s > 0 ? Math.round(((o - s) / o) * 100) : 0;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-black text-[#1A4D1F]">
            {overrideLabel ? t(overrideLabel.titleAr, overrideLabel.titleFr) : isService ? t("خدماتي", "Mes services") : t("منتجاتي", "Mes produits")}
          </h3>
          <p className="text-xs text-[#1A4D1F]/40">
            {products.length} {overrideLabel ? t(overrideLabel.unitAr, overrideLabel.unitFr) : isService ? t("خدمة", "service(s)") : t("منتج", "produit(s)")}
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-black" style={{ background: "#1A4D1F" }}>
          <Plus size={13} /> {isService ? t("إضافة خدمة", "Ajouter service") : t("إضافة", "Ajouter")}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-[#1A4D1F] border-t-transparent rounded-full animate-spin" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-12">
          <Package size={32} className="mx-auto mb-2 text-[#1A4D1F]/20" />
          <p className="text-sm font-black text-[#1A4D1F]/30">
            {isService ? t("لم تضف خدمات بعد", "Aucun service") : t("لم تضف منتجات بعد", "Aucun produit")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(p => (
            <motion.div key={p.id} layout className="rounded-2xl border overflow-hidden" style={{ background: "#FFFDE7", borderColor: "rgba(46,125,50,0.15)" }}>
              <div className="flex gap-3 p-3" dir="rtl">
                {/* Image */}
                <div className="w-16 h-16 rounded-xl flex-shrink-0 border border-[#1A4D1F]/10 bg-[#1A4D1F]/5 flex items-center justify-center overflow-hidden relative">
                  {getArticleThumb(p)
                    ? <img src={getArticleThumb(p)} alt={p.nameAr} className="w-full h-full object-cover" />
                    : <ImageIcon size={18} className="text-[#1A4D1F]/20" />
                  }
                  {getArticleImages(p).length > 1 && (
                    <div className="absolute bottom-0.5 right-0.5 bg-black/60 rounded-full px-1 py-0 text-white text-[8px] font-black">
                      {getArticleImages(p).length}
                    </div>
                  )}
                  {hasSale(p) && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-black px-1 py-0.5 rounded-bl-lg rounded-tr-lg">
                      -{pct(p)}%
                    </span>
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-[#1A4D1F] truncate">{lang === "ar" ? p.nameAr : (p.nameFr || p.nameAr)}</p>
                  {/* Prices */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-sm font-black text-[#1A4D1F]">{p.price.toFixed(3)} TND</span>
                    {hasSale(p) && p.originalPrice && (
                      <span className="text-xs font-bold line-through" style={{ color: "#9CA3AF" }}>{p.originalPrice.toFixed(3)}</span>
                    )}
                  </div>
                  {!p.isAvailable && (
                    <span className="text-[10px] font-bold text-red-400">{t("غير متاح", "Indisponible")}</span>
                  )}
                </div>
                {/* Actions */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <button onClick={() => toggleAvail(p)}>
                    {p.isAvailable
                      ? <ToggleRight size={20} className="text-green-500" />
                      : <ToggleLeft size={20} className="text-[#1A4D1F]/20" />
                    }
                  </button>
                  <button onClick={() => openEdit(p)} className="p-1 rounded-lg hover:bg-[#1A4D1F]/10 transition-all">
                    <Pencil size={13} className="text-[#1A4D1F]/40" />
                  </button>
                  <button onClick={() => remove(p.id)} className="p-1 rounded-lg hover:bg-red-50 transition-all">
                    <Trash2 size={13} className="text-red-400" />
                  </button>
                </div>
              </div>
              {p.description && (
                <p className="px-3 pb-3 text-xs text-[#1A4D1F]/50 font-bold leading-relaxed border-t border-[#1A4D1F]/5 pt-2" dir="rtl">
                  {p.description}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setShowForm(false)}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="w-full max-w-md rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto"
              style={{ background: "#FFF3E0" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4" dir="rtl">
                <h3 className="font-black text-[#1A4D1F]">
                {editing
                  ? (isService ? t("تعديل الخدمة", "Modifier le service") : t("تعديل المنتج", "Modifier le produit"))
                  : (isService ? t("خدمة جديدة", "Nouveau service") : t("منتج جديد", "Nouveau produit"))
                }
              </h3>
                <button onClick={() => setShowForm(false)}><X size={18} className="text-[#1A4D1F]/40" /></button>
              </div>
              <div className="space-y-3" dir="rtl">
                {/* Arabic name (required) */}
                <div>
                  <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">
                    {isService ? t("اسم الخدمة بالعربية *", "Nom du service en arabe *") : t("اسم المنتج بالعربية *", "Nom du produit en arabe *")}
                  </label>
                  <input value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))}
                    placeholder={isService ? t("مثال: تغيير زيت المحرك", "Ex: Vidange moteur") : t("مثال: برغر لحم", "Ex: Burger boeuf")}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" />
                </div>
                {/* French name (optional) */}
                <div>
                  <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("الاسم بالفرنسية (اختياري)", "Nom en français (opt.)")}</label>
                  <input value={form.nameFr} onChange={e => setForm(f => ({ ...f, nameFr: e.target.value }))}
                    placeholder={t("يُكمل تلقائياً من الاسم العربي", "Auto-rempli si vide")}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" dir="ltr" />
                </div>
                {/* Description */}
                <div>
                  <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("الوصف", "Description")}</label>
                  <input value={form.descriptionAr} onChange={e => setForm(f => ({ ...f, descriptionAr: e.target.value }))}
                    placeholder={t("وصف مختصر...", "Description courte...")}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" />
                </div>
                {/* Photos — multi-image */}
                <MultiImagePicker
                  images={form.images}
                  onChange={imgs => setForm(f => ({ ...f, images: imgs }))}
                  accentColor="#1A4D1F"
                  t={t}
                />
                {/* Prices */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("الثمن (TND) *", "Prix (TND) *")}</label>
                    <input type="number" step="0.001" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="0.000"
                      className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-[#1A4D1F]/60 block mb-1">{t("الثمن الأصلي (للتخفيض)", "Prix original (promo)")}</label>
                    <input type="number" step="0.001" value={form.originalPrice} onChange={e => setForm(f => ({ ...f, originalPrice: e.target.value }))}
                      placeholder="0.000"
                      className="w-full px-3 py-2.5 rounded-xl border border-[#1A4D1F]/20 bg-white text-sm font-bold text-[#1A4D1F] outline-none focus:border-[#1A4D1F]/50" />
                  </div>
                </div>
                {/* Discount preview */}
                {form.price && form.originalPrice && parseFloat(form.price) < parseFloat(form.originalPrice) && (
                  <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
                    <span className="text-sm font-black text-red-600">-{Math.round(((parseFloat(form.originalPrice) - parseFloat(form.price)) / parseFloat(form.originalPrice)) * 100)}%</span>
                    <span className="text-sm font-bold line-through text-gray-400">{parseFloat(form.originalPrice).toFixed(3)}</span>
                    <span className="text-base font-black text-[#1A4D1F]">{parseFloat(form.price).toFixed(3)} TND</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-black text-[#1A4D1F]">{t("متاح للبيع", "Disponible")}</span>
                  <button onClick={() => setForm(f => ({ ...f, isAvailable: !f.isAvailable }))}>
                    {form.isAvailable
                      ? <ToggleRight size={26} className="text-green-500" />
                      : <ToggleLeft size={26} className="text-[#1A4D1F]/20" />
                    }
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={save} disabled={saving || !form.nameAr || !form.price}
                  className="flex-1 py-2.5 rounded-xl text-white font-black text-sm disabled:opacity-40"
                  style={{ background: "#1A4D1F" }}>
                  {saving ? <RefreshCw size={14} className="animate-spin mx-auto" /> : isService ? t("حفظ", "Enregistrer") : t("حفظ المنتج", "Enregistrer")}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl text-sm font-black text-[#1A4D1F]/50 border border-[#1A4D1F]/15">
                  {t("إلغاء", "Annuler")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Car Manager (for car_rental providers) ────────────────────────────────────
function CarManager({ agencyId, t }: { agencyId: number; t: (ar: string, fr: string) => string }) {
  const EMPTY_CAR = { make: "", model: "", year: "", color: "", plateNumber: "", pricePerDay: "", seats: "5", transmission: "manual", fuelType: "essence", images: [] as string[], descriptionAr: "" };
  const [cars, setCars]           = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveErr, setSaveErr]     = useState("");
  const [form, setForm]           = useState(EMPTY_CAR);

  const loadCars = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/car-rental/cars/all?agencyId=${agencyId}`, {
        headers: { "x-session-token": getSession()?.token || "" },
      });
      const data = await res.json();
      setCars(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  };
  useEffect(() => { loadCars(); }, [agencyId]);

  const addCar = async () => {
    setSaveErr("");
    if (!form.make || !form.model || !form.pricePerDay) return;
    if (!form.plateNumber.trim()) { setSaveErr(t("رقم الترقيم المنجمي إجباري", "Le numéro d'immatriculation est obligatoire")); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/provider/car-rental/cars", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-session-token": getSession()?.token || "" },
        body: JSON.stringify({
          ...form, agencyId,
          pricePerDay: Number(form.pricePerDay),
          seats: Number(form.seats),
          year: form.year ? Number(form.year) : null,
          images: form.images,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveErr(data.message || t("حدث خطأ", "Erreur"));
        return;
      }
      setCars(prev => [...prev, data]);
      setForm(EMPTY_CAR);
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const toggleAvail = async (car: any) => {
    await fetch(`/api/provider/car-rental/cars/${car.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-session-token": getSession()?.token || "" },
      body: JSON.stringify({ isAvailable: !car.isAvailable }),
    });
    setCars(prev => prev.map(c => c.id === car.id ? { ...c, isAvailable: !car.isAvailable } : c));
  };

  const deleteCar = async (id: number) => {
    if (!confirm(t("حذف هذه السيارة؟", "Supprimer cette voiture ?"))) return;
    await fetch(`/api/provider/car-rental/cars/${id}`, {
      method: "DELETE",
      headers: { "x-session-token": getSession()?.token || "" },
    });
    setCars(prev => prev.filter(c => c.id !== id));
  };

  if (loading) return <div className="flex justify-center py-10"><RefreshCw size={18} className="animate-spin text-[#1A4D1F]/30" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-[#1A4D1F]">{t("سياراتي", "Mes voitures")}</h3>
          <p className="text-xs text-[#1A4D1F]/40">{cars.length} {t("سيارة", "voiture(s)")}</p>
        </div>
        <button onClick={() => { setForm(EMPTY_CAR); setShowForm(!showForm); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-xs text-white"
          style={{ background: "#1565C0" }}>
          <Plus size={13} />{t("إضافة سيارة", "Ajouter")}
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "#EFF6FF", border: "1.5px solid #1565C033" }}>
          <p className="text-sm font-black" style={{ color: "#1565C0" }}>{t("بيانات السيارة", "Détails de la voiture")}</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "make",        label: t("العلامة","Marque"),            placeholder: "Toyota" },
              { key: "model",       label: t("الموديل","Modèle"),            placeholder: "Yaris" },
              { key: "year",        label: t("السنة","Année"),               placeholder: "2022" },
              { key: "color",       label: t("اللون","Couleur"),             placeholder: t("أبيض","Blanc") },
              { key: "plateNumber", label: t("رقم الترقيم المنجمي *","Immatriculation *"), placeholder: "123 TU 4567" },
              { key: "pricePerDay", label: t("السعر/يوم (د.ت)","Prix/j (DT)"),         placeholder: "50" },
              { key: "seats",       label: t("المقاعد","Places"),            placeholder: "5" },
            ].map(f => (
              <div key={f.key} className={f.key === "plateNumber" ? "col-span-2" : ""}>
                <label className="block text-xs font-black mb-1 opacity-60" style={{ color: "#1565C0" }}>{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} dir={f.key === "plateNumber" ? "ltr" : undefined}
                  className="w-full rounded-lg px-3 py-2 text-sm font-bold border outline-none"
                  style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1565C033",
                    ...(f.key === "plateNumber" ? { fontFamily: "monospace", letterSpacing: "0.1em" } : {}) }} />
                {f.key === "plateNumber" && <p className="text-[10px] mt-0.5 opacity-50" style={{ color: "#1565C0" }}>{t("مثال: 123 TU 4567 أو 123 TN 4567","Ex: 123 TU 4567 ou 123 TN 4567")}</p>}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-black mb-1 opacity-60" style={{ color: "#1565C0" }}>{t("ناقل الحركة","Boîte")}</label>
              <select value={form.transmission} onChange={e => setForm(p => ({ ...p, transmission: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm font-bold border outline-none"
                style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1565C033" }}>
                <option value="manual">{t("يدوي","Manuelle")}</option>
                <option value="automatic">{t("أوتوماتيك","Automatique")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black mb-1 opacity-60" style={{ color: "#1565C0" }}>{t("الوقود","Carburant")}</label>
              <select value={form.fuelType} onChange={e => setForm(p => ({ ...p, fuelType: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm font-bold border outline-none"
                style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1565C033" }}>
                <option value="essence">{t("بنزين","Essence")}</option>
                <option value="diesel">{t("ديزل","Diesel")}</option>
                <option value="hybrid">{t("هجين","Hybride")}</option>
                <option value="electrique">{t("كهربائي","Électrique")}</option>
              </select>
            </div>
          </div>
          <MultiImagePicker
            images={form.images}
            onChange={imgs => setForm(p => ({ ...p, images: imgs }))}
            accentColor="#1565C0"
            t={t}
          />
          <div>
            <label className="block text-xs font-black mb-1 opacity-60" style={{ color: "#1565C0" }}>{t("وصف السيارة (اختياري)","Description (optionnel)")}</label>
            <input value={form.descriptionAr} onChange={e => setForm(p => ({ ...p, descriptionAr: e.target.value }))}
              placeholder={t("أي ملاحظات إضافية...","Remarques supplémentaires...")}
              className="w-full rounded-lg px-3 py-2 text-sm font-bold border outline-none"
              style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1565C033" }} />
          </div>
          {saveErr && (
            <div className="rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: "#FEE2E2", border: "1px solid #FECACA" }}>
              <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-xs font-bold text-red-600">{saveErr}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={addCar} disabled={saving || !form.make || !form.model || !form.pricePerDay || !form.plateNumber.trim()}
              className="flex-1 py-2.5 rounded-xl font-black text-sm text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "#1565C0" }}>
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {t("إضافة السيارة","Ajouter la voiture")}
            </button>
            <button onClick={() => { setShowForm(false); setSaveErr(""); }} className="px-4 py-2.5 rounded-xl font-black text-sm"
              style={{ background: "#1565C022", color: "#1565C0" }}>
              {t("إلغاء","Annuler")}
            </button>
          </div>
        </div>
      )}

      {cars.length === 0 && !showForm && (
        <div className="text-center py-10 opacity-30">
          <p className="text-2xl mb-2">🚗</p>
          <p className="text-sm font-bold text-[#1A4D1F]">{t("لا توجد سيارات بعد","Aucune voiture encore")}</p>
          <p className="text-xs mt-1 text-[#1A4D1F]/60">{t("اضغط 'إضافة سيارة' لإدراج أول سيارة","Cliquez 'Ajouter' pour commencer")}</p>
        </div>
      )}

      {cars.map(car => (
        <div key={car.id} className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #1A4D1F11" }}>
          <div className="flex items-center gap-3 p-3">
            {(() => {
              const imgs = car.images ? (() => { try { return JSON.parse(car.images); } catch { return []; } })() : [];
              const src = imgs[0] || car.imageUrl;
              return src
                ? <img src={src} alt="" className="w-16 h-12 rounded-lg object-cover flex-shrink-0" />
                : <div className="w-16 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#EFF6FF" }}><span className="text-2xl">🚗</span></div>;
            })()}
            <div className="flex-1 min-w-0">
              <p className="font-black text-sm" style={{ color: "#1A4D1F" }}>{car.make} {car.model} {car.year && `(${car.year})`}</p>
              <p className="text-xs opacity-50 truncate" style={{ color: "#1A4D1F" }}>{car.color && `${car.color} · `}{car.transmission === "automatic" ? t("أوتوماتيك","Auto") : t("يدوي","Manuel")} · {car.fuelType}</p>
              {car.plateNumber && (
                <span className="text-xs font-black px-2 py-0.5 rounded mt-0.5 inline-block tracking-widest" dir="ltr"
                  style={{ background: "#1A4D1F", color: "#FFA500", fontFamily: "monospace" }}>
                  🇹🇳 {car.plateNumber}
                </span>
              )}
              <p className="text-xs font-black mt-0.5" style={{ color: "#1565C0" }}>{car.pricePerDay} {t("د.ت/يوم","TND/j")} · {car.seats} {t("مقاعد","places")}</p>
            </div>
            <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
              <button onClick={() => toggleAvail(car)}
                className="text-xs font-black px-2.5 py-1 rounded-full"
                style={{ background: car.isAvailable ? "#D1FAE5" : "#FEE2E2", color: car.isAvailable ? "#059669" : "#DC2626" }}>
                {car.isAvailable ? t("متاح","Dispo") : t("غير متاح","Indispo")}
              </button>
              <button onClick={() => deleteCar(car.id)}
                className="text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1"
                style={{ background: "#FEE2E2", color: "#DC2626" }}>
                <Trash2 size={10} />{t("حذف","Suppr.")}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Room Manager (for hotel providers) ───────────────────────────────────────
function RoomManager({ providerId, t, lang }: { providerId: number; t: (ar: string, fr: string) => string; lang: string }) {
  const ROOM_TYPES = [
    { value: "single",  arLabel: "مفردة",   frLabel: "Simple",   icon: "🛏️" },
    { value: "double",  arLabel: "مزدوجة",  frLabel: "Double",   icon: "🛏️🛏️" },
    { value: "suite",   arLabel: "جناح",    frLabel: "Suite",    icon: "👑" },
    { value: "family",  arLabel: "عائلية",  frLabel: "Familiale", icon: "👨‍👩‍👧" },
  ];
  const EMPTY = { roomNumber: "", floor: "0", type: "single", pricePerNight: "", photoUrl: "" };
  const [rooms, setRooms]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<any | null>(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState(EMPTY);

  const parseRoom = (article: any) => {
    const desc = article.descriptionAr || "";
    // format: "floor:2|type:double" — language-independent
    const floorMatch = desc.match(/floor:(\d+)/);
    const typeMatch  = desc.match(/type:(\w+)/);
    const numMatch   = (article.nameAr || "").match(/غرفة\s*(.+)/);
    return {
      ...article,
      roomNumber: numMatch ? numMatch[1].trim() : article.nameAr,
      floor: floorMatch ? floorMatch[1] : "0",
      type: typeMatch ? typeMatch[1] : "single",
    };
  };

  const buildPayload = (f: typeof EMPTY) => {
    const typeObj = ROOM_TYPES.find(r => r.value === f.type) || ROOM_TYPES[0];
    const floorLabelFr = f.floor === "0" ? "Rez-de-chaussée" : `Étage ${f.floor}`;
    return {
      nameAr: `غرفة ${f.roomNumber}`,
      nameFr: `Chambre ${f.roomNumber}`,
      descriptionAr: `floor:${f.floor}|type:${f.type}`,        // machine-readable
      descriptionFr: `${floorLabelFr} • ${typeObj.frLabel}`,   // human-readable
      price: f.pricePerNight ? Number(f.pricePerNight) : 0,
      originalPrice: null,
      photoUrl: f.photoUrl || null,
      isAvailable: true,
    };
  };

  const loadRooms = async () => {
    setLoading(true);
    try {
      const rows = await get<any[]>(`/provider/${providerId}/articles`);
      setRooms(rows.map(parseRoom));
    } finally { setLoading(false); }
  };
  useEffect(() => { loadRooms(); }, [providerId]);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowForm(true); };
  const openEdit = (room: any) => {
    setEditing(room);
    setForm({ roomNumber: room.roomNumber, floor: room.floor, type: room.type, pricePerNight: room.price ? String(room.price) : "", photoUrl: room.photoUrl || "" });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.roomNumber || !form.pricePerNight) return;
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (editing) await patch(`/provider/${providerId}/articles/${editing.id}`, payload);
      else await post(`/provider/${providerId}/articles`, payload);
      await loadRooms();
      setShowForm(false);
    } finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!confirm(t("حذف هذه الغرفة؟", "Supprimer cette chambre ?"))) return;
    await del(`/provider/${providerId}/articles/${id}`);
    await loadRooms();
  };

  const toggleAvail = async (room: any) => {
    await patch(`/provider/${providerId}/articles/${room.id}`, { isAvailable: !room.isAvailable });
    await loadRooms();
  };

  if (loading) return <div className="flex justify-center py-10"><RefreshCw size={18} className="animate-spin text-[#1A4D1F]/30" /></div>;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-black text-[#1A4D1F]">{t("غرف النزل", "Chambres de l'hôtel")}</h3>
          <p className="text-xs text-[#1A4D1F]/40">{rooms.length} {t("غرفة", "chambre(s)")}</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-xs text-white"
          style={{ background: "#1A4D1F" }}>
          <Plus size={13} />{t("إضافة غرفة", "Ajouter chambre")}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "#FFF8E1", border: "1.5px solid #FFA50033" }}>
          <p className="text-sm font-black" style={{ color: "#1A4D1F" }}>
            {editing ? t("تعديل الغرفة", "Modifier la chambre") : t("غرفة جديدة", "Nouvelle chambre")}
          </p>

          {/* Room number + floor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>
                {t("رقم الغرفة *", "N° chambre *")}
              </label>
              <input
                value={form.roomNumber}
                onChange={e => setForm(p => ({ ...p, roomNumber: e.target.value }))}
                placeholder="101"
                dir="ltr"
                className="w-full rounded-xl px-3 py-2.5 text-center text-xl font-black border-2 outline-none"
                style={{ background: "#fff", color: "#1A4D1F", borderColor: form.roomNumber ? "#1A4D1F" : "#1A4D1F22", letterSpacing: "0.05em" }}
              />
            </div>
            <div>
              <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>
                {t("الطابق", "Étage")}
              </label>
              <select
                value={form.floor}
                onChange={e => setForm(p => ({ ...p, floor: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-black border-2 outline-none"
                style={{ background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }}>
                <option value="0">{t("الأرضي","Rez-de-chaussée")}</option>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <option key={n} value={String(n)}>{t(`الطابق ${n}`,`Étage ${n}`)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Room type */}
          <div>
            <label className="block text-xs font-black mb-2 opacity-60" style={{ color: "#1A4D1F" }}>
              {t("نوع الغرفة", "Type de chambre")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROOM_TYPES.map(rt => (
                <button key={rt.value} onClick={() => setForm(p => ({ ...p, type: rt.value }))}
                  className="py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 border-2 transition-all"
                  style={form.type === rt.value
                    ? { background: "#1A4D1F", color: "#FFA500", borderColor: "#1A4D1F" }
                    : { background: "#fff", color: "#1A4D1F", borderColor: "#1A4D1F22" }}>
                  <span>{rt.icon}</span>
                  {lang === "ar" ? rt.arLabel : rt.frLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div>
            <label className="block text-xs font-black mb-1.5 opacity-60" style={{ color: "#1A4D1F" }}>
              {t("السعر / ليلة (د.ت) *", "Prix / nuit (DT) *")}
            </label>
            <input
              type="number" step="0.5" min="0"
              value={form.pricePerNight}
              onChange={e => setForm(p => ({ ...p, pricePerNight: e.target.value }))}
              placeholder="80"
              dir="ltr"
              className="w-full rounded-xl px-3 py-2.5 text-lg font-black border-2 outline-none"
              style={{ background: "#fff", color: "#1565C0", borderColor: form.pricePerNight ? "#1565C0" : "#1A4D1F22" }}
            />
          </div>

          {/* Photo */}
          <ImagePickerField
            value={form.photoUrl}
            onChange={v => setForm(p => ({ ...p, photoUrl: v }))}
            label={t("صورة الغرفة", "Photo de la chambre")}
            guideAr="صورة داخلية واضحة للغرفة"
            guideFr="Photo intérieure nette de la chambre"
            aspect="4:3"
            accentColor="#1A4D1F"
            t={t}
          />

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || !form.roomNumber || !form.pricePerNight}
              className="flex-1 py-2.5 rounded-xl font-black text-sm text-white disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: "#1A4D1F" }}>
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {editing ? t("حفظ التعديل", "Enregistrer") : t("إضافة الغرفة", "Ajouter la chambre")}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-xl font-black text-sm"
              style={{ background: "#1A4D1F15", color: "#1A4D1F" }}>
              {t("إلغاء", "Annuler")}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {rooms.length === 0 && !showForm && (
        <div className="text-center py-12 opacity-30">
          <span className="text-4xl block mb-3">🏨</span>
          <p className="text-sm font-bold text-[#1A4D1F]">{t("لا توجد غرف بعد", "Aucune chambre encore")}</p>
          <p className="text-xs mt-1 text-[#1A4D1F]/60">{t("اضغط 'إضافة غرفة' للبدء", "Cliquez 'Ajouter chambre' pour commencer")}</p>
        </div>
      )}

      {/* Rooms list */}
      <div className="space-y-2">
        {rooms.map(room => {
          const typeObj = ROOM_TYPES.find(r => r.value === room.type) || ROOM_TYPES[0];
          const floorLabel = room.floor === "0" ? t("الأرضي","RDC") : `${t("ط","Ét.")} ${room.floor}`;
          return (
            <div key={room.id} className="rounded-2xl overflow-hidden border transition-all"
              style={{ background: "#fff", borderColor: room.isAvailable ? "#1A4D1F15" : "#EF444420" }}>
              <div className="flex items-stretch gap-0">
                {/* Room number badge */}
                <div className="flex flex-col items-center justify-center px-4 py-3 min-w-[72px]"
                  style={{ background: room.isAvailable ? "#1A4D1F" : "#6B7280" }}>
                  <span className="text-2xl font-black text-white leading-none">{room.roomNumber}</span>
                  <span className="text-[9px] font-black mt-1 opacity-70"
                    style={{ color: "#FFA500" }}>{floorLabel}</span>
                </div>
                {/* Info */}
                <div className="flex-1 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">{typeObj.icon}</span>
                    <span className="font-black text-sm" style={{ color: "#1A4D1F" }}>
                      {lang === "ar" ? typeObj.arLabel : typeObj.frLabel}
                    </span>
                    {!room.isAvailable && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full ml-auto"
                        style={{ background: "#FEE2E2", color: "#DC2626" }}>
                        {t("محجوزة", "Occupée")}
                      </span>
                    )}
                  </div>
                  <p className="text-base font-black" style={{ color: "#1565C0" }}>
                    {room.price} {t("د.ت / ليلة", "TND / nuit")}
                  </p>
                </div>
                {/* Actions */}
                <div className="flex flex-col gap-1.5 p-2 items-end justify-center">
                  <button onClick={() => openEdit(room)}
                    className="p-1.5 rounded-lg"
                    style={{ background: "#1A4D1F15" }}>
                    <Pencil size={12} style={{ color: "#1A4D1F" }} />
                  </button>
                  <button onClick={() => toggleAvail(room)}
                    className="p-1.5 rounded-lg"
                    style={{ background: room.isAvailable ? "#D1FAE5" : "#FEE2E2" }}>
                    {room.isAvailable ? <ToggleRight size={12} style={{ color: "#059669" }} /> : <ToggleLeft size={12} style={{ color: "#DC2626" }} />}
                  </button>
                  <button onClick={() => remove(room.id)}
                    className="p-1.5 rounded-lg"
                    style={{ background: "#FEE2E2" }}>
                    <Trash2 size={12} style={{ color: "#DC2626" }} />
                  </button>
                </div>
              </div>
              {room.photoUrl && (
                <img src={room.photoUrl} alt={`Chambre ${room.roomNumber}`}
                  className="w-full h-28 object-cover" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProviderDashboard() {
  const { lang, t, isRTL } = useLang();
  const [providers, setProviders] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [hasNewOrder, setHasNewOrder] = useState(false);
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "all" | "products" | "bookings" | "sos" | "lawyer" | "cars" | "chat" | "location">("pending");
  const [showVendorMap, setShowVendorMap] = useState(false);
  const [locSaving, setLocSaving]         = useState(false);
  const [locSaved, setLocSaved]           = useState(false);
  const [locErr, setLocErr]               = useState("");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const [chatSending, setChatSending]   = useState(false);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const [driverNotif, setDriverNotif] = useState<Notification | null>(null);
  const [carBookings, setCarBookings]       = useState<any[]>([]);
  const [hotelBookings, setHotelBookings]   = useState<any[]>([]);
  const [sosRequests, setSosRequests]       = useState<any[]>([]);
  const [sosLoading, setSosLoading]         = useState(false);
  const [sosOfferPrices, setSosOfferPrices] = useState<Record<number, string>>({});
  const [sosOffering, setSosOffering]       = useState<Record<number, boolean>>({});
  const [lawyerRequests, setLawyerRequests] = useState<any[]>([]);
  const [lawyerLoading, setLawyerLoading]   = useState(false);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<number, OrderItem[]>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const providerNotifPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [, navigate] = useLocation();

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("click",      unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
    return () => {
      window.removeEventListener("click",      unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  useEffect(() => {
    get<Supplier[]>("/suppliers").then(list => {
      setProviders(list);
      const session = getSession();
      if (session?.role === "provider" && session.supplierId) {
        const found = list.find(s => s.id === session.supplierId);
        if (found) selectProvider(found);
      }
    }).catch(() => {});
  }, []);

  const loadOrders = useCallback(async (provider: Supplier, silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const data = await get<Order[]>(`/provider/${provider.id}/orders`);
      setOrders(data);
      const p = data.filter(o => o.status === "pending" || o.status === "searching_for_driver").length;
      setPendingCount(p);
      // Fetch items for active orders (not delivered/cancelled) that we don't have yet
      const activeOrders = data.filter(o => !["delivered","cancelled"].includes(o.status));
      setOrderItemsMap(prev => {
        const newIds = activeOrders.map(o => o.id).filter(id => !(id in prev));
        if (newIds.length === 0) return prev;
        // Fire async fetches, update map when done
        Promise.all(newIds.map(id =>
          get<OrderItem[]>(`/orders/${id}/items`).then(items => ({ id, items })).catch(() => ({ id, items: [] as OrderItem[] }))
        )).then(results => {
          setOrderItemsMap(m => {
            const updated = { ...m };
            results.forEach(({ id, items }) => { updated[id] = items; });
            return updated;
          });
        });
        return prev;
      });
    } catch {}
    if (!silent) setLoading(false); else setRefreshing(false);
  }, []);

  const startPolling = useCallback((provider: Supplier) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { count } = await get<{ count: number }>(`/provider/${provider.id}/pending-count`);
        setPendingCount(prev => {
          if (count > prev) {
            setHasNewOrder(true);
            setTimeout(() => setHasNewOrder(false), 4000);
            playRoleSound(provider.category);
          }
          return count;
        });
        await loadOrders(provider, true);
      } catch {}
    }, 30000);
  }, [loadOrders]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (providerNotifPollRef.current) clearInterval(providerNotifPollRef.current);
  }, []);

  const startProviderNotifPolling = useCallback((provider: Supplier) => {
    if (providerNotifPollRef.current) clearInterval(providerNotifPollRef.current);
    providerNotifPollRef.current = setInterval(() => {
      const notifs = readNotifKey(providerKey(provider.id));
      const unread = notifs.filter(n => !n.read);
      if (unread.length > 0) {
        setDriverNotif(unread[0]);
        playRoleSound(provider.category);
        markNotifKeyRead(providerKey(provider.id));
        setTimeout(() => setDriverNotif(null), 6000);
      }
    }, 5000);
  }, []);

  const loadCarBookings = async (provider: Supplier) => {
    try {
      const session = getSession();
      const res = await fetch(`/api/car-rental/bookings?agencyId=${provider.id}`, {
        headers: { "x-session-token": session?.token || "" },
      });
      const data = await res.json();
      if (Array.isArray(data)) setCarBookings(data);
    } catch {}
  };

  const loadHotelBookings = async (provider: Supplier) => {
    try {
      const session = getSession();
      const res = await fetch(`/api/hotel-bookings/hotel/${provider.id}`, {
        headers: { "x-session-token": session?.token || "" },
      });
      const data = await res.json();
      if (Array.isArray(data)) setHotelBookings(data);
    } catch {}
  };

  const updateHotelBooking = async (bookingId: number, status: string) => {
    const session = getSession();
    await fetch(`/api/hotel-bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-session-token": session?.token || "" },
      body: JSON.stringify({ status }),
    });
    setHotelBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
  };

  const loadSosRequests = async (provider: Supplier) => {
    setSosLoading(true);
    try {
      const session = getSession();
      const lat = provider.latitude ?? "";
      const lng = provider.longitude ?? "";
      const res = await fetch(`/api/sos/nearby?lat=${lat}&lng=${lng}`, {
        headers: { "x-session-token": session?.token || "" },
      });
      const data = await res.json();
      if (Array.isArray(data)) setSosRequests(data);
    } catch {}
    setSosLoading(false);
  };

  const loadLawyerRequests = async (provider: Supplier) => {
    setLawyerLoading(true);
    try {
      const session = getSession();
      const res = await fetch(`/api/lawyer-requests/my/${provider.id}`, {
        headers: { "x-session-token": session?.token || "" },
      });
      const data = await res.json();
      if (Array.isArray(data)) setLawyerRequests(data);
    } catch {}
    setLawyerLoading(false);
  };

  const updateLawyerRequest = async (requestId: number, status: "accepted" | "rejected") => {
    const session = getSession();
    try {
      const res = await fetch(`/api/lawyer-requests/${requestId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-token": session?.token || "" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      setLawyerRequests(prev => prev.map(r => r.id === requestId ? data : r));
    } catch {}
  };

  const acceptSos = async (sosId: number, provider: Supplier) => {
    const session = getSession();
    try {
      const res = await fetch(`/api/sos/${sosId}/accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-token": session?.token || "" },
        body: JSON.stringify({ providerId: provider.id, providerName: lang === "ar" ? provider.nameAr : provider.name }),
      });
      if (res.status === 409) return alert(t("تم قبول هذا الطلب مسبقاً", "Déjà accepté par un autre"));
      setSosRequests(prev => prev.map(s => s.id === sosId ? { ...s, status: "accepted", assignedProviderId: provider.id } : s));
    } catch {}
  };

  const offerSos = async (sosId: number, provider: Supplier) => {
    const priceStr = sosOfferPrices[sosId] || "";
    const price    = parseFloat(priceStr.replace(",", "."));
    if (isNaN(price) || price <= 0) return alert(t("أدخل مبلغاً صحيحاً", "Entrez un montant valide"));
    const session = getSession();
    setSosOffering(prev => ({ ...prev, [sosId]: true }));
    try {
      const res = await fetch(`/api/sos/${sosId}/offer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-session-token": session?.token || "" },
        body: JSON.stringify({
          providerId: provider.id,
          providerName: lang === "ar" ? provider.nameAr : provider.name,
          price,
        }),
      });
      if (res.status === 409) { alert(t("هذا الطلب مأخوذ مسبقاً", "Demande déjà prise")); return; }
      const data = await res.json();
      setSosRequests(prev => prev.map(s => s.id === sosId ? data : s));
    } catch { alert(t("فشل الإرسال", "Erreur réseau")); }
    finally { setSosOffering(prev => ({ ...prev, [sosId]: false })); }
  };

  const updateCarBooking = async (bookingId: number, status: string) => {
    const session = getSession();
    await fetch(`/api/car-rental/bookings/${bookingId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-session-token": session?.token || "" },
      body: JSON.stringify({ status }),
    });
    setCarBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
  };

  const loadChatMessages = useCallback(async (supplierId: number) => {
    try {
      const msgs = await get<any[]>(`/vendor-messages/${supplierId}`);
      setChatMessages(msgs);
      setTimeout(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80);
    } catch {}
  }, []);

  const sendChatMessage = async (supplierId: number) => {
    const body = chatInput.trim();
    if (!body || chatSending) return;
    setChatSending(true);
    setChatInput("");
    try {
      const msg = await post<any>(`/vendor-messages/${supplierId}`, { senderRole: "vendor", body });
      setChatMessages(prev => [...prev, msg]);
      setTimeout(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, 80);
    } catch { setChatInput(body); }
    setChatSending(false);
  };

  const selectProvider = async (provider: Supplier) => {
    setSelected(provider);
    setTab(provider.category === "lawyer" ? "lawyer" : provider.category === "car_rental" ? "cars" : "pending");
    await loadOrders(provider);
    startPolling(provider);
    startProviderNotifPolling(provider);
    if (provider.category === "car_rental") loadCarBookings(provider);
    if (provider.category === "hotel")    loadHotelBookings(provider);
    if (provider.category === "lawyer") loadLawyerRequests(provider);
    else loadSosRequests(provider);
    loadChatMessages(provider.id);
    if (chatPollRef.current) clearInterval(chatPollRef.current);
    chatPollRef.current = setInterval(() => loadChatMessages(provider.id), 20_000);
  };

  const updateStatus = async (orderId: number, status: string) => {
    await patch(`/orders/${orderId}`, { status });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    if (["accepted", "cancelled"].includes(status)) setPendingCount(prev => Math.max(0, prev - 1));
    if (status === "accepted") {
      pushNotification({
        type: "accepted",
        orderId,
        messageAr: `تم قبول طلبك رقم #${orderId.toString().padStart(4, "0")} ✅`,
        messageFr: `Votre commande #${orderId.toString().padStart(4, "0")} a été acceptée ✅`,
      });
    }
  };

  const toggleAvailability = async () => {
    if (!selected) return;
    const res = await patch<Supplier>(`/provider/${selected.id}/toggle`, {});
    setSelected(res);
    setProviders(prev => prev.map(p => p.id === selected.id ? res : p));
  };

  const saveLocation = async (result: VendorMapPickerResult) => {
    if (!selected) return;
    setLocSaving(true);
    setLocErr("");
    try {
      await patch(`/provider/${selected.id}/location`, {
        latitude:  result.lat,
        longitude: result.lng,
        address:   result.address,
      });
      const updated = { ...selected, latitude: result.lat, longitude: result.lng, address: result.address };
      setSelected(updated);
      setProviders(prev => prev.map(p => p.id === selected.id ? updated : p));
      setShowVendorMap(false);
      setLocSaved(true);
      setTimeout(() => setLocSaved(false), 4000);
    } catch {
      setLocErr(t("فشل الحفظ — حاول مجدداً", "Échec de la sauvegarde — réessayez"));
    } finally {
      setLocSaving(false);
    }
  };

  const logout = () => {
    clearSession();
    setSelected(null); setOrders([]); setPendingCount(0);
    if (pollRef.current) clearInterval(pollRef.current);
    navigate("/login");
  };

  const openWhatsApp = (phone?: string) => {
    if (!phone) return;
    window.open(`https://wa.me/${phone.replace(/\D/g, "")}`, "_blank");
  };

  const pendingOrders = orders.filter(o => o.status === "pending" || o.status === "searching_for_driver");
  const displayOrders = tab === "pending" ? pendingOrders : orders;

  /* ── If not linked to a supplier → send back to login ── */
  if (!selected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#FFA500" }} dir={isRTL ? "rtl" : "ltr"}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-[20px] p-8 text-center"
          style={{ background: "#FFFDE7", border: "1px solid rgba(26,77,31,0.1)" }}
        >
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-400/30 flex items-center justify-center mx-auto mb-5">
            <Package size={24} className="text-red-400" />
          </div>
          <h2 className="text-lg font-black text-[#1A4D1F] mb-2">{t("غير مرتبط بمتجر", "Compte non lié")}</h2>
          <p className="text-sm text-[#1A4D1F]/40 mb-6">
            {t("حسابك غير مرتبط بأي متجر. تواصل مع المسؤول.", "Votre compte n'est pas lié à un magasin. Contactez l'admin.")}
          </p>
          <button
            onClick={logout}
            className="w-full py-3 rounded-xl font-black text-white text-sm"
            style={{ background: "#1A4D1F" }}
          >
            {t("العودة لتسجيل الدخول", "Retour à la connexion")}
          </button>
        </motion.div>
      </div>
    );
  }

  /* ── Dashboard ── */
  return (
    <div className="min-h-screen p-4 pb-8" style={{ background: "#FFA500" }} dir={isRTL ? "rtl" : "ltr"}>

      {/* New order toast */}
      <AnimatePresence>
        {hasNewOrder && (
          <motion.div initial={{ opacity: 0, y: -60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -60 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl border border-[#1A4D1F]/40 shadow-xl"
            style={{ background: "#D4A800" }}>
            <Bell size={18} className="text-[#1A4D1F]" />
            <span className="text-[#1A4D1F] font-black text-sm">{t("🔔 طلب جديد وصل!", "🔔 Nouvelle commande!")}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Driver notification toast */}
      <AnimatePresence>
        {driverNotif && (
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full mx-4 flex items-start gap-3 px-4 py-3.5 rounded-2xl border shadow-xl"
            style={{ background: "#FFFDE7", borderColor: "#FFA500" }}>
            <Truck size={18} className="text-[#FFA500] mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[#1A4D1F] font-black text-sm">
                {lang === "ar" ? driverNotif.messageAr : driverNotif.messageFr}
              </p>
            </div>
            <button onClick={() => setDriverNotif(null)} className="text-[#1A4D1F]/30 hover:text-[#1A4D1F] flex-shrink-0 mt-0.5">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prescription photo modal */}
      <AnimatePresence>
        {photoModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.92)" }} onClick={() => setPhotoModal(null)}>
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} src={photoModal}
              className="max-w-sm w-full rounded-2xl border border-[#1A4D1F]/10" alt="prescription" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="rounded-[15px] p-5 border border-[#1A4D1F]/25" style={{ background: "#FFFDE7" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-black text-[#1A4D1F]">{selected.nameAr}</h1>
                {pendingCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30">
                    <Bell size={10} className="text-amber-400" />
                    <span className="text-xs font-black text-amber-400">{pendingCount}</span>
                  </span>
                )}
              </div>
              {selected.rating && (
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(i => <Star key={i} size={11} className={i <= Math.round(selected.rating!) ? "text-[#1A4D1F] fill-[#1A4D1F]" : "text-[#1A4D1F]/20"} />)}
                  <span className="text-xs text-[#1A4D1F]/40 ml-1">{selected.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 items-center">
              <NotificationBell lang={lang} role="provider" providerId={selected.id} />
              <button
                onClick={() => navigate("/orders/history")}
                className="p-2.5 rounded-xl border border-[#1A4D1F]/20 text-[#1A4D1F]/50 hover:text-[#1A4D1F] hover:border-[#1A4D1F]/50 transition-all"
                title={t("سجل الطلبات", "Historique")}
              >
                <History size={14} />
              </button>
              <button
                onClick={() => selected.category === "lawyer" ? loadLawyerRequests(selected) : loadOrders(selected, true)}
                disabled={refreshing || lawyerLoading}
                className="p-2.5 rounded-xl border border-[#1A4D1F]/10 text-[#1A4D1F]/40 hover:text-[#1A4D1F] transition-all">
                <RefreshCw size={14} className={(refreshing || lawyerLoading) ? "animate-spin" : ""} />
              </button>
              <button onClick={logout}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-black text-sm transition-all"
                style={{ background: "#1A4D1F", color: "#000" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#1A4D1F")}
                onMouseLeave={e => (e.currentTarget.style.background = "#1A4D1F")}>
                <LogOut size={14} />
                <span>{t("خروج", "Déco.")}</span>
              </button>
            </div>
          </div>

          {/* Open / Closed toggle */}
          <button onClick={toggleAvailability}
            className={cn("w-full flex items-center justify-center gap-3 py-3 rounded-xl font-black text-base transition-all border",
              selected.isAvailable
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20")}>
            <Power size={18} />
            {selected.isAvailable
              ? t("المحل مفتوح ← اضغط للإغلاق", "Ouvert ← Cliquez pour fermer")
              : t("المحل مغلق ← اضغط للفتح", "Fermé ← Cliquez pour ouvrir")}
          </button>

          {/* Stats bar — مختلف حسب نوع المزود */}
          {selected.category === "lawyer" ? (
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#1A4D1F]/5">
              <div className="text-center">
                <p className="text-2xl font-black text-amber-400">{lawyerRequests.filter(r => r.status === "pending").length}</p>
                <p className="text-xs text-[#1A4D1F]/30">{t("انتظار", "En attente")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-400">{lawyerRequests.filter(r => r.status === "accepted").length}</p>
                <p className="text-xs text-[#1A4D1F]/30">{t("مقبول", "Accepté")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-red-400">{lawyerRequests.filter(r => r.status === "rejected").length}</p>
                <p className="text-xs text-[#1A4D1F]/30">{t("مرفوض", "Refusé")}</p>
              </div>
            </div>
          ) : selected.category === "car_rental" ? (
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#1A4D1F]/5">
              <div className="text-center">
                <p className="text-2xl font-black text-amber-400">{carBookings.filter(b => b.status === "pending").length}</p>
                <p className="text-xs text-[#1A4D1F]/30">{t("حجز جديد", "Nouv. réserv.")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-blue-400">{carBookings.filter(b => ["confirmed","active"].includes(b.status)).length}</p>
                <p className="text-xs text-[#1A4D1F]/30">{t("نشط", "Actif")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-400">{carBookings.filter(b => b.status === "completed").length}</p>
                <p className="text-xs text-[#1A4D1F]/30">{t("مكتمل", "Terminé")}</p>
              </div>
            </div>
          ) : isSosCat(selected.category) ? (
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#1A4D1F]/5">
              <div className="text-center">
                <p className="text-2xl font-black text-amber-400">{sosRequests.filter(r => r.status === "pending").length}</p>
                <p className="text-xs text-[#1A4D1F]/30">{t("انتظار", "En attente")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-orange-400">{sosRequests.filter(r => r.status === "offered").length}</p>
                <p className="text-xs text-[#1A4D1F]/30">{t("عرض سعر", "Offre envoyée")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-400">{sosRequests.filter(r => r.status === "accepted").length}</p>
                <p className="text-xs text-[#1A4D1F]/30">{t("مقبول", "Accepté")}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#1A4D1F]/5">
              <div className="text-center">
                <p className="text-2xl font-black text-amber-400">{pendingOrders.length}</p>
                <p className="text-xs text-[#1A4D1F]/30">{t("انتظار", "En attente")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-blue-400">{orders.filter(o => ["accepted","prepared","in_delivery"].includes(o.status)).length}</p>
                <p className="text-xs text-[#1A4D1F]/30">{t("نشط", "En cours")}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-400">{orders.filter(o => o.status === "delivered").length}</p>
                <p className="text-xs text-[#1A4D1F]/30">{t("منجز", "Livré")}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Missing-location warning banner ───────────────────────── */}
        {(!selected.latitude || !selected.longitude) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border cursor-pointer"
            style={{ background: "#fff8e1", borderColor: "#FFA500", color: "#92400e" }}
            onClick={() => setTab("location")}
          >
            <AlertTriangle size={16} className="text-[#FFA500] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black">
                {t("موقع المحل غير محدد بعد", "Position de la boutique non définie")}
              </p>
              <p className="text-[10px] font-bold opacity-60">
                {t("اضغط هنا لتثبيت موقعك على الخريطة", "Appuyer pour épingler votre boutique")}
              </p>
            </div>
            <MapPin size={14} className="text-[#FFA500] flex-shrink-0" />
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: "#FFFDE7" }}>
          {(selected.category === "lawyer"
            ? [
                { id: "lawyer",   label: t("القضايا","Dossiers"),   icon: <Scale size={10} />, badge: lawyerRequests.filter(r=>r.status==="pending").length },
                { id: "products", label: t("تخصصاتي","Spécialités"), icon: <FileText size={10} /> },
                { id: "chat",     label: t("مراسلة","Messages"),    icon: <MessageCircle size={10} />, badge: chatMessages.filter(m=>m.senderRole==="admin"&&!m.isRead).length },
                { id: "location", label: t("موقع","Lieu"),          icon: <MapPin size={10} />, warn: !selected.latitude || !selected.longitude },
              ]
            : selected.category === "car_rental"
            ? [
                { id: "cars",     label: t("السيارات","Voitures"),  icon: <span className="text-[10px]">🚗</span> },
                { id: "bookings", label: t("الحجوزات","Réserv."),  icon: <KeyRound size={10} />, badge: carBookings.filter((b:any)=>b.status==="pending").length },
                { id: "chat",     label: t("مراسلة","Messages"),    icon: <MessageCircle size={10} />, badge: chatMessages.filter(m=>m.senderRole==="admin"&&!m.isRead).length },
                { id: "location", label: t("موقع","Lieu"),          icon: <MapPin size={10} />, warn: !selected.latitude || !selected.longitude },
              ]
            : [
                { id: "pending",  label: t("جديد","Nouv."),       badge: pendingOrders.length },
                { id: "all",      label: t("الطلبات","Cmds") },
                {
                  id: "products",
                  label: selected.category === "hotel"
                    ? t("الغرف","Chambres")
                    : isProductCat(selected.category)
                      ? t("المنتجات","Produits")
                      : t("الخدمات","Services"),
                  icon: selected.category === "hotel" ? <Hotel size={10} /> : <Package size={10} />,
                },
                ...(selected.category === "hotel" ? [{ id: "bookings", label: t("حجوزات","Réserv."), icon: <KeyRound size={10} />, badge: hotelBookings.filter((b:any)=>b.status==="pending").length }] : []),
                ...(isSosCat(selected.category) ? [{
                  id: "sos", label: "SOS", icon: <AlertTriangle size={10} />, badge: sosRequests.filter(s=>s.status==="pending").length, danger: true,
                }] : []),
                { id: "chat",     label: t("مراسلة","Messages"),    icon: <MessageCircle size={10} />, badge: chatMessages.filter(m=>m.senderRole==="admin"&&!m.isRead).length },
                { id: "location", label: t("موقع","Lieu"),          icon: <MapPin size={10} />, warn: !selected.latitude || !selected.longitude },
              ]
          ).map((tb: any) => (
            <button key={tb.id} onClick={() => setTab(tb.id as any)}
              className={cn("flex-shrink-0 flex-1 py-2 rounded-lg font-black text-xs transition-all flex items-center justify-center gap-1 relative",
                tab === tb.id
                  ? tb.danger ? "bg-red-500 text-white" : "bg-[#1A4D1F] text-white"
                  : tb.danger ? "text-red-400 hover:text-red-500" : "text-[#1A4D1F]/40 hover:text-[#1A4D1F]")}>
              {tb.icon}{tb.label}
              {(tb.badge ?? 0) > 0 && (
                <span className={cn("px-1.5 py-0.5 rounded-full text-xs font-black",
                  tab === tb.id ? "bg-white/20 text-white" : tb.danger ? "bg-red-400/20 text-red-400" : "bg-amber-400/20 text-amber-400")}>
                  {tb.badge}
                </span>
              )}
              {/* Orange warning dot when location is not set */}
              {tb.warn && tab !== tb.id && (
                <span className="absolute top-1 end-1 w-2 h-2 rounded-full bg-[#FFA500]" />
              )}
            </button>
          ))}
        </div>

        {/* Car Manager (وكالات السيارات فقط) */}
        {tab === "cars" && selected.category === "car_rental" && (
          <CarManager agencyId={selected.id} t={t} />
        )}

        {/* Room Manager — فقط للفنادق */}
        {tab === "products" && selected.category === "hotel" && (
          <RoomManager providerId={selected.id} t={t} lang={lang} />
        )}

        {/* Products / Services Manager — لكل الفئات عدا الفنادق وكراء السيارات */}
        {tab === "products" && selected.category !== "car_rental" && selected.category !== "hotel" && (
          <ProductsManager
            providerId={selected.id}
            t={t}
            lang={lang}
            isService={!isProductCat(selected.category)}
            overrideLabel={selected.category === "lawyer"
              ? { titleAr: "تخصصاتي", titleFr: "Mes spécialités", unitAr: "تخصص", unitFr: "spécialité(s)" }
              : undefined}
          />
        )}

        {/* Car Rental Bookings */}
        {tab === "bookings" && selected.category === "car_rental" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black opacity-50" style={{ color: "#1A4D1F" }}>{t("حجوزات السيارات", "Réservations voitures")}</p>
              <button onClick={() => loadCarBookings(selected)} className="p-1.5 rounded-lg" style={{ background: "#1A4D1F22" }}>
                <RefreshCw size={12} style={{ color: "#1A4D1F" }} />
              </button>
            </div>
            {carBookings.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-2 opacity-30">
                <KeyRound size={32} style={{ color: "#1A4D1F" }} />
                <p className="text-sm font-bold" style={{ color: "#1A4D1F" }}>{t("لا توجد حجوزات", "Aucune réservation")}</p>
              </div>
            ) : carBookings.map(b => {
              const statusColors: Record<string, { bg: string; color: string }> = {
                pending:   { bg: "#FEF3C7", color: "#92400E" },
                confirmed: { bg: "#DBEAFE", color: "#1D4ED8" },
                rejected:  { bg: "#FEE2E2", color: "#DC2626" },
                active:    { bg: "#D1FAE5", color: "#059669" },
                completed: { bg: "#EDE9FE", color: "#6D28D9" },
                cancelled: { bg: "#F3F4F6", color: "#6B7280" },
              };
              const sc = statusColors[b.status] || statusColors.pending;
              const statusLabel: Record<string, { ar: string; fr: string }> = {
                pending:   { ar: "في الانتظار", fr: "En attente" },
                confirmed: { ar: "مؤكد",        fr: "Confirmé" },
                rejected:  { ar: "مرفوض",       fr: "Refusé" },
                active:    { ar: "نشط",         fr: "Actif" },
                completed: { ar: "مكتمل",       fr: "Terminé" },
                cancelled: { ar: "ملغي",        fr: "Annulé" },
              };
              return (
                <div key={b.id} className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #1A4D1F11" }}>
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#1A4D1F08" }}>
                    <span className="text-xs font-black" style={{ color: "#1A4D1F" }}>#{b.id} · سيارة #{b.carId}</span>
                    <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg }}>
                      {lang === "ar" ? statusLabel[b.status]?.ar : statusLabel[b.status]?.fr}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="font-black text-sm" style={{ color: "#1A4D1F" }}>{b.customerName}</p>
                    <p className="text-xs opacity-50 flex items-center gap-1" style={{ color: "#1A4D1F" }}><Phone size={10} />{b.customerPhone}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs font-bold" style={{ color: "#1A4D1F" }}>
                      <Calendar size={11} />{b.startDate} → {b.endDate} ({b.durationDays} {t("يوم", "j")})
                    </div>
                    <p className="text-sm font-black mt-1" style={{ color: "#FFA500" }}>{b.totalPrice} {t("د.ت", "TND")}</p>
                    {b.notes && <p className="text-xs mt-1 opacity-40" style={{ color: "#1A4D1F" }}>{b.notes}</p>}
                    {b.status === "pending" && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => updateCarBooking(b.id, "confirmed")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-black text-xs"
                          style={{ background: "#1A4D1F", color: "#fff" }}>
                          <Check size={12} /> {t("تأكيد", "Confirmer")}
                        </button>
                        <button onClick={() => updateCarBooking(b.id, "rejected")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-black text-xs"
                          style={{ background: "#FEE2E2", color: "#DC2626" }}>
                          <X size={12} /> {t("رفض", "Refuser")}
                        </button>
                      </div>
                    )}
                    {b.status === "confirmed" && (
                      <button onClick={() => updateCarBooking(b.id, "active")}
                        className="mt-3 w-full py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5"
                        style={{ background: "#D1FAE5", color: "#059669" }}>
                        {t("تأكيد الاستلام → نشط", "Confirmer remise → Actif")}
                      </button>
                    )}
                    {b.status === "active" && (
                      <button onClick={() => updateCarBooking(b.id, "completed")}
                        className="mt-3 w-full py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5"
                        style={{ background: "#EDE9FE", color: "#6D28D9" }}>
                        {t("إنهاء الكراء ✓", "Terminer ✓")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Hotel bookings */}
        {tab === "bookings" && selected.category === "hotel" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black opacity-50" style={{ color: "#1A4D1F" }}>{t("حجوزات الفندق", "Réservations hôtel")}</p>
              <button onClick={() => loadHotelBookings(selected)} className="p-1.5 rounded-lg" style={{ background: "#1A4D1F22" }}>
                <RefreshCw size={12} style={{ color: "#1A4D1F" }} />
              </button>
            </div>
            {hotelBookings.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-2 opacity-30">
                <Hotel size={32} style={{ color: "#1A4D1F" }} />
                <p className="text-sm font-bold" style={{ color: "#1A4D1F" }}>{t("لا توجد حجوزات", "Aucune réservation")}</p>
              </div>
            ) : hotelBookings.map((b: any) => {
              const statusColors: Record<string, { bg: string; color: string }> = {
                pending:   { bg: "#FEF3C7", color: "#92400E" },
                confirmed: { bg: "#DBEAFE", color: "#1D4ED8" },
                rejected:  { bg: "#FEE2E2", color: "#DC2626" },
                completed: { bg: "#EDE9FE", color: "#6D28D9" },
                cancelled: { bg: "#F3F4F6", color: "#6B7280" },
              };
              const statusLabel: Record<string, { ar: string; fr: string }> = {
                pending:   { ar: "في الانتظار", fr: "En attente" },
                confirmed: { ar: "مؤكد",        fr: "Confirmé" },
                rejected:  { ar: "مرفوض",       fr: "Refusé" },
                completed: { ar: "مكتمل",       fr: "Terminé" },
                cancelled: { ar: "ملغي",        fr: "Annulé" },
              };
              const sc = statusColors[b.status] || statusColors.pending;
              let parsedRooms: any[] = [];
              try { parsedRooms = JSON.parse(b.selectedRooms || "[]"); } catch {}
              const nights = Math.max(0, Math.floor((new Date(b.checkOut).getTime() - new Date(b.checkIn).getTime()) / 86400000));
              return (
                <div key={b.id} className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #1A4D1F11" }}>
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#1A4D1F08" }}>
                    <span className="text-xs font-black" style={{ color: "#1A4D1F" }}>#{String(b.id).padStart(4,"0")}</span>
                    <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg }}>
                      {lang === "ar" ? statusLabel[b.status]?.ar : statusLabel[b.status]?.fr}
                    </span>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="font-black text-sm" style={{ color: "#1A4D1F" }}>{b.customerName}</p>
                    <p className="text-xs flex items-center gap-1" style={{ color: "#1A4D1F", opacity: 0.5 }}><Phone size={10} />{b.customerPhone}</p>
                    <div className="flex items-center gap-2 text-xs font-bold" style={{ color: "#1A4D1F" }}>
                      <Calendar size={11} />
                      {String(b.checkIn).split("T")[0]} → {String(b.checkOut).split("T")[0]}
                      {nights > 0 && <span className="text-[#FFA500]">({nights} {t("ليلة","nuit(s)")})</span>}
                    </div>
                    {parsedRooms.length > 0 && (
                      <div className="rounded-xl bg-[#FFF3E0] p-2.5 space-y-1">
                        {parsedRooms.map((r: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs font-bold" style={{ color: "#1A4D1F" }}>
                            <span>{r.qty}× {lang === "ar" ? r.nameAr : r.nameFr}</span>
                            <span>{(r.qty * r.pricePerNight).toFixed(3)} TND/ليلة</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {b.totalPrice && (
                      <p className="text-sm font-black" style={{ color: "#FFA500" }}>{Number(b.totalPrice).toFixed(3)} TND {t("إجمالي", "total")}</p>
                    )}
                    {b.status === "pending" && (
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => updateHotelBooking(b.id, "confirmed")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-black text-xs"
                          style={{ background: "#1A4D1F", color: "#fff" }}>
                          <Check size={12} /> {t("تأكيد", "Confirmer")}
                        </button>
                        <button onClick={() => updateHotelBooking(b.id, "rejected")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-black text-xs"
                          style={{ background: "#FEE2E2", color: "#DC2626" }}>
                          <X size={12} /> {t("رفض", "Refuser")}
                        </button>
                      </div>
                    )}
                    {b.status === "confirmed" && (
                      <button onClick={() => updateHotelBooking(b.id, "completed")}
                        className="mt-2 w-full py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5"
                        style={{ background: "#EDE9FE", color: "#6D28D9" }}>
                        {t("إنهاء الإقامة ✓", "Séjour terminé ✓")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SOS requests */}
        {tab === "sos" && (
          <div className="space-y-3">
            {/* ── Vehicle Photo Card ── */}
            <SosVehiclePhotoCard provider={selected} t={t} onUpdated={(url) => setProviders(ss => ss.map(s => s.id === selected.id ? { ...s, photoUrl: url } : s))} />

            <div className="flex items-center justify-between">
              <p className="text-xs font-black opacity-50" style={{ color: "#1A4D1F" }}>{t("طلبات SOS القريبة", "Demandes SOS proches")}</p>
              <button onClick={() => loadSosRequests(selected)} className="p-1.5 rounded-lg" style={{ background: "#EF444422" }}>
                <RefreshCw size={12} style={{ color: "#EF4444" }} />
              </button>
            </div>
            {sosLoading ? (
              <div className="flex justify-center py-12"><div className="w-6 h-6 rounded-full border-2 border-red-400/20 border-t-red-400 animate-spin" /></div>
            ) : sosRequests.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-2 opacity-30">
                <AlertTriangle size={32} style={{ color: "#EF4444" }} />
                <p className="text-sm font-bold" style={{ color: "#1A4D1F" }}>{t("لا توجد طلبات SOS", "Aucune demande SOS")}</p>
              </div>
            ) : sosRequests.map(sos => {
              const CAT_LABELS: Record<string, { ar: string; fr: string; color: string }> = {
                mechanic:  { ar: "ميكانيكي", fr: "Mécanicien", color: "#F59E0B" },
                doctor:    { ar: "طبيب",     fr: "Médecin",    color: "#3B82F6" },
                emergency: { ar: "طوارئ",    fr: "Urgence",    color: "#EF4444" },
                other:     { ar: "أخرى",     fr: "Autre",      color: "#6B7280" },
              };
              const cat = CAT_LABELS[sos.category] || CAT_LABELS.other;
              const mine = sos.assignedProviderId === selected.id;
              return (
                <div key={sos.id} className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: `1px solid ${cat.color}33` }}>
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: cat.color + "15" }}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={12} style={{ color: cat.color }} />
                      <span className="text-xs font-black" style={{ color: cat.color }}>{lang === "ar" ? cat.ar : cat.fr}</span>
                    </div>
                    <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{
                      color: sos.status === "accepted" ? "#059669"
                           : sos.status === "offered"  ? "#1D4ED8"
                           : sos.status === "cancelled" ? "#6B7280"
                           : "#92400E",
                      background: sos.status === "accepted" ? "#D1FAE5"
                                : sos.status === "offered"  ? "#DBEAFE"
                                : sos.status === "cancelled" ? "#F3F4F6"
                                : "#FEF3C7"
                    }}>
                      {sos.status === "accepted"  ? t("قبل العميل ✓","Client accepté ✓")
                     : sos.status === "offered"   ? t("عرض أُرسل","Offre envoyée")
                     : sos.status === "cancelled" ? t("ملغي","Annulé")
                     : t("في الانتظار","En attente")}
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="font-black text-sm" style={{ color: "#1A4D1F" }}>{sos.customerName}</p>
                    <p className="text-xs flex items-center gap-1 opacity-50" style={{ color: "#1A4D1F" }}><Phone size={10} />{sos.customerPhone}</p>
                    <p className="text-xs flex items-center gap-1 mt-1 opacity-50" style={{ color: "#1A4D1F" }}><MapPin size={10} />{sos.lat.toFixed(4)}, {sos.lng.toFixed(4)}</p>
                    {sos.description && <p className="text-xs mt-2 p-2 rounded-lg opacity-70" style={{ color: "#1A4D1F", background: "#FFF3E0" }}>{sos.description}</p>}
                    {/* ── اقتراح سعر (pending فقط) ── */}
                    {sos.status === "pending" && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-black opacity-50" style={{ color: "#1A4D1F" }}>
                          {t("اقترح المبلغ (TND)", "Proposer un prix (TND)")}
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="number" inputMode="decimal" min="0" step="0.001"
                            value={sosOfferPrices[sos.id] || ""}
                            onChange={e => setSosOfferPrices(prev => ({ ...prev, [sos.id]: e.target.value }))}
                            placeholder={t("مثال: 25.000", "Ex: 25.000")}
                            className="flex-1 rounded-xl px-3 py-2.5 text-sm font-bold border outline-none"
                            style={{ background: "#FFF3E0", color: "#1A4D1F", borderColor: "#EF444444" }}
                          />
                          <button
                            onClick={() => offerSos(sos.id, selected)}
                            disabled={sosOffering[sos.id] || !sosOfferPrices[sos.id]}
                            className="px-4 py-2.5 rounded-xl font-black text-sm flex items-center gap-1.5 disabled:opacity-40 transition-all active:scale-95"
                            style={{ background: "#EF4444", color: "#fff" }}>
                            {sosOffering[sos.id]
                              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              : <Check size={14} />}
                            {t("إرسال", "Envoyer")}
                          </button>
                        </div>
                      </div>
                    )}
                    {/* ── في انتظار رد العميل (offered) ── */}
                    {sos.status === "offered" && mine && (
                      <div className="mt-3 rounded-xl p-3 text-center" style={{ background: "#DBEAFE" }}>
                        <p className="text-xs font-black text-blue-700">
                          {t("في انتظار موافقة العميل", "En attente de la réponse du client")}
                        </p>
                        {sos.offeredPrice && (
                          <p className="text-base font-black text-blue-900 mt-0.5">{Number(sos.offeredPrice).toFixed(3)} TND</p>
                        )}
                      </div>
                    )}
                    {/* ── تم القبول ── */}
                    {mine && sos.status === "accepted" && (
                      <div className="mt-2 rounded-xl p-2.5 text-center text-xs font-black text-emerald-600" style={{ background: "#D1FAE5" }}>
                        {t("قبل العميل العرض · الشاحنة في الطريق", "Client a accepté · En route !")}
                        {sos.offeredPrice && <span className="ms-2">{Number(sos.offeredPrice).toFixed(3)} TND</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Lawyer Requests */}
        {tab === "lawyer" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black opacity-50" style={{ color: "#1A4D1F" }}>{t("طلبات الاستشارة القانونية", "Demandes de consultation")}</p>
              <button onClick={() => loadLawyerRequests(selected)} className="p-1.5 rounded-lg" style={{ background: "#1A4D1F22" }}>
                <RefreshCw size={12} style={{ color: "#1A4D1F" }} />
              </button>
            </div>
            {lawyerLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 rounded-full border-2 border-[#1A4D1F]/20 border-t-[#1A4D1F] animate-spin" />
              </div>
            ) : lawyerRequests.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-2 opacity-30">
                <Scale size={32} style={{ color: "#1A4D1F" }} />
                <p className="text-sm font-bold" style={{ color: "#1A4D1F" }}>{t("لا توجد طلبات بعد", "Aucune demande pour l'instant")}</p>
              </div>
            ) : lawyerRequests.map(req => {
              const CASE_LABELS: Record<string, { ar: string; fr: string }> = {
                criminal:       { ar: "جنائي",  fr: "Pénal" },
                civil:          { ar: "مدني",   fr: "Civil" },
                administrative: { ar: "إداري",  fr: "Administratif" },
                commercial:     { ar: "تجاري",  fr: "Commercial" },
                family:         { ar: "أسري",   fr: "Familial" },
                real_estate:    { ar: "عقاري",  fr: "Immobilier" },
                other:          { ar: "أخرى",   fr: "Autre" },
              };
              const STATUS_LAWYER: Record<string, { ar: string; fr: string; bg: string; color: string }> = {
                pending:  { ar: "في الانتظار", fr: "En attente",  bg: "#FEF3C7", color: "#92400E" },
                accepted: { ar: "مقبول",       fr: "Accepté",     bg: "#D1FAE5", color: "#059669" },
                rejected: { ar: "مرفوض",       fr: "Refusé",      bg: "#FEE2E2", color: "#DC2626" },
              };
              const ct = CASE_LABELS[req.caseType] || CASE_LABELS.other;
              const st = STATUS_LAWYER[req.status] || STATUS_LAWYER.pending;
              const reqPhotos = (() => { try { return JSON.parse(req.photos || "[]"); } catch { return []; } })();
              return (
                <div key={req.id} className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid #1A4D1F11" }}>
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#1A4D1F08" }}>
                    <div className="flex items-center gap-2">
                      <Scale size={11} style={{ color: "#1A4D1F" }} />
                      <span className="text-xs font-black" style={{ color: "#1A4D1F" }}>
                        #{req.id.toString().padStart(4, "0")} · {lang === "ar" ? ct.ar : ct.fr}
                      </span>
                    </div>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>
                      {lang === "ar" ? st.ar : st.fr}
                    </span>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="font-black text-sm" style={{ color: "#1A4D1F" }}>{req.customerName}</p>
                    <p className="text-xs flex items-center gap-1 opacity-50" style={{ color: "#1A4D1F" }}>
                      <Phone size={10} />{req.customerPhone}
                    </p>
                    <p className="text-xs flex items-center gap-1 opacity-60" style={{ color: "#1A4D1F" }}>
                      <FileText size={10} />
                      {t("المحكمة:", "Tribunal:")} {req.court}
                    </p>
                    {req.notes && (
                      <p className="text-xs p-2.5 rounded-xl opacity-70" style={{ color: "#1A4D1F", background: "#FFF3E0" }}>
                        {req.notes}
                      </p>
                    )}
                    {reqPhotos.length > 0 && (
                      <div className="flex gap-2 flex-wrap pt-1">
                        {reqPhotos.map((url: string, i: number) => (
                          <button
                            key={i}
                            onClick={() => setPhotoModal(url)}
                            className="w-16 h-16 rounded-xl overflow-hidden border border-[#1A4D1F]/10"
                          >
                            <img src={url} alt="doc" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs opacity-30 flex items-center gap-1" style={{ color: "#1A4D1F" }}>
                      <Clock size={10} />{timeAgo(req.createdAt, lang)}
                    </p>
                    {req.status === "pending" && (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => updateLawyerRequest(req.id, "accepted")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-sm"
                          style={{ background: "#1A4D1F", color: "white" }}
                        >
                          <Check size={14} /> {t("قبول", "Accepter")}
                        </button>
                        <button
                          onClick={() => updateLawyerRequest(req.id, "rejected")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-sm"
                          style={{ background: "#FEE2E2", color: "#DC2626" }}
                        >
                          <X size={14} /> {t("رفض", "Refuser")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Orders */}
        {(tab === "pending" || tab === "all") && (loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-[3px] border-[#1A4D1F] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="text-center py-16">
            <Package size={40} className="text-[#1A4D1F]/10 mx-auto mb-3" />
            <p className="text-[#1A4D1F]/25 font-bold">
              {tab === "pending" ? t("لا توجد طلبات جديدة", "Aucune nouvelle commande") : t("لا توجد طلبات", "Aucune commande")}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="space-y-3">
              {displayOrders.map(order => {
                const s = STATUS[order.status] ?? STATUS.pending;
                return (
                  <motion.div key={order.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} layout
                    className={cn("rounded-[15px] border overflow-hidden",
                      order.status === "pending" ? "border-amber-400/25" : "border-[#1A4D1F]/30")}
                    style={{ background: "#FFFDE7" }}>

                    {/* Order header */}
                    <div className={cn("px-4 py-2 flex items-center justify-between border-b border-[#1A4D1F]/20",
                      order.status === "pending" ? "bg-amber-400/5" : "")}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[#1A4D1F]/25">#{order.id.toString().padStart(4, "0")}</span>
                        <span className="text-xs text-[#1A4D1F]/20">{timeAgo(order.createdAt, lang)}</span>
                      </div>
                      <span className={cn("text-xs px-2.5 py-1 rounded-full border font-black", s.color)}>
                        {lang === "ar" ? s.ar : s.fr}
                      </span>
                    </div>

                    {/* Order body */}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-[#1A4D1F]">{order.customerName}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <MapPin size={10} className="text-[#1A4D1F]/40 flex-shrink-0" />
                            <p className="text-sm text-[#1A4D1F]/40 truncate">{order.customerAddress}</p>
                          </div>
                          {order.deliveryFee && order.deliveryFee > 0 && (
                            <p className="text-sm text-[#1A4D1F] font-bold mt-1">{t("رسوم التوصيل", "Livraison")}: {order.deliveryFee} TND</p>
                          )}

                          {/* ── قائمة المنتجات المطلوبة ── */}
                          {orderItemsMap[order.id] && orderItemsMap[order.id].length > 0 && (
                            <div className="mt-3 rounded-xl border border-[#1A4D1F]/20 overflow-hidden">
                              <div className="px-3 py-1.5 flex items-center gap-2" style={{ background: "#1A4D1F", borderRadius: "0" }}>
                                <Package size={12} className="text-[#FFA500]" />
                                <span className="text-xs font-black text-[#FFA500]">
                                  {t("المنتجات المطلوبة", "Articles commandés")} ({orderItemsMap[order.id].reduce((s, i) => s + i.qty, 0)})
                                </span>
                              </div>
                              <div className="divide-y divide-[#1A4D1F]/8">
                                {orderItemsMap[order.id].map(item => (
                                  <div key={item.id} className="flex items-center justify-between px-3 py-2" style={{ background: "#FFFDE7" }}>
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                                        style={{ background: "#1A4D1F" }}>
                                        {item.qty}
                                      </span>
                                      <span className="text-sm font-bold text-[#1A4D1F] truncate">
                                        {lang === "ar" ? item.nameAr : (item.nameFr || item.nameAr)}
                                      </span>
                                    </div>
                                    <span className="text-sm font-black text-[#FFA500] flex-shrink-0 ml-2">
                                      {item.subtotal.toFixed(2)} <span className="text-[10px] font-normal opacity-60">TND</span>
                                    </span>
                                  </div>
                                ))}
                                <div className="flex items-center justify-between px-3 py-2" style={{ background: "rgba(26,77,31,0.06)" }}>
                                  <span className="text-xs font-black text-[#1A4D1F]/60">{t("المجموع", "Total")}</span>
                                  <span className="text-sm font-black text-[#1A4D1F]">
                                    {orderItemsMap[order.id].reduce((s, i) => s + i.subtotal, 0).toFixed(2)} TND
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {order.notes && (
                            <p className="text-xs text-[#1A4D1F]/30 mt-2 p-2 rounded-lg border border-[#1A4D1F]/5" style={{ background: "#D4A800" }}>{order.notes}</p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          {order.customerPhone && (
                            <button onClick={() => openWhatsApp(order.customerPhone)}
                              className="p-2.5 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all" title="WhatsApp">
                              <MessageCircle size={14} />
                            </button>
                          )}
                          {order.photoUrl && (
                            <button onClick={() => setPhotoModal(order.photoUrl!)}
                              className="p-2.5 rounded-xl bg-blue-400/10 text-blue-400 border border-blue-400/20 hover:bg-blue-400/20 transition-all" title={t("وصفة طبية", "Ordonnance")}>
                              <ImageIcon size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      {(order.status === "pending" || order.status === "searching_for_driver") && (
                        <div className="flex gap-2">
                          <button onClick={() => updateStatus(order.id, "accepted")}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black text-sm hover:bg-emerald-500/20 transition-all">
                            <Check size={14} />{t("قبول الطلب ✓", "Accepter ✓")}
                          </button>
                          <button onClick={() => updateStatus(order.id, "cancelled")}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-black text-sm hover:bg-red-500/20 transition-all">
                            <X size={14} />{t("رفض", "Refuser")}
                          </button>
                        </div>
                      )}
                      {order.status === "accepted" && (
                        <button onClick={() => updateStatus(order.id, "prepared")}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1A4D1F]/10 border border-[#1A4D1F]/30 font-black text-sm hover:bg-[#1A4D1F]/20 transition-all"
                          style={{ color: "#1A4D1F" }}>
                          <Truck size={15} />
                          {t("جاهز للتوصيل ✓", "Prêt pour livraison ✓")}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        ))}

        {/* ── Chat Panel (مراسلة الإدارة) ─────────────────────────── */}
        {tab === "chat" && selected && (
          <div style={{ display: "flex", flexDirection: "column", height: 460, background: "#fff", borderRadius: 16, border: "1px solid #1A4D1F12", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#1A4D1F", flexShrink: 0 }}>
              <MessageCircle size={15} color="#FFA500" />
              <div>
                <p style={{ color: "#fff", fontWeight: 800, fontSize: 12, margin: 0 }}>{t("مراسلة الإدارة", "Contacter l'admin")}</p>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, margin: 0 }}>{t("يُحدَّث كل ٢٠ ث", "Actualisation auto. 20s")}</p>
              </div>
              <button
                onClick={() => loadChatMessages(selected.id)}
                style={{ marginInlineStart: "auto", background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer" }}
              >
                <RefreshCw size={12} color="rgba(255,255,255,0.7)" />
              </button>
            </div>

            {/* Messages area */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              {chatMessages.length === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.3, gap: 8, minHeight: 200 }}>
                  <MessageCircle size={36} color="#1A4D1F" />
                  <p style={{ fontSize: 12, color: "#1A4D1F", fontWeight: 700 }}>{t("لا توجد رسائل بعد", "Aucun message pour l'instant")}</p>
                </div>
              ) : chatMessages.map((msg: any) => {
                const isVendor = msg.senderRole === "vendor";
                return (
                  <div key={msg.id} style={{ display: "flex", justifyContent: isVendor ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "78%", padding: "8px 12px",
                      borderRadius: isVendor ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                      background: isVendor ? "#1A4D1F" : "#f3f4f6",
                      color: isVendor ? "#fff" : "#111",
                    }}>
                      {!isVendor && (
                        <p style={{ fontSize: 9, fontWeight: 800, color: "#FFA500", marginBottom: 3 }}>{t("الإدارة", "Admin")}</p>
                      )}
                      <p style={{ fontSize: 13, margin: 0, lineHeight: 1.4, fontFamily: "'Cairo','Tajawal',sans-serif", wordBreak: "break-word" }}>{msg.body}</p>
                      <p style={{ fontSize: 9, opacity: 0.55, marginTop: 3, textAlign: isVendor ? "right" : "left" }}>
                        {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("fr-TN", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>

            {/* Input */}
            <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderTop: "1px solid #f3f4f6", background: "#fff", flexShrink: 0 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(selected.id); } }}
                placeholder={t("اكتب رسالة...", "Écrire un message...")}
                style={{
                  flex: 1, border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "8px 12px",
                  fontSize: 13, fontFamily: "'Cairo','Tajawal',sans-serif", outline: "none",
                  background: "#fafafa",
                }}
                dir={lang === "ar" ? "rtl" : "ltr"}
              />
              <button
                onClick={() => sendChatMessage(selected.id)}
                disabled={!chatInput.trim() || chatSending}
                style={{
                  background: "#FFA500", border: "none", borderRadius: 10,
                  padding: "8px 14px", cursor: "pointer", fontWeight: 800, fontSize: 12,
                  color: "#fff", opacity: (!chatInput.trim() || chatSending) ? 0.4 : 1, flexShrink: 0,
                  fontFamily: "'Cairo','Tajawal',sans-serif",
                }}
              >
                {chatSending ? "..." : t("إرسال", "Envoyer")}
              </button>
            </div>
          </div>
        )}

        {/* ── Location Tab ─────────────────────────────────────────── */}
        {tab === "location" && selected && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
            dir="rtl"
          >
            {/* Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-[#1A4D1F]/8">
              <MapPin size={15} className="text-[#1A4D1F]" />
              <p className="text-sm font-black text-[#1A4D1F]">
                {t("موقع المحل على الخريطة", "Emplacement de la boutique")}
              </p>
            </div>

            {/* Current status card */}
            <div
              className="rounded-2xl p-4 border"
              style={{
                background: (selected.latitude && selected.longitude) ? "#f0fdf4" : "#fff8e1",
                borderColor: (selected.latitude && selected.longitude) ? "rgba(26,77,31,0.15)" : "#FFA500",
              }}
            >
              {selected.latitude && selected.longitude ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                    <p className="text-sm font-black text-[#1A4D1F]">
                      {t("✓ تم تثبيت موقع المحل", "✓ Position enregistrée")}
                    </p>
                  </div>
                  {selected.address && (
                    <p className="text-xs font-bold text-[#1A4D1F]/60 leading-snug pe-4">
                      {selected.address}
                    </p>
                  )}
                  <p className="text-[10px] font-mono text-[#1A4D1F]/40">
                    {Number(selected.latitude).toFixed(6)}, {Number(selected.longitude).toFixed(6)}
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} className="text-[#FFA500] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-black" style={{ color: "#92400e" }}>
                      {t("موقع المحل غير محدد بعد", "Position non définie")}
                    </p>
                    <p className="text-[10px] font-bold opacity-60" style={{ color: "#92400e" }}>
                      {t(
                        "يجب تحديد الموقع حتى تظهر في نتائج البحث ويستطيع التطبيق حساب مسافة التوصيل",
                        "Définissez votre position pour apparaître dans les résultats et calculer les frais de livraison",
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Success banner */}
            <AnimatePresence>
              {locSaved && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                  style={{ background: "#d1fae5", color: "#065f46" }}
                >
                  <CheckCircle2 size={14} />
                  <span className="text-xs font-black">
                    {t("تم حفظ موقع المحل بنجاح ✓", "Emplacement sauvegardé avec succès ✓")}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            {locErr && (
              <p className="text-xs font-bold text-red-500 px-1">{locErr}</p>
            )}

            {/* Open Map button */}
            <button
              onClick={() => { setLocErr(""); setShowVendorMap(true); }}
              disabled={locSaving}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-black text-base text-white active:scale-95 transition-all"
              style={{ background: "linear-gradient(135deg, #1A4D1F, #2E7D32)" }}
            >
              {locSaving
                ? <><Loader2 size={18} className="animate-spin" />{t("جارٍ الحفظ...","Enregistrement...")}</>
                : <><LocateFixed size={18} />{selected.latitude
                    ? t("تعديل موقع المحل على الخريطة", "Modifier l'emplacement sur la carte")
                    : t("تثبيت موقع المحل على الخريطة", "Épingler la boutique sur la carte")
                  }</>}
            </button>

            <p className="text-center text-[10px] font-bold text-[#1A4D1F]/30">
              {t(
                "سيتم رصد موقعك بواسطة GPS تلقائياً عند فتح الخريطة، يمكنك تعديله بالسحب",
                "Votre GPS sera utilisé automatiquement — ajustez en glissant l'épingle",
              )}
            </p>
          </motion.div>
        )}

      </div>

      {/* ── Vendor Map Picker Modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {showVendorMap && selected && (
          <VendorMapPicker
            initialLat={selected.latitude}
            initialLng={selected.longitude}
            onConfirm={saveLocation}
            onClose={() => setShowVendorMap(false)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
