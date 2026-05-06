"use client";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Apple, Salad, Ban, Sparkles, RefreshCw, ChevronDown, ChevronUp, Loader2,
  Coffee, UtensilsCrossed, Moon, Cookie, Activity, Dna, ExternalLink,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { FOOD_BY_SLUG } from "@/lib/nutrition/food-database";
import type { NutritionPlan, NutritionPref, RuleHit } from "@/lib/nutrition/types";
import { PageHeader } from "@/components/page-header";

const TABS = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "favor", label: "À privilégier" },
  { key: "avoid", label: "À éviter" },
  { key: "meals", label: "Par repas" },
  { key: "sources", label: "Sources" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const DEFAULT_PREFS: NutritionPref = { dietType: "omnivore", allergies: [], aversions: "", budget: "medium", cuisines: [] };

const ALLERGY_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "gluten", label: "Gluten" },
  { key: "lactose", label: "Lactose" },
  { key: "nuts", label: "Fruits à coque" },
  { key: "eggs", label: "Œufs" },
  { key: "soy", label: "Soja" },
  { key: "shellfish", label: "Crustacés" },
  { key: "fish", label: "Poisson" },
];

const CUISINE_OPTIONS = ["méditerranéen", "asiatique", "français", "indien", "mexicain", "moyen-orient", "africain", "japonais", "italien", "scandinave"];

export default function NutritionPage() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [prefs, setPrefs] = useState<NutritionPref>(DEFAULT_PREFS);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPlan(force = false) {
    setLoading(!force);
    if (force) setRegenerating(true);
    setError(null);
    try {
      const r = await fetch(`/api/nutrition/plan${force ? "?force=1" : ""}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as NutritionPlan;
      setPlan(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }

  async function loadPrefs() {
    const r = await fetch("/api/nutrition/prefs");
    if (r.ok) setPrefs(await r.json());
  }

  async function savePrefs() {
    setSavingPrefs(true);
    try {
      const r = await fetch("/api/nutrition/prefs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (r.ok) await loadPlan(true);
    } finally { setSavingPrefs(false); }
  }

  useEffect(() => { void loadPrefs(); void loadPlan(); }, []);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Nutrition"
        description="Recommandations personnalisées basées sur ton dernier bilan, ton ADN et tes préférences."
        icon={<Salad className="h-5 w-5 text-emerald" />}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setPrefsOpen((o) => !o)}>
              {prefsOpen ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
              Mes préférences
            </Button>
            <Button onClick={() => loadPlan(true)} disabled={regenerating}>
              {regenerating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Régénérer
            </Button>
          </div>
        }
      />

      <PrefsPanel open={prefsOpen} prefs={prefs} setPrefs={setPrefs} onSave={savePrefs} saving={savingPrefs} />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          Génération du plan…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">{error}</div>
      ) : !plan ? (
        <div className="text-muted-foreground text-sm">Aucun plan disponible.</div>
      ) : (
        <>
          <nav className="flex gap-1 border-b border-border overflow-x-auto scrollbar-thin" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                role="tab"
                aria-selected={tab === t.key}
                className={`relative px-4 py-2 text-sm whitespace-nowrap transition-colors ${tab === t.key ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t.label}
                {tab === t.key && (
                  <motion.span layoutId="nutrition-tab" className="absolute inset-x-2 -bottom-px h-0.5 bg-emerald rounded-full" />
                )}
              </button>
            ))}
          </nav>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {tab === "overview" && <OverviewTab plan={plan} />}
              {tab === "favor" && <FoodGridTab slugs={plan.favoredFoodsSorted} rules={plan.rules} action="favor" />}
              {tab === "avoid" && <FoodGridTab slugs={plan.avoidFoodsSorted} rules={plan.rules} action="avoid" />}
              {tab === "meals" && <MealsTab plan={plan} />}
              {tab === "sources" && <SourcesTab rules={plan.rules} />}
            </motion.div>
          </AnimatePresence>

          {plan.cached && (
            <div className="text-[0.7rem] text-muted-foreground/70">
              Plan en cache — généré le {new Date(plan.generatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}. Clique sur "Régénérer" pour recalculer.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PrefsPanel({ open, prefs, setPrefs, onSave, saving }: {
  open: boolean; prefs: NutritionPref; setPrefs: (p: NutritionPref) => void; onSave: () => void; saving: boolean;
}) {
  function toggleAllergy(key: string) {
    const list = new Set(prefs.allergies);
    if (list.has(key)) list.delete(key); else list.add(key);
    setPrefs({ ...prefs, allergies: [...list] });
  }
  function toggleCuisine(c: string) {
    const list = new Set(prefs.cuisines);
    if (list.has(c)) list.delete(c); else list.add(c);
    setPrefs({ ...prefs, cuisines: [...list] });
  }
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="rounded-xl border border-border bg-card/50 p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground/70">Régime</label>
                <Select value={prefs.dietType} onChange={(e) => setPrefs({ ...prefs, dietType: e.target.value as NutritionPref["dietType"] })} className="mt-1">
                  <option value="omnivore">Omnivore</option>
                  <option value="pescatarian">Pescatarien</option>
                  <option value="vegetarian">Végétarien</option>
                  <option value="vegan">Végan</option>
                  <option value="keto">Cétogène</option>
                  <option value="carnivore">Carnivore</option>
                </Select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground/70">Budget</label>
                <Select value={prefs.budget} onChange={(e) => setPrefs({ ...prefs, budget: e.target.value as NutritionPref["budget"] })} className="mt-1">
                  <option value="low">Économique</option>
                  <option value="medium">Standard</option>
                  <option value="premium">Premium / bio</option>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground/70">Allergies / intolérances</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {ALLERGY_OPTIONS.map((a) => {
                  const active = prefs.allergies.includes(a.key);
                  return (
                    <button
                      key={a.key} type="button" onClick={() => toggleAllergy(a.key)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition ${active ? "bg-red-500/15 border-red-500/40 text-red-300" : "border-border hover:bg-secondary/40 text-muted-foreground"}`}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground/70">Cuisines préférées</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {CUISINE_OPTIONS.map((c) => {
                  const active = prefs.cuisines.includes(c);
                  return (
                    <button
                      key={c} type="button" onClick={() => toggleCuisine(c)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition ${active ? "bg-emerald/15 border-emerald/40 text-emerald" : "border-border hover:bg-secondary/40 text-muted-foreground"}`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground/70">Aversions (séparées par virgule)</label>
              <Textarea
                value={prefs.aversions}
                onChange={(e) => setPrefs({ ...prefs, aversions: e.target.value })}
                placeholder="ex: foie, aubergine, coriandre"
                rows={2}
                className="mt-1"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={onSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Enregistrer et régénérer
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OverviewTab({ plan }: { plan: NutritionPlan }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald/20 bg-emerald/5 p-6">
        <div className="text-xs uppercase tracking-wider text-emerald/80 font-medium">Pattern recommandé</div>
        <div className="text-2xl font-semibold mt-1">{plan.dietPattern.label}</div>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{plan.dietPattern.description}</p>
        <div className="mt-4 grid grid-cols-3 gap-3 max-w-md">
          <MacroCard label="Protéines" value={plan.macros.protein} />
          <MacroCard label="Glucides" value={plan.macros.carbs} />
          <MacroCard label="Lipides" value={plan.macros.fat} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/30 p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-3">Synthèse</div>
        <div className="prose-chat">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2">{children}</h2>,
              h2: ({ children }) => <h3 className="text-sm font-semibold mt-4 mb-2 text-emerald">{children}</h3>,
              h3: ({ children }) => <h4 className="text-sm font-semibold mt-3 mb-1.5">{children}</h4>,
              p: ({ children }) => <p className="my-2 leading-relaxed text-sm">{children}</p>,
              ul: ({ children }) => <ul className="my-2 ml-4 space-y-1 list-disc text-sm marker:text-emerald/60">{children}</ul>,
              li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
            }}
          >
            {plan.rationale}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function MacroCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card/60 border border-border px-3 py-2">
      <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground/70">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

function FoodGridTab({ slugs, rules, action }: { slugs: string[]; rules: RuleHit[]; action: "favor" | "avoid" }) {
  // Group by benefit (from the rules that mention each food)
  const groups = useMemo(() => {
    const benefitToFoods = new Map<string, Set<string>>();
    for (const r of rules.filter((x) => x.action === action)) {
      for (const slug of r.foodSlugs) {
        if (!slugs.includes(slug)) continue;
        if (!benefitToFoods.has(r.benefit)) benefitToFoods.set(r.benefit, new Set());
        benefitToFoods.get(r.benefit)!.add(slug);
      }
    }
    return [...benefitToFoods.entries()].map(([benefit, set]) => ({ benefit, foods: [...set] }));
  }, [rules, slugs, action]);

  if (slugs.length === 0) {
    return <div className="text-sm text-muted-foreground py-12 text-center">Aucun aliment dans cette catégorie pour le moment. Importe ton bilan ou ton ADN pour démarrer.</div>;
  }

  const Icon = action === "favor" ? Salad : Ban;
  const accent = action === "favor" ? "emerald" : "red";

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.benefit}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Icon className={`h-4 w-4 text-${accent}`} />
            {g.benefit}
            <span className="text-xs text-muted-foreground/60">({g.foods.length})</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {g.foods.map((slug) => {
              const food = FOOD_BY_SLUG[slug];
              if (!food) return null;
              const reasons = rules
                .filter((r) => r.action === action && r.benefit === g.benefit && r.foodSlugs.includes(slug))
                .slice(0, 2)
                .map((r) => `${r.subjectLabel}: ${r.reason}`);
              return (
                <motion.div
                  key={slug}
                  initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.15 }}
                  className={`rounded-xl border p-3 ${action === "favor" ? "border-emerald/20 bg-emerald/5" : "border-red-500/20 bg-red-500/5"}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-2xl shrink-0" aria-hidden>{food.emoji}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{food.label}</div>
                      <div className="text-[0.7rem] text-muted-foreground/70 capitalize">{food.category.replace("-", " ")}</div>
                    </div>
                  </div>
                  {reasons.length > 0 && (
                    <p className="text-[0.7rem] text-muted-foreground mt-2 leading-snug line-clamp-3" title={reasons.join(" • ")}>
                      {reasons[0]}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function MealsTab({ plan }: { plan: NutritionPlan }) {
  const sections = [
    { key: "breakfast", label: "Petit-déjeuner", icon: Coffee, items: plan.mealIdeas.breakfast },
    { key: "lunch", label: "Déjeuner", icon: UtensilsCrossed, items: plan.mealIdeas.lunch },
    { key: "dinner", label: "Dîner", icon: Moon, items: plan.mealIdeas.dinner },
    { key: "snacks", label: "Collations", icon: Cookie, items: plan.mealIdeas.snacks },
  ] as const;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sections.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.key} className="rounded-xl border border-border bg-card/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium mb-3">
              <Icon className="h-4 w-4 text-emerald" />
              {s.label}
            </div>
            <ul className="space-y-2">
              {(s.items ?? []).map((m, i) => (
                <li key={i} className="text-sm text-muted-foreground leading-relaxed flex gap-2">
                  <Apple className="h-3.5 w-3.5 text-emerald/60 shrink-0 mt-0.5" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function SourcesTab({ rules }: { rules: RuleHit[] }) {
  const grouped = useMemo(() => {
    const byBenefit = new Map<string, RuleHit[]>();
    for (const r of rules) {
      if (!byBenefit.has(r.benefit)) byBenefit.set(r.benefit, []);
      byBenefit.get(r.benefit)!.push(r);
    }
    return [...byBenefit.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rules]);

  if (rules.length === 0) {
    return <div className="text-sm text-muted-foreground py-12 text-center">Aucune règle déclenchée — importe d'abord un bilan sanguin et/ou ton ADN.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="text-xs text-muted-foreground/70">
        {rules.length} règle{rules.length > 1 ? "s" : ""} déclenchée{rules.length > 1 ? "s" : ""} par tes données. Clique sur une règle pour voir le biomarqueur ou le variant ADN source.
      </div>
      {grouped.map(([benefit, rs]) => (
        <section key={benefit}>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">{benefit}</h3>
          <div className="space-y-2">
            {rs.map((r) => (
              <Link
                key={r.ruleKey}
                href={r.href ?? "#"}
                className={`block rounded-lg border p-3 transition hover:bg-secondary/30 ${r.action === "favor" ? "border-emerald/20" : "border-red-500/20"}`}
              >
                <div className="flex items-start gap-2 text-sm">
                  {r.source === "biomarker" ? <Activity className="h-3.5 w-3.5 text-emerald shrink-0 mt-0.5" /> : <Dna className="h-3.5 w-3.5 text-emerald shrink-0 mt-0.5" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{r.subjectLabel}</span>
                      <span className={`text-[0.65rem] px-1.5 py-0.5 rounded uppercase tracking-wider ${r.action === "favor" ? "bg-emerald/15 text-emerald" : "bg-red-500/15 text-red-300"}`}>
                        {r.action === "favor" ? "favoriser" : "éviter"}
                      </span>
                      <span className={`text-[0.65rem] px-1.5 py-0.5 rounded uppercase tracking-wider ${r.priority === "high" ? "bg-red-500/15 text-red-300" : r.priority === "moderate" ? "bg-amber-500/15 text-amber-300" : "bg-secondary/60 text-muted-foreground"}`}>
                        {r.priority}
                      </span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">{r.reason}</p>
                    <div className="text-[0.7rem] text-muted-foreground/70 mt-1.5">
                      {r.foodSlugs.slice(0, 6).map((s) => FOOD_BY_SLUG[s]?.label).filter(Boolean).join(", ")}
                      {r.foodSlugs.length > 6 ? ` +${r.foodSlugs.length - 6}` : ""}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
