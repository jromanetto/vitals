import { NextResponse } from "next/server";
import { currentUserId, isDemoUser , effectiveUserId} from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { decryptProfile } from "@/lib/crypto-fields";
import { computeTodo, type BiomarkerLatest, type DnaInsight, type SupplementSuggestion } from "@/lib/recommendations/engine";

export const runtime = "nodejs";

export async function GET() {
  const authUserId = await currentUserId();
  const viewUserId = await effectiveUserId();
  if (!authUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const readViewUserId = viewUserId ?? authUserId;

  // Biomarkers + DNA insights come from Convex (isolation resolved server-side).
  // Only the profile read stays on SQLite (no Convex fn yet).
  const [bio, dnaRes] = await Promise.all([
    convexServer().query(api.biomarkers.all, {
      secret: bridgeSecret(), authUserId, viewUserId: readViewUserId,
    }),
    convexServer().query(api.dna.insights, {
      secret: bridgeSecret(), authUserId, viewUserId: readViewUserId,
    }),
  ]);

  ensureSchema();
  const sqlite = db().$client;

  const profileRow = sqlite.prepare(`SELECT data FROM profile WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`).get(readViewUserId) as { data: string } | undefined;
  const profile = profileRow ? decryptProfile(typeof profileRow.data === "string" ? JSON.parse(profileRow.data) : profileRow.data) : {};

  // Latest biomarker per slug. Convex rows are sorted date asc, so last write wins.
  const latest = new Map<string, BiomarkerLatest>();
  for (const r of bio.rows) {
    latest.set(r.slug, { slug: r.slug, name: r.name, value: r.value, refLow: r.refLow, refHigh: r.refHigh });
  }
  const biomarkers = [...latest.values()].sort((a, b) => a.name.localeCompare(b.name));

  const dna: DnaInsight[] = dnaRes.rows.map((r) => ({
    rsid: r.rsid,
    category: r.category,
    hasRisk: !!r.hasRisk,
    isProtective: !!r.isProtective,
  }));

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
  return NextResponse.json({ items, demo: isDemoUser(readViewUserId) });
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
