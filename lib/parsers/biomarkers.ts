import { slugify } from "@/lib/utils";

export type Biomarker = {
  name: string; slug: string; category: string;
  value: number; unit: string | null;
  refLow: number | null; refHigh: number | null;
  raw: string;
};

const ALIASES: Record<string, { canonical: string; category: string; unit?: string }> = {
  // ======================== HEMATOLOGY ========================
  "hb": { canonical: "Hémoglobine", category: "hematology", unit: "g/dL" },
  "hemoglobine": { canonical: "Hémoglobine", category: "hematology", unit: "g/dL" },
  "hématies": { canonical: "Hématies", category: "hematology", unit: "M/μL" },
  "hematies": { canonical: "Hématies", category: "hematology", unit: "M/μL" },
  "globules rouges": { canonical: "Hématies", category: "hematology", unit: "M/μL" },
  "hematocrite": { canonical: "Hématocrite", category: "hematology", unit: "%" },
  "hématocrite": { canonical: "Hématocrite", category: "hematology", unit: "%" },
  "hct": { canonical: "Hématocrite", category: "hematology", unit: "%" },
  "vgm": { canonical: "VGM", category: "hematology", unit: "fL" },
  "tcmh": { canonical: "TCMH", category: "hematology", unit: "pg" },
  "ccmh": { canonical: "CCMH", category: "hematology", unit: "g/dL" },
  "rdw": { canonical: "RDW", category: "hematology", unit: "%" },
  "idr": { canonical: "RDW", category: "hematology", unit: "%" },
  "leucocytes": { canonical: "Leucocytes", category: "hematology", unit: "/μL" },
  "globules blancs": { canonical: "Leucocytes", category: "hematology", unit: "/μL" },
  "polynucleaires neutrophiles": { canonical: "Neutrophiles", category: "hematology" },
  "polynucléaires neutrophiles": { canonical: "Neutrophiles", category: "hematology" },
  "neutrophiles": { canonical: "Neutrophiles", category: "hematology" },
  "lymphocytes": { canonical: "Lymphocytes", category: "hematology" },
  "monocytes": { canonical: "Monocytes", category: "hematology" },
  "eosinophiles": { canonical: "Éosinophiles", category: "hematology" },
  "éosinophiles": { canonical: "Éosinophiles", category: "hematology" },
  "polynucleaires eosinophiles": { canonical: "Éosinophiles", category: "hematology" },
  "basophiles": { canonical: "Basophiles", category: "hematology" },
  "polynucleaires basophiles": { canonical: "Basophiles", category: "hematology" },
  "plaquettes": { canonical: "Plaquettes", category: "hematology", unit: "/μL" },
  "thrombocytes": { canonical: "Plaquettes", category: "hematology", unit: "/μL" },
  "mpv": { canonical: "MPV (Volume plaquettaire moyen)", category: "hematology", unit: "fL" },
  "vpm": { canonical: "MPV (Volume plaquettaire moyen)", category: "hematology", unit: "fL" },
  "reticulocytes": { canonical: "Réticulocytes", category: "hematology", unit: "%" },
  "réticulocytes": { canonical: "Réticulocytes", category: "hematology", unit: "%" },

  // ======================== LIPIDS ========================
  "cholesterol total": { canonical: "Cholestérol total", category: "lipids", unit: "g/L" },
  "cholestérol total": { canonical: "Cholestérol total", category: "lipids", unit: "g/L" },
  "cholesterol": { canonical: "Cholestérol total", category: "lipids", unit: "g/L" },
  "hdl": { canonical: "HDL", category: "lipids", unit: "g/L" },
  "hdl-c": { canonical: "HDL", category: "lipids", unit: "g/L" },
  "hdl cholesterol": { canonical: "HDL", category: "lipids", unit: "g/L" },
  "ldl": { canonical: "LDL", category: "lipids", unit: "g/L" },
  "ldl-c": { canonical: "LDL", category: "lipids", unit: "g/L" },
  "ldl cholesterol": { canonical: "LDL", category: "lipids", unit: "g/L" },
  "triglycerides": { canonical: "Triglycérides", category: "lipids", unit: "g/L" },
  "triglycérides": { canonical: "Triglycérides", category: "lipids", unit: "g/L" },
  "apo a1": { canonical: "Apo A1", category: "lipids", unit: "g/L" },
  "apolipoproteine a1": { canonical: "Apo A1", category: "lipids", unit: "g/L" },
  "apolipoprotéine a1": { canonical: "Apo A1", category: "lipids", unit: "g/L" },
  "apo b": { canonical: "Apo B", category: "lipids", unit: "g/L" },
  "apolipoproteine b": { canonical: "Apo B", category: "lipids", unit: "g/L" },
  "apolipoprotéine b": { canonical: "Apo B", category: "lipids", unit: "g/L" },
  "lp(a)": { canonical: "Lp(a)", category: "lipids", unit: "mg/dL" },
  "lipoproteine(a)": { canonical: "Lp(a)", category: "lipids", unit: "mg/dL" },
  "lipoprotéine(a)": { canonical: "Lp(a)", category: "lipids", unit: "mg/dL" },
  "non-hdl": { canonical: "Non-HDL", category: "lipids", unit: "g/L" },
  "non hdl cholesterol": { canonical: "Non-HDL", category: "lipids", unit: "g/L" },
  "omega-3 index": { canonical: "Index Oméga-3", category: "lipids", unit: "%" },
  "indice omega 3": { canonical: "Index Oméga-3", category: "lipids", unit: "%" },

  // ======================== METABOLIC ========================
  "glycemie": { canonical: "Glycémie", category: "metabolic", unit: "g/L" },
  "glycémie": { canonical: "Glycémie", category: "metabolic", unit: "g/L" },
  "glucose": { canonical: "Glycémie", category: "metabolic", unit: "g/L" },
  "glucose a jeun": { canonical: "Glycémie", category: "metabolic", unit: "g/L" },
  "hba1c": { canonical: "HbA1c", category: "metabolic", unit: "%" },
  "hemoglobine glyquee": { canonical: "HbA1c", category: "metabolic", unit: "%" },
  "hémoglobine glyquée": { canonical: "HbA1c", category: "metabolic", unit: "%" },
  "insuline": { canonical: "Insuline", category: "metabolic", unit: "μUI/mL" },
  "insulinemie": { canonical: "Insuline", category: "metabolic", unit: "μUI/mL" },
  "homa": { canonical: "HOMA-IR", category: "metabolic" },
  "homa-ir": { canonical: "HOMA-IR", category: "metabolic" },
  "homa ir": { canonical: "HOMA-IR", category: "metabolic" },
  "fructosamine": { canonical: "Fructosamine", category: "metabolic", unit: "μmol/L" },
  "c-peptide": { canonical: "Peptide C", category: "metabolic", unit: "ng/mL" },
  "peptide c": { canonical: "Peptide C", category: "metabolic", unit: "ng/mL" },
  "leptine": { canonical: "Leptine", category: "metabolic", unit: "ng/mL" },
  "adiponectine": { canonical: "Adiponectine", category: "metabolic", unit: "μg/mL" },

  // ======================== THYROID ========================
  "tsh": { canonical: "TSH", category: "thyroid", unit: "μUI/mL" },
  "thyréostimuline": { canonical: "TSH", category: "thyroid", unit: "μUI/mL" },
  "t3l": { canonical: "T3 libre", category: "thyroid", unit: "pmol/L" },
  "t4l": { canonical: "T4 libre", category: "thyroid", unit: "pmol/L" },
  "ft3": { canonical: "T3 libre", category: "thyroid" },
  "ft4": { canonical: "T4 libre", category: "thyroid" },
  "free t3": { canonical: "T3 libre", category: "thyroid" },
  "free t4": { canonical: "T4 libre", category: "thyroid" },
  "t3 libre": { canonical: "T3 libre", category: "thyroid" },
  "t4 libre": { canonical: "T4 libre", category: "thyroid" },
  "rt3": { canonical: "T3 reverse (rT3)", category: "thyroid", unit: "ng/dL" },
  "t3 reverse": { canonical: "T3 reverse (rT3)", category: "thyroid", unit: "ng/dL" },
  "anti-tpo": { canonical: "Anti-TPO", category: "thyroid", unit: "UI/mL" },
  "anticorps anti-tpo": { canonical: "Anti-TPO", category: "thyroid", unit: "UI/mL" },
  "anti-tg": { canonical: "Anti-thyroglobuline", category: "thyroid", unit: "UI/mL" },
  "anticorps anti-thyroglobuline": { canonical: "Anti-thyroglobuline", category: "thyroid", unit: "UI/mL" },
  "thyroglobuline": { canonical: "Thyroglobuline", category: "thyroid", unit: "ng/mL" },

  // ======================== HORMONES (sex / adrenal / pituitary) ========================
  "testosterone totale": { canonical: "Testostérone totale", category: "hormones", unit: "ng/mL" },
  "testostérone totale": { canonical: "Testostérone totale", category: "hormones", unit: "ng/mL" },
  "testosterone": { canonical: "Testostérone totale", category: "hormones", unit: "ng/mL" },
  "testosterone libre": { canonical: "Testostérone libre", category: "hormones", unit: "pg/mL" },
  "testostérone libre": { canonical: "Testostérone libre", category: "hormones", unit: "pg/mL" },
  "testosterone biodisponible": { canonical: "Testostérone biodisponible", category: "hormones", unit: "ng/mL" },
  "shbg": { canonical: "SHBG", category: "hormones", unit: "nmol/L" },
  "estradiol": { canonical: "Œstradiol", category: "hormones", unit: "pg/mL" },
  "œstradiol": { canonical: "Œstradiol", category: "hormones", unit: "pg/mL" },
  "oestradiol": { canonical: "Œstradiol", category: "hormones", unit: "pg/mL" },
  "e2": { canonical: "Œstradiol", category: "hormones", unit: "pg/mL" },
  "progesterone": { canonical: "Progestérone", category: "hormones", unit: "ng/mL" },
  "progestérone": { canonical: "Progestérone", category: "hormones", unit: "ng/mL" },
  "dhea-s": { canonical: "DHEA-S", category: "hormones", unit: "μg/dL" },
  "dheas": { canonical: "DHEA-S", category: "hormones", unit: "μg/dL" },
  "dhea sulfate": { canonical: "DHEA-S", category: "hormones", unit: "μg/dL" },
  "cortisol": { canonical: "Cortisol", category: "hormones", unit: "nmol/L" },
  "cortisolemie": { canonical: "Cortisol", category: "hormones", unit: "nmol/L" },
  "acth": { canonical: "ACTH", category: "hormones", unit: "pg/mL" },
  "prolactine": { canonical: "Prolactine", category: "hormones", unit: "ng/mL" },
  "fsh": { canonical: "FSH", category: "hormones", unit: "UI/L" },
  "lh": { canonical: "LH", category: "hormones", unit: "UI/L" },
  "igf-1": { canonical: "IGF-1", category: "hormones", unit: "ng/mL" },
  "igf 1": { canonical: "IGF-1", category: "hormones", unit: "ng/mL" },
  "somatomedine c": { canonical: "IGF-1", category: "hormones", unit: "ng/mL" },
  "gh": { canonical: "GH (hormone de croissance)", category: "hormones", unit: "ng/mL" },
  "hormone de croissance": { canonical: "GH (hormone de croissance)", category: "hormones", unit: "ng/mL" },
  "aldosterone": { canonical: "Aldostérone", category: "hormones", unit: "pg/mL" },
  "renine": { canonical: "Rénine", category: "hormones", unit: "μUI/mL" },
  "rénine": { canonical: "Rénine", category: "hormones", unit: "μUI/mL" },
  "ngal": { canonical: "NGAL", category: "hormones", unit: "ng/mL" },

  // ======================== VITAMINS / MINERALS ========================
  "vitamine d": { canonical: "Vitamine D (25-OH)", category: "vitamins", unit: "ng/mL" },
  "25 oh vitamine d": { canonical: "Vitamine D (25-OH)", category: "vitamins", unit: "ng/mL" },
  "25-oh-vitamine d": { canonical: "Vitamine D (25-OH)", category: "vitamins" },
  "25(oh)d": { canonical: "Vitamine D (25-OH)", category: "vitamins" },
  "25 hydroxyvitamine d": { canonical: "Vitamine D (25-OH)", category: "vitamins" },
  "calcidiol": { canonical: "Vitamine D (25-OH)", category: "vitamins" },
  "1,25 oh2 vitamine d": { canonical: "Vitamine D (1,25-OH₂)", category: "vitamins", unit: "pg/mL" },
  "calcitriol": { canonical: "Vitamine D (1,25-OH₂)", category: "vitamins", unit: "pg/mL" },
  "vitamine b12": { canonical: "Vitamine B12", category: "vitamins", unit: "pg/mL" },
  "b12": { canonical: "Vitamine B12", category: "vitamins", unit: "pg/mL" },
  "cobalamine": { canonical: "Vitamine B12", category: "vitamins", unit: "pg/mL" },
  "holotranscobalamine": { canonical: "Holotranscobalamine (Active B12)", category: "vitamins", unit: "pmol/L" },
  "active b12": { canonical: "Holotranscobalamine (Active B12)", category: "vitamins", unit: "pmol/L" },
  "folates": { canonical: "Folates (B9)", category: "vitamins", unit: "ng/mL" },
  "vitamine b9": { canonical: "Folates (B9)", category: "vitamins", unit: "ng/mL" },
  "acide folique": { canonical: "Folates (B9)", category: "vitamins", unit: "ng/mL" },
  "vitamine a": { canonical: "Vitamine A (Rétinol)", category: "vitamins", unit: "μg/L" },
  "retinol": { canonical: "Vitamine A (Rétinol)", category: "vitamins", unit: "μg/L" },
  "vitamine e": { canonical: "Vitamine E (α-tocophérol)", category: "vitamins", unit: "mg/L" },
  "alpha tocopherol": { canonical: "Vitamine E (α-tocophérol)", category: "vitamins", unit: "mg/L" },
  "vitamine k": { canonical: "Vitamine K", category: "vitamins", unit: "ng/mL" },
  "vitamine c": { canonical: "Vitamine C", category: "vitamins", unit: "mg/L" },
  "vitamine b1": { canonical: "Vitamine B1 (Thiamine)", category: "vitamins", unit: "nmol/L" },
  "thiamine": { canonical: "Vitamine B1 (Thiamine)", category: "vitamins", unit: "nmol/L" },
  "vitamine b6": { canonical: "Vitamine B6", category: "vitamins", unit: "nmol/L" },
  "pyridoxine": { canonical: "Vitamine B6", category: "vitamins", unit: "nmol/L" },
  "coq10": { canonical: "CoQ10", category: "vitamins", unit: "μg/mL" },
  "coenzyme q10": { canonical: "CoQ10", category: "vitamins", unit: "μg/mL" },
  "magnesium": { canonical: "Magnésium sérique", category: "minerals", unit: "mg/dL" },
  "magnésium": { canonical: "Magnésium sérique", category: "minerals", unit: "mg/dL" },
  "magnesium erythrocytaire": { canonical: "Magnésium érythrocytaire", category: "minerals", unit: "mmol/L" },
  "magnésium érythrocytaire": { canonical: "Magnésium érythrocytaire", category: "minerals", unit: "mmol/L" },
  "zinc": { canonical: "Zinc sérique", category: "minerals", unit: "μg/dL" },
  "zinc serique": { canonical: "Zinc sérique", category: "minerals", unit: "μg/dL" },
  "selenium": { canonical: "Sélénium", category: "minerals", unit: "μg/L" },
  "sélénium": { canonical: "Sélénium", category: "minerals", unit: "μg/L" },
  "iode urinaire": { canonical: "Iode urinaire", category: "minerals", unit: "μg/L" },
  "calcium": { canonical: "Calcium sérique", category: "minerals", unit: "mg/L" },
  "calcium ionise": { canonical: "Calcium ionisé", category: "minerals", unit: "mmol/L" },
  "phosphore": { canonical: "Phosphore", category: "minerals", unit: "mg/L" },
  "potassium": { canonical: "Potassium", category: "minerals", unit: "mmol/L" },
  "sodium": { canonical: "Sodium", category: "minerals", unit: "mmol/L" },
  "chlorure": { canonical: "Chlorure", category: "minerals", unit: "mmol/L" },
  "bicarbonates": { canonical: "Bicarbonates", category: "minerals", unit: "mmol/L" },
  "mma": { canonical: "Acide méthylmalonique (MMA)", category: "vitamins", unit: "nmol/L" },
  "acide methylmalonique": { canonical: "Acide méthylmalonique (MMA)", category: "vitamins", unit: "nmol/L" },

  // ======================== IRON ========================
  "ferritine": { canonical: "Ferritine", category: "iron", unit: "ng/mL" },
  "fer": { canonical: "Fer sérique", category: "iron", unit: "μg/dL" },
  "fer serique": { canonical: "Fer sérique", category: "iron", unit: "μg/dL" },
  "transferrine": { canonical: "Transferrine", category: "iron", unit: "g/L" },
  "saturation transferrine": { canonical: "Saturation transferrine", category: "iron", unit: "%" },
  "coefficient saturation transferrine": { canonical: "Saturation transferrine", category: "iron", unit: "%" },
  "tibc": { canonical: "TIBC (capacité totale de fixation)", category: "iron", unit: "μg/dL" },
  "capacité totale de fixation": { canonical: "TIBC (capacité totale de fixation)", category: "iron", unit: "μg/dL" },
  "hepcidine": { canonical: "Hepcidine", category: "iron", unit: "ng/mL" },

  // ======================== KIDNEY ========================
  "creatinine": { canonical: "Créatinine", category: "kidney", unit: "mg/L" },
  "créatinine": { canonical: "Créatinine", category: "kidney", unit: "mg/L" },
  "uree": { canonical: "Urée", category: "kidney", unit: "g/L" },
  "urée": { canonical: "Urée", category: "kidney", unit: "g/L" },
  "azotemie": { canonical: "Urée", category: "kidney", unit: "g/L" },
  "dfg": { canonical: "DFG (filtration glomérulaire)", category: "kidney", unit: "mL/min" },
  "egfr": { canonical: "DFG (filtration glomérulaire)", category: "kidney", unit: "mL/min" },
  "ckd-epi": { canonical: "DFG (filtration glomérulaire)", category: "kidney", unit: "mL/min" },
  "cystatine c": { canonical: "Cystatine C", category: "kidney", unit: "mg/L" },
  "acide urique": { canonical: "Acide urique", category: "kidney", unit: "mg/L" },
  "uricemie": { canonical: "Acide urique", category: "kidney", unit: "mg/L" },
  "microalbuminurie": { canonical: "Microalbuminurie", category: "kidney", unit: "mg/24h" },
  "rapport albumine creatinine": { canonical: "Ratio Albumine/Créatinine urinaire", category: "kidney", unit: "mg/g" },

  // ======================== LIVER ========================
  "asat": { canonical: "ASAT (GOT)", category: "liver", unit: "UI/L" },
  "got": { canonical: "ASAT (GOT)", category: "liver", unit: "UI/L" },
  "ast": { canonical: "ASAT (GOT)", category: "liver", unit: "UI/L" },
  "alat": { canonical: "ALAT (GPT)", category: "liver", unit: "UI/L" },
  "gpt": { canonical: "ALAT (GPT)", category: "liver", unit: "UI/L" },
  "alt": { canonical: "ALAT (GPT)", category: "liver", unit: "UI/L" },
  "ggt": { canonical: "GGT", category: "liver", unit: "UI/L" },
  "gamma gt": { canonical: "GGT", category: "liver", unit: "UI/L" },
  "pal": { canonical: "Phosphatases alcalines", category: "liver", unit: "UI/L" },
  "phosphatases alcalines": { canonical: "Phosphatases alcalines", category: "liver", unit: "UI/L" },
  "alk": { canonical: "Phosphatases alcalines", category: "liver", unit: "UI/L" },
  "bilirubine totale": { canonical: "Bilirubine totale", category: "liver", unit: "mg/L" },
  "bilirubine directe": { canonical: "Bilirubine directe", category: "liver", unit: "mg/L" },
  "bilirubine conjuguee": { canonical: "Bilirubine directe", category: "liver", unit: "mg/L" },
  "albumine": { canonical: "Albumine", category: "liver", unit: "g/L" },
  "albuminemie": { canonical: "Albumine", category: "liver", unit: "g/L" },
  "proteines totales": { canonical: "Protéines totales", category: "liver", unit: "g/L" },
  "protéines totales": { canonical: "Protéines totales", category: "liver", unit: "g/L" },
  "ldh": { canonical: "LDH", category: "liver", unit: "UI/L" },
  "lipase": { canonical: "Lipase", category: "pancreas", unit: "UI/L" },
  "amylase": { canonical: "Amylase", category: "pancreas", unit: "UI/L" },

  // ======================== INFLAMMATION ========================
  "crp": { canonical: "CRP", category: "inflammation", unit: "mg/L" },
  "c reactive protein": { canonical: "CRP", category: "inflammation", unit: "mg/L" },
  "crp ultrasensible": { canonical: "CRP ultrasensible (hsCRP)", category: "inflammation", unit: "mg/L" },
  "hscrp": { canonical: "CRP ultrasensible (hsCRP)", category: "inflammation", unit: "mg/L" },
  "fibrinogene": { canonical: "Fibrinogène", category: "inflammation", unit: "g/L" },
  "fibrinogène": { canonical: "Fibrinogène", category: "inflammation", unit: "g/L" },
  "vs": { canonical: "VS (Vitesse de Sédimentation)", category: "inflammation", unit: "mm" },
  "vitesse de sedimentation": { canonical: "VS (Vitesse de Sédimentation)", category: "inflammation", unit: "mm" },
  "haptoglobine": { canonical: "Haptoglobine", category: "inflammation", unit: "g/L" },
  "homocysteine": { canonical: "Homocystéine", category: "cardiovascular", unit: "μmol/L" },
  "homocystéine": { canonical: "Homocystéine", category: "cardiovascular", unit: "μmol/L" },

  // ======================== CARDIOVASCULAR ========================
  "troponine": { canonical: "Troponine", category: "cardiovascular", unit: "ng/L" },
  "troponine ultrasensible": { canonical: "Troponine hs", category: "cardiovascular", unit: "ng/L" },
  "nt-probnp": { canonical: "NT-proBNP", category: "cardiovascular", unit: "pg/mL" },
  "ntprobnp": { canonical: "NT-proBNP", category: "cardiovascular", unit: "pg/mL" },
  "bnp": { canonical: "BNP", category: "cardiovascular", unit: "pg/mL" },
  "d-dimeres": { canonical: "D-dimères", category: "coagulation", unit: "ng/mL" },
  "d-dimères": { canonical: "D-dimères", category: "coagulation", unit: "ng/mL" },
  "ddimeres": { canonical: "D-dimères", category: "coagulation", unit: "ng/mL" },
  "tp": { canonical: "TP (Taux de prothrombine)", category: "coagulation", unit: "%" },
  "taux prothrombine": { canonical: "TP (Taux de prothrombine)", category: "coagulation", unit: "%" },
  "tca": { canonical: "TCA", category: "coagulation", unit: "s" },
  "inr": { canonical: "INR", category: "coagulation" },

  // ======================== AUTO-IMMUNE / IMMUNITY ========================
  "ige totales": { canonical: "IgE totales", category: "immunity", unit: "UI/mL" },
  "ige": { canonical: "IgE totales", category: "immunity", unit: "UI/mL" },
  "igg": { canonical: "IgG", category: "immunity", unit: "g/L" },
  "iga": { canonical: "IgA", category: "immunity", unit: "g/L" },
  "igm": { canonical: "IgM", category: "immunity", unit: "g/L" },
  "complement c3": { canonical: "Complément C3", category: "immunity", unit: "g/L" },
  "complement c4": { canonical: "Complément C4", category: "immunity", unit: "g/L" },
  "ana": { canonical: "Anticorps anti-nucléaires (ANA)", category: "immunity" },
  "anticorps anti-nucleaires": { canonical: "Anticorps anti-nucléaires (ANA)", category: "immunity" },
  "anti-ccp": { canonical: "Anti-CCP", category: "immunity", unit: "U/mL" },
  "facteur rhumatoide": { canonical: "Facteur Rhumatoïde", category: "immunity", unit: "UI/mL" },

  // ======================== NEURO / TUMOR MARKERS ========================
  "psa": { canonical: "PSA", category: "tumor", unit: "ng/mL" },
  "ps a libre": { canonical: "PSA libre", category: "tumor", unit: "ng/mL" },
  "psa libre": { canonical: "PSA libre", category: "tumor", unit: "ng/mL" },
  "ace": { canonical: "ACE (Antigène carcino-embryonnaire)", category: "tumor", unit: "ng/mL" },
  "ca 19-9": { canonical: "CA 19-9", category: "tumor", unit: "U/mL" },
  "ca 15-3": { canonical: "CA 15-3", category: "tumor", unit: "U/mL" },
  "afp": { canonical: "Alpha-fœtoprotéine (AFP)", category: "tumor", unit: "ng/mL" },
  "nse": { canonical: "NSE (Énolase neurono-spécifique)", category: "tumor", unit: "ng/mL" },
  "s100b": { canonical: "S-100B", category: "tumor", unit: "μg/L" },
  "s100b": { canonical: "S-100B", category: "tumor", unit: "μg/L" },
  // Prefixed forms found in Synlab/Cerba lab PDFs
  "cholesterol hdl": { canonical: "HDL", category: "lipids", unit: "g/L" },
  "cholesterol ldl": { canonical: "LDL", category: "lipids", unit: "g/L" },
  "cholesterol ldl calcule": { canonical: "LDL", category: "lipids", unit: "g/L" },
  "cholesterol ldl (calcule)": { canonical: "LDL", category: "lipids", unit: "g/L" },
  "cholesterol non hdl": { canonical: "Non-HDL", category: "lipids", unit: "g/L" },
  "25 hydroxy vitamine d": { canonical: "Vitamine D (25-OH)", category: "vitamins", unit: "ng/mL" },
  "25-hydroxy-vitamine d": { canonical: "Vitamine D (25-OH)", category: "vitamins", unit: "ng/mL" },
  "vitamine d3": { canonical: "Vitamine D (25-OH)", category: "vitamins", unit: "ng/mL" },
  "hba1c ngsp": { canonical: "HbA1c", category: "metabolic", unit: "%" },
  "hba1c ifcc": { canonical: "HbA1c IFCC", category: "metabolic", unit: "mmol/mol" },
  "hemoglobine glyquee": { canonical: "HbA1c", category: "metabolic", unit: "%" },
  "folates erythrocytaires": { canonical: "Folates érythrocytaires", category: "vitamins", unit: "ng/mL" },
  "index quicki": { canonical: "Index Quicki", category: "metabolic" },
  "chlorures": { canonical: "Chlorure", category: "minerals", unit: "mmol/L" },
  "estim. glycemie moyenne": { canonical: "Glycémie moyenne estimée", category: "metabolic", unit: "mg/dL" },
  "anti-thyroglobuline": { canonical: "Anti-thyroglobuline", category: "thyroid", unit: "UI/mL" },
};

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim();
}

const VALUE_LINE = /([A-Za-zÀ-ÿ()\-' /\.]{3,40}?)\s*[:\.]?\s+([0-9]+(?:[.,][0-9]+)?)\s*([a-zA-ZµμΩ%\/\.]+(?:\s*\/\s*[a-zA-Zµμ%]+)?)?\s*(?:[\(\[]?\s*(?:(?:<|>|≤|≥|inf|sup)\s*([0-9]+(?:[.,][0-9]+)?)|([0-9]+(?:[.,][0-9]+)?)\s*[-–à]\s*([0-9]+(?:[.,][0-9]+)?))\s*[\)\]]?)?/g;

export function parseBiomarkersFromText(text: string): Biomarker[] {
  const out: Biomarker[] = [];
  const seen = new Set<string>();
  const cleaned = text
    .replace(/[\r ]+/g, " ")
    .replace(/\n(?=\s*[0-9])/g, " ")
    .replace(/([a-zA-ZÀ-ÿ\)\]\%])([0-9])/g, "$1 $2")
    .replace(/(\d+\.\d+)(\d+\.\d+\s*[-–])/g, "$1 $2")
    .replace(/(\d{2,4})(\d{2,3}\s*[-–]\s*\d)/g, "$1 $2");
  for (const m of cleaned.matchAll(VALUE_LINE)) {
    const rawName = m[1].trim();
    if (rawName.length < 3) continue;
    const norm = normalize(rawName);
    const alias = ALIASES[norm];
    if (!alias) continue;
    const value = parseFloat(m[2].replace(",", "."));
    if (!Number.isFinite(value) || value > 1e9) continue;
    const unit = m[3]?.trim().replace(/\s+/g, "") || alias.unit || null;
    let refLow: number | null = null;
    let refHigh: number | null = null;
    if (m[5] && m[6]) {
      refLow = parseFloat(m[5].replace(",", "."));
      refHigh = parseFloat(m[6].replace(",", "."));
    }
    const slug = slugify(alias.canonical);
    const key = slug + ":" + value;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: alias.canonical, slug, category: alias.category, value, unit, refLow, refHigh, raw: m[0] });
  }
  return out;
}
