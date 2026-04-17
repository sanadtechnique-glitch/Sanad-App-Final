import { Router, type Request, type Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const downloadsDir = path.resolve(__dirname, "../../uploads/downloads");

const router = Router();

let buildStatus: {
  state: "idle" | "building" | "done" | "error";
  message: string;
  apkUrl?: string;
  baseUrl?: string;
  startedAt?: number;
  zipContents?: string;
} = { state: "idle", message: "لم يبدأ أي بناء بعد." };

router.get("/status", (_req: Request, res: Response) => {
  res.json(buildStatus);
});

router.post("/", async (req: Request, res: Response) => {
  if (buildStatus.state === "building") {
    res.status(409).json({ error: "Build already in progress.", status: buildStatus });
    return;
  }

  /* ── Resolve production URL ──────────────────────────────────────────────
     Priority:
     1. Explicit body.url (user-provided in the form)
     2. x-forwarded-host + x-forwarded-proto (set by Replit's reverse proxy)
     3. Host header fallback
  */
  let baseUrl: string;
  if (req.body?.url && req.body.url.startsWith("http")) {
    baseUrl = req.body.url.replace(/\/+$/, "");
  } else {
    const forwardedProto = (req.headers["x-forwarded-proto"] as string) || "https";
    const forwardedHost  = (req.headers["x-forwarded-host"] as string) || req.headers.host || "";
    const scheme = forwardedHost.includes("localhost") ? "http" : forwardedProto;
    baseUrl = `${scheme}://${forwardedHost}`;
  }

  buildStatus = {
    state: "building",
    message: `🔨 جارٍ البناء للرابط: ${baseUrl}`,
    baseUrl,
    startedAt: Date.now(),
  };

  res.json({ message: "APK build started.", baseUrl });

  buildApk(baseUrl).catch((err) => {
    buildStatus = { state: "error", message: String(err) };
  });
});

async function buildApk(baseUrl: string) {
  try {
    fs.mkdirSync(downloadsDir, { recursive: true });

    const iconUrl         = `${baseUrl}/icon-512.png`;
    const maskableIconUrl = `${baseUrl}/icon-512-maskable.png`;
    const webManifestUrl  = `${baseUrl}/manifest.json`;

    buildStatus.message = `📡 إرسال الطلب إلى PWABuilder…\n${baseUrl}`;

    const payload = {
      packageId: "com.sanad.app",
      name: "Sanad - سند",
      launcherName: "سند",
      appVersion: "1.0.0",
      appVersionCode: 1,
      display: "standalone",
      orientation: "portrait",
      themeColor: "#1A4D1F",
      navigationColor: "#1A4D1F",
      navigationColorDark: "#133A17",
      navigationDividerColor: "#1A4D1F",
      navigationDividerColorDark: "#133A17",
      backgroundColor: "#FFF3E0",
      enableNotifications: false,
      startUrl: "/",
      iconUrl,
      maskableIconUrl,
      monochromeIconUrl: null,
      splashScreenFadeOutDuration: 600,
      fallbackType: "customtabs",
      features: {
        locationDelegation: { enabled: false },
        playBilling: { enabled: false },
      },
      shortcuts: [],
      webManifestUrl,
      signingMode: "none",
      host: baseUrl,
      generatorInfo: { platform: "PWABuilder", platformVersion: "4.0.0" },
    };

    const response = await fetch(
      "https://pwabuilder-cloudapk.azurewebsites.net/generateApkZip",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(300_000),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PWABuilder API ${response.status}: ${errText.slice(0, 600)}`);
    }

    buildStatus.message = "⬇️ تنزيل الملف المضغوط…";

    const zipBuffer = Buffer.from(await response.arrayBuffer());
    const zipPath   = path.join(downloadsDir, "sanad-pwabuilder.zip");
    fs.writeFileSync(zipPath, zipBuffer);

    buildStatus.message = "📦 استخراج APK…";

    const { default: AdmZip } = await import("adm-zip");
    const zip     = new AdmZip(zipPath);
    const entries = zip.getEntries();
    const names   = entries.map((e) => e.entryName);

    const apkEntry = entries.find(
      (e) => e.entryName.toLowerCase().endsWith(".apk") && !e.isDirectory
    );

    if (!apkEntry) {
      throw new Error(
        `لم يتم إيجاد ملف APK في الأرشيف. المحتويات:\n${names.join("\n")}`
      );
    }

    const apkOut = path.join(downloadsDir, "Sanad.apk");
    fs.writeFileSync(apkOut, apkEntry.getData());
    fs.unlinkSync(zipPath);

    const sizeMb = (fs.statSync(apkOut).size / 1048576).toFixed(1);

    buildStatus = {
      state: "done",
      message: `✅ APK جاهز! (${sizeMb} MB)`,
      apkUrl: "/downloads/Sanad.apk",
      baseUrl,
      zipContents: names.join(", "),
    };
  } catch (err) {
    buildStatus = {
      state: "error",
      message: String(err),
      baseUrl,
    };
  }
}

export default router;
