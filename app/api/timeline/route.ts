import { NextResponse } from "next/server";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type TimelineEvent = {
  id: string;
  kind:
    | "bilan-sanguin"
    | "dna-import"
    | "supp-start"
    | "supp-end"
    | "symptom"
    | "reminder"
    | "document";
  date: number;
  title: string;
  subtitle?: string;
  color: string;
  href?: string;
  done?: boolean;
  category?: string;
};

// Color palette aligned with chart theme (emerald / sky / amber / red)
const COLORS = {
  bilan: "hsl(160 84% 39%)",      // emerald
  dna: "hsl(280 70% 60%)",        // violet
  suppStart: "hsl(199 89% 48%)",  // sky
  suppEnd: "hsl(0 0% 55%)",       // gray
  symptom: "hsl(38 92% 50%)",     // amber
  reminder: "hsl(0 84% 60%)",     // red
  document: "hsl(220 14% 55%)",   // slate
};

function parseDateStr(s: string): number {
  // expected YYYY-MM-DD or with time
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

export async function GET() {
  const userId = await effectiveUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const authId = (await currentUserId()) ?? userId;

  ensureSchema();
  const d = db();
  const convex = convexServer();
  const secret = bridgeSecret();
  const events: TimelineEvent[] = [];

  // 1. Biomarkers — group by date as a single "bilan sanguin" event.
  // Reads via Convex (isolation resolved server-side); reproduce the SQL
  // GROUP BY date / COUNT(*) over the returned rows.
  try {
    const { rows } = await convex.query(api.biomarkers.all, {
      secret, authUserId: authId, viewUserId: userId,
    });
    const countByDate = new Map<number, number>();
    for (const r of rows) {
      if (r.date == null) continue; // WHERE date IS NOT NULL
      countByDate.set(r.date, (countByDate.get(r.date) ?? 0) + 1);
    }
    for (const [date, n] of countByDate) {
      events.push({
        id: `bilan-${date}`,
        kind: "bilan-sanguin",
        date,
        title: "Bilan sanguin",
        subtitle: `${n} biomarqueur${n > 1 ? "s" : ""}`,
        color: COLORS.bilan,
        href: "/biomarkers",
        category: "Bilans",
      });
    }
  } catch {}

  // 2. DNA import — single event derived from dna_insight rows for this user.
  // dna_insight now comes from Convex; the DNA file date still lives in the
  // (non-migrated) document table on SQLite.
  try {
    const { rows: dnaRows } = await convex.query(api.dna.insights, {
      secret, authUserId: authId, viewUserId: userId,
    });
    const n = dnaRows.length;
    if (n > 0) {
      // Use document table (scoped to this user) for the DNA file date if present
      const dnaDoc = d.$client.prepare(
        `SELECT date FROM document WHERE user_id = ? AND category = 'adn' AND date IS NOT NULL ORDER BY date ASC LIMIT 1`
      ).get(userId) as { date: number } | undefined;
      const date = dnaDoc?.date ?? Date.now();
      events.push({
        id: `dna-import`,
        kind: "dna-import",
        date,
        title: "Import ADN",
        subtitle: `${n.toLocaleString("fr-FR")} insights`,
        color: COLORS.dna,
        href: "/dna",
        category: "ADN",
      });
    }
  } catch {}

  // 3. Supplements — start + end (via Convex)
  try {
    const sup = await convex.query(api.supplements.list, { secret, authUserId: authId, viewUserId: userId });
    const rows = (sup.rows as Array<{ id: number; name: string; dose: string | null; startedAt: number | null; endedAt: number | null }>)
      .map((s) => ({ id: s.id, name: s.name, dose: s.dose ?? null, started_at: s.startedAt ?? null, ended_at: s.endedAt ?? null }));
    for (const r of rows) {
      if (r.started_at) {
        events.push({
          id: `supp-start-${r.id}`,
          kind: "supp-start",
          date: r.started_at,
          title: `Démarrage ${r.name}`,
          subtitle: r.dose ?? undefined,
          color: COLORS.suppStart,
          href: "/supplements",
          category: "Suppléments",
        });
      }
      if (r.ended_at) {
        events.push({
          id: `supp-end-${r.id}`,
          kind: "supp-end",
          date: r.ended_at,
          title: `Arrêt ${r.name}`,
          subtitle: r.dose ?? undefined,
          color: COLORS.suppEnd,
          href: "/supplements",
          category: "Suppléments",
        });
      }
    }
  } catch {}

  // 4. Symptoms — group by date. Reads via Convex (days=3650 ≈ "all"); reproduce
  // the SQL GROUP BY date / COUNT(*) / GROUP_CONCAT(key) over the returned rows.
  try {
    const { rows } = await convex.query(api.symptoms.list, {
      secret, authUserId: authId, viewUserId: userId, days: 3650,
    });
    const byDate = new Map<string, { n: number; keys: string[] }>();
    for (const l of rows) {
      const g = byDate.get(l.date) ?? { n: 0, keys: [] };
      g.n += 1;
      g.keys.push(l.key);
      byDate.set(l.date, g);
    }
    for (const [date, g] of byDate) {
      const ts = parseDateStr(date);
      if (!ts) continue;
      events.push({
        id: `symptom-${date}`,
        kind: "symptom",
        date: ts,
        title: `Symptômes (${g.n})`,
        subtitle: g.keys.slice(0, 3).join(" · "),
        color: COLORS.symptom,
        href: "/symptoms",
        category: "Symptômes",
      });
    }
  } catch {}

  // 5. Reminders (via Convex; reminders are owner-scoped)
  try {
    const rem = await convex.query(api.reminders.list, { secret, authUserId: userId });
    const rows = (rem.rows as Array<{ id: number; title: string; description: string | null; dueAt: number; category: string | null; done: number }>)
      .map((r) => ({ id: r.id, title: r.title, description: r.description ?? null, due_at: r.dueAt, category: r.category ?? null, done: r.done }));
    for (const r of rows) {
      events.push({
        id: `reminder-${r.id}`,
        kind: "reminder",
        date: r.due_at,
        title: r.title,
        subtitle: r.description ?? r.category ?? undefined,
        color: COLORS.reminder,
        href: "/reminders",
        done: !!r.done,
        category: "Rappels",
      });
    }
  } catch {}

  // 6. Documents — only medical docs
  try {
    const rows = d.$client.prepare(
      `SELECT id, category, title, date FROM document
       WHERE user_id = ?
         AND date IS NOT NULL
         AND category IN ('analyses-sang', 'consultations', 'imagerie')
       ORDER BY date DESC`
    ).all(userId) as Array<{
      id: number;
      category: string;
      title: string | null;
      date: number;
    }>;
    for (const r of rows) {
      events.push({
        id: `doc-${r.id}`,
        kind: "document",
        date: r.date,
        title: r.title ?? "Document médical",
        subtitle: r.category,
        color: COLORS.document,
        href: "/files",
        category: "Documents",
      });
    }
  } catch {}

  // Sort newest first, also dedupe by id
  const seen = new Set<string>();
  const unique = events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  unique.sort((a, b) => b.date - a.date);

  return NextResponse.json(
    { events: unique },
    { headers: { "Cache-Control": "no-store" } }
  );
}
