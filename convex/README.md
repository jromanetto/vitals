# Convex backend (migration in progress)

Migration SQLite -> Convex Cloud + TanStack Query. Plan:
`docs/plans/2026-07-10-convex-tanstack-migration.md`.

## Bootstrap (one-time, interactive — run in YOUR terminal)

    npx convex dev --once   # crée le projet/déploiement Cloud + push convex/schema.ts

Cela génère `convex/_generated/` et écrit `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOYMENT`
dans `.env.local` (gitignored). Ensuite l'ETL et les fonctions par domaine.

## Data safety net

DB prod copiée en local + dump complet restaurable dans `data/export/` (gitignored).
