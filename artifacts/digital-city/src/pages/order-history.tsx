import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Filter, Search, X, Clock, CheckCircle,
  XCircle, Truck, Package, ChevronDown, ChevronUp, Calendar,
  RefreshCw, ShoppingBag, MapPin, Phone, FileText, Star,
  DollarSign, Hash, User, AlertCircle, Image as ImageIcon,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { get } from "@/lib/admin-api";
import { useLang } from "@/lib/language";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notification-bell";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Order {
  id: number;
  customerName: string;
  customerPhone?: string;
  customerAddress: string;
  notes?: string;
  serviceType: string;
  status: string;
  serviceProviderId: number;
  serviceProviderName: string;
  deliveryStaffId?: number;
  deliveryFee?: number;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Status Configuration ───────────────────────────────────────────────────────
const STATUS: Record<string, { ar: string; fr: string; color: string; bg: string; icon: React.FC<any> }> = {
  pending:         { ar: "قيد الانتظار",     fr: "En attente",       color: "#F59E0B", bg: "#FEF3C7", icon: Clock },
  accepted:        { ar: "مقبول",            fr: "Accepté",          color: "#3B82F6", bg: "#EFF6FF", icon: CheckCircle },
  prepared:        { ar: "جاهز للتسليم",     fr: "Prêt",             color: "#8B5CF6", bg: "#F5F3FF", icon: Package },
  driver_accepted: { ar: "سائق في الطريق",  fr: "Livreur en route", color: "#6366F1", bg: "#EEF2FF", icon: Truck },
  in_delivery:     { ar: "قيد التوصيل",      fr: "En livraison",     color: "#FFA500", bg: "#FFF7ED", icon: Truck },
  delivered:       { ar: "تم التوصيل",       fr: "Livré",            color: "#1A4D1F", bg: "#F0FDF4", icon: CheckCircle },
  cancelled:       { ar: "ملغي",             fr: "Annulé",           color: "#EF4444", bg: "#FEF2F2", icon: XCircle },
};

const ONGOING_STATUSES  = ["pending", "accepted", "prepared", "driver_accepted", "in_delivery"];
const HISTORY_STATUSES  = ["delivered", "cancelled"];
const PAGE_SIZE = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string, lang: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === "ar" ? "ar-TN" : "fr-TN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatPrice(n?: number) {
  if (!n && n !== 0) return "—";
  return `${n.toFixed(2)} TND`;
}

// ── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, lang }: { status: string; lang: string }) {
  const cfg = STATUS[status] ?? { ar: status, fr: status, color: "#6B7280", bg: "#F3F4F6", icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black border"
      style={{ color: cfg.color, background: cfg.bg, borderColor: `${cfg.color}30` }}
    >
      <Icon size={10} />
      {lang === "ar" ? cfg.ar : cfg.fr}
    </span>
  );
}

// ── Order Card ────────────────────────────────────────────────────────────────
function OrderCard({
  order, lang, expanded, onToggle, role,
}: {
  order: Order; lang: string; expanded: boolean; onToggle: () => void; role: string;
}) {
  const t = (ar: string, fr: string) => lang === "ar" ? ar : fr;
  const cfg = STATUS[order.status] ?? STATUS.pending;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden"
      style={{
        background: "#FFFDE7",
        borderColor: `${cfg.color}25`,
        boxShadow: `0 2px 12px -2px ${cfg.color}15`,
      }}
    >
      {/* Card header — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-start px-4 pt-4 pb-3 flex items-start justify-between gap-3"
      >
        <div className="flex-1 min-w-0">
          {/* Top row: ID + status */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="flex items-center gap-1 text-xs font-black text-[#1A4D1F]/50">
              <Hash size={11} />
              {order.id}
            </span>
            <StatusBadge status={order.status} lang={lang} />
            {order.etaMinutes && ONGOING_STATUSES.includes(order.status) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black border"
                style={{ color: "#059669", background: "#F0FDF4", borderColor: "#05966930" }}>
                <Clock size={9} />
                {lang === "ar" ? `~${order.etaMinutes} دقيقة` : `~${order.etaMinutes} min`}
              </span>
            )}
          </div>

          {/* Provider + service */}
          <p className="text-[#1A4D1F] font-black text-sm leading-tight">{order.serviceProviderName}</p>
          <p className="text-[#1A4D1F]/50 text-xs mt-0.5">{order.serviceType}</p>

          {/* Customer name — for provider/driver views */}
          {(role === "provider" || role === "delivery") && (
            <p className="text-[#1A4D1F]/40 text-xs mt-1 flex items-center gap-1">
              <User size={10} />
              {order.customerName}
            </p>
          )}
        </div>

        {/* Right: date + price + expand */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="text-[10px] text-[#1A4D1F]/30 font-bold">{formatDate(order.createdAt, lang)}</span>
          {(order.deliveryFee !== undefined && order.deliveryFee !== null) && (
            <span className="text-sm font-black text-[#1A4D1F]">{formatPrice(order.deliveryFee)}</span>
          )}
          <div className="flex items-center gap-1 text-[#1A4D1F]/30">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-[#1A4D1F]/8 space-y-2.5">
              {/* Address */}
              <div className="flex items-start gap-2">
                <MapPin size={13} className="text-[#1A4D1F]/40 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-[#1A4D1F]/70 leading-relaxed">{order.customerAddress}</p>
              </div>

              {/* Phone */}
              {order.customerPhone && (
                <div className="flex items-center gap-2">
                  <Phone size={13} className="text-[#1A4D1F]/40 flex-shrink-0" />
                  <a href={`tel:${order.customerPhone}`} className="text-sm text-[#1A4D1F] font-bold hover:underline">
                    {order.customerPhone}
                  </a>
                </div>
              )}

              {/* Notes */}
              {order.notes && (
                <div className="flex items-start gap-2">
                  <FileText size={13} className="text-[#1A4D1F]/40 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-[#1A4D1F]/60 leading-relaxed">{order.notes}</p>
                </div>
              )}

              {/* Prescription photo */}
              {order.photoUrl && (
                <div className="flex items-center gap-2">
                  <ImageIcon size={13} className="text-[#1A4D1F]/40 flex-shrink-0" />
                  <a
                    href={order.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-bold text-blue-500 hover:underline"
                  >
                    {t("عرض الصورة / الوصفة", "Voir l'image / ordonnance")}
                  </a>
                </div>
              )}

              {/* Updated at */}
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-[#1A4D1F]/40 flex-shrink-0" />
                <p className="text-xs text-[#1A4D1F]/30">
                  {t("آخر تحديث:", "Mis à jour:")} {formatDate(order.updatedAt, lang)}
                </p>
              </div>

              {/* Delivery fee summary row */}
              <div className="flex items-center justify-between pt-2 border-t border-[#1A4D1F]/5">
                <span className="text-xs font-bold text-[#1A4D1F]/40">{t("رسوم التوصيل", "Frais de livraison")}</span>
                <span className="text-sm font-black text-[#1A4D1F]">{formatPrice(order.deliveryFee)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────
function FilterBar({
  lang, tab, search, setSearch, statusFilter, setStatusFilter,
  dateFrom, setDateFrom, dateTo, setDateTo, activeCount, onClear,
}: {
  lang: string; tab: "ongoing" | "history";
  search: string; setSearch: (v: string) => void;
  statusFilter: string; setStatusFilter: (v: string) => void;
  dateFrom: string; setDateFrom: (v: string) => void;
  dateTo: string; setDateTo: (v: string) => void;
  activeCount: number; onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const t = (ar: string, fr: string) => lang === "ar" ? ar : fr;
  const statusOpts = tab === "ongoing" ? ONGOING_STATUSES : HISTORY_STATUSES;

  return (
    <div className="space-y-2">
      {/* Search + toggle */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className={cn("absolute top-1/2 -translate-y-1/2 text-[#1A4D1F]/30", lang === "ar" ? "right-3" : "left-3")} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("البحث برقم الطلب أو اسم المزود...", "Rechercher par ID ou fournisseur...")}
            className={cn("w-full bg-[#FFFDE7] border border-[#1A4D1F]/15 rounded-xl py-2.5 text-sm text-[#1A4D1F] placeholder:text-[#1A4D1F]/20 focus:outline-none focus:border-[#1A4D1F]/40 transition-colors", lang === "ar" ? "pr-9 pl-3" : "pl-9 pr-3")}
          />
          {search && (
            <button onClick={() => setSearch("")} className={cn("absolute top-1/2 -translate-y-1/2 text-[#1A4D1F]/30 hover:text-[#1A4D1F]", lang === "ar" ? "left-3" : "right-3")}>
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={() => setOpen(o => !o)}
          className={cn(
            "px-3.5 py-2.5 rounded-xl border font-black text-xs flex items-center gap-1.5 transition-all",
            open || activeCount > 0
              ? "bg-[#1A4D1F] text-white border-[#1A4D1F]"
              : "bg-[#FFFDE7] text-[#1A4D1F] border-[#1A4D1F]/20 hover:border-[#1A4D1F]/50"
          )}
        >
          <Filter size={13} />
          {t("فلتر", "Filtres")}
          {activeCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-white/30 text-[10px] flex items-center justify-center">{activeCount}</span>
          )}
        </button>
      </div>

      {/* Expanded filters */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-[#FFFDE7] border border-[#1A4D1F]/10 rounded-2xl p-4 space-y-3">
              {/* Status filter */}
              <div>
                <p className="text-[10px] font-black text-[#1A4D1F]/40 uppercase tracking-wider mb-2">
                  {t("الحالة", "Statut")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["all", ...statusOpts].map(s => {
                    const cfg = s === "all" ? null : STATUS[s];
                    return (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={cn(
                          "px-2.5 py-1 rounded-xl text-xs font-black border transition-all",
                          statusFilter === s
                            ? "bg-[#1A4D1F] text-white border-[#1A4D1F]"
                            : "text-[#1A4D1F] border-[#1A4D1F]/15 hover:border-[#1A4D1F]/40"
                        )}
                        style={statusFilter !== s && cfg ? { borderColor: `${cfg.color}40`, color: cfg.color } : {}}
                      >
                        {s === "all" ? t("الكل", "Tous") : (lang === "ar" ? cfg?.ar : cfg?.fr)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date range */}
              <div>
                <p className="text-[10px] font-black text-[#1A4D1F]/40 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Calendar size={10} />
                  {t("تحديد الفترة", "Période")}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-[#1A4D1F]/30 mb-1">{t("من", "Du")}</p>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="w-full bg-white/60 border border-[#1A4D1F]/10 rounded-xl px-3 py-2 text-xs text-[#1A4D1F] focus:outline-none focus:border-[#1A4D1F]/40"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-[#1A4D1F]/30 mb-1">{t("إلى", "Au")}</p>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="w-full bg-white/60 border border-[#1A4D1F]/10 rounded-xl px-3 py-2 text-xs text-[#1A4D1F] focus:outline-none focus:border-[#1A4D1F]/40"
                    />
                  </div>
                </div>
              </div>

              {/* Clear */}
              {activeCount > 0 && (
                <button
                  onClick={() => { onClear(); setOpen(false); }}
                  className="w-full text-center text-xs font-black text-red-400/70 hover:text-red-400 transition-colors py-1"
                >
                  {t("مسح جميع الفلاتر", "Effacer les filtres")}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OrderHistory() {
  const { lang, t, isRTL } = useLang();
  const [, navigate] = useLocation();
  const session = getSession();

  const [allOrders, setAllOrders]           = useState<Order[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [tab, setTab]                       = useState<"ongoing" | "history">("ongoing");
  const [search, setSearch]                 = useState("");
  const [statusFilter, setStatusFilter]     = useState("all");
  const [dateFrom, setDateFrom]             = useState("");
  const [dateTo, setDateTo]                 = useState("");
  const [page, setPage]                     = useState(1);
  const [expandedId, setExpandedId]         = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  if (!session) {
    navigate("/login");
    return null;
  }

  const role = session.role as string;

  // ── Role meta ────────────────────────────────────────────────────────────────
  const roleLabel = (role === "client" || role === "customer") ? t("عميل", "Client")
    : role === "provider"             ? t("مزود خدمة", "Fournisseur")
    : role === "delivery"             ? t("سائق توصيل", "Livreur")
    : role;

  const roleColor = role === "provider" ? "#8B5CF6"
    : role === "delivery"              ? "#3B82F6"
    : "#1A4D1F";

  // ── Fetch orders ──────────────────────────────────────────────────────────────
  const loadOrders = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      let orders: Order[] = [];
      if (role === "client" || role === "customer") {
        orders = await get<Order[]>(`/orders/customer?name=${encodeURIComponent(session.name)}`);
      } else if (role === "provider" && (session as any).supplierId) {
        orders = await get<Order[]>(`/provider/${(session as any).supplierId}/orders`);
      } else if (role === "delivery" && (session as any).staffId) {
        orders = await get<Order[]>(`/delivery/staff/${(session as any).staffId}/orders`);
      }
      setAllOrders(orders);
    } catch {
      setAllOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [role, session]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [tab, search, statusFilter, dateFrom, dateTo]);

  // ── Filter logic ──────────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    const targetStatuses = tab === "ongoing" ? ONGOING_STATUSES : HISTORY_STATUSES;
    return allOrders.filter(o => {
      if (!targetStatuses.includes(o.status)) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        if (!String(o.id).includes(s) && !o.serviceProviderName.toLowerCase().includes(s) && !o.customerName.toLowerCase().includes(s)) return false;
      }
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (new Date(o.createdAt) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(o.createdAt) > to) return false;
      }
      return true;
    });
  }, [allOrders, tab, statusFilter, search, dateFrom, dateTo]);

  const ongoingCount = useMemo(() => allOrders.filter(o => ONGOING_STATUSES.includes(o.status)).length, [allOrders]);
  const historyCount = useMemo(() => allOrders.filter(o => HISTORY_STATUSES.includes(o.status)).length, [allOrders]);

  const paginatedOrders = filteredOrders.slice(0, page * PAGE_SIZE);
  const hasMore = paginatedOrders.length < filteredOrders.length;

  const activeFilters = [statusFilter !== "all", !!dateFrom, !!dateTo].filter(Boolean).length;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const backHref = role === "provider" ? "/provider"
    : role === "delivery"             ? "/delivery"
    : "/home";

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FFF3E0" }}>
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={28} className="text-[#1A4D1F] animate-spin" />
          <p className="text-[#1A4D1F]/50 font-bold text-sm">{t("جاري تحميل السجل...", "Chargement...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10" style={{ background: "#FFF3E0" }} dir={isRTL ? "rtl" : "ltr"}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-[#1A4D1F]/10" style={{ background: "#FFA500" }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Back */}
          <button
            onClick={() => navigate(backHref)}
            className="p-2.5 rounded-xl bg-[#1A4D1F]/10 border border-[#1A4D1F]/20 text-[#1A4D1F] hover:bg-[#1A4D1F]/20 transition-all flex-shrink-0"
          >
            {isRTL ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
          </button>

          {/* Title + role badge */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-black text-[#1A4D1F] leading-tight">
              {t("سجل الطلبات", "Historique des commandes")}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded-full border"
                style={{ color: roleColor, borderColor: `${roleColor}40`, background: `${roleColor}10` }}
              >
                {roleLabel}
              </span>
              <span className="text-[10px] text-[#1A4D1F]/40 font-bold">
                {allOrders.length} {t("طلب", "commandes")}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <NotificationBell
              lang={lang}
              role={session.role as any}
              providerId={(session as any).supplierId}
            />
            <button
              onClick={() => loadOrders(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-[#1A4D1F]/10 border border-[#1A4D1F]/20 text-[#1A4D1F]/40 hover:text-[#1A4D1F] transition-all"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div className="flex rounded-2xl overflow-hidden border border-[#1A4D1F]/15" style={{ background: "#FFFDE7" }}>
          {([
            { key: "ongoing", ar: "في طور الإنجاز", fr: "En cours", count: ongoingCount, icon: Clock },
            { key: "history", ar: "الطلبات السابقة", fr: "Historique",  count: historyCount, icon: CheckCircle },
          ] as const).map(({ key, ar, fr, count, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setPage(1); setExpandedId(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-black transition-all border-b-2",
                tab === key
                  ? "text-[#1A4D1F] border-[#1A4D1F]"
                  : "text-[#1A4D1F]/30 border-transparent hover:text-[#1A4D1F]/50"
              )}
            >
              <Icon size={14} />
              {lang === "ar" ? ar : fr}
              <span className={cn(
                "text-[10px] font-black px-1.5 py-0.5 rounded-full",
                tab === key ? "bg-[#1A4D1F] text-white" : "bg-[#1A4D1F]/10 text-[#1A4D1F]/40"
              )}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Filter Bar ───────────────────────────────────────────────────── */}
        <FilterBar
          lang={lang} tab={tab}
          search={search} setSearch={setSearch}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          dateFrom={dateFrom} setDateFrom={setDateFrom}
          dateTo={dateTo} setDateTo={setDateTo}
          activeCount={activeFilters} onClear={clearFilters}
        />

        {/* ── Results summary ───────────────────────────────────────────────── */}
        {(activeFilters > 0 || search) && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-[#1A4D1F]/40 font-bold"
          >
            {filteredOrders.length} {t("نتيجة", "résultat(s)")}
            {filteredOrders.length !== allOrders.length && ` ${t("من أصل", "sur")} ${allOrders.length}`}
          </motion.p>
        )}

        {/* ── Order list ───────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {filteredOrders.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#FFFDE7] border border-[#1A4D1F]/10 flex items-center justify-center shadow-sm">
                {tab === "ongoing"
                  ? <Clock size={24} className="text-[#1A4D1F]/20" />
                  : <ShoppingBag size={24} className="text-[#1A4D1F]/20" />
                }
              </div>
              <div className="text-center">
                <p className="font-black text-[#1A4D1F]/40 text-base">
                  {activeFilters > 0 || search
                    ? t("لا توجد نتائج مطابقة", "Aucun résultat trouvé")
                    : tab === "ongoing"
                      ? t("لا توجد طلبات نشطة", "Aucune commande en cours")
                      : t("لا يوجد سجل طلبات بعد", "Aucun historique disponible")
                  }
                </p>
                <p className="text-xs text-[#1A4D1F]/25 mt-1 font-bold">
                  {activeFilters > 0 || search
                    ? t("جرّب تغيير الفلاتر", "Essayez de modifier vos filtres")
                    : t("ستظهر طلباتك هنا", "Vos commandes apparaîtront ici")
                  }
                </p>
              </div>
              {(activeFilters > 0 || search) && (
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-xl text-xs font-black text-[#1A4D1F] border border-[#1A4D1F]/20 hover:bg-[#1A4D1F]/5 transition-all"
                >
                  {t("مسح الفلاتر", "Effacer les filtres")}
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {paginatedOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  lang={lang}
                  expanded={expandedId === order.id}
                  onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                  role={role}
                />
              ))}

              {/* Load More */}
              {hasMore && (
                <div ref={bottomRef} className="pt-2 text-center">
                  <button
                    onClick={() => setPage(p => p + 1)}
                    className="px-6 py-3 rounded-xl font-black text-sm border border-[#1A4D1F]/20 text-[#1A4D1F] hover:bg-[#1A4D1F]/5 transition-all inline-flex items-center gap-2"
                  >
                    <ChevronDown size={14} />
                    {t(`تحميل المزيد (${filteredOrders.length - paginatedOrders.length})`, `Charger plus (${filteredOrders.length - paginatedOrders.length})`)}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
