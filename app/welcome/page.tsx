"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, Upload, Check, Sparkles, AlertCircle, RotateCcw } from "lucide-react";

// ---------- Option lists ----------
const SEX_OPTIONS = [
  { id: "male", label: "Homme" },
  { id: "female", label: "Femme" },
  { id: "intersex", label: "Intersexe" },
];

const BLOOD_TYPES = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-", "Je ne sais pas"];

// Labels match the canonical options in components/profile-form.tsx so that
// values saved here round-trip cleanly into the wizard <select>.
const ACTIVITY_LEVELS = [
  { id: "Sédentaire", label: "Sédentaire" },
  { id: "Léger (1-2x/sem)", label: "Léger" },
  { id: "Modéré (3-4x/sem)", label: "Modéré" },
  { id: "Intense (5-6x/sem)", label: "Intense" },
  { id: "Athlète", label: "Athlète" },
];

// Buckets must match the chipsSingle options for `sleepHours` in components/profile-form.tsx.
const SLEEP_HOURS = ["<5", "5-6", "6-7", "7-8", "8-9", "9+"];

const SMOKER_OPTIONS = [
  { id: "Non", label: "Non" },
  { id: "Occasionnel", label: "Occasionnel" },
  { id: "Régulier", label: "Régulier" },
  { id: "Vapoteur", label: "Vapoteur" },
  { id: "Ex-fumeur", label: "Ex-fumeur" },
];

const GOALS = [
  { id: "energy", label: "Énergie" },
  { id: "sleep", label: "Sommeil" },
  { id: "performance", label: "Performance sportive" },
  { id: "longevity", label: "Longévité" },
  { id: "weight", label: "Perte de poids" },
  { id: "hormones", label: "Hormones" },
  { id: "mental", label: "Mental" },
  { id: "stress", label: "Réduction stress" },
  { id: "cognitive", label: "Optimisation cognitive" },
  { id: "cardio", label: "Cardio" },
  { id: "immunity", label: "Immunité" },
];

const FAMILY_DISEASES = [
  "Cancer",
  "Diabète",
  "Hypertension",
  "Infarctus / AVC",
  "Alzheimer / démence",
  "Cholestérol familial",
  "Maladie auto-immune",
  "Dépression",
  "Autre",
];

const SYMPTOMS = [
  "Fatigue persistante",
  "Sommeil difficile",
  "Brouillard mental",
  "Anxiété",
  "Douleurs articulaires",
  "Ballonnements",
  "Maux de tête",
  "Aucun",
];

const WEARABLES = [
  "Whoop",
  "Oura",
  "Apple Watch",
  "Garmin",
  "Fitbit",
  "CGM",
  "Tensiomètre",
  "Balance connectée",
  "Aucun",
];

const CYCLE_OPTIONS = [
  "Cycle régulier",
  "Cycle irrégulier",
  "Sous contraception",
  "Ménopause",
  "Préfère ne pas répondre",
];

const SCREENINGS = [
  "Coloscopie",
  "Mammo (femme)",
  "PSA (homme)",
  "Dexa",
  "Bilan sanguin annuel",
];

// ---------- Step keys (logical, used to build dynamic step list) ----------
type StepKey =
  | "welcome"
  | "identity"
  | "anthro"
  | "lifestyle"
  | "cycle"
  | "goals"
  | "family"
  | "screenings"
  | "symptoms"
  | "wearables"
  | "upload";

function computeAge(birthDate: string): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

// Pill class helper (matches profile-form.tsx multi pattern)
function pillClass(active: boolean): string {
  return `px-3 py-1.5 rounded-full text-sm border transition ${
    active
      ? "bg-primary/15 border-primary/40 text-primary"
      : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
  }`;
}

function toggleArray<T>(arr: T[], v: T, max?: number): T[] {
  if (arr.includes(v)) return arr.filter((x) => x !== v);
  if (typeof max === "number" && arr.length >= max) return arr;
  return [...arr, v];
}

export default function WelcomePage() {
  const router = useRouter();

  // ---------- State ----------
  const [stepIdx, setStepIdx] = useState(0);

  // identity
  const [firstName, setFirstName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("");

  // anthro
  const [height, setHeight] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [bloodType, setBloodType] = useState<string>("");

  // lifestyle
  const [activityLevel, setActivityLevel] = useState<string>("");
  const [sleepHours, setSleepHours] = useState<string>("");
  const [smoker, setSmoker] = useState<string>("");

  // cycle (conditional)
  const [womensCycleFlash, setWomensCycleFlash] = useState<string[]>([]);

  // goals
  const [goals, setGoals] = useState<string[]>([]);

  // family
  const [familyDiseasesFlash, setFamilyDiseasesFlash] = useState<string[]>([]);

  // screenings (conditional)
  const [screeningsFlashDone, setScreeningsFlashDone] = useState<string[]>([]);

  // symptoms
  const [activeSymptomsFlash, setActiveSymptomsFlash] = useState<string[]>([]);

  // wearables
  const [wearablesOwned, setWearablesOwned] = useState<string[]>([]);

  // upload (multi-file)
  type UploadItem = {
    id: string;
    file: File;
    status: "queued" | "uploading" | "done" | "error";
    detected?: string;
    detectedLabel?: string;
    message?: string;
    error?: string;
  };
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [extractStatus, setExtractStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [extractCount, setExtractCount] = useState(0);

  const [savingProfile, setSavingProfile] = useState(false);

  // One AbortController for the whole wizard — aborts all pending uploads
  // and the auto-extract fetch if the user navigates away mid-flight.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    abortRef.current = new AbortController();
    return () => { abortRef.current?.abort(); };
  }, []);
  function isAborted(): boolean {
    return abortRef.current?.signal.aborted ?? false;
  }

  // ---------- Derived ----------
  const age = useMemo(() => computeAge(birthDate), [birthDate]);

  const steps: StepKey[] = useMemo(() => {
    const base: StepKey[] = ["welcome", "identity", "anthro", "lifestyle"];
    if (sex === "Femme") base.push("cycle");
    base.push("goals", "family");
    if (age !== null && age >= 45) base.push("screenings");
    base.push("symptoms", "wearables", "upload");
    return base;
  }, [sex, age]);

  const totalSteps = steps.length;
  const currentKey: StepKey = steps[Math.min(stepIdx, totalSteps - 1)];

  // ---------- Persistence ----------
  async function saveProfile(patch: Record<string, unknown>) {
    setSavingProfile(true);
    try {
      const r = await fetch("/api/profile");
      const d = await r.json();
      const data = { ...(d.data ?? {}), ...patch };
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
    } catch {
      /* swallow */
    } finally {
      setSavingProfile(false);
    }
  }

  // Friendly label for the `detected` enum the /api/upload/auto route returns.
  function labelForDetected(kind: string | undefined): string {
    if (!kind) return "Document";
    if (kind === "pdf-document") return "PDF santé";
    if (kind === "dna-23andme") return "ADN 23andMe";
    if (kind.startsWith("whoop-")) return "Whoop";
    if (kind === "oura-trends") return "Oura";
    if (kind === "markdown-note") return "Note markdown";
    if (kind === "image") return "Image";
    if (kind === "spreadsheet" || kind === "generic-csv") return "Tableur / CSV";
    return "Document";
  }

  async function uploadOne(item: UploadItem) {
    setUploadItems((items) => items.map((x) => (x.id === item.id ? { ...x, status: "uploading" } : x)));
    try {
      const fd = new FormData();
      fd.append("files", item.file);
      const r = await fetch("/api/upload/auto", {
        method: "POST",
        body: fd,
        signal: abortRef.current?.signal,
      });
      if (isAborted()) return;
      const d = await r.json();
      if (isAborted()) return;
      const result = (d.results || [])[0] ?? {};
      const ok = result.status === "ok";
      setUploadItems((items) =>
        items.map((x) =>
          x.id === item.id
            ? {
                ...x,
                status: ok ? "done" : "error",
                detected: result.detected,
                detectedLabel: labelForDetected(result.detected),
                message: result.message,
                error: ok ? undefined : result.message || (r.status >= 500 ? "Erreur serveur — réessaye dans un instant" : "Échec de l'import"),
              }
            : x,
        ),
      );
    } catch (e) {
      // Silent on abort (user navigated away). Surface real errors.
      if ((e as Error).name === "AbortError" || isAborted()) return;
      setUploadItems((items) =>
        items.map((x) => (x.id === item.id ? { ...x, status: "error", error: (e as Error).message } : x)),
      );
    }
  }

  function enqueueFiles(files: FileList | File[]) {
    const newItems: UploadItem[] = Array.from(files).map((file, i) => ({
      id: `${Date.now()}-${i}-${file.name}`,
      file,
      status: "queued",
    }));
    setUploadItems((prev) => [...prev, ...newItems]);
    // Start uploads in parallel (no batching — the route accepts each request
    // independently and lets pdf-parse + ingest run server-side).
    for (const it of newItems) uploadOne(it);
  }

  // Once all uploads are done with at least one OK, kick off auto-extract in
  // the background so the wizard has fresh data ready when the user lands.
  // Wrapped in useCallback-style closure so the retry button can re-trigger it.
  async function runAutoExtract() {
    setExtractStatus("running");
    try {
      const r = await fetch("/api/profile/auto-extract", {
        method: "POST",
        signal: abortRef.current?.signal,
      });
      if (isAborted()) return;
      if (!r.ok) { setExtractStatus("error"); return; }
      const d = await r.json();
      if (isAborted()) return;
      const extracted = d?.extracted as Record<string, unknown> | undefined;
      const memories = (d?.memories as string[] | undefined) ?? [];
      const n = (extracted ? Object.keys(extracted).filter((k) => k !== "_memories").length : 0) + memories.length;
      setExtractCount(n);
      setExtractStatus("done");
    } catch (e) {
      if ((e as Error).name === "AbortError" || isAborted()) return;
      setExtractStatus("error");
    }
  }
  useEffect(() => {
    if (uploadItems.length === 0) return;
    if (extractStatus !== "idle") return;
    const stillRunning = uploadItems.some((x) => x.status === "queued" || x.status === "uploading");
    if (stillRunning) return;
    const anyOk = uploadItems.some((x) => x.status === "done");
    if (!anyOk) return;
    runAutoExtract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadItems, extractStatus]);

  // Navigation + persistence per step. Every step is permissive — the data
  // persists in /data/profile and can be filled in anytime later. Pinning the
  // user behind "must select" walls during the WOW first-run was the wrong
  // tradeoff.
  async function persistForStep(key: StepKey) {
    switch (key) {
      case "identity":
        if (firstName || birthDate || sex) {
          await saveProfile({ firstName, birthDate, sex });
        }
        break;
      case "anthro":
        if (height || weight || bloodType) {
          await saveProfile({
            height: height === "" ? undefined : Number(height),
            weight: weight === "" ? undefined : Number(weight),
            bloodType,
          });
        }
        break;
      case "lifestyle":
        if (activityLevel || sleepHours || smoker) {
          await saveProfile({ activityLevel, sleepHours, smoker });
        }
        break;
      case "cycle":
        if (womensCycleFlash.length) await saveProfile({ womensCycleFlash });
        break;
      case "goals":
        if (goals.length) await saveProfile({ goals });
        break;
      case "family":
        if (familyDiseasesFlash.length) await saveProfile({ familyDiseasesFlash });
        break;
      case "screenings":
        if (screeningsFlashDone.length) await saveProfile({ screeningsFlashDone });
        break;
      case "symptoms":
        if (activeSymptomsFlash.length) await saveProfile({ activeSymptomsFlash });
        break;
      case "wearables":
        if (wearablesOwned.length) await saveProfile({ wearablesOwned });
        break;
      default:
        break;
    }
  }

  async function next() {
    await persistForStep(currentKey);
    if (stepIdx < totalSteps - 1) setStepIdx(stepIdx + 1);
  }
  function prev() {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  }
  function skip() {
    router.push("/dashboard");
  }

  const isLast = currentKey === "upload";

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald/5 via-background to-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-emerald" />
            <span className="font-semibold tracking-tight">Vitals</span>
          </Link>
          <button onClick={skip} className="text-xs text-muted-foreground hover:text-foreground transition">
            Passer pour le moment →
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl">
          {/* Progress bar + step counter */}
          <div className="mb-10">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 tabular-nums">
              <span>Étape {stepIdx + 1} / {totalSteps}</span>
              <span>{Math.round(((stepIdx + 1) / totalSteps) * 100)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-secondary/40 overflow-hidden">
              <motion.div
                className="h-full bg-emerald"
                initial={false}
                animate={{ width: `${((stepIdx + 1) / totalSteps) * 100}%` }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentKey}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-border bg-card p-8 md:p-10"
            >
              {currentKey === "welcome" && (
                <>
                  <div className="text-6xl mb-4">👋</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-3">Bienvenue sur Vitals</h1>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    Quelques minutes pour poser les bases de ton dossier santé. Toutes les questions sont optionnelles — plus tu remplis, mieux c&apos;est.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setStepIdx(1)}
                      className="px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition flex items-center gap-2"
                    >
                      Commencer <ArrowRight className="h-4 w-4" />
                    </button>
                    <button onClick={skip} className="text-xs text-muted-foreground hover:text-foreground transition">
                      Passer →
                    </button>
                  </div>
                </>
              )}

              {currentKey === "identity" && (
                <>
                  <div className="text-6xl mb-4">👤</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-3">Identité essentielle</h1>
                  <p className="text-muted-foreground mb-6">Prénom, date de naissance, sexe biologique.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">
                        Prénom
                      </label>
                      <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
                        placeholder="Julien"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">
                        Date de naissance
                      </label>
                      <input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      <div className="text-xs text-muted-foreground mt-1.5">
                        {age !== null ? `${age} ans` : "Format : JJ/MM/AAAA"}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-2">
                        Sexe biologique
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {SEX_OPTIONS.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => setSex(o.label)}
                            className={pillClass(sex === o.label)}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {currentKey === "anthro" && (
                <>
                  <div className="text-6xl mb-4">📏</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-3">Anthropométrie minimale</h1>
                  <p className="text-muted-foreground mb-6">Taille, poids, groupe sanguin.</p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">
                          Taille (cm)
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={height}
                          onChange={(e) => setHeight(e.target.value)}
                          className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
                          placeholder="178"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">
                          Poids (kg)
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
                          className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
                          placeholder="72"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-2">
                        Groupe sanguin
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {BLOOD_TYPES.map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => setBloodType(bloodType === b ? "" : b)}
                            className={pillClass(bloodType === b)}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {currentKey === "lifestyle" && (
                <>
                  <div className="text-6xl mb-4">🏃</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-3">Mode de vie express</h1>
                  <p className="text-muted-foreground mb-6">Activité, sommeil, tabac.</p>
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-2">
                        Niveau d'activité
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {ACTIVITY_LEVELS.map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setActivityLevel(activityLevel === a.id ? "" : a.id)}
                            className={pillClass(activityLevel === a.id)}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-2">
                        Sommeil moyen (h)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {SLEEP_HOURS.map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => setSleepHours(sleepHours === h ? "" : h)}
                            className={pillClass(sleepHours === h)}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-2">
                        Tabac
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {SMOKER_OPTIONS.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSmoker(smoker === s.id ? "" : s.id)}
                            className={pillClass(smoker === s.id)}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {currentKey === "cycle" && (
                <>
                  <div className="text-6xl mb-4">🌙</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-3">Cycle express</h1>
                  <p className="text-muted-foreground mb-6">Sélection multiple si pertinent.</p>
                  <div className="flex flex-wrap gap-2">
                    {CYCLE_OPTIONS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setWomensCycleFlash(toggleArray(womensCycleFlash, c))}
                        className={pillClass(womensCycleFlash.includes(c))}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {currentKey === "goals" && (
                <>
                  <div className="text-6xl mb-4">🎯</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-3">Objectifs santé</h1>
                  <p className="text-muted-foreground mb-6">Choisis jusqu&apos;à 3 priorités (optionnel).</p>
                  <div className="flex flex-wrap gap-2">
                    {GOALS.map((g) => {
                      const selected = goals.includes(g.id);
                      const disabled = !selected && goals.length >= 3;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => setGoals(toggleArray(goals, g.id, 3))}
                          className={`${pillClass(selected)} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                        >
                          {selected && <Check className="inline h-3 w-3 mr-1" />}
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground mt-3">{goals.length}/3 sélectionnés</div>
                </>
              )}

              {currentKey === "family" && (
                <>
                  <div className="text-6xl mb-4">🧬</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-3">Antécédents familiaux flash</h1>
                  <p className="text-muted-foreground mb-2">
                    Une de ces maladies dans ta famille (parents/grands-parents) ?
                  </p>
                  <p className="text-xs text-muted-foreground mb-6">
                    Détail complet dans le profil ensuite.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {FAMILY_DISEASES.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setFamilyDiseasesFlash(toggleArray(familyDiseasesFlash, d))}
                        className={pillClass(familyDiseasesFlash.includes(d))}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {currentKey === "screenings" && (
                <>
                  <div className="text-6xl mb-4">🩺</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-3">Dépistage à jour ?</h1>
                  <p className="text-muted-foreground mb-6">Examens réalisés dans les 2 dernières années.</p>
                  <div className="flex flex-wrap gap-2">
                    {SCREENINGS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setScreeningsFlashDone(toggleArray(screeningsFlashDone, s))}
                        className={pillClass(screeningsFlashDone.includes(s))}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {currentKey === "symptoms" && (
                <>
                  <div className="text-6xl mb-4">🩹</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-3">Symptômes actuels</h1>
                  <p className="text-muted-foreground mb-6">Optionnel — sélection multiple.</p>
                  <div className="flex flex-wrap gap-2">
                    {SYMPTOMS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setActiveSymptomsFlash(toggleArray(activeSymptomsFlash, s))}
                        className={pillClass(activeSymptomsFlash.includes(s))}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {currentKey === "wearables" && (
                <>
                  <div className="text-6xl mb-4">⌚</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-3">Wearables possédés</h1>
                  <p className="text-muted-foreground mb-6">Optionnel — coche ceux que tu as. Tu activeras la sync depuis Import après l&apos;onboarding.</p>
                  <div className="flex flex-wrap gap-2">
                    {WEARABLES.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setWearablesOwned(toggleArray(wearablesOwned, w))}
                        className={pillClass(wearablesOwned.includes(w))}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {currentKey === "upload" && (
                <>
                  <div className="text-6xl mb-4">📄</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-2">Importe tous tes documents santé</h1>
                  <p className="text-muted-foreground mb-1">
                    Plus tu uploades, plus l&apos;IA pourra pré-remplir ton dossier automatiquement.
                  </p>
                  <p className="text-xs text-muted-foreground mb-6">
                    Glisse-dépose en lot — analyses sanguines, ADN 23andMe, exports Whoop / Oura, comptes-rendus médicaux, ordonnances, notes.
                  </p>

                  <label
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files?.length) enqueueFiles(e.dataTransfer.files);
                    }}
                    className={`flex flex-col items-center justify-center gap-2 px-6 py-10 rounded-xl border-2 border-dashed transition cursor-pointer ${
                      isDragOver
                        ? "border-emerald bg-emerald/10"
                        : "border-border hover:border-emerald/50 bg-secondary/20"
                    }`}
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <div className="text-sm font-medium">
                      <span className="hidden sm:inline">Glisse tes fichiers ici ou clique pour choisir</span>
                      <span className="sm:hidden">Touche ici pour ouvrir tes fichiers</span>
                    </div>
                    <div className="text-xs text-muted-foreground">PDF, JPG, PNG, CSV, TXT — plusieurs à la fois</div>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept=".pdf,.csv,.txt,.md,.json,image/*"
                      onChange={(e) => { if (e.target.files?.length) enqueueFiles(e.target.files); e.target.value = ""; }}
                    />
                  </label>

                  {uploadItems.length > 0 && (
                    <div className="mt-4 space-y-1.5">
                      {uploadItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-card text-sm"
                        >
                          <div className="flex-shrink-0">
                            {item.status === "uploading" && <Loader2 className="h-4 w-4 text-emerald animate-spin" />}
                            {item.status === "queued" && <Loader2 className="h-4 w-4 text-muted-foreground" />}
                            {item.status === "done" && <Check className="h-4 w-4 text-emerald" />}
                            {item.status === "error" && <span className="text-red-500 text-xs">!</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">{item.file.name}</div>
                            {item.status === "done" && item.detectedLabel && (
                              <div className="text-[10px] uppercase tracking-wider text-emerald">{item.detectedLabel}</div>
                            )}
                            {item.status === "error" && (
                              <div className="text-[10px] text-red-500 truncate">{item.error}</div>
                            )}
                            {item.status === "uploading" && (
                              <div className="text-[10px] text-muted-foreground">Upload en cours…</div>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex-shrink-0">
                            {(item.file.size / 1024).toFixed(0)} KB
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(() => {
                    const total = uploadItems.length;
                    const done = uploadItems.filter((x) => x.status === "done").length;
                    const inflight = uploadItems.filter((x) => x.status === "queued" || x.status === "uploading").length;
                    const allFinished = total > 0 && inflight === 0;
                    if (total === 0) {
                      return (
                        <p className="text-xs text-muted-foreground mt-4 text-center">
                          Tu peux aussi passer cette étape — l&apos;import sera toujours possible depuis le dashboard.
                        </p>
                      );
                    }
                    if (allFinished && extractStatus === "error") {
                      return (
                        <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-400 mb-2 font-medium">
                            <AlertCircle className="h-3.5 w-3.5" /> Extraction IA indisponible
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Tes documents sont bien importés ({done}/{total}), mais l&apos;analyse automatique a
                            échoué. Tu peux réessayer maintenant ou continuer — l&apos;extraction se relancera
                            depuis le profil.
                          </p>
                          <button
                            onClick={() => { setExtractStatus("idle"); runAutoExtract(); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-secondary/40 transition text-xs"
                          >
                            <RotateCcw className="h-3 w-3" /> Réessayer l&apos;analyse
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div className="mt-5 rounded-xl border border-emerald/30 bg-emerald/5 p-4">
                        <div className="text-xs uppercase tracking-wider text-emerald mb-2 font-medium">
                          {inflight > 0 ? `Upload ${done}/${total}` : `${done}/${total} importé(s)`}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {inflight > 0
                            ? "Continue à ajouter des fichiers pendant que l'upload tourne…"
                            : allFinished && extractStatus === "running"
                            ? "L'IA analyse tes documents pour pré-remplir ton profil…"
                            : allFinished && extractStatus === "done"
                            ? `L'IA a extrait ${extractCount} information(s) — elles t'attendent dans le profil.`
                            : "Tout est importé. Tu peux continuer."}
                        </p>
                      </div>
                    );
                  })()}

                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <Link
                      href="/welcome/report"
                      className="flex-1 px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition flex items-center justify-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" /> Voir mon analyse personnalisée
                    </Link>
                    <Link
                      href="/dashboard"
                      className="flex-1 px-4 py-2.5 rounded-md border border-border bg-card hover:bg-secondary/40 transition flex items-center justify-center gap-2"
                    >
                      Aller au dashboard <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Bottom nav: hidden on welcome (its own CTAs) and on upload (final CTAs in card) */}
          {currentKey !== "welcome" && !isLast && (
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={prev}
                disabled={stepIdx === 0}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-30 flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Précédent
              </button>
              <button
                onClick={next}
                disabled={savingProfile}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition flex items-center gap-2 disabled:opacity-50"
              >
                {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Suivant <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Upload step gets a Précédent only (CTAs are in card) */}
          {isLast && (
            <div className="flex items-center justify-between mt-6">
              <button
                onClick={prev}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Précédent
              </button>
              {savingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
