import { NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { readCredsFresh, writeCreds } from "@/lib/auth";
import { rateLimitByIp, extractIp } from "@/lib/lockout";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  const ip = extractIp(req);
  const rl = rateLimitByIp(ip, "reset_password", 10, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Trop de tentatives. Réessaye dans quelques minutes." }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  }

  ensureSchema();
  const body = (await req.json().catch(() => ({}))) as { token?: string; password?: string };
  const token = (body.token || "").trim();
  const password = body.password || "";

  if (!token) return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
  if (password.length < 10) return NextResponse.json({ error: "Mot de passe trop court (10 caractères minimum)" }, { status: 400 });
  if (!/[A-Z]/.test(password) || !/\d/.test(password)) return NextResponse.json({ error: "Mot de passe doit contenir 1 majuscule et 1 chiffre" }, { status: 400 });

  const sqlite = db().$client;
  const row = sqlite
    .prepare(`SELECT id, email, expires_at AS expiresAt, used FROM password_reset WHERE token_hash = ?`)
    .get(sha256(token)) as { id: number; email: string; expiresAt: number; used: number } | undefined;

  if (!row || row.used || row.expiresAt < Date.now()) {
    return NextResponse.json({ error: "Ce lien est invalide ou a expiré. Refais une demande." }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  const email = row.email.toLowerCase();

  // Update the password where the account actually lives: user table first,
  // then the legacy owner credentials in auth.json.
  const userRow = sqlite.prepare(`SELECT id FROM user WHERE LOWER(email) = ?`).get(email) as { id: number } | undefined;
  if (userRow) {
    sqlite.prepare(`UPDATE user SET hash = ? WHERE id = ?`).run(hash, userRow.id);
  } else {
    try {
      const c = readCredsFresh();
      if (c.email && c.email.toLowerCase() === email) {
        writeCreds({ hash });
      } else {
        return NextResponse.json({ error: "Compte introuvable." }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Compte introuvable." }, { status: 400 });
    }
  }

  // Burn the token (single-use) and any other outstanding ones for this email.
  sqlite.prepare(`UPDATE password_reset SET used = 1 WHERE email = ? AND used = 0`).run(email);
  logAudit("password_reset_complete", `email=${email}`, req);

  return NextResponse.json({ ok: true });
}
