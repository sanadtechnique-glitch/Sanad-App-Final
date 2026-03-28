import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Package, Tag, Users, ShoppingBag,
  Truck, Map, Megaphone, RefreshCw, Plus, Pencil, Trash2,
  X, Check, Clock, CheckCircle, AlertCircle, Star,
  ChevronRight, Power, MessageCircle, Moon, Sun, Hotel, Car,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/language";
import { get, post, patch, del } from "@/lib/admin-api";
import { format } from "date-fns";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
type OrderStatus = "pending" | "accepted" | "in_delivery" | "delivered" | "cancelled" | "confirmed" | "in_progress";

interface Order {
  id: number; customerName: string; customerPhone?: string;
  customerAddress: string; serviceProviderName: string; serviceType: string;
  status: OrderStatus; deliveryFee?: number; deliveryStaffId?: number;
  createdAt: string; notes?: string; delegationId?: number;
}
interface Category { id: number; slug: string; nameAr: string; nameFr: string; descriptionAr: string; descriptionFr: string; icon: string; color: string; }
interface Supplier { id: number; name: string; nameAr: string; category: string; description: string; descriptionAr: string; address: string; phone?: string; photoUrl?: string; shift?: string; rating?: number; isAvailable: boolean; }
interface Article { id: number; supplierId: number; nameAr: string; nameFr: string; descriptionAr: string; descriptionFr: string; price: number; originalPrice?: number; discountedPrice?: number; isAvailable: boolean; supplierName?: string; }
interface DeliveryStaff { id: number; name: string; nameAr: string; phone: string; zone?: string; isAvailable: boolean; }
interface Delegation { id: number; name: string; nameAr: string; deliveryFee: number; }
interface PromoBanner { id: number; titleAr: string; titleFr: string; imageUrl?: string; link?: string; bgColor?: string; isActive: boolean; startsAt?: string; endsAt?: string; }

// ──────────────────────────────────────────────────────────────────────────────
// Status config
// ──────────────────────────────────────────────────────────────────────────────
const STATUS: Record<string, { ar: string; fr: string; color: string; icon: React.FC<any> }> = {
  pending:     { ar: "قيد الانتظار", fr: "En attente",   color: "text-amber-400 bg-amber-400/10 border-amber-400/30",   icon: Clock },
  accepted:    { ar: "مقبول",        fr: "Accepté",       color: "text-blue-400 bg-blue-400/10 border-blue-400/30",       icon: CheckCircle },
  in_delivery: { ar: "في التوصيل",  fr: "En livraison",  color: "text-purple-400 bg-purple-400/10 border-purple-400/30", icon: Truck },
  delivered:   { ar: "تم التوصيل",  fr: "Livré",         color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30", icon: Check },
  cancelled:   { ar: "ملغي",        fr: "Annulé",        color: "text-red-400 bg-red-400/10 border-red-400/30",           icon: X },
  confirmed:   { ar: "مؤكد",        fr: "Confirmé",      color: "text-blue-400 bg-blue-400/10 border-blue-400/30",       icon: CheckCircle },
  in_progress: { ar: "جاري",        fr: "En cours",      color: "text-purple-400 bg-purple-400/10 border-purple-400/30", icon: Truck },
};

const CATEGORY_LABELS: Record<string, { ar: string; fr: string }> = {
  restaurant: { ar: "مطاعم", fr: "Restaurants" },
  pharmacy:   { ar: "صيدلية", fr: "Pharmacie" },
  lawyer:     { ar: "محامي", fr: "Avocat" },
  grocery:    { ar: "بقالة", fr: "Épicerie" },
  mechanic:   { ar: "ميكانيكي", fr: "Mécanicien" },
  doctor:     { ar: "طبيب", fr: "Médecin" },
  car:        { ar: "سيارات", fr: "Voitures" },
  hotel:      { ar: "فنادق", fr: "Hôtels" },
};

// ──────────────────────────────────────────────────────────────────────────────
// Reusable mini-components
// ──────────────────────────────────────────────────────────────────────────────
function GoldBtn({ onClick, children, variant = "primary", disabled, className }: {
  onClick?: () => void; children: React.ReactNode; variant?: "primary" | "ghost" | "danger";
  disabled?: boolean; className?: string;
}) {
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-40";
  const v = {
    primary: "bg-[#D4AF37] text-black hover:bg-[#C09B28]",
    ghost: "border border-white/20 text-white/70 hover:text-white hover:border-white/40 bg-transparent",
    danger: "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30",
  };
  return <button onClick={onClick} disabled={disabled} className={cn(base, v[variant], className)}>{children}</button>;
}

function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xl bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="font-bold text-white text-lg">{title}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X size={20} /></button>
        </div>
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto space-y-4">{children}</div>
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-white/50 mb-1 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: {
  value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#D4AF37]/50 transition-colors" />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]/50 transition-colors">
      {options.map(o => <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>)}
    </select>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string; }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div onClick={() => onChange(!checked)} className={cn("w-11 h-6 rounded-full relative transition-colors duration-300 cursor-pointer", checked ? "bg-[#D4AF37]" : "bg-white/10")}>
        <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300", checked ? "left-6" : "left-1")} />
      </div>
      {label && <span className="text-sm text-white/60">{label}</span>}
    </label>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="glass-panel rounded-2xl p-5">
      <p className="text-xs text-white/40 mb-1 font-bold uppercase tracking-wider">{label}</p>
      <p className={cn("text-3xl font-black", color)}>{value}</p>
    </div>
  );
}

function Stars({ rating }: { rating?: number | null }) {
  const r = rating ?? 0;
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => <Star key={i} size={12} className={i <= r ? "text-[#D4AF37] fill-[#D4AF37]" : "text-white/20"} />)}
      <span className="ml-1 text-xs text-white/40">{r.toFixed(1)}</span>
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Overview
// ──────────────────────────────────────────────────────────────────────────────
function OverviewSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    get<Order[]>("/orders").then(setOrders).catch(() => {});
    get<Supplier[]>("/admin/suppliers").then(setSuppliers).catch(() => {});
  }, []);

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "pending").length,
    inDelivery: orders.filter(o => o.status === "in_delivery").length,
    delivered: orders.filter(o => o.status === "delivered").length,
    activeSuppliers: suppliers.filter(s => s.isAvailable).length,
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-white">{t("نظرة عامة", "Vue d'ensemble")}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t("إجمالي الطلبات", "Total commandes")} value={stats.total} color="text-white" />
        <StatCard label={t("قيد الانتظار", "En attente")} value={stats.pending} color="text-amber-400" />
        <StatCard label={t("في التوصيل", "En livraison")} value={stats.inDelivery} color="text-purple-400" />
        <StatCard label={t("تم التوصيل", "Livrés")} value={stats.delivered} color="text-emerald-400" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="font-bold text-white/60 text-sm mb-4 uppercase tracking-wider">{t("آخر الطلبات", "Dernières commandes")}</h3>
          <div className="space-y-2">
            {orders.slice(0, 5).map(o => {
              const s = STATUS[o.status];
              const Icon = s?.icon ?? Clock;
              return (
                <div key={o.id} className="flex items-center gap-3 py-2 border-b border-white/5">
                  <span className="text-xs text-white/30 font-mono">#{o.id.toString().padStart(4,"0")}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{o.customerName}</p>
                    <p className="text-xs text-white/40">{o.serviceProviderName}</p>
                  </div>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border", s?.color)}>
                    <Icon size={10} />{t(s?.ar, s?.fr)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <h3 className="font-bold text-white/60 text-sm mb-4 uppercase tracking-wider">{t("المزودون النشطون", "Prestataires actifs")}</h3>
          <div className="space-y-2">
            {suppliers.filter(s => s.isAvailable).slice(0,5).map(s => (
              <div key={s.id} className="flex items-center gap-3 py-2 border-b border-white/5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{s.nameAr}</p>
                  <p className="text-xs text-white/40">{CATEGORY_LABELS[s.category]?.ar}</p>
                </div>
                <Stars rating={s.rating} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Orders
// ──────────────────────────────────────────────────────────────────────────────
function OrdersSection({ t, lang }: { t: (ar: string, fr: string) => string; lang: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [staff, setStaff] = useState<DeliveryStaff[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, s] = await Promise.all([
      get<Order[]>("/orders").catch(() => []),
      get<DeliveryStaff[]>("/admin/delivery-staff").catch(() => []),
    ]);
    setOrders(o); setStaff(s); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => filter === "all" || o.status === filter);

  const updateStatus = async (id: number, status: string) => {
    await patch(`/orders/${id}`, { status });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: status as OrderStatus } : o));
  };

  const assignStaff = async (id: number, staffId: string) => {
    await patch(`/orders/${id}`, { deliveryStaffId: staffId || null, status: staffId ? "in_delivery" : undefined });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, deliveryStaffId: staffId ? parseInt(staffId) : undefined } : o));
  };

  const whatsapp = (phone?: string, name?: string, id?: number) => {
    if (!phone) return;
    const msg = encodeURIComponent(`مرحباً ${name}، طلبك رقم #${id} جاهز للتوصيل 🛵`);
    window.open(`https://wa.me/${phone.replace(/\D/g,"")}?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h2 className="text-2xl font-black text-white">{t("الطلبات", "Commandes")}</h2>
        <div className="flex items-center gap-2">
          <GoldBtn onClick={load} variant="ghost"><RefreshCw size={14} /></GoldBtn>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {["all", ...Object.keys(STATUS)].slice(0, 7).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
              filter === s ? "bg-[#D4AF37] text-black border-[#D4AF37]" : "border-white/10 text-white/40 hover:border-white/30")}>
            {s === "all" ? t("الكل","Tous") : t(STATUS[s]?.ar, STATUS[s]?.fr)}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && <p className="text-center text-white/30 py-16">{t("لا توجد طلبات","Aucune commande")}</p>}
          {filtered.map(order => {
            const s = STATUS[order.status];
            const Icon = s?.icon ?? Clock;
            return (
              <motion.div key={order.id} layout className="glass-panel rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs text-white/30 block">#{order.id.toString().padStart(5,"0")}</span>
                    <p className="font-bold text-white">{order.customerName}</p>
                    {order.customerPhone && (
                      <span className="text-xs text-white/40">{order.customerPhone}</span>
                    )}
                    <p className="text-xs text-white/30 mt-0.5">{order.customerAddress}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border", s?.color)}>
                      <Icon size={12} /> {t(s?.ar, s?.fr)}
                    </span>
                    {order.customerPhone && (
                      <button onClick={() => whatsapp(order.customerPhone, order.customerName, order.id)}
                        className="p-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors">
                        <MessageCircle size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#D4AF37] font-bold">{order.serviceProviderName}</p>
                    <p className="text-xs text-white/30">{order.serviceType} {order.deliveryFee ? `· ${order.deliveryFee} TND` : ""}</p>
                  </div>
                  <select value={order.status} onChange={e => updateStatus(order.id, e.target.value)}
                    className="bg-black/50 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#D4AF37]/50">
                    {Object.entries(STATUS).slice(0,5).map(([v, c]) => (
                      <option key={v} value={v} className="bg-zinc-900">{t(c.ar, c.fr)}</option>
                    ))}
                  </select>
                  <select value={order.deliveryStaffId?.toString() || ""} onChange={e => assignStaff(order.id, e.target.value)}
                    className="bg-black/50 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#D4AF37]/50">
                    <option value="" className="bg-zinc-900">{t("اختر سائق","Choisir livreur")}</option>
                    {staff.map(s => <option key={s.id} value={s.id} className="bg-zinc-900">{s.nameAr}</option>)}
                  </select>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Categories
// ──────────────────────────────────────────────────────────────────────────────
function CategoriesSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [items, setItems] = useState<Category[]>([]);
  const [modal, setModal] = useState<null | "add" | Category>(null);
  const [form, setForm] = useState({ slug: "", nameAr: "", nameFr: "", descriptionAr: "", descriptionFr: "", icon: "grid", color: "amber" });

  const load = () => get<Category[]>("/admin/categories").then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ slug:"",nameAr:"",nameFr:"",descriptionAr:"",descriptionFr:"",icon:"grid",color:"amber" }); setModal("add"); };
  const openEdit = (c: Category) => { setForm({ slug: c.slug, nameAr: c.nameAr, nameFr: c.nameFr, descriptionAr: c.descriptionAr, descriptionFr: c.descriptionFr, icon: c.icon, color: c.color }); setModal(c); };

  const save = async () => {
    if (modal === "add") await post("/admin/categories", form);
    else await patch(`/admin/categories/${(modal as Category).id}`, form);
    setModal(null); load();
  };

  const remove = async (id: number) => {
    if (!confirm(t("هل تريد الحذف؟","Confirmer la suppression ?"))) return;
    await del(`/admin/categories/${id}`); load();
  };

  const colors = ["amber","orange","emerald","blue","rose","purple","zinc"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white">{t("الفئات","Catégories")}</h2>
        <GoldBtn onClick={openAdd}><Plus size={14} />{t("إضافة فئة","Ajouter")}</GoldBtn>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(c => (
          <div key={c.id} className="glass-panel rounded-2xl p-4 flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-white">{c.nameAr}</p>
              <p className="text-sm text-white/40">{c.nameFr}</p>
              <p className="text-xs text-white/20 mt-1 font-mono">{c.slug}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(c)} className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-[#D4AF37] transition-colors"><Pencil size={14} /></button>
              <button onClick={() => remove(c.id)} className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? t("إضافة فئة","Ajouter catégorie") : t("تعديل فئة","Modifier catégorie")}>
        <Field label="Slug (unique)"><Input value={form.slug} onChange={v => setForm(f => ({...f, slug: v}))} placeholder="restaurant" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("الاسم بالعربية","Nom arabe")}><Input value={form.nameAr} onChange={v => setForm(f => ({...f, nameAr: v}))} placeholder="مطاعم" /></Field>
          <Field label={t("الاسم بالفرنسية","Nom français")}><Input value={form.nameFr} onChange={v => setForm(f => ({...f, nameFr: v}))} placeholder="Restaurants" /></Field>
        </div>
        <Field label={t("الوصف عربي","Description arabe")}><Input value={form.descriptionAr} onChange={v => setForm(f => ({...f, descriptionAr: v}))} /></Field>
        <Field label={t("الوصف فرنسي","Description française")}><Input value={form.descriptionFr} onChange={v => setForm(f => ({...f, descriptionFr: v}))} /></Field>
        <Field label={t("اللون","Couleur")}>
          <div className="flex gap-2 flex-wrap">
            {colors.map(c => (
              <button key={c} onClick={() => setForm(f => ({...f, color: c}))}
                className={cn("w-8 h-8 rounded-lg border-2 transition-all", form.color === c ? "border-[#D4AF37] scale-110" : "border-transparent opacity-60")}
                style={{ background: `var(--color-${c}-500, #888)` }} />
            ))}
          </div>
        </Field>
        <GoldBtn onClick={save} className="w-full justify-center">{t("حفظ","Enregistrer")}</GoldBtn>
      </Modal>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Suppliers
// ──────────────────────────────────────────────────────────────────────────────
function SuppliersSection({ t, lang }: { t: (ar: string, fr: string) => string; lang: string }) {
  const [items, setItems] = useState<Supplier[]>([]);
  const [modal, setModal] = useState<null | "add" | Supplier>(null);
  const [form, setForm] = useState({ name:"", nameAr:"", category:"restaurant", description:"", descriptionAr:"", address:"", phone:"", shift:"all", isAvailable: true });

  const load = () => get<Supplier[]>("/admin/suppliers").then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ name:"",nameAr:"",category:"restaurant",description:"",descriptionAr:"",address:"",phone:"",shift:"all",isAvailable:true }); setModal("add"); };
  const openEdit = (s: Supplier) => { setForm({ name:s.name, nameAr:s.nameAr, category:s.category, description:s.description, descriptionAr:s.descriptionAr, address:s.address, phone:s.phone||"", shift:s.shift||"all", isAvailable:s.isAvailable }); setModal(s); };

  const save = async () => {
    if (modal === "add") await post("/admin/suppliers", form);
    else await patch(`/admin/suppliers/${(modal as Supplier).id}`, form);
    setModal(null); load();
  };

  const toggle = async (id: number) => {
    await patch(`/admin/suppliers/${id}/toggle`, {});
    setItems(prev => prev.map(s => s.id === id ? {...s, isAvailable: !s.isAvailable} : s));
  };

  const remove = async (id: number) => {
    if (!confirm(t("هل تريد الحذف؟","Confirmer ?"))) return;
    await del(`/admin/suppliers/${id}`); load();
  };

  const catOptions = Object.entries(CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: lang === "ar" ? l.ar : l.fr }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white">{t("المزودون","Fournisseurs")}</h2>
        <GoldBtn onClick={openAdd}><Plus size={14} />{t("إضافة","Ajouter")}</GoldBtn>
      </div>
      <div className="space-y-3">
        {items.map(s => (
          <div key={s.id} className="glass-panel rounded-2xl p-4">
            <div className="flex items-start gap-4 justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-white">{s.nameAr}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
                    {lang === "ar" ? CATEGORY_LABELS[s.category]?.ar : CATEGORY_LABELS[s.category]?.fr}
                  </span>
                  {s.category === "pharmacy" && (
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border",
                      s.shift === "day" ? "bg-amber-400/10 text-amber-400 border-amber-400/20" :
                      s.shift === "night" ? "bg-blue-400/10 text-blue-400 border-blue-400/20" :
                      "bg-white/5 text-white/40 border-white/10"
                    )}>
                      {s.shift === "day" ? <><Sun size={10} className="inline mr-1"/>{t("نهاري","Jour")}</> :
                       s.shift === "night" ? <><Moon size={10} className="inline mr-1"/>{t("ليلي","Nuit")}</> :
                       t("الكل","Tout")}
                    </span>
                  )}
                </div>
                <p className="text-sm text-white/40 truncate">{s.address}</p>
                {s.phone && <p className="text-xs text-white/30">{s.phone}</p>}
                <Stars rating={s.rating} />
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggle(s.id)}
                  className={cn("p-2 rounded-xl border transition-all", s.isAvailable ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20 hover:bg-emerald-400/20" : "bg-red-400/10 text-red-400 border-red-400/20 hover:bg-red-400/20")}>
                  <Power size={14} />
                </button>
                <button onClick={() => openEdit(s)} className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-[#D4AF37] transition-colors border border-white/5"><Pencil size={14} /></button>
                <button onClick={() => remove(s.id)} className="p-2 rounded-xl bg-white/5 text-white/40 hover:text-red-400 transition-colors border border-white/5"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? t("إضافة مزود","Ajouter fournisseur") : t("تعديل مزود","Modifier fournisseur")}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("الاسم عربي","Nom arabe")}><Input value={form.nameAr} onChange={v => setForm(f => ({...f, nameAr: v}))} placeholder="صيدلية الأمل" /></Field>
          <Field label={t("الاسم فرنسي","Nom français")}><Input value={form.name} onChange={v => setForm(f => ({...f, name: v}))} placeholder="Pharmacie Amal" /></Field>
        </div>
        <Field label={t("الفئة","Catégorie")}>
          <Select value={form.category} onChange={v => setForm(f => ({...f, category: v}))} options={catOptions} />
        </Field>
        {form.category === "pharmacy" && (
          <Field label={t("فترة العمل","Horaire")}>
            <Select value={form.shift} onChange={v => setForm(f => ({...f, shift: v}))} options={[
              { value: "all", label: t("كل اليوم","Toute la journée") },
              { value: "day", label: t("نهاري (06:00-22:00)","Jour (06:00-22:00)") },
              { value: "night", label: t("ليلي (22:00-06:00)","Nuit (22:00-06:00)") },
            ]} />
          </Field>
        )}
        <Field label={t("العنوان","Adresse")}><Input value={form.address} onChange={v => setForm(f => ({...f, address: v}))} /></Field>
        <Field label={t("رقم WhatsApp","Numéro WhatsApp")}><Input value={form.phone} onChange={v => setForm(f => ({...f, phone: v}))} placeholder="+21698..." /></Field>
        <Field label={t("الوصف عربي","Description arabe")}><Input value={form.descriptionAr} onChange={v => setForm(f => ({...f, descriptionAr: v}))} /></Field>
        <Field label={t("الوصف فرنسي","Description française")}><Input value={form.description} onChange={v => setForm(f => ({...f, description: v}))} /></Field>
        <Field label={t("متاح","Disponible")}><Toggle checked={form.isAvailable} onChange={v => setForm(f => ({...f, isAvailable: v}))} label={form.isAvailable ? t("نعم","Oui") : t("لا","Non")} /></Field>
        <GoldBtn onClick={save} className="w-full justify-center">{t("حفظ","Enregistrer")}</GoldBtn>
      </Modal>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Articles
// ──────────────────────────────────────────────────────────────────────────────
function ArticlesSection({ t, lang }: { t: (ar: string, fr: string) => string; lang: string }) {
  const [items, setItems] = useState<Article[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [modal, setModal] = useState<null | "add" | Article>(null);
  const [form, setForm] = useState({ supplierId: "", nameAr: "", nameFr: "", descriptionAr: "", descriptionFr: "", price: "0", originalPrice: "", discountedPrice: "", isAvailable: true });

  const load = async () => {
    const [a, s] = await Promise.all([
      get<Article[]>("/admin/articles").catch(() => []),
      get<Supplier[]>("/admin/suppliers").catch(() => []),
    ]);
    setItems(a); setSuppliers(s);
  };
  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm({ supplierId: suppliers[0]?.id?.toString()||"", nameAr:"",nameFr:"",descriptionAr:"",descriptionFr:"",price:"0",originalPrice:"",discountedPrice:"",isAvailable:true }); setModal("add"); };
  const openEdit = (a: Article) => {
    setForm({ supplierId: a.supplierId.toString(), nameAr:a.nameAr, nameFr:a.nameFr, descriptionAr:a.descriptionAr, descriptionFr:a.descriptionFr,
              price: a.price.toString(), originalPrice: a.originalPrice?.toString()||"", discountedPrice: a.discountedPrice?.toString()||"", isAvailable:a.isAvailable });
    setModal(a);
  };

  const save = async () => {
    const payload = { ...form, price: parseFloat(form.price)||0, originalPrice: form.originalPrice ? parseFloat(form.originalPrice) : null, discountedPrice: form.discountedPrice ? parseFloat(form.discountedPrice) : null };
    if (modal === "add") await post("/admin/articles", payload);
    else await patch(`/admin/articles/${(modal as Article).id}`, payload);
    setModal(null); load();
  };

  const remove = async (id: number) => {
    if (!confirm(t("هل تريد الحذف؟","Confirmer ?"))) return;
    await del(`/admin/articles/${id}`); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white">{t("المنتجات","Articles")}</h2>
        <GoldBtn onClick={openAdd}><Plus size={14} />{t("إضافة منتج","Ajouter")}</GoldBtn>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(a => (
          <div key={a.id} className="glass-panel rounded-2xl p-4">
            <div className="flex justify-between items-start mb-2">
              <p className="font-bold text-white">{lang === "ar" ? a.nameAr : a.nameFr}</p>
              <div className="flex gap-2">
                <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-[#D4AF37] transition-colors"><Pencil size={12} /></button>
                <button onClick={() => remove(a.id)} className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
              </div>
            </div>
            {a.supplierName && <p className="text-xs text-white/30 mb-2">{a.supplierName}</p>}
            <div className="flex items-center gap-2">
              {a.discountedPrice ? (
                <>
                  <span className="text-[#D4AF37] font-black">{a.discountedPrice} TND</span>
                  <span className="text-white/30 line-through text-xs">{a.originalPrice || a.price} TND</span>
                  <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full font-bold">
                    -{Math.round(((a.originalPrice || a.price) - a.discountedPrice) / (a.originalPrice || a.price) * 100)}%
                  </span>
                </>
              ) : (
                <span className="text-[#D4AF37] font-black">{a.price} TND</span>
              )}
              <span className={cn("ml-auto text-xs px-2 py-0.5 rounded-full border", a.isAvailable ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" : "text-red-400 border-red-400/30 bg-red-400/10")}>
                {a.isAvailable ? t("متاح","Dispo") : t("نفذ","Indispo")}
              </span>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? t("إضافة منتج","Ajouter article") : t("تعديل منتج","Modifier article")}>
        <Field label={t("المزود","Fournisseur")}>
          <Select value={form.supplierId} onChange={v => setForm(f => ({...f, supplierId: v}))} options={suppliers.map(s => ({ value: s.id.toString(), label: s.nameAr }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("الاسم عربي","Nom arabe")}><Input value={form.nameAr} onChange={v => setForm(f => ({...f, nameAr: v}))} /></Field>
          <Field label={t("الاسم فرنسي","Nom français")}><Input value={form.nameFr} onChange={v => setForm(f => ({...f, nameFr: v}))} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("السعر","Prix (TND)")}><Input type="number" value={form.price} onChange={v => setForm(f => ({...f, price: v}))} /></Field>
          <Field label={t("السعر الأصلي","Prix original")}><Input type="number" value={form.originalPrice} onChange={v => setForm(f => ({...f, originalPrice: v}))} placeholder="—" /></Field>
          <Field label={t("السعر المخفض","Prix réduit")}><Input type="number" value={form.discountedPrice} onChange={v => setForm(f => ({...f, discountedPrice: v}))} placeholder="—" /></Field>
        </div>
        <Field label={t("الوصف عربي","Description arabe")}><Input value={form.descriptionAr} onChange={v => setForm(f => ({...f, descriptionAr: v}))} /></Field>
        <Field label={t("الوصف فرنسي","Description française")}><Input value={form.descriptionFr} onChange={v => setForm(f => ({...f, descriptionFr: v}))} /></Field>
        <Field label={t("متاح","Disponible")}><Toggle checked={form.isAvailable} onChange={v => setForm(f => ({...f, isAvailable: v}))} label={form.isAvailable ? t("نعم","Oui") : t("لا","Non")} /></Field>
        <GoldBtn onClick={save} className="w-full justify-center">{t("حفظ","Enregistrer")}</GoldBtn>
      </Modal>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Delivery Staff
// ──────────────────────────────────────────────────────────────────────────────
function DeliveryStaffSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [items, setItems] = useState<DeliveryStaff[]>([]);
  const [modal, setModal] = useState<null | "add" | DeliveryStaff>(null);
  const [form, setForm] = useState({ name:"", nameAr:"", phone:"", zone:"", isAvailable: true });

  const load = () => get<DeliveryStaff[]>("/admin/delivery-staff").then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (modal === "add") await post("/admin/delivery-staff", form);
    else await patch(`/admin/delivery-staff/${(modal as DeliveryStaff).id}`, form);
    setModal(null); load();
  };

  const toggle = async (id: number, current: boolean) => {
    await patch(`/admin/delivery-staff/${id}`, { isAvailable: !current });
    setItems(prev => prev.map(s => s.id === id ? {...s, isAvailable: !current} : s));
  };

  const remove = async (id: number) => {
    if (!confirm(t("حذف؟","Supprimer ?"))) return;
    await del(`/admin/delivery-staff/${id}`); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white">{t("عمال التوصيل","Livreurs")}</h2>
        <GoldBtn onClick={() => { setForm({name:"",nameAr:"",phone:"",zone:"",isAvailable:true}); setModal("add"); }}><Plus size={14}/>{t("إضافة","Ajouter")}</GoldBtn>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(s => (
          <div key={s.id} className="glass-panel rounded-2xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-white">{s.nameAr}</p>
                <p className="text-xs text-white/40">{s.phone}</p>
                {s.zone && <p className="text-xs text-[#D4AF37]/60 mt-1">{s.zone}</p>}
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={() => toggle(s.id, s.isAvailable)}
                  className={cn("p-2 rounded-xl border transition-all", s.isAvailable ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" : "bg-red-400/10 text-red-400 border-red-400/20")}>
                  <Power size={14} />
                </button>
                <button onClick={() => { setForm({name:s.name,nameAr:s.nameAr,phone:s.phone,zone:s.zone||"",isAvailable:s.isAvailable}); setModal(s); }} className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-[#D4AF37] transition-colors"><Pencil size={14} /></button>
                <button onClick={() => remove(s.id)} className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? t("إضافة سائق","Ajouter livreur") : t("تعديل سائق","Modifier livreur")}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("الاسم عربي","Nom arabe")}><Input value={form.nameAr} onChange={v => setForm(f => ({...f, nameAr: v}))} placeholder="أحمد" /></Field>
          <Field label={t("الاسم فرنسي","Nom français")}><Input value={form.name} onChange={v => setForm(f => ({...f, name: v}))} placeholder="Ahmed" /></Field>
        </div>
        <Field label={t("رقم الهاتف (WhatsApp)","Téléphone (WhatsApp)")}><Input value={form.phone} onChange={v => setForm(f => ({...f, phone: v}))} placeholder="+21698..." /></Field>
        <Field label={t("المنطقة","Zone")}><Input value={form.zone} onChange={v => setForm(f => ({...f, zone: v}))} placeholder={t("بن قردان الوسط","Centre BG")} /></Field>
        <Field label={t("متاح","Disponible")}><Toggle checked={form.isAvailable} onChange={v => setForm(f => ({...f, isAvailable: v}))} /></Field>
        <GoldBtn onClick={save} className="w-full justify-center">{t("حفظ","Enregistrer")}</GoldBtn>
      </Modal>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Delegations
// ──────────────────────────────────────────────────────────────────────────────
function DelegationsSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [items, setItems] = useState<Delegation[]>([]);
  const [modal, setModal] = useState<null | "add" | Delegation>(null);
  const [form, setForm] = useState({ name: "", nameAr: "", deliveryFee: "0" });

  const load = () => get<Delegation[]>("/admin/delegations").then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    const payload = { ...form, deliveryFee: parseFloat(form.deliveryFee) || 0 };
    if (modal === "add") await post("/admin/delegations", payload);
    else await patch(`/admin/delegations/${(modal as Delegation).id}`, payload);
    setModal(null); load();
  };

  const remove = async (id: number) => {
    if (!confirm(t("حذف؟","Supprimer ?"))) return;
    await del(`/admin/delegations/${id}`); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white">{t("المعتمديات","Délégations")}</h2>
        <GoldBtn onClick={() => { setForm({name:"",nameAr:"",deliveryFee:"0"}); setModal("add"); }}><Plus size={14}/>{t("إضافة","Ajouter")}</GoldBtn>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(d => (
          <div key={d.id} className="glass-panel rounded-2xl p-4 flex justify-between items-center">
            <div>
              <p className="font-bold text-white">{d.nameAr}</p>
              <p className="text-sm text-white/40">{d.name}</p>
              <p className="text-[#D4AF37] font-black mt-1">{d.deliveryFee} TND</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setForm({name:d.name,nameAr:d.nameAr,deliveryFee:d.deliveryFee.toString()}); setModal(d); }} className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-[#D4AF37] transition-colors"><Pencil size={14}/></button>
              <button onClick={() => remove(d.id)} className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? t("إضافة معتمدية","Ajouter délégation") : t("تعديل","Modifier")}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("الاسم عربي","Nom arabe")}><Input value={form.nameAr} onChange={v => setForm(f => ({...f, nameAr: v}))} placeholder="بن قردان" /></Field>
          <Field label={t("الاسم فرنسي","Nom français")}><Input value={form.name} onChange={v => setForm(f => ({...f, name: v}))} placeholder="Ben Guerdane" /></Field>
        </div>
        <Field label={t("رسوم التوصيل (TND)","Frais de livraison (TND)")}><Input type="number" value={form.deliveryFee} onChange={v => setForm(f => ({...f, deliveryFee: v}))} /></Field>
        <GoldBtn onClick={save} className="w-full justify-center">{t("حفظ","Enregistrer")}</GoldBtn>
      </Modal>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Promo Banners
// ──────────────────────────────────────────────────────────────────────────────
function BannersSection({ t }: { t: (ar: string, fr: string) => string }) {
  const [items, setItems] = useState<PromoBanner[]>([]);
  const [modal, setModal] = useState<null | "add" | PromoBanner>(null);
  const [form, setForm] = useState({ titleAr:"", titleFr:"", imageUrl:"", link:"", bgColor:"#D4AF37", isActive:true, startsAt:"", endsAt:"" });

  const load = () => get<PromoBanner[]>("/admin/banners").then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (modal === "add") await post("/admin/banners", form);
    else await patch(`/admin/banners/${(modal as PromoBanner).id}`, form);
    setModal(null); load();
  };

  const toggleActive = async (id: number, current: boolean) => {
    await patch(`/admin/banners/${id}`, { isActive: !current });
    setItems(prev => prev.map(b => b.id === id ? {...b, isActive: !current} : b));
  };

  const remove = async (id: number) => {
    if (!confirm(t("حذف؟","Supprimer ?"))) return;
    await del(`/admin/banners/${id}`); load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white">{t("الإعلانات","Bannières Publicitaires")}</h2>
        <GoldBtn onClick={() => { setForm({titleAr:"",titleFr:"",imageUrl:"",link:"",bgColor:"#D4AF37",isActive:true,startsAt:"",endsAt:""}); setModal("add"); }}>
          <Plus size={14}/>{t("إضافة إعلان","Ajouter bannière")}
        </GoldBtn>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(b => (
          <div key={b.id} className="rounded-2xl overflow-hidden border border-white/10" style={{ background: b.bgColor + "20" }}>
            <div className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-black text-white text-lg">{b.titleAr}</p>
                  <p className="text-sm text-white/60">{b.titleFr}</p>
                  {b.link && <a href={b.link} target="_blank" className="text-xs text-[#D4AF37] mt-1 block truncate">{b.link}</a>}
                </div>
                <div className="flex gap-2 items-center">
                  <button onClick={() => toggleActive(b.id, b.isActive)}
                    className={cn("px-3 py-1 rounded-full text-xs font-bold border", b.isActive ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" : "bg-white/5 text-white/30 border-white/10")}>
                    {b.isActive ? t("نشط","Actif") : t("متوقف","Inactif")}
                  </button>
                  <button onClick={() => { setForm({titleAr:b.titleAr,titleFr:b.titleFr,imageUrl:b.imageUrl||"",link:b.link||"",bgColor:b.bgColor||"#D4AF37",isActive:b.isActive,startsAt:"",endsAt:""}); setModal(b); }} className="p-2 rounded-lg bg-white/10 text-white/40 hover:text-[#D4AF37]"><Pencil size={13}/></button>
                  <button onClick={() => remove(b.id)} className="p-2 rounded-lg bg-white/10 text-white/40 hover:text-red-400"><Trash2 size={13}/></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? t("إضافة إعلان","Ajouter bannière") : t("تعديل","Modifier")}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("العنوان عربي","Titre arabe")}><Input value={form.titleAr} onChange={v => setForm(f => ({...f, titleAr: v}))} placeholder="عرض خاص!" /></Field>
          <Field label={t("العنوان فرنسي","Titre français")}><Input value={form.titleFr} onChange={v => setForm(f => ({...f, titleFr: v}))} placeholder="Offre spéciale!" /></Field>
        </div>
        <Field label={t("رابط الصورة","URL de l'image")}><Input value={form.imageUrl} onChange={v => setForm(f => ({...f, imageUrl: v}))} placeholder="https://..." /></Field>
        <Field label={t("الرابط","Lien (optionnel)")}><Input value={form.link} onChange={v => setForm(f => ({...f, link: v}))} placeholder="https://..." /></Field>
        <Field label={t("لون الخلفية","Couleur de fond")}>
          <div className="flex items-center gap-3">
            <input type="color" value={form.bgColor} onChange={e => setForm(f => ({...f, bgColor: e.target.value}))} className="w-12 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer" />
            <Input value={form.bgColor} onChange={v => setForm(f => ({...f, bgColor: v}))} />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("تاريخ البداية","Date début")}><Input type="date" value={form.startsAt} onChange={v => setForm(f => ({...f, startsAt: v}))} /></Field>
          <Field label={t("تاريخ النهاية","Date fin")}><Input type="date" value={form.endsAt} onChange={v => setForm(f => ({...f, endsAt: v}))} /></Field>
        </div>
        <Field label={t("نشط","Actif")}><Toggle checked={form.isActive} onChange={v => setForm(f => ({...f, isActive: v}))} /></Field>
        <GoldBtn onClick={save} className="w-full justify-center">{t("حفظ","Enregistrer")}</GoldBtn>
      </Modal>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Section: Hotel Bookings
// ──────────────────────────────────────────────────────────────────────────────
interface HotelBooking {
  id: number; hotelId: number; customerName: string; customerPhone: string;
  checkIn: string; checkOut: string; guests: number; notes?: string;
  status: string; createdAt: string; hotelName?: string; hotelNameAr?: string;
}

const HB_STATUS: Record<string, { ar: string; fr: string; color: string }> = {
  pending:   { ar: "قيد الانتظار", fr: "En attente", color: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
  confirmed: { ar: "مؤكد",         fr: "Confirmé",   color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  cancelled: { ar: "ملغي",         fr: "Annulé",     color: "text-red-400 bg-red-400/10 border-red-400/30" },
};

function HotelBookingsSection({ t, lang }: { t: (a: string, f: string) => string; lang: string }) {
  const [bookings, setBookings] = useState<HotelBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = useCallback(() => {
    setLoading(true);
    get<HotelBooking[]>("/hotel-bookings").then(d => { setBookings(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    await patch(`/hotel-bookings/${id}`, { status });
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  };

  const filtered = filter === "all" ? bookings : bookings.filter(b => b.status === filter);

  const fmt = (d: string) => {
    try { return new Date(d).toLocaleDateString(lang === "ar" ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return d; }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-white">{t("حجوزات الفنادق", "Réservations Hôtel")}</h2>
          <p className="text-white/30 text-sm mt-0.5">{filtered.length} {t("حجز", "réservation(s)")}</p>
        </div>
        <GoldBtn onClick={load} variant="ghost"><RefreshCw size={14} /></GoldBtn>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {["all", "pending", "confirmed", "cancelled"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-xl text-xs font-black border transition-all",
              filter === f ? "bg-[#D4AF37] text-black border-[#D4AF37]" : "border-white/10 text-white/40 hover:text-white")}>
            {f === "all" ? t("الكل", "Tous") : (HB_STATUS[f]?.[lang === "ar" ? "ar" : "fr"] ?? f)}
            <span className="ml-1.5 opacity-60">{(f === "all" ? bookings : bookings.filter(b => b.status === f)).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-7 h-7 border-[3px] border-[#D4AF37] border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel rounded-2xl p-14 text-center">
          <Hotel size={40} className="text-white/10 mx-auto mb-3" />
          <p className="text-white/20 font-bold">{t("لا توجد حجوزات", "Aucune réservation")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => {
            const s = HB_STATUS[b.status] ?? HB_STATUS.pending;
            return (
              <div key={b.id} className="glass-panel rounded-2xl p-5 border border-white/5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-white/25">#{b.id.toString().padStart(4, "0")}</span>
                      <span className={cn("text-xs font-black px-2.5 py-0.5 rounded-full border", s.color)}>{lang === "ar" ? s.ar : s.fr}</span>
                    </div>
                    <p className="font-black text-white text-lg">{b.customerName}</p>
                    <p className="text-sm text-[#D4AF37]/60 font-bold">{lang === "ar" ? (b.hotelNameAr || b.hotelName) : (b.hotelName || b.hotelNameAr)}</p>
                    <p className="text-xs text-white/30 mt-0.5">{t("هاتف", "Tél")}: {b.customerPhone}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-white/30">{t("وصول", "Arrivée")}</div>
                    <div className="text-sm font-black text-white">{fmt(b.checkIn)}</div>
                    <div className="text-xs text-white/30 mt-1">{t("مغادرة", "Départ")}</div>
                    <div className="text-sm font-black text-white">{fmt(b.checkOut)}</div>
                    <div className="text-xs text-white/25 mt-1">{b.guests} {t("ضيف", "pers.")}</div>
                  </div>
                </div>
                {b.notes && <p className="text-xs text-white/30 mb-4 p-2.5 rounded-xl border border-white/5 bg-white/2">{b.notes}</p>}
                {b.status === "pending" && (
                  <div className="flex gap-2">
                    <GoldBtn onClick={() => updateStatus(b.id, "confirmed")} className="flex-1 justify-center">
                      <Check size={14} />{t("تأكيد", "Confirmer")}
                    </GoldBtn>
                    <GoldBtn onClick={() => updateStatus(b.id, "cancelled")} variant="danger" className="flex-1 justify-center">
                      <X size={14} />{t("إلغاء", "Annuler")}
                    </GoldBtn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Admin Page
// ──────────────────────────────────────────────────────────────────────────────
type Section = "overview" | "orders" | "categories" | "suppliers" | "articles" | "staff" | "delegations" | "banners" | "hotelBookings";

const NAV: { id: Section; icon: React.FC<any>; ar: string; fr: string }[] = [
  { id: "overview",      icon: LayoutDashboard, ar: "نظرة عامة",    fr: "Tableau de bord" },
  { id: "orders",        icon: Package,          ar: "الطلبات",      fr: "Commandes" },
  { id: "hotelBookings", icon: Hotel,            ar: "حجوزات الفنادق", fr: "Réservations Hôtel" },
  { id: "categories",    icon: Tag,              ar: "الفئات",       fr: "Catégories" },
  { id: "suppliers",     icon: Users,            ar: "المزودون",     fr: "Fournisseurs" },
  { id: "articles",      icon: ShoppingBag,      ar: "المنتجات",     fr: "Articles" },
  { id: "staff",         icon: Truck,            ar: "السائقون",     fr: "Livreurs" },
  { id: "delegations",   icon: Map,              ar: "المعتمديات",   fr: "Délégations" },
  { id: "banners",       icon: Megaphone,        ar: "الإعلانات",    fr: "Publicités" },
];

export default function Admin() {
  const { lang, t, isRTL } = useLang();
  const [active, setActive] = useState<Section>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex" dir={isRTL ? "rtl" : "ltr"}>
      {/* ── Sidebar ── */}
      <aside className={cn(
        "fixed top-0 h-screen z-40 flex flex-col bg-[#0a0a0a] border-white/5",
        "transition-all duration-300",
        isRTL ? "right-0 border-l" : "left-0 border-r",
        sidebarOpen ? "w-56" : "w-16 md:w-56"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
          <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/20 border border-[#D4AF37]/30 flex items-center justify-center flex-shrink-0">
            <span className="font-black text-[#D4AF37] text-sm">DC</span>
          </div>
          <div className="hidden md:block overflow-hidden">
            <p className="text-xs font-black text-white leading-tight">{t("لوحة التحكم","Admin Panel")}</p>
            <p className="text-[10px] text-white/30">{t("المدينة الرقمية","Digital City")}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
          {NAV.map(item => {
            const Icon = item.icon;
            const isAct = active === item.id;
            return (
              <button key={item.id} onClick={() => { setActive(item.id); setSidebarOpen(false); }}
                className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-bold",
                  isAct ? "bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/20" : "text-white/40 hover:text-white hover:bg-white/5")}>
                <Icon size={17} className="flex-shrink-0" />
                <span className="hidden md:block truncate">{lang === "ar" ? item.ar : item.fr}</span>
              </button>
            );
          })}
        </nav>

        {/* Back to app */}
        <div className="px-2 py-3 border-t border-white/5">
          <a href="/" className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition-all text-sm font-bold")}>
            <ChevronRight size={17} className={cn("flex-shrink-0", isRTL ? "rotate-0" : "rotate-180")} />
            <span className="hidden md:block">{t("العودة للتطبيق","Retour à l'app")}</span>
          </a>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className={cn("flex-1 min-w-0 p-4 md:p-8 pb-24", isRTL ? "mr-16 md:mr-56" : "ml-16 md:ml-56")}>
        {/* Mobile header */}
        <div className="flex items-center justify-between mb-6 md:hidden">
          <button onClick={() => setSidebarOpen(o => !o)} className="p-2 rounded-xl bg-white/5 text-white/40">
            <LayoutDashboard size={18} />
          </button>
          <p className="text-sm font-black text-[#D4AF37]">{lang === "ar" ? NAV.find(n=>n.id===active)?.ar : NAV.find(n=>n.id===active)?.fr}</p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            {active === "overview"      && <OverviewSection t={t} />}
            {active === "orders"        && <OrdersSection t={t} lang={lang} />}
            {active === "hotelBookings" && <HotelBookingsSection t={t} lang={lang} />}
            {active === "categories"    && <CategoriesSection t={t} />}
            {active === "suppliers"     && <SuppliersSection t={t} lang={lang} />}
            {active === "articles"      && <ArticlesSection t={t} lang={lang} />}
            {active === "staff"         && <DeliveryStaffSection t={t} />}
            {active === "delegations"   && <DelegationsSection t={t} />}
            {active === "banners"       && <BannersSection t={t} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
