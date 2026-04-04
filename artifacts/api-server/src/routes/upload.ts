import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { requireAdmin } from "../lib/authMiddleware";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../../uploads/ads");

// Ensure directory exists
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = randomBytes(12).toString("hex") + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Invalid file type"));
  },
});

const router = Router();

// POST /admin/upload/ad — upload a single ad image
router.post("/admin/upload/ad", requireAdmin, upload.single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "No file uploaded" });
    return;
  }
  // Build the public URL
  const protocol = req.protocol;
  const host = req.get("host") ?? "localhost:8080";
  const url = `${protocol}://${host}/uploads/ads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

export default router;
