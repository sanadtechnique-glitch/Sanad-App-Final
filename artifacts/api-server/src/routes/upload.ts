import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { requireAdmin, requireAuth } from "../lib/authMiddleware";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir  = path.resolve(__dirname, "../../uploads/ads");
const logosDir    = path.resolve(__dirname, "../../uploads/logos");
const imagesDir   = path.resolve(__dirname, "../../uploads/images");

fs.mkdirSync(uploadsDir,  { recursive: true });
fs.mkdirSync(logosDir,    { recursive: true });
fs.mkdirSync(imagesDir,   { recursive: true });

function makeStorage(dir: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename:    (_req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase() || ".jpg";
      const name = randomBytes(12).toString("hex") + ext;
      cb(null, name);
    },
  });
}

const imageFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext) || file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error("Invalid file type"));
};

const uploadAd     = multer({ storage: makeStorage(uploadsDir), limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: imageFilter });
const uploadLogo   = multer({ storage: makeStorage(logosDir),   limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: imageFilter });
const uploadImage  = multer({ storage: makeStorage(imagesDir),  limits: { fileSize: 8 * 1024 * 1024 }, fileFilter: imageFilter });

const router = Router();

// POST /admin/upload/ad — upload a single ad image (admin only)
router.post("/admin/upload/ad", requireAdmin, uploadAd.single("image"), (req, res) => {
  if (!req.file) { res.status(400).json({ message: "No file uploaded" }); return; }
  const url = `/uploads/ads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

// POST /admin/upload/logo — upload the app logo (admin only)
router.post("/admin/upload/logo", requireAdmin, uploadLogo.single("image"), (req, res) => {
  if (!req.file) { res.status(400).json({ message: "No file uploaded" }); return; }
  const url = `/uploads/logos/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

// POST /upload/image — general image upload for providers & admins
router.post("/upload/image", requireAuth, uploadImage.single("image"), (req, res) => {
  if (!req.file) { res.status(400).json({ message: "No file uploaded" }); return; }
  const url = `/uploads/images/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

export default router;
