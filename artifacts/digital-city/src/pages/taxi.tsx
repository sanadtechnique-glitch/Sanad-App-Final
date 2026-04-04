import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { io, Socket } from "socket.io-client";

const API = "/api";

type RequestStatus = "idle" | "searching" | "pending" | "accepted" | "completed" | "cancelled" | "no_driver" | "error";

interface DriverInfo {
  name: string;
  phone: string;
  carModel: string | null;
  carColor: string | null;
  carPlate: string | null;
}

interface TaxiRequest {
  id: number;
  status: RequestStatus;
  etaMinutes?: number;
  driverInfo?: DriverInfo | null;
}

// ── helpers ────────────────────────────────────────────────────────────────────
function getSession() {
  try { return JSON.parse(localStorage.getItem("sanad_session") || "null"); } catch { return null; }
}

export default function TaxiPage() {
  const [, navigate] = useLocation();
  const session = getSession();

  const [customerName,    setCustomerName]    = useState(session?.username || "");
  const [customerPhone,   setCustomerPhone]   = useState(session?.phone    || "");
  const [pickupAddress,   setPickupAddress]   = useState("");
  const [dropoffAddress,  setDropoffAddress]  = useState("");
  const [notes,           setNotes]           = useState("");
  const [commissionType,  setCommissionType]  = useState<"meter" | "fixed">("meter");
  const [fixedAmount,     setFixedAmount]     = useState("");

  const [requestId,  setRequestId]  = useState<number | null>(null);
  const [status,     setStatus]     = useState<RequestStatus>("idle");
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [error,      setError]      = useState("");
  const [loading,    setLoading]    = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── socket (real-time driver response) ────────────────────────────────────
  useEffect(() => {
    if (!session?.id) return;

    const socket = io(window.location.origin, {
      query: { role: session.role, userId: session.id },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("taxi_response", (payload: { status: string; etaMinutes?: number; driverName?: string; driverPhone?: string; carModel?: string; carColor?: string; carPlate?: string; }) => {
      if (payload.status === "accepted") {
        setStatus("accepted");
        setEtaMinutes(payload.etaMinutes ?? null);
        setDriverInfo({
          name:     payload.driverName  ?? "",
          phone:    payload.driverPhone ?? "",
          carModel: payload.carModel    ?? null,
          carColor: payload.carColor    ?? null,
          carPlate: payload.carPlate    ?? null,
        });
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (payload.status === "no_driver") {
        setStatus("no_driver");
        if (pollRef.current) clearInterval(pollRef.current);
      }
    });

    return () => { socket.disconnect(); };
  }, [session?.id]);

  // ── polling fallback (every 8 seconds) ────────────────────────────────────
  useEffect(() => {
    if (!requestId || status === "accepted" || status === "no_driver" || status === "idle") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/taxi/request/${requestId}/status`);
        if (!res.ok) return;
        const data: TaxiRequest = await res.json();
        setStatus(data.status);
        if (data.status === "accepted") {
          setEtaMinutes(data.etaMinutes ?? null);
          setDriverInfo(data.driverInfo ?? null);
          clearInterval(pollRef.current!);
        } else if (data.status === "searching" && !data.driverInfo) {
          // still searching
        }
      } catch {}
    }, 8000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [requestId, status]);

  // ── submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!customerName.trim() || !pickupAddress.trim()) {
      setError("يرجى إدخال الاسم وعنوان الانطلاق · Nom et adresse requis");
      return;
    }
    if (commissionType === "fixed" && (!fixedAmount || parseFloat(fixedAmount) <= 0)) {
      setError("يرجى تحديد المبلغ الثابت · Montant fixe requis");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/taxi/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId:    session?.id ?? undefined,
          customerName:  customerName.trim(),
          customerPhone: customerPhone.trim() || undefined,
          pickupAddress: pickupAddress.trim(),
          dropoffAddress: dropoffAddress.trim() || undefined,
          notes:          notes.trim() || undefined,
          commissionType,
          fixedAmount:   commissionType === "fixed" ? parseFloat(fixedAmount) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.message || "خطأ · Erreur"); setLoading(false); return; }

      setRequestId(data.id);
      setStatus(data.status);
    } catch {
      setError("تعذّر الاتصال بالخادم · Impossible de contacter le serveur");
    }
    setLoading(false);
  }

  function reset() {
    setStatus("idle");
    setRequestId(null);
    setEtaMinutes(null);
    setDriverInfo(null);
    setError("");
    setPickupAddress("");
    setDropoffAddress("");
    setNotes("");
  }

  // ── STATUS SCREENS ─────────────────────────────────────────────────────────
  if (status === "searching" || status === "pending") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#FFF3E0" }}>
        <div className="text-center p-8 max-w-sm w-full">
          <div className="text-6xl mb-6 animate-bounce">🚕</div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: "#1A4D1F" }}>
            {status === "pending" ? "في انتظار ردّ السائق" : "البحث عن سائق..."}
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            {status === "pending" ? "En attente du chauffeur…" : "Recherche d'un chauffeur…"}
          </p>
          <div className="flex justify-center gap-2 mb-8">
            {[0,1,2].map(i => (
              <div key={i} className="w-3 h-3 rounded-full animate-bounce" style={{ background: "#FFA500", animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <button onClick={reset} className="text-sm text-red-500 underline">إلغاء · Annuler</button>
        </div>
      </div>
    );
  }

  if (status === "accepted" && driverInfo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "#FFF3E0" }}>
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#1A4D1F" }}>
            <span className="text-3xl">🚕</span>
          </div>
          <h2 className="text-2xl font-bold mb-1" style={{ color: "#1A4D1F" }}>تم قبول الطلب!</h2>
          <p className="text-gray-500 text-sm mb-5">Demande acceptée !</p>

          {etaMinutes && (
            <div className="rounded-xl p-4 mb-4" style={{ background: "#FFF3E0" }}>
              <p className="text-4xl font-black" style={{ color: "#FFA500" }}>{etaMinutes} دق</p>
              <p className="text-sm text-gray-500">وقت الوصول · ETA</p>
            </div>
          )}

          <div className="text-right space-y-2 mb-6">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
              <span className="text-xl">👤</span>
              <div>
                <p className="font-bold text-sm" style={{ color: "#1A4D1F" }}>{driverInfo.name}</p>
                <p className="text-xs text-gray-400">السائق · Chauffeur</p>
              </div>
            </div>
            <a href={`tel:${driverInfo.phone}`} className="flex items-center gap-3 p-3 rounded-lg bg-green-50">
              <span className="text-xl">📞</span>
              <div>
                <p className="font-bold text-sm text-green-700">{driverInfo.phone}</p>
                <p className="text-xs text-gray-400">اتصل · Appeler</p>
              </div>
            </a>
            {(driverInfo.carModel || driverInfo.carPlate) && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                <span className="text-xl">🚗</span>
                <div>
                  <p className="font-bold text-sm" style={{ color: "#1A4D1F" }}>
                    {[driverInfo.carColor, driverInfo.carModel].filter(Boolean).join(" ")}
                  </p>
                  {driverInfo.carPlate && <p className="text-xs text-gray-400">لوحة: {driverInfo.carPlate}</p>}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={reset}
            className="w-full py-3 rounded-xl text-white font-bold"
            style={{ background: "#1A4D1F" }}
          >
            طلب تاكسي جديد · Nouveau taxi
          </button>
        </div>
      </div>
    );
  }

  if (status === "no_driver") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "#FFF3E0" }}>
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "#1A4D1F" }}>لا يوجد سائق متاح</h2>
          <p className="text-gray-500 text-sm mb-6">Aucun chauffeur disponible pour le moment</p>
          <button onClick={reset} className="w-full py-3 rounded-xl text-white font-bold" style={{ background: "#1A4D1F" }}>
            حاول مرة أخرى · Réessayer
          </button>
        </div>
      </div>
    );
  }

  // ── FORM ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-20" style={{ background: "#FFF3E0" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3 flex items-center gap-3" style={{ background: "#1A4D1F" }}>
        <button onClick={() => navigate(-1)} className="text-white text-xl">←</button>
        <div>
          <h1 className="text-white text-lg font-bold">طلب تاكسي 🚕</h1>
          <p className="text-green-200 text-xs">Commander un taxi</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Customer info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold mb-3 text-sm" style={{ color: "#1A4D1F" }}>معلوماتك · Vos informations</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">الاسم الكامل · Nom complet *</label>
              <input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ borderColor: "#1A4D1F" }}
                placeholder="اسمك الكامل"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">رقم الهاتف · Téléphone</label>
              <input
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ borderColor: "#1A4D1F" }}
                placeholder="+216 XX XXX XXX"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold mb-3 text-sm" style={{ color: "#1A4D1F" }}>نقطة الانطلاق والوصول · Trajets</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">📍 نقطة الانطلاق · Départ *</label>
              <input
                value={pickupAddress}
                onChange={e => setPickupAddress(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ borderColor: "#FFA500" }}
                placeholder="حيّ، شارع، علامة مميّزة..."
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">🏁 الوجهة · Destination (facultatif)</label>
              <input
                value={dropoffAddress}
                onChange={e => setDropoffAddress(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ borderColor: "#1A4D1F" }}
                placeholder="إن كنت تعرف الوجهة"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ملاحظات · Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none resize-none"
                style={{ borderColor: "#1A4D1F" }}
                rows={2}
                placeholder="أي تفاصيل إضافية..."
              />
            </div>
          </div>
        </div>

        {/* Commission */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold mb-3 text-sm" style={{ color: "#1A4D1F" }}>طريقة الأجرة · Tarification</h2>
          <div className="flex gap-3 mb-3">
            {(["meter", "fixed"] as const).map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setCommissionType(type)}
                className="flex-1 py-2.5 rounded-xl border-2 text-sm font-bold transition-all"
                style={{
                  borderColor:      commissionType === type ? "#FFA500" : "#e5e7eb",
                  background:       commissionType === type ? "#FFF3E0" : "white",
                  color:            commissionType === type ? "#1A4D1F" : "#6b7280",
                }}
              >
                {type === "meter" ? "⏱ عدّاد · Compteur" : "💵 مبلغ ثابت · Fixe"}
              </button>
            ))}
          </div>
          {commissionType === "fixed" && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">المبلغ الثابت (دينار) · Montant fixe (TND)</label>
              <input
                type="number"
                value={fixedAmount}
                onChange={e => setFixedAmount(e.target.value)}
                className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none"
                style={{ borderColor: "#FFA500" }}
                placeholder="مثال: 5.000"
                min="0.5"
                step="0.5"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-2xl text-white font-bold text-lg shadow transition-opacity"
          style={{ background: loading ? "#9ca3af" : "#1A4D1F" }}
        >
          {loading ? "جارٍ البحث..." : "🚕 اطلب تاكسي · Commander"}
        </button>
      </form>
    </div>
  );
}
