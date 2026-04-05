import { Router } from "express";
import { db } from "@workspace/db";
import { lawyerRequestsTable, serviceProvidersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../lib/authMiddleware";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

// ── Storage for lawyer document photos ─────────────────────────────────────
const uploadsDir = path.join(process.cwd(), "public", "uploads", "lawyer-docs");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith("image/"));
  },
});

// ── GET /lawyers → public, list all available lawyers ──────────────────────
router.get("/lawyers", async (_req, res) => {
  try {
    const lawyers = await db
      .select()
      .from(serviceProvidersTable)
      .where(eq(serviceProvidersTable.category, "lawyer"))
      .orderBy(serviceProvidersTable.name);
    res.json(lawyers);
  } catch (e) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── POST /lawyer-requests/upload → upload a case photo ─────────────────────
router.post("/lawyer-requests/upload", upload.single("photo"), (req, res) => {
  if (!req.file) { res.status(400).json({ message: "No file uploaded" }); return; }
  const url = `/uploads/lawyer-docs/${req.file.filename}`;
  res.json({ url });
});

// ── POST /lawyer-requests → customer submits a request ─────────────────────
router.post("/lawyer-requests", async (req, res) => {
  try {
    const { customerId, customerName, customerPhone, lawyerId, lawyerName, caseType, court, photos, notes } = req.body;
    if (!customerName || !customerPhone || !lawyerId || !lawyerName || !court) {
      res.status(400).json({ message: "Champs requis manquants" });
      return;
    }
    const [created] = await db.insert(lawyerRequestsTable).values({
      customerId: customerId || null,
      customerName,
      customerPhone,
      lawyerId: Number(lawyerId),
      lawyerName,
      caseType: caseType || "other",
      court,
      photos: JSON.stringify(photos || []),
      notes: notes || "",
      status: "pending",
    }).returning();
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── GET /lawyer-requests/my-customer/:customerId → customer's own requests ──
router.get("/lawyer-requests/my-customer/:customerId", async (req, res) => {
  try {
    const customerId = Number(req.params.customerId);
    const requests = await db
      .select()
      .from(lawyerRequestsTable)
      .where(eq(lawyerRequestsTable.customerId, customerId))
      .orderBy(desc(lawyerRequestsTable.createdAt));
    res.json(requests);
  } catch (e) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── GET /lawyer-requests/my/:lawyerId → lawyer views their requests ─────────
router.get("/lawyer-requests/my/:lawyerId", requireAuth, async (req, res) => {
  try {
    const lawyerId = Number(req.params.lawyerId);
    const requests = await db
      .select()
      .from(lawyerRequestsTable)
      .where(eq(lawyerRequestsTable.lawyerId, lawyerId))
      .orderBy(desc(lawyerRequestsTable.createdAt));
    res.json(requests);
  } catch (e) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── GET /admin/lawyer-requests → admin sees all requests ───────────────────
router.get("/admin/lawyer-requests", requireAdmin, async (_req, res) => {
  try {
    const requests = await db
      .select()
      .from(lawyerRequestsTable)
      .orderBy(desc(lawyerRequestsTable.createdAt));
    res.json(requests);
  } catch (e) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── PATCH /lawyer-requests/:id/status → lawyer accepts or rejects ──────────
router.patch("/lawyer-requests/:id/status", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    if (!["accepted", "rejected"].includes(status)) {
      res.status(400).json({ message: "Statut invalide" });
      return;
    }
    const [updated] = await db
      .update(lawyerRequestsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(lawyerRequestsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ message: "Demande introuvable" }); return; }
    res.json(updated);
  } catch (e) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// ── GET /lawyer-requests/pending-count/:lawyerId ────────────────────────────
router.get("/lawyer-requests/pending-count/:lawyerId", requireAuth, async (req, res) => {
  try {
    const lawyerId = Number(req.params.lawyerId);
    const requests = await db
      .select()
      .from(lawyerRequestsTable)
      .where(eq(lawyerRequestsTable.lawyerId, lawyerId));
    const count = requests.filter(r => r.status === "pending").length;
    res.json({ count });
  } catch (e) {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
