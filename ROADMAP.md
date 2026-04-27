# Vitals — Weekend Roadmap

The autonomous weekend agent works through these phases. Append ` [DONE]` to a phase header when every checkbox under it is `[x]`. After each phase: commit + push + verify via curl + continue.

**Live:** https://vitals.blueproject.org · **Repo:** https://github.com/jromanetto/vitals

## Stack
Next.js 15 · React 19 · TypeScript strict · shadcn pattern · Tailwind v3 · Framer Motion · Recharts · Drizzle + better-sqlite3 · Anthropic SDK (claude-sonnet-4-5-20250929) · iron-session · lucide-react · pdf-parse.

## Hard rules
- `/api/health-check` must always return 200.
- Auth required on all routes except `/login`, `/api/auth/*`, `/api/health-check`, `/static/*`.
- Don't commit data files. Never put bcrypt hashes in `.env` (use data/auth.json).
- Build must exit 0 before pushing. Verify deploy after pushing.
- Atomic commits: one phase per commit. No emojis in commit messages.

---

## Phase 0 — Bug sweep & polish [DONE candidate]
- [ ] Fix `/dna` 500: replace dynamic import in app/(app)/dna/page.tsx with top-of-file `import { dnaVariant } from "@/lib/db/schema"`.
- [ ] Remove `output: "standalone"` from next.config.mjs.
- [ ] Add a `/api/health` route alias that doesn't require auth (some monitoring tools probe `/health`).
- [ ] Fix any TypeScript errors in `npm run build`.
- [ ] Add `app/icon.tsx` returning a generated SVG favicon (emerald dot on dark).
- [ ] Add `not-found.tsx` and `error.tsx` boundaries with the same dark theme.
- [ ] Smoke test: login → dashboard → biomarkers → biomarker detail → /dna → /dna/longevity → /reports → /timeline → /knowledge → /chat → /profile.

## Phase 1 — Biomarker parser hardening [DONE]
- [ ] Add 50+ aliases to `lib/parsers/biomarkers.ts` covering: NSE, S100B, oméga-3 index, ferritine saturation, RDW, MPV, IDR, magnésium érythrocytaire, zinc, sélénium, iode urinaire, cortisol salivaire, T3 reverse, anti-TPO, anti-Tg, ACTH, prolactine, FSH, LH, progestérone, vitamine A, vitamine E, vitamine K, B1/B2/B3/B5/B6, CoQ10, holotranscobalamine, MMA (acide méthylmalonique), troponine, NT-proBNP, D-dimères, INR, TP, TCA, fibrinogène, TGP/TGO ratio, GGT/PAL ratio, lipase, amylase, calcium ionisé, phosphore, PTH, bicarbonates, gaz du sang, LDH, haptoglobine, IgE totales, IgG/IgA/IgM, complément C3 C4, ANA, anti-CCP, FR.
- [ ] Improve regex to handle: comma-decimal, scientific notation, units split across lines, ref ranges as `< X`, `> X`, `≤ X`, `≥ X`, `[X – Y]`, `(X – Y)`, `entre X et Y`.
- [ ] Add unit normalizer: g/L ↔ mg/dL ↔ mmol/L for cholesterol family, glycémie, créatinine, bilirubine.
- [ ] Detect & skip header rows / footers from labs.
- [ ] Re-run ingest endpoint, log the count delta.
- [ ] Goal: from 31 unique biomarkers to **80+**.

## Phase 2 — Biomarker enrichment & insights [DONE]
- [ ] Create `biomarker_meta` table with: slug, optimal_low, optimal_high, longevity_target, why_matters, category_long, supplements, lifestyle_actions.
- [ ] Seed it with reference data for the 50 most-tracked biomarkers (e.g. for ferritine: optimal 70-120 ng/mL, longevity 80-100, why matters = "réserves de fer, marqueur inflammation").
- [ ] On biomarker detail page: show optimal range badge alongside lab range, and a "longevity target" pill. Color the chart band by both ranges (lab = lighter, optimal = stronger).
- [ ] Add per-biomarker AI commentary cached in `report` table (kind='biomarker_insight', meta.slug=X). Generate via Claude with profile + history as context.
- [ ] Trend pill toggle: 6m / 1y / all time.
- [ ] On detail page: list top 3 most-correlated biomarkers (Pearson on overlapping dates).

## Phase 3 — DNA catalog massive expansion [DONE]
- [ ] Expand `lib/dna/catalog.ts` to **150+ entries** (currently ~30). Sourced from SNPedia/ClinVar/peer-reviewed only. Cite the URL.
- [ ] Coverage targets:
  - Longevity: APOE compound, FOXO3, KLOTHO, SIRT1, TP53, IGF1R, mTOR, NRF2, TERC, telomere SNPs (10+ entries).
  - Cardiovascular: 9p21, Lp(a), homocystéine MTHFR/MTRR/MTR, factor V, prothrombin, factor XIII, fibrinogen, ANGPTL3, PCSK9, CETP, LDLR, ABCA1, NOS3, eNOS (15+).
  - Metabolism: FTO, MC4R, TCF7L2, PPARG, SLC30A8, KCNJ11, ABCC8, LEP, LEPR, ADIPOQ, GCKR, GLUT4, IRS1, SLC2A4, MTNR1B, PPAR-α/γ (15+).
  - Nutrition: caffeine (CYP1A2 + AHR), alcohol (ADH1B, ALDH2), lactose (MCM6/LCT), gluten (HLA-DQ2/DQ8), folate (MTHFR), B12 (FUT2, TCN2), vitamin D (GC, CYP2R1, CYP27B1, VDR), iron (TMPRSS6, HFE), bitter taste (TAS2R38), gluten sensitivity, omega-3 (FADS1/FADS2), choline (PEMT) (20+).
  - Fitness: ACTN3, ACE, AMPD1, MCT1, COL1A1, COL5A1, IL6, MSTN, ADRB2, NRF2 exercise, PPARGC1A, VEGFA (10+).
  - Cognition: BDNF Val66Met, COMT Val158Met, OXTR, DRD2/DRD4, MAOA, 5-HTTLPR (rs25531), CACNA1C, CHRM2, APOE cognition, CADM2 (10+).
  - Hormones: SRD5A2 (DHT/baldness), CYP19A1 (aromatase), AR (androgen receptor CAG repeat — note rsid not always avail), SHBG, TRH, DIO1/DIO2 (thyroid conversion) (8+).
  - Immunity: HLA-DQ2.5/DQ8 cœliaque, HLA-B27 spondylarthrite, HLA-DRB1, IL23R, NOD2, CTLA4, STAT4, IRF5, IFIH1 (10+).
  - Detox: CYP2C9*2/*3, CYP2C19*2/*17, CYP3A4/CYP3A5, VKORC1, ABCB1, GSTM1/GSTT1 deletions (note: deletions not always on chip), SOD2 Val16Ala, NQO1, NAT2 acetylation (10+).
  - Other actionable: MTRR/MTR, BCMO1 (β-carotene→retinol conversion), AGT, AGTR1 (renin-angiotensin), eNOS, KIF6, PALB2, BRCA1/BRCA2 commonly screened (be cautious — these are sensitive; flag clearly).
- [ ] Compute compound traits in a new `lib/dna/compounds.ts`: APOE genotype (ε2/ε3/ε4), MTHFR composite (C677T+A1298C), thrombosis composite (FVL+FII), HLA-DQ summary, oxidation composite (SOD2+NQO1+GST).
- [ ] Add `dna_compound` table and populate during ingest.
- [ ] On `/dna`: hero card shows top 5 most-impactful findings + risk gauges per category (radial 0-100 score = sum of (hasRisk × magnitude) capped).
- [ ] On `/dna/[category]` group by trait, show compound results at top, then individual SNPs sorted by magnitude × hasRisk.

## Phase 4 — RAG embeddings + hybrid search [DONE]
- [ ] Add `lib/rag/embed.ts`. If `ANTHROPIC_API_KEY` is set, use Anthropic's Claude for embedding (no embedding endpoint — use a simple semantic re-rank: take top 30 BM25 hits and ask Claude to rank them by relevance to query). If not, just use BM25 (already working).
- [ ] Save the rank score in a `rag_chunk.last_rank_score` column.
- [ ] Hybrid: BM25 first pass → Claude re-rank top 30 → return top 10.
- [ ] On `/knowledge`: highlight matched query terms in snippet (mark tag, emerald background).
- [ ] Add filter pills: "Tous", "Sang", "Consultations", "Knowledge", "ADN", "SHA Wellness".
- [ ] Empty state with example queries.

## Phase 5 — Reports — multi-kind generator + viewer [DONE]
- [ ] Generate kinds: `overview`, `cardiovascular`, `metabolic`, `longevity`, `nutrition`, `cognition`, `dna-deep-dive`, `hormonal`, `inflammation`, `next-bloodwork-prep`, `supplement-recommendations`.
- [ ] Each kind has a tailored system prompt + structured sections.
- [ ] Cache: don't regenerate if the underlying data hasn't changed (hash profile+biomarkers+dna and store in report.meta.dataHash).
- [ ] `/reports`: tabs by kind, chronological within. Stats per tab (count, last generated).
- [ ] `/reports/[id]`: render markdown with proper styling (already partially done — make headings bigger, add line height, inline code styling, blockquote styling, table styling).
- [ ] "Print to PDF" button: opens print dialog with print-friendly CSS (`@media print` hiding sidebar/topbar, using black on white).
- [ ] Inline mini-charts in reports: detect `[[chart:slug]]` markers and replace with a Recharts SparklineChart server-side (rendered via @react-pdf or as inline SVG).
- [ ] Add `/reports/quick-summary` which generates a one-paragraph summary of latest state, refreshed daily (cached).

## Phase 6 — Streaming chat with sessions [DONE]
- [ ] Switch `/api/chat` to server streaming via Anthropic SDK `stream: true`.
- [ ] Client renders tokens as they arrive. Framer Motion fade-in by 4-character chunks.
- [ ] Tables: `chat_session(id, title, created_at, updated_at)` and `chat_message(id, session_id, role, content, sources, created_at)`.
- [ ] `/chat` layout: left rail listing past sessions (rename, delete), main pane current chat.
- [ ] Auto-rename a fresh session after first user+assistant exchange (Claude-generated title, max 6 words).
- [ ] Inline citations: when assistant references a chunk, attach `[1]`, `[2]` numbered citations linking to the source doc.
- [ ] Token counter + cost estimate in footer.
- [ ] Quick-action buttons: "Compare two periods", "Recommend supplements", "Plan next bloodwork".

## Phase 7 — PDF inline viewer + global Cmd-K palette [DONE]
- [ ] New `/files/[...path]` route serving PDFs inline behind auth (read from data/, sanitize path).
- [ ] Inline viewer page: iframe with #view=FitH, sidebar showing extracted biomarkers, related reports, "open in new tab".
- [ ] Cmd-K command palette component (using a lightweight headless approach, no extra dep). Searches biomarkers + KB chunks + files + reports + DNA traits + actions.
- [ ] Keyboard shortcuts: `g d` → /dna, `g b` → /biomarkers, `g r` → /reports, `g t` → /timeline, `g k` → /knowledge, `g c` → /chat, `g p` → /profile, `g h` → /, `?` → show shortcuts overlay.
- [ ] Animate the palette: scale-down + fade in 200ms (framer).

## Phase 8 — Profile UX + onboarding + import [DONE]
- [ ] On first login (no profile yet), `/` redirects to `/profile/onboarding` with a wizard: 1 section per step, animated progress bar, "skip for now" allowed.
- [ ] Sticky save bar with "Last saved 12 sec ago" indicator.
- [ ] Per-section completion badges in the profile page.
- [ ] Markdown export endpoint `/api/profile/export.md` (already partially works — improve formatting, group sections, add ToC).
- [ ] `/profile/import`: paste a previous health summary or doctor letter; Claude auto-fills the form fields it can extract. Show a diff preview before saving.
- [ ] `/profile` page also surfaces "missing high-impact data" alerts (e.g., "you haven't filled family history" with CTA).

## Phase 9 — Longevity score + dashboard polish [DONE]
- [ ] Compute Vitals Longevity Score 0-100. Formula in `lib/scoring/longevity.ts`. Document inputs:
  - 40% biomarkers in optimal range (per biomarker_meta.optimal_low/high).
  - 25% DNA: longevity-favorable variants minus risk variants, normalized.
  - 20% lifestyle (profile.activityLevel, sleepHours, stressLevel, dietType, smoker, alcohol).
  - 15% trends (5-year direction of LDL, HOMA, CRP, ferritine, TSH, vit D).
- [ ] Display a big radial gauge component on home dashboard (SVG + Framer Motion).
- [ ] Sparkline strip on home cards showing key biomarker trends.
- [ ] "Score breakdown" expandable card showing each component.
- [ ] Add weekly habits checklist on `/profile` (sleep, water, training, fasting, sun, meditation) — store in `habit_log(date, key, value)`.
- [ ] Light mode toggle in TopBar (next-themes), persists. Make sure all components have light mode treatment.

## Phase 10 — Mobile + accessibility + performance [DONE]
- [ ] Mobile sidebar: convert Sidebar to a Sheet-style drawer on <md screens, hamburger trigger in TopBar.
- [ ] Profile-form section nav also collapses on mobile.
- [ ] `aria-label` on all icon-only buttons.
- [ ] Focus rings consistent across all interactive elements.
- [ ] Lighthouse target: ≥90 on perf + a11y. Add font-display: swap, preload critical fonts.
- [ ] Skeleton loaders on biomarker table, DNA category cards, KB search.
- [ ] Caching headers on /api/biomarkers/latest (5min) and /api/auth/me (none).
- [ ] Image optimization: replace any raster icons with lucide.

---

## Phase 11 — Habits & supplements tracker [DONE]
- [ ] Tables: `supplement(id, name, dose, unit, timing, started_at, ended_at, notes)`, `supplement_log(id, supplement_id, date, taken)`.
- [ ] `/supplements` page: list current stack with add/edit/end. Daily checklist.
- [ ] Plot adherence calendar (heatmap, last 90 days).
- [ ] Cross-reference: list supplements that target out-of-range biomarkers (e.g. low vit D → vitamin D3+K2 recommendation).
- [ ] Drug-supplement interaction warnings (small built-in list: K with anticoagulants, fish oil with anticoagulants, St John's wort with SSRIs, etc).

## Phase 12 — Symptoms diary + correlations [DONE]
- [ ] Tables: `symptom(id, key, label, scale)`, `symptom_log(id, symptom_id, date, value, notes)`.
- [ ] Default symptoms: energy, mood, focus, sleep_quality, gut, skin, anxiety, libido, hrv (number).
- [ ] `/symptoms`: 1-tap entry from a "today" panel; calendar heatmap per symptom; weekly average line chart.
- [ ] Correlation engine: Spearman correlation between any symptom log and biomarker / supplement / habit. Top 5 correlations shown.

## Phase 13 — Wearables import [DONE]
- [ ] `/import`: upload Apple Health export.zip, Oura JSON, Whoop CSV, Garmin GPX.
- [ ] Parsers in `lib/parsers/wearables/{apple,oura,whoop,garmin}.ts`.
- [ ] Unified `wearable_metric(date, source, kind, value, unit)` table.
- [ ] Display on dashboard: HRV trend (Oura/Whoop), resting HR (all), sleep stages (Apple/Oura), training load (Whoop).
- [ ] Correlate wearable metrics with biomarkers (e.g., HRV vs. cortisol).

## Phase 14 — Family pedigree + risks [DONE]
- [ ] In Profile → Family section: build a structured pedigree (father, mother, 2 paternal GP, 2 maternal GP, siblings, kids). Each with name, conditions, age of onset, alive status.
- [ ] Visualize as an SVG family tree (react-flow or hand-rolled).
- [ ] Compute hereditary risk flags (cancer, cardio, diabetes, alzheimer) using simple rules + first-degree weighting.

## Phase 15 — Doctor pack export [DONE]
- [ ] One-click export: PDF bundle with last bilan + biomarker timelines (12 most relevant) + family history + current supplements + symptoms summary + 3 questions to ask.
- [ ] Generated by Claude based on profile.goals.
- [ ] Save to `report` with kind='doctor-pack' for re-download.

---

## After all phases

Write `COMPLETE.md` summarizing what's been built. Stop.
