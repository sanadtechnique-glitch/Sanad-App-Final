import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import { getSession } from "@/lib/auth";
import { isGuestMode } from "@/lib/guest";

// Pages where the FAB must NOT appear
const HIDDEN_PATHS = new Set(["/", "/auth", "/login", "/reset-password", "/cart"]);

// Roles that cannot place orders — FAB is irrelevant for them
const NON_SHOPPER_ROLES = new Set([
  "provider", "admin", "super_admin", "manager", "driver", "delivery", "taxi_driver",
]);

export function FloatingCartFAB() {
  const [location, navigate] = useLocation();
  const { cart, itemCount } = useCart();
  const session  = getSession();
  const isGuest  = isGuestMode();

  // Animate the badge when item count changes
  const [bounce, setBounce]    = useState(false);
  const prevCountRef = useRef(itemCount);
  useEffect(() => {
    if (itemCount !== prevCountRef.current && itemCount > 0) {
      setBounce(true);
      const t = setTimeout(() => setBounce(false), 400);
      prevCountRef.current = itemCount;
      return () => clearTimeout(t);
    }
    prevCountRef.current = itemCount;
  }, [itemCount]);

  // ── Visibility rules ───────────────────────────────────────────────────────
  // 1. Hidden on auth/splash pages
  const pathHidden = HIDDEN_PATHS.has(location) || location.startsWith("/auth");
  if (pathHidden) return null;

  // 2. Hidden for non-shopper roles (providers, admins, drivers…)
  if (session && NON_SHOPPER_ROLES.has(session.role)) return null;

  // 3. Visible for guest and customer/client roles (even with empty cart, still
  //    visible so user knows they can build a cart — just navigates to /services)
  const hasItems = itemCount > 0 && cart.supplierId !== null;

  const handleClick = () => {
    if (hasItems) {
      navigate("/cart");
    } else {
      navigate("/services");
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label={hasItems ? `سلة التسوق — ${itemCount} عنصر` : "تصفح الخدمات"}
      style={{
        position:   "fixed",
        bottom:     "80px",    // above the bottom nav bar (~60px tall) + comfortable gap
        right:      "16px",    // visually right on both RTL and LTR screens
        zIndex:     999,
        background: hasItems
          ? "linear-gradient(135deg,#1A4D1F 0%,#2E7D32 100%)"
          : "linear-gradient(135deg,#1A4D1F 0%,#2E7D32 100%)",
        borderRadius:  "50%",
        width:         "56px",
        height:        "56px",
        display:       "flex",
        alignItems:    "center",
        justifyContent:"center",
        boxShadow:     "0 4px 20px rgba(26,77,31,0.45), 0 1px 4px rgba(0,0,0,0.15)",
        border:        "none",
        cursor:        "pointer",
        transition:    "transform 0.15s ease, box-shadow 0.15s ease",
        opacity:       hasItems ? 1 : 0.6,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.10)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 28px rgba(26,77,31,0.55), 0 2px 6px rgba(0,0,0,0.18)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(26,77,31,0.45), 0 1px 4px rgba(0,0,0,0.15)";
      }}
    >
      {/* Cart icon */}
      <ShoppingCart size={24} color="#ffffff" strokeWidth={2.2} />

      {/* Item count badge — only shown when cart has items */}
      {hasItems && (
        <span
          style={{
            position:        "absolute",
            top:             "-4px",
            insetInlineEnd:  "-4px",
            background:      "#FFA500",
            color:           "#fff",
            borderRadius:    "50%",
            minWidth:        "20px",
            height:          "20px",
            fontSize:        "11px",
            fontWeight:      900,
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            padding:         "0 4px",
            boxShadow:       "0 0 0 2px #fff",
            lineHeight:      1,
            transform:       bounce ? "scale(1.4)" : "scale(1)",
            transition:      "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </button>
  );
}
