import { NextResponse } from "next/server";
import { sealData } from "iron-session";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { logAudit } from "@/lib/audit";
import { sendEmail, welcomeTemplate, waitlistTemplate } from "@/lib/email";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const COOKIE = "vitals_session";
const TTL = 60 * 60 * 24 * 30; // 30 days

function getSessionPassword(): string {
  // Reuse the existing single-tenant secret for sealing during the beta
  try {
    const p = process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
    const c = JSON.parse(fs.readFileSync(p, "utf8"));
    if (c.secret && c.secret.length >= 32) return c.secret;
  } catch {}
  if (process.env.IRON_SESSION_PASSWORD) return process.env.IRON_SESSION_PASSWORD;
  throw new Error("session secret not configured");
}

/** Read the shareable invite code from data/auth.json (preferred) or env. */
function getInviteCode(): string {
  try {
    const p = process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
    const c = JSON.parse(fs.readFileSync(p, "utf8"));
    if (typeof c.inviteCode === "string" && c.inviteCode.trim().length > 0) return c.inviteCode.trim();
  } catch {}
  return (process.env.VITALS_INVITE_CODE || "").trim();
}

export async function POST(req: Request) {
  ensureSchema();
  const sqlite = db().$client;
  // Ensure user table exists (idempotent)
  sqlite.exec(`CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    hash TEXT NOT NULL,
    secret TEXT NOT NULL,
    role TEXT DEFAULT 'beta',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )`);

  let body: { email?: string; password?: string; inviteCode?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid body" }, { status: 400 }); }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const inviteCode = (body.inviteCode || "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  if (password.length < 10) return NextResponse.json({ error: "Mot de passe trop court (10 caractères minimum)" }, { status: 400 });
  if (!/[A-Z]/.test(password) || !/\d/.test(password)) return NextResponse.json({ error: "Mot de passe doit contenir 1 majuscule et 1 chiffre" }, { status: 400 });

  const existing = sqlite.prepare(`SELECT id FROM user WHERE LOWER(email) = ?`).get(email) as { id: number } | undefined;
  if (existing) return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });

  // Gating: either the beta is fully open, or the request carries a valid invite code.
  // Anyone else lands on the waitlist.
  const betaOpen = process.env.VITALS_BETA_OPEN === "true";
  const configuredInvite = getInviteCode();
  const validInvite = configuredInvite.length > 0 && inviteCode === configuredInvite;
  if (!betaOpen && !validInvite) {
    // Persist to waitlist table for later invitation
    try {
      sqlite.exec(`CREATE TABLE IF NOT EXISTS waitlist (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), invited_at INTEGER)`);
      sqlite.prepare(`INSERT OR IGNORE INTO waitlist (email) VALUES (?)`).run(email);
    } catch (e) { console.error("[signup] waitlist insert", e); }
    // Send waitlist confirmation email (best-effort, non-blocking)
    sendEmail({ to: email, ...waitlistTemplate(email) }).catch((e) => console.error("[signup] waitlist email", e));
    logAudit("signup_waitlist", `email=${email}`, req);
    return NextResponse.json({
      error: "La bêta privée est actuellement complète. On t'a ajouté à la liste d'attente — un email de confirmation t'a été envoyé.",
      waitlist: true,
    }, { status: 403 });
  }

  const hash = await bcrypt.hash(password, 12);
  const secret = crypto.randomBytes(48).toString("base64url");
  const result = sqlite.prepare(`INSERT INTO user (email, hash, secret) VALUES (?, ?, ?)`).run(email, hash, secret);
  const userId = Number(result.lastInsertRowid);

  // Seal session
  const sealed = await sealData({ userId, email, iat: Date.now() }, { password: getSessionPassword(), ttl: TTL });
  const res = NextResponse.json({ ok: true, userId });
  res.cookies.set(COOKIE, sealed, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: TTL });
  res.cookies.set("vitals_active", "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 15 });
  // Send welcome email (best-effort)
  sendEmail({ to: email, ...welcomeTemplate() }).catch((e) => console.error("[signup] welcome email", e));
  logAudit(validInvite ? "signup_invite" : "signup", `userId=${userId} email=${email}`, req);
  return res;
}
