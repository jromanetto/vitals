/**
 * Vision-based biomarker extraction for lab PDFs whose text layer is sparse or
 * absent (image-based / designed reports like Lucis, scans, phone photos).
 * pdf-parse returns almost no text for these, so the text LLM never sees most
 * markers. We render each page to an image with pdftoppm and let Claude read
 * the values directly. Output goes through the SAME alias + unit-sanity
 * pipeline as every other path. Never throws — returns [] on any failure.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fsp from "node:fs/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { type Biomarker } from "./biomarkers";
import { MODELS, THINKING } from "@/lib/ai/models.mjs";
import { BIOMARKER_EXTRACTION_SYSTEM, canonicalizeRawBiomarkers, salvageObjects, type RawBm } from "./biomarkers-llm";

const exec = promisify(execFile);
const MODEL = MODELS.EXTRACTION;
const MAX_PAGES = 16;       // cap cost on very long PDFs
const PAGES_PER_CALL = 4;   // images per vision request

/** Render PDF pages to JPEGs in a temp dir; returns their paths in order. */
async function renderPages(pdfPath: string): Promise<{ dir: string; files: string[] }> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "vbm-"));
  const prefix = path.join(dir, "page");
  // -r 140 dpi is enough to read lab tables; -jpeg keeps payload small.
  await exec("pdftoppm", ["-jpeg", "-r", "140", "-l", String(MAX_PAGES), pdfPath, prefix], { maxBuffer: 64 * 1024 * 1024 });
  const files = (await fsp.readdir(dir))
    .filter((f) => f.endsWith(".jpg"))
    .sort((a, b) => (parseInt(a.match(/(\d+)/)?.[1] ?? "0", 10)) - (parseInt(b.match(/(\d+)/)?.[1] ?? "0", 10)))
    .map((f) => path.join(dir, f));
  return { dir, files };
}

const MEDIA: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
};

/** Vision extraction from a single photographed lab image (phone camera). */
export async function extractBiomarkersVisionFromImage(imagePath: string, apiKey: string): Promise<Biomarker[]> {
  try {
    if (!fs.existsSync(imagePath)) return [];
    const media = MEDIA[path.extname(imagePath).toLowerCase()];
    if (!media) return []; // unsupported format (e.g. HEIC) — caller just stores the file
    const data = (await fsp.readFile(imagePath)).toString("base64");
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: MODEL,
      thinking: THINKING.EXTRACTION,
      max_tokens: 8000,
      system: BIOMARKER_EXTRACTION_SYSTEM,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: media, data } },
        { type: "text", text: "Extrais TOUS les résultats biologiques visibles sur cette photo, au format JSON demandé." },
      ] }],
    });
    const content = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    const match = content.match(/\[[\s\S]*\]/);
    let arr: RawBm[];
    try { arr = JSON.parse(match ? match[0] : content); if (!Array.isArray(arr)) arr = salvageObjects(content); }
    catch { arr = salvageObjects(content); }
    return canonicalizeRawBiomarkers(Array.isArray(arr) ? arr : [], "Photo");
  } catch {
    return [];
  }
}

export async function extractBiomarkersVision(pdfPath: string, apiKey: string): Promise<Biomarker[]> {
  let dir: string | null = null;
  try {
    if (!fs.existsSync(pdfPath)) return [];
    const rendered = await renderPages(pdfPath);
    dir = rendered.dir;
    if (rendered.files.length === 0) return [];

    const client = new Anthropic({ apiKey });
    const all: RawBm[] = [];

    for (let i = 0; i < rendered.files.length; i += PAGES_PER_CALL) {
      const batch = rendered.files.slice(i, i + PAGES_PER_CALL);
      const images = await Promise.all(batch.map(async (f) => ({
        type: "image" as const,
        source: { type: "base64" as const, media_type: "image/jpeg" as const, data: (await fsp.readFile(f)).toString("base64") },
      })));
      try {
        const resp = await client.messages.create({
          model: MODEL,
          thinking: THINKING.EXTRACTION,
          max_tokens: 8000,
          system: BIOMARKER_EXTRACTION_SYSTEM,
          messages: [{ role: "user", content: [...images, { type: "text", text: "Extrais TOUS les résultats biologiques visibles sur ces pages, au format JSON demandé." }] }],
        });
        const content = resp.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
        const match = content.match(/\[[\s\S]*\]/);
        let arr: RawBm[];
        try { arr = JSON.parse(match ? match[0] : content); if (!Array.isArray(arr)) arr = salvageObjects(content); }
        catch { arr = salvageObjects(content); }
        if (Array.isArray(arr)) all.push(...arr);
      } catch { /* skip this batch, keep the others */ }
    }

    return canonicalizeRawBiomarkers(all, "Vision");
  } catch {
    return [];
  } finally {
    if (dir) { try { await fsp.rm(dir, { recursive: true, force: true }); } catch { /* ignore */ } }
  }
}
