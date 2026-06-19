# P0 BLOCKER — Isolation des données médicales par compte (multi-tenancy server-side)

**Bloque l'ouverture beta.** Exposition PHI live (noelly, id 1000 voit le dossier de Julien).
Découvert au QA onboarding du 2026-06-04 → `.gstack/qa-reports/qa-report-onboarding-2026-06-04.md`.

## Root cause
Routes API scopées par `user_id` (OK), mais les **server components** lisent la DB en
direct sans filtre. Toutes les tables santé ont déjà `user_id` en prod → **fix app-only,
aucune migration, aucun backfill**.

## Changements
- [ ] `lib/scoring/longevity.ts` — `computeLongevityScore(userId)` : scoper les 4 requêtes (biomarker latest, dna_insight, profile, trends).
- [ ] `app/(app)/dashboard/page.tsx` — `getStats(userId)` (4 counts) + `computeLongevityScore(userId)`.
- [ ] `app/(app)/reports/[id]/page.tsx` — IDOR : `WHERE id = ? AND user_id = ?` → notFound().
- [ ] `app/(app)/files/[id]/page.tsx` — IDOR : idem.
- [ ] `app/(app)/biomarkers/[slug]/page.tsx` — `FROM biomarker ... AND user_id = ?`.
- [ ] `app/(app)/dna/[category]/page.tsx` — `FROM dna_insight ... AND user_id = ?`.
- [ ] `app/(app)/symptoms/[key]/page.tsx` — biomarker + symptom_log scopés.
- [ ] `app/(app)/data/profile/page.tsx` — `schema.profile` scopé.
- [ ] `app/(app)/data/profile/family/page.tsx` — `schema.profile` scopé.

## Vérif
- [ ] `npm run build` exit 0 + `npm run lint`.
- [ ] Régression locale : user B vide → dashboard/score/stats vides ; `/reports/<id de A>` = 404.
- [ ] Re-QA prod post-deploy : nouvel inscrit ne voit aucune donnée de l'owner.

## STATUS : fix déployé 2026-06-04 (commit 8b3d167) + re-QA prod OK
Fresh user → Données indexées 0/0/0, score = fallback neutre 40 (pas le 74 de l'owner).
Fuite live (noelly) fermée. Health-check 200.

## Lot 2 — balayage complet + fixes (commit 4a9ca22, déployé + re-QA OK 2026-06-04)
Balayage de toutes les routes/scripts touchant une table user. 6 paths fixés :
- ✅ `reports/generate` + `doctor-pack` : INSERT stampe `report.user_id` (était défaut 1) ;
  `gen-report.mjs`/`gen-doctor-pack.mjs` dérivent userId du report et scopent toutes les lectures.
- ✅ `memory` : chat_memory GET/PATCH/DELETE/POST scopés (fuyait les mémoires medical_history).
- ✅ `supplements/log` : read/write/delete scopés.
- ✅ `nutrition/prefs` : POST ne fait plus `DELETE FROM nutrition_pref` global (destructif).
- ✅ `profile/auto-extract/apply` : lecture profil scopée + INSERT user_id + chat_memory scopé.
Re-QA prod : fresh user → memory 0 / nutri DEFAULT / supp 0 ; POST nutri vegan → 1 row user-scopé,
les 32 chat_memory de Julien intacts. Build vert, scripts node --check OK.

## Vérifié déjà sûr (pas de fix nécessaire)
- `/api/files/[id]`, `/api/reports/[id]/status`, `/api/reports/welcome` — scopés.
- `/api/chat/*` (chat principal + sessions) — entièrement scopés + ownership checks.
- `weekly_symptom`/`weekly_habit` (pas de user_id) — safe via FK parent `weekly_checkin(user_id)`.

## Reste (low-risk, hors beta immédiate)
- `scripts/ingest.ts` : CLI owner, INSERT défaut user_id 1 — OK tant que seul l'owner ingère en CLI.
  À scoper si l'ingest devient multi-user.
- `data/profile.md` : fichier miroir disque partagé (écrit par /api/profile et auto-extract/apply),
  non servi aux users, gitignored. Owner-voit-sur-disque. À cloisonner par user si besoin.
- UX mineure : score 40 affiché pour un user vide (fallback) — préférer "—" / CTA.
