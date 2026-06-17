#!/usr/bin/env bash
# End-to-end upload bench: logs into a local dev server and uploads every
# fixture through the real /api/upload/auto route, printing detection + status.
#
# Prereqs: `npm run dev` running on :3015 with a local account in data/auth.json
#   node scripts/init_auth.mjs test@local.dev Test1234!
#
# DNA note: ingestDnaForUser ingests the FIRST genome file in genetique/, so the
# bench clears data/u/1/genetique between DNA formats to test each in isolation.
set -euo pipefail
BASE="${BASE:-http://localhost:3015}"
DIR="$(cd "$(dirname "$0")/uploads" && pwd)"
JAR="$(mktemp)"
curl -s -c "$JAR" -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"test@local.dev","password":"Test1234!"}' >/dev/null
fmt() { python3 -c "import sys,json;d=json.load(sys.stdin)['results'][0];print(f\"{d['detected']:<14} | {d['status']:<7} | {d.get('message','')}\")"; }
up() { printf "%-36s -> " "$1"; curl -s -b "$JAR" -X POST "$BASE/api/upload/auto" -F "files=@$DIR/$1" | fmt; }

for f in bilan-sanguin-clean.pdf analyse-labo-messy.pdf compte-rendu-consultation.pdf \
         irm-cerebrale.pdf rapport-2026-04.pdf resultat-labo.png \
         whoop_physiological_cycles.csv whoop_sleeps.csv oura_trends.csv generic-metrics.csv \
         note-symptomes.md tableur-suivi.xlsx export-inconnu.dat; do up "$f"; done

for f in genome_Test_v5_Full_20260101.txt genome_Test_v5.zip AncestryDNA.txt; do
  rm -rf data/u/1/genetique; sleep 1; up "$f"
done
rm -f "$JAR"
