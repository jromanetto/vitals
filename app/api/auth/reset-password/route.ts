import { NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
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

  const body = (await req.json().catch(() => ({}))) as { token?: string; password?: string };
  const token = (body.token || "").trim();
  const password = body.password || "";

  if (!token) return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
  if (password.length < 10) return NextResponse.json({ error: "Mot de passe trop court (10 caractères minimum)" }, { status: 400 });
  if (!/[A-Z]/.test(password) || !/\d/.test(password)) return NextResponse.json({ error: "Mot de passe doit contenir 1 majuscule et 1 chiffre" }, { status: 400 });

  // Validate and burn the token in one transactional call. The previous
  // SELECT-then-UPDATE checked the token, changed the password, and only then
  // marked it used, so two requests arriving together could both pass the check
  // and consume the same link. Burning up front closes that window; the cost is
  // that a failure after this point requires requesting a new link, which is
  // the right trade for a credential-changing operation.
  const consumed = await convexServer().mutation(api.passwordReset.consume, {
    secret: bridgeSecret(), tokenHash: sha256(token),
  });
  if (!consumed.ok || !consumed.email) {
    return NextResponse.json({ error: "Ce lien est invalide ou a expiré. Refais une demande." }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 12);
  const email = consumed.email.toLowerCase();

  // Update the password where the account actually lives: user table first,
  // then the legacy owner credentials in auth.json.
  const { ok: updated } = await convexServer().mutation(api.users.setPasswordHash, {
    secret: bridgeSecret(), email, hash,
  });
  if (!updated) {
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

  logAudit("password_reset_complete", `email=${email}`, req);

  return NextResponse.json({ ok: true });
}
