import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { productsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

// Public — all available products (for deals page etc.)
router.get("/products", async (req, res) => {
  try {
    const rows = await db.select().from(productsTable)
      .where(eq(productsTable.isAvailable, true))
      .orderBy(productsTable.createdAt);
    res.json(rows);
  } catch (err) { req.log.error({ err }); res.status(500).json({ message: "Server error" }); }
});

// Public — deals: products where salePrice < originalPrice
router.get("/products/deals", async (req, res) => {
  try {
    const rows = await db.select().from(productsTable)
      .where(eq(productsTable.isAvailable, true))
      .orderBy(productsTable.createdAt);
    const deals = rows.filter(p => {
      const orig = parseFloat(p.originalPrice ?? "0");
      const sale = parseFloat(p.salePrice ?? "0");
      return orig > 0 && sale > 0 && sale < orig;
    });
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
