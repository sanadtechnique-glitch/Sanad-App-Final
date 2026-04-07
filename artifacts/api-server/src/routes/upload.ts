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

// ── Helper: upload buffer to GCS and return objectPath ────────────────────
async function uploadToGCS(buffer: Buffer, mimetype: string, originalname: string): Promise<string> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("Object storage bucket not configured");

  const ext  = path.extname(originalname).toLowerCase() || ".jpg";
  const name = `uploads/${randomBytes(16).toString("hex")}${ext}`;

  const bucket = objectStorageClient.bucket(bucketId);
  const file   = bucket.file(name);

  await file.save(buffer, {
    metadata: { contentType: mimetype },
    resumable: false,
  });

  return `/objects/${name}`;
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

// ── Backward-compat: serve old local uploads still in DB ──────────────────
import express from "express";
router.use("/uploads/ads",    express.static(uploadsDir));
router.use("/uploads/logos",  express.static(logosDir));

export default router;
