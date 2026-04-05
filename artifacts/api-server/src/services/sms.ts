import twilio from "twilio";
import { logger } from "../lib/logger";

const SID   = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM  = process.env.TWILIO_FROM_NUMBER;

let client: ReturnType<typeof twilio> | null = null;
if (SID && TOKEN) {
  try { client = twilio(SID, TOKEN); } catch { client = null; }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.startsWith("+")) return phone;
  if (digits.startsWith("216")) return `+${digits}`;
  return `+216${digits}`;
}

export async function sendSMS(to: string | null | undefined, body: string): Promise<void> {
  if (!to) return;
  if (!client || !FROM) {
    logger.debug({ to }, "[SMS] No credentials — skipped");
    return;
  }
  try {
    const normalized = normalizePhone(to);
    await client.messages.create({ from: FROM, to: normalized, body });
    logger.info({ to: normalized }, "[SMS] Sent successfully");
  } catch (err: any) {
    logger.error({ to, err: err?.message }, "[SMS] Send failed");
  }
}

export const smsEnabled = !!client && !!FROM;
