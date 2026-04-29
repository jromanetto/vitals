import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

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

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateStr(s: string): number {
  // expected YYYY-MM-DD or with time
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  ensureSchema();
  const d = db();
  const events: TimelineEvent[] = [];

  // 1. Biomarkers — group by date as a single "bilan sanguin" event
  try {
    const rows = d.$client.prepare(
      `SELECT date, COUNT(*) as n FROM biomarker WHERE date IS NOT NULL GROUP BY date ORDER BY date DESC`
    ).all() as Array<{ date: number; n: number }>;
    for (const r of rows) {
      events.push({
        id: `bilan-${r.date}`,
        kind: "bilan-sanguin",
        date: r.date,
        title: "Bilan sanguin",
        subtitle: `${r.n} biomarqueur${r.n > 1 ? "s" : ""}`,
        color: COLORS.bilan,
        href: "/biomarkers",
        category: "Bilans",
      });
    }
  } catch {}

  // 2. DNA import — single event from the first dna_variant row's existence
  // (no date column on dna_variant; use any insight row as proxy or skip)
  try {
    const cnt = d.$client.prepare(`SELECT COUNT(*) as n FROM dna_variant`).get() as { n: number };
    if (cnt && cnt.n > 0) {
      // Use document table for the DNA file date if present
      const dnaDoc = d.$client.prepare(
        `SELECT date FROM document WHERE category = 'adn' AND date IS NOT NULL ORDER BY date ASC LIMIT 1`
      ).get() as { date: number } | undefined;
      const date = dnaDoc?.date ?? Date.now();
      events.push({
        id: `dna-import`,
        kind: "dna-import",
        date,
        title: "Import ADN",
        subtitle: `${cnt.n.toLocaleString("fr-FR")} variants`,
        color: COLORS.dna,
        href: "/dna",
        category: "ADN",
      });
    }
  } catch {}

  // 3. Supplements — start + end
  try {
    const rows = d.$client.prepare(
      `SELECT id, name, dose, started_at, ended_at FROM supplement`
    ).all() as Array<{
      id: number;
      name: string;
      dose: string | null;
      started_at: number | null;
      ended_at: number | null;
    }>;
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

  // 4. Symptoms — group by date
  try {
    const rows = d.$client.prepare(
      `SELECT date, COUNT(*) as n, GROUP_CONCAT(key, ', ') as keys FROM symptom_log GROUP BY date ORDER BY date DESC`
    ).all() as Array<{ date: string; n: number; keys: string }>;
    for (const r of rows) {
      const ts = parseDateStr(r.date);
      if (!ts) continue;
      events.push({
        id: `symptom-${r.date}`,
        kind: "symptom",
        date: ts,
        title: `Symptômes (${r.n})`,
        subtitle: r.keys?.split(",").slice(0, 3).map((k) => k.trim()).join(" · "),
        color: COLORS.symptom,
        href: "/symptoms",
        category: "Symptômes",
      });
    }
  } catch {}

  // 5. Reminders
  try {
    const rows = d.$client.prepare(
      `SELECT id, title, description, due_at, category, done FROM reminder ORDER BY due_at DESC`
    ).all() as Array<{
      id: number;
      title: string;
      description: string | null;
      due_at: number;
      category: string | null;
      done: number;
    }>;
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
       WHERE date IS NOT NULL
         AND category IN ('analyses-sang', 'consultations', 'imagerie')
       ORDER BY date DESC`
    ).all() as Array<{
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
