import { NextResponse } from "next/server";
import { currentUserId, isDemoUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { decryptProfile } from "@/lib/crypto-fields";
import { computeTodo, type BiomarkerLatest, type DnaInsight, type SupplementSuggestion } from "@/lib/recommendations/engine";

export const runtime = "nodejs";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;

  const profileRow = sqlite.prepare(`SELECT data FROM profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`).get(userId) as { data: string } | undefined;
  const profile = profileRow ? decryptProfile(typeof profileRow.data === "string" ? JSON.parse(profileRow.data) : profileRow.data) : {};

  // Latest biomarker per slug.
  const biomarkers = sqlite
    .prepare(
      `SELECT b.slug, b.name, b.value, b.ref_low as refLow, b.ref_high as refHigh
       FROM biomarker b
       JOIN (SELECT slug, MAX(date) AS md FROM biomarker WHERE user_id = ? GROUP BY slug) x
         ON x.slug = b.slug AND x.md = b.date
       WHERE b.user_id = ?
       ORDER BY b.name`,
    )
    .all(userId, userId) as BiomarkerLatest[];

  const dna = sqlite
    .prepare(`SELECT rsid, category, has_risk as hasRisk, is_protective as isProtective FROM dna_insight WHERE user_id = ?`)
    .all(userId) as DnaInsight[];

  // Pull supplement suggestions in-process to avoid an extra HTTP roundtrip.
  let supplements: SupplementSuggestion[] = [];
  try {
    const r = await fetch(`${getOrigin()}/api/supplements/suggestions`, {
      headers: { cookie: "" /* internal call — auth via shared db */ },
    });
    // Internal fetch may fail (no cookies). Best-effort.
    if (r.ok) {
      const d = await r.json();
      supplements = (d.suggestions ?? []) as SupplementSuggestion[];
    }
  } catch {}

  const items = computeTodo({ profile, biomarkers, dna, supplements });
  return NextResponse.json({ items, demo: isDemoUser(userId) });
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule." }, { status: 403 });
  ensureSchema();
  const sqlite = db().$client;

  const body = await req.json().catch(() => null) as { id?: string; status?: "done" | "snoozed" | "dismissed"; days?: number } | null;
  if (!body?.id || !body.status) return NextResponse.json({ error: "missing id/status" }, { status: 400 });

  const profileRow = sqlite.prepare(`SELECT data FROM profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`).get(userId) as { data: string } | undefined;
  const raw = profileRow ? (typeof profileRow.data === "string" ? JSON.parse(profileRow.data) : profileRow.data) : {};
  const profile = decryptProfile(raw);

  const todoState = (profile.todoState as Record<string, { status: string; until?: number }> | undefined) ?? {};
  const until = body.status === "snoozed" ? Date.now() + (body.days ?? 30) * 86_400_000 : undefined;
  todoState[body.id] = { status: body.status, ...(until ? { until } : {}) };
  profile.todoState = todoState;

  sqlite.prepare(`INSERT INTO profile (data, updated_at, user_id) VALUES (?, ?, ?)`).run(JSON.stringify(profile), Date.now(), userId);
  return NextResponse.json({ ok: true });
}

function getOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://vitals.club";
}
