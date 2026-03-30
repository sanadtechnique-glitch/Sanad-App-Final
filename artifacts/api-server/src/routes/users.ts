import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/admin-login  — verify credentials against the users table
// Returns user (without password) or 401
// ─────────────────────────────────────────────────────────────────────────────
router.post("/auth/admin-login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    res.status(400).json({ message: "Missing credentials" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username.toLowerCase().trim()));

    if (!user) { res.status(401).json({ message: "User not found" }); return; }
    if (!user.isActive) { res.status(403).json({ message: "Account is deactivated" }); return; }
    if (user.password !== password.trim()) { res.status(401).json({ message: "Wrong password" }); return; }

    // Strip password from response
    const { password: _pw, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    req.log.error({ err }, "Error in admin-login");
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
      })
      .from(usersTable)
      .orderBy(usersTable.createdAt);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/users — create a new user
// ─────────────────────────────────────────────────────────────────────────────
router.post("/admin/users", async (req, res) => {
  const { username, name, email, phone, role, password, isActive } = req.body as {
    username?: string; name?: string; email?: string; phone?: string;
    role?: string; password?: string; isActive?: boolean;
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

  const { name, email, phone, role, password, isActive } = req.body as {
    name?: string; email?: string; phone?: string;
    role?: string; password?: string; isActive?: boolean;
  };

  try {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email?.trim() || null;
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (role !== undefined) updates.role = role;
    if (password !== undefined && password.trim() !== "") updates.password = password.trim();
    if (isActive !== undefined) updates.isActive = isActive;

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
