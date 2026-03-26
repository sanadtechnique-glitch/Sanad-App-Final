import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/admin/categories", async (req, res) => {
  try {
    const cats = await db.select().from(categoriesTable).orderBy(categoriesTable.createdAt);
    res.json(cats);
  } catch (err) {
    req.log.error({ err }, "Error fetching categories");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin/categories", async (req, res) => {
  const { slug, nameAr, nameFr, descriptionAr, descriptionFr, icon, color } = req.body;
  if (!slug || !nameAr || !nameFr) {
    res.status(400).json({ message: "slug, nameAr, nameFr are required" });
    return;
  }
  try {
    const [cat] = await db.insert(categoriesTable).values({
      slug, nameAr, nameFr,
      descriptionAr: descriptionAr || "",
      descriptionFr: descriptionFr || "",
      icon: icon || "grid",
      color: color || "amber",
    }).returning();
    res.status(201).json(cat);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ message: "Category slug already exists" });
      return;
    }
    req.log.error({ err }, "Error creating category");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/admin/categories/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { nameAr, nameFr, descriptionAr, descriptionFr, icon, color } = req.body;
  try {
    const [cat] = await db.update(categoriesTable)
      .set({ nameAr, nameFr, descriptionAr, descriptionFr, icon, color })
      .where(eq(categoriesTable.id, id))
      .returning();
    if (!cat) { res.status(404).json({ message: "Not found" }); return; }
    res.json(cat);
  } catch (err) {
    req.log.error({ err }, "Error updating category");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/admin/categories/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting category");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
