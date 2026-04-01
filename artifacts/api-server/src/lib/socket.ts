import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "node:http";

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    const role = socket.handshake.query.role as string | undefined;
    const userId = socket.handshake.query.userId as string | undefined;

    if (role === "driver" || role === "delivery") {
      socket.join("drivers");
    }
    if (role === "customer" && userId) {
      socket.join(`customer:${userId}`);
    }
    if (role === "admin" || role === "manager" || role === "super_admin") {
      socket.join("admins");
    }
    if (role === "provider") {
      socket.join(`provider:${userId}`);
    }
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

// Emit new order to ALL drivers (broadcast)
export function emitNewOrder(order: Record<string, unknown>) {
  try {
    getIO().to("drivers").emit("new_order", order);
    getIO().to("admins").emit("order_created", order);
  } catch {}
}

// Emit order taken — removes it from all other drivers' screens
export function emitOrderTaken(orderId: number, driverName: string, customerId?: number | string | null) {
  try {
    getIO().to("drivers").emit("order_taken", { orderId, driverName });
    if (customerId != null) {
      getIO().to(`customer:${customerId}`).emit("driver_assigned", { orderId, driverName });
      getIO().to(`customer:${customerId}`).emit("order_status", { orderId, status: "driver_accepted", driverName });
    }
    getIO().to("admins").emit("order_updated", { orderId });
  } catch {}
}

// Emit generic order status change
export function emitOrderStatus(orderId: number, status: string, extra?: Record<string, unknown> & { order?: { customerId?: number | null } }) {
  try {
    getIO().to("drivers").emit("order_status", { orderId, status, ...extra });
    getIO().to("admins").emit("order_updated", { orderId, status });
    // Also notify the customer who placed the order
    const customerId = extra?.order?.customerId;
    if (customerId != null) {
      getIO().to(`customer:${customerId}`).emit("order_status", { orderId, status });
    }
  } catch {}
}
