/**
 * Integration Tests — Auth Logic (Login / Register)
 *
 * The database is mocked so no real DB connection is needed.
 * Each test controls exactly which user the DB returns.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock @workspace/db BEFORE any imports that use it ─────────────────────
vi.mock("@workspace/db", () => {
  const mockDb = {
    _users: [] as any[],
    _returnRow: null as any,

    /** Fluent chain: db.select().from().where()  → resolves to _users array */
    select: vi.fn().mockReturnThis(),
    from:   vi.fn().mockReturnThis(),
    where:  vi.fn().mockImplementation(function (this: any) {
      return Promise.resolve(this._users);
    }),
    orderBy: vi.fn().mockReturnThis(),

    /** Fluent chain: db.insert().values().returning() → resolves to [_returnRow] */
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockImplementation(function (this: any) {
      return Promise.resolve(this._returnRow ? [this._returnRow] : []);
    }),
  };

  return { db: mockDb, usersTable: {}, serviceProvidersTable: {}, deliveryStaffTable: {} };
});

// ── Mock socket so no real server is created ──────────────────────────────
vi.mock("../lib/socket", () => ({
  emitNewOrder:    vi.fn(),
  emitOrderTaken:  vi.fn(),
  emitOrderStatus: vi.fn(),
}));

import express from "express";
import usersRouter from "../routes/users";
import { db } from "@workspace/db";

// Minimal Express test app — no sockets, no port binding
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", usersRouter);
  return app;
}

// Helper: make a POST request to the test app
async function post(app: ReturnType<typeof buildApp>, path: string, body: object) {
  const { default: supertest } = await import("supertest");
  return supertest(app).post(path).send(body).set("Content-Type", "application/json");
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Auth — admin-login endpoint", () => {
  let app: ReturnType<typeof buildApp>;
  const mockDb = db as any;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();

    // Default: fresh fluent chain that resolves _users from mockDb
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockImplementation(() => Promise.resolve(mockDb._users));
  });

  // ── helpers ────────────────────────────────────────────────────────────────

  function seedUser(user: Record<string, unknown>) {
    mockDb._users = [user];
  }

  function seedNoUser() {
    mockDb._users = [];
  }

  // ── Test 1: correct credentials → 200 + token ────────────────────────────

  it("returns 200 and a session token when credentials are correct", async () => {
    seedUser({
      id: 1,
      username: "admin",
      name: "مدير النظام",
      role: "super_admin",
      password: "Abc1234",
      isActive: true,
      email: null,
      phone: null,
      linkedSupplierId: null,
      linkedStaffId: null,
      createdAt: new Date().toISOString(),
    });

    const res = await post(app, "/api/auth/admin-login", {
      username: "admin",
      password: "Abc1234",
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBe(64);
    // Password must NEVER be returned to the client
    expect(res.body.password).toBeUndefined();
  });

  // ── Test 2: wrong password → 401 ─────────────────────────────────────────

  it("returns 401 when the password is wrong", async () => {
    seedUser({
      id: 1,
      username: "admin",
      name: "Admin",
      role: "super_admin",
      password: "Abc1234",
      isActive: true,
    });

    const res = await post(app, "/api/auth/admin-login", {
      username: "admin",
      password: "WrongPassword",
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/wrong password/i);
  });

  // ── Test 3: non-existent user → 401 ──────────────────────────────────────

  it("returns 401 when the user does not exist", async () => {
    seedNoUser();

    const res = await post(app, "/api/auth/admin-login", {
      username: "ghost",
      password: "anything",
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/not found/i);
  });

  // ── Test 4: deactivated account → 403 ───────────────────────────────────

  it("returns 403 when the account is deactivated", async () => {
    seedUser({
      id: 2,
      username: "suspended",
      name: "Suspended User",
      role: "admin",
      password: "Abc1234",
      isActive: false,
    });

    const res = await post(app, "/api/auth/admin-login", {
      username: "suspended",
      password: "Abc1234",
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/deactivated/i);
  });

  // ── Test 5: customer tries to use admin endpoint → 403 ───────────────────

  it("blocks a customer from using the admin-login endpoint", async () => {
    seedUser({
      id: 3,
      username: "john",
      name: "John",
      role: "customer",
      password: "pass123",
      isActive: true,
    });

    const res = await post(app, "/api/auth/admin-login", {
      username: "john",
      password: "pass123",
    });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/customer login endpoint/i);
  });

  // ── Test 6: missing credentials → 400 ────────────────────────────────────

  it("returns 400 when username or password is omitted", async () => {
    const res = await post(app, "/api/auth/admin-login", { username: "admin" });
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Auth — client-login endpoint", () => {
  let app: ReturnType<typeof buildApp>;
  const mockDb = db as any;

  beforeEach(() => {
    app = buildApp();
    vi.clearAllMocks();
    mockDb.select.mockReturnValue(mockDb);
    mockDb.from.mockReturnValue(mockDb);
    mockDb.where.mockImplementation(() => Promise.resolve(mockDb._users));
  });

  function seedUser(user: Record<string, unknown>) {
    mockDb._users = [user];
  }

  function seedNoUser() {
    mockDb._users = [];
  }

  // ── Test 7: correct customer login → 200 + token ─────────────────────────

  it("returns 200 and a token when customer credentials are correct", async () => {
    seedUser({
      id: 10,
      username: "farouk",
      name: "فاروق",
      role: "customer",
      password: "secure123",
      isActive: true,
    });

    const res = await post(app, "/api/auth/client-login", {
      username: "farouk",
      password: "secure123",
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.password).toBeUndefined();
    expect(res.body.name).toBe("فاروق");
  });

  // ── Test 8: wrong customer password → 401 ────────────────────────────────

  it("returns 401 when the customer password is wrong", async () => {
    seedUser({
      id: 10,
      username: "farouk",
      name: "فاروق",
      role: "customer",
      password: "secure123",
      isActive: true,
    });

    const res = await post(app, "/api/auth/client-login", {
      username: "farouk",
      password: "wrongpass",
    });

    expect(res.status).toBe(401);
  });

  // ── Test 9: admin tries customer endpoint → 403 ───────────────────────────

  it("blocks non-customer roles from using client-login", async () => {
    seedUser({
      id: 1,
      username: "admin",
      role: "super_admin",
      password: "Abc1234",
      isActive: true,
    });

    const res = await post(app, "/api/auth/client-login", {
      username: "admin",
      password: "Abc1234",
    });

    expect(res.status).toBe(403);
    expect(res.body.role).toBe("super_admin");
  });

  // ── Test 10: non-existent customer → 401 ─────────────────────────────────

  it("returns 401 when the customer account does not exist", async () => {
    seedNoUser();

    const res = await post(app, "/api/auth/client-login", {
      username: "nobody",
      password: "pass123",
    });

    expect(res.status).toBe(401);
  });
});
