// Short, human-friendly explanations (2-3 lines max) for biomarkers — used in HelpPill tooltips.
// Keep deliberately vulgarized; the chat can dive deeper.

export const BIOMARKER_EXPLANATIONS: Record<string, string> = {
  // Lipids / cardio
  "cholesterol-total": "Cholestérol total dans le sang — peu informatif seul. Ce qui compte, c'est la répartition entre LDL (à surveiller) et HDL (protecteur).",
  "ldl": "Le « mauvais » cholestérol — quand il y en a trop, il s'accumule dans les artères. Cible longévité < 70 mg/dL.",
  "hdl": "Le « bon » cholestérol — il nettoie les artères. Idéalement entre 50 et 100 mg/dL chez l'homme.",
  "non-hdl": "Cholestérol total moins HDL = tout ce qui est potentiellement athérogène. Plus utile que le LDL seul.",
  "triglycerides": "Graisses circulantes dans le sang — marqueur clé d'insulinorésistance. Cible < 80 mg/dL pour la longévité.",
  "apo-b": "Compte les particules athérogènes (LDL + VLDL + IDL + Lp(a)). Meilleur prédicteur cardio que le LDL seul.",
  "apo-a1": "Composante principale du HDL. Ratio ApoB/ApoA1 = puissant prédicteur de risque cardiovasculaire.",
  "lp-a": "Lipoprotéine(a) — déterminée génétiquement. Si > 50 mg/dL = risque cardio majoré (à mesurer une fois dans la vie).",
  "index-omega-3": "Pourcentage d'EPA+DHA dans tes globules rouges. < 4% = risque cardio. > 8% = optimal.",

  // Metabolic
  "glycemie": "Glucose à jeun. > 1.00 g/L = pré-diabète. Cible longévité 0.75-0.90 g/L.",
  "hba1c": "Moyenne glycémique sur 3 mois. > 5.7% = pré-diabète. Cible longévité < 5.2%.",
  "insuline": "Insuline à jeun. > 10 = insulinorésistance. Cible longévité < 6 µUI/mL (Bryan Johnson).",
  "homa-ir": "Indice de résistance à l'insuline (Glucose × Insuline / 22.5). < 1.0 optimal, > 2.5 résistance.",

  // Thyroid
  "tsh": "Hormone qui pilote la thyroïde. Range labo 0.4–4.5 trop large — l'optimum fonctionnel est 1–2.",
  "t3-libre": "Forme active de l'hormone thyroïdienne. Plus pertinent que la T4 pour ton métabolisme cellulaire.",
  "t4-libre": "Forme de stockage de l'hormone thyroïdienne. Convertie en T3 par le foie/rein selon les besoins.",
  "anti-tpo": "Anti-corps anti-thyroïdiens. Élevés = thyroïdite auto-immune (Hashimoto).",

  // Hormones
  "testosterone-totale": "Hormone androgène totale. Optimum fonctionnel masculin > 5.5 ng/mL. Influence libido, force, mood.",
  "testosterone-libre": "Fraction biodisponible de la testostérone — plus pertinente chez l'homme âgé. Calculée via SHBG.",
  "shbg": "Sex Hormone Binding Globulin. Trop haute = testostérone libre faible. Influencée par l'insuline.",
  "œstradiol": "Œstrogène principal. Important même chez l'homme (libido, peau, os, mood).",
  "estradiol": "Œstrogène principal. Important même chez l'homme (libido, peau, os, mood).",
  "dhea-s": "Précurseur stéroïdien — marqueur de jeunesse hormonale. Décline naturellement avec l'âge.",
  "igf-1": "Marqueur de la GH. Trade-off longévité : trop bas = sarcopénie, trop haut = cancer.",
  "cortisol": "Hormone du stress. Pic le matin, creux le soir. Élevé en chronique = catabolisme + sommeil dégradé.",

  // Liver
  "alat-gpt": "Enzyme hépatique. Élevée = stress hépatique (NAFLD, alcool, médicaments).",
  "asat-got": "Enzyme hépatique + musculaire. Ratio ASAT/ALAT > 1 peut suggérer un problème alcool.",
  "ggt": "Enzyme hépatique sensible — alcool, médicaments, stéatose. Bon marqueur précoce.",
  "bilirubine": "Pigment du foie. Légèrement élevé sans symptôme = souvent maladie de Gilbert (bénin).",

  // Kidneys
  "creatinine": "Marqueur de la fonction rénale. Combiné à l'âge → eGFR (taux de filtration).",
  "uree": "Urée sanguine — produit du métabolisme protéique éliminé par les reins.",
  "egfr": "Taux de filtration glomérulaire estimé. > 90 mL/min = bonne fonction rénale.",

  // Blood
  "hemoglobine": "Transporteur d'oxygène dans les globules rouges. Bas = anémie ; haut = déshydratation/polyglobulie.",
  "ferritine": "Réserves de fer + marqueur d'inflammation. Cible 70-150 ng/mL chez l'homme adulte.",
  "fer-serique": "Fer circulant à un instant T — fluctue beaucoup. La ferritine et la saturation sont plus pertinentes.",
  "saturation-transferrine": "% de transferrine saturée par le fer. > 45% = surcharge possible (hémochromatose).",

  // Inflammation
  "crp-ultrasensible-hscrp": "Inflammation chronique de bas grade. Cible < 0.5 mg/L. > 1 = signal cardio + métabolique.",
  "vs": "Vitesse de sédimentation — inflammation non spécifique. Élevée = infection ou maladie inflammatoire.",
  "homocysteine": "Marqueur de méthylation. Élevée = carence B9/B12/B6 ou MTHFR. Risque cardio + cognitif.",

  // Vitamins
  "vitamine-d-25-oh": "Vitamine D circulante — clé pour os, immunité, mood. Cible 40-80 ng/mL.",
  "vitamine-b12": "B12 sérique — neurologie, hématopoïèse, méthylation. Cible > 500 pg/mL (range labo trop large).",
  "holotranscobalamine-active-b12": "Forme active de la B12 (~20%). Plus précise que la B12 totale pour détecter une carence.",
  "folates-b9": "B9 sérique — méthylation, ADN, neurotransmetteurs. Cible 10-25 ng/mL.",
  "folates-erythrocytaires": "B9 dans les globules rouges — reflet sur 3 mois (plus stable que sérique).",
  "vitamine-b6": "B6 — cofacteur de + de 100 enzymes. Cible 30-100 nmol/L.",

  // Minerals
  "magnesium-erythrocytaire": "Magnésium intra-cellulaire — bien plus précis que le magnésium sérique (carence cachée).",
  "magnesium-serique": "Magnésium sanguin — peu sensible (corps maintient le sérique aux dépens des stocks).",
  "selenium": "Cofacteur thyroïde + antioxydant majeur. Cible 100-150 µg/L.",
  "zinc-serique": "Immunité, peau, testostérone. Cible > 100 µg/dL.",
  "calcium-serique": "Calcium sanguin — strictement régulé. Variations = problème (PTH, vit D, rein).",
  "potassium": "Électrolyte clé pour cœur et muscles. Range étroit (3.5-5.0 mmol/L).",
};
