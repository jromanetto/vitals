# Upload fixtures & bench

Synthetic (non-real) medical documents covering every type the auto-upload
route (`/api/upload/auto`) detects, used to test ingestion end-to-end.

## Regenerate fixtures
```bash
bash tests/fixtures/gen-pdfs-csvs.sh      # PDFs (via cupsfilter), CSVs, notes
node --import tsx tests/fixtures/gen-dna-image.mjs   # 23andMe txt+zip, AncestryDNA, PNG
```

## Run the bench (against local dev)
```bash
node scripts/init_auth.mjs test@local.dev Test1234!
PORT=3015 npm run dev &
bash tests/fixtures/run-upload-bench.sh
```

## Coverage
| Fixture | Detected | Lands in |
|---|---|---|
| bilan-sanguin-clean.pdf | pdf-document | analyses-sang + 15 biomarkers |
| analyse-labo-messy.pdf | pdf-document | analyses-sang + biomarkers (OCR-like) |
| rapport-2026-04.pdf | pdf-document | analyses-sang (detected by content) |
| compte-rendu-consultation.pdf | pdf-document | consultations |
| irm-cerebrale.pdf | pdf-document | imagerie |
| resultat-labo.png | image | divers |
| whoop_physiological_cycles.csv | whoop-cycles | wearable_metric |
| whoop_sleeps.csv | whoop-sleep | wearable_metric |
| oura_trends.csv | oura-trends | wearable_metric |
| generic-metrics.csv | generic-csv | wearable_metric |
| note-symptomes.md | markdown-note | knowledge-base |
| tableur-suivi.xlsx | spreadsheet | divers |
| export-inconnu.dat | unknown | divers |
| genome_Test_v5_Full_*.txt | dna-23andme | genetique + insights |
| genome_Test_v5.zip | dna-23andme | genetique (unzip) + insights |
| AncestryDNA.txt | dna-23andme | genetique (5-col diplotype) + insights |
