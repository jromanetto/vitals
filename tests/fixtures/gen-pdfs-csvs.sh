#!/usr/bin/env bash
# Generates text/PDF/CSV/note medical upload fixtures into tests/fixtures/uploads/.
# PDFs are produced from plain text via macOS cupsfilter (real, text-extractable PDFs).
set -euo pipefail
OUT="$(cd "$(dirname "$0")/uploads" && pwd)"
TMP="$(mktemp -d)"
mkpdf() { cupsfilter "$1" > "$2" 2>/dev/null; }

# 1. Clean blood panel (FR, full lab, ref ranges) — name => analyses-sang
cat > "$TMP/a.txt" <<'EOF'
LABORATOIRE D'ANALYSES MEDICALES — BILAN SANGUIN
Patient: Compte Test    Date de prelevement: 12/03/2026

LIPIDES
Cholesterol total: 2.15 g/L (1.50 - 2.00)
HDL: 0.55 g/L (> 0.40)
LDL: 1.40 g/L (0.00 - 1.60)
Triglycerides: 1.10 g/L (0.00 - 1.50)
Apo B: 0.95 g/L (0.50 - 1.30)

METABOLISME
Glycemie: 0.98 g/L (0.74 - 1.06)
HbA1c: 5.4 % (4.0 - 6.0)
Insuline: 6.2 mUI/L (2.6 - 24.9)

THYROIDE
TSH: 1.85 mUI/L (0.27 - 4.20)
T4 libre: 14.2 pmol/L (12.0 - 22.0)

FER / INFLAMMATION / VITAMINES
Ferritine: 95 ng/mL (30 - 400)
CRP ultra sensible: 0.8 mg/L (< 5.0)
Vitamine D: 32 ng/mL (30 - 100)
Vitamine B12: 410 pmol/L (138 - 652)
Magnesium: 0.85 mmol/L (0.66 - 1.07)
EOF
mkpdf "$TMP/a.txt" "$OUT/bilan-sanguin-clean.pdf"

# 2. Messy / OCR-like blood panel — labels and values broken across lines, no ref ranges
cat > "$TMP/b.txt" <<'EOF'
ANALYSE  LABO   scan OCR

Cholesterol
total    2,45
g/L
LDL1,72g/L
HDL
0,48 g/L
Triglycerides 2,10 g/L
Glycemie   1,12   g/L
HbA1c 5,9%
Ferritine
58 ng/mL
TSH 3,10 mUI/L
EOF
mkpdf "$TMP/b.txt" "$OUT/analyse-labo-messy.pdf"

# 3. Consultation report (no biomarkers) — name => consultations
cat > "$TMP/c.txt" <<'EOF'
COMPTE-RENDU DE CONSULTATION
Medecin: Dr. Martin    Date: 05/02/2026

Motif: bilan annuel de prevention.
Examen clinique sans particularite. Tension arterielle 125/80 mmHg.
Patient en bonne sante generale. Poursuite de l'activite physique reguliere.
Recommandation: controle lipidique dans 6 mois, supplementation vitamine D l'hiver.
Aucun traitement medicamenteux en cours.
EOF
mkpdf "$TMP/c.txt" "$OUT/compte-rendu-consultation.pdf"

# 4. Imaging report — name => imagerie
cat > "$TMP/d.txt" <<'EOF'
COMPTE-RENDU D'IMAGERIE — IRM CEREBRALE
Date: 20/01/2026

Technique: sequences T1, T2, FLAIR, diffusion.
Resultat: parenchyme cerebral d'aspect normal. Pas de lesion focale.
Systeme ventriculaire de taille normale. Absence d'anomalie de signal.
Conclusion: IRM cerebrale sans anomalie decelable.
EOF
mkpdf "$TMP/d.txt" "$OUT/irm-cerebrale.pdf"

# 5. Neutral-named PDF but blood content => content-based switch to analyses-sang
cat > "$TMP/e.txt" <<'EOF'
RAPPORT 2026-04-02
Cholesterol total: 1.95 g/L
LDL: 1.20 g/L
HDL: 0.62 g/L
Glycemie: 0.91 g/L
Ferritine: 120 ng/mL
EOF
mkpdf "$TMP/e.txt" "$OUT/rapport-2026-04.pdf"

# --- Wearables CSV ---
# 6. Whoop physiological cycles (FR)
cat > "$OUT/whoop_physiological_cycles.csv" <<'EOF'
Heure de début du cycle,Score de récupération (%),Variabilité de la fréquence cardiaque (ms),Fréquence cardiaque au repos (bpm),Effort du jour
2026-01-10 06:30:00,68,82,52,12.4
2026-01-11 06:25:00,74,91,50,9.8
2026-01-12 06:40:00,55,64,55,15.1
EOF

# 7. Whoop sleeps (FR)
cat > "$OUT/whoop_sleeps.csv" <<'EOF'
Heure de début du cycle,Performance sommeil (%),Durée du sommeil paradoxal (min),Durée du sommeil profond (min),Efficacité du sommeil (%)
2026-01-10 23:30:00,88,95,72,91
2026-01-11 23:10:00,79,80,65,86
EOF

# 8. Oura trends
cat > "$OUT/oura_trends.csv" <<'EOF'
date,Average resting heart rate,Average HRV,Readiness score,Total sleep duration
2026-02-01,51,78,82,27000
2026-02-02,53,71,75,25200
EOF

# 9. Generic CSV
cat > "$OUT/generic-metrics.csv" <<'EOF'
date,weight_kg,steps,vo2max
2026-03-01,74.2,8200,48
2026-03-02,74.0,11050,48
EOF

# --- Notes / other ---
# 10. Markdown note => knowledge-base
cat > "$OUT/note-symptomes.md" <<'EOF'
# Notes personnelles

Fatigue matinale depuis 2 semaines. Amelioration apres prise de magnesium le soir.
Objectif: optimiser le sommeil profond et la recuperation Whoop.
EOF

# 11. Spreadsheet (binary-ish) => divers (filename detection)
printf 'PK\x03\x04 fake-xlsx placeholder for detection test' > "$OUT/tableur-suivi.xlsx"

# 12. Unknown type => divers
printf 'binary blob of unknown medical device export\x00\x01\x02' > "$OUT/export-inconnu.dat"

rm -rf "$TMP"
echo "Generated text/PDF/CSV/note fixtures in $OUT"
