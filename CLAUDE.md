# CLAUDE.md — Vitals

Personal health intelligence platform. Self-hosted, single-user, AI-grounded.

- **Live** : https://vitals.blueproject.org
- **Repo** : https://github.com/jromanetto/vitals
- **VPS** : `cursor@77.87.110.100` (alias SSH `dallas3`) — path `/home/script/vitals/`

---

## Stack

Next.js 15 App Router · React 19 · TypeScript strict · Tailwind v3 · shadcn pattern · Framer Motion · Recharts · lucide-react · Drizzle + better-sqlite3 · iron-session · Anthropic SDK (`claude-sonnet-4-5-20250929`) · pdf-parse · next-themes · web-push (VAPID).

Infra : PM2 + Nginx + Let's Encrypt · GitHub Actions auto-deploy on push `main`.

**Port dev** : `3015` (`npm run dev`) — bind `127.0.0.1` en prod.

---

## Hard rules (non-négociables)

- `/api/health-check` doit **toujours** retourner 200.
- Auth requise sur toutes les routes sauf `/login`, `/api/auth/*`, `/api/health-check`, `/static/*`.
- **Jamais** committer `data/` (PDFs, vitals.db, auth.json) — gitignored.
- **Jamais** mettre bcrypt ou Anthropic key dans `.env` (Next.js dotenv-expand mange les `$`) → `data/auth.json` chmod 600.
- `npm run build` doit exit 0 **avant** push.
- Vérifier le déploiement après push (curl health-check sur prod).
- **Atomic commits** : un changement cohérent par commit, pas d'emojis dans les messages.
- Préserver les APIs publiques (types, schemas, payloads) — breaking change = doc + plan migration.

---

## Workflow

### 0. Sync avant de bosser
- `git fetch origin` puis `git log HEAD..origin/main --oneline`
- Si derrière → `git pull` avant tout changement (multi-machines).
- **Jamais coder sur du code obsolète**.

### 1. Lire avant d'écrire
- `README.md`, `COMPLETE.md`, `ROADMAP.md`, `package.json`, `next.config.mjs`, `middleware.ts`
- Scan `lib/db/schema.ts` avant toute modif data.

### 2. Planifier avant de coder
- Tâche non-triviale (3+ étapes ou décision archi) → plan dans `tasks/todo.md` ou utilise `/superpowers:writing-plans`.
- Hypothèses explicites.

### 3. Implémenter en batch
- Diffs minimaux et ciblés, pas de refactor non demandé.
- Suivre les conventions existantes (Tailwind classes, Framer patterns, Drizzle schemas).

### 4. Vérifier avant de déclarer victoire
- `npm run build` ✅
- `npm run lint` ✅ (next lint)
- Smoke test manuel sur les routes touchées.
- UI : console zéro erreur rouge, network OK, responsive desktop + mobile.
- **Jamais dire "ça marche" sans preuve**.

### 5. Documenter + Action log
- Updater README/COMPLETE/ROADMAP si comportement ou setup change.
- Action log obligatoire en fin de message.

---

## Skills gstack à utiliser

Suite gstack disponible — utilise-les **proactivement** selon le contexte :

### Workflow & QA
- **`/gstack`** — browser headless rapide pour QA/dogfooding. Use systématiquement après changement UI.
- **`/qa`** — test + fix iteratif d'un flow web. Pour valider une feature complète.
- **`/qa-only`** — rapport bugs sans fix.
- **`/browse`** — navigation/screenshots ad-hoc.
- **`/canary`** — monitoring post-deploy (console errors, perf regressions).
- **`/benchmark`** — détection régressions perf via daemon browse.

### Design & UI
- **`/design-shotgun`** — explore plusieurs variantes design IA avant d'implémenter.
- **`/design-html`** — finaliser un mockup approuvé en HTML/CSS production.
- **`/design-review`** — audit visuel + fixes itératifs sur le live (avant `/ship`).
- **`/plan-design-review`** — design critique en plan mode.
- **`/design-consultation`** — design system from scratch / DESIGN.md.

### Code & Review
- **`/review`** — pre-landing PR review (SQL safety, LLM trust, side effects).
- **`/codex`** — second opinion via OpenAI Codex (review/challenge/consult).
- **`/cso`** — security audit (OWASP, STRIDE, secrets, supply chain).
- **`/investigate`** — debug systématique avec root cause (bugs / 500s / "ça marchait hier").
- **`/simplify`** — review code changé pour reuse/quality/efficiency.

### Plans
- **`/plan-ceo-review`** — challenge scope/ambition d'un plan.
- **`/plan-eng-review`** — lock-in archi/data flow/edge cases.
- **`/autoplan`** — pipeline review auto (CEO + design + eng).
- **`/office-hours`** — brainstorm idée avant code.

### Ship & Deploy
- **`/ship`** — workflow complet : tests → diff → CHANGELOG → commit → push → PR.
- **`/land-and-deploy`** — merge PR + attente CI + canary check (post-`/ship`).
- **`/setup-deploy`** — config déploiement (déjà fait pour ce projet : GitHub Actions → VPS).
- **`/document-release`** — sync docs après ship.

### Safety
- **`/careful`** — warnings sur commandes destructives (rm -rf, DROP TABLE, force-push).
- **`/freeze`** — restreindre edits à un dossier (debug).
- **`/guard`** — careful + freeze combinés (mode prod).

### Mémoire & retro
- **`/learn`** — gestion des learnings projet.
- **`/retro`** — retrospective hebdo des commits.

**Rule of thumb** : avant tout changement UI → `/design-shotgun` ou `/plan-design-review`. Avant tout merge → `/review` + `/qa`. Touche prod → `/guard`.

---

## Commandes courantes

```bash
# Local dev
npm ci
node scripts/init_auth.mjs       # crée data/auth.json (email + bcrypt + secret)
# ajouter anthropicApiKey dans data/auth.json
npm run dev                       # http://localhost:3015
npm run ingest                    # process data/ (PDFs + 23andMe + KB)

# Build & lint
npm run build
npm run lint

# Deploy (auto via GitHub Actions sur push main)
git push origin main
# → SSH cursor@VPS_HOST → cd /home/script/vitals → git reset --hard origin/main
# → npm ci → npm run build → pm2 restart vitals → curl health-check

# VPS direct
ssh cursor@77.87.110.100
cd /home/script/vitals
pm2 logs vitals
pm2 restart vitals
tail -f logs/reminders-cron.log
```

---

## Architecture (résumé)

```
app/
  (app)/              # routes auth-required, share Sidebar+TopBar
    page.tsx          # Dashboard : Vitals Score 0-100 + sparklines + wearable widget
    biomarkers/[slug] # timeline + AI commentary + notes
    dna/[category]    # SNP traits + risk gauges + notes
    reports/[id]      # 11 kinds + Doctor Pack (markdown rendered)
    timeline/, knowledge/, chat/, supplements/, symptoms/[key]/,
    habits/, correlations/, notes/, files/[id]/, import/, profile/{,family,import,security}
  api/                # 25+ endpoints (auth, biomarkers, chat SSE, ingest, reports, push, ...)
  login/, layout.tsx, globals.css

components/           # 30+ shadcn-pattern components

lib/
  db/      {index,schema,migrate}     # Drizzle + better-sqlite3, ensureSchema() idempotent
  parsers/ {pdf,biomarkers,dna23,interactions,normalize-units,wearables/*}
  scoring/ {longevity,correlations}    # Spearman, Vitals Score formula
  rag/     {search,embed}              # BM25 + Claude rerank
  dna/     {catalog,extra-catalog,compounds}
  biomarker-meta.ts                    # optimal/longevity ranges
  auth.ts, secrets.ts, markdown.ts, utils.ts

scripts/
  ingest.ts            # PDF + DNA + KB → vitals.db
  gen-report.mjs       # standalone Anthropic report (detached spawn, bypass CF 60s timeout)
  gen-doctor-pack.mjs
  init_auth.mjs, gen_env.mjs
  send_reminders.mjs   # cron horaire push notifications

data/                  # gitignored — vitals.db, auth.json (chmod 600), PDFs, KB
logs/                  # PM2 stdout/stderr + cron logs
```

---

## Patterns & gotchas connus

- **Anthropic key dans `data/auth.json`** (jamais `.env`) — Next.js dotenv-expand mange les `$` de bcrypt et de la key.
- **Async report generation** : `child_process.spawn` détaché → bypass Cloudflare 60s timeout, polled par client via `/api/reports/[id]/status`.
- **Unicode private-use placeholders** pour protéger codes biomarkers (B12, A1c, D3, K2, Q10, T3, T4) du splitting name+digit dans le parser.
- **2nd-pass literal alias scan** pour rattraper les misses du regex non-greedy.
- **Unit normalization** avec sanity ranges qui rejettent le garbage parser (LDL canonique en mg/dL, etc.).
- **Streaming SSE chat** avec persistence + auto-rename Claude (max 6 mots).
- **Idempotent migrations** via `ensureSchema()` à chaque request.
- **VAPID keys** dans `data/auth.json` (`vapidPublicKey/PrivateKey/Subject`). Régénérer : `npx web-push generate-vapid-keys --json` → merger (jamais overwrite).
- **Push reminders** : cron horaire `0 * * * * cd /home/script/vitals && node scripts/send_reminders.mjs`. Dedup via `reminder.notified_at`. Endpoints expirés (410/404) prunés auto.

---

## Style code

- Conventions du repo > opinions perso.
- Code "boring" lisible > clever.
- Identifiants **anglais**, commentaires FR ok.
- TypeScript **strict** — pas de `any` sauvage.
- Drizzle pour toute query DB (pas de SQL raw sauf migration).
- Tailwind v3 + shadcn pattern (utility-first, pas de CSS file).
- Framer Motion pour les animations entry/spring.
- Lucide pour les icônes (jamais d'image raster).

---

## Definition of Done

```
[ ] Sync git + contexte lu
[ ] Plan si tâche non-triviale
[ ] Changements minimaux et ciblés
[ ] Build ✅ Lint ✅
[ ] Smoke test manuel (décrire ce qui a été vérifié)
[ ] /qa ou /design-review si UI touchée
[ ] /review avant merge
[ ] Docs à jour (README/COMPLETE/ROADMAP) si nécessaire
[ ] Action log inclus
[ ] Health-check 200 sur prod après deploy
```

---

## Action Log (template)

```markdown
## Ce que j'ai fait
- ...

## Pourquoi
- ...

## Comment tester
- ...

## Impact & risque régression
- ...

## Prochaines étapes (optionnel)
- ...
```
