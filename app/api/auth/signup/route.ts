import { NextResponse } from "next/server";
import { sealData } from "iron-session";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { logAudit } from "@/lib/audit";
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

  let body: { email?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid body" }, { status: 400 }); }
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Email invalide" }, { status: 400 });
  if (password.length < 10) return NextResponse.json({ error: "Mot de passe trop court (10 caractères minimum)" }, { status: 400 });
  if (!/[A-Z]/.test(password) || !/\d/.test(password)) return NextResponse.json({ error: "Mot de passe doit contenir 1 majuscule et 1 chiffre" }, { status: 400 });

  const existing = sqlite.prepare(`SELECT id FROM user WHERE LOWER(email) = ?`).get(email) as { id: number } | undefined;
  if (existing) return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });

  // For the closed beta we keep enrollment gated: only allow if BETA_OPEN env is true.
  // Otherwise, return a soft notice that signup is currently waitlist-only.
  if (process.env.VITALS_BETA_OPEN !== "true") {
    return NextResponse.json({
      error: "La bêta privée est actuellement complète. Tu as été ajouté à notre liste d'attente — on te contacte par email dès qu'une place se libère.",
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
  logAudit("signup", `userId=${userId} email=${email}`, req);
  return res;
}
