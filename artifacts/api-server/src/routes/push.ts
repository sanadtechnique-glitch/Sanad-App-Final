/* ═══════════════════════════════════════════════════════════════
   Web Push — Subscribe / Unsubscribe / Send
   ═══════════════════════════════════════════════════════════════ */
import { Router, type IRouter } from "express";
import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/authMiddleware";

const router: IRouter = Router();

/* ── VAPID setup ─────────────────────────────────────────────── */
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT     ?? "mailto:sanad@example.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

/* ── GET /api/push/vapid-public-key (public) ─────────────────── */
router.get("/push/vapid-public-key", (_req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

/* ── POST /api/push/subscribe (authenticated) ────────────────── */
router.post("/push/subscribe", requireAuth, async (req, res) => {
  const session = (req as any).authSession;
  const userId  = session?.userId;

  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const { endpoint, keys } = req.body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ message: "Invalid subscription payload" });
    return;
  }

  try {
    await db
      .insert(pushSubscriptionsTable)
      .values({
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: req.headers["user-agent"] ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptionsTable.endpoint,
        set: {
          userId,
          p256dh: keys.p256dh,
          auth: keys.auth,
        },
      });

    res.status(201).json({ ok: true });
  } catch (err) {
    req.log?.error?.({ err }, "push/subscribe error");
    res.status(500).json({ message: "Internal server error" });
  }
});

/* ── DELETE /api/push/unsubscribe (authenticated) ───────────── */
router.delete("/push/unsubscribe", requireAuth, async (req, res) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) { res.status(400).json({ message: "endpoint required" }); return; }

  try {
    await db.delete(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.endpoint, endpoint));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   INTERNAL HELPER — sendPushToUsers
   Call this from other routes (e.g. notifications, orders) to
   deliver real push notifications to specific users.
   ═══════════════════════════════════════════════════════════════ */
export async function sendPushToUsers(
  userIds: number[],
  payload: { title: string; body: string; url?: string; tag?: string; icon?: string }
) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || userIds.length === 0) return;

  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(inArray(pushSubscriptionsTable.userId, userIds));

  const data = JSON.stringify({ icon: "/logo.png", ...payload });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data
        );
      } catch (err: any) {
        /* 410 Gone = subscription expired — clean it up */
        if (err?.statusCode === 410) {
          await db.delete(pushSubscriptionsTable)
            .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
        }
      }
    })
  );
}

/* ── POST /api/admin/push/broadcast (admin only) ─────────────── */
import { requireAdmin } from "../lib/authMiddleware";
import { usersTable } from "@workspace/db/schema";

router.post("/admin/push/broadcast", requireAdmin, async (req, res) => {
  const { title, body, url, targetRole } = req.body as {
    title?: string; body?: string; url?: string; targetRole?: string;
  };

  if (!title || !body) {
    res.status(400).json({ message: "title and body required" }); return;
  }

  try {
    /* Get user IDs based on role filter */
    let users: { id: number }[];
    if (!targetRole || targetRole === "all") {
      users = await db.select({ id: usersTable.id }).from(usersTable);
    } else {
      users = await db.select({ id: usersTable.id }).from(usersTable)
        .where(eq(usersTable.role, targetRole));
    }

    const ids = users.map((u) => u.id);
    await sendPushToUsers(ids, { title, body, url: url || "/", tag: "broadcast" });

    res.json({ ok: true, sent: ids.length });
  } catch (err) {
    req.log?.error?.({ err }, "admin broadcast push error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
