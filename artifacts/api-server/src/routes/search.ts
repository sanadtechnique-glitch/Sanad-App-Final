import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { serviceProvidersTable, articlesTable } from "@workspace/db/schema";
import { ilike, or, eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

const CATEGORY_AR: Record<string, string[]> = {
  restaurant:  ["مطاعم", "مطعم", "restaurant", "restaurants"],
  grocery:     ["بقالة", "بقال", "épicerie", "epicerie"],
  pharmacy:    ["صيدلية", "دواء", "صيدليات", "pharmacie"],
  bakery:      ["مخبز", "خبز", "خبازة", "boulangerie"],
  butcher:     ["جزار", "لحم", "لحوم", "بوشري", "boucherie"],
  sweets:      ["مرطبات", "حلويات", "حلوى", "مرطب", "pâtisserie", "patisserie", "gâteau"],
  cafe:        ["مقهى", "قهوة", "مقاهي", "café", "cafe"],
  doctor:      ["طبيب", "دكتور", "أطباء", "médecin", "medecin"],
  taxi:        ["تاكسي", "سيارة أجرة", "taxi"],
  car_rental:  ["كراء سيارات", "كراء", "تأجير سيارات", "location auto", "location"],
  sos:         ["طوارئ", "مساعدة", "نجدة", "urgence", "sos"],
  lawyer:      ["محامي", "محامين", "محاماة", "avocat", "avocats"],
  hotel:       ["فنادق", "فندق", "إقامة", "hôtel", "hotel", "hébergement"],
};

function findMatchingCategories(q: string): string[] {
  const lower = q.toLowerCase();
  const matched: string[] = [];
  for (const [cat, labels] of Object.entries(CATEGORY_AR)) {
    if (labels.some(l => l.includes(lower) || lower.includes(l))) {
      matched.push(cat);
    }
  }
  return matched;
}

router.get("/search", async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || "").trim();
  if (!q || q.length < 2) {
    res.json({ providers: [], articles: [] });
    return;
  }

  const pattern = `%${q}%`;
  const matchedCategories = findMatchingCategories(q);

  try {
    const providerConditions = [
      ilike(serviceProvidersTable.name,          pattern),
      ilike(serviceProvidersTable.nameAr,        pattern),
      ilike(serviceProvidersTable.category,      pattern),
      ilike(serviceProvidersTable.description,   pattern),
      ilike(serviceProvidersTable.descriptionAr, pattern),
      ilike(serviceProvidersTable.address,       pattern),
    ];
    if (matchedCategories.length > 0) {
      providerConditions.push(inArray(serviceProvidersTable.category, matchedCategories as any));
    }

    const [providers, articles] = await Promise.all([
      db
        .select({
          id:            serviceProvidersTable.id,
          name:          serviceProvidersTable.name,
          nameAr:        serviceProvidersTable.nameAr,
          category:      serviceProvidersTable.category,
          description:   serviceProvidersTable.description,
          descriptionAr: serviceProvidersTable.descriptionAr,
          photoUrl:      serviceProvidersTable.photoUrl,
          rating:        serviceProvidersTable.rating,
          isAvailable:   serviceProvidersTable.isAvailable,
          address:       serviceProvidersTable.address,
        })
        .from(serviceProvidersTable)
        .where(or(...providerConditions))
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
