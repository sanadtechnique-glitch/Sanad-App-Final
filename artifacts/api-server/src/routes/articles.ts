import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { articlesTable, serviceProvidersTable } from "@workspace/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/authMiddleware";
import { safeParseFloat, safeParseInt } from "../lib/validate";

const router: IRouter = Router();

// Public: articles for a supplier (customer-facing product grid)
router.get("/articles", async (req, res) => {
  const { supplierId } = req.query;
  const id = safeParseInt(supplierId as string);
  if (!id) {
    res.status(400).json({ message: "supplierId query param required" }); return;
  }
  try {
    const rows = await db.select().from(articlesTable).where(eq(articlesTable.supplierId, id));
    res.json(rows.filter(r => r.isAvailable));
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// Public: deals — discounted articles, scoped to vendor delegation
// Query params:
//   delegation  — Arabic delegation name (e.g. "بن قردان") — REQUIRED for correct zone filtering
//   fallback    — "latest" (default) | "none"  — what to return when no deals found in zone
router.get("/products/deals", async (req, res) => {
  const delegation = typeof req.query.delegation === "string" ? req.query.delegation.trim() : null;
  const fallback   = req.query.fallback === "none" ? "none" : "latest";

  // Shared field list used for both deal and fallback queries
  const FIELDS = {
    id:            articlesTable.id,
    providerId:    articlesTable.supplierId,
    title:         articlesTable.nameAr,
    titleFr:       articlesTable.nameFr,
    description:   articlesTable.descriptionAr,
    imageUrl:      articlesTable.photoUrl,
    salePrice:     articlesTable.price,
    originalPrice: articlesTable.originalPrice,
    category:      serviceProvidersTable.category,
    supplierName:  serviceProvidersTable.nameAr,
    delegationAr:  serviceProvidersTable.delegationAr,
    isAvailable:   articlesTable.isAvailable,
    createdAt:     articlesTable.createdAt,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fmt = (rows: any[]) => rows.map(r => ({
    ...r,
    salePrice:     r.salePrice     != null ? String(r.salePrice)     : null,
    originalPrice: r.originalPrice != null ? String(r.originalPrice) : null,
  }));

  try {
    // Build the zone condition — if delegation provided, filter strictly
    const zoneCondition = delegation
      ? eq(serviceProvidersTable.delegationAr, delegation)
      : sql`1=1`;

    // 1st query: discounted products in zone
    const deals = await db
      .select(FIELDS)
      .from(articlesTable)
      .leftJoin(serviceProvidersTable, eq(articlesTable.supplierId, serviceProvidersTable.id))
      .where(
        and(
          eq(articlesTable.isAvailable, true),
          isNotNull(articlesTable.originalPrice),
          sql`${articlesTable.price} < ${articlesTable.originalPrice}`,
          zoneCondition,
        )
      )
      .orderBy(sql`${articlesTable.createdAt} desc`)
      .limit(24);

    if (deals.length > 0) {
      return res.json(fmt(deals));
    }

    // No deals in zone — fallback: return latest available products in same zone
    if (fallback === "none" || !delegation) {
      return res.json([]);
    }

    const latest = await db
      .select(FIELDS)
      .from(articlesTable)
      .leftJoin(serviceProvidersTable, eq(articlesTable.supplierId, serviceProvidersTable.id))
      .where(
        and(
          eq(articlesTable.isAvailable, true),
          zoneCondition,
        )
      )
      .orderBy(sql`${articlesTable.createdAt} desc`)
      .limit(12);

    // Tag fallback rows so the frontend can show a "latest" label instead of "deals"
    return res.json(fmt(latest).map(r => ({ ...r, isFallback: true })));
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ message: "Internal server error" });
  }
});


// ── Provider-facing article endpoints ────────────────────────────────────────

// GET /provider/:providerId/articles  — list own articles (all, including unavailable)
router.get("/provider/:providerId/articles", async (req, res) => {
  const supplierId = parseInt(req.params.providerId);
  if (isNaN(supplierId)) { res.status(400).json({ message: "Invalid providerId" }); return; }
  try {
    const rows = await db.select().from(articlesTable)
      .where(eq(articlesTable.supplierId, supplierId))
      .orderBy(articlesTable.createdAt);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// POST /provider/:providerId/articles  — create article
router.post("/provider/:providerId/articles", async (req, res) => {
  const supplierId = parseInt(req.params.providerId);
  if (isNaN(supplierId)) { res.status(400).json({ message: "Invalid providerId" }); return; }
  const { nameAr, nameFr, descriptionAr, descriptionFr, price, originalPrice, photoUrl, images, isAvailable } = req.body;
  if (!nameAr) { res.status(400).json({ message: "nameAr required" }); return; }
  // Derive photoUrl from first image if not provided
  const imagesJson = Array.isArray(images) ? JSON.stringify(images) : (images || null);
  const parsedImages: string[] = (() => { try { return JSON.parse(imagesJson || "[]"); } catch { return []; } })();
  const firstImage = parsedImages[0] || photoUrl || null;
  try {
    const [article] = await db.insert(articlesTable).values({
      supplierId,
      nameAr,
      nameFr: nameFr || nameAr,
      descriptionAr: descriptionAr || "",
      descriptionFr: descriptionFr || descriptionAr || "",
      price: price != null ? Number(price) : 0,
      originalPrice: originalPrice != null ? Number(originalPrice) : null,
      photoUrl: firstImage,
      images: imagesJson,
      isAvailable: isAvailable !== false,
    }).returning();
    res.status(201).json(article);
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /provider/:providerId/articles/:id  — update own article
router.patch("/provider/:providerId/articles/:id", async (req, res) => {
  const supplierId = parseInt(req.params.providerId);
  const id = parseInt(req.params.id);
  if (isNaN(supplierId) || isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { nameAr, nameFr, descriptionAr, descriptionFr, price, originalPrice, photoUrl, images, isAvailable } = req.body;
  const updates: Record<string, unknown> = {};
  if (nameAr !== undefined)        updates.nameAr        = nameAr;
  if (nameFr !== undefined)        updates.nameFr        = nameFr;
  if (descriptionAr !== undefined) updates.descriptionAr = descriptionAr;
  if (descriptionFr !== undefined) updates.descriptionFr = descriptionFr;
  if (price !== undefined)         updates.price         = price != null ? Number(price) : 0;
  if (originalPrice !== undefined) updates.originalPrice = originalPrice != null ? Number(originalPrice) : null;
  if (images !== undefined) {
    const imagesJson = Array.isArray(images) ? JSON.stringify(images) : (images || null);
    updates.images = imagesJson;
    // Keep photoUrl in sync with first image
    const parsedImages: string[] = (() => { try { return JSON.parse(imagesJson || "[]"); } catch { return []; } })();
    updates.photoUrl = parsedImages[0] || photoUrl || null;
  } else if (photoUrl !== undefined) {
    updates.photoUrl = photoUrl || null;
  }
  if (isAvailable !== undefined)   updates.isAvailable   = isAvailable;
  try {
    const [article] = await db.update(articlesTable).set(updates)
      .where(and(eq(articlesTable.id, id), eq(articlesTable.supplierId, supplierId)))
      .returning();
    if (!article) { res.status(404).json({ message: "Not found" }); return; }
    res.json(article);
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /provider/:providerId/articles/:id  — delete own article
router.delete("/provider/:providerId/articles/:id", async (req, res) => {
  const supplierId = parseInt(req.params.providerId);
  const id = parseInt(req.params.id);
  if (isNaN(supplierId) || isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    await db.delete(articlesTable).where(and(eq(articlesTable.id, id), eq(articlesTable.supplierId, supplierId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// ── Admin article endpoints ───────────────────────────────────────────────────

router.get("/admin/articles", requireAdmin, async (req, res) => {
  try {
    const { supplierId } = req.query;
    const sid = safeParseInt(supplierId as string);
    let rows;
    if (sid) {
      rows = await db.select().from(articlesTable)
        .where(eq(articlesTable.supplierId, sid))
        .orderBy(articlesTable.createdAt);
    } else {
      rows = await db.select({
        id: articlesTable.id,
        supplierId: articlesTable.supplierId,
        nameAr: articlesTable.nameAr,
        nameFr: articlesTable.nameFr,
        descriptionAr: articlesTable.descriptionAr,
        descriptionFr: articlesTable.descriptionFr,
        price: articlesTable.price,
        originalPrice: articlesTable.originalPrice,
        discountedPrice: articlesTable.discountedPrice,
        photoUrl: articlesTable.photoUrl,
        images: articlesTable.images,
        isAvailable: articlesTable.isAvailable,
        createdAt: articlesTable.createdAt,
        supplierName: serviceProvidersTable.name,
        supplierNameAr: serviceProvidersTable.nameAr,
      })
      .from(articlesTable)
      .leftJoin(serviceProvidersTable, eq(articlesTable.supplierId, serviceProvidersTable.id))
      .orderBy(articlesTable.createdAt);
    }
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Error fetching articles");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin/articles", requireAdmin, async (req, res) => {
  const {
    supplierId, nameAr, nameFr, descriptionAr, descriptionFr,
    price, originalPrice, discountedPrice, photoUrl, images, isAvailable,
  } = req.body;
  const sid = safeParseInt(supplierId);
  if (!sid || !nameAr) {
    res.status(400).json({ message: "supplierId et nameAr sont requis · supplierId و nameAr مطلوبان" }); return;
  }
  const imagesJson = Array.isArray(images) ? JSON.stringify(images) : (images || null);
  const parsedImages: string[] = (() => { try { return JSON.parse(imagesJson || "[]"); } catch { return []; } })();
  const firstImage = parsedImages[0] || photoUrl || null;
  try {
    const [article] = await db.insert(articlesTable).values({
      supplierId: sid,
      nameAr: nameAr.trim(),
      nameFr: (nameFr || nameAr).trim(),
      descriptionAr: descriptionAr || "",
      descriptionFr: descriptionFr || descriptionAr || "",
      price: safeParseFloat(price) ?? 0,
      originalPrice: originalPrice != null ? (safeParseFloat(originalPrice) ?? null) : null,
      discountedPrice: discountedPrice != null ? (safeParseFloat(discountedPrice) ?? null) : null,
      photoUrl: firstImage,
      images: imagesJson,
      isAvailable: isAvailable ?? true,
    }).returning();
    res.status(201).json(article);
  } catch (err) {
    req.log.error({ err }, "Error creating article");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/admin/articles/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const {
    nameAr, nameFr, descriptionAr, descriptionFr,
    price, originalPrice, discountedPrice, photoUrl, images, isAvailable, supplierId,
  } = req.body;
  const sid = supplierId ? safeParseInt(supplierId) : undefined;
  const updates: Record<string, unknown> = {};
  if (nameAr !== undefined)           updates.nameAr           = nameAr;
  if (nameFr !== undefined)           updates.nameFr           = nameFr || nameAr;
  if (descriptionAr !== undefined)    updates.descriptionAr    = descriptionAr;
  if (descriptionFr !== undefined)    updates.descriptionFr    = descriptionFr;
  if (price !== undefined)            updates.price            = safeParseFloat(price) ?? 0;
  if (originalPrice !== undefined)    updates.originalPrice    = originalPrice != null ? (safeParseFloat(originalPrice) ?? null) : null;
  if (discountedPrice !== undefined)  updates.discountedPrice  = discountedPrice != null ? (safeParseFloat(discountedPrice) ?? null) : null;
  if (images !== undefined) {
    const imagesJson = Array.isArray(images) ? JSON.stringify(images) : (images || null);
    updates.images = imagesJson;
    const parsedImages: string[] = (() => { try { return JSON.parse(imagesJson || "[]"); } catch { return []; } })();
    updates.photoUrl = parsedImages[0] || photoUrl || null;
  } else if (photoUrl !== undefined) {
    updates.photoUrl = photoUrl || null;
  }
  if (isAvailable !== undefined)      updates.isAvailable      = isAvailable;
  if (sid)                            updates.supplierId       = sid;
  try {
    const [article] = await db.update(articlesTable)
      .set(updates)
      .where(eq(articlesTable.id, id))
      .returning();
    if (!article) { res.status(404).json({ message: "Not found" }); return; }
    res.json(article);
  } catch (err) {
    req.log.error({ err }, "Error updating article");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/admin/articles/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    await db.delete(articlesTable).where(eq(articlesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting article");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
