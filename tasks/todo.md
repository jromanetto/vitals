# Sprint Welcome Report WOW — todo dev

**Objectif** : créer le moment WOW de Vitals — un Welcome Report personnalisé généré dès le 1er upload, avec 3 "What We Noticed" cards spookily précises, un Doctor Pack premium, et un kit de partage (PNG + email). Pour les 10 premiers founder members.

**Budget** : ~70-75h eng sur 8 semaines (10h/sem soir+weekend). Skip Stripe / paywall pour ce sprint — payment dans un sprint suivant.

**Acceptance globale** :
- Noelly et 9 autres founders ont un `role="founder"` et zéro feature gate
- Chaque founder qui uploade ≥1 PDF voit son Welcome Report personnalisé en <90s
- Les 3 cards sont *spookily précises* (pas génériques, citent valeurs exactes, jamais diagnostic)
- Doctor Pack regénéré est partageable A4 premium
- Anonymize LLM + prompt caching ON sur les 11 endpoints (non-régression)
- Golden tests + kill switch en place

---

## Phase 0 — Compliance & cost safety (prereqs, non-négo) — **9h**

- [ ] **0.1** Audit `lib/anonymize.ts` : lire ce qu'il fait, vérifier la liste des champs strippés (firstName, lastName, email, phone, birthDate→age, birthPlace, currentLocation, emergencyContact, pedigree.{rel}.name) — **0.5h**
- [ ] **0.2** Wrapper unique `withAnonymizedProfile(profile)` dans `lib/anonymize.ts` que tous les endpoints LLM appellent obligatoirement — **1h**
- [ ] **0.3** Appliquer le wrapper aux 11 endpoints LLM : `/api/chat`, `/api/action-plan`, `/api/profile/auto-extract`, `/api/recommendations`, `/api/nutrition/plan`, `/api/biomarkers/[slug]/commentary`, `/api/profile/import`, `/api/blood-tests/report`, `/api/reports/doctor-pack`, `/api/reports/generate`, `/api/rag/search`, `/api/supplements/from-url` — **2h**
- [ ] **0.4** Test que l'anonymisation fonctionne : log côté serveur de tout payload envoyé à Anthropic — assertion "no PII" via regex (email, FR phone format, etc.) — **0.5h**
- [ ] **0.5** Activer `cache_control: { type: "ephemeral" }` sur les system prompts des 11 endpoints LLM (gros gain $/latence) — **3h**
- [ ] **0.6** Créer table `llm_usage` (userId, endpoint, inputTokens, outputTokens, cachedTokens, costUsd, createdAt) + write-back depuis chaque endpoint Anthropic — **1.5h**
- [ ] **0.7** Update `/legal/privacy` : flippé "Anonymisation LLM activable" → "Anonymisation LLM **active par défaut**" + ajouter ligne "Sous-traitant Anthropic (US), envoi de données anonymisées uniquement" — **0.5h**
- [ ] **0.8** Vérifier que le VPS dallas3 est bien en UE (curl ipinfo ou whois) — si pas Belgique, update privacy en conséquence — **0.5h**

---

## Phase 1 — Golden tests setup (avant tout LLM dev) — **6h**

- [ ] **1.1** Restaurer Vitest setup (existait dans `vitals.bak.2026-05-08` — package.json a déjà `vitest`, vérifier `vitest.config.ts`) — **1h**
- [ ] **1.2** Créer `tests/fixtures/welcome-profiles/` avec 5 profils :
  - `julien.json` (complet : ~30 biomarkers réels + 138 DNA insights + family riche)
  - `marie-dna-only.json` (juste 23andMe parsé)
  - `pierre-bloodwork-only.json` (juste PDFs récents)
  - `sarah-family-heavy.json` (peu perso, family riche)
  - `empty-minimal.json` (firstName + birthDate + sex only) — **2h**
- [ ] **1.3** Écrire `tests/welcome-report.test.ts` avec assertions par fixture (cf. Q11 détails) — **2h**
- [ ] **1.4** Safety assertions globales (jamais "tu souffres de", toujours include "discute médecin", jamais "100% certain") — **0.5h**
- [ ] **1.5** Ajouter `npm test` au workflow GitHub Actions deploy → si rouge, deploy fail — **0.5h**

---

## Phase 2 — Welcome Report algorithm + LLM — **10h**

- [ ] **2.1** Créer `lib/welcome-report/select-signals.ts` : algo déterministe qui retourne 3 signaux ranked from profile data — **3h**
  - Card 1 : pire biomarker × clinical_weight × cross-ref DNA × cross-ref family (paire amplifiante = score x2)
  - Card 2 : meilleur DNA protective (sort by category_weight × magnitude) avec fallback "Force lifestyle"
  - Card 3 : top family risk × heritability × ageOfDiagnosis × applicable screening, avec fallback "Symptômes à surveiller"
- [ ] **2.2** Créer `lib/welcome-report/generate.ts` : pour chaque signal, 1 LLM call qui retourne `{title, body3lines}` selon le prompt Q9 — **3h**
- [ ] **2.3** Ajouter prompt caching sur le system prompt commun aux 3 cards (économie ~80%) — déjà couvert par 0.5
- [ ] **2.4** Edge cases : pas de PDF → CTA "Uploade un bilan" ; pas d'ADN → Card 2 fallback ; pas de family → Card 3 fallback ; mineur → désactiver le report — **1.5h**
- [ ] **2.5** Red flag : si activeSymptoms contient un red-flag (chest_pain, blood_stool, etc.), ajouter une **4ème card non-skippable** "⚠️ À discuter rapidement avec ton médecin" — **0.5h**
- [ ] **2.6** Disclaimer footer markdown : "Cette analyse est générée par IA…" — **0.5h**
- [ ] **2.7** Test golden : chaque fixture produit le bon nombre de cards + clés assertions passent — **1h**

---

## Phase 3 — Welcome Report UI (polling page + cards) — **12h**

- [ ] **3.1** Route `app/welcome/report/page.tsx` (server component qui crée le report row, fire-and-forget la generation) — **2h**
- [ ] **3.2** Endpoint `POST /api/reports/welcome` qui :
  - INSERT INTO report (kind='welcome', status='pending', meta={progress: 0, step: "parsing"}, user_id)
  - Async kick-off `processWelcomeReport(reportId)` (fire-and-forget)
  - Renvoie l'id immédiatement — **2h**
- [ ] **3.3** `processWelcomeReport(reportId)` server-side :
  - Update progress: 25% "Extraction des biomarqueurs"
  - Run select-signals algo
  - Update progress: 50% "Analyse génétique"
  - Run generate (3 LLM calls)
  - Update progress: 75% "Génération de l'analyse"
  - Store body markdown + meta.cards JSON
  - Update progress: 100%, status='ready'
  - Send email (Phase 5) — **2h**
- [ ] **3.4** UI live polling : page qui poll `/api/reports/[id]/status` toutes les 2s, ticker live "✓ 12 biomarqueurs extraits / ⏳ Analyse génétique…" — **2h**
- [ ] **3.5** Skip button visible "Aller au dashboard, je verrai plus tard" → redirige + le report apparaît en card dashboard quand prêt — **1h**
- [ ] **3.6** Page cards : 3 cards stylées (couleur thématique par catégorie), avec icônes lucide-react, animations framer-motion d'entrée stagger — **3h**

---

## Phase 4 — Vitals Score + Doctor Pack premium — **18h**

- [ ] **4.1** Polish `lib/scoring/longevity.ts` : score 0-100 unique avec catégories (cardio, métabolique, longévité, sommeil, mental). Calcul déterministe, pas LLM — **3h**
- [ ] **4.2** Comparaison cohorte anonymized : "Tu es dans le top X% des [sex] de [age] ans" via percentile sur les biomarker-meta optimal ranges — **3h**
- [ ] **4.3** Composant `<VitalsScoreGauge>` visuel (radial gauge + breakdown 5 catégories) — déjà existe partiellement dans `score-breakdown.tsx`, à raffiner — **2h**
- [ ] **4.4** Insert le Vitals Score sur le Welcome Report en card #0 (au-dessus des 3 cards) — **0.5h**
- [ ] **4.5** Doctor Pack redesign premium :
  - Cover page brandée (logo + patient name + date)
  - Table des matières
  - Section "Pour mon médecin généraliste" (résumé exécutif 1 page)
  - Section "Pour mon naturopathe / médecine fonctionnelle" (biomarkers + DNA)
  - Section "Suivi mensuel" (timeline 60j)
  - CSS print A4 parfait — **8h**
- [ ] **4.6** Test print sur Mac (Cmd+P → Save as PDF) : marges, page breaks, no chrome — **1.5h**

---

## Phase 5 — Email parallèle + partage PNG — **8h**

- [ ] **5.1** Template email `WelcomeReportTemplate(reportId, userId)` dans `lib/email.ts` — HTML responsive avec les 3 cards + Vitals Score + lien CTA "Voir mon dossier complet" — **3h**
- [ ] **5.2** Envoi via Resend depuis `processWelcomeReport()` une fois status=ready — **0.5h**
- [ ] **5.3** Génération PNG style "story Instagram" du Welcome Report : composant React → `html2canvas` ou `satori` (Next.js bundle) → PNG download — **3h**
- [ ] **5.4** Bouton "Partager mon résumé" sur la page report → download PNG + UTM source pour tracking — **1.5h**

---

## Phase 6 — Feedback widget + kill switch — **4h**

- [ ] **6.1** Composant `<CardFeedback>` (👍 / 👎 / 💬) sous chaque card — **1h**
- [ ] **6.2** Endpoint `POST /api/feedback` + table `card_feedback (userId, reportId, cardIndex, rating, comment?, createdAt)` — **1h**
- [ ] **6.3** Page admin minimal `/admin/feedback` (visible only `role="owner"`) listant les feedbacks récents — **1.5h**
- [ ] **6.4** Env var `VITALS_WELCOME_REPORT_ENABLED` côté serveur → si `false`, fallback page basique "Bienvenue, voici tes biomarkers + 3 ressources" — **0.5h**

---

## Phase 7 — Email weekly digest (retention) — **6h**

- [ ] **7.1** Cron route `/api/cron/weekly-digest` (protected par secret env var) qui itère sur les users actifs (last activity <30j) — **1.5h**
- [ ] **7.2** Pour chaque user, sélectionner les "deltas" de la semaine : nouveau biomarker added, symptom flagged red-flag, screening overdue, etc. — **2h**
- [ ] **7.3** Template email `WeeklyDigestTemplate(deltas)` — **1.5h**
- [ ] **7.4** Add cron entry sur le VPS (systemd timer ou node-cron) hebdo dimanche soir — **1h**

---

## Phase 8 — Founder member grandfathering — **3h**

- [ ] **8.1** Migration : ajouter ou confirmer la column `role` dans table `user` (déjà créé par script invite_user.mjs)
- [ ] **8.2** Helper `isFounder(userId)` dans `lib/auth.ts`
- [ ] **8.3** Bypass tout futur feature gate quand `isFounder` → true
- [ ] **8.4** Marquer Noelly + futurs 9 premiers users avec `role="founder"` via `scripts/invite_user.mjs` (déjà supporté) ou un script `scripts/promote_to_founder.mjs`

---

## Phase 9 — Polish + 5-test ritual + ship — **6h**

- [ ] **9.1** UX polish : transitions, loading states, empty states sur Welcome Report
- [ ] **9.2** Mobile responsiveness check sur Welcome Report + Doctor Pack
- [ ] **9.3** Le rituel 5-test : lancer le report sur `julien.json` fixture → 5 critères eyeball (cf. Q11) → fix prompts si fail
- [ ] **9.4** Deploy + smoke test prod : login Noelly → uploader 1-2 PDFs test → vérifier que le flow welcome → polling → report → email marche end-to-end
- [ ] **9.5** Documentation : `docs/welcome-report.md` expliquant l'algo + comment ajouter une fixture future

---

## 🚦 Ordre des semaines (10h/sem)

| Semaine | Phases | Heures |
|---|---|---|
| S1 | Phase 0 (compliance) + début Phase 1 (golden tests setup) | 10h |
| S2 | Fin Phase 1 + début Phase 2 (algorithme + LLM) | 10h |
| S3 | Fin Phase 2 + début Phase 3 (UI report) | 10h |
| S4 | Fin Phase 3 + début Phase 4 (Vitals Score) | 10h |
| S5 | Fin Phase 4 (Doctor Pack premium) | 10h |
| S6 | Phase 5 (email + PNG share) + Phase 6 (feedback + kill switch) | 10h |
| S7 | Phase 7 (weekly digest) + Phase 8 (founder grandfathering) | 8h |
| S8 | Phase 9 (polish + 5-test + ship) | 8h |

**Total** : ~76h sur 8 semaines, dont 8h de tampon pour les imprévus.

---

## ⛔ Hors-scope explicite ce sprint

- Stripe / payment integration (sprint suivant après validation founders)
- Pricing page publique (idem)
- Upgrade modals contextuels
- Sondage NPS / churn analysis
- Mobile PWA installable (nice-to-have)
- Tests unitaires sur le reste de la codebase (uniquement welcome-report ici)
- Migration HDS (déclenchée par revenue, pas par features)

---

## 📌 Acceptance criteria globaux

1. ✅ Noelly + 9 founders ont `role="founder"` en DB
2. ✅ Anonymize.ts active sur les 11 endpoints LLM, vérifié par logs
3. ✅ Prompt caching activé partout (gain mesurable dans `llm_usage` table)
4. ✅ Welcome Report apparaît <90s après upload (médiane sur les 5 fixtures)
5. ✅ Golden tests verts dans CI (bloque deploy si rouge)
6. ✅ Doctor Pack imprimable en A4 sans chrome
7. ✅ Email parallèle envoyé via Resend pour chaque report ready
8. ✅ PNG share download fonctionne, sans PII visible si user opt-out
9. ✅ Kill switch testé (env var flip → fallback page)
10. ✅ 5-test eyeball passé sur `julien.json` avant chaque deploy prompt-touchant

---

## Review

À remplir en fin de sprint :
- Combien de founders effectivement onboardés
- Combien de Welcome Reports générés
- Coût Anthropic réel mois-1
- Feedback NPS / 👍-👎 ratio
- Bugs majeurs rencontrés
- Décisions à prendre pour le sprint suivant (= activation Stripe ?)
