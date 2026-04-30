import { NextResponse } from "next/server";
import { getSession, currentUserId, isDemoUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { logAudit } from "@/lib/audit";
import { lookupBiomarker } from "@/lib/parsers/biomarkers";
import { normalizeUnits } from "@/lib/parsers/normalize-units";

export const runtime = "nodejs";

type InBiomarker = {
  name: string;
  slug?: string | null;
  category?: string | null;
  value: number;
  unit?: string | null;
  refLow?: number | null;
  refHigh?: number | null;
};

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });
  ensureSchema();

  let body: { date?: string; biomarkers?: InBiomarker[]; source?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 400 }); }

  const dateStr = body.date;
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "invalid or missing date (YYYY-MM-DD required)" }, { status: 400 });
  }
  const dateMs = Date.parse(dateStr + "T00:00:00.000Z");
  if (!Number.isFinite(dateMs)) return NextResponse.json({ error: "unparseable date" }, { status: 400 });

  const biomarkers = Array.isArray(body.biomarkers) ? body.biomarkers : [];
  if (biomarkers.length === 0) return NextResponse.json({ error: "biomarkers array is empty" }, { status: 400 });

  const source = body.source || "vision-ocr";

  const sqlite = db().$client;
  const stmt = sqlite.prepare(
    `INSERT INTO biomarker (name, slug, category, value, unit, ref_low, ref_high, date, source, raw_text, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let inserted = 0;
  const skipped: Array<{ name: string; reason: string }> = [];
  const tx = sqlite.transaction((items: InBiomarker[]) => {
    for (const b of items) {
      const rawName = (b.name ?? "").trim();
      if (!rawName) { skipped.push({ name: rawName || "(vide)", reason: "name vide" }); continue; }
      const value = typeof b.value === "number" && Number.isFinite(b.value) ? b.value : NaN;
      if (!Number.isFinite(value)) { skipped.push({ name: rawName, reason: "valeur invalide" }); continue; }

      let slug = b.slug ?? null;
      let name = rawName;
      let category = b.category ?? null;
      let unit = b.unit ?? null;

      if (!slug) {
        const match = lookupBiomarker(rawName);
        if (!match) { skipped.push({ name: rawName, reason: "alias inconnu" }); continue; }
        slug = match.slug;
        name = match.name;
        category = match.category;
        if (!unit && match.unit) unit = match.unit;
      }

      // Final normalization (idempotent for already-canonical values)
      let finalValue = value;
      let finalUnit = unit;
      const norm = normalizeUnits(slug, value, unit);
      if (norm) { finalValue = norm.value; finalUnit = norm.unit || unit; }

      let nLow = b.refLow ?? null;
      let nHigh = b.refHigh ?? null;
      if (typeof nLow === "number" && Number.isFinite(nLow)) {
        const r = normalizeUnits(slug, nLow, unit);
        if (r) nLow = r.value;
      } else nLow = null;
      if (typeof nHigh === "number" && Number.isFinite(nHigh)) {
        const r = normalizeUnits(slug, nHigh, unit);
        if (r) nHigh = r.value;
      } else nHigh = null;

      stmt.run(name, slug, category, finalValue, finalUnit, nLow, nHigh, dateMs, source, null, userId);
      inserted++;
    }
  });

  try { tx(biomarkers); } catch (e) {
    return NextResponse.json({ error: (e as Error).message, inserted, skipped }, { status: 500 });
  }

  logAudit("vision-ocr-insert", `date=${dateStr} inserted=${inserted} skipped=${skipped.length}`, req);
  return NextResponse.json({ ok: true, inserted, skipped, date: dateStr });
}
