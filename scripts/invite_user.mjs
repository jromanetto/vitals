#!/usr/bin/env node
// Invite a user to the closed beta. Creates a row in the `user` table with a
// bcrypt-hashed temporary password and emails the credentials via Resend.
// Bypasses the VITALS_BETA_OPEN gate that the public /api/auth/signup honours.
//
// Usage:  node scripts/invite_user.mjs noelly.michoux@gmail.com [optional-password]
//
// Uses the `sqlite3` CLI (no native bindings) so the script doesn't break
// when Node is upgraded under PM2 and better-sqlite3 has stale bindings.
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const email = (process.argv[2] || "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: node scripts/invite_user.mjs <email> [password]");
  process.exit(1);
}

function genPassword() {
  const adj = ["Vibrant", "Quantum", "Cobalt", "Solar", "Aurora", "Cosmic", "Velvet", "Crimson", "Lunar", "Nebula"];
  const noun = ["Phoenix", "Cascade", "Horizon", "Lighthouse", "Galaxy", "Fjord", "Compass", "Tempest", "Meadow", "Echo"];
  const a = adj[Math.floor(Math.random() * adj.length)];
  const n = noun[Math.floor(Math.random() * noun.length)];
  const d = Math.floor(1000 + Math.random() * 9000);
  return `${a}${n}${d}`;
}
const password = process.argv[3] || genPassword();

if (password.length < 10 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
  console.error("Password must be ≥10 chars with at least 1 uppercase and 1 digit");
  process.exit(1);
}

// Match lib/db/index.ts default: data/vitals.db (overridable via VITALS_DB_PATH).
const dbPath = process.env.VITALS_DB_PATH || path.join(process.cwd(), "data", "vitals.db");
if (!fs.existsSync(dbPath)) {
  console.error(`vitals.db not found at ${dbPath}. Run from the app root.`);
  process.exit(1);
}

function sqlite(query) {
  // Use -separator to keep field parsing simple; -bail aborts on the first error.
  const r = spawnSync("sqlite3", ["-bail", dbPath, query], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`sqlite3 failed: ${r.stderr || r.stdout}`);
  return r.stdout.trim();
}

// Escape a literal for SQL by doubling quotes — sufficient for the controlled
// values we insert (bcrypt hash, base64url, email already validated above).
function q(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

// Idempotent table creation matches what /api/auth/signup creates lazily.
sqlite(`CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  hash TEXT NOT NULL,
  secret TEXT NOT NULL,
  role TEXT DEFAULT 'beta',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
)`);

const existing = sqlite(`SELECT id FROM user WHERE LOWER(email) = ${q(email)}`);
if (existing) {
  console.error(`User ${email} already exists (id=${existing}). Aborting.`);
  process.exit(2);
}

const hash = bcrypt.hashSync(password, 12);
const secret = crypto.randomBytes(48).toString("base64url");
sqlite(
  `INSERT INTO user (email, hash, secret, role) VALUES (${q(email)}, ${q(hash)}, ${q(secret)}, 'beta')`,
);
const userId = sqlite(`SELECT id FROM user WHERE LOWER(email) = ${q(email)}`);
console.log(`✓ Created user id=${userId} email=${email}`);

// Audit log (best-effort).
try {
  sqlite(`CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, detail TEXT, ip TEXT, ua TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))`);
  sqlite(`INSERT INTO audit_log (action, detail) VALUES ('user_invited', ${q(`userId=${userId} email=${email}`)})`);
} catch (e) {
  console.warn("audit log failed:", e.message);
}

// Read Resend key from data/auth.json (matches lib/email.ts).
let resendKey, fromEmail;
try {
  const auth = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "auth.json"), "utf8"));
  resendKey = auth.resendApiKey;
  fromEmail = auth.emailFrom || "Vitals <hello@vitals.blueproject.org>";
} catch (e) {
  console.warn("Could not read data/auth.json:", e.message);
}

if (!resendKey) {
  console.log("\nNo Resend key configured. Send these credentials manually:");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  process.exit(0);
}

const subject = "Bienvenue sur Vitals — ton accès bêta privée";
const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:32px auto;padding:24px;color:#18181b">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:24px">
    <div style="height:10px;width:10px;border-radius:50%;background:#10b981"></div>
    <strong style="font-size:18px;letter-spacing:-0.01em">Vitals</strong>
  </div>
  <h1 style="font-size:22px;font-weight:600;letter-spacing:-0.02em;margin:0 0 12px">Bienvenue sur Vitals 👋</h1>
  <p style="font-size:15px;line-height:1.6;color:#3f3f46;margin:0 0 16px">
    Ton accès à la bêta privée est ouvert. Voici tes identifiants temporaires :
  </p>
  <table style="background:#f4f4f5;border-radius:10px;padding:16px;margin:0 0 20px;font-size:14px;color:#27272a;border-collapse:collapse">
    <tr><td style="padding:6px 12px"><strong>Email</strong></td><td style="padding:6px 12px;font-family:ui-monospace,Menlo,monospace">${email}</td></tr>
    <tr><td style="padding:6px 12px"><strong>Mot de passe</strong></td><td style="padding:6px 12px;font-family:ui-monospace,Menlo,monospace;font-weight:600">${password}</td></tr>
  </table>
  <p style="margin:0 0 24px">
    <a href="https://vitals.blueproject.org/login" style="display:inline-block;background:#10b981;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px">Se connecter →</a>
  </p>
  <div style="border-top:1px solid #e4e4e7;padding-top:20px;margin-top:8px">
    <p style="font-size:13px;line-height:1.6;color:#71717a;margin:0 0 12px">
      <strong>Première connexion :</strong> va dans <em>Profil → Sécurité</em> pour changer ton mot de passe et activer la double authentification (2FA) si tu le souhaites.
    </p>
    <p style="font-size:13px;line-height:1.6;color:#71717a;margin:0 0 12px">
      <strong>Premier pas recommandé :</strong> importe un PDF d'analyse sanguine ou ton fichier ADN 23andMe — tout le reste se débloque à partir de ces données.
    </p>
    <p style="font-size:13px;line-height:1.6;color:#71717a;margin:0">
      Toutes tes données sont chiffrées au repos et hébergées en EU. Une question ? Réponds simplement à cet email.
    </p>
  </div>
  <p style="font-size:11px;color:#a1a1aa;margin-top:28px">— L'équipe Vitals</p>
</body></html>`;
const text = `Bienvenue sur Vitals !

Ton accès bêta privée est prêt :

  Email:    ${email}
  Password: ${password}

Connecte-toi : https://vitals.blueproject.org/login

Première étape recommandée : Profil → Sécurité pour changer le mot de passe.
Puis importe un PDF d'analyse sanguine ou ton ADN 23andMe pour démarrer.

Données chiffrées · Hébergement EU
— Vitals`;

const r = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
  body: JSON.stringify({ from: fromEmail, to: email, subject, html, text }),
});
const out = await r.json();
if (!r.ok) {
  console.error("Resend error:", r.status, out);
  console.log("\nManual fallback — credentials:");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  process.exit(3);
}
console.log(`✓ Sent invite email (Resend id: ${out.id})`);
console.log(`\nCredentials (also in email):`);
console.log(`  Email:    ${email}`);
console.log(`  Password: ${password}`);
