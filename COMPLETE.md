# Vitals — Build Complete (final)

**Live:** https://vitals.blueproject.org · **Repo:** https://github.com/jromanetto/vitals

Personal health intelligence platform built across **27 autonomous overnight sprints** + 1 day setup. Aggregates 15 years of blood-test PDFs, 23andMe raw DNA, knowledge-base notes, consultations, profile, supplements, symptoms, habits and wearables into a single dashboard with AI-grounded reports, chat, search, trackers and personalised recommendations.

## Live numbers
- **90 unique biomarkers** parsed from 30 PDFs (398 measurements, 15-year history) with unit normalization
- **160+ DNA catalog entries** spanning 10 categories — 138 personalised insights from 592,850 SNPs
- **11 AI report kinds** + Doctor Pack
- **12 biomarker-driven supplement-suggestion rules** + **16 DNA-driven** = personalised stack recommendations
- **11 drug-supplement interaction rules** with severity levels
- **9 symptoms** + **7 habits** tracked with 60-day heatmaps
- **4 wearable parsers** (Oura, Whoop, generic CSV, Apple Health structure ready)
- **21 age-gated biomarker recommendations** + **16 SNP→biomarker mappings** for missing tests
- **35 biomarker → food rules + 35 SNP → food rules** with ~150-food curated database, 10 diet patterns, hybrid rules-engine + Claude synthesis on `/nutrition`
- **20 pages** + **19 API endpoints** — all smoke-tested 200 OK

## Stack
Next.js 15 App Router · React 19 · TypeScript strict · Tailwind v3 · Framer Motion · Recharts · Drizzle + better-sqlite3 · iron-session · Anthropic SDK (claude-sonnet-4-5-20250929) · pdf-parse · next-themes · lucide-react · PM2 + Nginx + Let's Encrypt · GitHub Actions deploy.

## All pages (19)
1. `/` Dashboard — Vitals Score 0-100 (radial gauge) + breakdown + 8 sparklines + wearable widget + sleep stages 14j + recovery score + active streaks + 4 stat cards
2. `/biomarkers` — supplement effects card (avant/après) + missing biomarkers reco + sortable filterable table
3. `/biomarkers/[slug]` — timeline chart with 3 reference bands, AI commentary cached 30 days, optimal/longevity range pills, change %, **inline notes**
4. `/dna` — top findings hero + 10 category cards with risk gauges
5. `/dna/[category]` — detailed traits with rsid, genotype, magnitude, source URL, **per-trait inline notes** (collapsible)
6. `/reports` — Doctor Pack hero + 11 kinds, async generation, polling UI
7. `/reports/[id]` — markdown rendered, print-friendly
8. `/timeline` — chronological events from documents and reports
9. `/correlations` — Spearman ρ between symptoms × biomarkers / habits / supplements / wearables, filter pills, force/p-value
10. `/notes` — index with tag filters, content search, click → target
11. `/knowledge` — BM25 + Claude rerank, 7 category filters, term highlighting, links to PDF viewer
12. `/files/[id]` — inline PDF viewer with extracted biomarkers sidebar + **notes panel**
13. `/chat` — **streaming SSE**, persisted sessions, RAG context, auto-rename
14. `/supplements` — daily checklist, **biomarker + DNA suggestions**, adherence calendar 90j, **interactions checker**, modal create
15. `/symptoms` — daily entry, 60-day heatmap, click symptom → detail
16. `/symptoms/[key]` — **timeline + biomarker overlay** (dual-axis Recharts)
17. `/habits` — daily checks (7 default), streaks 🔥, 60-day heatmap
18. `/import` — Oura/Whoop/generic CSV upload with summary
19. `/profile`, `/profile/family` (3-gen pedigree edit + SVG tree), `/profile/import` (paste medical letter)

## All API endpoints (17)
`/api/auth/{login,logout}`, `/api/health-check`, `/api/profile{,/import}`, `/api/biomarkers/latest`, `/api/biomarkers/[slug]/commentary`, `/api/biomarkers/series`, `/api/sparklines`, `/api/correlations`, `/api/rag/search`, `/api/chat` (SSE), `/api/chat/sessions{,/[id]/messages}`, `/api/ingest`, `/api/reports/generate`, `/api/reports/doctor-pack`, `/api/reports/[id]/status`, `/api/files/[id]`, `/api/supplements{,/log,/suggestions,/effects}`, `/api/symptoms`, `/api/habits`, `/api/notes`, `/api/wearables`, `/api/interactions`, `/api/recommendations`, `/api/search`, `/api/export`.

## Cross-cutting features
- **Cmd-K command palette** searching biomarkers / DNA / reports / files / notes / supplements / pages
- **Light/dark mode toggle**
- **Mobile sidebar** (Sheet drawer) with hamburger
- **Generated SVG favicon** + error boundaries + 404
- **Accessibility** — skip-to-main link, focus-visible rings, aria-labels, sr-only utility, semantic landmarks
- **Print CSS** — clean PDF export hides chrome
- **Mobile CSS** — tap-highlight transparent, min-height 40px touch targets, font shrink h1/h2/tables
- **Apple-meets-medical aesthetic** — rounded-xl, glass effect, framer-motion entry/spring animations everywhere

## Sprint-by-sprint timeline (27 sprints in ~24h)
| # | Theme |
|---|---|
| 0 | FastAPI bootstrap → discarded |
| 0a | Pivot to Next.js 15 + shadcn UI + Framer Motion |
| 0b | Polish phase (favicon, error boundary, not-found) |
| 1 | Biomarker parser hardening |
| 2 | Biomarker enrichment (optimal ranges + AI commentary) |
| 3 | Fix HbA1c/CRP/VitD/B12 parsing + light/dark + mobile nav |
| 4 | RAG hybride BM25+Claude + KB filters + biomarker AI commentary |
| 5 | Supplements tracker + Symptoms diary |
| 6 | Doctor Pack PDF + RAG hybride + KB filters |
| 7 | Family pedigree + adherence + interactions checker (unit normalization fix critical) |
| 8 | DNA catalog 30→130 + COMPLETE.md v1 |
| 9 | Family pedigree SVG + DNA catalog +30 |
| 10 | Quality polish, 14-route smoke test |
| 11 | Habits tracker + UI skeletons + tooltips |
| 12 | Profile onboarding + dashboard sparklines |
| 13 | Spearman correlations + report inline charts + chat streaming SSE |
| 14 | Wearables CSV import (Oura/Whoop/Apple Health) |
| 15 | Wearable widgets dashboard + correlations enrichment |
| 16 | UI polish, performance, A11y |
| 17 | Notes everywhere + tags & search |
| 18 | Backup/export endpoint + README |
| 19 | Notes on DNA + file viewer + Cmd-K notes search |
| 20 | Final smoke + COMPLETE.md + ROADMAP completion |
| 21 | Sleep stages + recovery + cold streaks |
| 22 | /symptoms/[key] detail with biomarker overlay |
| 23 | DNA-supplement matcher (16 actionable rules) |
| 24 | UI polish + bug sweep |
| 25 | Supplement effects tracking + missing biomarker recommendations |
| 26 | Mobile UI polish + responsive tables |
| 27 | Final wrap-up |
| 28 | **Design refresh** — light theme as default, airy shell, normalized PageHeader across 18+ pages, sidebar/topbar polish, framer-motion stagger fixes |

## Sprint 28 — Design refresh (May 2026)

Post-launch design pass. Triggered by user feedback "le design est pas mal mais c'est pas assez aéré et il faut un thème sur fond blanc". Five batches, seven commits, ~25 files.

### Root cause discovered mid-session
The `ThemeProvider` was hardcoded to `defaultTheme="dark"` with `enableSystem={false}`. Every new visitor saw dark mode regardless of OS preference. All previous UI work was rendered in dark while the user expected light. Fixed in commit `ae28c82` — now defaults to light, theme toggle still persists user choice via localStorage.

### Shell & token bumps
- `app/(app)/layout.tsx`: `py-8 max-w-7xl` → `py-10 md:py-14 lg:py-16 max-w-6xl`, gutters `px-6 md:px-12`
- `<PageHeader>`: H1 `text-2xl md:text-3xl` → `text-3xl md:text-4xl`, icon 40 → 44px, eyebrow tracking widened
- `<SectionHeader>`: H2 `text-base md:text-lg` → `text-lg md:text-xl`, eyebrow 11px tracking [0.18em]
- `<Sidebar>`: `w-60` → `w-64`, items `space-y-0.5` → `space-y-1` rounded-lg, group label tracking [0.16em], logo dot gets emerald glow, active item icon turns emerald
- `<TopBar>`: `h-14` → `h-16`, gutter md:px-12 cohérent avec shell, search rounded-lg + py-2 + backdrop-blur-md

### Pages migrated to PageHeader (18)
**Batch A** (`c5ad78b`) — biomarkers, dna, reports
**Batch B** (`0b98503`) — nutrition (drop redundant max-w wrapper), supplements (Pill icon + Ajouter action), timeline, action-plan (Target icon + Régénérer action)
**Batch C** (`4777eda`) — profile/family, profile/security, profile/import, habits (Flame), notes (NotebookPen), symptoms (HeartPulse), correlations (Network), import (FolderUp), memory (Brain) + 5 detail routes ([slug]/[category]/[id]/[key]) typography normalized to PageHeader scale

### framer-motion fix
`DnaTopFindings`, `DnaStrengths` and `DnaCategoryCard` used `whileInView` for inner card stagger. Cards rendered below the initial fold stayed at opacity 0 until scroll — entire "Points d'attention" and "Par système corporel" sections appeared empty in long viewports and headless screenshots. Switched to `animate` (commit `209760f`) so the stagger fires on mount.

### Pages skipped (intentional)
- `/profile` (root): delegates to `<ProfileWizard />` which already has its own PageHeader
- `/knowledge`: just a `redirect("/chat?tab=docs")`
- `/praticien`: print-friendly doc with `bg-white text-black` for doctor sharing
- `/chat`: conversational UI, structure differs from data pages

### Commits
| SHA | Phase |
|---|---|
| `057b79a` | Phase 1 — shell + tokens + dashboard |
| `c5ad78b` | Batch A — biomarkers · dna · reports |
| `0b98503` | Batch B — nutrition · supplements · timeline · action-plan |
| `4777eda` | Batch C — profile* + 9 pages + 5 detail routes |
| `237c549` | Shell polish — sidebar w-64 + topbar h-16 |
| `ae28c82` | **Theme default light** (was hardcoded dark) |
| `209760f` | DNA cards animate on mount instead of whileInView |

### Deferred (intentional, low impact)
- 103 instances of `text-amber-400`/`text-red-400` calibrated for dark mode — slightly pale on white, not breaking. Future polish batch.
- Public landing page (`/`) marketing patterns (3-column feature grid, numbered icons in colored circles) — out of scope for "admin pages" request.

## Architecture highlights
- **Async report generation** via detached `child_process.spawn` — bypasses Cloudflare 60s timeout, polled by client
- **Unicode private-use placeholders** to protect biomarker codes (B12, A1c, D3, K2, Q10, T3, T4) from name+digit splitting
- **2nd-pass literal alias scan** to catch non-greedy regex misses
- **Unit normalization** with sanity ranges rejecting parser garbage (LDL stored canonical mg/dL, etc.)
- **Streaming SSE chat** with persistence and auto-rename via Claude
- **Anthropic key in data/auth.json** (avoids Next.js dotenv-expand mangling bcrypt `$`)
- **Idempotent migrations** on every request via ensureSchema()
- **JSON export** of full state for backup / migration
- **Drug-supplement + DNA-driven recommendations** cross-referenced

## Privacy & deploy
- All data on your VPS at `/home/script/vitals/data/`
- HTTPS via Let's Encrypt
- Auth credentials + Anthropic key in `data/auth.json` (chmod 600)
- Health data (PDFs, vitals.db) gitignored
- GitHub Actions auto-deploys on push to main

## Final smoke test (this morning)
```
=== PAGES (19/19) ===
/ → 200, /biomarkers → 200, /biomarkers/ldl → 200, /dna → 200,
/dna/longevity → 200, /reports → 200, /timeline → 200,
/correlations → 200, /notes → 200, /knowledge → 200, /chat → 200,
/supplements → 200, /symptoms → 200, /symptoms/energy → 200,
/habits → 200, /import → 200, /profile → 200,
/profile/family → 200, /profile/import → 200

=== API (17/17) ===
All endpoints responding 200 OK
```

## What's not built (left for the user to decide)
- Apple Health export.zip XML parser (skipped — requires user upload)
- Real-time wearable webhooks (Oura/Whoop polled via CSV is enough)
- Multi-user (single-user by design)
- Mobile app (PWA-ready Next.js, but no separate native app)
- Lab order auto-fax (out of scope)

— Built across 27 sprints, ~80 commits, ~120 files, ~14,000 lines of code.
