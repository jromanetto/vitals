import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { META_BY_SLUG } from "@/lib/biomarker-meta";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

type ProfileData = {
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  sex?: string;
  bloodType?: string;
};

type BiomarkerRow = {
  slug: string;
  name: string;
  category: string | null;
  value: number;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  date: number;
};

type Status = "optimal" | "normal" | "slightly-off" | "attention" | "unknown";

function statusOf(r: {
  value: number;
  refLow: number | null;
  refHigh: number | null;
  optimalLow: number | null;
  optimalHigh: number | null;
  longevityLow: number | null;
  longevityHigh: number | null;
}): Status {
  const inLong =
    r.longevityLow != null && r.longevityHigh != null && r.value >= r.longevityLow && r.value <= r.longevityHigh;
  const inLab = r.refLow != null && r.refHigh != null && r.value >= r.refLow && r.value <= r.refHigh;
  const inOpt =
    r.optimalLow != null && r.optimalHigh != null && r.value >= r.optimalLow && r.value <= r.optimalHigh;
  if (inLong) return "optimal";
  if (inLab || inOpt) return "normal";
  const ref =
    r.refLow != null && r.refHigh != null
      ? [r.refLow, r.refHigh]
      : r.optimalLow != null && r.optimalHigh != null
      ? [r.optimalLow, r.optimalHigh]
      : null;
  if (!ref) return "unknown";
  const [lo, hi] = ref;
  const offset =
    r.value < lo ? Math.abs((lo - r.value) / lo) : r.value > hi ? Math.abs((r.value - hi) / hi) : 0;
  return offset <= 0.15 ? "slightly-off" : "attention";
}

function ageFromBirth(birth?: string): number | null {
  if (!birth) return null;
  const d = new Date(birth);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function fmtDate(ts: number | string | null | undefined): string {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(ts) : new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { year: "numeric", month: "short", day: "numeric" });
}

async function loadData() {
  ensureSchema();
  const sqlite = db().$client;

  // Profile
  const profileRow = sqlite
    .prepare(`SELECT data FROM profile ORDER BY id DESC LIMIT 1`)
    .get() as { data: string } | undefined;
  let profile: ProfileData = {};
  if (profileRow) {
    try {
      profile = JSON.parse(profileRow.data);
    } catch {
      profile = {};
    }
  }

  // Latest panel date
  const latestPanel = sqlite
    .prepare(`SELECT MAX(date) AS d FROM biomarker`)
    .get() as { d: number | null } | undefined;
  const panelDate = latestPanel?.d ?? null;

  // Biomarkers from the latest panel date
  let biomarkers: BiomarkerRow[] = [];
  if (panelDate) {
    biomarkers = sqlite
      .prepare(
        `SELECT slug, name, category, value, unit, ref_low AS refLow, ref_high AS refHigh, date
         FROM biomarker
         WHERE date = ?
         ORDER BY LOWER(name)`
      )
      .all(panelDate) as BiomarkerRow[];
  }

  // Enrich with longevity range + status
  const enriched = biomarkers.map((b) => {
    const meta = META_BY_SLUG[b.slug];
    const optimalLow = meta?.optimalLow ?? null;
    const optimalHigh = meta?.optimalHigh ?? null;
    const longevityLow = meta?.longevityLow ?? null;
    const longevityHigh = meta?.longevityHigh ?? null;
    const status = statusOf({
      value: b.value,
      refLow: b.refLow,
      refHigh: b.refHigh,
      optimalLow,
      optimalHigh,
      longevityLow,
      longevityHigh,
    });
    return { ...b, optimalLow, optimalHigh, longevityLow, longevityHigh, status };
  });

  const offRange = enriched.filter((b) => b.status === "slightly-off" || b.status === "attention");
  const optimal = enriched.filter((b) => b.status === "optimal" || b.status === "normal");

  // Cached blood report (most recent)
  let bloodReport: { synthesis?: string; headline?: string; panelDate: number } | null = null;
  try {
    const row = sqlite
      .prepare(`SELECT panel_date AS panelDate, body FROM blood_report ORDER BY panel_date DESC LIMIT 1`)
      .get() as { panelDate: number; body: string } | undefined;
    if (row) {
      const parsed = JSON.parse(row.body);
      bloodReport = {
        synthesis: parsed.synthesis,
        headline: parsed.headline,
        panelDate: row.panelDate,
      };
    }
  } catch {
    bloodReport = null;
  }

  // DNA risks + protective
  const dnaRisks = sqlite
    .prepare(
      `SELECT rsid, trait, user_genotype AS genotype, magnitude, summary
       FROM dna_insight WHERE has_risk = 1
       ORDER BY COALESCE(magnitude,0) DESC LIMIT 25`
    )
    .all() as Array<{ rsid: string; trait: string; genotype: string; magnitude: number | null; summary: string | null }>;
  const dnaProtective = sqlite
    .prepare(
      `SELECT rsid, trait, user_genotype AS genotype, magnitude, summary
       FROM dna_insight WHERE is_protective = 1
       ORDER BY COALESCE(magnitude,0) DESC LIMIT 25`
    )
    .all() as Array<{ rsid: string; trait: string; genotype: string; magnitude: number | null; summary: string | null }>;

  // Active supplements
  const supplements = sqlite
    .prepare(
      `SELECT name, brand, dose, unit, timing, frequency, duration
       FROM supplement WHERE ended_at IS NULL
       ORDER BY LOWER(name)`
    )
    .all() as Array<{
      name: string;
      brand: string | null;
      dose: string | null;
      unit: string | null;
      timing: string | null;
      frequency: string | null;
      duration: string | null;
    }>;

  // Symptoms last 30d
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceISO = since.toISOString().slice(0, 10);
  const symptoms = sqlite
    .prepare(
      `SELECT key, AVG(value) AS avg, COUNT(*) AS n, MAX(date) AS last
       FROM symptom_log WHERE date >= ?
       GROUP BY key ORDER BY avg DESC`
    )
    .all(sinceISO) as Array<{ key: string; avg: number; n: number; last: string }>;

  return { profile, panelDate, offRange, optimal, bloodReport, dnaRisks, dnaProtective, supplements, symptoms };
}

const SYMPTOM_LABELS: Record<string, string> = {
  energy: "Énergie",
  focus: "Concentration",
  mood: "Humeur",
  anxiety: "Anxiété",
  sleep_quality: "Qualité sommeil",
  gut: "Digestion",
  libido: "Libido",
  skin: "Peau",
  hrv: "VFC (HRV)",
  pain: "Douleur",
  stress: "Stress",
};

const STATUS_LABELS: Record<Status, string> = {
  optimal: "Optimal",
  normal: "Normal",
  "slightly-off": "Légèrement hors plage",
  attention: "Attention",
  unknown: "—",
};

export default async function PraticienPage() {
  const { profile, panelDate, offRange, optimal, bloodReport, dnaRisks, dnaProtective, supplements, symptoms } =
    await loadData();

  const fullName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || "—";
  const age = ageFromBirth(profile.birthDate);
  const today = new Date();

  return (
    <div className="praticien-doc max-w-[800px] mx-auto bg-white text-black print:max-w-none print:mx-0">
      <div className="flex justify-end mb-4 no-print">
        <PrintButton />
      </div>

      {/* Header */}
      <header className="border-b-2 border-gray-800 pb-4 mb-6">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Vue praticien</h1>
            <p className="text-sm text-gray-600 mt-1">Synthèse médicale — Vitals</p>
          </div>
          <div className="text-right text-xs text-gray-700">
            <div>Généré le {today.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}</div>
          </div>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 mt-4 text-sm">
          <div>
            <dt className="text-xs uppercase text-gray-500">Patient</dt>
            <dd className="font-medium">{fullName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-500">Âge</dt>
            <dd className="font-medium">{age != null ? `${age} ans` : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-500">Sexe</dt>
            <dd className="font-medium">{profile.sex || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-500">Groupe sanguin</dt>
            <dd className="font-medium">{profile.bloodType || "—"}</dd>
          </div>
        </dl>
      </header>

      {/* Synthese */}
      {bloodReport && (
        <section className="mb-6 break-inside-avoid">
          <h2 className="text-base font-semibold border-b border-gray-300 pb-1 mb-3">Synthèse</h2>
          {bloodReport.headline && (
            <p className="text-sm font-medium mb-2">{bloodReport.headline}</p>
          )}
          {bloodReport.synthesis && (
            <p className="text-sm leading-relaxed text-gray-800">{bloodReport.synthesis}</p>
          )}
          <p className="text-xs text-gray-500 mt-2">Bilan du {fmtDate(bloodReport.panelDate)}</p>
        </section>
      )}

      {/* Off-range biomarkers */}
      <section className="mb-6 break-inside-avoid">
        <h2 className="text-base font-semibold border-b border-gray-300 pb-1 mb-3">
          Biomarqueurs hors plage
          {panelDate && <span className="text-xs font-normal text-gray-500 ml-2">— bilan du {fmtDate(panelDate)}</span>}
        </h2>
        {offRange.length === 0 ? (
          <p className="text-sm text-gray-600">Aucun biomarqueur hors plage sur le dernier bilan.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-400 text-left text-xs uppercase text-gray-600">
                <th className="py-1.5 pr-2 font-medium">Nom</th>
                <th className="py-1.5 pr-2 font-medium">Valeur</th>
                <th className="py-1.5 pr-2 font-medium">Réf. labo</th>
                <th className="py-1.5 pr-2 font-medium">Cible longévité</th>
                <th className="py-1.5 pr-2 font-medium">Statut</th>
                <th className="py-1.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {offRange.map((b) => (
                <tr key={b.slug} className="border-b border-gray-200">
                  <td className="py-1.5 pr-2 font-medium">{b.name}</td>
                  <td className="py-1.5 pr-2 tabular-nums">
                    {b.value} {b.unit ?? ""}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums text-gray-700">
                    {b.refLow != null && b.refHigh != null ? `${b.refLow}–${b.refHigh}` : "—"}
                  </td>
                  <td className="py-1.5 pr-2 tabular-nums text-gray-700">
                    {b.longevityLow != null && b.longevityHigh != null
                      ? `${b.longevityLow}–${b.longevityHigh}`
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-2">{STATUS_LABELS[b.status]}</td>
                  <td className="py-1.5 text-gray-600">{fmtDate(b.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Optimal biomarkers */}
      <section className="mb-6 break-inside-avoid">
        <h2 className="text-base font-semibold border-b border-gray-300 pb-1 mb-3">
          Biomarqueurs optimaux
          <span className="text-xs font-normal text-gray-500 ml-2">— {optimal.length} dans la cible</span>
        </h2>
        {optimal.length === 0 ? (
          <p className="text-sm text-gray-600">Aucun biomarqueur optimal détecté.</p>
        ) : (
          <p className="text-sm text-gray-800 leading-relaxed">
            {optimal.map((b) => b.name).join(" · ")}
          </p>
        )}
      </section>

      {/* DNA risks */}
      <section className="mb-6 break-inside-avoid">
        <h2 className="text-base font-semibold border-b border-gray-300 pb-1 mb-3">Variants ADN à risque</h2>
        {dnaRisks.length === 0 ? (
          <p className="text-sm text-gray-600">Aucun variant à risque identifié.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-400 text-left text-xs uppercase text-gray-600">
                <th className="py-1.5 pr-2 font-medium">RSID</th>
                <th className="py-1.5 pr-2 font-medium">Trait</th>
                <th className="py-1.5 pr-2 font-medium">Génotype</th>
                <th className="py-1.5 pr-2 font-medium">Magnitude</th>
                <th className="py-1.5 font-medium">Résumé</th>
              </tr>
            </thead>
            <tbody>
              {dnaRisks.map((r, i) => (
                <tr key={`${r.rsid}-${i}`} className="border-b border-gray-200 align-top">
                  <td className="py-1.5 pr-2 font-mono text-xs whitespace-nowrap">{r.rsid}</td>
                  <td className="py-1.5 pr-2">{r.trait}</td>
                  <td className="py-1.5 pr-2 font-mono text-xs">{r.genotype || "—"}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{r.magnitude != null ? r.magnitude.toFixed(1) : "—"}</td>
                  <td className="py-1.5 text-gray-700">{r.summary || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* DNA protective */}
      <section className="mb-6 break-inside-avoid">
        <h2 className="text-base font-semibold border-b border-gray-300 pb-1 mb-3">Variants ADN protecteurs</h2>
        {dnaProtective.length === 0 ? (
          <p className="text-sm text-gray-600">Aucun variant protecteur identifié.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-400 text-left text-xs uppercase text-gray-600">
                <th className="py-1.5 pr-2 font-medium">RSID</th>
                <th className="py-1.5 pr-2 font-medium">Trait</th>
                <th className="py-1.5 pr-2 font-medium">Génotype</th>
                <th className="py-1.5 pr-2 font-medium">Magnitude</th>
                <th className="py-1.5 font-medium">Résumé</th>
              </tr>
            </thead>
            <tbody>
              {dnaProtective.map((r, i) => (
                <tr key={`${r.rsid}-${i}`} className="border-b border-gray-200 align-top">
                  <td className="py-1.5 pr-2 font-mono text-xs whitespace-nowrap">{r.rsid}</td>
                  <td className="py-1.5 pr-2">{r.trait}</td>
                  <td className="py-1.5 pr-2 font-mono text-xs">{r.genotype || "—"}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{r.magnitude != null ? r.magnitude.toFixed(1) : "—"}</td>
                  <td className="py-1.5 text-gray-700">{r.summary || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Supplements */}
      <section className="mb-6 break-inside-avoid">
        <h2 className="text-base font-semibold border-b border-gray-300 pb-1 mb-3">
          Suppléments actifs
          <span className="text-xs font-normal text-gray-500 ml-2">— {supplements.length}</span>
        </h2>
        {supplements.length === 0 ? (
          <p className="text-sm text-gray-600">Aucun supplément actif.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-400 text-left text-xs uppercase text-gray-600">
                <th className="py-1.5 pr-2 font-medium">Nom</th>
                <th className="py-1.5 pr-2 font-medium">Marque</th>
                <th className="py-1.5 pr-2 font-medium">Dose</th>
                <th className="py-1.5 pr-2 font-medium">Timing</th>
                <th className="py-1.5 pr-2 font-medium">Fréquence</th>
                <th className="py-1.5 font-medium">Durée</th>
              </tr>
            </thead>
            <tbody>
              {supplements.map((s, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-1.5 pr-2 font-medium">{s.name}</td>
                  <td className="py-1.5 pr-2 text-gray-700">{s.brand || "—"}</td>
                  <td className="py-1.5 pr-2 tabular-nums">
                    {s.dose ? `${s.dose}${s.unit ? ` ${s.unit}` : ""}` : s.unit || "—"}
                  </td>
                  <td className="py-1.5 pr-2">{s.timing || "—"}</td>
                  <td className="py-1.5 pr-2">{s.frequency || "—"}</td>
                  <td className="py-1.5 text-gray-700">{s.duration || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Symptoms */}
      <section className="mb-6 break-inside-avoid">
        <h2 className="text-base font-semibold border-b border-gray-300 pb-1 mb-3">
          Symptômes récents <span className="text-xs font-normal text-gray-500 ml-2">— 30 derniers jours</span>
        </h2>
        {symptoms.length === 0 ? (
          <p className="text-sm text-gray-600">Aucun symptôme tracké sur les 30 derniers jours.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-400 text-left text-xs uppercase text-gray-600">
                <th className="py-1.5 pr-2 font-medium">Symptôme</th>
                <th className="py-1.5 pr-2 font-medium">Intensité moyenne</th>
                <th className="py-1.5 pr-2 font-medium">Entrées</th>
                <th className="py-1.5 font-medium">Dernier</th>
              </tr>
            </thead>
            <tbody>
              {symptoms.map((s) => (
                <tr key={s.key} className="border-b border-gray-200">
                  <td className="py-1.5 pr-2 font-medium">{SYMPTOM_LABELS[s.key] || s.key}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{s.avg.toFixed(1)} / 10</td>
                  <td className="py-1.5 pr-2 tabular-nums text-gray-700">{s.n}</td>
                  <td className="py-1.5 text-gray-600">{fmtDate(s.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="mt-10 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
        Document généré par Vitals — vitals.blueproject.org
      </footer>
    </div>
  );
}
