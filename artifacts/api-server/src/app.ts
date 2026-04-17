import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer } from "node:http";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";
import { initSocket } from "./lib/socket";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve uploaded files statically — both paths for dev (Vite proxy) and production
const uploadsDir = path.resolve(__dirname, "../uploads");
app.use("/api/uploads", express.static(uploadsDir));
app.use("/uploads",     express.static(uploadsDir)); // keep for any old stored URLs

// ── Direct app downloads (.apk / .ipa) with correct MIME types ───────────────
const downloadsDir = path.resolve(__dirname, "../uploads/downloads");
app.use(
  "/downloads",
  (req, _res, next) => {
    // Set MIME type before express.static handles the response
    const url = req.url.toLowerCase();
    if (url.endsWith(".apk")) {
      _res.setHeader("Content-Type", "application/vnd.android.package-archive");
      _res.setHeader("Content-Disposition", `attachment; filename="${path.basename(url)}"`);
    } else if (url.endsWith(".ipa")) {
      _res.setHeader("Content-Type", "application/octet-stream");
      _res.setHeader("Content-Disposition", `attachment; filename="${path.basename(url)}"`);
    }
    next();
  },
  express.static(downloadsDir, {
    setHeaders(res, filePath) {
      const lower = filePath.toLowerCase();
      if (lower.endsWith(".apk")) {
        res.setHeader("Content-Type", "application/vnd.android.package-archive");
        res.setHeader("Content-Disposition", `attachment; filename="sanad.apk"`);
      } else if (lower.endsWith(".ipa")) {
        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="sanad.ipa"`);
      }
    },
  }),
);

// ── Global error handler — catches unhandled thrown errors ───────────────────
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Unexpected error";
  logger.error({ err }, "Unhandled error");
  if (!res.headersSent) {
    res.status(500).json({ message: "حدث خطأ في الخادم — يرجى المحاولة مجدداً" });
  }
});

const httpServer = createServer(app);
initSocket(httpServer);

export default httpServer;
