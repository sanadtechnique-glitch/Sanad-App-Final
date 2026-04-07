import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { serviceProvidersTable } from "@workspace/db/schema";
import { eq, notInArray } from "drizzle-orm";

const router: IRouter = Router();

// These categories have their own dedicated pages — exclude from the general "all" list
const DEDICATED_CATEGORIES = ["car_rental", "sos", "lawyer", "taxi"] as const;

router.get("/services", async (req, res) => {
  const { category } = req.query;
  try {
    let providers;
    if (category && typeof category === "string") {
      providers = await db.select().from(serviceProvidersTable).where(eq(serviceProvidersTable.category, category as any));
    } else {
      // "All" view: exclude categories that have dedicated booking pages
      providers = await db.select().from(serviceProvidersTable).where(
        notInArray(serviceProvidersTable.category, DEDICATED_CATEGORIES as unknown as string[])
      );
    }
    res.json(providers);
  } catch (err) {
    req.log.error({ err }, "Error fetching services");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
