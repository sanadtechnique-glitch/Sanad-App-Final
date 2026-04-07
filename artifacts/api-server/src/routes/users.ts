import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import {
  usersTable, serviceProvidersTable, deliveryStaffTable,
  ordersTable, ratingsTable, hotelBookingsTable,
  taxiDriversTable, passwordResetTokensTable,
} from "@workspace/db/schema";
import { eq, ne, and, gt } from "drizzle-orm";
import { createSession } from "../lib/sessionStore";
import { requireAdmin } from "../lib/authMiddleware";
import { isValidPhone, isValidPassword, isValidRole } from "../lib/validate";
import { hashPassword, verifyPassword } from "../lib/crypto";
import { sendPasswordResetEmail } from "../lib/mailer";

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

    const passwordOk = await verifyPassword(password.trim(), user.password);
    if (!passwordOk) {
      res.status(401).json({ message: "كلمة المرور غير صحيحة · Mot de passe incorrect" });
      return;
    }

    const token = await createSession(user.id, user.role, user.username ?? user.name);
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

    const adminPwOk = await verifyPassword(password.trim(), user.password);
    if (!adminPwOk) { res.status(401).json({ message: "Wrong password" }); return; }

    const token = await createSession(user.id, user.role, user.username ?? user.name);
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
  const { name, nickname, email, password, phone, dateOfBirth } = req.body as {
    name?: string; nickname?: string;
    email?: string; password?: string; phone?: string; dateOfBirth?: string;
  };

  const displayName = (nickname || name || "").trim();

  if (!phone || !password || !displayName) {
    res.status(400).json({ message: "رقم الهاتف والاسم وكلمة المرور مطلوبة · Téléphone, nom et mot de passe requis" });
    return;
  }

  if (!email?.trim()) {
    res.status(400).json({ message: "البريد الإلكتروني مطلوب · L'adresse e-mail est requise" });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    res.status(400).json({ message: "البريد الإلكتروني غير صحيح · Adresse e-mail invalide" });
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

  // Date of birth validation — must be 18+ years old
  if (!dateOfBirth || !dateOfBirth.trim()) {
    res.status(400).json({ message: "تاريخ الميلاد مطلوب · La date de naissance est requise" });
    return;
  }
  const dobDate = new Date(dateOfBirth.trim());
  if (isNaN(dobDate.getTime())) {
    res.status(400).json({ message: "تاريخ الميلاد غير صالح · Date de naissance invalide" });
    return;
  }
  const today = new Date();
  const age18Date = new Date(dobDate.getFullYear() + 18, dobDate.getMonth(), dobDate.getDate());
  if (today < age18Date) {
    res.status(400).json({ message: "يجب أن يكون عمرك 18 سنة على الأقل · Vous devez avoir au moins 18 ans" });
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

    // Check email uniqueness
    const [existingEmail] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email!.trim().toLowerCase()));

    if (existingEmail) {
      res.status(409).json({ message: "البريد الإلكتروني مسجل مسبقاً · Cette adresse e-mail est déjà utilisée" });
      return;
    }

    // Auto-generate a unique username from phone number
    const baseUsername = `user_${phone.trim().replace(/\D/g, "")}`;
    const hashedPw = await hashPassword(password.trim());

    const [user] = await db
      .insert(usersTable)
      .values({
        username: baseUsername,
        name: displayName,
        email: email!.trim(),
        password: hashedPw,
        phone: phone.trim(),
        role: "customer",
        isActive: true,
        dateOfBirth: dateOfBirth.trim(),
      })
      .returning();

    const token = await createSession(user.id, user.role, user.username ?? user.name);
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

    const clientPwOk = await verifyPassword(password.trim(), user.password);
    if (!clientPwOk) {
      res.status(401).json({ message: "كلمة المرور غير صحيحة · Mot de passe incorrect" });
      return;
    }

    const token = await createSession(user.id, user.role, user.username ?? user.name);
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
        email: usersTable.email,
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
      ...providers.map(p => ({ id: p.id, username: null, name: p.name, email: null, phone: p.phone, role: "provider", isActive: p.isActive, createdAt: p.createdAt, source: "providers" as const })),
      ...drivers.map(d => ({ id: d.id, username: null, name: d.name, email: null, phone: d.phone, role: "driver", isActive: d.isActive, createdAt: d.createdAt, source: "drivers" as const })),
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
    const hashedAdminPw = await hashPassword(password.trim());
    const [user] = await db
      .insert(usersTable)
      .values({
        username: username.toLowerCase().trim(),
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        role: role || "customer",
        password: hashedAdminPw,
        isActive: isActive !== undefined ? isActive : true,
        linkedSupplierId: linkedSupplierId ?? null,
        linkedStaffId: linkedStaffId ?? null,
      })
      .returning();

    // Auto-create taxi_drivers record when role is taxi_driver
    if (role === "taxi_driver") {
      await db.insert(taxiDriversTable).values({
        userId:   user.id,
        name:     user.name,
        phone:    user.phone ?? phone?.trim() ?? "",
        isAvailable: true,
        isActive: user.isActive,
      }).onConflictDoNothing();
    }

    const { password: _pw, ...safeUser } = user;
    res.status(201).json(safeUser);
  } catch (err: any) {
    if (err?.code === "23505") {
      const detail = err?.detail ?? "";
      if (detail.includes("email")) {
        res.status(409).json({ message: "البريد الإلكتروني مسجل مسبقاً · E-mail déjà utilisé" });
      } else if (detail.includes("phone")) {
        res.status(409).json({ message: "رقم الهاتف مسجل مسبقاً · Numéro déjà utilisé" });
      } else {
        res.status(409).json({ message: "اسم المستخدم موجود بالفعل · Identifiant déjà utilisé" });
      }
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
    if (password !== undefined && password.trim() !== "") updates.password = await hashPassword(password.trim());
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
  } catch (err: any) {
    if (err?.code === "23505") {
      const detail = err?.detail ?? "";
      if (detail.includes("email")) {
        res.status(409).json({ message: "البريد الإلكتروني مسجل مسبقاً · E-mail déjà utilisé" });
      } else if (detail.includes("phone")) {
        res.status(409).json({ message: "رقم الهاتف مسجل مسبقاً · Numéro déjà utilisé" });
      } else {
        res.status(409).json({ message: "اسم المستخدم موجود بالفعل · Identifiant déjà utilisé" });
      }
      return;
    }
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
// POST /auth/forgot-password — generate reset token & send email (public)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email?.trim()) {
    res.status(400).json({ message: "البريد الإلكتروني مطلوب · L'adresse e-mail est requise" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));

    // Always respond with success to avoid email enumeration
    if (!user || !user.email) {
      res.json({ message: "إذا كان البريد الإلكتروني مسجلاً، ستصلك رسالة خلال دقائق · Si l'e-mail est enregistré, vous recevrez un message sous peu." });
      return;
    }

    // Delete any existing tokens for this user
    await db
      .delete(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.userId, user.id));

    // Generate secure token (32 bytes hex = 64 chars)
    const rawToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      token: rawToken,
      expiresAt,
    });

    const BASE_URL = process.env.FRONTEND_URL ?? `https://${process.env.REPLIT_DOMAINS ?? "sanad.app"}`;
    const resetUrl = `${BASE_URL}/reset-password?token=${rawToken}`;

    const { sent, devUrl } = await sendPasswordResetEmail(user.email, resetUrl);

    req.log.info({ userId: user.id, sent }, "Password reset requested");

    res.json({
      message: "إذا كان البريد الإلكتروني مسجلاً، ستصلك رسالة خلال دقائق · Si l'e-mail est enregistré, vous recevrez un message sous peu.",
      ...(devUrl ? { devResetUrl: devUrl } : {}),
    });
  } catch (err) {
    req.log.error({ err }, "Error in forgot-password");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/reset-password — validate token & set new password (public)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/auth/reset-password", async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token?.trim()) {
    res.status(400).json({ message: "الرمز مطلوب · Le jeton est requis" });
    return;
  }

  if (!password?.trim()) {
    res.status(400).json({ message: "كلمة المرور الجديدة مطلوبة · Le nouveau mot de passe est requis" });
    return;
  }

  if (!isValidPassword(password)) {
    res.status(400).json({ message: "كلمة المرور قصيرة جداً (6 أحرف على الأقل) · Mot de passe trop court (min. 6 caractères)" });
    return;
  }

  try {
    const now = new Date();

    const [record] = await db
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.token, token.trim()),
          gt(passwordResetTokensTable.expiresAt, now),
        ),
      );

    if (!record) {
      res.status(400).json({
        message: "الرابط غير صالح أو منتهي الصلاحية · Lien invalide ou expiré",
        expired: true,
      });
      return;
    }

    const hashedNewPw = await hashPassword(password.trim());

    await db
      .update(usersTable)
      .set({ password: hashedNewPw })
      .where(eq(usersTable.id, record.userId));

    // Delete the used token
    await db
      .delete(passwordResetTokensTable)
      .where(eq(passwordResetTokensTable.id, record.id));

    res.json({ message: "تم تغيير كلمة المرور بنجاح · Mot de passe réinitialisé avec succès" });
  } catch (err) {
    req.log.error({ err }, "Error in reset-password");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/validate-reset-token — check if token is valid (public)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/auth/validate-reset-token", async (req, res) => {
  const token = (req.query.token as string | undefined)?.trim();

  if (!token) {
    res.status(400).json({ valid: false, message: "الرمز مطلوب · Jeton requis" });
    return;
  }

  try {
    const now = new Date();
    const [record] = await db
      .select({ id: passwordResetTokensTable.id, expiresAt: passwordResetTokensTable.expiresAt })
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.token, token),
          gt(passwordResetTokensTable.expiresAt, now),
        ),
      );

    res.json({ valid: !!record });
  } catch (err) {
    req.log.error({ err }, "Error validating reset token");
    res.status(500).json({ valid: false });
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
