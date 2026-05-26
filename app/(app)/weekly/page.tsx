"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Check, Calendar, ArrowRight, FileText, Target, TrendingUp, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";

type DerivedRoutine = {
  id: string;
  label: string;
  hint?: string;
  target: { min: number; max: number; unit: string };
  weeklyMax: number;
  source: "profile" | "default";
};

const SYMPTOMS = [
  { key: "energy", label: "Énergie", hint: "0=épuisé · 10=débordant" },
  { key: "mood", label: "Humeur", hint: "0=sombre · 10=lumineuse" },
  { key: "focus", label: "Focus", hint: "0=brumeux · 10=laser" },
  { key: "sleep_quality", label: "Sommeil", hint: "qualité ressentie" },
  { key: "gut", label: "Digestion", hint: "0=galère · 10=parfaite" },
  { key: "skin", label: "Peau", hint: "0=irritée · 10=nickel" },
  { key: "anxiety", label: "Anxiété", hint: "0=zéro · 10=max" },
  { key: "libido", label: "Libido", hint: "ressenti général" },
];

// Habits now come dynamically from the user's declared profile routines
// via GET /api/weekly. See lib/weekly/routines.ts for the derivation map.

// ────────── ISO week helpers (client-side mirror of the API ones) ──────────
function isoWeekString(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
function isoWeekMonday(weekIso: string): Date {
  const m = weekIso.match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) return new Date();
  const y = Number(m[1]);
  const w = Number(m[2]);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow + 1);
  const result = new Date(week1Monday);
  result.setUTCDate(week1Monday.getUTCDate() + (w - 1) * 7);
  return result;
}
function shiftWeek(weekIso: string, deltaWeeks: number): string {
  const monday = isoWeekMonday(weekIso);
  monday.setUTCDate(monday.getUTCDate() + deltaWeeks * 7);
  return isoWeekString(monday);
}
function formatWeekRange(weekIso: string): string {
  const monday = isoWeekMonday(weekIso);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${fmt(monday)} → ${fmt(sunday)}`;
}

type TrendRow = { id: number; weekIso: string; weekStart: number; avgSymptom: number | null; avgHabit: number | null };

export default function WeeklyPage() {
  const [weekIso, setWeekIso] = useState<string>(() => isoWeekString(new Date()));
  const [symptoms, setSymptoms] = useState<Record<string, number>>({});
  const [habits, setHabits] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [hasCheckin, setHasCheckin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [routines, setRoutines] = useState<DerivedRoutine[]>([]);
  const [routinesFromProfile, setRoutinesFromProfile] = useState(false);

  const load = useCallback(async (week: string) => {
    setLoading(true);
    setSaved(false);
    try {
      const r = await fetch(`/api/weekly?week=${encodeURIComponent(week)}`);
      const d = await r.json();
      setSymptoms(d.symptoms ?? {});
      setHabits(d.habits ?? {});
      setNotes(d.checkin?.notes ?? "");
      setHasCheckin(Boolean(d.checkin));
      setTrend(d.trend ?? []);
      setRoutines(d.routines ?? []);
      setRoutinesFromProfile(Boolean(d.routinesFromProfile));
    } catch {
      // swallow — empty state is acceptable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(weekIso); }, [weekIso, load]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const r = await fetch("/api/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekIso, symptoms, habits, notes: notes || null }),
      });
      if (r.ok) {
        setSaved(true);
        setHasCheckin(true);
        // refresh the trend so the just-saved week appears
        load(weekIso);
      }
    } finally {
      setSaving(false);
    }
  }

  const isCurrentWeek = useMemo(() => weekIso === isoWeekString(new Date()), [weekIso]);
  const filledCount = useMemo(
    () => Object.keys(symptoms).length + Object.keys(habits).length,
    [symptoms, habits],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Bilan semaine"
        description="Check-in hebdo — une fois par semaine, on fait le point. Pas besoin de cliquer chaque jour."
        icon={<Calendar className="h-5 w-5 text-emerald" />}
      />

      {/* Week navigator */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <button
          onClick={() => setWeekIso(shiftWeek(weekIso, -1))}
          className="p-2 rounded-md hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition"
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <div className="text-sm font-medium">Semaine du {formatWeekRange(weekIso)}</div>
          <div className="text-[11px] text-muted-foreground tabular-nums">
            {weekIso} {isCurrentWeek && "· semaine en cours"}
            {hasCheckin && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-emerald">
                <Check className="h-3 w-3" /> enregistré
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setWeekIso(shiftWeek(weekIso, +1))}
          disabled={isCurrentWeek}
          className="p-2 rounded-md hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Semaine suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Symptoms */}
      <section className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Symptômes — moyenne sur la semaine</h2>
          <p className="text-xs text-muted-foreground mt-1">Glisse pour estimer ta moyenne (0-10).</p>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : (
          <div className="space-y-4">
            {SYMPTOMS.map((s) => {
              const v = symptoms[s.key];
              const set = v !== undefined;
              return (
                <div key={s.key} className="grid grid-cols-1 sm:grid-cols-[180px_1fr_60px] items-center gap-3">
                  <div>
                    <div className="text-sm font-medium">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground">{s.hint}</div>
                  </div>
                  <input
                    type="range" min={0} max={10} step={1}
                    value={set ? v : 5}
                    onChange={(e) => setSymptoms({ ...symptoms, [s.key]: Number(e.target.value) })}
                    className={`accent-emerald w-full ${set ? "" : "opacity-50"}`}
                    aria-label={s.label}
                  />
                  <div className={`text-right tabular-nums text-sm font-mono ${set ? "text-emerald" : "text-muted-foreground"}`}>
                    {set ? `${v}/10` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Routines — dynamiques selon le profil */}
      <section className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Routines — adherence</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {routinesFromProfile
                ? "Basé sur ce que tu as déclaré dans Profil santé. Combien de fois cette semaine ?"
                : "Routines par défaut. Remplis Profil santé pour personnaliser."}
            </p>
          </div>
          {routinesFromProfile ? (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border border-emerald/30 bg-emerald/10 text-emerald">
              <Target className="h-3 w-3" /> personnalisé
            </span>
          ) : (
            <Link href="/data/profile?tab=lifestyle" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition">
              <AlertCircle className="h-3 w-3" /> personnaliser →
            </Link>
          )}
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </div>
        ) : routines.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aucune routine à suivre cette semaine.</div>
        ) : (
          <div className="space-y-4">
            {routines.map((r) => {
              const v = habits[r.id];
              const set = v !== undefined;
              const onTarget = set && v >= r.target.min && v <= r.target.max;
              const belowTarget = set && v < r.target.min;
              const aboveTarget = set && v > r.target.max;
              const max = r.weeklyMax;
              const buttons = Array.from({ length: max + 1 }, (_, i) => i);
              return (
                <div key={r.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{r.label}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        <Target className="h-3 w-3 text-emerald" />
                        <span>
                          cible <span className="text-foreground font-mono tabular-nums">
                            {r.target.min === r.target.max ? r.target.min : `${r.target.min}-${r.target.max}`}
                          </span> {r.target.unit}/sem
                        </span>
                        {r.hint && <span className="text-muted-foreground/70">· {r.hint}</span>}
                      </div>
                    </div>
                    {set && (
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        onTarget
                          ? "border border-emerald/30 bg-emerald/10 text-emerald"
                          : belowTarget
                          ? "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                          : aboveTarget
                          ? "border border-sky-500/30 bg-sky-500/10 text-sky-400"
                          : ""
                      }`}>
                        {onTarget && <><Check className="h-3 w-3" /> sur la cible</>}
                        {belowTarget && <><AlertCircle className="h-3 w-3" /> {r.target.min - v} sous la cible</>}
                        {aboveTarget && <><TrendingUp className="h-3 w-3" /> +{v - r.target.max} au-dessus</>}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {buttons.map((n) => {
                      const active = v === n;
                      const inTargetBand = n >= r.target.min && n <= r.target.max;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setHabits({ ...habits, [r.id]: n })}
                          className={`h-8 w-8 rounded-md text-xs font-mono tabular-nums transition border ${
                            active
                              ? "bg-primary text-primary-foreground border-primary"
                              : inTargetBand
                              ? "bg-emerald/10 border-emerald/30 text-emerald hover:bg-emerald/20"
                              : "bg-secondary/30 border-border text-muted-foreground hover:text-foreground"
                          }`}
                          aria-label={`${r.label}: ${n} ${r.target.unit}`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Notes */}
      <section className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Notes libres</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ce qui s'est bien passé, ce qui a coincé, un déclic, une question pour ton équipe médicale…"
          rows={4}
          className="w-full bg-secondary/30 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition resize-y"
        />
      </section>

      {/* Save */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
        className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 backdrop-blur p-4 shadow-xl"
      >
        <div className="text-xs text-muted-foreground">
          {filledCount > 0
            ? `${filledCount} champs renseignés`
            : "Tu peux laisser des champs vides — sauvegarde quand tu veux."}
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald">
              <Check className="h-3.5 w-3.5" /> Enregistré
            </span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition flex items-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {hasCheckin ? "Mettre à jour" : "Enregistrer le bilan"}
          </button>
        </div>
      </motion.div>

      {/* Trend */}
      {trend.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">12 dernières semaines</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Symptômes en émeraude (moyenne /10), habitudes en sky (moyenne /7).
            </p>
          </div>
          <div className="space-y-2">
            {trend.map((t) => {
              const monday = new Date(t.weekStart);
              const sunday = new Date(t.weekStart + 6 * 86400000);
              const fmt = (d: Date) =>
                d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
              const symPct = Math.max(0, Math.min(100, ((t.avgSymptom ?? 0) / 10) * 100));
              const habPct = Math.max(0, Math.min(100, ((t.avgHabit ?? 0) / 7) * 100));
              const active = t.weekIso === weekIso;
              return (
                <button
                  key={t.id}
                  onClick={() => setWeekIso(t.weekIso)}
                  className={`w-full text-left rounded-md border px-3 py-2 transition ${
                    active ? "border-emerald bg-emerald/5" : "border-border bg-secondary/20 hover:bg-secondary/40"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{fmt(monday)} → {fmt(sunday)}</span>
                    <span className="text-muted-foreground tabular-nums">
                      sympt {t.avgSymptom != null ? t.avgSymptom.toFixed(1) : "—"}/10 ·
                      hab {t.avgHabit != null ? t.avgHabit.toFixed(1) : "—"}/7
                    </span>
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    <div className="h-1 flex-1 rounded-full bg-secondary/40 overflow-hidden">
                      <div className="h-full bg-emerald" style={{ width: `${symPct}%` }} />
                    </div>
                    <div className="h-1 flex-1 rounded-full bg-secondary/40 overflow-hidden">
                      <div className="h-full bg-sky-400" style={{ width: `${habPct}%` }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Daily fallback */}
      <div className="text-center text-xs text-muted-foreground">
        Tu préfères le mode quotidien ?{" "}
        <Link href="/daily" className="text-emerald hover:underline inline-flex items-center gap-1">
          <FileText className="h-3 w-3" /> Voir l&apos;historique quotidien <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
