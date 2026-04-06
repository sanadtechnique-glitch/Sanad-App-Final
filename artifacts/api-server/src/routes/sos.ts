import { Router } from "express";
import { db } from "@workspace/db";
import { sosRequestsTable } from "@workspace/db/schema";
import { eq, ne } from "drizzle-orm";
import { requireAuth } from "../lib/authMiddleware";

const router = Router();

// Haversine distance in km
function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Customer: create SOS request ──────────────────────────────────────────────
router.post("/sos", async (req, res) => {
  try {
    const { customerId, customerName, customerPhone, lat, lng, description } = req.body;
    if (!customerName || !customerPhone || lat == null || lng == null)
      return res.status(400).json({ error: "missing_fields" });

    const [sos] = await db.insert(sosRequestsTable).values({
      customerId: customerId ? Number(customerId) : null,
      customerName, customerPhone,
      lat: Number(lat), lng: Number(lng),
      description: description || "",
      category: "other",
    }).returning();

    res.status(201).json(sos);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Provider (شاحنة SOS): list requests near me ─────────────────────────────
router.get("/sos/nearby", requireAuth, async (req, res) => {
  try {
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lng = req.query.lng ? Number(req.query.lng) : null;

    // Get provider id from session (for provider-specific filtering)
    const session   = (req as any).authSession;
    const provId    = session?.supplierId ?? null;

    const all = await db.select().from(sosRequestsTable)
      .where(ne(sosRequestsTable.status, "cancelled"));

    // Show: pending requests (not yet offered) + offered/accepted/done by this provider
    const visible = all.filter(s =>
      s.status === "pending" ||
      (["offered", "accepted", "done"].includes(s.status) && (provId === null || s.assignedProviderId === provId))
    );

    if (lat && lng) {
      visible.sort((a, b) => distKm(lat, lng, a.lat, a.lng) - distKm(lat, lng, b.lat, b.lng));
    }
    res.json(visible);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Admin: list all SOS requests ──────────────────────────────────────────────
router.get("/admin/sos", requireAuth, async (_req, res) => {
  try {
    const rows = await db.select().from(sosRequestsTable);
    res.json(rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Customer: my SOS requests ─────────────────────────────────────────────────
router.get("/sos/my/:customerId", async (req, res) => {
  try {
    const rows = await db.select().from(sosRequestsTable)
      .where(eq(sosRequestsTable.customerId, Number(req.params.customerId)));
    res.json(rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Provider: propose a price (offer) ─────────────────────────────────────────
// PATCH /sos/:id/offer  body: { providerId, providerName, price }
router.patch("/sos/:id/offer", requireAuth, async (req, res) => {
  try {
    const { providerId, providerName, price } = req.body;
    if (!providerId || !providerName || price == null)
      return res.status(400).json({ error: "providerId, providerName, price required" });

    const [existing] = await db.select().from(sosRequestsTable)
      .where(eq(sosRequestsTable.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ error: "not_found" });
    if (existing.status !== "pending")
      return res.status(409).json({ error: "already_taken", status: existing.status });

    const [sos] = await db.update(sosRequestsTable)
      .set({
        status: "offered",
        offeredPrice: Number(price),
        assignedProviderId: providerId,
        assignedProviderName: providerName,
        updatedAt: new Date(),
      })
      .where(eq(sosRequestsTable.id, Number(req.params.id)))
      .returning();
    res.json(sos);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Customer: respond to price offer ──────────────────────────────────────────
// PATCH /sos/:id/respond  body: { accept: true | false }
router.patch("/sos/:id/respond", async (req, res) => {
  try {
    const { accept } = req.body;
    const [existing] = await db.select().from(sosRequestsTable)
      .where(eq(sosRequestsTable.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ error: "not_found" });
    if (existing.status !== "offered")
      return res.status(409).json({ error: "invalid_status", status: existing.status });

    const newStatus = accept ? "accepted" : "cancelled";
    const [sos] = await db.update(sosRequestsTable)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(sosRequestsTable.id, Number(req.params.id)))
      .returning();
    res.json(sos);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Provider/Admin: update SOS status (done/cancelled) ───────────────────────
router.patch("/sos/:id/status", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["pending", "offered", "accepted", "done", "cancelled"];
    if (!allowed.includes(status))
      return res.status(400).json({ error: "invalid_status" });

    const [sos] = await db.update(sosRequestsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(sosRequestsTable.id, Number(req.params.id)))
      .returning();
    res.json(sos);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

// ── Legacy: accept (kept for backward compat, now redirects to offer) ────────
router.patch("/sos/:id/accept", requireAuth, async (req, res) => {
  try {
    const { providerId, providerName } = req.body;
    const [existing] = await db.select().from(sosRequestsTable)
      .where(eq(sosRequestsTable.id, Number(req.params.id)));
    if (!existing) return res.status(404).json({ error: "not_found" });
    if (existing.status !== "pending") return res.status(409).json({ error: "already_taken" });
    const [sos] = await db.update(sosRequestsTable)
      .set({ status: "accepted", assignedProviderId: providerId, assignedProviderName: providerName, updatedAt: new Date() })
      .where(eq(sosRequestsTable.id, Number(req.params.id)))
      .returning();
    res.json(sos);
  } catch (e) {
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
