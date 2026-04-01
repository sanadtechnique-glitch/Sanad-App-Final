/**
 * Unit Tests — Input Validation Helpers
 * Tests phone, password, role, and numeric parsing.
 */
import { describe, it, expect } from "vitest";
import {
  isValidPhone,
  isValidPassword,
  isValidRole,
  safeParseFloat,
  safeParseInt,
} from "../lib/validate";

describe("isValidPhone()", () => {
  it("accepts standard Tunisian numbers", () => {
    expect(isValidPhone("20123456")).toBe(true);   // 8 digits
    expect(isValidPhone("22345678")).toBe(true);
    expect(isValidPhone("98765432")).toBe(true);
  });

  it("accepts numbers with international prefix", () => {
    expect(isValidPhone("+21620123456")).toBe(true);
    expect(isValidPhone("+33612345678")).toBe(true);
  });

  it("accepts numbers with spaces or dashes", () => {
    expect(isValidPhone("20 123 456")).toBe(true);
    expect(isValidPhone("20-123-456")).toBe(true);
  });

  it("rejects numbers that are too short", () => {
    expect(isValidPhone("123")).toBe(false);         // < 8 digits
    expect(isValidPhone("1234567")).toBe(false);     // 7 digits
  });

  it("rejects alphabetic and special characters", () => {
    expect(isValidPhone("abcdefgh")).toBe(false);
    expect(isValidPhone("bad_phone")).toBe(false);
    expect(isValidPhone("phone#123")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidPhone("")).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe("isValidPassword()", () => {
  it("accepts passwords with 6 or more characters", () => {
    expect(isValidPassword("Abc123")).toBe(true);
    expect(isValidPassword("MySecurePass!")).toBe(true);
    expect(isValidPassword("123456")).toBe(true);
  });

  it("rejects passwords shorter than 6 characters", () => {
    expect(isValidPassword("ab")).toBe(false);
    expect(isValidPassword("12345")).toBe(false);
    expect(isValidPassword("")).toBe(false);
  });

  it("accepts passwords exactly at the 6-character boundary", () => {
    expect(isValidPassword("abcdef")).toBe(true);
  });

  it("rejects passwords longer than 72 characters (bcrypt limit)", () => {
    expect(isValidPassword("a".repeat(73))).toBe(false);
    expect(isValidPassword("a".repeat(72))).toBe(true); // boundary is fine
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe("isValidRole()", () => {
  it("accepts all known system roles", () => {
    expect(isValidRole("customer")).toBe(true);
    expect(isValidRole("admin")).toBe(true);
    expect(isValidRole("manager")).toBe(true);
    expect(isValidRole("super_admin")).toBe(true);
    expect(isValidRole("provider")).toBe(true);
    expect(isValidRole("driver")).toBe(true);
  });

  it("rejects unknown or fabricated roles", () => {
    expect(isValidRole("hacker")).toBe(false);
    expect(isValidRole("superuser")).toBe(false);
    expect(isValidRole("root")).toBe(false);
    expect(isValidRole("")).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe("safeParseFloat()", () => {
  it("correctly parses valid numeric strings", () => {
    expect(safeParseFloat("7.5")).toBe(7.5);
    expect(safeParseFloat("0")).toBe(0);
    expect(safeParseFloat("100")).toBe(100);
  });

  it("returns null for non-numeric strings", () => {
    expect(safeParseFloat("abc")).toBeNull();
    expect(safeParseFloat("nan")).toBeNull();
    expect(safeParseFloat("not_a_number")).toBeNull();
  });

  it("returns null for null, undefined, and empty string", () => {
    expect(safeParseFloat(null)).toBeNull();
    expect(safeParseFloat(undefined)).toBeNull();
    expect(safeParseFloat("")).toBeNull();
  });

  it("handles numeric values passed directly", () => {
    expect(safeParseFloat(9.99)).toBe(9.99);
    expect(safeParseFloat(0)).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────

describe("safeParseInt()", () => {
  it("correctly parses valid integer strings", () => {
    expect(safeParseInt("42")).toBe(42);
    expect(safeParseInt("0")).toBe(0);
    expect(safeParseInt("1000")).toBe(1000);
  });

  it("returns null for non-numeric input", () => {
    expect(safeParseInt("abc")).toBeNull();
    expect(safeParseInt("customer")).toBeNull();
  });

  it("returns null for null, undefined, and empty string", () => {
    expect(safeParseInt(null)).toBeNull();
    expect(safeParseInt(undefined)).toBeNull();
    expect(safeParseInt("")).toBeNull();
  });
});
