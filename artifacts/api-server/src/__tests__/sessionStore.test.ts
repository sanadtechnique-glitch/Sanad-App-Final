/**
 * Unit Tests — Session Store
 * Tests token creation, retrieval, expiry, and deletion.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSession,
  getSession,
  deleteSession,
} from "../lib/sessionStore";

describe("Session Store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── createSession ──────────────────────────────────────────────────────────

  describe("createSession()", () => {
    it("returns a non-empty hex token string", () => {
      const token = createSession(1, "super_admin", "admin");
      expect(typeof token).toBe("string");
      expect(token.length).toBe(64); // 32 bytes → 64 hex chars
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });

    it("generates a unique token every time", () => {
      const t1 = createSession(1, "admin", "admin");
      const t2 = createSession(1, "admin", "admin");
      expect(t1).not.toBe(t2);
    });
  });

  // ─── getSession ─────────────────────────────────────────────────────────────

  describe("getSession()", () => {
    it("returns the correct session data for a valid token", () => {
      const token = createSession(42, "manager", "ali");
      const session = getSession(token);

      expect(session).not.toBeNull();
      expect(session!.userId).toBe(42);
      expect(session!.role).toBe("manager");
      expect(session!.username).toBe("ali");
    });

    it("returns null for an unknown / invalid token", () => {
      expect(getSession("totally-fake-token")).toBeNull();
      expect(getSession("")).toBeNull();
    });

    it("returns null for an expired session", () => {
      const token = createSession(1, "driver", "hassan");

      // Advance clock past the 12-hour TTL
      vi.advanceTimersByTime(13 * 60 * 60 * 1000);

      expect(getSession(token)).toBeNull();
    });

    it("returns a valid session that has not yet expired", () => {
      const token = createSession(2, "provider", "shop");

      // Advance only 6 hours — still within TTL
      vi.advanceTimersByTime(6 * 60 * 60 * 1000);

      expect(getSession(token)).not.toBeNull();
    });
  });

  // ─── deleteSession ───────────────────────────────────────────────────────────

  describe("deleteSession()", () => {
    it("removes the session so subsequent calls return null", () => {
      const token = createSession(5, "admin", "manager1");
      expect(getSession(token)).not.toBeNull();

      deleteSession(token);
      expect(getSession(token)).toBeNull();
    });

    it("does not throw when deleting a non-existent token", () => {
      expect(() => deleteSession("ghost-token")).not.toThrow();
    });
  });
});
