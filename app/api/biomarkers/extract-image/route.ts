import { NextResponse } from "next/server";
import { getSession, isDemoUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { lookupBiomarker } from "@/lib/parsers/biomarkers";
import { normalizeUnits } from "@/lib/parsers/normalize-units";
import { readFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { MODELS, THINKING } from "@/lib/ai/models.mjs";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

function readApiKey(): string | null {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), "data", "auth.json"), "utf8")).anthropicApiKey ?? null;
  } catch { return null; }
}

type RawBiomarker = {
  name?: string;
  value?: number | string;
  unit?: string | null;
  refLow?: number | string | null;
  refHigh?: number | string | null;
};
type RawExtraction = {
  date?: string | null;
  panel_lab?: string | null;
  biomarkers?: RawBiomarker[];
};

const PROMPT = `You see a photo of a French blood test result. Extract all biomarkers with name, value, unit, and reference range when visible. Return STRICT JSON: { date: "YYYY-MM-DD" | null, panel_lab: string | null, biomarkers: [{ name, value: number, unit, refLow: number | null, refHigh: number | null }] }. No prose, no markdown, only the JSON.`;

function detectMediaType(filename: string, declared: string | null | undefined): "image/jpeg" | "image/png" | "image/webp" | "image/gif" | null {
  const f = filename.toLowerCase();
  const d = (declared ?? "").toLowerCase();
  if (d === "image/jpeg" || d === "image/jpg" || /\.(jpe?g)$/i.test(f)) return "image/jpeg";
  if (d === "image/png" || /\.png$/i.test(f)) return "image/png";
  if (d === "image/webp" || /\.webp$/i.test(f)) return "image/webp";
  if (d === "image/gif" || /\.gif$/i.test(f)) return "image/gif";
  // HEIC is not directly supported by Claude Vision; the client should convert. Reject for clarity.
  return null;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/\s/g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(s.userId)) return NextResponse.json({ error: "Mode démo en lecture seule. Crée un compte pour modifier." }, { status: 403 });

  const apiKey = readApiKey();
  if (!apiKey) return NextResponse.json({ error: "anthropic api key missing" }, { status: 500 });

  let fd: FormData;
  try { fd = await req.formData(); } catch { return NextResponse.json({ error: "invalid multipart body" }, { status: 400 }); }
  const file = (fd.get("file") ?? fd.get("image")) as File | null;
  if (!file) return NextResponse.json({ error: "no file (expected field 'file')" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file too large (max 20 MB)" }, { status: 413 });

  const mediaType = detectMediaType(file.name, file.type);
  if (!mediaType) return NextResponse.json({ error: "unsupported image type (jpg/png/webp/gif). Convert HEIC client-side." }, { status: 415 });

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");

  const client = new Anthropic({ apiKey });
  let raw: RawExtraction;
  try {
    const resp = await client.messages.create({
      model: MODELS.EXTRACTION,
      thinking: THINKING.EXTRACTION,
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: PROMPT },
        ],
      }],
    });
    const text = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "vision response did not contain JSON", rawResponse: text.slice(0, 500) }, { status: 502 });
    raw = JSON.parse(m[0]) as RawExtraction;
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  // Validate + normalize
  const date = typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null;
  const panelLab = typeof raw.panel_lab === "string" ? raw.panel_lab : null;
  const inputBiomarkers = Array.isArray(raw.biomarkers) ? raw.biomarkers : [];

  type Out = { name: string; slug: string | null; category: string | null; value: number; unit: string | null; refLow: number | null; refHigh: number | null; matched: boolean };
  const out: Out[] = [];

  for (const b of inputBiomarkers) {
    const rawName = typeof b.name === "string" ? b.name.trim() : "";
    if (!rawName) continue;
    const value = toNum(b.value);
    if (value == null) continue;
    const unit = typeof b.unit === "string" && b.unit.trim() ? b.unit.trim() : null;
    let refLow = toNum(b.refLow ?? null);
    let refHigh = toNum(b.refHigh ?? null);

    const match = lookupBiomarker(rawName);
    if (match) {
      const norm = normalizeUnits(match.slug, value, unit);
      if (norm) {
        // Also normalize refs when present
        let nLow = refLow;
        let nHigh = refHigh;
        if (nLow != null) {
          const r = normalizeUnits(match.slug, nLow, unit);
          if (r) nLow = r.value;
        }
        if (nHigh != null) {
          const r = normalizeUnits(match.slug, nHigh, unit);
          if (r) nHigh = r.value;
        }
        out.push({ name: match.name, slug: match.slug, category: match.category, value: norm.value, unit: norm.unit || match.unit || null, refLow: nLow, refHigh: nHigh, matched: true });
        continue;
      }
      // Match found but unit normalization rejected the value as out-of-sane-range — keep raw, mark unmatched units
      out.push({ name: match.name, slug: match.slug, category: match.category, value, unit: unit ?? match.unit ?? null, refLow, refHigh, matched: true });
      continue;
    }
    // No alias match — surface for the user to decide
    out.push({ name: rawName, slug: null, category: null, value, unit, refLow, refHigh, matched: false });
  }

  logAudit("vision-ocr-extract", `file=${file.name} markers=${out.length}`, req);
  return NextResponse.json({ ok: true, date, panelLab, biomarkers: out });
}
