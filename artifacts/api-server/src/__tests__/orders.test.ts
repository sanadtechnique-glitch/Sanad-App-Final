/**
 * Integration Tests — Order Logic (Create / Status)
 *
 * The database is mocked — no real DB connection is needed.
 * Tests verify that:
 *   - Valid orders are created and persisted with the correct fields
 *   - Missing required fields return 400
 *   - Non-existent provider returns 400
 *   - Order status update requires authentication
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock @workspace/db ────────────────────────────────────────────────────
vi.mock("@workspace/db", () => {
  const mockDb = {
    _providerRows: [] as any[],
    _insertedRow: null as any,
    _orderRows: [] as any[],

    select:    vi.fn().mockReturnThis(),
    from:      vi.fn().mockReturnThis(),
    orderBy:   vi.fn().mockReturnThis(),
    where:     vi.fn().mockImplementation(function (this: any) {
      // Distinguish between provider lookup and order lookup by context
      return Promise.resolve(this._activeRows ?? []);
    }),

    insert:    vi.fn().mockReturnThis(),
    into:      vi.fn().mockReturnThis(),
    values:    vi.fn().mockReturnThis(),
    returning: vi.fn().mockImplementation(function (this: any) {
      return Promise.resolve(this._insertedRow ? [this._insertedRow] : []);
    }),

    update: vi.fn().mockReturnThis(),
    set:    vi.fn().mockReturnThis(),
  };

  return {
    db:                    mockDb,
    ordersTable:           {},
    serviceProvidersTable: {},
    deliveryStaffTable:    {},
    usersTable:            {},
  };
});

// ── Mock socket (no real WebSocket server needed) ─────────────────────────
vi.mock("../lib/socket", () => ({
  emitNewOrder:    vi.fn(),
  emitOrderTaken:  vi.fn(),
  emitOrderStatus: vi.fn(),
}));

// ── Mock auth middleware (allow all requests in tests) ────────────────────
vi.mock("../lib/authMiddleware", () => ({
  requireAdmin: vi.fn((_req: any, _res: any, next: any) => next()),
  requireStaff: vi.fn((_req: any, _res: any, next: any) => next()),
  requireAuth:  vi.fn((_req: any, _res: any, next: any) => next()),
}));

import express from "express";
import ordersRouter from "../routes/orders";
import { db } from "@workspace/db";
import { emitNewOrder } from "../lib/socket";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", ordersRouter);
  return app;
}

async function post(app: any, path: string, body: object) {
  const { default: supertest } = await import("supertest");
  return supertest(app).post(path).send(body).set("Content-Type", "application/json");
}

async function patch(app: any, path: string, body: object, token?: string) {
  const { default: supertest } = await import("supertest");
  const req = supertest(app).patch(path).send(body).set("Content-Type", "application/json");
  if (token) req.set("X-Session-Token", token);
  return req;
}

// ─────────────────────────────────────────────────────────────────────────────

const MOCK_PROVIDER = {
  id: 1,
  name: "Best Pharmacy",
  nameAr: "أحسن صيدلية",
  isAvailable: true,
};

const MOCK_ORDER = {
  id: 101,
  customerName: "سارة",
  customerPhone: "20123456",
  customerAddress: "شارع الحرية، بنقردان",
  serviceProviderId: 1,
  serviceProviderName: "أحسن صيدلية",
  serviceType: "pharmacy",
  status: "searching_for_driver",
  customerId: null,
  delegationId: null,
  notes: null,
  photoUrl: null,
  deliveryFee: null,
  deliveryStaffId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─────────────────────────────────────────────────────────────────────────────

describe("Order Logic — POST /api/orders", () => {
  let app: ReturnType<typeof buildApp>;
  const mockDb = db as any;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();

    // Default DB chains
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.orderBy.mockReturnValue(mockDb);
    mockDb.insert.mockReturnValue(mockDb);
    mockDb.values.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue(mockDb);
    mockDb.update.mockReturnValue(mockDb);
  });

  // ── Test 1: Valid order → 201 + correct fields ─────────────────────────

  it("creates an order and returns 201 with the saved order data", async () => {
    // Provider lookup returns the mock provider
    mockDb.where.mockResolvedValueOnce([MOCK_PROVIDER]);
    // Insert returns the mock order
    mockDb.returning.mockResolvedValueOnce([MOCK_ORDER]);

    const res = await post(app, "/api/orders", {
      customerName:      "سارة",
      customerPhone:     "20123456",
      customerAddress:   "شارع الحرية، بنقردان",
      serviceProviderId: "1",
      serviceType:       "pharmacy",
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(101);
    expect(res.body.customerName).toBe("سارة");
    expect(res.body.status).toBe("searching_for_driver");
    expect(res.body.serviceProviderName).toBe("أحسن صيدلية");
    // Password / sensitive data must not be present
    expect(res.body.password).toBeUndefined();
  });

  // ── Test 2: Order creation broadcasts to all drivers ──────────────────

  it("broadcasts the new order to all connected drivers via socket", async () => {
    mockDb.where.mockResolvedValueOnce([MOCK_PROVIDER]);
    mockDb.returning.mockResolvedValueOnce([MOCK_ORDER]);

    await post(app, "/api/orders", {
      customerName:      "أمين",
      customerPhone:     "98765432",
      customerAddress:   "شارع الجمهورية",
      serviceProviderId: "1",
      serviceType:       "grocery",
    });

    expect(emitNewOrder).toHaveBeenCalledOnce();
    expect(emitNewOrder).toHaveBeenCalledWith(expect.objectContaining({ id: 101 }));
  });

  // ── Test 3: Missing required fields → 400 ─────────────────────────────

  it("returns 400 when required fields are missing", async () => {
    const res = await post(app, "/api/orders", {
      customerName: "سارة",
      // customerAddress missing
      serviceProviderId: "1",
      serviceType: "pharmacy",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  // ── Test 4: Non-existent provider → 400 ──────────────────────────────

  it("returns 400 when the service provider does not exist", async () => {
    // Provider lookup returns empty array
    mockDb.where.mockResolvedValueOnce([]);

    const res = await post(app, "/api/orders", {
      customerName:      "خالد",
      customerAddress:   "حي النور",
      serviceProviderId: "999",
      serviceType:       "restaurant",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not found/i);
  });

  // ── Test 5: customerId is stored correctly ─────────────────────────────

  it("stores the customerId when provided", async () => {
    mockDb.where.mockResolvedValueOnce([MOCK_PROVIDER]);
    mockDb.returning.mockResolvedValueOnce([{ ...MOCK_ORDER, customerId: 42 }]);

    const res = await post(app, "/api/orders", {
      customerName:      "نور",
      customerAddress:   "شارع الاستقلال",
      serviceProviderId: "1",
      serviceType:       "pharmacy",
      customerId:        42,
    });

    expect(res.status).toBe(201);
    expect(res.body.customerId).toBe(42);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Order Logic — PATCH /api/orders/:id (status update)", () => {
  let app: ReturnType<typeof buildApp>;
  const mockDb = db as any;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.update.mockReturnValue(mockDb);
    mockDb.set.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.returning.mockReturnValue(mockDb);
  });

  // ── Test 6: Valid status update saves correctly ─────────────────────────

  it("updates order status and returns the updated order", async () => {
    const currentOrder = { ...MOCK_ORDER, status: "pending" };
    const updatedOrder = { ...MOCK_ORDER, status: "accepted" };

    // PATCH /orders/:id makes TWO DB calls:
    //   1. SELECT: db.select().from().where()           → resolves to [currentOrder]
    //   2. UPDATE: db.update().set().where().returning() → where() chains; returning() resolves
    mockDb.where
      .mockResolvedValueOnce([currentOrder])  // Call 1 — SELECT (awaited directly on where)
      .mockReturnValueOnce(mockDb);           // Call 2 — UPDATE chain (returning resolves)
    mockDb.returning.mockResolvedValueOnce([updatedOrder]);

    const res = await patch(app, "/api/orders/101", { status: "accepted" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("accepted");
  });

  // ── Test 7: Invalid status → 400 ─────────────────────────────────────

  it("returns 400 for an unknown status value", async () => {
    const res = await patch(app, "/api/orders/101", { status: "flying_to_moon" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid status/i);
  });

  // ── Test 8: deliveryFee NaN protection ────────────────────────────────

  it("returns 400 when deliveryFee is not a valid number", async () => {
    const res = await patch(app, "/api/orders/101", { deliveryFee: "not_a_number" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid deliveryfee/i);
  });

  // ── Test 9: Valid deliveryFee is accepted ─────────────────────────────

  it("accepts a valid numeric deliveryFee string", async () => {
    const currentOrder = { ...MOCK_ORDER };
    const updatedOrder = { ...MOCK_ORDER, deliveryFee: 7.5 };

    // SELECT resolves on .where(); UPDATE resolves on .returning()
    mockDb.where
      .mockResolvedValueOnce([currentOrder])  // SELECT
      .mockReturnValueOnce(mockDb);           // UPDATE chain
    mockDb.returning.mockResolvedValueOnce([updatedOrder]);

    const res = await patch(app, "/api/orders/101", { deliveryFee: "7.5" });
    expect(res.status).toBe(200);
    expect(res.body.deliveryFee).toBe(7.5);
  });
});
