import fs from "node:fs/promises";

// pdf-parse cjs interop
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export type ParsedPdf = { text: string; numPages: number; info: Record<string, unknown> };

export async function parsePdf(filePath: string): Promise<ParsedPdf> {
  const buf = await fs.readFile(filePath);
  const data = await pdfParse(buf);
  return { text: data.text || "", numPages: data.numpages || 0, info: data.info || {} };
}

const MONTHS_FR: Record<string, number> = {
  "janvier": 1, "fevrier": 2, "février": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
  "juillet": 7, "aout": 8, "août": 8, "septembre": 9, "octobre": 10, "novembre": 11, "decembre": 12, "décembre": 12,
};

export function extractDateFromPath(p: string): number | null {
  const m1 = p.match(/(\d{4})[-_](\d{2})(?:[-_](\d{2}))?/);
  if (m1) {
    const y = +m1[1], mo = +m1[2], d = +(m1[3] ?? "1");
    if (y >= 1980 && y <= 2099 && mo >= 1 && mo <= 12) return Date.UTC(y, mo - 1, d);
  }
  const m2 = p.match(/(\d{4})/);
  if (m2) {
    const y = +m2[1];
    if (y >= 1980 && y <= 2099) return Date.UTC(y, 0, 1);
  }
  return null;
}

export function extractDateFromText(text: string): number | null {
  const m1 = text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (m1) {
    let y = +m1[3]; if (y < 100) y += 2000;
    const mo = +m1[2], d = +m1[1];
    if (y >= 1980 && y <= 2099 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return Date.UTC(y, mo - 1, d);
  }
  const m2 = text.match(/(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i);
  if (m2) {
    const d = +m2[1], mo = MONTHS_FR[m2[2].toLowerCase()], y = +m2[3];
    if (mo) return Date.UTC(y, mo - 1, d);
  }
  return null;
}
