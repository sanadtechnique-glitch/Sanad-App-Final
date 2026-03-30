import { useEffect, useState } from "react";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

const ROLE_HOME: Record<Role, string> = {
  client:   "/",
  admin:    "/admin",
  provider: "/provider",
  delivery: "/delivery",
};

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
      navigate("/login");
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
        className="rounded-3xl p-10 text-center shadow-xl border border-[#2E7D32]/30"
        style={{ background: "#FFFDE7" }}
      >
        <p className="text-7xl font-black text-[#2E7D32] mb-3">404</p>
        <p className="text-[#004D40] font-bold text-lg mb-6">
          الصفحة غير موجودة · Page introuvable
        </p>
        <button
          onClick={() => navigate("/login")}
          className="px-6 py-3 rounded-xl font-black text-black text-sm"
          style={{ background: "#2E7D32" }}
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
      <Route path="/login" component={LoginRoute} />

      <Route path="/">
        {() => <ProtectedRoute component={Home}         roles={["client"]} />}
      </Route>
      <Route path="/services">
        {() => <ProtectedRoute component={Services}     roles={["client"]} />}
      </Route>
      <Route path="/order/:id">
        {() => <ProtectedRoute component={Order}        roles={["client"]} />}
      </Route>
      <Route path="/store/:id">
        {() => <ProtectedRoute component={ProviderStore} roles={["client"]} />}
      </Route>
      <Route path="/hotel/:id">
        {() => <ProtectedRoute component={HotelBooking} roles={["client"]} />}
      </Route>

      <Route path="/admin">
        {() => <ProtectedRoute component={Admin}    roles={["admin"]} />}
      </Route>
      <Route path="/provider">
        {() => <ProtectedRoute component={Provider} roles={["provider"]} />}
      </Route>
      <Route path="/delivery">
        {() => <ProtectedRoute component={Delivery} roles={["delivery"]} />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

const SPLASH_KEY = "sanad_splash_seen";

export default function App() {
  const [showSplash, setShowSplash] = useState(
    () => !sessionStorage.getItem(SPLASH_KEY)
  );

  const handleSplashDone = () => {
    sessionStorage.setItem(SPLASH_KEY, "1");
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <CartProvider>
          <NotificationsProvider>
            {showSplash ? (
              <Splash onDone={handleSplashDone} />
            ) : (
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
            )}
          </NotificationsProvider>
        </CartProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
