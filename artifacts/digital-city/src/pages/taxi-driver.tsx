import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { io, Socket } from "socket.io-client";
import { getSession } from "@/lib/auth";

const API = "/api";

type DriverView = "loading" | "unavailable" | "waiting" | "incoming" | "awaiting_customer" | "active" | "no_auth";

interface RideInfo {
  id: number;
  customerName: string;
  customerPhone: string | null;
  pickupAddress: string;
  dropoffAddress: string | null;
  notes: string | null;
  commissionType: "meter" | "fixed";
  fixedAmount: number | null;
}

interface PendingRequest extends RideInfo {}

interface AwaitingRequest extends RideInfo {
  etaMinutes: number;
}

interface ActiveRequest extends RideInfo {
  etaMinutes: number | null;
}

interface DriverInfo {
  id: number;
  name: string;
  phone: string;
  isAvailable: boolean;
  carModel: string | null;
  carColor: string | null;
  carPlate: string | null;
}

export default function TaxiDriverPage() {
  const [, navigate] = useLocation();
  const session   = getSession();

  const [view,             setView]             = useState<DriverView>("loading");
  const [driver,           setDriver]           = useState<DriverInfo | null>(null);
  const [pendingRequest,   setPendingRequest]   = useState<PendingRequest | null>(null);
  const [awaitingRequest,  setAwaitingRequest]  = useState<AwaitingRequest | null>(null);
  const [activeRequest,    setActiveRequest]    = useState<ActiveRequest | null>(null);
  const [queuedRequest,    setQueuedRequest]    = useState<PendingRequest | null>(null); // while in active ride
  const [etaInput,         setEtaInput]         = useState("5");
  const [error,            setError]            = useState("");
  const [actionLoading,    setActionLoading]    = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [activeTab,      setActiveTab]      = useState<"status" | "history">("status");
  const [dateFrom,       setDateFrom]       = useState(today);
  const [dateTo,         setDateTo]         = useState(today);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData,    setHistoryData]    = useState<{
    rides: Array<{
      id: number; customerName: string; pickupAddress: string;
      dropoffAddress: string | null; commissionType: string;
      fixedAmount: number | null; createdAt: string;
    }>;
    total: number; fixedCount: number; meterCount: number; totalFixed: number;
  } | null>(null);

  const socketRef  = useRef<Socket | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = session?.token as string | undefined;
  const headers = { "Content-Type": "application/json", ...(token ? { "x-session-token": token } : {}) };

  // ── Fetch driver state from API ────────────────────────────────────────────
  async function fetchDriverState() {
    if (!token) { setView("no_auth"); return; }

    const res = await fetch(`${API}/taxi/driver/current`, { headers });

    if (res.status === 403) { setView("no_auth"); return; }

    const data = res.ok ? await res.json() : null;

    if (data?.driver) {
      setDriver(data.driver);

      if (data.activeRequest) {
        // Customer confirmed → driver en route
        setActiveRequest(data.activeRequest);
        setView("active");
        // If there's ALSO a pending request, queue it for after the ride
        if (data.pendingRequest) {
          setQueuedRequest(data.pendingRequest);
        }
      } else if (data.awaitingRequest) {
        // Driver accepted + set ETA, waiting for customer confirmation
        setAwaitingRequest(data.awaitingRequest);
        setView("awaiting_customer");
      } else if (data.pendingRequest) {
        // Driver received a new request (not currently on a ride)
        setPendingRequest(data.pendingRequest);
        setView("incoming");
      } else if (!data.driver.isAvailable) {
        setView("unavailable");
      } else {
        setView("waiting");
      }
    } else {
      setView("no_auth");
    }
  }

  // ── Load history ───────────────────────────────────────────────────────────
  async function loadHistory() {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo)   params.set("to",   dateTo);
      const res = await fetch(`${API}/taxi/driver/history?${params}`, { headers });
      if (res.ok) setHistoryData(await res.json());
    } finally {
      setHistoryLoading(false);
    }
  }

  // ── Mount: initial fetch + socket ─────────────────────────────────────────
  useEffect(() => {
    if (!session?.userId) { setView("no_auth"); return; }

    fetchDriverState();

    // Socket: incoming new request
    const socket = io(window.location.origin, {
      query:      { role: "taxi_driver", userId: session.userId },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("taxi_request", (req: PendingRequest & { isQueued?: boolean }) => {
      setView(currentView => {
        if (currentView === "active" || currentView === "awaiting_customer") {
          // Driver is busy — queue it silently (show banner)
          setQueuedRequest(req);
          return currentView; // don't change view
        } else {
          // Driver is free — show incoming screen
          setPendingRequest(req);
          return "incoming";
        }
      });
    });

    // Customer confirmed or declined the ETA
    socket.on("taxi_update", (payload: { status: string }) => {
      if (payload.status === "confirmed") {
        // Customer confirmed → refresh to get in_progress state from server
        fetchDriverState();
      } else if (payload.status === "declined") {
        // Customer declined → back to waiting
        setAwaitingRequest(null);
        setView("waiting");
      }
    });

    // Poll every 15s as fallback
    pollRef.current = setInterval(fetchDriverState, 15000);

    return () => {
      socket.disconnect();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Accept ─────────────────────────────────────────────────────────────────
  async function handleAccept() {
    if (!pendingRequest) return;
    const eta = parseInt(etaInput);
    if (isNaN(eta) || eta < 1) { setError("أدخل وقت وصول صحيح"); return; }

    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/taxi/request/${pendingRequest.id}/accept`, {
        method: "POST",
        headers,
        body:   JSON.stringify({ etaMinutes: eta }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "خطأ"); setActionLoading(false); return; }

      // Move to awaiting_customer — waiting for customer to confirm the ETA
      setAwaitingRequest({
        id:             pendingRequest.id,
        customerName:   pendingRequest.customerName,
        customerPhone:  pendingRequest.customerPhone,
        pickupAddress:  pendingRequest.pickupAddress,
        dropoffAddress: pendingRequest.dropoffAddress,
        notes:          pendingRequest.notes,
        commissionType: pendingRequest.commissionType,
        fixedAmount:    pendingRequest.fixedAmount,
        etaMinutes:     eta,
      });
      setPendingRequest(null);
      setView("awaiting_customer");
    } catch { setError("تعذّر الاتصال بالخادم"); }
    setActionLoading(false);
  }

  // ── Reject ─────────────────────────────────────────────────────────────────
  async function handleReject() {
    if (!pendingRequest) return;
    setActionLoading(true);
    setError("");
    try {
      await fetch(`${API}/taxi/request/${pendingRequest.id}/reject`, { method: "POST", headers });
      setPendingRequest(null);
      setView("waiting");
    } catch { setError("تعذّر الاتصال بالخادم"); }
    setActionLoading(false);
  }

  // ── Toggle availability ────────────────────────────────────────────────────
  async function handleToggleAvailability() {
    if (!token || !driver) return;
    const newVal = !driver.isAvailable;
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/taxi/driver/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ isAvailable: newVal }),
      });
      if (res.ok) {
        setDriver(prev => prev ? { ...prev, isAvailable: newVal } : prev);
        setView(newVal ? "waiting" : "unavailable");
      }
    } catch { setError("تعذّر تغيير الحالة"); }
    setActionLoading(false);
  }

  // ── Complete ride ──────────────────────────────────────────────────────────
  async function handleComplete() {
    if (!activeRequest) return;
    setActionLoading(true);
    try {
      await fetch(`${API}/taxi/driver/complete/${activeRequest.id}`, { method: "POST", headers });
      setActiveRequest(null);
      setDriver(prev => prev ? { ...prev, isAvailable: true } : prev);

      // If there's a queued request, go directly to incoming screen
      if (queuedRequest) {
        setPendingRequest(queuedRequest);
        setQueuedRequest(null);
        setEtaInput("5");
        setView("incoming");
      } else {
        setView("waiting");
      }
    } catch { setError("تعذّر الاتصال بالخادم"); }
    setActionLoading(false);
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (view === "no_auth") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "#FFF3E0" }}>
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "#1A4D1F" }}>غير مصرّح · Non autorisé</h2>
        <p className="text-gray-500 text-sm mb-6 text-center">يجب تسجيل الدخول كسائق تاكسي<br/>Connectez-vous en tant que chauffeur</p>
        <button onClick={() => navigate("/login")} className="px-6 py-3 rounded-xl text-white font-bold" style={{ background: "#1A4D1F" }}>
          تسجيل الدخول · Connexion
        </button>
      </div>
    );
  }

  if (view === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#FFF3E0" }}>
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🚕</div>
          <p className="text-gray-500">جارٍ التحميل...</p>
        </div>
      </div>
    );
  }

  // ── INCOMING REQUEST ───────────────────────────────────────────────────────
  if (view === "incoming" && pendingRequest) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#FFF3E0" }}>
        {/* Pulsing top bar */}
        <div className="py-4 px-4 text-center animate-pulse" style={{ background: "#FFA500" }}>
          <h1 className="text-white text-lg font-black">🔔 طلب تاكسي جديد!</h1>
          <p className="text-white text-xs">Nouvelle demande de taxi !</p>
        </div>

        <div className="flex-1 p-4 max-w-sm mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-lg p-5 mb-4">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#FFF3E0" }}>
                <span className="text-xl">👤</span>
              </div>
              <div>
                <p className="font-bold" style={{ color: "#1A4D1F" }}>{pendingRequest.customerName}</p>
                {pendingRequest.customerPhone && (
                  <a href={`tel:${pendingRequest.customerPhone}`} className="text-sm text-blue-600">
                    {pendingRequest.customerPhone}
                  </a>
                )}
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex gap-3">
                <span className="text-lg">📍</span>
                <div>
                  <p className="text-xs text-gray-400">نقطة الانطلاق · Départ</p>
                  <p className="font-bold text-sm" style={{ color: "#1A4D1F" }}>{pendingRequest.pickupAddress}</p>
                </div>
              </div>
              {pendingRequest.dropoffAddress && (
                <div className="flex gap-3">
                  <span className="text-lg">🏁</span>
                  <div>
                    <p className="text-xs text-gray-400">الوجهة · Destination</p>
                    <p className="font-bold text-sm" style={{ color: "#1A4D1F" }}>{pendingRequest.dropoffAddress}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <span className="text-lg">💵</span>
                <div>
                  <p className="text-xs text-gray-400">الأجرة · Tarif</p>
                  <p className="font-bold text-sm" style={{ color: "#1A4D1F" }}>
                    {pendingRequest.commissionType === "meter"
                      ? "⏱ عدّاد · Compteur"
                      : `${pendingRequest.fixedAmount?.toFixed(3)} دينار (ثابت)`}
                  </p>
                </div>
              </div>
              {pendingRequest.notes && (
                <div className="flex gap-3">
                  <span className="text-lg">💬</span>
                  <div>
                    <p className="text-xs text-gray-400">ملاحظات · Notes</p>
                    <p className="text-sm text-gray-600">{pendingRequest.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* ETA input */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">وقت وصولك (دقائق) · Votre ETA (minutes)</label>
              <input
                type="number"
                value={etaInput}
                onChange={e => setEtaInput(e.target.value)}
                className="w-full border-2 rounded-xl px-4 py-2.5 text-center text-xl font-black focus:outline-none"
                style={{ borderColor: "#1A4D1F" }}
                min={1}
                max={60}
              />
            </div>

            {error && <p className="text-red-600 text-sm text-center mb-3">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="flex-1 py-3 rounded-xl border-2 font-bold text-red-600"
                style={{ borderColor: "#ef4444" }}
              >
                رفض · Refuser
              </button>
              <button
                onClick={handleAccept}
                disabled={actionLoading}
                className="flex-1 py-3 rounded-xl text-white font-bold"
                style={{ background: actionLoading ? "#9ca3af" : "#1A4D1F" }}
              >
                {actionLoading ? "..." : "قبول · Accepter"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── AWAITING CUSTOMER CONFIRMATION ────────────────────────────────────────
  if (view === "awaiting_customer" && awaitingRequest) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#FFF3E0" }}>
        <div className="py-4 px-4 text-center animate-pulse" style={{ background: "#FFA500" }}>
          <h1 className="text-white text-lg font-black">⏳ في انتظار تأكيد الزبون</h1>
          <p className="text-white text-xs">En attente de confirmation client…</p>
        </div>
        <div className="flex-1 p-4 max-w-sm mx-auto w-full" dir="rtl">
          <div className="bg-white rounded-2xl shadow-lg p-5 mb-4">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#FFF3E0" }}>
                <span className="text-xl">👤</span>
              </div>
              <div>
                <p className="font-bold" style={{ color: "#1A4D1F" }}>{awaitingRequest.customerName}</p>
                {awaitingRequest.customerPhone && (
                  <a href={`tel:${awaitingRequest.customerPhone}`} className="text-sm text-blue-600">
                    📞 {awaitingRequest.customerPhone}
                  </a>
                )}
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex gap-3">
                <span>📍</span>
                <div>
                  <p className="text-xs text-gray-400">نقطة الانطلاق</p>
                  <p className="font-bold text-sm" style={{ color: "#1A4D1F" }}>{awaitingRequest.pickupAddress}</p>
                </div>
              </div>
              {awaitingRequest.dropoffAddress && (
                <div className="flex gap-3">
                  <span>🏁</span>
                  <div>
                    <p className="text-xs text-gray-400">الوجهة</p>
                    <p className="font-bold text-sm" style={{ color: "#1A4D1F" }}>{awaitingRequest.dropoffAddress}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <span>💵</span>
                <div>
                  <p className="text-xs text-gray-400">الأجرة</p>
                  <p className="font-bold text-sm" style={{ color: "#1A4D1F" }}>
                    {awaitingRequest.commissionType === "fixed"
                      ? `${awaitingRequest.fixedAmount?.toFixed(3)} دينار (ثابت)`
                      : "⏱ عدّاد"}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span>⏰</span>
                <div>
                  <p className="text-xs text-gray-400">وقت الوصول المقترح</p>
                  <p className="font-bold text-xl" style={{ color: "#FFA500" }}>{awaitingRequest.etaMinutes} دقيقة</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl p-3 text-center" style={{ background: "#FFF3E0" }}>
              <p className="text-sm font-bold" style={{ color: "#1A4D1F" }}>قبلت الطلب ✅</p>
              <p className="text-xs text-gray-500 mt-1">الزبون يراجع عرضك الآن…</p>
              <p className="text-xs text-gray-400">Le client examine votre offre…</p>
              <div className="flex justify-center gap-2 mt-3">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#FFA500", animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── ACTIVE RIDE ────────────────────────────────────────────────────────────
  if (view === "active" && activeRequest) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#FFF3E0" }}>
        <div className="py-4 px-4 text-center" style={{ background: "#1A4D1F" }}>
          <h1 className="text-white text-lg font-black">🚕 رحلة نشطة · Course active</h1>
        </div>

        {/* ── Queued request banner ─────────────────────────────────────── */}
        {queuedRequest && (
          <div
            className="mx-4 mt-3 rounded-2xl p-4 shadow-lg border-2 animate-pulse"
            style={{ background: "#FFF3E0", borderColor: "#FFA500" }}
            dir="rtl"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-black text-sm" style={{ color: "#FFA500" }}>
                🔔 طلب جديد ينتظرك بعد هذه الرحلة!
              </p>
              <button
                onClick={() => setQueuedRequest(null)}
                className="text-gray-400 text-xs hover:text-gray-600"
              >✕</button>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold" style={{ color: "#1A4D1F" }}>
                👤 {queuedRequest.customerName}
                {queuedRequest.customerPhone && (
                  <span className="text-blue-600 mr-2">· {queuedRequest.customerPhone}</span>
                )}
              </p>
              <p className="text-xs text-gray-600">📍 {queuedRequest.pickupAddress}</p>
              {queuedRequest.dropoffAddress && (
                <p className="text-xs text-gray-600">🏁 {queuedRequest.dropoffAddress}</p>
              )}
              <p className="text-xs font-bold" style={{ color: "#1A4D1F" }}>
                💵 {queuedRequest.commissionType === "fixed"
                  ? `${queuedRequest.fixedAmount?.toFixed(3)} دينار (ثابت)`
                  : "⏱ عدّاد"}
              </p>
            </div>
            <p className="text-xs text-center mt-2 text-gray-500">
              أنهِ رحلتك الحالية وستُعرض عليك تلقائياً ✅
            </p>
          </div>
        )}

        <div className="flex-1 p-4 max-w-sm mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-lg p-5">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "#FFF3E0" }}>
                <span className="text-xl">👤</span>
              </div>
              <div>
                <p className="font-bold" style={{ color: "#1A4D1F" }}>{activeRequest.customerName}</p>
                {activeRequest.customerPhone && (
                  <a href={`tel:${activeRequest.customerPhone}`} className="text-sm text-blue-600">
                    📞 {activeRequest.customerPhone}
                  </a>
                )}
              </div>
            </div>

            <div className="space-y-3 mb-5">
              <div className="flex gap-3">
                <span>📍</span>
                <div>
                  <p className="text-xs text-gray-400">الانطلاق</p>
                  <p className="font-bold text-sm" style={{ color: "#1A4D1F" }}>{activeRequest.pickupAddress}</p>
                </div>
              </div>
              {activeRequest.dropoffAddress && (
                <div className="flex gap-3">
                  <span>🏁</span>
                  <div>
                    <p className="text-xs text-gray-400">الوجهة</p>
                    <p className="font-bold text-sm" style={{ color: "#1A4D1F" }}>{activeRequest.dropoffAddress}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <span>💵</span>
                <div>
                  <p className="text-xs text-gray-400">الأجرة</p>
                  <p className="font-bold text-sm" style={{ color: "#1A4D1F" }}>
                    {activeRequest.commissionType === "meter"
                      ? "⏱ عدّاد"
                      : `${activeRequest.fixedAmount?.toFixed(3)} دينار (ثابت)`}
                  </p>
                </div>
              </div>
            </div>

            {error && <p className="text-red-600 text-sm text-center mb-3">{error}</p>}

            <button
              onClick={handleComplete}
              disabled={actionLoading}
              className="w-full py-4 rounded-2xl text-white font-black text-lg"
              style={{ background: actionLoading ? "#9ca3af" : "#006B3C" }}
            >
              {actionLoading ? "..." : "✅ إنهاء الرحلة · Terminer"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── WAITING / UNAVAILABLE (with tabs) ─────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FFF3E0" }}>
      {/* Header */}
      <div className="py-3 px-4 text-center" style={{ background: "#1A4D1F" }}>
        <h1 className="text-white text-base font-black">🚕 لوحة سائق التاكسي</h1>
        <p className="text-green-200 text-xs">Tableau de bord chauffeur</p>
      </div>

      {/* Driver info bar */}
      {driver && (
        <div className="px-4 py-3 flex items-center gap-3" style={{ background: "#006B3C" }}>
          <span className="text-2xl">👤</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{driver.name}</p>
            {(driver.carModel || driver.carPlate) && (
              <p className="text-green-200 text-xs truncate">
                🚗 {[driver.carColor, driver.carModel].filter(Boolean).join(" ")}
                {driver.carPlate && ` · ${driver.carPlate}`}
              </p>
            )}
          </div>
          <span
            className="text-xs px-2 py-1 rounded-full font-bold"
            style={{
              background: view === "waiting" ? "#FFA500" : "#ef4444",
              color: "white",
            }}
          >
            {view === "waiting" ? "متاح" : "غير متاح"}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b" style={{ background: "white" }}>
        {([
          { key: "status",  ar: "الحالة",    fr: "Statut",     icon: "📡" },
          { key: "history", ar: "السجل",     fr: "Historique", icon: "📋" },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              if (tab.key === "history" && !historyData) loadHistory();
            }}
            className="flex-1 py-3 text-sm font-bold flex flex-col items-center gap-0.5 transition-colors"
            style={{
              color:       activeTab === tab.key ? "#1A4D1F" : "#9ca3af",
              borderBottom: activeTab === tab.key ? "3px solid #FFA500" : "3px solid transparent",
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.ar}</span>
            <span className="text-xs font-normal" style={{ color: activeTab === tab.key ? "#006B3C" : "#d1d5db" }}>{tab.fr}</span>
          </button>
        ))}
      </div>

      {/* ── TAB: STATUS ── */}
      {activeTab === "status" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-7xl mb-4">{view === "waiting" ? "🚕" : "⛔"}</div>
          <h2 className="text-xl font-bold mb-2 text-center" style={{ color: "#1A4D1F" }}>
            {view === "waiting" ? "في انتظار الطلبات..." : "غير متاح حالياً"}
          </h2>
          <p className="text-gray-500 text-sm mb-6 text-center">
            {view === "waiting"
              ? "En attente de nouvelles demandes…"
              : "Vous êtes marqué comme non disponible"}
          </p>
          {view === "waiting" && (
            <div className="flex justify-center gap-2 mb-6">
              {[0,1,2].map(i => (
                <div key={i} className="w-3 h-3 rounded-full animate-bounce" style={{ background: "#FFA500", animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          )}
          {/* Availability toggle button */}
          <button
            onClick={handleToggleAvailability}
            disabled={actionLoading}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-md"
            style={{
              background: actionLoading ? "#9ca3af" : view === "waiting" ? "#ef4444" : "#1A4D1F",
              color: "white",
              opacity: actionLoading ? 0.7 : 1,
            }}
          >
            {actionLoading ? "..." : view === "waiting"
              ? "⛔ تعطيل · Passer hors ligne"
              : "✅ تفعيل · Passer en ligne"}
          </button>
          {error && <p className="text-red-500 text-xs mt-3 text-center">{error}</p>}
        </div>
      )}

      {/* ── TAB: HISTORY ── */}
      {activeTab === "history" && (
        <div className="flex-1 overflow-y-auto p-4" dir="rtl">

          {/* Date filter */}
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
            <p className="font-bold text-sm mb-3" style={{ color: "#1A4D1F" }}>📅 فلتر التاريخ · Filtre par date</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">من · Du</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm"
                  style={{ borderColor: "rgba(26,77,31,0.3)" }}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">إلى · Au</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 text-sm"
                  style={{ borderColor: "rgba(26,77,31,0.3)" }}
                />
              </div>
            </div>
            <button
              onClick={loadHistory}
              disabled={historyLoading}
              className="w-full py-2.5 rounded-xl text-white font-bold text-sm"
              style={{ background: historyLoading ? "#9ca3af" : "#1A4D1F" }}
            >
              {historyLoading ? "⏳ جارٍ التحميل..." : "🔍 بحث · Rechercher"}
            </button>
          </div>

          {/* Summary cards */}
          {historyData && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
                  <p className="text-2xl font-black" style={{ color: "#1A4D1F" }}>{historyData.total}</p>
                  <p className="text-xs text-gray-500 mt-0.5">إجمالي الرحلات</p>
                  <p className="text-xs text-gray-400">Total courses</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
                  <p className="text-2xl font-black" style={{ color: "#FFA500" }}>{historyData.fixedCount}</p>
                  <p className="text-xs text-gray-500 mt-0.5">بالسعر الثابت</p>
                  <p className="text-xs text-gray-400">Prix fixe</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
                  <p className="text-2xl font-black" style={{ color: "#006B3C" }}>{historyData.meterCount}</p>
                  <p className="text-xs text-gray-500 mt-0.5">بالعدّاد</p>
                  <p className="text-xs text-gray-400">Au compteur</p>
                </div>
              </div>

              {/* Total fixed commission */}
              {historyData.totalFixed > 0 && (
                <div className="rounded-2xl p-4 mb-4 text-center" style={{ background: "#1A4D1F" }}>
                  <p className="text-green-200 text-xs mb-1">مجموع العمولات الثابتة · Total commissions fixes</p>
                  <p className="text-white text-3xl font-black">{historyData.totalFixed.toFixed(3)}</p>
                  <p className="text-green-300 text-sm">دينار تونسي · DT</p>
                </div>
              )}

              {/* Rides list */}
              {historyData.rides.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-4xl mb-3">🗂</p>
                  <p className="text-sm">لا توجد رحلات في هذه الفترة</p>
                  <p className="text-xs">Aucune course pour cette période</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historyData.rides.map((ride, idx) => (
                    <div key={ride.id} className="bg-white rounded-2xl shadow-sm p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                            style={{ background: "#1A4D1F" }}>#{historyData.total - idx}</span>
                          <p className="font-bold text-sm" style={{ color: "#1A4D1F" }}>{ride.customerName}</p>
                        </div>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0"
                          style={{
                            background: ride.commissionType === "fixed" ? "#FFA500" : "#e0f2fe",
                            color:      ride.commissionType === "fixed" ? "white"   : "#0284c7",
                          }}
                        >
                          {ride.commissionType === "fixed"
                            ? `${ride.fixedAmount?.toFixed(3)} DT`
                            : "⏱ عدّاد"}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-gray-500">
                        <p>📍 {ride.pickupAddress}</p>
                        {ride.dropoffAddress && <p>🏁 {ride.dropoffAddress}</p>}
                        <p className="text-gray-400">
                          {new Date(ride.createdAt).toLocaleDateString("ar-TN", {
                            year: "numeric", month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!historyData && !historyLoading && (
            <div className="text-center py-10 text-gray-400">
              <p className="text-4xl mb-3">📅</p>
              <p className="text-sm">اختر نطاق التاريخ ثم اضغط بحث</p>
              <p className="text-xs">Choisissez une période et appuyez sur Rechercher</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
