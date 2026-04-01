/**
 * Unit Tests — Frontend Auth Library (auth.ts)
 *
 * Tests session management: set, get, clear, expiry, token retrieval.
 * Uses jsdom with a mocked localStorage (see setup.ts).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setSession,
  getSession,
  clearSession,
  getSessionToken,
  isAdminRole,
  isSuperAdmin,
  type DcSession,
  type Role,
} from "../lib/auth";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const makeSession = (overrides: Partial<DcSession> = {}): DcSession => ({
  role: "super_admin",
  name: "Admin User",
  userId: 1,
  token: "abc123token",
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────

describe("setSession() / getSession()", () => {
  it("stores a session and retrieves it correctly", () => {
    const session = makeSession({ role: "super_admin", name: "مدير النظام", userId: 1 });
    setSession(session);

    const retrieved = getSession();
    expect(retrieved).not.toBeNull();
    expect(retrieved!.role).toBe("super_admin");
    expect(retrieved!.name).toBe("مدير النظام");
    expect(retrieved!.userId).toBe(1);
  });

  it("stores the session token and retrieves it", () => {
    setSession(makeSession({ token: "mySecretToken123" }));
    const retrieved = getSession();
    expect(retrieved!.token).toBe("mySecretToken123");
  });

  it("automatically sets an expiresAt 12 hours in the future", () => {
    const before = Date.now();
    setSession(makeSession());
    const after = Date.now();

    const session = getSession();
    const twelveHours = 12 * 60 * 60 * 1000;

    expect(session!.expiresAt).toBeGreaterThanOrEqual(before + twelveHours - 100);
    expect(session!.expiresAt).toBeLessThanOrEqual(after + twelveHours + 100);
  });

  it("stores optional fields like supplierId and staffId", () => {
    setSession(makeSession({ role: "provider", supplierId: 7, name: "محل البدر" }));

    const session = getSession();
    expect(session!.role).toBe("provider");
    expect(session!.supplierId).toBe(7);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("clearSession()", () => {
  it("removes the session so getSession() returns null", () => {
    setSession(makeSession());
    expect(getSession()).not.toBeNull();

    clearSession();
    expect(getSession()).toBeNull();
  });

  it("is safe to call even when no session exists", () => {
    expect(() => clearSession()).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("getSession() — expiry handling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns null for an expired session and removes it from localStorage", () => {
    setSession(makeSession());

    // Jump 13 hours into the future — past the 12h TTL
    vi.advanceTimersByTime(13 * 60 * 60 * 1000);

    expect(getSession()).toBeNull();
    // localStorage key should be removed
    expect(localStorage.getItem("dc_session")).toBeNull();
  });

  it("returns the session if it has not yet expired", () => {
    setSession(makeSession());

    // Jump only 6 hours — within TTL
    vi.advanceTimersByTime(6 * 60 * 60 * 1000);

    expect(getSession()).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("getSessionToken()", () => {
  it("returns the token from the active session", () => {
    setSession(makeSession({ token: "xyz_token_abc" }));
    expect(getSessionToken()).toBe("xyz_token_abc");
  });

  it("returns null when there is no session", () => {
    clearSession();
    expect(getSessionToken()).toBeNull();
  });

  it("returns null when the session has no token", () => {
    setSession(makeSession({ token: undefined }));
    expect(getSessionToken()).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("isAdminRole()", () => {
  const adminRoles: Role[] = ["admin", "super_admin", "manager"];
  const nonAdminRoles: Role[] = ["client", "provider", "delivery", "driver", "customer"];

  adminRoles.forEach(role => {
    it(`returns true for role "${role}"`, () => {
      expect(isAdminRole(role)).toBe(true);
    });
  });

  nonAdminRoles.forEach(role => {
    it(`returns false for role "${role}"`, () => {
      expect(isAdminRole(role)).toBe(false);
    });
  });

  it("returns false when role is undefined", () => {
    expect(isAdminRole(undefined)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("isSuperAdmin()", () => {
  it("returns true for super_admin", () => {
    expect(isSuperAdmin("super_admin")).toBe(true);
  });

  it("returns true for admin (legacy alias)", () => {
    expect(isSuperAdmin("admin")).toBe(true);
  });

  it("returns false for manager", () => {
    expect(isSuperAdmin("manager")).toBe(false);
  });

  it("returns false for provider and driver", () => {
    expect(isSuperAdmin("provider")).toBe(false);
    expect(isSuperAdmin("driver")).toBe(false);
  });
});
