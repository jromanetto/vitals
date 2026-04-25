# Vitals — Personal Health Dashboard

FastAPI app for managing personal health data (blood analyses, biomarkers, consultations, knowledge base).

## Live

https://vitals.blueproject.org

## Stack

- FastAPI + Uvicorn (Python 3.11)
- Jinja2 templates + Tailwind CDN
- bcrypt + itsdangerous signed cookies
- PM2 + Nginx + Let's Encrypt
- VPS: `/home/script/vitals/` (port 3015)

## Architecture

```
app/
├── main.py              # FastAPI routes + auth
├── templates/           # Jinja2 templates
└── static/              # CSS/JS
data/                    # Health data (gitignored — synced from Google Drive)
scripts/                 # Biomarker analysis scripts
```

## Deploy

Push to `main` → GitHub Actions → SSH deploy to VPS → PM2 restart.

## Roadmap

See `ROADMAP.md` for the 10-phase improvement plan handled by the autonomous overnight agent.

## Environment

`.env` (not in repo):
- `VITALS_AUTH_EMAIL`
- `VITALS_AUTH_HASH` (bcrypt)
- `VITALS_SECRET_KEY`
- `ANTHROPIC_API_KEY` (for RAG/biomarker analysis features)
