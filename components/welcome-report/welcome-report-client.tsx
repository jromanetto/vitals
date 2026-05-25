"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Check, AlertTriangle, ArrowRight, Sparkles, FileText, Heart, Activity, Upload } from "lucide-react";

type CardKind = "biomarker" | "dna-protective" | "lifestyle-fallback" | "family-risk" | "symptoms-fallback" | "empty-state";

type GeneratedCard = { index: number; kind: CardKind; title: string; body: string };
type RedFlagAlert = { labels: string[]; body: string };

type ReportMeta = {
  status?: "pending" | "ready" | "error";
  progress?: number;
  step?: string;
  cards?: GeneratedCard[];
  redFlagAlert?: RedFlagAlert;
  message?: string;
};

const STEPS = [
  { at: 15, label: "Extraction des biomarqueurs" },
  { at: 30, label: "Analyse génétique" },
  { at: 45, label: "Sélection des signaux" },
  { at: 60, label: "Génération de l'analyse" },
  { at: 90, label: "Finalisation" },
];

function cardIcon(kind: CardKind) {
  if (kind === "biomarker") return <Activity className="h-4 w-4" />;
  if (kind === "dna-protective" || kind === "lifestyle-fallback") return <Heart className="h-4 w-4" />;
  if (kind === "empty-state") return <Upload className="h-4 w-4" />;
  return <AlertTriangle className="h-4 w-4" />;
}

function cardTone(kind: CardKind) {
  if (kind === "biomarker") return "border-amber-500/30 bg-amber-500/5";
  if (kind === "dna-protective" || kind === "lifestyle-fallback") return "border-emerald/30 bg-emerald/5";
  if (kind === "empty-state") return "border-sky-500/30 bg-sky-500/5";
  return "border-red-500/30 bg-red-500/5";
}

export function WelcomeReportClient({
  initialReportId,
  initialMeta,
}: {
  initialReportId: number;
  initialMeta: ReportMeta;
}) {
  const [reportId, setReportId] = useState<number>(initialReportId);
  const [meta, setMeta] = useState<ReportMeta>(initialMeta);
  const [error, setError] = useState<string | null>(null);

  // Trigger creation if no existing report.
  useEffect(() => {
    if (reportId !== 0) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/reports/welcome", { method: "POST" });
        const d = await r.json();
        if (cancelled) return;
        if (!r.ok || !d.id) {
          setError(d.error ?? "Erreur de génération");
          return;
        }
        setReportId(d.id);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  // Poll status every 2s while pending.
  useEffect(() => {
    if (reportId === 0) return;
    if (meta.status === "ready") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/reports/${reportId}/status`);
        if (!r.ok) return;
        const d = await r.json();
        if (cancelled) return;
        // The /status endpoint returns { kind, meta } per the existing route.
        const newMeta = d.meta ?? d;
        setMeta(newMeta);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [reportId, meta.status]);

  const ready = meta.status === "ready";
  const progress = ready ? 100 : Math.max(meta.progress ?? 0, 5);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
          <h1 className="text-2xl font-semibold tracking-tight">Erreur de génération</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-card border border-border hover:bg-secondary/40 transition text-sm">
            Aller au dashboard <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">
      <header className="text-center space-y-2">
        <Link href="/" className="inline-flex items-center gap-2 mb-4">
          <div className="h-2 w-2 rounded-full bg-emerald" />
          <span className="font-semibold tracking-tight">Vitals</span>
        </Link>
      </header>

      {!ready ? (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-8 space-y-6"
        >
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-emerald animate-spin" />
            <h1 className="text-xl font-semibold tracking-tight">On analyse tes données…</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Nous croisons tes biomarqueurs, ton ADN et tes antécédents pour faire ressortir les 3 choses les plus
            importantes à actionner. Quelques dizaines de secondes.
          </p>
          <div className="h-1.5 bg-secondary/40 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <ul className="space-y-1.5 text-sm">
            {STEPS.map((s) => {
              const done = progress >= s.at;
              const active = progress < s.at && progress >= s.at - 15;
              return (
                <li key={s.at} className={`flex items-center gap-2 ${done ? "text-emerald" : active ? "text-foreground" : "text-muted-foreground"}`}>
                  {done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span className="h-3.5 w-3.5 inline-block" />
                  )}
                  {s.label}
                </li>
              );
            })}
          </ul>
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">L&apos;analyse continue en arrière-plan si tu fermes la page</span>
            <Link href="/dashboard" className="text-xs text-emerald hover:underline inline-flex items-center gap-1">
              Aller au dashboard, je verrai plus tard <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </motion.section>
      ) : (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-emerald text-xs font-medium uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" /> Ton analyse personnalisée
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Voici ce qu&apos;on a remarqué
            </h1>
            <p className="text-sm text-muted-foreground">3 choses concrètes à actionner.</p>
          </div>

          {meta.redFlagAlert && meta.redFlagAlert.labels?.length ? (
            <div className="rounded-xl border-2 border-red-500/40 bg-red-500/5 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-300">À discuter rapidement avec ton médecin</p>
                <p className="text-sm text-red-200/90">{meta.redFlagAlert.body}</p>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <AnimatePresence>
              {(meta.cards ?? []).map((c, i) => (
                <motion.div
                  key={c.index}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.12 }}
                  className={`rounded-xl border p-5 ${cardTone(c.kind)}`}
                >
                  <div className="flex items-center gap-2 text-emerald text-xs uppercase tracking-wider font-medium mb-2">
                    {cardIcon(c.kind)}
                    {c.title}
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-line">{c.body}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {(() => {
            const isEmptyOnly = (meta.cards ?? []).length === 1 && meta.cards![0].kind === "empty-state";
            if (isEmptyOnly) {
              return (
                <div className="pt-4 border-t border-border space-y-3">
                  <Link
                    href="/import"
                    className="block w-full px-4 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition flex items-center justify-center gap-2"
                  >
                    <Upload className="h-4 w-4" /> Importer mes documents
                  </Link>
                  <Link
                    href="/dashboard"
                    className="block w-full px-4 py-2.5 rounded-md border border-border bg-card hover:bg-secondary/40 transition text-sm flex items-center justify-center gap-2"
                  >
                    Aller au dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              );
            }
            return (
              <div className="pt-4 border-t border-border space-y-3">
                <Link
                  href="/data/profile?tab=identite&prefill=1"
                  className="block w-full px-4 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="h-4 w-4" /> Compléter mon profil détaillé
                </Link>
                <div className="flex gap-2">
                  <Link
                    href="/reports"
                    className="flex-1 px-4 py-2.5 rounded-md border border-border bg-card hover:bg-secondary/40 transition text-sm flex items-center justify-center gap-2"
                  >
                    <FileText className="h-4 w-4" /> Doctor Pack
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex-1 px-4 py-2.5 rounded-md border border-border bg-card hover:bg-secondary/40 transition text-sm flex items-center justify-center gap-2"
                  >
                    Dashboard <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })()}

          <p className="text-[10px] text-muted-foreground text-center px-4 leading-relaxed">
            Cette analyse est générée par IA à partir des données que tu nous as fournies. Vitals n&apos;est pas un dispositif médical et ne remplace jamais un avis médical. Discute toujours les résultats avec un professionnel de santé qualifié.
          </p>
        </motion.section>
      )}
    </div>
  );
}
