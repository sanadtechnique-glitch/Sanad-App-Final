import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { serviceProvidersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/services", async (req, res) => {
  const { category } = req.query;
  try {
    let providers;
    if (category && typeof category === "string") {
      providers = await db.select().from(serviceProvidersTable).where(eq(serviceProvidersTable.category, category as any));
    } else {
      providers = await db.select().from(serviceProvidersTable);
    }
    res.json(providers);
  } catch (err) {
    req.log.error({ err }, "Error fetching services");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
