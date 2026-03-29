import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/lib/language";
import Home from "./pages/home";
import Services from "./pages/services";
import Order from "./pages/order";
import HotelBooking from "./pages/hotel-booking";
import ProviderStore from "./pages/provider-store";
import Admin from "./pages/admin";
import Provider from "./pages/provider";
import Delivery from "./pages/delivery";
import Login from "./pages/login";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 1000 * 60 * 5, retry: 1 },
  },
});

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-[#D4AF37] mb-2">404</h1>
        <p className="text-white/60">الصفحة غير موجودة · Page introuvable</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/services" component={Services} />
      <Route path="/order/:id" component={Order} />
      <Route path="/store/:id" component={ProviderStore} />
      <Route path="/hotel/:id" component={HotelBooking} />
      <Route path="/login" component={Login} />
      <Route path="/admin" component={Admin} />
      <Route path="/provider" component={Provider} />
      <Route path="/delivery" component={Delivery} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
