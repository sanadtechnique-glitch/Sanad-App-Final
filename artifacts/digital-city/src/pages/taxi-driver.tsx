import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { io, Socket } from "socket.io-client";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/digital-city", "") + "/api-server/api";

function getSession() {
  try { return JSON.parse(localStorage.getItem("sanad_session") || "null"); } catch { return null; }
}

type DriverView = "loading" | "unavailable" | "waiting" | "incoming" | "active" | "no_auth";

interface PendingRequest {
  id: number;
  customerName: string;
  customerPhone: string | null;
  pickupAddress: string;
  dropoffAddress: string | null;
  notes: string | null;
  commissionType: "meter" | "fixed";
  fixedAmount: number | null;
}

interface ActiveRequest {
  id: number;
  customerName: string;
  customerPhone: string | null;
  pickupAddress: string;
  dropoffAddress: string | null;
  etaMinutes: number | null;
  commissionType: "meter" | "fixed";
  fixedAmount: number | null;
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

  const [view,           setView]           = useState<DriverView>("loading");
  const [driver,         setDriver]         = useState<DriverInfo | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [activeRequest,  setActiveRequest]  = useState<ActiveRequest | null>(null);
  const [etaInput,       setEtaInput]       = useState("5");
  const [error,          setError]          = useState("");
  const [actionLoading,  setActionLoading]  = useState(false);

  const socketRef  = useRef<Socket | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = session?.token as string | undefined;
  const headers = { "Content-Type": "application/json", ...(token ? { "x-session-token": token } : {}) };

  // ── Fetch driver state from API ────────────────────────────────────────────
  async function fetchDriverState() {
    if (!token) { setView("no_auth"); return; }

    // Check for accepted ride first
    const [currentRes, acceptedRes] = await Promise.all([
      fetch(`${API}/taxi/driver/current`,  { headers }),
      fetch(`${API}/taxi/driver/accepted`, { headers }),
    ]);

    if (currentRes.status === 403 || acceptedRes.status === 403) {
      setView("no_auth"); return;
    }

    const currentData  = currentRes.ok  ? await currentRes.json()  : null;
    const acceptedData = acceptedRes.ok ? await acceptedRes.json() : null;

    if (currentData?.driver) {
      setDriver(currentData.driver);

      if (acceptedData?.acceptedRequest) {
        setActiveRequest(acceptedData.acceptedRequest);
        setView("active");
      } else if (currentData.pendingRequest) {
        setPendingRequest(currentData.pendingRequest);
        setView("incoming");
      } else if (!currentData.driver.isAvailable) {
        setView("unavailable");
      } else {
        setView("waiting");
      }
    } else {
      setView("no_auth");
    }
  }

  // ── Mount: initial fetch + socket ─────────────────────────────────────────
  useEffect(() => {
    if (!session?.id) { setView("no_auth"); return; }

    fetchDriverState();

    // Socket: incoming new request
    const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/digital-city", "");
    const socket  = io(`${window.location.origin}${baseUrl}/api-server`, {
      path:       `${baseUrl}/api-server/socket.io`,
      query:      { role: "taxi_driver", userId: session.id },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("taxi_request", (req: PendingRequest) => {
      setPendingRequest(req);
      setView("incoming");
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

      setActiveRequest({
        id:            pendingRequest.id,
        customerName:  pendingRequest.customerName,
        customerPhone: pendingRequest.customerPhone,
        pickupAddress: pendingRequest.pickupAddress,
        dropoffAddress: pendingRequest.dropoffAddress,
        etaMinutes:    eta,
        commissionType: pendingRequest.commissionType,
        fixedAmount:   pendingRequest.fixedAmount,
      });
      setPendingRequest(null);
      setView("active");
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

  // ── Complete ride ──────────────────────────────────────────────────────────
  async function handleComplete() {
    if (!activeRequest) return;
    setActionLoading(true);
    try {
      await fetch(`${API}/taxi/driver/complete/${activeRequest.id}`, { method: "POST", headers });
      setActiveRequest(null);
      setDriver(prev => prev ? { ...prev, isAvailable: true } : prev);
      setView("waiting");
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

  // ── ACTIVE RIDE ────────────────────────────────────────────────────────────
  if (view === "active" && activeRequest) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#FFF3E0" }}>
        <div className="py-4 px-4 text-center" style={{ background: "#1A4D1F" }}>
          <h1 className="text-white text-lg font-black">🚕 رحلة نشطة · Course active</h1>
        </div>
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

  // ── WAITING / UNAVAILABLE ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: "#FFF3E0" }}>
      <div className="w-full max-w-sm text-center">
        <div className="text-7xl mb-4">{view === "waiting" ? "🚕" : "⛔"}</div>

        {driver && (
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-6">
            <p className="font-bold text-lg" style={{ color: "#1A4D1F" }}>{driver.name}</p>
            <p className="text-gray-400 text-sm">{driver.phone}</p>
            {(driver.carModel || driver.carPlate) && (
              <p className="text-sm mt-1 text-gray-500">
                🚗 {[driver.carColor, driver.carModel].filter(Boolean).join(" ")}
                {driver.carPlate && ` · لوحة: ${driver.carPlate}`}
              </p>
            )}
          </div>
        )}

        <h2 className="text-xl font-bold mb-2" style={{ color: "#1A4D1F" }}>
          {view === "waiting" ? "في انتظار الطلبات..." : "غير متاح حالياً"}
        </h2>
        <p className="text-gray-500 text-sm mb-8">
          {view === "waiting"
            ? "En attente de nouvelles demandes…"
            : "Vous êtes marqué comme non disponible"}
        </p>

        {view === "waiting" && (
          <div className="flex justify-center gap-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-3 h-3 rounded-full animate-bounce" style={{ background: "#FFA500", animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
