# Vitals — Health Intelligence Dashboard

Personal health data dashboard for Julien Romanetto.

**Live:** https://vitals.blueproject.org

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- shadcn/ui pattern + Tailwind + Radix
- Framer Motion · Recharts · lucide-react
- Drizzle + better-sqlite3
- Anthropic SDK (Claude Sonnet 4.5)
- PM2 + Nginx + Let's Encrypt on VPS

## Features

- **Profile** — 12 sections, 80+ fields covering identity, anthropometry, lifestyle, diet, medical history, family, mental, reproductive, environment, goals, providers, free notes
- **Biomarkers** — auto-parsed from blood-test PDFs (15+ years of history), longitudinal charts with reference ranges
- **DNA Analysis** — 23andMe raw data parsed into 10 categories (cardiovascular, metabolism, longevity, nutrition, fitness, cognition, hormones, immunity, detox, carriers)
- **AI Reports** — generated multi-kind health summaries (overview, cardiovascular, longevity, nutrition…)
- **Knowledge base** — full-text + BM25 search over all reports, consultations, KB notes
- **AI Chat** — RAG-grounded chat with all your data + profile + biomarkers + DNA as context
- **Timeline** — unified chronological view of all health events
- **Files** — inline PDF viewer for any report

## Local dev

```bash
npm ci
npm run dev
# open http://localhost:3015
```

## Ingest

```bash
npm run ingest   # parses data/ and populates data/vitals.db
```

## Deploy

Push to `main`. GitHub Actions SSH-deploys to the VPS, builds, and `pm2 restart`s.

## Roadmap

See `ROADMAP.md` — 10 phases handled by the autonomous overnight agent.
