# Vitals Improvement Roadmap

The autonomous overnight agent works through these phases hour-by-hour. Each completed phase is marked with [x] and committed.

**CRITICAL execution rules for the agent:**
- The VPS path `/home/script/vitals/data/` contains the user's real health data and CANNOT be accessed by the cloud agent. The agent must NEVER assume it has access to actual files. It must write code that handles `data/` correctly when present (works when deployed on VPS).
- All testing on the cloud side is done via `curl https://vitals.blueproject.org/health-check` after a deploy — the agent must NOT try to SSH into the VPS or read local files.
- Auth is required for all routes except `/login` and `/health-check`. Never weaken auth.
- Keep the design dark/minimal/elegant — Apple-meets-medical aesthetic.
- After each phase: commit with a clear message, push, wait ~30 sec, then `curl -fsS https://vitals.blueproject.org/health-check` to verify deploy succeeded. If health-check fails, investigate logs via `gh run view --log` on the latest workflow run.

---

## Phase 1 — Biomarkers parser foundation
- [ ] Create `app/lib/biomarkers.py` with a function `parse_biomarker_pdf(path)` that uses `pdfplumber` to extract structured biomarker tables (name, value, unit, ref_range, date).
- [ ] Add `pdfplumber` to `requirements.txt`.
- [ ] Use a regex/heuristic approach (lab reports vary) — focus on Cerba/Synlab/SHA formats found in `data/analyses-sang/` and `data/sha-wellness-clinic/`.
- [ ] Cache parsed results to a sqlite DB at `data/biomarkers.db` (table: `biomarker(id, name, value, unit, ref_low, ref_high, date, source_file)`).
- [ ] Add `app/lib/db.py` with a sqlite connection helper.
- [ ] Create `/api/biomarkers/refresh` endpoint (auth required) that re-parses all PDFs.

## Phase 2 — Biomarkers dashboard UI
- [ ] New route `/biomarkers` showing a list of all biomarkers found, with latest value, status badge (normal / low / high based on ref range), and trend arrow.
- [ ] Group by category (lipids, hormones, vitamins, hematology, metabolic).
- [ ] Sortable + filterable table.
- [ ] Link from main dashboard card.

## Phase 3 — Biomarker detail with timeline chart
- [ ] Route `/biomarkers/{slug}` showing a Chart.js (CDN) line chart of the value over time.
- [ ] Reference range as a shaded band on the chart.
- [ ] Latest value + change vs previous + change vs first measurement.
- [ ] Notes/observations field (stored in `biomarker_notes` table).

## Phase 4 — Knowledge base text indexing
- [ ] Walk `data/knowledge-base/` recursively, index `.md`/`.txt`/`.pdf` files into a `kb_chunks(id, file, chunk_idx, text, embedding)` sqlite-vec or simple in-memory index.
- [ ] If no `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` available, fall back to BM25 (use `rank-bm25` package).
- [ ] Endpoint `/api/kb/search?q=...` returning top 10 chunks with file + score.

## Phase 5 — Knowledge base search UI
- [ ] Route `/kb` with a search box, results below with file + snippet highlight + "open file" link.
- [ ] Recent searches saved per session.
- [ ] Card on main dashboard.

## Phase 6 — PDF inline viewer
- [ ] Replace the current behaviour where opening a PDF triggers download — embed `<iframe src=pdf>` or `pdf.js` viewer in `/browse/{path}` for PDFs.
- [ ] Add a "download" button next to the inline viewer.
- [ ] Page navigation + zoom controls.

## Phase 7 — Global search
- [ ] Top-bar search box (visible on every page) that searches biomarkers names + KB chunks + filenames.
- [ ] Route `/search?q=...` with grouped results (Biomarkers, KB, Files).
- [ ] Keyboard shortcut `cmd+k`/`ctrl+k` to focus.

## Phase 8 — Notes & annotations
- [ ] Generic `notes` table (id, target_type, target_id, body, created_at, updated_at).
- [ ] Notes UI on biomarker detail pages, on file viewer, on KB search results.
- [ ] `/notes` index showing all notes sorted by recency.

## Phase 9 — Health summary report
- [ ] Route `/summary` generating a one-page report:
  - Latest biomarkers (top 20 most-tracked)
  - Out-of-range items highlighted
  - Recent trends (improving / worsening)
  - Last consultation date
  - Days since last full panel
- [ ] "Print to PDF" friendly CSS (`@media print`).

## Phase 10 — UI polish & QoL
- [ ] Stats card on home: total biomarkers tracked, latest panel date, % in normal range.
- [ ] Breadcrumbs everywhere.
- [ ] Loading states / skeleton screens.
- [ ] Empty states with helpful prompts.
- [ ] Mobile-responsive nav (hamburger).
- [ ] Favicon + page titles.
- [ ] Accessibility: aria labels, focus rings, keyboard nav.

---

## After all 10 phases done

If all 10 phases are committed and deployed: the agent should write `COMPLETE.md` at the repo root with a summary of what was built, then mark itself done. Do not invent phase 11 — let the user pick the next direction in the morning.
