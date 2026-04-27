"use client";
import { EnvironmentSection } from "@/components/environment-section";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Save, Sparkles } from "lucide-react";
import Link from "next/link";

type Section = {
  id: string; title: string; description?: string;
  fields: Field[];
};
type Field =
  | { id: string; label: string; type: "text" | "email" | "number" | "date" | "tel" | "url"; placeholder?: string; suffix?: string; col?: 1 | 2 }
  | { id: string; label: string; type: "textarea"; placeholder?: string; rows?: number }
  | { id: string; label: string; type: "select"; options: string[]; col?: 1 | 2 }
  | { id: string; label: string; type: "multi"; options: string[] }
  | { id: string; label: string; type: "checkbox" };

const SECTIONS: Section[] = [
  { id: "identity", title: "Identité", description: "Identification de base.", fields: [
    { id: "firstName", label: "Prénom", type: "text", col: 1 },
    { id: "lastName", label: "Nom", type: "text", col: 1 },
    { id: "email", label: "Email", type: "email", col: 1 },
    { id: "phone", label: "Téléphone", type: "tel", col: 1 },
    { id: "birthDate", label: "Date de naissance", type: "date", col: 1 },
    { id: "birthPlace", label: "Lieu de naissance", type: "text", col: 1 },
    { id: "sex", label: "Sexe biologique", type: "select", options: ["", "Homme", "Femme", "Intersexe"], col: 1 },
    { id: "gender", label: "Genre", type: "select", options: ["", "Homme cis", "Femme cis", "Homme trans", "Femme trans", "Non-binaire", "Genderfluid", "Agender", "Autre", "Préfère ne pas répondre"], col: 1 },
  ]},
  { id: "anthro", title: "Anthropométrie", fields: [
    { id: "height", label: "Taille", type: "number", suffix: "cm", col: 1 },
    { id: "weight", label: "Poids", type: "number", suffix: "kg", col: 1 },
    { id: "bodyFat", label: "% masse grasse", type: "number", suffix: "%", col: 1 },
    { id: "muscleMass", label: "Masse musculaire", type: "number", suffix: "kg", col: 1 },
    { id: "waist", label: "Tour de taille", type: "number", suffix: "cm", col: 1 },
    { id: "neck", label: "Tour de cou", type: "number", suffix: "cm", col: 1 },
    { id: "bloodType", label: "Groupe sanguin", type: "select", options: ["", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"], col: 1 },
    { id: "ethnicity", label: "Origine ethnique", type: "select", options: ["", "Européenne (Caucasienne)", "Africaine subsaharienne", "Nord-Africaine / Maghrébine", "Moyen-Orient", "Asiatique de l'Est", "Asiatique du Sud", "Asiatique du Sud-Est", "Hispanique / Latino-Américaine", "Amérindienne", "Océanienne / Pacifique", "Ashkénaze", "Séfarade", "Mixte / multi-ethnique", "Autre", "Préfère ne pas répondre"], col: 1 },
  ]},
  { id: "lifestyle", title: "Mode de vie", fields: [
    { id: "activityLevel", label: "Niveau d'activité", type: "select", options: ["", "Sédentaire", "Léger (1-2x/sem)", "Modéré (3-4x/sem)", "Intense (5-6x/sem)", "Athlète"], col: 1 },
    { id: "sportsPracticed", label: "Sports pratiqués", type: "multi", options: ["Course", "Cyclisme", "Natation", "Musculation", "Yoga", "HIIT", "Escalade", "Tennis", "Football", "Boxe", "Crossfit", "Marche", "Randonnée"] },
    { id: "trainingHoursWeek", label: "Heures de sport / semaine", type: "number", suffix: "h", col: 1 },
    { id: "sleepHours", label: "Sommeil moyen / nuit", type: "number", suffix: "h", col: 1 },
    { id: "sleepQuality", label: "Qualité de sommeil", type: "select", options: ["", "Excellente", "Bonne", "Moyenne", "Mauvaise"], col: 1 },
    { id: "wakeTime", label: "Heure de réveil habituelle", type: "text", col: 1 },
    { id: "stressLevel", label: "Niveau de stress (0-10)", type: "number", col: 1 },
    { id: "screenTime", label: "Temps d'écran / jour", type: "number", suffix: "h", col: 1 },
    { id: "meditation", label: "Méditation", type: "select", options: ["", "Jamais", "Occasionnel", "Hebdo", "Quotidien"], col: 1 },
    { id: "hrv", label: "HRV moyenne (ms)", type: "number", suffix: "ms", col: 1 },
    { id: "restingHr", label: "FC repos", type: "number", suffix: "bpm", col: 1 },
    { id: "vo2max", label: "VO2max", type: "number", suffix: "ml/kg/min", col: 1 },
  ]},
  { id: "diet", title: "Alimentation", fields: [
    { id: "dietType", label: "Type d'alimentation", type: "select", options: ["", "Omnivore", "Flexitarien", "Pescetarien", "Végétarien", "Vegan", "Carnivore", "Cétogène", "Paléo", "Méditerranéen"], col: 1 },
    { id: "intermittentFasting", label: "Jeûne intermittent", type: "select", options: ["", "Non", "12h", "14h", "16h", "18h", "20h+", "OMAD"], col: 1 },
    { id: "mealsPerDay", label: "Repas / jour", type: "number", col: 1 },
    { id: "waterLiters", label: "Eau / jour", type: "number", suffix: "L", col: 1 },
    { id: "alcoholDrinksWeek", label: "Verres d'alcool / sem.", type: "number", col: 1 },
    { id: "caffeineMg", label: "Caféine / jour", type: "number", suffix: "mg", col: 1 },
    { id: "smoker", label: "Fumeur", type: "select", options: ["", "Non", "Occasionnel", "Régulier", "Ex-fumeur"], col: 1 },
    { id: "recreationalDrugs", label: "Substances récréatives", type: "text", col: 1 },
    { id: "allergiesFood", label: "Allergies / intolérances alimentaires", type: "textarea", rows: 2 },
    { id: "foodsAvoided", label: "Aliments évités volontairement", type: "textarea", rows: 2 },
  ]},
  { id: "medical", title: "Antécédents médicaux", fields: [
    { id: "chronicConditions", label: "Maladies chroniques", type: "textarea", rows: 2 },
    { id: "surgeries", label: "Opérations chirurgicales", type: "textarea", rows: 2 },
    { id: "hospitalizations", label: "Hospitalisations notables", type: "textarea", rows: 2 },
    { id: "allergies", label: "Allergies (médicaments, environnement)", type: "textarea", rows: 2 },
    { id: "medications", label: "Médicaments actuels (nom, dose, fréquence)", type: "textarea", rows: 3 },
    { id: "supplements", label: "Compléments alimentaires", type: "textarea", rows: 3 },
    { id: "vaccinations", label: "Vaccinations à jour", type: "textarea", rows: 2 },
    { id: "lastCheckup", label: "Dernier checkup complet", type: "date", col: 1 },
    { id: "lastDental", label: "Dernier dentiste", type: "date", col: 1 },
    { id: "lastEye", label: "Dernier ophtalmo", type: "date", col: 1 },
  ]},
  { id: "family", title: "Antécédents familiaux", description: "Histoire de santé de la famille.", fields: [
    { id: "fatherHealth", label: "Père — santé / pathologies", type: "textarea", rows: 2 },
    { id: "motherHealth", label: "Mère — santé / pathologies", type: "textarea", rows: 2 },
    { id: "grandparentsHealth", label: "Grands-parents — pathologies notables", type: "textarea", rows: 3 },
    { id: "siblingsHealth", label: "Frères et sœurs", type: "textarea", rows: 2 },
    { id: "familyDiseases", label: "Maladies familiales", type: "multi", options: ["Cancer", "Diabète T1", "Diabète T2", "Hypertension", "AVC", "Infarctus", "Alzheimer", "Parkinson", "Cholestérol familial", "Thrombose", "Maladie auto-immune", "Dépression", "Schizophrénie"] },
  ]},
  { id: "mental", title: "Santé mentale & cognition", fields: [
    { id: "moodAvg", label: "Humeur moyenne (0-10)", type: "number", col: 1 },
    { id: "anxietyLevel", label: "Anxiété (0-10)", type: "number", col: 1 },
    { id: "depressionHistory", label: "Antécédents de dépression", type: "textarea", rows: 2 },
    { id: "therapy", label: "Suivi psy actuel ou passé", type: "textarea", rows: 2 },
    { id: "cognitiveConcerns", label: "Concerns cognitives (mémoire, focus…)", type: "textarea", rows: 2 },
  ]},
  { id: "reproductive", title: "Santé sexuelle & reproduction", fields: [
    { id: "sexualActivity", label: "Activité sexuelle", type: "textarea", rows: 2 },
    { id: "contraception", label: "Contraception", type: "text", col: 1 },
    { id: "stiTests", label: "Date du dernier test IST complet", type: "date", col: 1 },
    { id: "fertility", label: "Projet enfant / fertilité", type: "textarea", rows: 2 },
  ]},
  { id: "environment", title: "Environnement & exposition", fields: [] as Field[] },
  { id: "goals", title: "Objectifs & priorités santé", fields: [
    { id: "primaryGoals", label: "Objectifs principaux", type: "multi", options: ["Longévité", "Performance physique", "Perte de masse grasse", "Prise de muscle", "Meilleur sommeil", "Réduction stress", "Optimisation cognitive", "Énergie", "Hormones", "Immunité", "Santé cardiaque", "Microbiote"] },
    { id: "currentChallenges", label: "Défis actuels", type: "textarea", rows: 3 },
    { id: "targetWeight", label: "Poids cible", type: "number", suffix: "kg", col: 1 },
    { id: "longevityTarget", label: "Objectif d'âge en bonne santé", type: "number", suffix: "ans", col: 1 },
    { id: "openToHrt", label: "Ouvert à hormones / peptides / TRT", type: "checkbox" },
    { id: "openToBiohacking", label: "Ouvert au biohacking", type: "checkbox" },
  ]},
  { id: "providers", title: "Praticiens & suivi", fields: [
    { id: "primaryDoctor", label: "Médecin traitant", type: "text" },
    { id: "specialists", label: "Spécialistes consultés", type: "textarea", rows: 3 },
    { id: "preferredLab", label: "Labo de prédilection", type: "text", col: 1 },
    { id: "insurance", label: "Mutuelle / assurance", type: "text", col: 1 },
  ]},
  { id: "freeform", title: "Notes libres", fields: [
    { id: "notes", label: "Tout ce que tu juges utile que l'IA sache de toi", type: "textarea", rows: 6 },
  ]},
];

function completion(section: Section, data: Record<string, unknown>): number {
  if (section.id === "environment") {
    let filled = 0; const max = 5;
    const cur = data.currentLocation as { countryCode?: string; city?: string } | undefined;
    if (cur?.countryCode) filled++;
    if (cur?.city) filled++;
    if (data.occupation) filled++;
    if (data.workEnvironment) filled++;
    if (data.toxicExposure) filled++;
    return Math.round((filled / max) * 100);
  }
  let filled = 0;
  for (const f of section.fields) {
    const v = data[f.id];
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    filled++;
  }
  return Math.round((filled / section.fields.length) * 100);
}

export function ProfileForm({ initial }: { initial: Record<string, unknown> }) {
  const [data, setData] = useState<Record<string, unknown>>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);

  function set<K extends string>(k: K, v: unknown) { setData((d) => ({ ...d, [k]: v })); }
  function toggleMulti(k: string, opt: string) {
    const cur = (data[k] as string[]) || [];
    set(k, cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
  }

  // Auto-save (debounced 1.5s)
  useEffect(() => {
    if (JSON.stringify(data) === JSON.stringify(initial)) return;
    const t = setTimeout(async () => {
      setSaving(true);
      const res = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      setSaving(false);
      if (res.ok) setSavedAt(new Date());
    }, 1500);
    return () => clearTimeout(t);
  }, [data, initial]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
      <nav className="md:sticky md:top-20 md:self-start md:max-h-[calc(100vh-6rem)] md:overflow-auto scrollbar-thin">
        <Link href="/profile/import" className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald/10 border border-emerald/30 text-sm text-emerald hover:bg-emerald/20 mb-3 transition">
          <Sparkles className="h-3.5 w-3.5" /> Import IA (texte → form)
        </Link>
        <ul className="space-y-0.5 text-sm">
          {SECTIONS.map((s) => {
            const pct = completion(s, data);
            return (
              <li key={s.id}>
                <a href={`#${s.id}`} onClick={() => setActiveSection(s.id)}
                   className={`flex items-center justify-between px-3 py-1.5 rounded-md transition ${activeSection === s.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <span>{s.title}</span>
                  <span className={`text-[10px] tabular-nums ${pct === 100 ? "text-emerald" : pct >= 50 ? "text-amber-400" : "text-muted-foreground"}`}>{pct}%</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="space-y-6">
        {SECTIONS.map((section) => {
          if (section.id === "environment") {
            return (
              <EnvironmentSection
                key={section.id}
                current={((data as Record<string, unknown>).currentLocation as { countryCode: string; city: string }) || { countryCode: "", city: "" }}
                history={((data as Record<string, unknown>).residenceHistory as { countryCode: string; city: string }[]) || []}
                occupation={((data as Record<string, unknown>).occupation as string) || ""}
                workEnvironment={((data as Record<string, unknown>).workEnvironment as string) || ""}
                toxicExposure={((data as Record<string, unknown>).toxicExposure as string) || ""}
                onChange={(patch) => setData((d) => ({ ...d, ...patch }))}
              />
            );
          }
          return (
          <motion.section
            key={section.id} id={section.id}
            initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.3 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-medium tracking-tight">{section.title}</h2>
              <span className="text-xs text-muted-foreground">{completion(section, data)}% rempli</span>
            </div>
            {section.description && <p className="text-sm text-muted-foreground mt-1">{section.description}</p>}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.fields.map((f) => (
                <FieldRow key={f.id} field={f} value={data[f.id]} onChange={(v) => set(f.id, v)} onMulti={(opt) => toggleMulti(f.id, opt)} />
              ))}
            </div>
          </motion.section>
          );
        })}

        <div className="sticky bottom-4 z-10 flex justify-end">
          <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg flex items-center gap-2 text-xs">
            <AnimatePresence mode="wait">
              {saving ? (
                <motion.span key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-muted-foreground">
                  <Save className="h-3 w-3 animate-pulse" /> Enregistrement…
                </motion.span>
              ) : savedAt ? (
                <motion.span key="d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-emerald">
                  <Check className="h-3 w-3" /> Enregistré il y a {Math.max(1, Math.round((Date.now() - savedAt.getTime()) / 1000))}s
                </motion.span>
              ) : (
                <span className="text-muted-foreground">Auto-save activé</span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ field, value, onChange, onMulti }: {
  field: Field; value: unknown; onChange: (v: unknown) => void; onMulti: (opt: string) => void;
}) {
  const colSpan = (field as { col?: 1 | 2 }).col === 2 ? "md:col-span-2" : (field as { col?: 1 | 2 }).col === 1 ? "" : "md:col-span-2";
  if (field.type === "textarea") {
    return (
      <div className="md:col-span-2 space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">{field.label}</label>
        <textarea value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} rows={field.rows ?? 3}
                  className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition" />
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div className={`space-y-1.5 ${colSpan}`}>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">{field.label}</label>
        <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}
                className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition">
          {field.options.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
        </select>
      </div>
    );
  }
  if (field.type === "multi") {
    const selected = (value as string[]) ?? [];
    return (
      <div className="md:col-span-2 space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">{field.label}</label>
        <div className="flex flex-wrap gap-2">
          {field.options.map((o) => {
            const active = selected.includes(o);
            return (
              <button key={o} type="button" onClick={() => onMulti(o)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition ${active ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"}`}>
                {o}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (field.type === "checkbox") {
    return (
      <label className="md:col-span-2 flex items-center gap-2.5 cursor-pointer text-sm">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-border bg-secondary accent-emerald" />
        {field.label}
      </label>
    );
  }
  return (
    <div className={`space-y-1.5 ${colSpan}`}>
      <label className="text-xs uppercase tracking-wider text-muted-foreground">{field.label}</label>
      <div className="relative">
        <input type={field.type}
               value={(value as string | number | undefined) ?? ""}
               onChange={(e) => onChange(field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
               placeholder={(field as { placeholder?: string }).placeholder}
               className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition" />
        {(field as { suffix?: string }).suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{(field as { suffix?: string }).suffix}</span>
        )}
      </div>
    </div>
  );
}
