/**
 * Unit Tests — Role Logic & UI Role Switching
 *
 * Covers:
 *   1. ROLE_SECTIONS — each role only accesses the allowed dashboard sections
 *   2. isAdminRole / isSuperAdmin — role guards used throughout the UI
 *   3. Session-based routing — the app switches between dashboards based on role
 *   4. Role-specific session fields — supplierId for provider, staffId for driver
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import {
  ROLE_SECTIONS,
  ROLE_META,
  isAdminRole,
  isSuperAdmin,
  setSession,
  getSession,
  clearSession,
  type AppRole,
  type Role,
} from "../lib/auth";

// ─────────────────────────────────────────────────────────────────────────────
// 1. ROLE_SECTIONS — Access Control Matrix
// ─────────────────────────────────────────────────────────────────────────────

describe("ROLE_SECTIONS — access control per role", () => {
  const ADMIN_SECTIONS = ["overview", "orders", "categories", "suppliers", "articles", "staff", "delegations", "banners", "users"];

  it("super_admin has access to all admin sections", () => {
    const sections = ROLE_SECTIONS["super_admin"];
    ADMIN_SECTIONS.forEach(section => {
      expect(sections).toContain(section);
    });
  });

  it("manager has limited access (overview, orders, banners only)", () => {
    const sections = ROLE_SECTIONS["manager"];
    expect(sections).toContain("overview");
    expect(sections).toContain("orders");
    expect(sections).toContain("banners");
    // Manager should NOT have access to user management or suppliers
    expect(sections).not.toContain("users");
    expect(sections).not.toContain("suppliers");
    expect(sections).not.toContain("staff");
  });

  it("provider has NO admin panel sections", () => {
    expect(ROLE_SECTIONS["provider"]).toHaveLength(0);
  });

  it("driver has NO admin panel sections", () => {
    expect(ROLE_SECTIONS["driver"]).toHaveLength(0);
  });

  it("customer has NO admin panel sections", () => {
    expect(ROLE_SECTIONS["customer"]).toHaveLength(0);
  });

  it("only super_admin and admin can manage users", () => {
    expect(ROLE_SECTIONS["super_admin"]).toContain("users");
    expect(ROLE_SECTIONS["admin"]).toContain("users");
    expect(ROLE_SECTIONS["manager"]).not.toContain("users");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. ROLE_META — UI Metadata per role
// ─────────────────────────────────────────────────────────────────────────────

describe("ROLE_META — display metadata per role", () => {
  const roles: AppRole[] = ["super_admin", "manager", "provider", "driver", "customer"];

  roles.forEach(role => {
    it(`"${role}" has Arabic label, French label, color, and badge`, () => {
      const meta = ROLE_META[role];
      expect(meta.ar).toBeTruthy();
      expect(meta.fr).toBeTruthy();
      expect(meta.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(meta.badge).toBeTruthy();
    });
  });

  it("customer badge uses the orange brand color", () => {
    expect(ROLE_META["customer"].color).toBe("#FFA500");
  });

  it("super_admin badge uses the dark green brand color", () => {
    expect(ROLE_META["super_admin"].color).toBe("#0D3311");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Role Guards
// ─────────────────────────────────────────────────────────────────────────────

describe("isAdminRole() — route guard for admin dashboard", () => {
  it("grants access to super_admin, admin, manager", () => {
    expect(isAdminRole("super_admin")).toBe(true);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("manager")).toBe(true);
  });

  it("denies access to provider, driver, customer, client", () => {
    expect(isAdminRole("provider")).toBe(false);
    expect(isAdminRole("driver")).toBe(false);
    expect(isAdminRole("customer")).toBe(false);
    expect(isAdminRole("client")).toBe(false);
    expect(isAdminRole("delivery")).toBe(false);
  });

  it("denies access when role is undefined (unauthenticated)", () => {
    expect(isAdminRole(undefined)).toBe(false);
  });
});

describe("isSuperAdmin() — guard for destructive actions", () => {
  it("grants access to super_admin and admin", () => {
    expect(isSuperAdmin("super_admin")).toBe(true);
    expect(isSuperAdmin("admin")).toBe(true);
  });

  it("denies access to manager (limited admin)", () => {
    expect(isSuperAdmin("manager")).toBe(false);
  });

  it("denies access to all other roles", () => {
    const roles: Role[] = ["provider", "driver", "customer", "client", "delivery"];
    roles.forEach(r => expect(isSuperAdmin(r)).toBe(false));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Role-specific session fields
// ─────────────────────────────────────────────────────────────────────────────

describe("Session — role-specific fields", () => {
  beforeEach(() => clearSession());

  it("admin session stores userId and token but no supplierId/staffId", () => {
    setSession({ role: "super_admin", name: "Admin", userId: 1, token: "tok123" });
    const s = getSession()!;

    expect(s.userId).toBe(1);
    expect(s.token).toBe("tok123");
    expect(s.supplierId).toBeUndefined();
    expect(s.staffId).toBeUndefined();
  });

  it("provider session stores supplierId linked to their supplier record", () => {
    setSession({ role: "provider", name: "Best Pharmacy", userId: 5, supplierId: 12 });
    const s = getSession()!;

    expect(s.role).toBe("provider");
    expect(s.supplierId).toBe(12);
    expect(s.staffId).toBeUndefined();
  });

  it("driver session stores staffId linked to their delivery staff record", () => {
    setSession({ role: "delivery", name: "Walid", userId: 7, staffId: 3 });
    const s = getSession()!;

    expect(s.role).toBe("delivery");
    expect(s.staffId).toBe(3);
    expect(s.supplierId).toBeUndefined();
  });

  it("customer session stores userId but no business IDs", () => {
    setSession({ role: "client", name: "سارة", userId: 42 });
    const s = getSession()!;

    expect(s.role).toBe("client");
    expect(s.userId).toBe(42);
    expect(s.supplierId).toBeUndefined();
    expect(s.staffId).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. UI Component — Role-based rendering
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A minimal version of the role-based navigation used in the real app.
 * We test the logic in isolation so it's fast and deterministic.
 */
function RoleBadge({ role }: { role: Role | undefined }) {
  if (!role) return <span data-testid="badge">غير مسجّل</span>;
  if (isAdminRole(role))         return <span data-testid="badge" className="admin-badge">لوحة الإدارة</span>;
  if (role === "provider")       return <span data-testid="badge" className="provider-badge">لوحة المزود</span>;
  if (role === "delivery" || role === "driver")
                                  return <span data-testid="badge" className="driver-badge">لوحة التوصيل</span>;
  return <span data-testid="badge" className="customer-badge">الصفحة الرئيسية</span>;
}

describe("RoleBadge component — UI switches based on role", () => {
  it("renders admin dashboard label for super_admin", () => {
    render(<RoleBadge role="super_admin" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("لوحة الإدارة");
    expect(screen.getByTestId("badge")).toHaveClass("admin-badge");
  });

  it("renders admin dashboard label for manager", () => {
    render(<RoleBadge role="manager" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("لوحة الإدارة");
    expect(screen.getByTestId("badge")).toHaveClass("admin-badge");
  });

  it("renders provider dashboard label for provider role", () => {
    render(<RoleBadge role="provider" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("لوحة المزود");
    expect(screen.getByTestId("badge")).toHaveClass("provider-badge");
  });

  it("renders driver dashboard label for delivery role", () => {
    render(<RoleBadge role="delivery" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("لوحة التوصيل");
    expect(screen.getByTestId("badge")).toHaveClass("driver-badge");
  });

  it("renders driver dashboard label for driver role (API value)", () => {
    render(<RoleBadge role="driver" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("لوحة التوصيل");
    expect(screen.getByTestId("badge")).toHaveClass("driver-badge");
  });

  it("renders customer home for client/customer role", () => {
    render(<RoleBadge role="client" />);
    expect(screen.getByTestId("badge")).toHaveTextContent("الصفحة الرئيسية");
    expect(screen.getByTestId("badge")).toHaveClass("customer-badge");
  });

  it("renders unauthenticated state when role is undefined", () => {
    render(<RoleBadge role={undefined} />);
    expect(screen.getByTestId("badge")).toHaveTextContent("غير مسجّل");
  });
});
