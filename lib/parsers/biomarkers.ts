import "server-only";
import { slugify } from "@/lib/utils";

export type Biomarker = {
  name: string; slug: string; category: string;
  value: number; unit: string | null;
  refLow: number | null; refHigh: number | null;
  raw: string;
};

const ALIASES: Record<string, { canonical: string; category: string; unit?: string }> = {
  // hematology
  "hb": { canonical: "Hémoglobine", category: "hematology", unit: "g/dL" },
  "hemoglobine": { canonical: "Hémoglobine", category: "hematology", unit: "g/dL" },
  "hématies": { canonical: "Hématies", category: "hematology", unit: "M/μL" },
  "hematocrite": { canonical: "Hématocrite", category: "hematology", unit: "%" },
  "vgm": { canonical: "VGM", category: "hematology", unit: "fL" },
  "tcmh": { canonical: "TCMH", category: "hematology", unit: "pg" },
  "ccmh": { canonical: "CCMH", category: "hematology", unit: "g/dL" },
  "leucocytes": { canonical: "Leucocytes", category: "hematology", unit: "/μL" },
  "polynucleaires neutrophiles": { canonical: "Neutrophiles", category: "hematology" },
  "lymphocytes": { canonical: "Lymphocytes", category: "hematology" },
  "monocytes": { canonical: "Monocytes", category: "hematology" },
  "eosinophiles": { canonical: "Éosinophiles", category: "hematology" },
  "basophiles": { canonical: "Basophiles", category: "hematology" },
  "plaquettes": { canonical: "Plaquettes", category: "hematology", unit: "/μL" },
  // lipid
  "cholesterol total": { canonical: "Cholestérol total", category: "lipids", unit: "g/L" },
  "hdl": { canonical: "HDL", category: "lipids", unit: "g/L" },
  "ldl": { canonical: "LDL", category: "lipids", unit: "g/L" },
  "triglycerides": { canonical: "Triglycérides", category: "lipids", unit: "g/L" },
  "apo a1": { canonical: "Apo A1", category: "lipids", unit: "g/L" },
  "apo b": { canonical: "Apo B", category: "lipids", unit: "g/L" },
  "lp(a)": { canonical: "Lp(a)", category: "lipids", unit: "mg/dL" },
  // metabolic
  "glycemie": { canonical: "Glycémie", category: "metabolic", unit: "g/L" },
  "glucose": { canonical: "Glycémie", category: "metabolic", unit: "g/L" },
  "hba1c": { canonical: "HbA1c", category: "metabolic", unit: "%" },
  "insuline": { canonical: "Insuline", category: "metabolic", unit: "μUI/mL" },
  "homa": { canonical: "HOMA-IR", category: "metabolic" },
  "homa-ir": { canonical: "HOMA-IR", category: "metabolic" },
  // hormones
  "tsh": { canonical: "TSH", category: "thyroid", unit: "μUI/mL" },
  "t3l": { canonical: "T3 libre", category: "thyroid", unit: "pmol/L" },
  "t4l": { canonical: "T4 libre", category: "thyroid", unit: "pmol/L" },
  "ft3": { canonical: "T3 libre", category: "thyroid" },
  "ft4": { canonical: "T4 libre", category: "thyroid" },
  "testosterone totale": { canonical: "Testostérone totale", category: "hormones", unit: "ng/mL" },
  "testosterone libre": { canonical: "Testostérone libre", category: "hormones", unit: "pg/mL" },
  "shbg": { canonical: "SHBG", category: "hormones", unit: "nmol/L" },
  "estradiol": { canonical: "Œstradiol", category: "hormones", unit: "pg/mL" },
  "dheas": { canonical: "DHEA-S", category: "hormones", unit: "μg/dL" },
  "cortisol": { canonical: "Cortisol", category: "hormones", unit: "nmol/L" },
  "igf-1": { canonical: "IGF-1", category: "hormones", unit: "ng/mL" },
  // vitamins
  "vitamine d": { canonical: "Vitamine D (25-OH)", category: "vitamins", unit: "ng/mL" },
  "25 oh vitamine d": { canonical: "Vitamine D (25-OH)", category: "vitamins", unit: "ng/mL" },
  "25-oh-vitamine d": { canonical: "Vitamine D (25-OH)", category: "vitamins" },
  "vitamine b12": { canonical: "Vitamine B12", category: "vitamins", unit: "pg/mL" },
  "folates": { canonical: "Folates (B9)", category: "vitamins", unit: "ng/mL" },
  "ferritine": { canonical: "Ferritine", category: "iron", unit: "ng/mL" },
  "fer": { canonical: "Fer sérique", category: "iron", unit: "μg/dL" },
  "transferrine": { canonical: "Transferrine", category: "iron", unit: "g/L" },
  // kidney/liver
  "creatinine": { canonical: "Créatinine", category: "kidney", unit: "mg/L" },
  "uree": { canonical: "Urée", category: "kidney", unit: "g/L" },
  "dfg": { canonical: "DFG", category: "kidney", unit: "mL/min" },
  "asat": { canonical: "ASAT", category: "liver", unit: "UI/L" },
  "alat": { canonical: "ALAT", category: "liver", unit: "UI/L" },
  "ggt": { canonical: "GGT", category: "liver", unit: "UI/L" },
  "pal": { canonical: "PAL", category: "liver", unit: "UI/L" },
  "bilirubine totale": { canonical: "Bilirubine totale", category: "liver", unit: "mg/L" },
  // inflammation
  "crp": { canonical: "CRP", category: "inflammation", unit: "mg/L" },
  "fibrinogene": { canonical: "Fibrinogène", category: "inflammation", unit: "g/L" },
  "vs": { canonical: "VS", category: "inflammation", unit: "mm" },
  "homocysteine": { canonical: "Homocystéine", category: "cardiovascular", unit: "μmol/L" },
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

const VALUE_LINE = /([A-Za-zÀ-ÿ()\-' /\.]{3,40}?)\s*[:\.]?\s+([0-9]+(?:[.,][0-9]+)?)\s*([a-zA-Zµ%/\.]+(?:\s*\/\s*[a-zA-Zµ%]+)?)?\s*(?:\(?\s*([0-9]+(?:[.,][0-9]+)?)\s*[-–à]\s*([0-9]+(?:[.,][0-9]+)?)\s*\)?)?/g;

export function parseBiomarkersFromText(text: string): Biomarker[] {
  const out: Biomarker[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(VALUE_LINE)) {
    const rawName = m[1].trim();
    if (rawName.length < 3) continue;
    const norm = normalize(rawName);
    const alias = ALIASES[norm];
    if (!alias) continue;
    const value = parseFloat(m[2].replace(",", "."));
    if (!Number.isFinite(value)) continue;
    const unit = m[3]?.trim().replace(/\s+/g, "") || alias.unit || null;
    const refLow = m[4] ? parseFloat(m[4].replace(",", ".")) : null;
    const refHigh = m[5] ? parseFloat(m[5].replace(",", ".")) : null;
    const slug = slugify(alias.canonical);
    const key = slug + ":" + value;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: alias.canonical, slug, category: alias.category,
      value, unit, refLow, refHigh, raw: m[0],
    });
  }
  return out;
}
