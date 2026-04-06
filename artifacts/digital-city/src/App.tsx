import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/language";
import { CartProvider } from "@/lib/cart";
import { NotificationsProvider } from "@/lib/notifications";
import { getSession, type Role } from "@/lib/auth";
import { Splash } from "@/components/splash";

import Home         from "./pages/home";
import Services     from "./pages/services";
import Order        from "./pages/order";
import HotelBooking from "./pages/hotel-booking";
import ProviderStore from "./pages/provider-store";
import Admin        from "./pages/admin";
import Provider     from "./pages/provider";
import Delivery     from "./pages/delivery";
import Login        from "./pages/login";
import OrderHistory from "./pages/order-history";
import Deals        from "./pages/deals";
import TaxiPage     from "./pages/taxi";
import TaxiDriver   from "./pages/taxi-driver";
import CarRental    from "./pages/car-rental";
import SosPage      from "./pages/sos";
import LawyerPage     from "./pages/lawyer";
import ResetPassword  from "./pages/reset-password";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

const ROLE_HOME: Record<Role, string> = {
  client:      "/home",
  admin:       "/admin",
  super_admin: "/admin",
  manager:     "/admin",
  provider:    "/provider",
  driver:      "/delivery",
  delivery:    "/delivery",
  customer:    "/home",
  taxi_driver: "/taxi-driver",
};

const SPLASH_KEY = "sanad_splash_seen";

// ─── Splash Route ─────────────────────────────────────────────────────────────
// Shows animated splash once per session, then redirects to /home.
function SplashRoute() {
  const [, navigate] = useLocation();
  const alreadySeen = !!sessionStorage.getItem(SPLASH_KEY);

  useEffect(() => {
    if (alreadySeen) {
      navigate("/home");
    }
  }, []);

  if (alreadySeen) return null;

  const handleDone = () => {
    sessionStorage.setItem(SPLASH_KEY, "1");
    navigate("/home");
  };

  return <Splash onDone={handleDone} />;
}

function ProtectedRoute({
  component: Comp,
  roles,
}: {
  component: React.ComponentType;
  roles: Role[];
}) {
  const [, navigate] = useLocation();
  const session = getSession();

  useEffect(() => {
    if (!session) {
      navigate("/auth");
    } else if (!roles.includes(session.role)) {
      navigate(ROLE_HOME[session.role]);
    }
  }, []);

  if (!session || !roles.includes(session.role)) return null;
  return <Comp />;
}

function LoginRoute() {
  const [, navigate] = useLocation();
  const session = getSession();

  useEffect(() => {
    if (session) navigate(ROLE_HOME[session.role]);
  }, []);

  if (session) return null;
  return <Login />;
}

function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div
      className="min-h-screen flex items-center justify-center flex-col gap-6"
      style={{ background: "#FFA500" }}
      dir="rtl"
    >
      <div
        className="rounded-3xl p-10 text-center shadow-xl border border-[#1A4D1F]/30"
        style={{ background: "#FFFDE7" }}
      >
        <p className="text-7xl font-black text-[#1A4D1F] mb-3">404</p>
        <p className="text-[#004D40] font-bold text-lg mb-6">
          الصفحة غير موجودة · Page introuvable
        </p>
        <button
          onClick={() => navigate("/login")}
          className="px-6 py-3 rounded-xl font-black text-black text-sm"
          style={{ background: "#1A4D1F" }}
        >
          العودة للرئيسية · Retour
        </button>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      {/* ── Entry: splash (once per session) then /home ── */}
      <Route path="/" component={SplashRoute} />

      {/* ── Public home — visible with or without login ── */}
      <Route path="/home" component={Home} />

      {/* ── Auth pages ── */}
      <Route path="/auth"  component={LoginRoute} />
      <Route path="/login" component={LoginRoute} />

      {/* ── Client protected pages ── */}
      <Route path="/services">
        {() => <ProtectedRoute component={Services}      roles={["client", "customer"]} />}
      </Route>
      <Route path="/order/:id">
        {() => <ProtectedRoute component={Order}         roles={["client", "customer"]} />}
      </Route>
      <Route path="/store/:id">
        {() => <ProtectedRoute component={ProviderStore} roles={["client", "customer"]} />}
      </Route>
      <Route path="/hotel/:id">
        {() => <ProtectedRoute component={HotelBooking}  roles={["client", "customer"]} />}
      </Route>

      {/* ── Order history (multi-role) ── */}
      <Route path="/orders/history">
        {() => <ProtectedRoute component={OrderHistory} roles={["client", "customer", "provider", "delivery", "driver"]} />}
      </Route>

      {/* ── Deals / promotions (public) ── */}
      <Route path="/deals" component={Deals} />

      {/* ── Role dashboards ── */}
      <Route path="/admin">
        {() => <ProtectedRoute component={Admin}    roles={["admin", "super_admin", "manager"]} />}
      </Route>
      <Route path="/provider">
        {() => <ProtectedRoute component={Provider} roles={["provider"]} />}
      </Route>
      <Route path="/delivery">
        {() => <ProtectedRoute component={Delivery} roles={["delivery"]} />}
      </Route>

      {/* ── Taxi pages ── */}
      <Route path="/taxi" component={TaxiPage} />
      <Route path="/taxi-driver">
        {() => <ProtectedRoute component={TaxiDriver} roles={["taxi_driver", "admin", "super_admin", "manager"]} />}
      </Route>

      {/* ── Car rental, SOS & Lawyer ── */}
      <Route path="/car-rental" component={CarRental} />
      <Route path="/sos" component={SosPage} />
      <Route path="/lawyer" component={LawyerPage} />

      {/* ── Password reset (public) ── */}
      <Route path="/reset-password" component={ResetPassword} />

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <CartProvider>
          <NotificationsProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </NotificationsProvider>
        </CartProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
