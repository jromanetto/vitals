# Migration Convex Cloud + TanStack Query — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remplacer la couche data self-hosted (better-sqlite3 raw SQL + iron-session) par Convex Cloud (backend réactif, typé, temps réel, multi-tenant) et TanStack Query côté client, via une migration strangler-fig domaine-par-domaine — sans big-bang, sans jamais casser `/api/health-check` ni exposer de données médicales en clair.

**Architecture:** Cutover direct (décision utilisateur 2026-07-10 : projet pas en prod, migration directe, priorité = ne rien perdre). Chaque domaine est migré end-to-end (schéma Convex → ETL chiffré → fonctions query/mutation → hook TanStack → réécriture route/page → suppression du code SQLite) et validé avant de passer au suivant — **séquencé par domaine en commits atomiques, mais SANS flag de cohabitation dual-backend** (on remplace SQLite, on ne le double pas). **On garde le Next.js App Router** ; TanStack **Router n'est PAS adopté** (voir §Décisions). L'auth reste iron-session au début (Convex ne gère que la data), puis migre vers Convex Auth en dernière phase.

**Garantie "tout récupérer" (faite le 2026-07-10) :** DB prod (147 MB) copiée depuis le VPS → `data/vitals.db` (intégrité `ok`) ; dump SQL complet restaurable → `data/export/vitals-full-dump-2026-07-10.sql.gz` (18 MB, restauration vérifiée : 1149 biomarkers, 1,81 M dna_variant, 6 users) ; schéma autoritatif → `data/export/schema-authoritative.sql`. Tout gitignored (jamais committé).

**Tech Stack:** Convex (`convex`, `convex/react`, `convex/nextjs`), `@tanstack/react-query` + `@convex-dev/react-query`, Next.js 15 App Router, React 19, TypeScript strict, chiffrement AES existant (`lib/crypto-fields.ts`) étendu.

---

## ⚠️ Blockers durs à traiter AVANT toute donnée en prod

Ces points ne sont pas négociables et conditionnent la légalité/sécurité de la migration. Rien ne part sur Convex Cloud tant que 1 et 2 ne sont pas faits.

1. **BAA HIPAA signé avec Convex.** Données médicales sur SaaS tiers ⇒ Business Associate Agreement obligatoire (plan Convex payant). Sans ça, on est en infraction. → action manuelle utilisateur, hors code.
2. **Chiffrement au repos côté app.** Convex stocke ce qu'on lui envoie. On étend `SENSITIVE_PROFILE_FIELDS` (déjà: firstName, lastName, email, phone, birthDate, birthPlace, address, city) pour chiffrer aussi les **valeurs de biomarqueurs, génotypes ADN, corps des rapports, notes, symptômes** avant insert. Convex ne voit que du ciphertext + des champs d'index non-sensibles (slug, date, user_id). La clé (`fieldEncryptionKey`) reste dans `data/auth.json` sur le VPS, jamais sur Convex.
   - **Conséquence dure :** on perd le full-text search Convex sur les champs chiffrés ⇒ le RAG et la recherche doivent tourner sur des index dérivés non-sensibles OU rester côté VPS (voir Phase 7).
3. **`child_process` détaché pour la génération de rapports** (`scripts/gen-report.mjs` spawn détaché pour bypasser le timeout CF 60s) **n'a pas d'équivalent Convex.** Les Convex actions ont une limite d'exécution et ne sont pas des workers longue-durée détachés. Décision : garder un **worker Node séparé sur le VPS** qui écrit le résultat via le Convex HTTP client (Convex reste la source de vérité de l'état `pending/done`, la génération lourde reste hors Convex).
4. **Passage synchrone → asynchrone partout.** better-sqlite3 est synchrone ; Convex est async/réactif. Les 291 `.prepare(...).get/all/run` deviennent des `await ctx.db...` dans des fonctions Convex + `useQuery`/`useMutation` côté client. Aucune reprise mécanique possible : chaque call est revu.
5. **Isolation multi-tenant (`user_id`) et Foyer/consentement.** L'invariant actuel (`currentUserId` pour writes, `effectiveUserId` lecture seule sur lien `household_link` actif) doit être **réimplémenté dans les fonctions Convex** (argument `viewerId` re-validé serveur-side à chaque query, jamais de confiance au client). Le guard `tests/sql-isolation.test.ts` sera remplacé par un équivalent qui scanne les fonctions Convex.

---

## Décisions d'archi (verrouillées)

- **TanStack Query : OUI. TanStack Router : NON.** Router = abandon de l'App Router (réécriture du routing de 36 pages) pour un gain nul ici (le file-based routing App Router suffit). Query, lui, devient le cache client réactif au-dessus de Convex via `@convex-dev/react-query` (Convex pousse les updates, Query gère cache/invalidation/optimistic). Si l'utilisateur veut vraiment Router, c'est un plan séparé.
- **Cutover direct, séquencé par domaine (pas de flag).** Décision utilisateur : projet pas en prod → on remplace SQLite directement, domaine par domaine, en commits atomiques sur la branche `feat/convex-tanstack-migration`. Pas de dual-backend. Rollback = revert de commit / la branche n'est pas mergée tant que tout n'est pas vert.
- **Auth migrée en DERNIER.** Trop de surface (bcrypt, TOTP, reset, sessions). Convex ne gère d'abord que la data ; les fonctions Convex reçoivent un `userId` prouvé par un token signé émis par la couche iron-session existante (Convex HTTP action valide le token). Migration vers Convex Auth = Phase 8, optionnelle.
- **Ordre de migration des domaines** (du moins risqué au plus couplé) : `supplements` → `notes` → `symptoms` → `biomarkers` → `dna` → `reports` → `chat` → `rag/search` → `household` → `auth`.

---

## Phase 0 — Scaffolding + preuve de concept (vertical slice)

Objectif : Convex installé, connecté, typé, avec **un domaine complet migré end-to-end** (`supplements`, le plus simple) pour valider tout le pattern avant d'industrialiser. Rien n'est basculé en prod.

### Task 0.1: Installer Convex + TanStack Query

**Files:**
- Modify: `package.json`
- Create: `convex/` (généré par `npx convex dev`)
- Create: `convex/README.md`

**Step 1:** `npm i convex @tanstack/react-query @convex-dev/react-query`
**Step 2:** `npx convex dev --once --configure=new` (crée le projet Convex Cloud, écrit `.env.local` avec `CONVEX_DEPLOYMENT` + `NEXT_PUBLIC_CONVEX_URL`). ⚠️ Vérifier que `.env.local` est gitignored ; ne jamais committer les URLs de déploiement prod.
**Step 3:** Vérifier `npm run build` exit 0 (Convex ne casse rien tant qu'inutilisé).
**Step 4:** Commit `chore(convex): scaffold Convex + TanStack Query (unused)`.

### Task 0.2: Provider React (Convex + QueryClient)

**Files:**
- Create: `app/providers.tsx`
- Modify: `app/layout.tsx`

**Step 1 (test):** `tests/providers.test.tsx` — rend `<Providers>` avec un composant enfant qui appelle `useQueryClient()`, assert non-null.
**Step 2:** Vérifier échec (pas de provider).
**Step 3:** Implémenter `Providers` : `ConvexQueryClient` branché sur `QueryClientProvider` + `ConvexProvider`. Wrapper dans `app/layout.tsx`.
**Step 4:** Test passe. `npm run build` exit 0.
**Step 5:** Commit `feat(convex): app-wide Convex + TanStack Query provider`.

### Task 0.3: Schéma Convex — table `supplement` + `supplement_log`

**Files:**
- Create: `convex/schema.ts`
- Reference: `lib/db/migrate.ts` (colonnes actuelles de `supplement`, `supplement_log`)

**Step 1:** Lire les CREATE TABLE de `supplement`/`supplement_log` dans `lib/db/migrate.ts`.
**Step 2:** Écrire `defineSchema({ supplement: defineTable({...}).index("by_user", ["userId"]), supplement_log: ... })`. Champs sensibles (dosage/notes libres) typés `v.string()` mais destinés à recevoir du ciphertext.
**Step 3:** `npx convex dev --once` (push le schéma). Vérifier dans le dashboard.
**Step 4:** Commit `feat(convex): supplement schema`.

### Task 0.4: Fonctions Convex `supplements.list` / `add` / `log` avec isolation

**Files:**
- Create: `convex/supplements.ts`
- Create: `convex/lib/auth.ts` (helper `requireUser(ctx, token)` + `resolveEffectiveUser(ctx, token, subjectId)` répliquant l'invariant Foyer)

**Step 1 (test):** `convex/supplements.test.ts` (convex-test) — seed 2 users, `list` scope au bon `userId`, un user ne voit jamais l'autre ; `resolveEffectiveUser` renvoie self si pas de lien actif.
**Step 2:** Échec.
**Step 3:** Implémenter `query list` (lit via `effectiveUserId`), `mutation add`/`log` (écrivent via `currentUserId` prouvé, jamais `effectiveUserId`). Chiffrer les champs sensibles avant insert.
**Step 4:** Tests passent.
**Step 5:** Commit `feat(convex): supplements functions with tenant + household isolation`.

### Task 0.5: Hook client TanStack + bascule de la page `/stack` derrière le flag

**Files:**
- Create: `lib/data/supplements.ts` (façade : lit le flag `DATA_BACKEND.supplements`, route vers Convex `useQuery` ou l'ancien fetch REST)
- Modify: la page/composant Stack qui consomme les supplements

**Step 1 (test):** test du composant : avec flag=`convex`, il rend depuis `useQuery(api.supplements.list)` (mocké) ; avec flag=`sqlite`, l'ancien chemin.
**Step 2:** Échec.
**Step 3:** Implémenter la façade + brancher le composant. Flag OFF (`sqlite`) par défaut.
**Step 4:** Test passe. `npm run build` + `npm run lint` exit 0. Smoke `/stack` en dev les deux flags.
**Step 5:** Commit `feat(convex): supplements read path behind DATA_BACKEND flag`.

### Task 0.6: ETL SQLite → Convex (script, chiffré, idempotent) pour supplements

**Files:**
- Create: `scripts/migrate-to-convex.ts` (par domaine, `--domain=supplements`, upsert idempotent par clé naturelle, chiffre à la volée)

**Step 1 (test):** `tests/etl-supplements.test.ts` — DB SQLite temp seedée → run ETL en mode dry-run → assert le payload Convex (chiffré, `userId` préservé, pas de doublon au 2e run).
**Step 2:** Échec.
**Step 3:** Implémenter l'ETL (lit SQLite, chiffre, `mutation` batch upsert Convex via HTTP client).
**Step 4:** Test passe.
**Step 5:** Commit `feat(convex): idempotent encrypted ETL for supplements`.

**➡️ Gate Phase 0 :** le domaine `supplements` fonctionne end-to-end sur Convex en dev (flag ON localement), tests verts, build 0. On a prouvé : schéma + isolation + Foyer + chiffrement + ETL + hook + flag. C'est le **template** répété pour chaque domaine.

---

## Phase 1→6 — Répéter le template Phase 0 par domaine

Pour **chaque** domaine dans l'ordre `notes, symptoms, biomarkers, dna, reports, habits/weekly, nutrition`, répéter Tasks 0.3→0.6 (schéma → fonctions isolées → hook/flag → ETL). Points spécifiques par domaine :

- **biomarkers** : gros volume + chiffrement des valeurs ⇒ index sur `(userId, slug, date)` non chiffrés pour les timelines ; les `series/latest/compare` deviennent des Convex queries paginées. C'est le domaine le plus consommé (dashboard, sparklines, reports) — migrer ses ~10 routes ensemble.
- **dna** : `dna_insight` volumineux ; génotypes chiffrés ; catalog reste statique en code (pas en DB).
- **reports** : voir Phase 3 (génération lourde) — la LECTURE des rapports migre ici, la GÉNÉRATION reste worker VPS.
- **household** : `household_link` + les fonctions `effectiveUserId/hasActiveLink` doivent être **nativement** dans `convex/lib/auth.ts` (déjà amorcé Task 0.4). Reproduire `tests/isolation.test.ts` "viewing requires ACTIVE link" en convex-test.

Chaque domaine = 1 PR, flag basculé en prod seulement après ETL prod vérifié + smoke.

---

## Phase 3 (spéciale) — Génération de rapports (worker VPS ↔ Convex)

**Files:**
- Modify: `scripts/gen-report.mjs`, `scripts/gen-doctor-pack.mjs`, `app/api/reports/generate/route.ts`, `app/api/reports/[id]/status/route.ts`

- La route `generate` crée un doc Convex `report {status:'pending'}` (mutation) puis spawn le worker détaché (inchangé, sur le VPS).
- Le worker génère (Anthropic), **chiffre** le corps, et écrit `status:'done', body:<cipher>` via le Convex HTTP client.
- Le client n'a plus besoin de poller `/status` : `useQuery(api.reports.get)` est **réactif** (le doc passe à `done` tout seul) — c'est un vrai gain UX de la migration.
- Test : mock worker → mutation `pending` → mutation `done` → `useQuery` reflète la transition.

---

## Phase 7 (spéciale) — Chat SSE + RAG/Search

- **Chat streaming** : garder la route `app/api/chat/route.ts` en SSE (Anthropic stream) — Convex n'est pas idéal pour du token-streaming HTTP. Convex stocke `chat_session`/`chat_message` (persistance + auto-rename), la route lit/écrit via Convex. Le stream reste un ReadableStream Next.
- **RAG BM25** : les champs chiffrés cassent le search. Deux options, à trancher à ce moment :
  - (A) garder l'index RAG (`rag_chunk`/`rag_keyword`) **côté VPS SQLite** comme service de recherche dédié (Convex ne stocke pas le KB médical en clair) — recommandé pour confidentialité.
  - (B) déchiffrer côté worker et pousser dans Convex full-text search (expose le KB en clair sur Convex — à éviter).

---

## Phase 8 (optionnelle) — Auth → Convex Auth

Seulement si l'utilisateur le veut après stabilisation data. Couvre : bcrypt→Convex Auth password provider, TOTP, password_reset, sessions, middleware. Gros morceau, plan séparé. Tant que non fait, iron-session émet un token signé que les fonctions Convex valident.

---

## Verification (à chaque phase)

- `npm run build` exit 0, `npm run lint` exit 0.
- Tests convex-test verts + guard d'isolation Convex (nouveau) vert.
- `/api/health-check` = 200 en dev et après deploy.
- Smoke manuel du domaine migré, flag ON et OFF (rollback = rebascule flag).
- Foyer : lien actif → lecture du membre OK, aucune écriture sur son compte ; lien pending → aucun accès.
- Après ETL prod : diff de comptage lignes SQLite vs docs Convex par `userId`.

## Rollback

Chaque domaine derrière `DATA_BACKEND.<domain>`. Régression ⇒ rebascule le flag sur `sqlite` (les données SQLite ne sont supprimées qu'après 1 semaine de stabilité Convex confirmée, jamais avant). L'ancien code SQLite n'est retiré qu'en toute fin, domaine par domaine.

## Ce qui reste sur le VPS (ne migre pas vers Convex)

Worker de génération de rapports, index RAG/KB médical (option A), crons `send_reminders`/`ingest`, clé de chiffrement `data/auth.json`, pipeline d'ingestion PDF/23andMe (parse lourd ⇒ écrit dans Convex à la fin).

---

## Estimation honnête

- Phase 0 (POC 1 domaine) : ~1-2 j — **c'est le vrai go/no-go**, on saura si le pattern tient.
- Phases 1-6 (8 domaines × template) : ~1.5-2 semaines.
- Phases 3/7 spéciales (reports/chat/RAG) : ~3-4 j.
- Phase 8 auth (si retenue) : ~3-5 j.
- **Total réaliste : 3-4 semaines**, réversible à chaque étape.
