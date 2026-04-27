import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { NUTRIENT_TARGETS, TARGETS_BY_KEY, convertTo, statusOf, type CoverageStatus, type NutrientTarget } from "@/lib/nutrient-targets";
import { nutrientsFromText } from "@/lib/supplement-nutrients";

export const runtime = "nodejs";

type Ingredient = { name?: string; dose?: string | number; unit?: string; nrv?: number };
type SupRow = { id: number; name: string; brand: string | null; dose: string | null; unit: string | null; frequency: string | null; ingredients: string | null; ended_at: number | null };

function parseFreq(f: string | null): number {
  if (!f) return 1;
  const m = f.match(/(\d+(?:[.,]\d+)?)\s*x/i);
  if (m) return parseFloat(m[1].replace(",", "."));
  if (/quotidien|jour|daily/i.test(f)) return 1;
  return 1;
}

function parseDose(d: string | number | null | undefined): number | null {
  if (d == null) return null;
  if (typeof d === "number") return d;
  const m = String(d).match(/(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

// Pick a single nutrient key from a text (the most specific match wins — preserve insertion order in nutrientsFromText).
function singleNutrientKey(text: string): string | null {
  const set = nutrientsFromText(text);
  // Prefer specific keys that have targets
  for (const k of set) if (TARGETS_BY_KEY[k]) return k;
  return null;
}

type Contribution = { supplementId: number; supplementName: string; rawAmount: number; rawUnit: string; daily: number };
type Coverage = {
  key: string;
  label: string;
  unit: NutrientTarget["unit"];
  amount: number;
  target: NutrientTarget;
  status: CoverageStatus;
  contributions: Contribution[];
};

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;

  const rows = sqlite.prepare(`SELECT id, name, brand, dose, unit, frequency, ingredients, ended_at FROM supplement WHERE ended_at IS NULL`).all() as SupRow[];

  const accum: Record<string, Coverage> = {};
  function add(key: string, supId: number, supName: string, value: number, unit: string, freq: number) {
    const target = TARGETS_BY_KEY[key];
    if (!target) return;
    const daily = convertTo(value * freq, unit, target.unit, key);
    if (daily == null || !isFinite(daily) || daily <= 0) return;
    if (!accum[key]) {
      accum[key] = {
        key, label: target.label, unit: target.unit, amount: 0, target,
        status: "low", contributions: [],
      };
    }
    accum[key].amount += daily;
    accum[key].contributions.push({ supplementId: supId, supplementName: supName, rawAmount: value, rawUnit: unit, daily });
  }

  for (const r of rows) {
    const freq = parseFreq(r.frequency);
    let parsed: Ingredient[] | null = null;
    if (r.ingredients) { try { const p = JSON.parse(r.ingredients); if (Array.isArray(p)) parsed = p; } catch {} }

    if (parsed && parsed.length > 0) {
      // Use ingredient breakdown — assume each ingredient dose is per serving
      for (const ing of parsed) {
        const name = ing.name ?? "";
        const key = singleNutrientKey(name);
        if (!key) continue;
        const value = parseDose(ing.dose);
        if (value == null) continue;
        const unit = String(ing.unit ?? "mg");
        add(key, r.id, r.name, value, unit, freq);
      }
    } else {
      // No ingredients — try to map the supplement name to a single nutrient
      const key = singleNutrientKey(`${r.name} ${r.brand ?? ""}`);
      if (!key) continue;
      const value = parseDose(r.dose);
      if (value == null) continue;
      const unit = String(r.unit ?? "mg");
      add(key, r.id, r.name, value, unit, freq);
    }
  }

  // Compute status + sort by status severity (low first, then high, then above-optimal, then optimal)
  const list = Object.values(accum).map((c) => ({ ...c, status: statusOf(c.target, c.amount) }));
  const order: Record<CoverageStatus, number> = { low: 0, high: 1, "above-optimal": 2, optimal: 3 };
  list.sort((a, b) => order[a.status] - order[b.status] || a.label.localeCompare(b.label));

  // Summary counts
  const summary = list.reduce((acc, c) => { acc[c.status]++; return acc; }, { low: 0, optimal: 0, "above-optimal": 0, high: 0 } as Record<CoverageStatus, number>);

  return NextResponse.json({ coverage: list, summary, activeCount: rows.length });
}
