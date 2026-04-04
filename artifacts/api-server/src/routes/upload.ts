import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { requireAdmin } from "../lib/authMiddleware";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../../uploads/ads");
const logosDir  = path.resolve(__dirname, "../../uploads/logos");

// Ensure directories exist
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(logosDir,   { recursive: true });

function makeStorage(dir: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename:    (_req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase();
      const name = randomBytes(12).toString("hex") + ext;
      cb(null, name);
    },
  });
}

const imageFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error("Invalid file type"));
};

const uploadAd   = multer({ storage: makeStorage(uploadsDir), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFilter });
const uploadLogo = multer({ storage: makeStorage(logosDir),   limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFilter });

const router = Router();

// POST /admin/upload/ad — upload a single ad image
router.post("/admin/upload/ad", requireAdmin, uploadAd.single("image"), (req, res) => {
  if (!req.file) { res.status(400).json({ message: "No file uploaded" }); return; }
  const host = req.get("host") ?? "localhost:8080";
  const url  = `${req.protocol}://${host}/uploads/ads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

// POST /admin/upload/logo — upload the app logo
router.post("/admin/upload/logo", requireAdmin, uploadLogo.single("image"), (req, res) => {
  if (!req.file) { res.status(400).json({ message: "No file uploaded" }); return; }
  const host = req.get("host") ?? "localhost:8080";
  const url  = `${req.protocol}://${host}/uploads/logos/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

export default router;
