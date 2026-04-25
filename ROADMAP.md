# Vitals Roadmap (post-pivot Next.js)

The autonomous overnight agent works through these phases hour-by-hour. Each completed phase is marked with `[DONE]` appended to its header. Implement EVERY `[ ]` item, then mark the phase done, commit, push, verify deploy via curl, and continue if budget allows.

## Stack
- **Next.js 15 App Router** + React 19 + TypeScript
- **shadcn/ui pattern** (Tailwind + Radix primitives)
- **Framer Motion** for animations
- **Drizzle + better-sqlite3** for the DB (file at `data/vitals.db`)
- **Recharts** for charts
- **Anthropic SDK** (`claude-sonnet-4-5-20250929`) for AI features
- **lucide-react** icons
- Auth: iron-session signed cookies + bcryptjs (single user)
- Deploy: GitHub Actions → SSH to VPS → `npm ci && npm run build && pm2 restart vitals` (port 3015, Nginx → vitals.blueproject.org)

## Hard rules
- Do NOT break the existing routes/pages. Build on top.
- Health-check at `/api/health-check` must always return 200.
- All non-public pages go through `middleware.ts` (already enforces auth).
- Data files live in `data/` (gitignored). Code only in repo.
- Test deploys via `curl -fsS https://vitals.blueproject.org/api/health-check` and `curl -sI https://vitals.blueproject.org/login`.
- After each phase: commit, push, sleep 90s, verify both endpoints. If GitHub Actions fail, debug with `gh run view --log-failed --repo jromanetto/vitals` and fix.

---

## Phase 1 — Biomarker parser hardening
- [ ] Improve `lib/parsers/biomarkers.ts` to support more layouts: Cerba, Synlab, Enzo Clinical Labs, CHIREC, LIMS, CEF-Pelleport, SHA Wellness. Add ~50 more aliases (markers commonly seen in French/Spanish lab reports).
- [ ] Handle multi-line names ("25-OH Vitamine D" split across lines), Comma decimals, scientific notation.
- [ ] Detect ref ranges given as "< X" or "> X" or "X – Y" or "[X – Y]".
- [ ] Add a simple unit normalizer: g/L ↔ mg/dL conversions for cholesterol family.
- [ ] Extend the test heuristics so the agent can run `npm run ingest` (skip if no PDFs locally — it's run on the VPS).
- [ ] Save ingest log row per file with counts.

## Phase 2 — Biomarker enrichment & insights
- [ ] Add a `biomarker_meta` table seeded with: optimal vs lab range, longevity-tilted target, description, why-it-matters, related supplements/lifestyle.
- [ ] Show optimal range badge alongside lab range on biomarker detail page.
- [ ] Add "trend over 6 months / 1 year / all time" pill toggle.
- [ ] On detail page, show top 3 most-correlated biomarkers (Pearson on shared dates).
- [ ] Add a per-biomarker AI commentary section ("Que dit la littérature sur ton niveau ?") via Claude, cached in DB.

## Phase 3 — DNA catalog expansion
- [ ] Expand `lib/dna/catalog.ts` from ~30 to **150+ entries** covering all 10 categories in depth. Use SNPedia / ClinVar / GWAS catalog references.
- [ ] Add a `dna_compound` table for composite traits (e.g., APOE genotype = function of rs429358 + rs7412 → ε2/ε3/ε4) and compute these.
- [ ] Page `/dna/[category]` now groups by trait, shows compound results at the top.
- [ ] Add risk score per category (sum of magnitudes, normalized 0-100).
- [ ] Hero card on `/dna` showing top 5 most-impactful findings + risk gauges per category.

## Phase 4 — RAG upgrade with embeddings
- [ ] Add `lib/rag/embed.ts` using Anthropic's batch API or, if not available, `@xenova/transformers` (all-MiniLM-L6-v2 wasm) for local embeddings.
- [ ] Reembed all chunks during ingest, store as JSON array string in `rag_chunk.embedding`.
- [ ] Hybrid search: BM25 (current) + cosine on embeddings, blended.
- [ ] Search results show date + chunk preview + "open document" link to PDF inline viewer.
- [ ] Highlight matched terms in snippet.

## Phase 5 — AI report generator (multi-kind)
- [ ] Generate kinds: `overview`, `cardiovascular`, `metabolic`, `longevity`, `nutrition`, `dna-deep-dive`, `next-bloodwork-prep`.
- [ ] Each kind has its own structured prompt + sections. Save with structured `meta` for re-rendering.
- [ ] Reports list groups by kind with a tab bar.
- [ ] Report detail: copy markdown, export PDF (use `@react-pdf/renderer` or print CSS).
- [ ] Include charts (mini Recharts) inline in reports for biomarker timelines mentioned.

## Phase 6 — RAG-grounded chat with streaming
- [ ] Switch `/api/chat` to streaming via Anthropic SDK streaming.
- [ ] Client renders tokens as they arrive (Framer Motion fade-in).
- [ ] Chat sessions saved in DB (`chat_session`, `chat_message`).
- [ ] Sidebar in `/chat` listing past sessions, renamable + deletable.
- [ ] Auto-citation: when assistant uses a fact from a chunk, attach inline `[1]` linking to the source doc.

## Phase 7 — PDF inline viewer + global search
- [ ] New `/files/{path}` route: serves PDFs inline behind auth (use `data/` paths).
- [ ] Inline viewer page with `<iframe>` and metadata sidebar (date, biomarkers extracted, "linked reports").
- [ ] Cmd-K palette (component) searching biomarkers + KB chunks + files + reports + DNA traits.
- [ ] Use `cmdk` or implement minimal version. Animate with Framer Motion (modal scale + fade).

## Phase 8 — Profile-aware insights & onboarding
- [ ] On first login (no profile yet), redirect to `/profile` with a guided wizard: 1 section per step, progress bar, "skip for now".
- [ ] Per-section "completion %" badges in the profile page.
- [ ] Use profile fields to personalize: optimal-range targets shift with sex, age, training intensity.
- [ ] Add `/profile/import` letting the user paste a previous health summary; Claude auto-fills the form.

## Phase 9 — Longevity score + dashboard polish
- [ ] Compute a Vitals Longevity Score (0-100) on the home dashboard from biomarkers + DNA + lifestyle answers. Document the formula.
- [ ] Big radial gauge component (Framer Motion + SVG) on the home dashboard.
- [ ] Sparkline strip showing key biomarker trends inline on home cards.
- [ ] Sticky weekly habits checklist in `/profile` (sleep, water, training, fasting hours).
- [ ] Light mode toggle in TopBar (next-themes), persists.

## Phase 10 — Mobile, accessibility, polish, perf
- [ ] Mobile sidebar (Sheet drawer) — already imported the Radix dependency.
- [ ] Keyboard shortcuts: `g d` go DNA, `g b` go biomarkers, etc.
- [ ] Focus rings, aria-labels on icons, semantic landmarks.
- [ ] Skeleton loaders for async cards.
- [ ] Lighthouse pass: image sizes, font preload, no layout shift.
- [ ] Add favicon + OG image (generated SVG, not committed binary).
- [ ] Add README sections: features, architecture diagram (ASCII), data flow.

---

## After all 10 phases done

Write `COMPLETE.md` summarizing what was built. Then stop.
