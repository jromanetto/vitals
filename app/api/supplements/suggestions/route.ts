import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { META_BY_SLUG } from "@/lib/biomarker-meta";

export const runtime = "nodejs";

type Suggestion = {
  supplement: string;
  reason: string;
  biomarker?: string; biomarkerSlug?: string; value?: number; unit?: string;
  snp?: string;
  dose: string; timing: string;
};

const RECOMMENDATIONS: Record<string, Omit<Suggestion, "biomarker" | "biomarkerSlug" | "value" | "unit"> & { trigger: (latest: { value: number; refLow: number | null; refHigh: number | null; opt?: { lo: number | null; hi: number | null } }) => boolean }> = {
  "vitamine-d-25-oh": {
    supplement: "Vitamine D3 + K2",
    reason: "Vitamine D 25-OH sub-optimale (cible 40-80 ng/mL)",
    dose: "4000 UI D3 + 100 μg K2 MK7", timing: "matin avec le repas (gras)",
    trigger: (l) => l.value < (l.opt?.lo ?? 40),
  },
  "vitamine-b12": {
    supplement: "Méthylcobalamine B12",
    reason: "B12 sub-optimale (cible >500 pg/mL)",
    dose: "1000 μg sublingual", timing: "matin à jeun",
    trigger: (l) => l.value < 500,
  },
  "ferritine": {
    supplement: "Bisglycinate de fer",
    reason: "Ferritine basse (cible 70-120 ng/mL)",
    dose: "25-50 mg", timing: "à jeun avec vitamine C, loin des polyphénols",
    trigger: (l) => l.value < 70,
  },
  "magnesium-erythrocytaire": {
    supplement: "Magnésium bisglycinate",
    reason: "Magnésium intra-cellulaire bas",
    dose: "300-400 mg", timing: "soir avant coucher",
    trigger: (l) => l.value < (l.opt?.lo ?? 1.8),
  },
  "magnesium-serique": {
    supplement: "Magnésium bisglycinate",
    reason: "Magnésium sérique sous l'optimum",
    dose: "300-400 mg", timing: "soir avant coucher",
    trigger: (l) => l.value < (l.opt?.lo ?? 2.0),
  },
  "homocysteine": {
    supplement: "Méthylfolate + B12 + B6 (cofacteurs méthylation)",
    reason: "Homocystéine élevée — méthylation sub-optimale",
    dose: "L-MTHF 800 μg + B12 500 μg + B6 25 mg", timing: "matin",
    trigger: (l) => l.value > 9,
  },
  "ldl": {
    supplement: "Berbérine + Bergamote (Citrus bergamia)",
    reason: "LDL au-dessus de la cible longévité (<0.70 g/L)",
    dose: "Berbérine 500mg x2 + Bergamote 500mg", timing: "midi et soir avec repas",
    trigger: (l) => l.value > 0.7,
  },
  "crp-ultrasensible-hscrp": {
    supplement: "EPA/DHA haute concentration + Curcumine",
    reason: "Inflammation de bas grade (hsCRP au-dessus de 0.5 mg/L)",
    dose: "Oméga-3 2-3g (EPA+DHA) + Curcumine 500mg", timing: "midi avec repas",
    trigger: (l) => l.value > 0.5,
  },
  "selenium": {
    supplement: "Sélénométhionine",
    reason: "Sélénium bas (cofacteur thyroïde + antioxydant)",
    dose: "100-200 μg", timing: "matin",
    trigger: (l) => l.value < (l.opt?.lo ?? 100),
  },
  "zinc-serique": {
    supplement: "Zinc bisglycinate ou picolinate",
    reason: "Zinc bas (testostérone, immunité, peau)",
    dose: "15-25 mg", timing: "soir loin des repas (sans cuivre)",
    trigger: (l) => l.value < (l.opt?.lo ?? 90),
  },
  "tsh": {
    supplement: "Iode + sélénium + tyrosine",
    reason: "TSH au-dessus de l'optimum fonctionnel (2.0)",
    dose: "Iode 150 μg + Sélénium 100 μg + L-Tyrosine 500mg", timing: "matin à jeun",
    trigger: (l) => l.value > 2.5,
  },
  "testosterone-totale": {
    supplement: "Tongkat Ali + Zinc + DHEA (avec avis médecin)",
    reason: "Testostérone totale sous l'optimum fonctionnel (>5.5 ng/mL)",
    dose: "Tongkat 400mg + Zinc 25mg", timing: "matin",
    trigger: (l) => l.value < 5.5,
  },
};

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const sqlite = db().$client;
  const latestBms = sqlite.prepare(`
    SELECT b.slug, b.name, b.value, b.unit, b.ref_low as refLow, b.ref_high as refHigh, b.date
    FROM biomarker b
    JOIN (SELECT slug, MAX(date) AS md FROM biomarker GROUP BY slug) x ON x.slug = b.slug AND x.md = b.date
  `).all() as Array<{ slug: string; name: string; value: number; unit: string | null; refLow: number | null; refHigh: number | null; date: number }>;

  const out: Suggestion[] = [];
  for (const r of latestBms) {
    const rec = RECOMMENDATIONS[r.slug];
    if (!rec) continue;
    const md = META_BY_SLUG[r.slug];
    const triggered = rec.trigger({
      value: r.value, refLow: r.refLow, refHigh: r.refHigh,
      opt: md ? { lo: md.optimalLow, hi: md.optimalHigh } : undefined,
    });
    if (triggered) {
      out.push({
        supplement: rec.supplement, reason: rec.reason,
        biomarker: r.name, biomarkerSlug: r.slug, value: r.value, unit: r.unit ?? undefined,
        dose: rec.dose, timing: rec.timing,
      });
    }
  }
  return NextResponse.json({ suggestions: out });
}
