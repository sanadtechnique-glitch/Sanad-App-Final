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

// Serve uploaded ad images statically
const uploadsDir = path.resolve(__dirname, "../uploads");
app.use("/uploads", express.static(uploadsDir));

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
