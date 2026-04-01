import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  usersTable, serviceProvidersTable, deliveryStaffTable,
  ordersTable, productsTable, ratingsTable, hotelBookingsTable,
} from "@workspace/db/schema";
import { eq, ne } from "drizzle-orm";
import { createSession } from "../lib/sessionStore";
import { requireAdmin } from "../lib/authMiddleware";
import { isValidPhone, isValidPassword, isValidRole } from "../lib/validate";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/login — unified login for ALL roles (phone + password)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/auth/login", async (req, res) => {
  const { phone, password } = req.body as { phone?: string; password?: string };
  if (!phone || !password) {
    res.status(400).json({ message: "رقم الهاتف وكلمة المرور مطلوبان · Téléphone et mot de passe requis" });
    return;
  }

  try {
    const identifier = phone.trim();

    // Look up by phone first, then by username (for legacy admin accounts)
    let user = (await db.select().from(usersTable).where(eq(usersTable.phone, identifier)))[0];
    if (!user) {
      user = (await db.select().from(usersTable).where(eq(usersTable.username, identifier.toLowerCase())))[0];
    }

    if (!user) {
      res.status(401).json({ message: "رقم الهاتف غير مسجل · Numéro non enregistré" });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ message: "الحساب موقوف · Compte suspendu" });
      return;
    }
    if (user.password !== password.trim()) {
      res.status(401).json({ message: "كلمة المرور غير صحيحة · Mot de passe incorrect" });
      return;
    }

    const token = createSession(user.id, user.role, user.username ?? user.name);
    const { password: _pw, ...safeUser } = user;

    // Provider: attach supplierId
    if (user.role === "provider") {
      let supplierId: number | null = user.linkedSupplierId ?? null;
      let displayName: string = user.name;
      if (!supplierId) {
        const [sp] = await db.select({ id: serviceProvidersTable.id, nameAr: serviceProvidersTable.nameAr })
          .from(serviceProvidersTable).where(eq(serviceProvidersTable.nameAr, user.name));
        if (sp) { supplierId = sp.id; displayName = sp.nameAr; }
      } else {
        const [sp] = await db.select({ nameAr: serviceProvidersTable.nameAr })
          .from(serviceProvidersTable).where(eq(serviceProvidersTable.id, supplierId));
        if (sp) displayName = sp.nameAr;
      }
      res.json({ ...safeUser, supplierId: supplierId ?? undefined, displayName, token });
      return;
    }

    // Driver: attach staffId
    if (user.role === "driver") {
      let staffId: number | null = user.linkedStaffId ?? null;
      let displayName: string = user.name;
      if (!staffId) {
        const [ds] = await db.select({ id: deliveryStaffTable.id, nameAr: deliveryStaffTable.nameAr })
          .from(deliveryStaffTable).where(eq(deliveryStaffTable.nameAr, user.name));
        if (ds) { staffId = ds.id; displayName = ds.nameAr; }
      } else {
        const [ds] = await db.select({ nameAr: deliveryStaffTable.nameAr })
          .from(deliveryStaffTable).where(eq(deliveryStaffTable.id, staffId));
        if (ds) displayName = ds.nameAr;
      }
      res.json({ ...safeUser, staffId: staffId ?? undefined, displayName, token });
      return;
    }

    res.json({ ...safeUser, token });
  } catch (err) {
    req.log.error({ err }, "Error in unified login");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/admin-login — staff/admin login (kept for backward compat)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/auth/admin-login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ message: "Missing credentials" });
    return;
  }

  try {
    const identifier = username.trim();

    let user = (
      await db.select().from(usersTable).where(eq(usersTable.username, identifier.toLowerCase()))
    )[0];

    if (!user) {
      user = (
        await db.select().from(usersTable).where(eq(usersTable.phone, identifier))
      )[0];
    }

    if (!user) { res.status(401).json({ message: "User not found" }); return; }

    // Block customers from using the admin-login endpoint
    if (user.role === "customer") {
      res.status(403).json({ message: "Use the customer login endpoint" }); return;
    }

    if (!user.isActive) { res.status(403).json({ message: "Account is deactivated" }); return; }
    if (user.password !== password.trim()) { res.status(401).json({ message: "Wrong password" }); return; }

    const token = createSession(user.id, user.role, user.username ?? user.name);
    const { password: _pw, ...safeUser } = user;

    if (user.role === "provider") {
      let supplierId: number | null = user.linkedSupplierId ?? null;
      let displayName: string = user.name;

      if (!supplierId) {
        const [sp] = await db
          .select({ id: serviceProvidersTable.id, nameAr: serviceProvidersTable.nameAr })
          .from(serviceProvidersTable)
          .where(eq(serviceProvidersTable.nameAr, user.name));
        if (sp) { supplierId = sp.id; displayName = sp.nameAr; }
      } else {
        const [sp] = await db
          .select({ nameAr: serviceProvidersTable.nameAr })
          .from(serviceProvidersTable)
          .where(eq(serviceProvidersTable.id, supplierId));
        if (sp) displayName = sp.nameAr;
      }

      res.json({ ...safeUser, supplierId: supplierId ?? undefined, displayName, token });
      return;
    }

    if (user.role === "driver") {
      let staffId: number | null = user.linkedStaffId ?? null;
      let displayName: string = user.name;

      if (!staffId) {
        const [ds] = await db
          .select({ id: deliveryStaffTable.id, nameAr: deliveryStaffTable.nameAr })
          .from(deliveryStaffTable)
          .where(eq(deliveryStaffTable.nameAr, user.name));
        if (ds) { staffId = ds.id; displayName = ds.nameAr; }
      } else {
        const [ds] = await db
          .select({ nameAr: deliveryStaffTable.nameAr })
          .from(deliveryStaffTable)
          .where(eq(deliveryStaffTable.id, staffId));
        if (ds) displayName = ds.nameAr;
      }

      res.json({ ...safeUser, staffId: staffId ?? undefined, displayName, token });
      return;
    }

    res.json({ ...safeUser, token });
  } catch (err) {
    req.log.error({ err }, "Error in admin-login");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/client-register — create a client account (public)
// Phone is the primary unique identifier
// ─────────────────────────────────────────────────────────────────────────────
router.post("/auth/client-register", async (req, res) => {
  const { name, nickname, email, password, phone } = req.body as {
    name?: string; nickname?: string;
    email?: string; password?: string; phone?: string;
  };

  const displayName = (nickname || name || "").trim();

  if (!phone || !password || !displayName) {
    res.status(400).json({ message: "رقم الهاتف والاسم وكلمة المرور مطلوبة · Téléphone, nom et mot de passe requis" });
    return;
  }

  if (!isValidPassword(password)) {
    res.status(400).json({ message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل · Le mot de passe doit contenir au moins 6 caractères" });
    return;
  }

  if (!isValidPhone(phone)) {
    res.status(400).json({ message: "رقم الهاتف غير صالح · Numéro de téléphone invalide" });
    return;
  }

  if (email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).json({ message: "البريد الإلكتروني غير صحيح · Adresse e-mail invalide" });
    return;
  }

  try {
    // Check phone uniqueness
    const [existingPhone] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.phone, phone.trim()));

    if (existingPhone) {
      res.status(409).json({ message: "رقم الهاتف مسجل مسبقاً · Ce numéro est déjà utilisé" });
      return;
    }

    // Auto-generate a unique username from phone number
    const baseUsername = `user_${phone.trim().replace(/\D/g, "")}`;

    const [user] = await db
      .insert(usersTable)
      .values({
        username: baseUsername,
        name: displayName,
        email: email?.trim() || null,
        password: password.trim(),
        phone: phone.trim(),
        role: "customer",
        isActive: true,
      })
      .returning();

    const token = createSession(user.id, user.role, user.username ?? user.name);
    const { password: _pw, ...safeUser } = user;
    res.status(201).json({ ...safeUser, token });
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ message: "رقم الهاتف مسجل مسبقاً · Ce numéro est déjà utilisé" });
      return;
    }
    req.log.error({ err }, "Error in client-register");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/client-login — customer login
// ─────────────────────────────────────────────────────────────────────────────
router.post("/auth/client-login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ message: "Missing credentials" });
    return;
  }

  try {
    const identifier = username.trim();

    let user = (
      await db.select().from(usersTable).where(eq(usersTable.username, identifier.toLowerCase()))
    )[0];

    if (!user) {
      user = (
        await db.select().from(usersTable).where(eq(usersTable.phone, identifier))
      )[0];
    }

    if (!user) {
      res.status(401).json({ message: "اسم المستخدم أو رقم الهاتف غير موجود · Identifiant introuvable" });
      return;
    }
    if (user.role !== "customer") {
      res.status(403).json({ message: "هذا الحساب ليس حساب زبون · Ce compte n'est pas un compte client", role: user.role });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ message: "الحساب موقوف · Compte suspendu" });
      return;
    }
    if (user.password !== password.trim()) {
      res.status(401).json({ message: "كلمة المرور غير صحيحة · Mot de passe incorrect" });
      return;
    }

    const token = createSession(user.id, user.role, user.username ?? user.name);
    const { password: _pw, ...safeUser } = user;
    res.json({ ...safeUser, token });
  } catch (err) {
    req.log.error({ err }, "Error in client-login");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/users — list all users [ADMIN ONLY]
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/users", requireAdmin, async (_req, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        name: usersTable.name,
        email: usersTable.email,
        phone: usersTable.phone,
        role: usersTable.role,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
        linkedSupplierId: usersTable.linkedSupplierId,
        linkedStaffId: usersTable.linkedStaffId,
      })
      .from(usersTable)
      .orderBy(usersTable.createdAt);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/all-users — combined view [ADMIN ONLY]
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/all-users", requireAdmin, async (_req, res) => {
  try {
    const [users, providers, drivers] = await Promise.all([
      db.select({
        id: usersTable.id,
        username: usersTable.username,
        name: usersTable.name,
        phone: usersTable.phone,
        role: usersTable.role,
        isActive: usersTable.isActive,
        createdAt: usersTable.createdAt,
      }).from(usersTable).orderBy(usersTable.createdAt),

      db.select({
        id: serviceProvidersTable.id,
        name: serviceProvidersTable.nameAr,
        phone: serviceProvidersTable.phone,
        isActive: serviceProvidersTable.isAvailable,
        createdAt: serviceProvidersTable.createdAt,
      }).from(serviceProvidersTable).orderBy(serviceProvidersTable.createdAt),

      db.select({
        id: deliveryStaffTable.id,
        name: deliveryStaffTable.nameAr,
        phone: deliveryStaffTable.phone,
        isActive: deliveryStaffTable.isAvailable,
        createdAt: deliveryStaffTable.createdAt,
      }).from(deliveryStaffTable).orderBy(deliveryStaffTable.createdAt),
    ]);

    const combined = [
      ...users.map(u => ({ ...u, source: "users" as const })),
      ...providers.map(p => ({ id: p.id, username: null, name: p.name, phone: p.phone, role: "provider", isActive: p.isActive, createdAt: p.createdAt, source: "providers" as const })),
      ...drivers.map(d => ({ id: d.id, username: null, name: d.name, phone: d.phone, role: "driver", isActive: d.isActive, createdAt: d.createdAt, source: "drivers" as const })),
    ];

    res.json(combined);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/users — create a new user [ADMIN ONLY]
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/users", requireAdmin, async (req, res) => {
  const { username, name, email, phone, role, password, isActive, linkedSupplierId, linkedStaffId } = req.body as {
    username?: string; name?: string; email?: string; phone?: string;
    role?: string; password?: string; isActive?: boolean;
    linkedSupplierId?: number | null; linkedStaffId?: number | null;
  };

  if (!username || !name || !password) {
    res.status(400).json({ message: "username, name, and password are required" });
    return;
  }

  if (!isValidPassword(password)) {
    res.status(400).json({ message: "Password must be at least 6 characters" });
    return;
  }

  if (phone && !isValidPhone(phone)) {
    res.status(400).json({ message: "Invalid phone number format" });
    return;
  }

  if (role && !isValidRole(role)) {
    res.status(400).json({ message: "Invalid role" });
    return;
  }

  try {
    const [user] = await db
      .insert(usersTable)
      .values({
        username: username.toLowerCase().trim(),
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        role: role || "customer",
        password: password.trim(),
        isActive: isActive !== undefined ? isActive : true,
        linkedSupplierId: linkedSupplierId ?? null,
        linkedStaffId: linkedStaffId ?? null,
      })
      .returning();

    const { password: _pw, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ message: "Username already exists" });
      return;
    }
    req.log.error({ err }, "Error creating user");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/users/:id — update user [ADMIN ONLY]
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/admin/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }

  const { name, email, phone, role, password, isActive, linkedSupplierId, linkedStaffId } = req.body as {
    name?: string; email?: string; phone?: string;
    role?: string; password?: string; isActive?: boolean;
    linkedSupplierId?: number | null; linkedStaffId?: number | null;
  };

  if (phone !== undefined && phone !== "" && !isValidPhone(phone)) {
    res.status(400).json({ message: "Invalid phone number format" });
    return;
  }

  if (password !== undefined && password.trim() !== "" && !isValidPassword(password)) {
    res.status(400).json({ message: "Password must be at least 6 characters" });
    return;
  }

  if (role !== undefined && !isValidRole(role)) {
    res.status(400).json({ message: "Invalid role" });
    return;
  }

  try {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email?.trim() || null;
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (role !== undefined) updates.role = role;
    if (password !== undefined && password.trim() !== "") updates.password = password.trim();
    if (isActive !== undefined) updates.isActive = isActive;
    if ("linkedSupplierId" in req.body) updates.linkedSupplierId = linkedSupplierId ?? null;
    if ("linkedStaffId" in req.body) updates.linkedStaffId = linkedStaffId ?? null;

    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, id))
      .returning();

    if (!user) { res.status(404).json({ message: "User not found" }); return; }
    const { password: _pw, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    req.log.error({ err }, "Error updating user");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/users/:id — remove user [ADMIN ONLY]
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/admin/users/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }

  try {
    await db.delete(usersTable).where(eq(usersTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting user");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/reset-all-data — wipe all data except super_admin users [ADMIN]
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/reset-all-data", requireAdmin, async (req, res) => {
  try {
    // Delete in correct FK order: dependents first
    const ratings   = await db.delete(ratingsTable);
    const bookings  = await db.delete(hotelBookingsTable);
    const orders    = await db.delete(ordersTable);
    const products  = await db.delete(productsTable);
    const staff     = await db.delete(deliveryStaffTable);
    const providers = await db.delete(serviceProvidersTable);
    const users     = await db.delete(usersTable).where(ne(usersTable.role, "super_admin"));

    const [adminUser] = await db
      .select({ id: usersTable.id, username: usersTable.username, name: usersTable.name, phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.role, "super_admin"))
      .limit(1);

    res.json({
      success: true,
      message: "تم مسح قاعدة البيانات · Base de données réinitialisée",
      deleted: {
        orders: orders.rowCount ?? 0,
        products: products.rowCount ?? 0,
        serviceProviders: providers.rowCount ?? 0,
        deliveryStaff: staff.rowCount ?? 0,
        nonAdminUsers: users.rowCount ?? 0,
        ratings: ratings.rowCount ?? 0,
        hotelBookings: bookings.rowCount ?? 0,
      },
      adminPreserved: adminUser ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error in reset-all-data");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
