import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { serviceProvidersTable, articlesTable } from "@workspace/db/schema";
import { ilike, or } from "drizzle-orm";

const router: IRouter = Router();

// GET /search?q=query — public full-text search across providers & products
router.get("/search", async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || "").trim();
  if (!q || q.length < 2) {
    res.json({ providers: [], articles: [] });
    return;
  }

  const pattern = `%${q}%`;

  try {
    const [providers, articles] = await Promise.all([
      db
        .select({
          id:          serviceProvidersTable.id,
          name:        serviceProvidersTable.name,
          nameAr:      serviceProvidersTable.nameAr,
          category:    serviceProvidersTable.category,
          description: serviceProvidersTable.description,
          descriptionAr: serviceProvidersTable.descriptionAr,
          photoUrl:    serviceProvidersTable.photoUrl,
          rating:      serviceProvidersTable.rating,
          isAvailable: serviceProvidersTable.isAvailable,
          address:     serviceProvidersTable.address,
        })
        .from(serviceProvidersTable)
        .where(
          or(
            ilike(serviceProvidersTable.name,          pattern),
            ilike(serviceProvidersTable.nameAr,        pattern),
            ilike(serviceProvidersTable.category,      pattern),
            ilike(serviceProvidersTable.description,   pattern),
            ilike(serviceProvidersTable.descriptionAr, pattern),
            ilike(serviceProvidersTable.address,       pattern),
          )
        )
        .limit(10),

      db
        .select({
          id:          articlesTable.id,
          nameAr:      articlesTable.nameAr,
          nameFr:      articlesTable.nameFr,
          price:       articlesTable.price,
          photoUrl:    articlesTable.photoUrl,
          supplierId:  articlesTable.supplierId,
          isAvailable: articlesTable.isAvailable,
        })
        .from(articlesTable)
        .where(
          or(
            ilike(articlesTable.nameAr, pattern),
            ilike(articlesTable.nameFr, pattern),
            ilike(articlesTable.descriptionAr, pattern),
            ilike(articlesTable.descriptionFr, pattern),
          )
        )
        .limit(15),
    ]);

    res.json({ providers, articles });
  } catch (err) {
    req.log.error({ err });
    res.status(500).json({ message: "Search error" });
  }
});

export default router;
