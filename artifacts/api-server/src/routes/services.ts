import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { serviceProvidersTable } from "@workspace/db/schema";
import { eq, ne, and } from "drizzle-orm";

const router: IRouter = Router();

// Taxi drivers live in service_providers with category='taxi' but are managed
// via the dedicated /taxi page — NEVER expose them here.
router.get("/services", async (req, res) => {
  const { category } = req.query;
  try {
    let providers;
    if (category && typeof category === "string" && category !== "taxi") {
      providers = await db
        .select()
        .from(serviceProvidersTable)
        .where(
          and(
            eq(serviceProvidersTable.category, category as any),
            ne(serviceProvidersTable.category, "taxi"),
          ),
        );
    } else {
      // "all" or unspecified: return every category EXCEPT taxi
      providers = await db
        .select()
        .from(serviceProvidersTable)
        .where(ne(serviceProvidersTable.category, "taxi"));
    }
    res.json(providers);
  } catch (err) {
    req.log.error({ err }, "Error fetching services");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
