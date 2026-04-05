const { app, BrowserWindow, Menu } = require("electron");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PRODUCTION_API = "https://d74ff63c-f956-45ec-94ee-c9f537457e61-00-19pqnbgyti5rp.worf.replit.dev";
const LOCAL_PORT = 47891;

const WEB_DIR = app.isPackaged
  ? path.join(process.resourcesPath, "www")
  : path.join(__dirname, "www");

const ICON_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "resources", "icon.png")
  : path.join(__dirname, "resources", "icon.png");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function proxyRequest(req, res, targetBase) {
  const targetUrl = new URL(req.url, targetBase);
  const isHttps = targetUrl.protocol === "https:";
  const transport = isHttps ? https : http;

  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (isHttps ? 443 : 80),
    path: targetUrl.pathname + (targetUrl.search || ""),
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.hostname,
      "x-forwarded-for": req.socket.remoteAddress,
    },
  };

  delete options.headers["origin"];
  delete options.headers["referer"];

  const proxyReq = transport.request(options, (proxyRes) => {
    const headers = { ...proxyRes.headers };
    headers["access-control-allow-origin"] = "*";
    headers["access-control-allow-methods"] = "GET,POST,PUT,DELETE,PATCH,OPTIONS";
    headers["access-control-allow-headers"] = "Content-Type, x-session-token, Authorization";
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error("Proxy error:", err.message);
    res.writeHead(502);
    res.end("Bad Gateway: " + err.message);
  });

  req.pipe(proxyReq, { end: true });
}

function serveStatic(req, res) {
  let reqPath = url.parse(req.url).pathname;

  if (reqPath.endsWith("/")) reqPath += "index.html";

  let filePath = path.join(WEB_DIR, reqPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(WEB_DIR, "index.html");
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("File not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

function startServer(callback) {
  const server = http.createServer((req, res) => {
    const parsedPath = url.parse(req.url).pathname || "/";

    if (
      parsedPath.startsWith("/api/") ||
      parsedPath.startsWith("/uploads/") ||
      parsedPath === "/api"
    ) {
      proxyRequest(req, res, PRODUCTION_API);
    } else {
      serveStatic(req, res);
    }
  });

  server.listen(LOCAL_PORT, "127.0.0.1", () => {
    console.log(`Local server started on http://127.0.0.1:${LOCAL_PORT}`);
    callback();
  });

  server.on("error", (err) => {
    console.error("Server error:", err.message);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "Sanad - Digital City",
    icon: ICON_PATH,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
    backgroundColor: "#FFF3E0",
    show: false,
  });

  Menu.setApplicationMenu(null);

  win.loadURL(`http://127.0.0.1:${LOCAL_PORT}`);

  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });

  win.on("page-title-updated", (event) => {
    event.preventDefault();
    win.setTitle("Sanad - Digital City");
  });

  win.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("Page failed to load:", errorDescription);
  });
}

app.on("window-all-closed", () => {
  app.quit();
});

app.whenReady().then(() => {
  startServer(createWindow);
});
