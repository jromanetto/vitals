/**
 * Email helper using Resend.
 * Reads API key + default from-address from data/auth.json.
 */
import fs from "node:fs";
import path from "node:path";

// Re-exported so callers can import everything from "@/lib/email".
export { weeklyDigestTemplate } from "@/lib/email-digest";
export type { WeeklyDeltas } from "@/lib/email-digest";

type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
};

function readAuth(): { resendApiKey?: string; emailFrom?: string; email?: string } {
  try {
    const p = process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch { return {}; }
}

export function isEmailConfigured(): boolean {
  return Boolean(readAuth().resendApiKey);
}

/**
 * Send an email via Resend. Returns { ok, id?, error? }.
 * Silently no-ops (returns { ok: false, error: "not configured" }) if the key is missing
 * so callers don't have to guard every call site.
 */
export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; id?: string; error?: string }> {
  const auth = readAuth();
  const apiKey = auth.resendApiKey;
  if (!apiKey) {
    console.warn("[email] Resend API key not configured — skipping send to", payload.to);
    return { ok: false, error: "not configured" };
  }
  const from = payload.from || auth.emailFrom || "Vitals <noreply@vitals.blueproject.org>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        reply_to: payload.replyTo,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[email] Resend error", res.status, data);
      return { ok: false, error: data?.message || `HTTP ${res.status}` };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    console.error("[email] Resend fetch failed", e);
    return { ok: false, error: (e as Error).message };
  }
}

/* ============================ Templates ============================ */

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  background: #0a0a0b; color: #e5e7eb; padding: 32px 16px;
`;

const CARD_STYLE = `
  max-width: 560px; margin: 0 auto; background: #18181b;
  border: 1px solid #27272a; border-radius: 16px; padding: 32px; color: #e5e7eb;
`;

const BUTTON_STYLE = `
  display: inline-block; padding: 12px 20px; border-radius: 8px;
  background: #10b981; color: #0a0a0b !important; font-weight: 600;
  text-decoration: none; font-size: 14px; margin: 16px 0;
`;

function wrap(title: string, body: string): string {
  return `<!doctype html><html lang="fr"><body style="${BASE_STYLE}">
    <div style="${CARD_STYLE}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981"></span>
        <span style="font-weight:600;font-size:16px">Vitals</span>
      </div>
      <h1 style="font-size:22px;font-weight:600;margin:0 0 16px;line-height:1.3">${title}</h1>
      ${body}
      <hr style="border:none;border-top:1px solid #27272a;margin:32px 0 16px" />
      <p style="font-size:12px;color:#71717a;margin:0;line-height:1.5">
        Vitals · plateforme de santé personnelle · données chiffrées · hébergement EU<br/>
        Tu reçois cet email parce que tu utilises Vitals. <a href="https://vitals.blueproject.org/legal/privacy" style="color:#10b981">Politique de confidentialité</a>.
      </p>
    </div>
  </body></html>`;
}

export function welcomeTemplate(firstName?: string): { subject: string; html: string; text: string } {
  const greeting = firstName ? `Bienvenue ${firstName}` : "Bienvenue sur Vitals";
  const html = wrap(
    `${greeting} 👋`,
    `
      <p style="font-size:15px;line-height:1.6;color:#d4d4d8">
        Ton compte est créé. Voici les 3 prochaines étapes pour exploiter Vitals à fond :
      </p>
      <ol style="font-size:14px;line-height:1.8;color:#d4d4d8;padding-left:20px;margin:16px 0">
        <li><strong>Importe ton premier bilan sanguin</strong> (PDF ou photo) — l'IA extrait tout automatiquement</li>
        <li><strong>Charge ton 23andMe</strong> pour activer les recommandations personnalisées</li>
        <li><strong>Discute avec l'équipe médicale</strong> dans le chat pour comprendre ton dossier</li>
      </ol>
      <a href="https://vitals.blueproject.org/dashboard" style="${BUTTON_STYLE}">Accéder à mon dashboard →</a>
      <p style="font-size:13px;color:#a1a1aa;margin:16px 0 0">
        Une question ? Réponds simplement à cet email.
      </p>
    `,
  );
  const text = `${greeting} !\n\nTon compte Vitals est créé. Étapes recommandées :\n1. Importe ton premier bilan sanguin\n2. Charge ton 23andMe\n3. Discute avec l'équipe médicale\n\nDashboard : https://vitals.blueproject.org/dashboard`;
  return { subject: "🌿 Bienvenue sur Vitals", html, text };
}

export function waitlistTemplate(email: string): { subject: string; html: string; text: string } {
  const html = wrap(
    "Inscrit sur la liste d'attente",
    `
      <p style="font-size:15px;line-height:1.6;color:#d4d4d8">
        Merci pour ton intérêt ! La bêta privée est actuellement complète.
      </p>
      <p style="font-size:15px;line-height:1.6;color:#d4d4d8">
        On t'a ajouté à la liste avec l'adresse <code style="background:#27272a;padding:2px 6px;border-radius:4px;color:#10b981">${email}</code>. Tu seras notifié dès qu'une place se libère — généralement sous 1-2 semaines.
      </p>
      <p style="font-size:14px;color:#a1a1aa;margin:24px 0 8px">
        En attendant, tu peux explorer une démo avec un patient fictif :
      </p>
      <a href="https://vitals.blueproject.org/login?demo=1" style="${BUTTON_STYLE}">Voir la démo →</a>
    `,
  );
  const text = `Merci pour ton intérêt ! La bêta privée est complète. On t'a ajouté à la liste avec ${email}. Démo : https://vitals.blueproject.org/login?demo=1`;
  return { subject: "📋 Liste d'attente Vitals", html, text };
}

export function shareLinkTemplate(opts: { token: string; expiresAt: number; senderName?: string; note?: string }): { subject: string; html: string; text: string } {
  const url = `https://vitals.blueproject.org/share/${opts.token}`;
  const expires = new Date(opts.expiresAt).toLocaleDateString("fr-FR", { dateStyle: "long" });
  const senderLine = opts.senderName ? `${opts.senderName} t'a partagé un dossier santé Vitals.` : "Un dossier santé Vitals t'a été partagé.";
  const html = wrap(
    "Dossier santé partagé",
    `
      <p style="font-size:15px;line-height:1.6;color:#d4d4d8">${senderLine}</p>
      ${opts.note ? `<blockquote style="border-left:3px solid #10b981;padding:8px 12px;margin:16px 0;color:#a1a1aa;font-style:italic">${opts.note}</blockquote>` : ""}
      <p style="font-size:14px;color:#a1a1aa;margin:16px 0 8px">
        Le lien est valide jusqu'au <strong style="color:#10b981">${expires}</strong> en lecture seule. Aucun compte n'est requis.
      </p>
      <a href="${url}" style="${BUTTON_STYLE}">Voir le dossier →</a>
      <p style="font-size:12px;color:#71717a;margin:24px 0 0;line-height:1.5">
        Ce dossier inclut bilans sanguins (hors plage + optimaux), variants ADN à risque/protecteurs, suppléments en cours, et symptômes récents. Vitals est un outil informatif et ne remplace pas un avis médical professionnel.
      </p>
    `,
  );
  const text = `${senderLine} Lien valable jusqu'au ${expires}. ${url}`;
  return { subject: "🩺 Dossier santé partagé via Vitals", html, text };
}

export function reminderTemplate(opts: { title: string; description?: string; dueDate: string }): { subject: string; html: string; text: string } {
  const html = wrap(
    `Rappel : ${opts.title}`,
    `
      <p style="font-size:15px;line-height:1.6;color:#d4d4d8">
        Ton rappel <strong>${opts.title}</strong> arrive bientôt.
      </p>
      <p style="font-size:14px;color:#a1a1aa">📅 ${opts.dueDate}</p>
      ${opts.description ? `<p style="font-size:14px;line-height:1.6;color:#d4d4d8">${opts.description}</p>` : ""}
      <a href="https://vitals.blueproject.org/reminders" style="${BUTTON_STYLE}">Voir mes rappels →</a>
    `,
  );
  const text = `Rappel — ${opts.title}\n${opts.dueDate}\n${opts.description ?? ""}\nhttps://vitals.blueproject.org/reminders`;
  return { subject: `⏰ Rappel : ${opts.title}`, html, text };
}
