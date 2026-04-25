#!/usr/bin/env node
// Generates data/auth.json with bcrypt password hash + session secret.
// Run once on the VPS, after that .env is no longer needed for auth.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const email = process.env.AUTH_EMAIL || process.argv[2] || "julien@romanetto.com";
const pwd = process.env.AUTH_PASSWORD || process.argv[3] || "poussin2K1";

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });
const file = path.join(dataDir, "auth.json");
const obj = {
  email,
  hash: bcrypt.hashSync(pwd, 12),
  secret: crypto.randomBytes(48).toString("base64url"),
};
fs.writeFileSync(file, JSON.stringify(obj, null, 2));
fs.chmodSync(file, 0o600);
console.log("Wrote", file, "for", email);
