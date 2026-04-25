"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Save } from "lucide-react";

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
  {
    id: "identity",
    title: "Identité",
    description: "Identification de base.",
    fields: [
      { id: "firstName", label: "Prénom", type: "text", col: 1 },
      { id: "lastName", label: "Nom", type: "text", col: 1 },
      { id: "email", label: "Email", type: "email", col: 1 },
      { id: "phone", label: "Téléphone", type: "tel", col: 1 },
      { id: "birthDate", label: "Date de naissance", type: "date", col: 1 },
      { id: "birthPlace", label: "Lieu de naissance", type: "text", col: 1 },
      { id: "sex", label: "Sexe biologique", type: "select", options: ["", "Homme", "Femme", "Intersexe"], col: 1 },
      { id: "gender", label: "Genre", type: "text", col: 1 },
    ],
  },
  {
    id: "anthro",
    title: "Anthropométrie",
    fields: [
      { id: "height", label: "Taille", type: "number", suffix: "cm", col: 1 },
      { id: "weight", label: "Poids", type: "number", suffix: "kg", col: 1 },
      { id: "bodyFat", label: "% masse grasse", type: "number", suffix: "%", col: 1 },
      { id: "muscleMass", label: "Masse musculaire", type: "number", suffix: "kg", col: 1 },
      { id: "waist", label: "Tour de taille", type: "number", suffix: "cm", col: 1 },
      { id: "neck", label: "Tour de cou", type: "number", suffix: "cm", col: 1 },
      { id: "bloodType", label: "Groupe sanguin", type: "select", options: ["", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"], col: 1 },
      { id: "ethnicity", label: "Origine ethnique", type: "text", col: 1 },
    ],
  },
  {
    id: "lifestyle",
    title: "Mode de vie",
    fields: [
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
    ],
  },
  {
    id: "diet",
    title: "Alimentation",
    fields: [
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
    ],
  },
  {
    id: "medical",
    title: "Antécédents médicaux",
    fields: [
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
    ],
  },
  {
    id: "family",
    title: "Antécédents familiaux",
    description: "Histoire de santé des parents, grands-parents, fratrie.",
    fields: [
      { id: "fatherHealth", label: "Père — santé / pathologies", type: "textarea", rows: 2 },
      { id: "motherHealth", label: "Mère — santé / pathologies", type: "textarea", rows: 2 },
      { id: "grandparentsHealth", label: "Grands-parents — pathologies notables", type: "textarea", rows: 3 },
      { id: "siblingsHealth", label: "Frères et sœurs", type: "textarea", rows: 2 },
      { id: "familyDiseases", label: "Maladies familiales (cancer, diabète, AVC, Alzheimer…)", type: "multi", options: ["Cancer", "Diabète T1", "Diabète T2", "Hypertension", "AVC", "Infarctus", "Alzheimer", "Parkinson", "Cholestérol familial", "Thrombose", "Maladie auto-immune", "Dépression", "Schizophrénie"] },
    ],
  },
  {
    id: "mental",
    title: "Santé mentale & cognition",
    fields: [
      { id: "moodAvg", label: "Humeur moyenne (0-10)", type: "number", col: 1 },
      { id: "anxietyLevel", label: "Anxiété (0-10)", type: "number", col: 1 },
      { id: "depressionHistory", label: "Antécédents de dépression", type: "textarea", rows: 2 },
      { id: "therapy", label: "Suivi psy actuel ou passé", type: "textarea", rows: 2 },
      { id: "cognitiveConcerns", label: "Concerns cognitives (mémoire, focus…)", type: "textarea", rows: 2 },
    ],
  },
  {
    id: "reproductive",
    title: "Santé sexuelle & reproduction",
    fields: [
      { id: "sexualActivity", label: "Activité sexuelle (note libre)", type: "textarea", rows: 2 },
      { id: "contraception", label: "Contraception", type: "text", col: 1 },
      { id: "stiTests", label: "Date du dernier test IST complet", type: "date", col: 1 },
      { id: "fertility", label: "Projet enfant / fertilité", type: "textarea", rows: 2 },
    ],
  },
  {
    id: "environment",
    title: "Environnement & exposition",
    fields: [
      { id: "city", label: "Ville actuelle", type: "text", col: 1 },
      { id: "climate", label: "Climat", type: "select", options: ["", "Tempéré", "Tropical", "Méditerranéen", "Continental", "Aride", "Polaire"], col: 1 },
      { id: "occupation", label: "Métier", type: "text", col: 1 },
      { id: "workEnvironment", label: "Type d'environnement de travail", type: "select", options: ["", "Bureau", "Télétravail", "Industriel", "Médical", "Extérieur", "Voyage fréquent"], col: 1 },
      { id: "toxicExposure", label: "Expositions toxiques connues", type: "textarea", rows: 2 },
      { id: "sunExposure", label: "Exposition soleil moyenne", type: "select", options: ["", "Faible", "Modérée", "Élevée"], col: 1 },
      { id: "airQuality", label: "Qualité de l'air ressentie", type: "select", options: ["", "Excellente", "Bonne", "Moyenne", "Mauvaise"], col: 1 },
    ],
  },
  {
    id: "goals",
    title: "Objectifs & priorités santé",
    fields: [
      { id: "primaryGoals", label: "Objectifs principaux", type: "multi", options: ["Longévité", "Performance physique", "Perte de masse grasse", "Prise de muscle", "Meilleur sommeil", "Réduction stress", "Optimisation cognitive", "Énergie", "Hormones", "Immunité", "Santé cardiaque", "Microbiote"] },
      { id: "currentChallenges", label: "Défis actuels (douleurs, symptômes, plateaux)", type: "textarea", rows: 3 },
      { id: "targetWeight", label: "Poids cible", type: "number", suffix: "kg", col: 1 },
      { id: "longevityTarget", label: "Objectif d'âge en bonne santé", type: "number", suffix: "ans", col: 1 },
      { id: "openToHrt", label: "Ouvert à hormones / peptides / TRT", type: "checkbox" },
      { id: "openToBiohacking", label: "Ouvert au biohacking (cold plunge, sauna, peptides…)", type: "checkbox" },
    ],
  },
  {
    id: "providers",
    title: "Praticiens & suivi",
    fields: [
      { id: "primaryDoctor", label: "Médecin traitant", type: "text" },
      { id: "specialists", label: "Spécialistes consultés (cardio, endo, gastro…)", type: "textarea", rows: 3 },
      { id: "preferredLab", label: "Labo de prédilection", type: "text", col: 1 },
      { id: "insurance", label: "Mutuelle / assurance", type: "text", col: 1 },
    ],
  },
  {
    id: "freeform",
    title: "Notes libres",
    fields: [
      { id: "notes", label: "Tout ce que tu juges utile que l'IA sache de toi", type: "textarea", rows: 6 },
    ],
  },
];

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

  async function save() {
    setSaving(true);
    const res = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    setSaving(false);
    if (res.ok) setSavedAt(new Date());
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
      <nav className="md:sticky md:top-20 md:self-start md:max-h-[calc(100vh-6rem)] md:overflow-auto scrollbar-thin">
        <ul className="space-y-0.5 text-sm">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={() => setActiveSection(s.id)}
                className={`block px-3 py-1.5 rounded-md transition ${activeSection === s.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-6">
        {SECTIONS.map((section) => (
          <motion.section
            key={section.id}
            id={section.id}
            initial={{ opacity: 0, y: 6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.3 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <h2 className="text-lg font-medium tracking-tight">{section.title}</h2>
            {section.description && <p className="text-sm text-muted-foreground mt-1">{section.description}</p>}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.fields.map((f) => (
                <FieldRow key={f.id} field={f} value={data[f.id]} onChange={(v) => set(f.id, v)} onMulti={(opt) => toggleMulti(f.id, opt)} />
              ))}
            </div>
          </motion.section>
        ))}

        <div className="sticky bottom-4 z-10 flex justify-end">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-medium shadow-lg shadow-emerald/20 hover:bg-primary/90 transition disabled:opacity-60"
          >
            <AnimatePresence mode="wait" initial={false}>
              {savedAt && !saving ? (
                <motion.span key="ok" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4" /> Enregistré
                </motion.span>
              ) : (
                <motion.span key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
                  <Save className="h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer"}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  field, value, onChange, onMulti,
}: {
  field: Field; value: unknown; onChange: (v: unknown) => void; onMulti: (opt: string) => void;
}) {
  const colSpan = (field as { col?: 1 | 2 }).col === 2 ? "md:col-span-2" : (field as { col?: 1 | 2 }).col === 1 ? "" : "md:col-span-2";

  if (field.type === "textarea") {
    return (
      <div className="md:col-span-2 space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">{field.label}</label>
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={field.rows ?? 3}
          className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition"
        />
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div className={`space-y-1.5 ${colSpan}`}>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">{field.label}</label>
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition"
        >
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
              <button
                key={o} type="button"
                onClick={() => onMulti(o)}
                className={`px-2.5 py-1 rounded-full text-xs border transition ${active ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"}`}
              >
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
        <input
          type={field.type}
          value={(value as string | number | undefined) ?? ""}
          onChange={(e) => onChange(field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
          placeholder={(field as { placeholder?: string }).placeholder}
          className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition"
        />
        {(field as { suffix?: string }).suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{(field as { suffix?: string }).suffix}</span>
        )}
      </div>
    </div>
  );
}
