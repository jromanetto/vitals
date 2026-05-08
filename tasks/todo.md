# Onboarding exhaustif — plan d'exécution

**Objectif** : étendre le profil santé pour collecter de manière exhaustive et ergonomique (chips/checkboxes, branchement conditionnel) les informations nécessaires aux scoring rules, recommandations et rapports médecin.

## Phase 1 — Foundations [DONE]
- [x] `lib/medical/types.ts` — types partagés (FamilyHistory, Frequency, Wearable…)
- [x] `lib/medical/disease-catalog.ts` — 50 maladies par catégorie + heritability
- [x] `lib/medical/symptom-catalog.ts` — 38 symptômes par système corporel + red flags
- [x] `lib/medical/screening-catalog.ts` — 22 examens périodiques avec gating âge/sexe + helper `statusForScreening`
- [x] `lib/medical/relatives.ts` — 10 relatives (parents, 4 grands-parents, fratrie, enfants, oncles/tantes)

## Phase 2 — UI primitives [DONE]
- [x] `components/profile/frequency-chips.tsx`
- [x] `components/profile/scale-buttons.tsx`
- [x] `components/profile/yes-no-unknown.tsx`
- [x] `components/profile/wearables-chips.tsx`
- [x] `components/profile/family-disease-grid.tsx` — relatives × catégories collapsibles, status pills (Non/Oui/?), âge de diagnostic
- [x] `components/profile/symptom-checklist.tsx` — chips groupées par système, red flag warning
- [x] `components/profile/screening-schedule.tsx` — checklist avec date du dernier examen, statut couleur (à jour/bientôt/en retard)

## Phase 3 — Welcome flow [DONE — par sub-agent]
- [x] Refonte `app/welcome/page.tsx` en flow 8-10 étapes avec branchement conditionnel sex (Femme → cycle) + age (>=45 → screening)
- [x] Sauvegarde labels FR canoniques (`Homme`/`Femme`/`Intersexe`, `Sédentaire`, `Non`/`Occasionnel`/...) — round-trip avec wizard
- [x] Mise à jour `components/onboarding-modal.tsx` : factory `buildSteps(documents)` qui pousse vers `/profile?tab=identite` si ≥1 doc

## Phase 4 — Nouvelles sections [DONE]
Ajoutées dans `components/profile-form.tsx` :
- [x] `familyHistory` (customRenderer) — grille relative × maladie
- [x] `symptomsActive` (customRenderer) — chips symptômes
- [x] `screeningSchedule` (customRenderer) — calendrier examens
- [x] `sleep` — Sommeil & circadien (8 champs)
- [x] `digestion` — Digestion & GI (8 champs)
- [x] `womens` — Cycle & repro femme (16 champs)
- [x] `mens` — Repro homme (8 champs)
- [x] `dentalVision` — Dentaire / vision / audition (9 champs)
- [x] `skin` — Peau & soleil (7 champs)
- [x] `pain` — Douleur chronique (5 champs)
- [x] `energy` — Énergie & vitalité (6 champs)
- [x] `recovery` — Récupération & exposition thermique (8 champs)
- [x] `substances` — Substances détaillées (6 champs)
- [x] `socialWork` — Travail & vie sociale (9 champs)
- [x] `envExposure` — Environnement détaillé (9 champs)
- [x] `topical` — Cosmétiques (5 champs)
- [x] `geneticsExtra` — Tests génétiques approfondis (5 champs)
- [x] `wearablesOwned` — Devices (2 champs)
- [x] `advanceDirectives` — Urgence + directives (6 champs)

## Phase 5 — Wiring wizard [DONE]
- [x] Créé fichiers wizard tabs : `symptomes.tsx`, `screening.tsx`, `reproduction.tsx`, `objectifs.tsx`
- [x] Étendu `medical.tsx` (+ digestion/dentalVision/skin/pain) et `lifestyle.tsx` (+ sleep/energy/recovery/substances)
- [x] Étendu `famille.tsx` avec la grille familyHistory
- [x] Étendu `environnement.tsx` avec envExposure/topical/socialWork (signature `onChange + onPatch`)
- [x] Wizard.tsx : 11 onglets (vs 7), nouveaux Field types : `chipsSingle`, `frequency`, `scale10`, `yesNoUnknown`, `wearables`
- [x] `completion()` étendue pour gérer les `customRenderer` family/symptoms/screening
- [x] `SectionRenderer` route vers FamilyDiseaseGrid / SymptomChecklist / ScreeningSchedule selon `customRenderer`

## Phase 6 — Encryption [DONE — pruned]
- [x] Ajouté à `SENSITIVE_PROFILE_FIELDS` (free-text narratives uniquement) : psychedelicsHistory, painTreatments, geneticPanelOther, emergencyContactName/Phone, preferredPharmacy.
- Décision : `familyHistory`/`activeSymptoms`/`screeningHistory` restent en clair — pas de PII (juste enums/IDs/dates), 500+ cellules à chiffrer aurait explosé le JSON sans bénéfice réel.

## Phase 7 — Verify [DONE]
- [x] `npx tsc --noEmit` : exit 0 (silencieux = clean)
- [x] `npm run build` : exit 0, toutes routes générées (profile = 42.3 kB, welcome = 7.3 kB)
- [ ] Smoke browser : non testé (auth setup `data/auth.json` absent dans le clone frais)

## Review

**Files créés** (12) :
- `lib/medical/{types,disease-catalog,symptom-catalog,screening-catalog,relatives}.ts`
- `components/profile/{frequency-chips,scale-buttons,yes-no-unknown,wearables-chips,family-disease-grid,symptom-checklist,screening-schedule}.tsx`
- `components/profile/sections/{symptomes,screening,reproduction,objectifs}.tsx`

**Files modifiés** (8) :
- `components/profile-form.tsx` — +19 nouvelles sections (~190 lignes), 5 nouveaux Field types, 3 customRenderer dispatches
- `components/profile/sections/{section-renderer,medical,lifestyle,famille,environnement}.tsx`
- `components/profile/wizard.tsx` — +4 imports tabs, 11 onglets total
- `app/welcome/page.tsx` — refonte 8-10 étapes (par sub-agent)
- `components/onboarding-modal.tsx` — factory de steps (par sub-agent)
- `lib/crypto-fields.ts` — +6 champs sensibles narratifs

**Stats** :
- ~140 nouveaux champs structurés sur 19 nouvelles sections
- 50 maladies dans le catalogue héréditaire (avec poids génétique)
- 38 symptômes (8 marqués red-flag → discussion médecin)
- 22 dépistages avec adaptation âge+sexe
- 10 relatives (3 générations) pour la grille famille

**Décisions clés** :
1. Persistance via `profile.data` JSON unique (pas de migration SQL).
2. Speed UX : pills/chips/buttons partout, pas de dropdowns sur les champs critiques. Les 0-10 sont des boutons numérotés, plus rapides qu'un slider.
3. Famille = grille collapsible par catégorie. Une "tab" par relative en haut → utilisateur clique sur un parent et coche dans 11 catégories. Bien plus rapide que la version textarea précédente.
4. Conditionnel : Femme → cycle/repro femme dans tab Reproduction ; Homme → repro homme. Intersexe / non renseigné → les deux affichés. Welcome flow ajoute une étape "Cycle express" si Femme.
5. Encryption : pruned au minimum (uniquement les vrais narratifs). Évite l'explosion JSON.

**Open items pour plus tard** :
- Pas de tests unitaires (suite de tests absente du repo cloné — cf. audit). À ajouter idéalement pour `disease-catalog`, `screening-catalog.statusForScreening`, et le calcul `completion()` des customRenderer.
- Le scoring de risque héréditaire à partir de `familyHistory` × `heritability` n'est pas encore branché aux moteurs de recommandations existants (`/api/recommendations`, scoring DNA). À faire dans un prochain sprint.
- Smoke browser non testé localement (auth setup nécessaire) — à faire après `node scripts/init_auth.mjs`.
- Le mode démo (`isDemoUser`) bloque déjà les writes au profil, donc nouveau onboarding inopérant en démo. Comportement attendu.

**Build** : `npm run build` ✅ exit 0. Aucun warning bloquant. `/profile` 42.3 kB, +12 kB vs avant. Tsc clean.
