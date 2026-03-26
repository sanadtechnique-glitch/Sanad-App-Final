import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { useListOrders, useUpdateOrderStatus, getListOrdersQueryKey } from "@workspace/api-client-react";
import { OrderStatus } from "@workspace/api-client-react";
import { Filter, Search, Clock, CheckCircle, Package, Truck, XCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_CONFIG = {
  [OrderStatus.pending]: { color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: Clock, label: "Pending" },
  [OrderStatus.confirmed]: { color: "text-blue-400 bg-blue-400/10 border-blue-400/20", icon: CheckCircle, label: "Confirmed" },
  [OrderStatus.in_progress]: { color: "text-purple-400 bg-purple-400/10 border-purple-400/20", icon: Package, label: "In Progress" },
  [OrderStatus.delivered]: { color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: Truck, label: "Delivered" },
  [OrderStatus.cancelled]: { color: "text-destructive bg-destructive/10 border-destructive/20", icon: XCircle, label: "Cancelled" },
};

export default function Admin() {
  const queryClient = useQueryClient();
  const { data: orders, isLoading, isRefetching, refetch } = useListOrders();
  const updateStatusMutation = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        // Invalidate cache to refetch orders after update
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      }
    }
  });

  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const handleStatusChange = async (orderId: number, newStatus: OrderStatus) => {
    if (updateStatusMutation.isPending) return;
    await updateStatusMutation.mutateAsync({
      id: orderId,
      data: { status: newStatus }
    });
  };

  const filteredOrders = orders?.filter(order => {
    const matchesFilter = filter === "all" || order.status === filter;
    const matchesSearch = 
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      order.serviceProviderName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Sort newest first

  return (
    <Layout>
      <div className="p-4 sm:p-8 max-w-[1400px] mx-auto pb-24 md:pb-8">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-1">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm">لوحة تحكم الإدارة</p>
          </div>
          
          <button 
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel text-sm font-medium hover:text-primary transition-colors"
          >
            <RefreshCw size={16} className={cn(isRefetching && "animate-spin")} />
            Refresh Data
          </button>
        </div>

        {/* Filters and Search */}
        <div className="glass-panel rounded-2xl p-4 mb-8 flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Search by customer or provider..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 lg:pb-0">
            <Filter size={18} className="text-muted-foreground hidden lg:block mr-2" />
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap border transition-all",
                filter === "all" ? "bg-white text-black border-white" : "bg-transparent text-muted-foreground border-white/10 hover:border-white/30"
              )}
            >
              All Orders
            </button>
            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
              <button
                key={status}
                onClick={() => setFilter(status as OrderStatus)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap border transition-all flex items-center gap-2",
                  filter === status ? config.color : "bg-transparent text-muted-foreground border-white/10 hover:border-white/30"
                )}
              >
                <config.icon size={14} />
                {config.label}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table */}
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Order ID / Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Provider / Type</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    </td>
                  </tr>
                ) : filteredOrders?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      No orders found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredOrders?.map((order) => {
                    const statusConfig = STATUS_CONFIG[order.status];
                    const StatusIcon = statusConfig.icon;
                    
                    return (
                      <tr key={order.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-mono text-sm text-white mb-1">#{order.id.toString().padStart(5, '0')}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(order.createdAt), "MMM d, h:mm a")}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-white mb-1">{order.customerName}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={order.customerAddress}>
                            {order.customerAddress}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-primary mb-1">{order.serviceProviderName}</div>
                          <div className="text-xs px-2 py-0.5 rounded bg-white/10 inline-block uppercase tracking-wider text-muted-foreground">
                            {order.serviceType}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border", statusConfig.color)}>
                            <StatusIcon size={14} />
                            {statusConfig.label}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <select 
                            className="bg-black/50 border border-white/20 text-white text-sm rounded-lg px-3 py-2 focus:ring-primary focus:border-primary outline-none cursor-pointer"
                            value={order.status}
                            onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                            disabled={updateStatusMutation.isPending}
                          >
                            {Object.entries(STATUS_CONFIG).map(([val, conf]) => (
                              <option key={val} value={val} className="bg-zinc-900 text-white">
                                Mark {conf.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
