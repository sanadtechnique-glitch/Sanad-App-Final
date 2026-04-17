/* ═══════════════════════════════════════════════════════════════════════
   D17 Receipt OCR — Automated Subscription Renewal
   POST /provider/:providerId/subscription/d17-renew
   ═══════════════════════════════════════════════════════════════════════ */
import { Router, type IRouter } from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { db } from "@workspace/db";
import { d17ReceiptsTable, serviceProvidersTable, usersTable, pushSubscriptionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { requireStaff, requireAdmin } from "../lib/authMiddleware";
import { ai } from "@workspace/integrations-gemini-ai";
import { sendPushToUsers } from "./push";
import { objectStorageClient } from "../lib/objectStorage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router: IRouter = Router();

// ── Multer: accept images up to 8 MB ─────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Images only"));
  },
});

// ── Save buffer to object storage (same pattern as upload.ts) ────────────────
async function saveReceiptImage(buffer: Buffer, mimetype: string): Promise<string> {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR not configured");
  const ext = mimetype === "image/png" ? ".png" : mimetype === "image/webp" ? ".webp" : ".jpg";
  const uid = randomBytes(16).toString("hex");
  const dir = privateDir.endsWith("/") ? privateDir.slice(0, -1) : privateDir;
  const fullPath = `${dir}/uploads/d17_${uid}${ext}`;
  const [bucketName, ...rest] = fullPath.replace(/^\//, "").split("/");
  const objectName = rest.join("/");
  const bucket = objectStorageClient.bucket(bucketName!);
  const file   = bucket.file(objectName);
  await file.save(buffer, { metadata: { contentType: mimetype }, resumable: false });
  return `/api/storage/objects/uploads/d17_${uid}${ext}`;
}

// ── Gemini Vision: extract D17 receipt data ───────────────────────────────────
interface D17Data {
  transactionId: string | null;
  amount: number | null;
  date: string | null;         // ISO YYYY-MM-DD
  rawText: string;
  confident: boolean;
}

async function extractD17Data(imageBuffer: Buffer, mimeType: string): Promise<D17Data> {
  const base64 = imageBuffer.toString("base64");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        {
          inlineData: {
            mimeType: mimeType as "image/jpeg" | "image/png" | "image/webp",
            data: base64,
          },
        },
        {
          text: `You are analyzing a D17 (Tunisia digital payment) receipt screenshot.
Extract the following fields from the image:
1. Transaction ID / Reference number (رقم المرجع / رقم المعاملة / Ref. transaction)
2. Amount in TND (المبلغ / Montant) — return as a number with up to 3 decimal places
3. Transaction date (التاريخ / Date) — return as YYYY-MM-DD

Respond ONLY with valid JSON in this exact format:
{
  "transactionId": "<string or null>",
  "amount": <number or null>,
  "date": "<YYYY-MM-DD or null>",
  "confident": <true if you can clearly read all 3 fields, false otherwise>
}

If you cannot clearly read the image or it does not appear to be a D17/payment receipt, set confident to false and all other fields to null.`,
        },
      ],
    }],
    config: { maxOutputTokens: 512, responseMimeType: "application/json" },
  });

  const raw = response.text ?? "";

  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw);
    return {
      transactionId: parsed.transactionId ?? null,
      amount: typeof parsed.amount === "number" ? parsed.amount : null,
      date: parsed.date ?? null,
      rawText: raw,
      confident: parsed.confident === true,
    };
  } catch {
    return { transactionId: null, amount: null, date: null, rawText: raw, confident: false };
  }
}

// ── GET /provider/:providerId/subscription/d17-history ─────────────────────
router.get("/provider/:providerId/subscription/d17-history", requireStaff, async (req, res) => {
  const supplierId = parseInt(req.params.providerId);
  if (isNaN(supplierId)) { res.status(400).json({ message: "Invalid provider id" }); return; }
  try {
    const receipts = await db
      .select()
      .from(d17ReceiptsTable)
      .where(eq(d17ReceiptsTable.supplierId, supplierId))
      .orderBy(d17ReceiptsTable.createdAt);
    res.json(receipts.reverse());
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /provider/:providerId/subscription/d17-renew ──────────────────────
router.post(
  "/provider/:providerId/subscription/d17-renew",
  requireStaff,
  upload.single("receipt"),
  async (req, res) => {
    const supplierId = parseInt(req.params.providerId);
    if (isNaN(supplierId)) { res.status(400).json({ message: "Invalid provider id" }); return; }
    if (!req.file) { res.status(400).json({ message: "Receipt image required" }); return; }

    try {
      // 1. Load provider info
      const [provider] = await db
        .select()
        .from(serviceProvidersTable)
        .where(eq(serviceProvidersTable.id, supplierId));
      if (!provider) { res.status(404).json({ message: "Provider not found" }); return; }

      const expectedFee = provider.subscriptionFee ?? 0;

      // 2. Save image to storage
      let imageUrl = "";
      try {
        imageUrl = await saveReceiptImage(req.file.buffer, req.file.mimetype);
      } catch {
        // If storage fails, continue without persistent URL
        imageUrl = "";
      }

      // 3. OCR via Gemini Vision
      let d17Data: D17Data;
      try {
        d17Data = await extractD17Data(req.file.buffer, req.file.mimetype);
      } catch (ocrErr) {
        req.log.error({ ocrErr }, "Gemini OCR failed");
        d17Data = { transactionId: null, amount: null, date: null, rawText: "", confident: false };
      }

      // 4. Determine today's date in Tunisia timezone (UTC+1)
      const now = new Date();
      const tunisiaDate = new Date(now.getTime() + 60 * 60 * 1000); // UTC+1
      const todayStr = tunisiaDate.toISOString().slice(0, 10); // YYYY-MM-DD

      // 5. Validate
      let status: "approved" | "rejected" | "manual_review" = "manual_review";
      let rejectionReason: string | null = null;

      if (!d17Data.confident || !d17Data.transactionId || d17Data.amount === null || !d17Data.date) {
        status = "manual_review";
        rejectionReason = "OCR could not clearly read the receipt — manual review needed";
      } else {
        // Check amount matches (±0.01 DT tolerance)
        const amountOk = Math.abs(d17Data.amount - expectedFee) < 0.02;
        // Check date is today
        const dateOk = d17Data.date === todayStr;
        // Check transaction ID uniqueness (no previous approved record with same ID)
        const [existing] = await db
          .select()
          .from(d17ReceiptsTable)
          .where(
            and(
              eq(d17ReceiptsTable.transactionId, d17Data.transactionId),
              eq(d17ReceiptsTable.status, "approved"),
            )
          );

        if (!amountOk) {
          status = "rejected";
          rejectionReason = `Amount mismatch: expected ${expectedFee.toFixed(3)} DT, got ${d17Data.amount.toFixed(3)} DT`;
        } else if (!dateOk) {
          status = "rejected";
          rejectionReason = `Date mismatch: receipt date ${d17Data.date} is not today (${todayStr})`;
        } else if (existing) {
          status = "rejected";
          rejectionReason = `Transaction ID "${d17Data.transactionId}" has already been used for a renewal`;
        } else {
          status = "approved";
        }
      }

      // 6. Save receipt record
      const [receipt] = await db.insert(d17ReceiptsTable).values({
        supplierId,
        imageUrl,
        transactionId: d17Data.transactionId,
        amount: d17Data.amount,
        receiptDate: d17Data.date,
        extractedText: d17Data.rawText,
        status,
        rejectionReason,
      }).returning();

      // 7. If approved — extend subscription by 30 days
      if (status === "approved") {
        const currentEnd = provider.subscriptionRenewalDate ?? new Date();
        const base = currentEnd > new Date() ? currentEnd : new Date();
        const newEnd = new Date(base);
        newEnd.setDate(newEnd.getDate() + 30);

        await db.update(serviceProvidersTable).set({
          subscriptionActive: true,
          subscriptionRenewalDate: newEnd,
        }).where(eq(serviceProvidersTable.id, supplierId));

        // Notify vendor via push
        try {
          const providerSubs = await db
            .select()
            .from(pushSubscriptionsTable)
            .where(eq(pushSubscriptionsTable.userId, supplierId));
          if (providerSubs.length > 0) {
            await sendPushToUsers([supplierId], {
              title: "✅ اشتراكك تم تجديده · Abonnement renouvelé",
              body: `تم قبول وصل D17 وتم تمديد اشتراكك 30 يوماً حتى ${newEnd.toLocaleDateString("fr-TN")}`,
              url: "/provider",
            });
          }
        } catch { /* push optional */ }

        res.json({
          status: "approved",
          message: "Subscription renewed for 30 days",
          newEndDate: newEnd.toISOString(),
          receipt,
        });
        return;
      }

      // 8. If manual_review — notify admin
      if (status === "manual_review") {
        try {
          const admins = await db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(eq(usersTable.role, "super_admin"));
          if (admins.length > 0) {
            await sendPushToUsers(
              admins.map(a => a.id),
              {
                title: "🔍 مراجعة يدوية مطلوبة · Révision manuelle",
                body: `المورد "${provider.nameAr}" أرسل وصل D17 يحتاج مراجعة يدوية`,
                url: "/admin",
              }
            );
          }
        } catch { /* push optional */ }
      }

      res.json({
        status,
        message: status === "manual_review"
          ? "Receipt queued for manual review — admin has been notified"
          : "Receipt rejected",
        reason: rejectionReason,
        receipt,
      });

    } catch (err) {
      req.log.error({ err }, "D17 renewal error");
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// ── Admin: list all D17 receipts ─────────────────────────────────────────────
router.get("/admin/d17-receipts", requireAdmin, async (req, res) => {
  try {
    const receipts = await db
      .select({
        id: d17ReceiptsTable.id,
        supplierId: d17ReceiptsTable.supplierId,
        supplierName: serviceProvidersTable.nameAr,
        imageUrl: d17ReceiptsTable.imageUrl,
        transactionId: d17ReceiptsTable.transactionId,
        amount: d17ReceiptsTable.amount,
        receiptDate: d17ReceiptsTable.receiptDate,
        status: d17ReceiptsTable.status,
        rejectionReason: d17ReceiptsTable.rejectionReason,
        createdAt: d17ReceiptsTable.createdAt,
      })
      .from(d17ReceiptsTable)
      .leftJoin(serviceProvidersTable, eq(d17ReceiptsTable.supplierId, serviceProvidersTable.id))
      .orderBy(d17ReceiptsTable.createdAt);
    res.json(receipts.reverse());
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// ── Admin: approve a manual_review receipt ───────────────────────────────────
router.patch("/admin/d17-receipts/:id/approve", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    const [receipt] = await db.select().from(d17ReceiptsTable).where(eq(d17ReceiptsTable.id, id));
    if (!receipt) { res.status(404).json({ message: "Not found" }); return; }

    // Extend subscription
    const [provider] = await db.select().from(serviceProvidersTable).where(eq(serviceProvidersTable.id, receipt.supplierId));
    const currentEnd = provider?.subscriptionRenewalDate ?? new Date();
    const base = currentEnd > new Date() ? currentEnd : new Date();
    const newEnd = new Date(base);
    newEnd.setDate(newEnd.getDate() + 30);

    await db.update(serviceProvidersTable).set({
      subscriptionActive: true,
      subscriptionRenewalDate: newEnd,
    }).where(eq(serviceProvidersTable.id, receipt.supplierId));

    await db.update(d17ReceiptsTable).set({ status: "approved", rejectionReason: null }).where(eq(d17ReceiptsTable.id, id));

    // Notify vendor
    try {
      await sendPushToUsers([receipt.supplierId], {
        title: "✅ اشتراكك تم تجديده",
        body: `تم قبول وصلك ومدد اشتراكك 30 يوماً حتى ${newEnd.toLocaleDateString("fr-TN")}`,
        url: "/provider",
      });
    } catch { /* push optional */ }

    res.json({ ok: true, newEndDate: newEnd.toISOString() });
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

// ── Admin: reject a receipt ──────────────────────────────────────────────────
router.patch("/admin/d17-receipts/:id/reject", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { reason } = req.body;
  if (isNaN(id)) { res.status(400).json({ message: "Invalid id" }); return; }
  try {
    await db.update(d17ReceiptsTable)
      .set({ status: "rejected", rejectionReason: reason || "Rejected by admin" })
      .where(eq(d17ReceiptsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }); res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
