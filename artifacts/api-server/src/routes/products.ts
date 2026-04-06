import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable, articlesTable, serviceProvidersTable } from "@workspace/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";

const router: IRouter = Router();

// Public — all available products (legacy table)
router.get("/products", async (req, res) => {
  try {
    const rows = await db.select().from(productsTable)
      .where(eq(productsTable.isAvailable, true))
      .orderBy(productsTable.createdAt);
    res.json(rows);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// Public — deals: articles on discount from articlesTable
// Two discount patterns:
//   1. Admin sets discountedPrice < price
//   2. Provider sets price (sale) < originalPrice
router.get("/products/deals", async (req, res) => {
  try {
    const rows = await db
      .select({
        id:            articlesTable.id,
        providerId:    articlesTable.supplierId,
        title:         articlesTable.nameAr,
        description:   articlesTable.descriptionAr,
        imageUrl:      articlesTable.photoUrl,
        category:      serviceProvidersTable.category,
        supplierName:  serviceProvidersTable.nameAr,
        // raw fields to compute correct originalPrice / salePrice below
        price:          articlesTable.price,
        originalPrice:  articlesTable.originalPrice,
        discountedPrice: articlesTable.discountedPrice,
        isAvailable:   articlesTable.isAvailable,
        createdAt:     articlesTable.createdAt,
      })
      .from(articlesTable)
      .innerJoin(serviceProvidersTable, eq(articlesTable.supplierId, serviceProvidersTable.id))
      .where(eq(articlesTable.isAvailable, true))
      .orderBy(articlesTable.createdAt);

    // Normalise to { originalPrice, salePrice } and filter to discounted only
    const deals = rows
      .map(p => {
        const price     = p.price ?? 0;
        const origPrice = p.originalPrice ?? 0;
        const discPrice = p.discountedPrice ?? 0;

        let originalPrice: number, salePrice: number;

        if (discPrice > 0 && discPrice < price) {
          // Pattern 1 (admin): price is base, discountedPrice is sale price
          originalPrice = price;
          salePrice     = discPrice;
        } else if (origPrice > 0 && price > 0 && price < origPrice) {
          // Pattern 2 (provider): originalPrice is base, price is sale price
          originalPrice = origPrice;
          salePrice     = price;
        } else {
          return null; // not a deal
        }

        return {
          id:           p.id,
          providerId:   p.providerId,
          title:        p.title,
          description:  p.description,
          imageUrl:     p.imageUrl,
          category:     p.category,
          supplierName: p.supplierName,
          originalPrice: String(originalPrice),
          salePrice:     String(salePrice),
          isAvailable:  p.isAvailable,
          createdAt:    p.createdAt,
        };
      })
      .filter(Boolean);

    res.json(deals);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// Provider — get own products
router.get("/provider/:providerId/products", async (req, res) => {
  try {
    const providerId = parseInt(req.params.providerId);
    const rows = await db.select().from(productsTable)
      .where(eq(productsTable.providerId, providerId))
      .orderBy(productsTable.createdAt);
    res.json(rows);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// Provider — add product
router.post("/provider/:providerId/products", async (req, res) => {
  try {
    const providerId = parseInt(req.params.providerId);
    const { title, description, imageUrl, category, originalPrice, salePrice, isAvailable } = req.body;
    if (!title) return res.status(400).json({ message: "title required" });
    const [prod] = await db.insert(productsTable).values({
      providerId,
      title,
      description: description || null,
      imageUrl: imageUrl || null,
      category: category || null,
      originalPrice: originalPrice != null ? String(originalPrice) : null,
      salePrice: salePrice != null ? String(salePrice) : null,
      isAvailable: isAvailable !== false,
    }).returning();
    res.status(201).json(prod);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// Provider — update product
router.patch("/provider/:providerId/products/:id", async (req, res) => {
  try {
    const providerId = parseInt(req.params.providerId);
    const id = parseInt(req.params.id);
    const { title, description, imageUrl, category, originalPrice, salePrice, isAvailable } = req.body;
    const updates: Record<string, unknown> = {};
    if (title !== undefined)         updates.title         = title;
    if (description !== undefined)   updates.description   = description;
    if (imageUrl !== undefined)      updates.imageUrl      = imageUrl;
    if (category !== undefined)      updates.category      = category;
    if (originalPrice !== undefined) updates.originalPrice = originalPrice != null ? String(originalPrice) : null;
    if (salePrice !== undefined)     updates.salePrice     = salePrice != null ? String(salePrice) : null;
    if (isAvailable !== undefined)   updates.isAvailable   = isAvailable;
    const [prod] = await db.update(productsTable).set(updates)
      .where(and(eq(productsTable.id, id), eq(productsTable.providerId, providerId)))
      .returning();
    if (!prod) return res.status(404).json({ message: "Not found" });
    res.json(prod);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// Provider — delete product
router.delete("/provider/:providerId/products/:id", async (req, res) => {
  try {
    const providerId = parseInt(req.params.providerId);
    const id = parseInt(req.params.id);
    await db.delete(productsTable)
      .where(and(eq(productsTable.id, id), eq(productsTable.providerId, providerId)));
    res.json({ ok: true });
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// Admin — all products
router.get("/admin/products", async (req, res) => {
  try {
    res.json(await db.select().from(productsTable).orderBy(productsTable.createdAt));
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

export default router;
