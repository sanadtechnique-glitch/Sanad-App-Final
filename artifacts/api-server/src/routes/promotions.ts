import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  promotionsTable, articlesTable, serviceProvidersTable,
  isPromoEligibleCategory, PROMO_ELIGIBLE_CATEGORIES,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAdmin } from "../lib/authMiddleware";
import { safeParseInt } from "../lib/validate";

const router: IRouter = Router();

// ── GET /promotions?supplierId=X ──────────────────────────────────────────────
// Returns all promotions for a supplier, with article names embedded.
// Public — customers can see active promotions on a store page.
router.get("/promotions", async (req, res) => {
  const supplierId = safeParseInt(req.query.supplierId as string);
  if (!supplierId) { res.status(400).json({ message: "supplierId required" }); return; }

  try {
    // Get all promotions for this supplier (both active and inactive — vendor needs to see all)
    const rows = await db
      .select({
        id:           promotionsTable.id,
        supplierId:   promotionsTable.supplierId,
        type:         promotionsTable.type,
        buyArticleId: promotionsTable.buyArticleId,
        getArticleId: promotionsTable.getArticleId,
        buyQty:       promotionsTable.buyQty,
        getFreeQty:   promotionsTable.getFreeQty,
        labelAr:      promotionsTable.labelAr,
        labelFr:      promotionsTable.labelFr,
        isActive:     promotionsTable.isActive,
        createdAt:    promotionsTable.createdAt,
        // Buy article info
        buyNameAr:    articlesTable.nameAr,
        buyNameFr:    articlesTable.nameFr,
        buyPrice:     articlesTable.price,
        buyWeighted:  articlesTable.isWeighted,
      })
      .from(promotionsTable)
      .leftJoin(articlesTable, eq(promotionsTable.buyArticleId, articlesTable.id))
      .where(eq(promotionsTable.supplierId, supplierId))
      .orderBy(promotionsTable.createdAt);

    res.json(rows);
  } catch (err) {
    req.log?.error({ err }); res.status(500).json({ message: "Server error" });
  }
});

// ── GET /promotions/active?supplierId=X ───────────────────────────────────────
// Returns only active promotions — for the customer cart/order page.
router.get("/promotions/active", async (req, res) => {
  const supplierId = safeParseInt(req.query.supplierId as string);
  if (!supplierId) { res.status(400).json({ message: "supplierId required" }); return; }

  try {
    const rows = await db
      .select()
      .from(promotionsTable)
      .where(and(
        eq(promotionsTable.supplierId, supplierId),
        eq(promotionsTable.isActive, true),
      ));
    res.json(rows);
  } catch (err) {
    req.log?.error({ err }); res.status(500).json({ message: "Server error" });
  }
});

// ── POST /promotions ──────────────────────────────────────────────────────────
// Create a promotion. Requires admin OR the authenticated vendor's session.
// Validates: (1) supplier is product category, (2) buyArticle belongs to supplier,
//            (3) getArticle belongs to supplier (if bundle), (4) qty type not on weighted items.
router.post("/promotions", async (req, res) => {
  const {
    supplierId, type, buyArticleId, getArticleId,
    buyQty, getFreeQty, labelAr, labelFr,
  } = req.body as {
    supplierId: number; type: "qty" | "bundle";
    buyArticleId: number; getArticleId?: number | null;
    buyQty: number; getFreeQty: number;
    labelAr?: string; labelFr?: string;
  };

  // ① Basic validation
  if (!supplierId || !buyArticleId || !type) {
    res.status(400).json({ message: "supplierId, type, buyArticleId required" }); return;
  }
  if (!["qty", "bundle"].includes(type)) {
    res.status(400).json({ message: "type must be 'qty' or 'bundle'" }); return;
  }
  if (type === "bundle" && !getArticleId) {
    res.status(400).json({ message: "bundle promotion requires getArticleId" }); return;
  }
  const bQty = Math.max(1, Math.floor(Number(buyQty) || 2));
  const fQty = Math.max(1, Math.floor(Number(getFreeQty) || 1));

  try {
    // ② Check supplier category — must be product-eligible
    const [supplier] = await db
      .select({ id: serviceProvidersTable.id, category: serviceProvidersTable.category })
      .from(serviceProvidersTable)
      .where(eq(serviceProvidersTable.id, supplierId));

    if (!supplier) {
      res.status(404).json({ message: "Supplier not found" }); return;
    }
    if (!isPromoEligibleCategory(supplier.category)) {
      res.status(422).json({
        message: `Promotions are only available for product categories: ${PROMO_ELIGIBLE_CATEGORIES.join(", ")}. Category "${supplier.category}" is a service category.`,
        code: "SERVICE_CATEGORY_NOT_ELIGIBLE",
      }); return;
    }

    // ③ Validate buyArticle belongs to supplier
    const [buyArticle] = await db
      .select({ id: articlesTable.id, supplierId: articlesTable.supplierId, isWeighted: articlesTable.isWeighted })
      .from(articlesTable)
      .where(and(eq(articlesTable.id, buyArticleId), eq(articlesTable.supplierId, supplierId)));

    if (!buyArticle) {
      res.status(404).json({ message: "Buy article not found or doesn't belong to this supplier" }); return;
    }

    // ④ Weighted items can't have qty promotions (2+1 on 100g makes no sense)
    if (type === "qty" && buyArticle.isWeighted) {
      res.status(422).json({
        message: "Quantity promotions (e.g. 2+1 free) cannot be applied to weighted/by-kg articles.",
        code: "WEIGHTED_ITEM_NOT_ELIGIBLE",
      }); return;
    }

    // ⑤ Validate getArticle if bundle
    if (type === "bundle" && getArticleId) {
      const [getArticle] = await db
        .select({ id: articlesTable.id, supplierId: articlesTable.supplierId })
        .from(articlesTable)
        .where(and(eq(articlesTable.id, getArticleId), eq(articlesTable.supplierId, supplierId)));
      if (!getArticle) {
        res.status(404).json({ message: "Get-free article not found or doesn't belong to this supplier" }); return;
      }
    }

    // ⑥ Auto-generate labels if not provided
    const autoAr = type === "qty"
      ? `اشترِ ${bQty} واحصل على ${fQty} مجاناً`
      : `اشترِ المنتج واحصل على منتج مجاناً`;
    const autoFr = type === "qty"
      ? `Achetez ${bQty} et obtenez ${fQty} gratuit`
      : `Achetez ce produit et obtenez un article gratuit`;

    // ⑦ Insert
    const [promo] = await db.insert(promotionsTable).values({
      supplierId,
      type,
      buyArticleId,
      getArticleId: type === "bundle" ? (getArticleId ?? null) : null,
      buyQty: bQty,
      getFreeQty: fQty,
      labelAr: labelAr?.trim() || autoAr,
      labelFr: labelFr?.trim() || autoFr,
      isActive: true,
    }).returning();

    res.status(201).json(promo);
  } catch (err) {
    req.log?.error({ err }); res.status(500).json({ message: "Server error" });
  }
});

// ── PATCH /promotions/:id ─────────────────────────────────────────────────────
// Toggle active / update fields
router.patch("/promotions/:id", async (req, res) => {
  const id = safeParseInt(req.params.id);
  if (!id) { res.status(400).json({ message: "Invalid id" }); return; }

  const { isActive, labelAr, labelFr, buyQty, getFreeQty } = req.body as {
    isActive?: boolean; labelAr?: string; labelFr?: string;
    buyQty?: number; getFreeQty?: number;
  };

  const updates: Record<string, unknown> = {};
  if (typeof isActive === "boolean") updates.isActive = isActive;
  if (labelAr !== undefined) updates.labelAr = labelAr.trim();
  if (labelFr !== undefined) updates.labelFr = labelFr.trim();
  if (buyQty !== undefined)    updates.buyQty    = Math.max(1, Math.floor(Number(buyQty)));
  if (getFreeQty !== undefined) updates.getFreeQty = Math.max(1, Math.floor(Number(getFreeQty)));

  try {
    const [updated] = await db
      .update(promotionsTable)
      .set(updates)
      .where(eq(promotionsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ message: "Promotion not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log?.error({ err }); res.status(500).json({ message: "Server error" });
  }
});

// ── DELETE /promotions/:id ────────────────────────────────────────────────────
router.delete("/promotions/:id", async (req, res) => {
  const id = safeParseInt(req.params.id);
  if (!id) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    await db.delete(promotionsTable).where(eq(promotionsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log?.error({ err }); res.status(500).json({ message: "Server error" });
  }
});

export default router;
