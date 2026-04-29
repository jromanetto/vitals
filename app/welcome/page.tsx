"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, Upload, Check, Sparkles } from "lucide-react";

const GOALS = [
  { id: "energy", label: "Énergie" }, { id: "sleep", label: "Sommeil" }, { id: "performance", label: "Performance sportive" },
  { id: "exam", label: "Préparer un examen" }, { id: "condition", label: "Suivre une condition" }, { id: "longevity", label: "Optimiser longévité" },
  { id: "weight", label: "Perte de poids" }, { id: "hormones", label: "Hormones" }, { id: "mental", label: "Mental" },
];

export default function WelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [sex, setSex] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done">("idle");
  const [uploadFilename, setUploadFilename] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const totalSteps = 5;

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
    } catch {} finally { setSavingProfile(false); }
  }

  async function handleUpload(file: File) {
    if (!file) return;
    setUploadStatus("uploading");
    setUploadFilename(file.name);
    try {
      const fd = new FormData();
      fd.append("files", file);
      await fetch("/api/upload/auto", { method: "POST", body: fd });
      setUploadStatus("done");
    } catch { setUploadStatus("idle"); }
  }

  async function next() {
    if (step === 1 && (firstName || birthDate || sex)) {
      await saveProfile({ firstName, birthDate, sex });
    }
    if (step === 3 && goals.length > 0) {
      await saveProfile({ goals });
    }
    if (step < totalSteps - 1) setStep(step + 1);
  }
  function prev() { if (step > 0) setStep(step - 1); }
  function skip() { router.push("/dashboard"); }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald/5 via-background to-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-emerald" />
            <span className="font-semibold tracking-tight">Vitals</span>
          </Link>
          <button onClick={skip} className="text-xs text-muted-foreground hover:text-foreground transition">Passer pour le moment →</button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-emerald" : i < step ? "w-1.5 bg-emerald/50" : "w-1.5 bg-border"}`} />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-border bg-card p-8 md:p-10"
            >
              {step === 0 && (
                <>
                  <div className="text-6xl mb-4">👋</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-3">Bienvenue sur Vitals</h1>
                  <p className="text-muted-foreground leading-relaxed">
                    Une plateforme pour <span className="text-emerald">centraliser</span> ta santé, <span className="text-emerald">comprendre</span> ton corps et <span className="text-emerald">optimiser</span> ta longévité.
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald shrink-0 mt-0.5" /> Tous tes bilans sanguins en un seul tableau de bord</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald shrink-0 mt-0.5" /> Ton ADN 23andMe interprété (160+ variants)</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald shrink-0 mt-0.5" /> Un panel médical IA qui connaît ton dossier complet</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald shrink-0 mt-0.5" /> Plan d'action quotidien : sommeil · sport · nutrition</li>
                  </ul>
                </>
              )}
              {step === 1 && (
                <>
                  <div className="text-6xl mb-4">👤</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-3">Quelques infos pour personnaliser</h1>
                  <p className="text-muted-foreground mb-6">Tu pourras compléter le reste de ton profil plus tard.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Prénom</label>
                      <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                             className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" placeholder="Julien" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Date de naissance</label>
                      <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)}
                             className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium block mb-1.5">Sexe biologique</label>
                      <select value={sex} onChange={(e) => setSex(e.target.value)}
                              className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary">
                        <option value="">—</option>
                        <option value="male">Homme</option>
                        <option value="female">Femme</option>
                        <option value="other">Autre / Préfère ne pas préciser</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <div className="text-6xl mb-4">📄</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-3">Importe ton dernier bilan sanguin</h1>
                  <p className="text-muted-foreground mb-6">PDF ou photo. L'IA extrait automatiquement tes biomarqueurs.</p>
                  <label className={`flex flex-col items-center justify-center gap-3 px-6 py-12 rounded-xl border-2 border-dashed transition cursor-pointer ${uploadStatus === "done" ? "border-emerald bg-emerald/5" : "border-border hover:border-emerald/50 bg-secondary/20"}`}>
                    {uploadStatus === "uploading" && <><Loader2 className="h-8 w-8 text-emerald animate-spin" /><div className="text-sm">Upload de {uploadFilename}…</div></>}
                    {uploadStatus === "done" && <><Check className="h-8 w-8 text-emerald" /><div className="text-sm font-medium text-emerald">{uploadFilename} importé !</div><div className="text-xs text-muted-foreground">Analyse en cours en arrière-plan</div></>}
                    {uploadStatus === "idle" && <><Upload className="h-8 w-8 text-muted-foreground" /><div className="text-sm font-medium">Glisse ton fichier ici ou clique</div><div className="text-xs text-muted-foreground">PDF, JPG, PNG · 1 fichier</div></>}
                    <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                  </label>
                  <button onClick={next} className="text-xs text-muted-foreground hover:text-foreground transition mt-3">Passer cette étape →</button>
                </>
              )}
              {step === 3 && (
                <>
                  <div className="text-6xl mb-4">🎯</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-3">Quels sont tes objectifs ?</h1>
                  <p className="text-muted-foreground mb-6">Multi-sélection. Ça nous aide à prioriser tes recommandations.</p>
                  <div className="flex flex-wrap gap-2">
                    {GOALS.map((g) => {
                      const selected = goals.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          onClick={() => setGoals(selected ? goals.filter((x) => x !== g.id) : [...goals, g.id])}
                          className={`px-3 py-2 rounded-full text-sm border transition ${selected ? "bg-emerald/15 border-emerald/50 text-emerald" : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-border"}`}
                        >
                          {selected && <Check className="inline h-3 w-3 mr-1" />}
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              {step === 4 && (
                <>
                  <div className="text-6xl mb-4">🚀</div>
                  <h1 className="text-3xl font-semibold tracking-tight mb-3">Tout est prêt !</h1>
                  <p className="text-muted-foreground mb-6">Ton dossier est en cours d'analyse. Le compte-rendu IA arrive d'ici 30 secondes sur le dashboard.</p>
                  <div className="rounded-xl border border-emerald/30 bg-emerald/5 p-4 mb-6">
                    <div className="text-xs uppercase tracking-wider text-emerald mb-2 font-medium">Prochaines étapes recommandées</div>
                    <ul className="space-y-1.5 text-sm">
                      <li className="flex items-start gap-2"><span className="text-emerald">→</span> Importe ton ADN 23andMe pour des recommandations personnalisées</li>
                      <li className="flex items-start gap-2"><span className="text-emerald">→</span> Ajoute tes suppléments actuels pour le bilan nutritionnel</li>
                      <li className="flex items-start gap-2"><span className="text-emerald">→</span> Configure des rappels santé pour ne rien oublier</li>
                    </ul>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Link href="/dashboard" className="flex-1 px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition flex items-center justify-center gap-2">
                      Aller au dashboard <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link href="/chat" className="flex-1 px-4 py-2.5 rounded-md border border-border bg-card hover:bg-secondary/40 transition flex items-center justify-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald" /> Demander au panel
                    </Link>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          {step < totalSteps - 1 && (
            <div className="flex items-center justify-between mt-6">
              <button onClick={prev} disabled={step === 0} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition disabled:opacity-30 flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Précédent
              </button>
              <button onClick={next} disabled={savingProfile}
                      className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition flex items-center gap-2 disabled:opacity-50">
                {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Suivant <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
