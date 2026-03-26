import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { serviceProvidersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/admin/suppliers", async (req, res) => {
  try {
    const suppliers = await db.select().from(serviceProvidersTable).orderBy(serviceProvidersTable.createdAt);
    res.json(suppliers);
  } catch (err) {
    req.log.error({ err }, "Error fetching suppliers");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin/suppliers", async (req, res) => {
  const { name, nameAr, category, description, descriptionAr, address, rating, isAvailable } = req.body;
  if (!name || !nameAr || !category) {
    res.status(400).json({ message: "name, nameAr, category are required" });
    return;
  }
  try {
    const [supplier] = await db.insert(serviceProvidersTable).values({
      name, nameAr, category,
      description: description || "",
      descriptionAr: descriptionAr || "",
      address: address || "",
      rating: rating ?? 4.5,
      isAvailable: isAvailable ?? true,
    }).returning();
    res.status(201).json(supplier);
  } catch (err) {
    req.log.error({ err }, "Error creating supplier");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/admin/suppliers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  const { name, nameAr, category, description, descriptionAr, address, rating, isAvailable } = req.body;
  try {
    const [supplier] = await db.update(serviceProvidersTable)
      .set({ name, nameAr, category, description, descriptionAr, address, rating, isAvailable })
      .where(eq(serviceProvidersTable.id, id))
      .returning();
    if (!supplier) { res.status(404).json({ message: "Not found" }); return; }
    res.json(supplier);
  } catch (err) {
    req.log.error({ err }, "Error updating supplier");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/admin/suppliers/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    await db.delete(serviceProvidersTable).where(eq(serviceProvidersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting supplier");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
