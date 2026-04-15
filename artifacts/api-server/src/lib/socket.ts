import { Server as SocketIOServer } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { getSession } from "./sessionStore";

let io: SocketIOServer | null = null;

const ADMIN_ROLES  = new Set(["super_admin", "admin", "manager"]);
const STAFF_ROLES  = new Set(["super_admin", "admin", "manager", "provider", "driver"]);

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // [C-5 FIXED] Token-validated room assignment
  io.on("connection", async (socket) => {
    const token  = socket.handshake.query.token  as string | undefined;
    const userId = socket.handshake.query.userId as string | undefined;

    // Public room for customers (order tracking by customerId only, no sensitive data)
    // Customer sockets: validate token OR allow anonymous with userId only for their own room
    if (token) {
      const session = await getSession(token).catch(() => null);

      if (!session) {
        // Invalid/expired token — disconnect immediately
        socket.disconnect(true);
        return;
      }

      // Join rooms based on verified role
      if (ADMIN_ROLES.has(session.role)) {
        socket.join("admins");
      }

      if (session.role === "driver") {
        socket.join("drivers");
        socket.join(`driver:${session.userId}`);
      }

      if (session.role === "provider") {
        socket.join(`provider:${session.userId}`);
      }

      if (session.role === "taxi_driver") {
        socket.join("taxi_drivers");
        socket.join(`taxi_driver:${session.userId}`);
      }

      // All authenticated users join their personal room for push-style events
      socket.join(`user:${session.userId}`);

    } else if (userId) {
      // Unauthenticated connection — allow ONLY the personal customer room (order status updates)
      // They cannot join "drivers", "admins", or any privileged rooms
      socket.join(`customer:${userId}`);
    } else {
      // No token, no userId — disconnect
      socket.disconnect(true);
    }
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

// Emit new order to ALL verified drivers
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

// ── TAXI ──────────────────────────────────────────────────────────────────────
export function emitTaxiRequest(driverUserId: number, request: Record<string, unknown>) {
  try {
    getIO().to(`taxi_driver:${driverUserId}`).emit("taxi_request", request);
  } catch {}
}

export function emitTaxiResponse(customerId: number, payload: Record<string, unknown>) {
  try {
    getIO().to(`customer:${customerId}`).emit("taxi_response", payload);
  } catch {}
}

export function emitTaxiDriverUpdate(driverUserId: number, payload: Record<string, unknown>) {
  try {
    getIO().to(`taxi_driver:${driverUserId}`).emit("taxi_update", payload);
  } catch {}
}

// Emit generic order status change
export function emitOrderStatus(orderId: number, status: string, extra?: Record<string, unknown> & { order?: { customerId?: number | null } }) {
  try {
    getIO().to("drivers").emit("order_status", { orderId, status, ...extra });
    getIO().to("admins").emit("order_updated", { orderId, status });
    const customerId = extra?.order?.customerId;
    if (customerId != null) {
      getIO().to(`customer:${customerId}`).emit("order_status", { orderId, status });
    }
  } catch {}
}
