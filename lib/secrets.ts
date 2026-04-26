/**
 * Loads small secrets from data/auth.json (alongside email/hash/secret).
 * Avoids the Next.js dotenv-expand bcrypt-hash mangling issue.
 */
import fs from "node:fs";
import path from "node:path";

let cached: Record<string, unknown> | null = null;

function read(): Record<string, unknown> {
  if (cached) return cached;
  const p = process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
  if (!fs.existsSync(p)) return (cached = {});
  cached = JSON.parse(fs.readFileSync(p, "utf8"));
  return cached!;
}

export function anthropicApiKey(): string | null {
  const k = (read().anthropicApiKey as string) || process.env.ANTHROPIC_API_KEY || null;
  return k && k.length > 20 ? k : null;
}
