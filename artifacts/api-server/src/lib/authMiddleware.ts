import type { Request, Response, NextFunction } from "express";
import { getSession } from "./sessionStore";

const ADMIN_ROLES = new Set(["super_admin", "admin", "manager"]);
const STAFF_ROLES = new Set(["super_admin", "admin", "manager", "provider", "driver"]);

function extractToken(req: Request): string | null {
  const header = req.headers["x-session-token"];
  if (typeof header === "string" && header.length > 0) return header;
  return null;
}

/** Require any authenticated session */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) { res.status(401).json({ message: "Authentication required" }); return; }
  getSession(token).then(session => {
    if (!session) { res.status(401).json({ message: "Session expired or invalid" }); return; }
    (req as any).authSession = session;
    next();
  }).catch(() => {
    res.status(500).json({ message: "Session lookup failed" });
  });
}

/** Require admin/manager role */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) { res.status(401).json({ message: "Authentication required" }); return; }
  getSession(token).then(session => {
    if (!session) { res.status(401).json({ message: "Session expired or invalid" }); return; }
    if (!ADMIN_ROLES.has(session.role)) {
      res.status(403).json({ message: "Admin access required" }); return;
    }
    (req as any).authSession = session;
    next();
  }).catch(() => {
    res.status(500).json({ message: "Session lookup failed" });
  });
}

/** Require any staff role (admin, manager, provider, driver) */
export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) { res.status(401).json({ message: "Authentication required" }); return; }
  getSession(token).then(session => {
    if (!session) { res.status(401).json({ message: "Session expired or invalid" }); return; }
    if (!STAFF_ROLES.has(session.role)) {
      res.status(403).json({ message: "Staff access required" }); return;
    }
    (req as any).authSession = session;
    next();
  }).catch(() => {
    res.status(500).json({ message: "Session lookup failed" });
  });
}
