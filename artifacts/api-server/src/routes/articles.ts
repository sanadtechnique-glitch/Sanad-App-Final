import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { articlesTable, serviceProvidersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
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
  const { supplierId, nameAr, nameFr, descriptionAr, descriptionFr, price, isAvailable } = req.body;
  const sid = safeParseInt(supplierId);
  if (!sid || !nameAr || !nameFr) {
    res.status(400).json({ message: "supplierId, nameAr, nameFr are required" }); return;
  }
  try {
    const [article] = await db.insert(articlesTable).values({
      supplierId: sid,
      nameAr, nameFr,
      descriptionAr: descriptionAr || "",
      descriptionFr: descriptionFr || "",
      price: safeParseFloat(price) ?? 0,
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
  const { nameAr, nameFr, descriptionAr, descriptionFr, price, isAvailable, supplierId } = req.body;
  const sid = supplierId ? safeParseInt(supplierId) : undefined;
  try {
    const [article] = await db.update(articlesTable)
      .set({
        nameAr, nameFr, descriptionAr, descriptionFr,
        price: price !== undefined ? (safeParseFloat(price) ?? 0) : undefined,
        isAvailable,
        ...(sid ? { supplierId: sid } : {}),
      })
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
