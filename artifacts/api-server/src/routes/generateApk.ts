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
  startedAt?: number;
} = { state: "idle", message: "No build started yet." };

router.get("/status", (_req: Request, res: Response) => {
  res.json(buildStatus);
});

router.post("/", async (req: Request, res: Response) => {
  if (buildStatus.state === "building") {
    res.status(409).json({ error: "Build already in progress.", status: buildStatus });
    return;
  }

  const host =
    req.body?.host ||
    (req.headers["x-forwarded-host"] as string) ||
    req.headers.host ||
    "";

  const scheme =
    req.body?.scheme ||
    (req.headers["x-forwarded-proto"] as string) ||
    (host.startsWith("localhost") ? "http" : "https");

  const baseUrl = `${scheme}://${host}`;

  buildStatus = {
    state: "building",
    message: "Calling PWABuilder cloud API…",
    startedAt: Date.now(),
  };

  res.json({
    message: "APK build started. Poll /api/generate-apk/status for updates.",
    baseUrl,
  });

  buildApk(baseUrl).catch((err) => {
    buildStatus = { state: "error", message: String(err) };
  });
});

async function buildApk(baseUrl: string) {
  try {
    fs.mkdirSync(downloadsDir, { recursive: true });

    const iconUrl          = `${baseUrl}/icon-512.png`;
    const maskableIconUrl  = `${baseUrl}/icon-512-maskable.png`;
    const webManifestUrl   = `${baseUrl}/manifest.json`;

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
      splashScreenFadeOutDuration: 300,
      fallbackType: "customtabs",
      features: {
        locationDelegation: { enabled: false },
        playBilling: { enabled: false },
      },
      shortcuts: [],
      webManifestUrl,
      signingMode: "none",
      host: baseUrl,
      generatorInfo: {
        platform: "PWABuilder",
        platformVersion: "4.0.0",
      },
    };

    buildStatus.message = `Sending request to PWABuilder for ${baseUrl}…`;

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
      throw new Error(`PWABuilder API error ${response.status}: ${errText.slice(0, 400)}`);
    }

    buildStatus.message = "Downloading APK zip from PWABuilder…";

    const zipBuffer = Buffer.from(await response.arrayBuffer());
    const zipPath = path.join(downloadsDir, "sanad-pwabuilder.zip");
    fs.writeFileSync(zipPath, zipBuffer);

    buildStatus.message = "Extracting APK from zip…";

    const { default: AdmZip } = await import("adm-zip");
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    let apkEntry = entries.find(
      (e) => e.entryName.toLowerCase().endsWith(".apk") && !e.isDirectory
    );

    if (!apkEntry) {
      const names = entries.map((e) => e.entryName).join(", ");
      throw new Error(`No .apk found in zip. Contents: ${names}`);
    }

    const apkOut = path.join(downloadsDir, "Sanad.apk");
    fs.writeFileSync(apkOut, apkEntry.getData());
    fs.unlinkSync(zipPath);

    buildStatus = {
      state: "done",
      message: "✅ APK ready!",
      apkUrl: "/downloads/Sanad.apk",
    };
  } catch (err) {
    buildStatus = { state: "error", message: String(err) };
  }
}

export default router;
