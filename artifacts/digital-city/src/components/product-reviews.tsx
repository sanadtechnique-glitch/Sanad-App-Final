import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertCircle, Loader2, Send, Star } from "lucide-react";
import { getSession } from "@/lib/auth";
import { isGuestMode } from "@/lib/guest";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Review {
  id: number;
  rating: number;
  comment: string | null;
  reviewerName: string | null;
  isVerifiedBuyer: boolean;
  createdAt: string;
}

interface ReviewsData {
  reviews: Review[];
  average: number | null;
  count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Star display (lightweight SVG path — zero extra library)
// ─────────────────────────────────────────────────────────────────────────────
function StarIcon({ filled, half, size = 14 }: { filled?: boolean; half?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {half ? (
        <>
          <defs>
            <linearGradient id="half-grad">
              <stop offset="50%" stopColor="#FFA500" />
              <stop offset="50%" stopColor="#e5e7eb" />
            </linearGradient>
          </defs>
          <path
            d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.27V1.5z"
            fill="#FFA500"
          />
          <path
            d="M10 1.5l-2.47 5.01-5.53.8 4 3.9-.94 5.5L10 14.27V1.5z"
            fill="#e5e7eb"
          />
          <path
            d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.27l-4.94 2.6.94-5.5-4-3.9 5.53-.8z"
            stroke="#FFA500" strokeWidth="0.5" fill="none"
          />
        </>
      ) : (
        <path
          d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.27l-4.94 2.6.94-5.5-4-3.9 5.53-.8z"
          fill={filled ? "#FFA500" : "#e5e7eb"}
          stroke={filled ? "#FFA500" : "#d1d5db"}
          strokeWidth="0.5"
        />
      )}
    </svg>
  );
}

function StarRow({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => {
        const filled = value >= n;
        const half   = !filled && value >= n - 0.5;
        return <StarIcon key={n} filled={filled} half={half} size={size} />;
      })}
    </div>
  );
}

// Interactive star picker for submitting a review
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1.5" dir="ltr">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5 transition-transform hover:scale-125"
        >
          <StarIcon filled={(hover || value) >= n} size={28} />
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Avg rating summary bar
// ─────────────────────────────────────────────────────────────────────────────
function RatingSummary({ average, count }: { average: number | null; count: number }) {
  if (count === 0) return null;
  const displayAvg = average ? average.toFixed(1) : "—";
  return (
    <div className="flex items-center gap-3" dir="ltr">
      <span
        className="text-3xl font-black"
        style={{ color: "#1A4D1F", fontFamily: "'Cairo','Tajawal',sans-serif" }}
      >
        {displayAvg}
      </span>
      <div className="flex flex-col gap-0.5">
        <StarRow value={average ?? 0} size={16} />
        <span className="text-xs font-bold text-gray-400">
          {count} {count === 1 ? "تقييم · avis" : "تقييمات · avis"}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single review card
// ─────────────────────────────────────────────────────────────────────────────
function ReviewCard({ review, lang }: { review: Review; lang: string }) {
  const date = new Date(review.createdAt).toLocaleDateString(
    lang === "ar" ? "ar-TN" : "fr-TN",
    { year: "numeric", month: "short", day: "numeric" },
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl border"
      style={{ background: "#FAFEF5", borderColor: "rgba(26,77,31,0.1)" }}
      dir="rtl"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-black text-[#1A4D1F]"
              style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}
            >
              {review.reviewerName ?? "مجهول · Anonyme"}
            </span>
            {review.isVerifiedBuyer && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: "rgba(26,77,31,0.1)", color: "#1A4D1F" }}
              >
                <CheckCircle size={10} />
                {lang === "ar" ? "مشترٍ موثوق" : "Acheteur vérifié"}
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-400 font-medium">{date}</span>
        </div>
        <StarRow value={review.rating} size={13} />
      </div>

      {review.comment && (
        <p
          className="text-sm text-gray-600 leading-relaxed"
          style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}
        >
          {review.comment}
        </p>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Write-review form
// ─────────────────────────────────────────────────────────────────────────────
function WriteReviewForm({
  articleId, supplierId, lang,
  onSuccess,
}: {
  articleId: number; supplierId: number; lang: string;
  onSuccess: () => void;
}) {
  const session  = getSession();
  const isGuest  = isGuestMode();

  const [stars,   setStars]   = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [done,    setDone]    = useState(false);

  if (!session && isGuest) {
    return (
      <p
        className="text-center text-xs text-[#1A4D1F]/40 font-bold py-2"
        style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}
        dir="rtl"
      >
        {lang === "ar"
          ? "سجّل الدخول لكتابة تقييم"
          : "Connectez-vous pour laisser un avis"}
      </p>
    );
  }
  if (!session) return null;

  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 text-[#1A4D1F]" dir="rtl">
        <CheckCircle size={18} />
        <span className="text-sm font-black" style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}>
          {lang === "ar"
            ? "شكراً! تم نشر تقييمك."
            : "Merci ! Votre avis est publié."}
        </span>
      </div>
    );
  }

  const canSubmit = stars > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-token": session.token ?? "",
        },
        body: JSON.stringify({ articleId, providerId: supplierId, rating: stars, comment: comment.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? (lang === "ar" ? "حدث خطأ" : "Erreur"));
        return;
      }
      setDone(true);
      onSuccess();
    } catch {
      setError(lang === "ar" ? "خطأ في الاتصال" : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl p-4 border-2 border-dashed space-y-3" style={{ borderColor: "rgba(26,77,31,0.18)" }} dir="rtl">
      <p className="text-xs font-black text-[#1A4D1F]/50 uppercase tracking-wider text-right" style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}>
        {lang === "ar" ? "اكتب تقييمك" : "Votre avis"}
      </p>

      <StarPicker value={stars} onChange={setStars} />

      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder={lang === "ar" ? "شاركنا رأيك (اختياري)..." : "Partagez votre expérience (optionnel)..."}
        rows={2}
        maxLength={400}
        className="w-full text-sm rounded-xl border p-3 outline-none resize-none"
        style={{
          fontFamily: "'Cairo','Tajawal',sans-serif",
          borderColor: "rgba(26,77,31,0.18)",
          background: "#FAFEF5",
          color: "#1A4D1F",
        }}
      />

      {error && (
        <div className="flex items-center gap-1.5 text-red-400 text-xs font-bold">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-30"
        style={{
          background: canSubmit ? "#1A4D1F" : "rgba(26,77,31,0.1)",
          color: canSubmit ? "white" : "#1A4D1F",
          boxShadow: canSubmit ? "0 4px 14px rgba(26,77,31,0.25)" : "none",
          fontFamily: "'Cairo','Tajawal',sans-serif",
        }}
      >
        {loading
          ? <Loader2 size={16} className="animate-spin" />
          : <Send size={15} />}
        {lang === "ar" ? "إرسال التقييم" : "Envoyer l'avis"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main exported component
// ─────────────────────────────────────────────────────────────────────────────
export function ProductReviews({
  articleId, supplierId, lang,
}: {
  articleId: number; supplierId: number; lang: string;
}) {
  const [data,       setData]       = useState<ReviewsData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  const session = getSession();

  const fetchReviews = () => {
    setLoading(true);
    fetch(`/api/reviews?articleId=${articleId}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ reviews: [], average: null, count: 0 }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReviews(); }, [articleId]);

  const sectionTitle = lang === "ar" ? "التقييمات والمراجعات" : "Avis & évaluations";

  return (
    <div className="px-4 pb-6 pt-2 space-y-4" style={{ fontFamily: "'Cairo','Tajawal',sans-serif" }}>
      {/* Divider */}
      <div className="h-px" style={{ background: "rgba(26,77,31,0.08)" }} />

      {/* Section header */}
      <div className="flex items-center justify-between" dir="rtl">
        <h3 className="text-sm font-black text-[#1A4D1F]">{sectionTitle}</h3>
        {data && <RatingSummary average={data.average} count={data.count} />}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 size={20} className="animate-spin text-[#1A4D1F]/30" />
        </div>
      )}

      {/* Reviews list */}
      {!loading && data && data.reviews.length > 0 && (
        <div className="space-y-3">
          {data.reviews.map(r => (
            <ReviewCard key={r.id} review={r} lang={lang} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && data && data.reviews.length === 0 && (
        <p
          className="text-center text-xs text-[#1A4D1F]/30 font-bold py-2"
          dir="rtl"
        >
          {lang === "ar" ? "لا توجد تقييمات بعد، كن أول من يقيّم!" : "Aucun avis encore — soyez le premier !"}
        </p>
      )}

      {/* Write review toggle */}
      {session && !hasReviewed && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-2xl font-black text-sm border-2 border-dashed flex items-center justify-center gap-2 transition-all hover:bg-[#1A4D1F]/5"
          style={{ borderColor: "rgba(255,165,0,0.35)", color: "#1A4D1F", fontFamily: "'Cairo','Tajawal',sans-serif" }}
          dir="rtl"
        >
          <Star size={15} className="text-[#FFA500]" />
          {lang === "ar" ? "اكتب تقييماً" : "Rédiger un avis"}
        </button>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <WriteReviewForm
              articleId={articleId}
              supplierId={supplierId}
              lang={lang}
              onSuccess={() => {
                setShowForm(false);
                setHasReviewed(true);
                fetchReviews();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guest prompt */}
      {!session && isGuestMode() && (
        <p
          className="text-center text-xs font-bold py-1"
          style={{ color: "rgba(26,77,31,0.35)", fontFamily: "'Cairo','Tajawal',sans-serif" }}
          dir="rtl"
        >
          {lang === "ar"
            ? "سجّل الدخول لإضافة تقييم"
            : "Connectez-vous pour laisser un avis"}
        </p>
      )}
    </div>
  );
}
