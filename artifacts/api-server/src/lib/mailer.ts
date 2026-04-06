import nodemailer from "nodemailer";

const SMTP_HOST     = process.env.SMTP_HOST     ?? "";
const SMTP_PORT     = parseInt(process.env.SMTP_PORT ?? "587");
const SMTP_USER     = process.env.SMTP_USER     ?? "";
const SMTP_PASS     = process.env.SMTP_PASS     ?? "";
const SMTP_FROM     = process.env.SMTP_FROM     ?? "Sanad <noreply@sanad.app>";
const IS_DEV        = process.env.NODE_ENV !== "production";
const SMTP_ENABLED  = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter: nodemailer.Transporter | null = null;

if (SMTP_ENABLED) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function buildResetEmailHtml(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>إعادة تعيين كلمة المرور · Réinitialisation du mot de passe</title>
</head>
<body style="margin:0;padding:0;background:#FFF3E0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF3E0;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:20px;overflow:hidden;
                      box-shadow:0 8px 40px rgba(26,77,31,0.12);border:1px solid rgba(255,165,0,0.2);">

          <!-- Header -->
          <tr>
            <td align="center"
                style="background:#1A4D1F;padding:32px 40px 28px;">
              <img src="https://d74ff63c-f956-45ec-94ee-c9f537457e61-00-19pqnbgyti5rp.worf.replit.dev/logo.png"
                   alt="Sanad" width="72" height="72"
                   style="display:block;border-radius:50%;border:3px solid #FFA500;"/>
              <p style="margin:14px 0 0;color:#FFA500;font-size:22px;font-weight:900;letter-spacing:1px;">
                سند · Sanad
              </p>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.6);font-size:13px;">
                سندك في التوصيل.. لباب الدار
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <!-- Arabic -->
              <p style="color:#1A4D1F;font-size:18px;font-weight:900;margin:0 0 8px;text-align:right;">
                إعادة تعيين كلمة المرور
              </p>
              <p style="color:#555;font-size:14px;line-height:1.7;margin:0 0 24px;text-align:right;">
                تلقّينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك على سند.
                لإعادة تعيين كلمة السر، اضغط على الزر أدناه. هذا الرابط صالح لمدة ساعة واحدة فقط.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="${resetUrl}"
                       style="display:inline-block;background:#FFA500;color:#1A4D1F;
                              font-size:16px;font-weight:900;text-decoration:none;
                              padding:16px 48px;border-radius:14px;
                              box-shadow:0 4px 20px rgba(255,165,0,0.45);
                              letter-spacing:0.5px;">
                      إعادة تعيين كلمة المرور ←
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid rgba(255,165,0,0.2);margin:0 0 24px;"/>

              <!-- French -->
              <p style="color:#1A4D1F;font-size:16px;font-weight:900;margin:0 0 8px;text-align:left;">
                Réinitialisation du mot de passe
              </p>
              <p style="color:#555;font-size:13px;line-height:1.7;margin:0 0 20px;text-align:left;">
                Nous avons reçu une demande de réinitialisation du mot de passe pour votre compte Sanad.
                Pour réinitialiser votre mot de passe, cliquez ici. Ce lien est valable pendant 1 heure seulement.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${resetUrl}"
                       style="display:inline-block;background:#1A4D1F;color:#FFF3E0;
                              font-size:15px;font-weight:900;text-decoration:none;
                              padding:14px 40px;border-radius:14px;
                              box-shadow:0 4px 20px rgba(26,77,31,0.35);">
                      → Cliquez ici pour réinitialiser
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Safety note -->
              <p style="color:#999;font-size:11px;text-align:center;margin:0;">
                إذا لم تطلب هذا، يمكنك تجاهل هذا البريد بأمان. · Si vous n'avez pas demandé cela, ignorez cet email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center"
                style="background:#FFF3E0;padding:20px 40px;border-top:1px solid rgba(255,165,0,0.2);">
              <p style="margin:0;color:#1A4D1F;font-size:12px;font-weight:700;">
                © 2025 سند · Sanad — بن قردان، تونس
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<{ sent: boolean; devUrl?: string }> {
  const html = buildResetEmailHtml(resetUrl);
  const subject = "إعادة تعيين كلمة المرور · Réinitialisation du mot de passe — Sanad";

  if (!SMTP_ENABLED) {
    console.log("[MAILER] SMTP not configured. Reset URL:", resetUrl);
    return { sent: false, devUrl: IS_DEV ? resetUrl : undefined };
  }

  await transporter!.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    html,
  });

  return { sent: true };
}
