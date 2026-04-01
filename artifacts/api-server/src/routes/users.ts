import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, serviceProvidersTable, deliveryStaffTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/admin-login  — verify credentials for all non-customer roles
// Supports username OR phone number lookup.
// For provider/driver roles, also returns supplierId / staffId if linked.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/auth/admin-login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ message: "Missing credentials" });
    return;
  }

  try {
    const identifier = username.trim();

    // Try by username first, then phone
    let user = (
      await db.select().from(usersTable).where(eq(usersTable.username, identifier.toLowerCase()))
    )[0];

    if (!user) {
      user = (
        await db.select().from(usersTable).where(eq(usersTable.phone, identifier))
      )[0];
    }

    if (!user) { res.status(401).json({ message: "User not found" }); return; }
    if (!user.isActive) { res.status(403).json({ message: "Account is deactivated" }); return; }
    if (user.password !== password.trim()) { res.status(401).json({ message: "Wrong password" }); return; }

    const { password: _pw, ...safeUser } = user;

    // For provider role: use linkedSupplierId first, fall back to name match
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

      res.json({ ...safeUser, supplierId: supplierId ?? undefined, displayName });
      return;
    }

    // For driver role: use linkedStaffId first, fall back to name match
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

      res.json({ ...safeUser, staffId: staffId ?? undefined, displayName });
      return;
    }

    res.json(safeUser);
  } catch (err) {
    req.log.error({ err }, "Error in admin-login");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/client-register — create a client account (public, no admin needed)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/auth/client-register", async (req, res) => {
  const { username, name, nickname, email, password, phone } = req.body as {
    username?: string; name?: string; nickname?: string;
    email?: string; password?: string; phone?: string;
  };

  const displayName = (nickname || name || "").trim();

  if (!username || !password || !displayName) {
    res.status(400).json({ message: "username, name/nickname and password are required" });
    return;
  }

  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username.toLowerCase().trim()));

    if (existing) {
      res.status(409).json({ message: "اسم المستخدم مسجل مسبقاً · Pseudo déjà utilisé" });
      return;
    }

    const [user] = await db
      .insert(usersTable)
      .values({
        username: username.toLowerCase().trim(),
        name: displayName,
        email: email?.trim() || null,
        password: password.trim(),
        phone: phone?.trim() || null,
        role: "customer",
        isActive: true,
      })
      .returning();

    const { password: _pw, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ message: "اسم المستخدم مسجل مسبقاً · Pseudo déjà utilisé" });
      return;
    }
    req.log.error({ err }, "Error in client-register");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/client-login — verify client credentials against DB
// ─────────────────────────────────────────────────────────────────────────────
router.post("/auth/client-login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ message: "Missing credentials" });
    return;
  }

  try {
    const identifier = username.trim();

    // Try by username first, then fall back to phone number
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
    // Only allow customer accounts via this endpoint — admin/staff use /auth/admin-login
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

    const { password: _pw, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    req.log.error({ err }, "Error in client-login");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/users — list all users (password excluded)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/users", async (_req, res) => {
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
// GET /admin/all-users — combined view: users + providers + drivers
// ─────────────────────────────────────────────────────────────────────────────
router.get("/admin/all-users", async (_req, res) => {
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
      ...users.map(u => ({ ...u, source: "users" as const, username: u.username })),
      ...providers.map(p => ({ id: p.id, username: null, name: p.name, phone: p.phone, role: "provider", isActive: p.isActive, createdAt: p.createdAt, source: "providers" as const })),
      ...drivers.map(d => ({ id: d.id, username: null, name: d.name, phone: d.phone, role: "driver", isActive: d.isActive, createdAt: d.createdAt, source: "drivers" as const })),
    ];

    res.json(combined);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/users — create a new user
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/users", async (req, res) => {
  const { username, name, email, phone, role, password, isActive, linkedSupplierId, linkedStaffId } = req.body as {
    username?: string; name?: string; email?: string; phone?: string;
    role?: string; password?: string; isActive?: boolean;
    linkedSupplierId?: number | null; linkedStaffId?: number | null;
  };

  if (!username || !name || !password) {
    res.status(400).json({ message: "username, name, and password are required" });
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
// PATCH /admin/users/:id — update user fields (password optional)
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/admin/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }

  const { name, email, phone, role, password, isActive, linkedSupplierId, linkedStaffId } = req.body as {
    name?: string; email?: string; phone?: string;
    role?: string; password?: string; isActive?: boolean;
    linkedSupplierId?: number | null; linkedStaffId?: number | null;
  };

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
// DELETE /admin/users/:id — remove user
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/admin/users/:id", async (req, res) => {
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

export default router;
