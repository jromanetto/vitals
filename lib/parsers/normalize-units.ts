/**
 * Canonical units per biomarker + unit conversion at parse time.
 * Many lab PDFs report the same marker in g/L, mg/dL, mmol/L — we standardize.
 *
 * Strategy:
 *  - canonical unit defined per slug
 *  - if parsed unit matches canonical → keep
 *  - if known alternative → convert
 *  - if no unit captured → infer from value magnitude
 *  - if value falls outside sanity range → reject (probably parser garbage)
 */

export type Conversion = {
  canonical: string;
  factors?: Record<string, number>;
  // sanity range in CANONICAL unit; values outside are rejected as parsing artefacts
  sane?: { min: number; max: number };
  // if no unit captured, infer based on value magnitude
  infer?: (value: number) => string | null;
};

const TBL: Record<string, Conversion> = {
  "ldl": {
    canonical: "mg/dL",
    factors: { "mg/dl": 1, "mg/dL": 1, "mmol/L": 38.67, "mmol/l": 38.67, "g/L": 100, "g/l": 100 },
    sane: { min: 20, max: 400 },
    infer: (v) => v < 8 ? "mmol/L" : v > 8 && v < 400 ? "mg/dL" : null,
  },
  "hdl": {
    canonical: "mg/dL",
    factors: { "mg/dl": 1, "mg/dL": 1, "mmol/L": 38.67, "mmol/l": 38.67, "g/L": 100, "g/l": 100 },
    sane: { min: 15, max: 150 },
    infer: (v) => v < 5 ? "mmol/L" : v >= 15 && v < 150 ? "mg/dL" : null,
  },
  "non-hdl": {
    canonical: "mg/dL",
    factors: { "mg/dl": 1, "mmol/L": 38.67, "g/L": 100 },
    sane: { min: 30, max: 400 },
    infer: (v) => v < 10 ? "mmol/L" : v >= 30 ? "mg/dL" : null,
  },
  "cholesterol-total": {
    canonical: "mg/dL",
    factors: { "mg/dl": 1, "mg/dL": 1, "mmol/L": 38.67, "g/L": 100 },
    sane: { min: 80, max: 500 },
    infer: (v) => v < 10 ? "mmol/L" : v < 8 ? "g/L" : "mg/dL",
  },
  "triglycerides": {
    canonical: "mg/dL",
    factors: { "mg/dl": 1, "mmol/L": 88.57, "g/L": 100 },
    sane: { min: 20, max: 1500 },
    infer: (v) => v < 6 ? "mmol/L" : v < 10 ? "g/L" : "mg/dL",
  },
  "apo-b": {
    canonical: "mg/dL",
    factors: { "mg/dl": 1, "g/L": 100 },
    sane: { min: 30, max: 300 },
    infer: (v) => v < 3 ? "g/L" : "mg/dL",
  },
  "apo-a1": {
    canonical: "mg/dL",
    factors: { "mg/dl": 1, "g/L": 100 },
    sane: { min: 60, max: 300 },
    infer: (v) => v < 5 ? "g/L" : "mg/dL",
  },
  "lp-a": {
    canonical: "mg/dL",
    factors: { "mg/dl": 1, "nmol/L": 0.4, "mg/L": 0.1 },
    sane: { min: 0, max: 300 },
  },
  "glycemie": {
    canonical: "mg/dL",
    factors: { "mg/dl": 1, "mmol/L": 18, "g/L": 100 },
    sane: { min: 40, max: 500 },
    infer: (v) => v < 12 ? "mmol/L" : v < 5 ? "g/L" : "mg/dL",
  },
  "hba1c": {
    canonical: "%",
    factors: { "%": 1 },
    sane: { min: 3.5, max: 15 },
  },
  "hba1c-ifcc": {
    canonical: "mmol/mol",
    factors: { "mmol/mol": 1 },
    sane: { min: 15, max: 130 },
  },
  "creatinine": {
    canonical: "mg/L",
    factors: { "mg/l": 1, "mg/L": 1, "μmol/L": 1 / 88.4, "umol/L": 1 / 88.4, "mg/dL": 10 },
    sane: { min: 2, max: 50 },
  },
  "urée": { canonical: "g/L", sane: { min: 0.1, max: 1.0 } },
  "uree": { canonical: "g/L", sane: { min: 0.1, max: 1.0 } },
  "ferritine": {
    canonical: "ng/mL",
    factors: { "ng/ml": 1, "μg/L": 1, "ug/L": 1 },
    sane: { min: 5, max: 1500 },
  },
  "fer-serique": {
    canonical: "μg/dL",
    factors: { "μg/dl": 1, "ug/dl": 1, "μmol/L": 5.585 },
    sane: { min: 20, max: 300 },
    infer: (v) => v < 50 ? "μmol/L" : "μg/dL",
  },
  "vitamine-d-25-oh": {
    canonical: "ng/mL",
    factors: { "ng/ml": 1, "μg/L": 1, "ug/L": 1, "nmol/L": 0.4 },
    sane: { min: 5, max: 200 },
    infer: (v) => v > 200 ? "nmol/L" : "ng/mL",
  },
  "vitamine-b12": {
    canonical: "pg/mL",
    factors: { "pg/ml": 1, "ng/L": 1, "pmol/L": 1.355 },
    sane: { min: 100, max: 3000 },
  },
  "tsh": {
    canonical: "μUI/mL",
    factors: { "μui/ml": 1, "uui/ml": 1, "mU/L": 1, "mIU/L": 1 },
    sane: { min: 0.05, max: 30 },
  },
  "testosterone-totale": {
    canonical: "ng/mL",
    factors: { "ng/ml": 1, "ng/dL": 0.01, "nmol/L": 0.288 },
    sane: { min: 0.5, max: 15 },
    infer: (v) => v > 50 ? "ng/dL" : v > 15 ? "nmol/L" : "ng/mL",
  },
  "œstradiol": {
    canonical: "pg/mL",
    factors: { "pg/ml": 1, "pmol/L": 0.272 },
    sane: { min: 5, max: 800 },
  },
  "hemoglobine": {
    canonical: "g/dL",
    factors: { "g/dl": 1, "g/L": 0.1, "mmol/L": 1.611 },
    sane: { min: 8, max: 22 },
    infer: (v) => v > 30 ? "g/L" : "g/dL",
  },
  "plaquettes": {
    canonical: "10⁹/L",
    factors: { "10⁹/l": 1, "10*9/L": 1, "g/L": 1, "/μL": 0.001, "/uL": 0.001, "/mm³": 0.001, "/mm3": 0.001 },
    sane: { min: 50, max: 1000 },
    infer: (v) => v > 5000 ? "/μL" : "10⁹/L",
  },
  "leucocytes": {
    canonical: "10⁹/L",
    factors: { "10⁹/l": 1, "10*9/L": 1, "g/L": 1, "/μL": 0.001, "/uL": 0.001, "/mm³": 0.001 },
    sane: { min: 1.5, max: 30 },
    infer: (v) => v > 1000 ? "/μL" : "10⁹/L",
  },
  "hematies": {
    canonical: "10¹²/L",
    factors: { "10¹²/l": 1, "10*12/L": 1, "T/L": 1, "M/μL": 1 },
    sane: { min: 2, max: 8 },
  },
  "asat-got": { canonical: "UI/L", sane: { min: 5, max: 500 } },
  "alat-gpt": { canonical: "UI/L", sane: { min: 5, max: 500 } },
  "ggt": { canonical: "UI/L", sane: { min: 5, max: 500 } },
  "phosphatases-alcalines": { canonical: "UI/L", sane: { min: 20, max: 500 } },
  "crp": { canonical: "mg/L", sane: { min: 0, max: 200 } },
  "crp-ultrasensible-hscrp": { canonical: "mg/L", sane: { min: 0, max: 50 } },
  "homocysteine": { canonical: "μmol/L", sane: { min: 2, max: 60 } },
  "fibrinogene": { canonical: "g/L", sane: { min: 1, max: 8 } },
  "magnesium-serique": {
    canonical: "mg/dL",
    factors: { "mg/dl": 1, "mmol/L": 2.43 },
    sane: { min: 1.0, max: 4.0 },
    infer: (v) => v < 1.5 ? "mmol/L" : "mg/dL",
  },
  "magnesium-erythrocytaire": {
    canonical: "mmol/L",
    factors: { "mmol/l": 1 },
    sane: { min: 1.0, max: 4.0 },
  },
  "calcium-serique": {
    canonical: "mg/L",
    factors: { "mg/l": 1, "mmol/L": 40, "mg/dL": 10 },
    sane: { min: 70, max: 130 },
    infer: (v) => v < 5 ? "mmol/L" : v < 30 ? "mg/dL" : "mg/L",
  },
  "selenium": { canonical: "μg/L", sane: { min: 30, max: 250 } },
  "zinc-serique": { canonical: "μg/dL", sane: { min: 50, max: 200 } },
  "ige-totales": { canonical: "UI/mL", sane: { min: 0, max: 5000 } },
  "psa": { canonical: "ng/mL", sane: { min: 0, max: 50 } },
  "psa-libre": { canonical: "ng/mL", sane: { min: 0, max: 5 } },
};

export function normalizeUnits(slug: string, value: number, unit: string | null): { value: number; unit: string } | null {
  const conv = TBL[slug];
  if (!conv) return { value, unit: unit ?? "" }; // unknown — pass through

  let resolvedUnit = unit ?? "";
  // Normalise a few unit string forms
  resolvedUnit = resolvedUnit.replace(/μ/g, "μ").replace(/µ/g, "μ").trim();

  // If unit captured and matches canonical or has a factor, use it
  let convertedValue = value;
  if (resolvedUnit && conv.factors && conv.factors[resolvedUnit] !== undefined) {
    convertedValue = value * conv.factors[resolvedUnit];
  } else if (resolvedUnit === conv.canonical) {
    // already canonical
  } else if (!resolvedUnit && conv.infer) {
    const inferred = conv.infer(value);
    if (inferred && conv.factors && conv.factors[inferred] !== undefined) convertedValue = value * conv.factors[inferred];
    else if (inferred === conv.canonical) convertedValue = value;
  } else if (resolvedUnit && conv.factors) {
    // Unit doesn't match — try infer from value
    if (conv.infer) {
      const inferred = conv.infer(value);
      if (inferred && conv.factors[inferred] !== undefined) convertedValue = value * conv.factors[inferred];
    }
  }

  // Sanity check
  if (conv.sane) {
    if (convertedValue < conv.sane.min || convertedValue > conv.sane.max) {
      // Try the other inference
      if (conv.infer) {
        const alt = conv.infer(value);
        if (alt && conv.factors && conv.factors[alt] !== undefined) {
          const altVal = value * conv.factors[alt];
          if (altVal >= conv.sane.min && altVal <= conv.sane.max) {
            return { value: altVal, unit: conv.canonical };
          }
        }
      }
      return null; // reject as garbage
    }
  }

  return { value: convertedValue, unit: conv.canonical };
}
