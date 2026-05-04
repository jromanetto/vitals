# Vitals — Personal Health Intelligence Platform

🔗 **Live:** https://vitals.blueproject.org
📦 **Repo:** https://github.com/jromanetto/vitals

A self-hosted, AI-powered platform that aggregates 15+ years of personal health data — blood tests, DNA, consultations, knowledge notes — into a single dashboard with reports, search, chat and trackers.

## Features

### Data ingestion
- **PDF parser** for blood test reports (Cerba, Synlab, CHIREC, LIMS, SHA Wellness, CEF, Enzo, Laboratoire Médical) with unit normalization (mmol/L ↔ mg/dL ↔ g/L) and sanity validation
- **23andMe raw genome** parser with 160+ curated SNP catalog covering 10 categories (longevity, cardio, metabolism, nutrition, fitness, cognition, hormones, immunity, detox, carriers)
- **Wearables CSV import** — Oura, Whoop, generic CSV
- **Profile import via Claude** — paste a doctor's letter, fields auto-extracted

### Analytics
- **Vitals Longevity Score 0-100** — 40% biomarkers in optimal range + 25% DNA + 20% lifestyle + 15% trends
- **Spearman correlations** between symptoms × biomarkers / habits / supplements / wearables
- **Trend sparklines** on dashboard (LDL, HbA1c, ferritine, vit D, hsCRP, TSH, testo, homocystéine)
- **Per-biomarker AI commentary** cached 30 days
- **DNA risk gauges** per category

### AI
- **11 report kinds** (overview, cardiovascular, metabolic, longevity, nutrition, cognition, hormonal, inflammation, dna-deep-dive, next-bloodwork-prep, supplement-recommendations) + Doctor Pack
- **AI chat** with streaming SSE, persisted sessions, RAG context (profile + biomarkers + DNA + KB chunks)
- **RAG hybride** BM25 + Claude rerank
- **Auto-naming** sessions via Claude

### Trackers
- **Supplements** with daily checklist, 90-day adherence heatmap, AI suggestions based on biomarkers out-of-range, drug-supplement interaction checker (11 rules)
- **Symptoms diary** with 60-day heatmap (energy, mood, focus, sleep, gut, skin, anxiety, libido, HRV)
- **Habits** with 7 daily checks, streak counter, 60-day heatmap

### Nutrition
- **Personalized food recommendations** — `/nutrition` page driven by 35 biomarker rules + 35 DNA rules, hybrid rules-engine + Claude synthesis
- **Diet pattern picker** — 10 patterns (Mediterranean, MIND, low-carb, DASH, anti-inflammatory, low-FODMAP, ...) auto-selected from data + user prefs
- **Tabs UI** : overview (rationale + macros) · favor (grouped by benefit) · avoid (grouped by reason) · meal ideas · sources (linked to source biomarker/SNP)
- **Inline prefs panel** : diet type, allergies, aversions, budget, favourite cuisines — persisted in `nutrition_pref` table
- **30-day cache** keyed on data + prefs hash via `report` table, force-regen button

### UX
- **Cmd-K command palette** searching biomarkers / DNA / reports / files / pages
- **PDF inline viewer** with extracted biomarkers sidebar
- **Family pedigree** edit + SVG visualization (3 generations color-coded by risk)
- **Notes everywhere** with tags, /notes index, search
- **Dark/light mode toggle**, mobile sidebar, accessibility (skip link, focus rings, aria-labels)
- **Apple-meets-medical aesthetic** — Framer Motion animations, glass effects, Tailwind v3

## Stack

- **Next.js 15** App Router · **React 19** · **TypeScript strict**
- **Tailwind v3** + shadcn pattern + **Framer Motion** + **Recharts** + **lucide-react**
- **Drizzle ORM** + **better-sqlite3** (`data/vitals.db`)
- **iron-session** auth (`data/auth.json` — bcrypt + secret)
- **Anthropic SDK** (claude-sonnet-4-5-20250929)
- **pdf-parse** for PDFs
- **next-themes** for dark/light
- **PM2** + **Nginx** + **Let's Encrypt**
- **GitHub Actions** auto-deploy

## Architecture

```
app/
  (app)/              # auth-required routes share Sidebar+TopBar
    page.tsx          # Dashboard with Vitals Score + sparklines + wearable widget
    biomarkers/       # list + [slug] detail with timeline, AI commentary, notes
    dna/              # categories + [category] traits with risk gauges
    reports/          # 11 kinds + Doctor Pack
    timeline/, knowledge/, chat/, supplements/, symptoms/, habits/
    correlations/, notes/, files/[id]/, import/, profile/
  api/                # 25+ endpoints
  login/, layout.tsx, globals.css
components/           # 30+ components
lib/
  db/ {index,schema,migrate}
  parsers/ {pdf,biomarkers,dna23,interactions,normalize-units}
  scoring/ {longevity,correlations}
  rag/ {search}
  dna/ {catalog, extra-catalog}
  biomarker-meta.ts   # optimal/longevity ranges
  auth.ts, secrets.ts, markdown.ts, utils.ts
scripts/
  ingest.ts           # PDF + DNA ingest pipeline
  gen-report.mjs      # standalone Anthropic report generator (detached)
  gen-doctor-pack.mjs # Doctor Pack standalone
  init_auth.mjs, gen_env.mjs
```

## Data flow

```
PDFs (15y bilan) ─┐
23andMe (.zip) ───┼─→ scripts/ingest.ts ─→ data/vitals.db ─→ UI/AI
Knowledge MDs ────┘                           ↑
                                              │
Profile form ─→ /api/profile ─────────────────┤
Symptoms/Habits ─→ /api/* ────────────────────┤
Supplements ─→ /api/supplements ──────────────┤
Wearables CSV ─→ /api/wearables ──────────────┘
```

## Deploy

```bash
git push origin main
# GitHub Actions → SSH to VPS → npm ci → npm run build → pm2 restart vitals
```

## Local dev

```bash
git clone https://github.com/jromanetto/vitals
cd vitals
npm ci
node scripts/init_auth.mjs    # creates data/auth.json with email + bcrypt + secret
# add anthropicApiKey to data/auth.json
npm run dev                   # http://localhost:3015
npm run ingest                # process data/ folder
```

## Database backup / export

`/api/export` (auth required) returns a single JSON snapshot of all data (profile, biomarkers, DNA insights, supplements, symptoms, habits, wearables, notes, reports). Use it for backup or migration.

## Privacy

- All data lives on your own VPS
- Auth credentials in `data/auth.json` (chmod 600), never in `.env` (Next.js dotenv-expand mangles bcrypt `$`)
- Anthropic API key also in `data/auth.json`
- Health data (`data/`) is gitignored — never committed to repo
- HTTPS via Let's Encrypt

## Web push notifications

VAPID keys live in `data/auth.json` (`vapidPublicKey`, `vapidPrivateKey`,
`vapidSubject`). To regenerate: `npx web-push generate-vapid-keys --json` and
merge into `auth.json` (don't overwrite the file).

Subscriptions are stored in the `push_subscription` SQLite table. Users opt in
from `/profile/security` ("Notifications push" panel) — the browser registers
`/sw.js`, asks permission, then POSTs the subscription to `/api/push/subscribe`.
Test pushes go through `/api/push/test`.

To deliver reminder pushes, run the cron (hourly):

```cron
0 * * * * cd /home/script/vitals && node scripts/send_reminders.mjs >> logs/reminders-cron.log 2>&1
```

The script sends a push for every reminder due within the next 24h that is not
done and not yet notified, then sets `reminder.notified_at` to dedupe. Expired
endpoints (HTTP 410/404) are pruned automatically.

## License

MIT — built for personal use, fork freely.
