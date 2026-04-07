import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { requireAdmin, requireAuth } from "../lib/authMiddleware";
import { objectStorageClient } from "../lib/objectStorage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Keep local dirs for backward-compat serving of old URLs ────────────────
const uploadsDir = path.resolve(__dirname, "../uploads/ads");
const logosDir   = path.resolve(__dirname, "../uploads/logos");
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(logosDir,   { recursive: true });

// ── multer in-memory so we can stream to GCS ───────────────────────────────
const imageFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext) || file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error("Invalid file type"));
};
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: imageFilter,
});

// ── Helper: parse a "/bucketId/objectName" path ────────────────────────────
function parseGcsPath(p: string): { bucketName: string; objectName: string } {
  const norm = p.startsWith("/") ? p : `/${p}`;
  const parts = norm.split("/");
  return { bucketName: parts[1]!, objectName: parts.slice(2).join("/") };
}

// ── Helper: upload buffer to GCS using PRIVATE_OBJECT_DIR ─────────────────
// PRIVATE_OBJECT_DIR = "/replit-objstore-xxx/.private"
// Files saved at:  bucketId / .private/uploads/uid.ext
// Served via:      GET /api/storage/objects/uploads/uid.ext
//   → getObjectEntityFile("/objects/uploads/uid.ext")
//   → entityId = "uploads/uid.ext"
//   → objectEntityPath = PRIVATE_OBJECT_DIR + "/uploads/uid.ext"
//   → bucketId/.private/uploads/uid.ext  ✓
async function uploadToGCS(buffer: Buffer, mimetype: string, originalname: string): Promise<string> {
  const privateDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR not configured");

  const ext = path.extname(originalname).toLowerCase() || ".jpg";
  const uid = randomBytes(16).toString("hex");

  // Build the full GCS path: /bucketId/.private/uploads/uid.ext
  const dir = privateDir.endsWith("/") ? privateDir.slice(0, -1) : privateDir;
  const fullPath = `${dir}/uploads/${uid}${ext}`;

  const { bucketName, objectName } = parseGcsPath(fullPath);
  const bucket = objectStorageClient.bucket(bucketName);
  const file   = bucket.file(objectName);

  await file.save(buffer, {
    metadata: { contentType: mimetype },
    resumable: false,
  });

  // Return the objectPath that storage.ts can serve
  return `/objects/uploads/${uid}${ext}`;
}

const router = Router();

// POST /admin/upload/ad — upload a single ad image (admin only) → GCS
router.post("/admin/upload/ad", requireAdmin, memUpload.single("image"), async (req, res) => {
  if (!req.file) { res.status(400).json({ message: "No file uploaded" }); return; }
  try {
    const objectPath = await uploadToGCS(req.file.buffer, req.file.mimetype, req.file.originalname);
    const url = `/api/storage${objectPath}`;
    res.json({ url, filename: path.basename(objectPath) });
  } catch (err) {
    console.error("GCS upload error", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

// POST /admin/upload/logo — upload the app logo (admin only) → GCS
router.post("/admin/upload/logo", requireAdmin, memUpload.single("image"), async (req, res) => {
  if (!req.file) { res.status(400).json({ message: "No file uploaded" }); return; }
  try {
    const objectPath = await uploadToGCS(req.file.buffer, req.file.mimetype, req.file.originalname);
    const url = `/api/storage${objectPath}`;
    res.json({ url, filename: path.basename(objectPath) });
  } catch (err) {
    console.error("GCS upload error", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

// POST /upload/image — general image upload for providers & admins → GCS
router.post("/upload/image", requireAuth, memUpload.single("image"), async (req, res) => {
  if (!req.file) { res.status(400).json({ message: "No file uploaded" }); return; }
  try {
    const objectPath = await uploadToGCS(req.file.buffer, req.file.mimetype, req.file.originalname);
    const url = `/api/storage${objectPath}`;
    res.json({ url, filename: path.basename(objectPath) });
  } catch (err) {
    console.error("GCS upload error", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

// POST /upload/prescription — public upload for customer prescriptions (no auth required)
router.post("/upload/prescription", memUpload.single("image"), async (req, res) => {
  if (!req.file) { res.status(400).json({ message: "No file uploaded" }); return; }
  // Only allow images
  if (!req.file.mimetype.startsWith("image/")) {
    res.status(400).json({ message: "Images only" }); return;
  }
  // Limit to 5MB for prescriptions
  if (req.file.size > 5 * 1024 * 1024) {
    res.status(400).json({ message: "Image too large (max 5MB)" }); return;
  }
  try {
    const objectPath = await uploadToGCS(req.file.buffer, req.file.mimetype, req.file.originalname);
    const url = `/api/storage${objectPath}`;
    res.json({ url, filename: path.basename(objectPath) });
  } catch (err) {
    console.error("GCS prescription upload error", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

// ── Backward-compat: serve old local uploads still in DB ──────────────────
import express from "express";
router.use("/uploads/ads",    express.static(uploadsDir));
router.use("/uploads/logos",  express.static(logosDir));

export default router;
