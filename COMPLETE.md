# Vitals — Build Complete

**Live:** https://vitals.blueproject.org · **Repo:** https://github.com/jromanetto/vitals

## What was built

Personal health intelligence platform built over multiple autonomous sprints from a Next.js 15 + shadcn-style + Framer Motion foundation. The platform aggregates 15 years of blood-test PDFs, 23andMe raw DNA data, knowledge-base notes, consultations and a 12-section structured profile into a single dashboard with AI-grounded reports, chat, search and trackers.

## Stack
- Next.js 15 App Router · React 19 · TypeScript strict
- Tailwind v3 + shadcn pattern + Framer Motion + Recharts + lucide-react
- Drizzle + better-sqlite3 (data/vitals.db)
- iron-session auth (data/auth.json — bcrypt hash + secret)
- Anthropic SDK (claude-sonnet-4-5-20250929)
- pdf-parse for blood-test PDFs
- next-themes (light/dark)
- PM2 + Nginx + Let's Encrypt
- GitHub Actions deploy to VPS

## Numbers
- **90 unique biomarkers** parsed from 30 PDFs (398 measurements, 15-year history) with unit normalization (mmol/L ↔ mg/dL ↔ g/L)
- **130+ DNA catalog entries** spanning 10 categories — 115 personalised insights from your 592,850 SNPs
- **11 AI report kinds** (overview, cardio, metabolic, longevity, nutrition, cognition, hormonal, inflammation, dna-deep-dive, next-bloodwork-prep, supplements) + Doctor Pack
- **12 supplement-suggestion rules** triggered by your latest biomarkers vs optimal/longevity ranges
- **9 symptoms** tracked with 60-day heatmap
- **11 drug-supplement interaction rules** with severity levels

## Pages
- `/` — Vitals Score 0-100 (40% biomarkers + 25% DNA + 20% lifestyle + 15% trends), animated radial gauge, score breakdown
- `/biomarkers` — sortable table with status badges (lab/optimal/longevity), search filter
- `/biomarkers/[slug]` — timeline chart with 3 reference bands (lab/optimal/longevity), AI commentary cached 30 days, stats and metadata pills
- `/dna` — 10 category cards with risk gauges, top findings hero
- `/dna/[category]` — detailed traits with rsid, genotype, magnitude, source URL
- `/reports` — 11 kinds + Doctor Pack hero, async generation via detached child process, polling UI
- `/reports/[id]` — markdown rendering, headings styled, print-friendly
- `/timeline` — chronological events from documents and reports
- `/knowledge` — BM25 + optional Claude re-rank, 7 category filters, term highlighting, links to PDF viewer
- `/files/[id]` — inline PDF viewer with extracted biomarkers sidebar
- `/chat` — persisted sessions, sidebar with history/rename/delete, RAG context (profile + biomarkers + DNA + KB), auto-rename via Claude
- `/supplements` — daily checklist, suggestions card, adherence calendar 90j, interactions checker, modal create
- `/symptoms` — daily entry, 60-day heatmap per symptom
- `/profile` — 12-section form (~80 fields), auto-save 1.5s debounce, completion %, /profile/import (paste medical letter → Claude auto-fill)

## Cross-cutting
- Cmd-K command palette (everything searchable)
- Light/dark mode toggle
- Mobile sidebar (Sheet drawer)
- Generated favicon + error boundaries + 404
- Apple-meets-medical aesthetic, rounded-xl, glass effect on auth, framer-motion entry animations everywhere

## Architecture highlights
- Async report generation via detached child process (scripts/gen-report.mjs, scripts/gen-doctor-pack.mjs) — bypasses Cloudflare 60s timeout, polled by client
- Unicode private-use placeholders to protect biomarker codes (B12, A1c, D3, K2, Q10) from name+digit splitting in parser preprocess
- 2nd-pass literal alias scan to catch non-greedy regex misses
- Unit normalization with sanity ranges rejecting parser garbage
- Anthropic key stored in data/auth.json (avoids Next.js dotenv-expand mangling bcrypt $)
- Sources of truth: Drizzle schema + ensureSchema() idempotent migrations

## Known limits / next steps
- DNA catalog at 130 entries (target was 200) — diminishing returns past actionable variants
- Family pedigree visualisation not yet built (Phase 14 in roadmap)
- Wearables import (Apple Health, Oura, Whoop) not built (Phase 13)
- Some lab PDFs with multi-column layouts may still skip a few markers
- RAG embeddings disabled (BM25 + Claude rerank works well enough)
