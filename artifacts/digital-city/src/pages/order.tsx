import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { useListServices, useCreateOrder } from "@workspace/api-client-react";
import { ChevronLeft, CheckCircle2, Building2, AlertCircle } from "lucide-react";

// Form validation schema matching CreateOrderRequest
const orderSchema = z.object({
  customerName: z.string().min(3, "Name must be at least 3 characters"),
  customerAddress: z.string().min(5, "Please provide a detailed address"),
  notes: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderSchema>;

export default function Order() {
  const { id } = useParams();
  const providerId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const [isSuccess, setIsSuccess] = useState(false);

  // Fetch provider details
  const { data: services, isLoading: isLoadingProvider } = useListServices();
  const provider = services?.find(s => s.id === providerId);

  // Mutation hook
  const createOrderMutation = useCreateOrder();

  const { register, handleSubmit, formState: { errors } } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema)
  });

  const onSubmit = async (data: OrderFormValues) => {
    if (!provider) return;

    try {
      await createOrderMutation.mutateAsync({
        data: {
          ...data,
          serviceProviderId: provider.id,
          serviceType: provider.category
        }
      });
      setIsSuccess(true);
      
      // Auto redirect after 3 seconds
      setTimeout(() => {
        setLocation("/services");
      }, 3000);
    } catch (error) {
      console.error("Order failed", error);
    }
  };

  if (isLoadingProvider) {
    return (
      <Layout>
        <div className="pt-20 px-4 flex justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!provider) {
    return (
      <Layout>
        <div className="pt-20 px-4 text-center">
          <h2 className="text-2xl font-bold text-white">Provider not found</h2>
          <Link href="/services">
            <Button variant="outline" className="mt-4">Back to Services</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="pt-8 px-4 sm:px-6 max-w-2xl mx-auto pb-24">
        
        <div className="flex items-center gap-4 mb-8">
          <Link href="/services" className="w-10 h-10 rounded-full glass-panel flex items-center justify-center hover:bg-white/10 transition-colors">
            <ChevronLeft size={20} className="text-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Place Order</h1>
            <p className="text-muted-foreground text-sm">طلب جديد</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel rounded-3xl p-12 text-center flex flex-col items-center border-primary/30"
            >
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-6 gold-glow">
                <CheckCircle2 className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-3xl font-display font-bold text-white mb-2">Order Confirmed!</h2>
              <p className="text-xl font-display text-primary mb-6">تم تأكيد طلبك</p>
              <p className="text-muted-foreground mb-8">Your order has been sent directly to {provider.nameAr}. They will process it shortly.</p>
              <Button variant="outline" onClick={() => setLocation("/services")}>
                Return to Services
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Provider Summary Card */}
              <div className="glass-panel rounded-2xl p-5 border-primary/20 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center">
                  <Building2 className="text-primary" size={24} />
                </div>
                <div>
                  <p className="text-xs text-primary font-bold tracking-wider uppercase mb-1">ORDERING FROM</p>
                  <h3 className="text-lg font-display font-bold text-white">{provider.nameAr}</h3>
                  <p className="text-sm text-muted-foreground">{provider.name}</p>
                </div>
              </div>

              {/* Order Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="glass-panel rounded-3xl p-6 sm:p-8 space-y-6">
                
                {createOrderMutation.isError && (
                  <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-3">
                    <AlertCircle className="text-destructive shrink-0 mt-0.5" size={18} />
                    <p className="text-sm text-destructive font-medium">Failed to submit order. Please try again.</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white ml-1">Full Name <span className="text-primary">*</span></label>
                  <input
                    {...register("customerName")}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="John Doe / فلان الفلاني"
                  />
                  {errors.customerName && <p className="text-xs text-destructive ml-1">{errors.customerName.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white ml-1">Delivery Address <span className="text-primary">*</span></label>
                  <input
                    {...register("customerAddress")}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="Street, Building, Landmark..."
                  />
                  {errors.customerAddress && <p className="text-xs text-destructive ml-1">{errors.customerAddress.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white ml-1">Order Details / Notes</label>
                  <textarea
                    {...register("notes")}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all min-h-[120px] resize-y"
                    placeholder="What do you need? What should we know?"
                  />
                </div>

                <div className="pt-4 border-t border-white/10">
                  <Button 
                    type="submit" 
                    className="w-full h-14 text-lg font-bold"
                    isLoading={createOrderMutation.isPending}
                  >
                    Submit Order | تأكيد الطلب
                  </Button>
                  <p className="text-center text-xs text-muted-foreground mt-4 font-medium flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Secure internal communication. No phone numbers shared.
                  </p>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
