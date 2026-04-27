# Vitals — Build Complete

**Live:** https://vitals.blueproject.org · **Repo:** https://github.com/jromanetto/vitals

Personal health intelligence platform built across **20 autonomous overnight sprints** from a Next.js 15 + shadcn-style + Framer Motion foundation. Aggregates 15 years of blood-test PDFs, 23andMe raw DNA, knowledge-base notes, consultations, profile, supplements, symptoms, habits and wearables into a single dashboard with AI-grounded reports, chat, search and trackers.

## Stack
Next.js 15 App Router · React 19 · TypeScript strict · Tailwind v3 · Framer Motion · Recharts · Drizzle + better-sqlite3 · iron-session · Anthropic SDK (claude-sonnet-4-5-20250929) · pdf-parse · next-themes · lucide-react · PM2 + Nginx + Let's Encrypt · GitHub Actions deploy.

## Numbers
- **90 unique biomarkers** parsed from 30 PDFs (398 measurements, 15-year history) with unit normalization
- **160+ DNA catalog entries** spanning 10 categories — 138 personalised insights from 592,850 SNPs
- **11 AI report kinds** + Doctor Pack
- **12 supplement-suggestion rules** triggered by your latest biomarkers
- **11 drug-supplement interaction rules** with severity levels
- **9 symptoms** + **7 habits** tracked with 60-day heatmaps
- **4 wearable parsers** (Oura, Whoop, generic CSV, ready for Apple Health)
- **18 pages** + **20+ API endpoints**, all smoke-tested 200 OK

## All pages
1. `/` Dashboard — Vitals Score 0-100 (radial gauge) + breakdown + sparklines (8 key biomarkers) + wearable widget (HRV/RHR/sleep) + 4 stat cards
2. `/biomarkers` — sortable filtered table with status badges (lab/optimal/longevity tooltips)
3. `/biomarkers/[slug]` — timeline chart with 3 reference bands, AI commentary cached 30 days, optimal/longevity range pills, change %, notes inline
4. `/dna` — 10 category cards with risk gauges
5. `/dna/[category]` — detailed traits with rsid, genotype, magnitude, source URL, **inline notes per trait**
6. `/reports` — Doctor Pack hero + 11 kinds, async generation via detached child process, polling UI
7. `/reports/[id]` — markdown rendered, print-friendly
8. `/timeline` — chronological events from documents and reports
9. `/correlations` — Spearman ρ between symptoms × biomarkers / habits / supplements / wearables, filter pills, force/p-value
10. `/notes` — index of all notes with tag filters and content search
11. `/knowledge` — BM25 + Claude rerank, 7 category filters, term highlighting, links to PDF viewer
12. `/files/[id]` — inline PDF viewer with extracted biomarkers sidebar + **notes panel**
13. `/chat` — streaming SSE, persisted sessions, RAG context, auto-rename
14. `/supplements` — daily checklist, suggestions IA, adherence calendar 90j, **interactions checker**, modal create
15. `/symptoms` — daily entry, 60-day heatmap per symptom
16. `/habits` — daily checks (7 default), streaks 🔥, 60-day heatmap
17. `/import` — Oura/Whoop/generic CSV upload with summary
18. `/profile` — 12-section form, auto-save, completion %, `/profile/import` (paste medical letter), `/profile/family` (3-gen pedigree edit + SVG tree)

## All API endpoints
`/api/auth/{login,logout}`, `/api/health-check`, `/api/profile{,/import}`, `/api/biomarkers/latest`, `/api/biomarkers/[slug]/commentary`, `/api/sparklines`, `/api/dna`, `/api/correlations`, `/api/rag/search`, `/api/chat` (SSE), `/api/chat/sessions{,/[id]/messages}`, `/api/ingest`, `/api/reports/generate`, `/api/reports/doctor-pack`, `/api/reports/[id]/status`, `/api/files/[id]`, `/api/supplements{,/log,/suggestions}`, `/api/symptoms`, `/api/habits`, `/api/notes`, `/api/wearables`, `/api/interactions`, `/api/search`, `/api/export`.

## Cross-cutting features
- **Cmd-K command palette** searching biomarkers / DNA / reports / files / **notes** / supplements / pages
- **Light/dark mode toggle**
- **Mobile sidebar** (Sheet drawer) with hamburger
- **Generated SVG favicon** + error boundaries + 404
- **Accessibility** — skip-to-main link, focus-visible rings, aria-labels, sr-only utility, semantic landmarks
- **Print CSS** — clean PDF export hides chrome
- **Apple-meets-medical aesthetic** — rounded-xl, glass effect, framer-motion entry/spring animations everywhere

## Architecture highlights
- **Async report generation** via detached `child_process.spawn` (scripts/gen-report.mjs, gen-doctor-pack.mjs) — bypasses Cloudflare 60s timeout, polled by client
- **Unicode private-use placeholders** to protect biomarker codes (B12, A1c, D3, K2, Q10, T3, T4) from name+digit splitting in parser
- **2nd-pass literal alias scan** to catch non-greedy regex misses
- **Unit normalization** with sanity ranges rejecting parser garbage (LDL stored canonical mg/dL, etc.)
- **Streaming SSE chat** with persistence and auto-rename via Claude
- **Anthropic key in data/auth.json** (avoids Next.js dotenv-expand mangling bcrypt `$`)
- **Sources of truth**: Drizzle schema + ensureSchema() idempotent migrations on every request
- **JSON export** of full state for backup / migration

## Privacy & deploy
- All data on your own VPS at `/home/script/vitals/data/`
- HTTPS via Let's Encrypt
- Auth credentials + Anthropic key in `data/auth.json` (chmod 600), gitignored
- Health data (PDFs, vitals.db) gitignored — never committed
- GitHub Actions auto-deploys on push to main: SSH to VPS → `npm ci && npm run build && pm2 restart vitals`

## What's not built (left for the user to decide)
- Apple Health export.zip XML parser (skipped — requires user upload)
- Real-time wearable webhooks (Oura/Whoop polled via CSV is enough)
- Multi-user (single-user by design)
- Mobile app (PWA-ready Next.js, but no separate native app)

— Built across 20 sprints, ~50 commits, ~90 files, ~10,000 lines of code.
