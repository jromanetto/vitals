# Volet Nutrition — Design

**Date** : 2026-05-04
**Scope** : page `/nutrition` qui fournit recommandations alimentaires personnalisées basées sur dernier bilan + DNA + préférences utilisateur.

## Décisions de scope (validées avec l'utilisateur)

- **Approche** : recommandations passives (page lecture, pas de meal planner ni journal alimentaire)
- **Génération** : hybride — rules engine (déterministe) + Claude (synthèse/narratif)
- **Granularité** : ~70 règles (35 biomarkers + 35 DNA)
- **UI** : tabs (Vue d'ensemble / À privilégier / À éviter / Par repas / Sources)
- **Personnalisation** : panneau prefs inline collapsé sur `/nutrition`, persisté DB
- **Cache** : 30 jours via `report` table avec dataHash + prefsHash, bouton "Régénérer" pour forcer

## Architecture

```
lib/nutrition/
  food-database.ts   # ~150 aliments (slug, label, emoji, catégorie, tags)
  diet-patterns.ts   # ~10 patterns (méditerranéen, low-carb, DASH, MIND, FODMAP, ...)
  catalog.ts         # 35 règles biomarkers → foods + raison
  dna-rules.ts       # 35 règles SNP → foods + raison
  rules-engine.ts    # match (biomarkers, DNA, prefs) → MatchedRules + filtered foods
  prompt.ts          # build prompt Claude → JSON synthèse
  types.ts           # shared types

app/api/nutrition/
  plan/route.ts      # GET — orchestrate rules + Claude + cache
  prefs/route.ts     # GET/POST — read/upsert nutrition_pref

app/(app)/nutrition/
  page.tsx           # tabs UI + collapsible prefs panel
```

## Data model

Nouvelle table `nutrition_pref` (single-row, single-user):
- `diet_type` : omnivore | pescatarian | vegetarian | vegan | keto | carnivore
- `allergies` : JSON array (gluten, lactose, nuts, eggs, soy, shellfish, fish)
- `aversions` : free-text
- `budget` : low | medium | premium
- `cuisines` : JSON array (mediterranean, asian, french, mexican, ...)
- `updated_at`

Cache via `report(kind='nutrition', meta={dataHash, prefsHash}, body=JSON)`.

## Flow runtime

1. Page load → fetch `/api/nutrition/plan`
2. API : auth → ensureSchema → load profile + latest biomarkers + DNA insights + prefs
3. Compute `dataHash` (sha256 of biomarkers+dna+profile-relevant-fields) + `prefsHash`
4. Lookup `report` kind=nutrition with matching hashes → if hit and < 30j → return cached
5. Miss path :
   - `rules-engine.run(biomarkers, dna, prefs)` → `MatchedRules[]` + raw `favoredFoods[]` + `avoidFoods[]`
   - Filter foods through prefs (allergies, aversions, dietType compatibility)
   - Build prompt → Claude (claude-sonnet-4-5-20250929) → JSON synthèse :
     ```json
     {
       "dietPattern": "Méditerranéen low-carb modifié",
       "macros": { "protein": "1.6 g/kg", "carbs": "30%", "fat": "45%" },
       "rationale": "## Synthèse\n...",
       "mealIdeas": {
         "breakfast": [...], "lunch": [...], "dinner": [...], "snacks": [...]
       },
       "favoredFoodsSorted": ["food-slug", ...],
       "avoidFoodsSorted": ["food-slug", ...]
     }
     ```
   - Persist + return
6. UI render tabs

## Claude prompt strategy

System : "Tu es nutritionniste fonctionnel. Tu reçois des règles déjà appliquées (biomarker/SNP → aliments). Ton job : synthétiser en régime cohérent + meal ideas concrètes. Réponds STRICTEMENT en JSON valide selon le schéma fourni. Ne réinvente pas les règles — utilise celles fournies."

User : sérialisation des matched rules + prefs + profile résumé.

`response_format` JSON via instructions explicites + parse + validation Zod.

## UI tabs

1. **Vue d'ensemble** : hero avec dietPattern + macros + rationale markdown
2. **À privilégier** : grid de FoodCard (emoji, label, "Pourquoi : ...") groupé par bénéfice (anti-inflammatoire / fer / méthylation / antioxydant / oméga-3 / etc.)
3. **À éviter** : grid rouge groupé par raison (intolérance génétique / biomarker out-of-range / interactions med)
4. **Par repas** : 4 colonnes (matin/midi/soir/snacks) avec 3-5 idées chacune
5. **Sources** : liste de toutes les règles déclenchées avec lien vers `/biomarkers/[slug]` et `/dna/[category]`

Header : prefs panel collapsé + bouton "Régénérer" (force=1).

## Cohérence avec l'existant

- Mirror exact de `/api/supplements/suggestions` (rules-based) + `/api/biomarkers/[slug]/commentary` (Claude + cache 30j via report table)
- Réutilise `META_BY_SLUG` de `lib/biomarker-meta.ts`, `decryptProfile` de `lib/crypto-fields.ts`
- Pattern "trigger function" identique
- Sidebar + Cmd-K mirroring `/supplements`

## Hors scope

- Meal planner hebdo détaillé (deferred)
- Journal alimentaire / log repas (deferred)
- Shopping list auto (deferred)
- Base CIQUAL/USDA macros par 100g (deferred)
- Recipes IA (deferred)

## Definition of Done

- [ ] schema + migrate idempotent
- [ ] 4 fichiers lib/nutrition/ (food-database, diet-patterns, catalog, dna-rules)
- [ ] rules-engine + prompt + types
- [ ] 2 routes API (plan + prefs)
- [ ] page UI + tabs + prefs panel
- [ ] sidebar + Cmd-K + page in `/api/search` static pages
- [ ] `npm run build` exit 0
- [ ] `npm run lint` clean
- [ ] smoke test : `/nutrition` charge avec mock data, regen marche
- [ ] `/api/health-check` toujours 200
- [ ] README + COMPLETE.md + ROADMAP mis à jour
