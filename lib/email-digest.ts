/**
 * Weekly digest: deltas computation + Resend HTML template.
 *
 * Phase: email digests (Sprint — weekly summary cron).
 * Touched by: app/api/cron/weekly-digest/route.ts.
 *
 * `computeWeeklyDeltas(userId)` is a read function: it reads the migrated health
 * tables (biomarker, symptom_log, supplement, supplement_log, dna_insight) from
 * Convex — no writes — and returns the structured deltas object.
 * `weeklyDigestTemplate` turns that object into the `{subject, html, text}`
 * payload `sendEmail` expects.
 *
 * All reads are self-scoped (authUserId only, no viewUserId): the digest never
 * looks at another member's data.
 */
import { decryptProfile } from "@/lib/crypto-fields";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type DigestBiomarker = {
  name: string;
  slug: string;
  value: number;
  date: number;
};

export type DigestRedFlag = {
  key: string;
  count: number;
};

export type DigestTodoItem = {
  title: string;
  rationale: string;
  kind: string;
  priority: "high" | "medium" | "low";
};

export type WeeklyDeltas = {
  userId: number;
  firstName: string | null;
  newBiomarkers: DigestBiomarker[];
  redFlagSymptoms: DigestRedFlag[];
  overdueScreenings: string[];
  supplementAdherencePct: number | null; // null if no active supplements
  vitalsScoreChange: {
    current: number | null;
    previousWeek: number | null;
  };
  topTodos: DigestTodoItem[]; // top-3 pending actions from the recommendations engine
};

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/**
 * Symptom keys flagged as concerning enough to surface in the digest.
 * These mirror the catalog in `lib/medical/symptom-catalog.ts`.
 */
const RED_FLAG_SYMPTOM_KEYS = [
  "chest_pain",
  "blood_stool",
  "new_mole",
  "memory_loss",
  "tremor",
  "cough",
  "thirst",
  "weight_change",
  "night_sweats",
  "fever_recurrent",
];

/** Human-readable labels for red-flag keys (French, tutoiement). */
const RED_FLAG_LABELS: Record<string, string> = {
  chest_pain: "Douleur thoracique",
  blood_stool: "Sang dans les selles",
  new_mole: "Nouveau grain de beauté",
  memory_loss: "Perte de mémoire",
  tremor: "Tremblements",
  cough: "Toux persistante",
  thirst: "Soif inhabituelle",
  weight_change: "Changement de poids",
  night_sweats: "Sueurs nocturnes",
  fever_recurrent: "Fièvre récurrente",
};

/** Screenings the digest tracks (id → French label). */
const SCREENING_LABELS: Record<string, string> = {
  blood_panel: "Bilan sanguin complet",
  dental: "Bilan dentaire",
  pap_smear: "Frottis cervico-vaginal",
};

const ONE_DAY_MS = 86_400_000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const YEAR_MS = 365 * ONE_DAY_MS;

/* ------------------------------------------------------------------ */
/* Convex read helpers                                                 */
/* ------------------------------------------------------------------ */

/** Raw biomarker row shape returned by api.biomarkers.all. */
type BmRow = {
  id: number;
  slug: string;
  name: string;
  category: string | null;
  value: number;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  date: number;
  source: string | null;
};

/** Fetch all biomarker rows for the user (self-scoped). Best-effort → [] on error. */
async function fetchBiomarkers(userId: number): Promise<BmRow[]> {
  try {
    const { rows } = await convexServer().query(api.biomarkers.all, {
      secret: bridgeSecret(),
      authUserId: userId,
    });
    return rows as BmRow[];
  } catch {
    return [];
  }
}

/**
 * Latest row per slug over `rows`. If `asOf` is given, only rows with date <= asOf
 * are considered (mirrors the legacy `MAX(date) ... WHERE date <= ?` grouping).
 */
function latestPerSlug(rows: BmRow[], asOf?: number): BmRow[] {
  const map = new Map<string, BmRow>();
  for (const r of rows) {
    if (asOf != null && r.date > asOf) continue;
    const cur = map.get(r.slug);
    if (!cur || r.date > cur.date) map.set(r.slug, r);
  }
  return [...map.values()];
}

/** Parse ISO YYYY-MM-DD or YYYY-MM-DDTHH:mm to a timestamp (ms). null on bad input. */
function parseIsoDate(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/* ------------------------------------------------------------------ */
/* Profile helpers                                                     */
/* ------------------------------------------------------------------ */

type LooseProfile = Record<string, unknown> & {
  firstName?: unknown;
  sex?: unknown;
  screeningHistory?: unknown;
};

async function loadProfile(userId: number): Promise<LooseProfile | null> {
  try {
    const { data } = await convexServer().query(api.profile.get, {
      secret: bridgeSecret(),
      authUserId: userId,
    });
    if (!data) return null;
    const parsed = JSON.parse(data);
    return decryptProfile(parsed) as LooseProfile;
  } catch {
    return null;
  }
}

function firstNameFromProfile(profile: LooseProfile | null): string | null {
  if (!profile) return null;
  const v = profile.firstName;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function isFemale(profile: LooseProfile | null): boolean {
  if (!profile) return false;
  const s = String(profile.sex ?? "").toLowerCase();
  return s === "femme" || s === "female" || s === "f";
}

function overdueScreenings(profile: LooseProfile | null): string[] {
  if (!profile) return [];
  const sh = profile.screeningHistory;
  if (!sh || typeof sh !== "object") return [];
  const map = sh as Record<string, { lastDate?: string } | undefined>;
  const now = Date.now();
  const ids = ["blood_panel", "dental"];
  if (isFemale(profile)) ids.push("pap_smear");
  const overdue: string[] = [];
  for (const id of ids) {
    const last = parseIsoDate(map[id]?.lastDate);
    // If never recorded OR > 365d ago → overdue.
    if (last == null || now - last > YEAR_MS) overdue.push(id);
  }
  return overdue;
}

/* ------------------------------------------------------------------ */
/* Activity probe (for cron filtering)                                 */
/* ------------------------------------------------------------------ */

/**
 * Returns true if the user has logged anything (biomarker / symptom / supplement)
 * in the last `windowMs` window. Used by the cron to skip dormant accounts.
 *
 * NOTE: now async (reads Convex). Callers MUST await it.
 */
export async function userHasRecentActivity(
  userId: number,
  windowMs = 30 * ONE_DAY_MS,
): Promise<boolean> {
  const sinceTs = Date.now() - windowMs;
  const sinceIso = new Date(sinceTs).toISOString().slice(0, 10);
  const days = Math.max(1, Math.ceil(windowMs / ONE_DAY_MS));
  const secret = bridgeSecret();

  try {
    const bm = await fetchBiomarkers(userId);
    if (bm.some((r) => r.date >= sinceTs)) return true;

    const { rows: sym } = await convexServer().query(api.symptoms.list, {
      secret,
      authUserId: userId,
      days,
    });
    if (sym.some((s) => s.date >= sinceIso)) return true;

    // supplement_log all-taken-since: rows only exist for taken=1 (untaking
    // deletes the row in Convex), so any row = activity, like the legacy probe.
    const { rows: sup } = await convexServer().query(api.supplements.logHistory, {
      secret,
      authUserId: userId,
      days,
    });
    if (sup.some((l) => l.date >= sinceIso)) return true;
  } catch {
    // Fail like the legacy safeGet path: treat as no activity.
    return false;
  }

  return false;
}

/* ------------------------------------------------------------------ */
/* Lightweight per-user longevity score                                */
/* ------------------------------------------------------------------ */

/**
 * Minimal per-user longevity-score-ish number (0..100) so we can diff this week
 * vs last week without depending on the single-tenant `computeLongevityScore`.
 * Heuristic: fraction of latest biomarkers within their reference range.
 *
 * Pure over `allRows` (fetched once by the caller). `asOf` is the cutoff
 * timestamp — only biomarkers with date <= asOf are counted.
 */
function approxLongevityScore(allRows: BmRow[], asOf: number): number | null {
  const latest = latestPerSlug(allRows, asOf);
  let inRange = 0;
  let total = 0;
  for (const r of latest) {
    if (r.refLow == null || r.refHigh == null) continue;
    total++;
    if (r.value >= r.refLow && r.value <= r.refHigh) inRange++;
  }
  if (total === 0) return null;
  return Math.round((inRange / total) * 100);
}

/* ------------------------------------------------------------------ */
/* Main: computeWeeklyDeltas                                           */
/* ------------------------------------------------------------------ */

export async function computeWeeklyDeltas(userId: number): Promise<WeeklyDeltas> {
  const now = Date.now();
  const weekAgo = now - SEVEN_DAYS_MS;
  const weekAgoIso = new Date(weekAgo).toISOString().slice(0, 10);

  const profile = await loadProfile(userId);
  const firstName = firstNameFromProfile(profile);
  const secret = bridgeSecret();

  // Fetch all biomarker rows once — reused by newBiomarkers, topTodos, and the
  // longevity-score diff below.
  const bmAll = await fetchBiomarkers(userId);

  // ---- newBiomarkers (last 7d, date DESC, LIMIT 50) ----
  const newBiomarkers: DigestBiomarker[] = bmAll
    .filter((r) => r.date >= weekAgo)
    .sort((a, b) => b.date - a.date)
    .slice(0, 50)
    .map((r) => ({ name: r.name, slug: r.slug, value: r.value, date: r.date }));

  // ---- redFlagSymptoms (last 7d, key ∈ RED_FLAG_SYMPTOM_KEYS) ----
  // GROUP BY key COUNT(*) reproduced in JS; one symptom_log row per (date,key).
  let redFlagSymptoms: DigestRedFlag[] = [];
  try {
    const { rows: symRows } = await convexServer().query(api.symptoms.list, {
      secret,
      authUserId: userId,
      days: 7,
    });
    const counts = new Map<string, number>();
    for (const s of symRows) {
      if (s.date >= weekAgoIso && RED_FLAG_SYMPTOM_KEYS.includes(s.key)) {
        counts.set(s.key, (counts.get(s.key) ?? 0) + 1);
      }
    }
    redFlagSymptoms = [...counts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  } catch {
    // Best-effort — digest still ships without symptom flags.
  }

  // ---- overdueScreenings (3 hardcoded ids, pap_smear only for women) ----
  const overdue = overdueScreenings(profile);

  // ---- supplementAdherencePct (taken count / (active supplements * 7)) ----
  let supplementAdherencePct: number | null = null;
  try {
    const { rows: supRows } = await convexServer().query(api.supplements.list, {
      secret,
      authUserId: userId,
    });
    // active = ended_at IS NULL OR ended_at = 0
    const activeCount = supRows.filter((s) => {
      const endedAt = s.endedAt as number | null;
      return endedAt == null || endedAt === 0;
    }).length;
    if (activeCount > 0) {
      // logHistory (no supplementId) returns taken rows only, last `days`.
      const { rows: logRows } = await convexServer().query(api.supplements.logHistory, {
        secret,
        authUserId: userId,
        days: 7,
      });
      const got = logRows.filter((l) => l.date >= weekAgoIso).length;
      const expected = activeCount * 7;
      supplementAdherencePct =
        expected > 0 ? Math.min(100, Math.round((got / expected) * 100)) : null;
    }
  } catch {
    // Best-effort — digest still ships without adherence.
  }

  // ---- vitalsScoreChange (this week vs last week) ----
  const current = approxLongevityScore(bmAll, now);
  const previousWeek = approxLongevityScore(bmAll, weekAgo);

  // ---- topTodos (top 3 pending actions from recommendations engine) ----
  let topTodos: DigestTodoItem[] = [];
  try {
    // Lazy-import the engine to avoid loading the catalogs on every digest run
    // when the engine itself fails to resolve in serverless edge edge-cases.
    const { computeTodo } = require("./recommendations/engine") as typeof import("./recommendations/engine");
    // latest-per-slug biomarkers, ORDER BY name
    const biomarkers = latestPerSlug(bmAll)
      .map((b) => ({ slug: b.slug, name: b.name, value: b.value, refLow: b.refLow, refHigh: b.refHigh }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const { rows: dnaRows } = await convexServer().query(api.dna.insights, {
      secret,
      authUserId: userId,
    });
    const dna = dnaRows.map((d) => ({
      rsid: d.rsid,
      category: d.category,
      hasRisk: d.hasRisk,
      isProtective: d.isProtective,
    }));
    const items = computeTodo({
      profile: profile as Parameters<typeof computeTodo>[0]["profile"],
      biomarkers: biomarkers.map((b) => ({ ...b, hasRisk: undefined })) as Parameters<typeof computeTodo>[0]["biomarkers"],
      dna: dna.map((d) => ({ ...d, hasRisk: !!d.hasRisk, isProtective: !!d.isProtective })) as Parameters<typeof computeTodo>[0]["dna"],
      supplements: [],
    });
    topTodos = items.slice(0, 3).map((it) => ({
      title: it.title,
      rationale: it.rationale,
      kind: it.kind,
      priority: it.priority,
    }));
  } catch {
    // Best-effort — digest still ships without todos if the engine errors.
  }

  return {
    userId,
    firstName,
    newBiomarkers,
    redFlagSymptoms,
    overdueScreenings: overdue,
    supplementAdherencePct,
    vitalsScoreChange: { current, previousWeek },
    topTodos,
  };
}

/**
 * Returns true if the deltas object contains at least one "meaningful" change
 * worth emailing the user about. The cron uses this to skip empty digests.
 */
export function hasMeaningfulDeltas(d: WeeklyDeltas): boolean {
  if (d.topTodos.length > 0) return true;
  if (d.newBiomarkers.length > 0) return true;
  if (d.redFlagSymptoms.length > 0) return true;
  if (d.overdueScreenings.length > 0) return true;
  if (d.supplementAdherencePct != null && d.supplementAdherencePct < 80) return true;
  const c = d.vitalsScoreChange.current;
  const p = d.vitalsScoreChange.previousWeek;
  if (c != null && p != null && Math.abs(c - p) >= 3) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* Template                                                            */
/* ------------------------------------------------------------------ */

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  background: #0a0a0b; color: #e5e7eb; padding: 32px 16px;
`;

const CARD_STYLE = `
  max-width: 560px; margin: 0 auto; background: #18181b;
  border: 1px solid #27272a; border-radius: 16px; padding: 32px; color: #e5e7eb;
`;

const BUTTON_STYLE = `
  display: inline-block; padding: 12px 20px; border-radius: 8px;
  background: #10b981; color: #0a0a0b !important; font-weight: 600;
  text-decoration: none; font-size: 14px; margin: 16px 0;
`;

const SECTION_TITLE_STYLE = `
  font-size:13px;letter-spacing:0.06em;text-transform:uppercase;
  color:#10b981;margin:24px 0 8px;font-weight:600;
`;

const HEADER_GRADIENT_STYLE = `
  background: linear-gradient(135deg, #064e3b 0%, #10b981 100%);
  margin: -32px -32px 24px; padding: 24px 32px;
  border-radius: 16px 16px 0 0;
  color: #ecfdf5;
`;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function todoSection(items: DigestTodoItem[]): string {
  if (items.length === 0) return "";
  const rows = items
    .map((t) => {
      const tone = t.priority === "high" ? "#fca5a5" : t.priority === "medium" ? "#fcd34d" : "#a1a1aa";
      return `
        <li style="margin:8px 0;font-size:14px;color:#d4d4d8;list-style:none;padding:8px 12px;background:#18181b;border-left:3px solid ${tone};border-radius:4px">
          <strong style="color:#ecfdf5">${esc(t.title)}</strong>
          <div style="font-size:13px;color:#a1a1aa;margin-top:4px;line-height:1.5">${esc(t.rationale)}</div>
        </li>`;
    })
    .join("");
  return `
    <div style="${SECTION_TITLE_STYLE}">À faire — top ${items.length}</div>
    <ul style="list-style:none;padding:0;margin:0">${rows}</ul>
    <p style="margin:8px 0 16px;font-size:12px;color:#71717a">
      <a href="https://vitals.club/todo" style="color:#10b981;text-decoration:none">Voir toutes mes actions →</a>
    </p>
  `;
}

function biomarkerSection(items: DigestBiomarker[]): string {
  if (items.length === 0) return "";
  const rows = items
    .slice(0, 8)
    .map(
      (b) => `
        <li style="margin:6px 0;font-size:14px;color:#d4d4d8">
          <strong style="color:#ecfdf5">${esc(b.name)}</strong>
          <span style="color:#a1a1aa"> · ${b.value} · ${esc(formatDate(b.date))}</span>
        </li>`,
    )
    .join("");
  return `
    <div style="${SECTION_TITLE_STYLE}">Nouveaux biomarqueurs (${items.length})</div>
    <ul style="list-style:none;padding:0;margin:0">${rows}</ul>
  `;
}

function symptomsSection(items: DigestRedFlag[]): string {
  if (items.length === 0) return "";
  const rows = items
    .map(
      (s) => `
        <li style="margin:6px 0;font-size:14px;color:#d4d4d8">
          <strong style="color:#fca5a5">${esc(RED_FLAG_LABELS[s.key] ?? s.key)}</strong>
          <span style="color:#a1a1aa"> · ${s.count}x cette semaine</span>
        </li>`,
    )
    .join("");
  return `
    <div style="${SECTION_TITLE_STYLE}">Symptômes à surveiller</div>
    <ul style="list-style:none;padding:0;margin:0">${rows}</ul>
    <p style="font-size:12px;color:#a1a1aa;margin:8px 0 0;line-height:1.5">
      Ces symptômes méritent d'être discutés avec ton médecin si ça persiste.
    </p>
  `;
}

function screeningsSection(items: string[]): string {
  if (items.length === 0) return "";
  const rows = items
    .map(
      (id) => `
        <li style="margin:6px 0;font-size:14px;color:#d4d4d8">
          <strong style="color:#fde68a">${esc(SCREENING_LABELS[id] ?? id)}</strong>
          <span style="color:#a1a1aa"> · à refaire</span>
        </li>`,
    )
    .join("");
  return `
    <div style="${SECTION_TITLE_STYLE}">Examens en retard</div>
    <ul style="list-style:none;padding:0;margin:0">${rows}</ul>
  `;
}

function adherenceSection(pct: number | null): string {
  if (pct == null) return "";
  const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#fde68a" : "#fca5a5";
  return `
    <div style="${SECTION_TITLE_STYLE}">Adhérence suppléments</div>
    <p style="font-size:14px;color:#d4d4d8;margin:0">
      <strong style="color:${color};font-size:18px">${pct}%</strong>
      des prises effectuées cette semaine.
    </p>
  `;
}

function scoreSection(change: WeeklyDeltas["vitalsScoreChange"]): string {
  const c = change.current;
  const p = change.previousWeek;
  if (c == null) return "";
  if (p == null) {
    return `
      <div style="${SECTION_TITLE_STYLE}">Score Vitals</div>
      <p style="font-size:14px;color:#d4d4d8;margin:0">
        <strong style="color:#10b981;font-size:18px">${c}/100</strong>
      </p>`;
  }
  const diff = c - p;
  const arrow = diff > 0 ? "↗" : diff < 0 ? "↘" : "→";
  const color = diff > 0 ? "#10b981" : diff < 0 ? "#fca5a5" : "#a1a1aa";
  const sign = diff > 0 ? "+" : "";
  return `
    <div style="${SECTION_TITLE_STYLE}">Score Vitals</div>
    <p style="font-size:14px;color:#d4d4d8;margin:0">
      <strong style="color:#10b981;font-size:18px">${c}/100</strong>
      <span style="color:${color};margin-left:8px">${arrow} ${sign}${diff} vs semaine dernière</span>
    </p>
  `;
}

export function weeklyDigestTemplate(deltas: WeeklyDeltas): {
  subject: string;
  html: string;
  text: string;
} {
  const name = deltas.firstName ? `, ${deltas.firstName}` : "";
  const sections =
    todoSection(deltas.topTodos) +
    biomarkerSection(deltas.newBiomarkers) +
    symptomsSection(deltas.redFlagSymptoms) +
    screeningsSection(deltas.overdueScreenings) +
    adherenceSection(deltas.supplementAdherencePct) +
    scoreSection(deltas.vitalsScoreChange);

  const html = `<!doctype html><html lang="fr"><body style="${BASE_STYLE}">
    <div style="${CARD_STYLE}">
      <div style="${HEADER_GRADIENT_STYLE}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ecfdf5"></span>
          <span style="font-weight:600;font-size:14px;color:#ecfdf5">Vitals</span>
        </div>
        <h1 style="font-size:22px;font-weight:600;margin:0;line-height:1.3;color:#ecfdf5">
          Voici ce qui a changé chez toi${esc(name)} cette semaine
        </h1>
      </div>
      <p style="font-size:14px;color:#a1a1aa;margin:0 0 8px;line-height:1.5">
        Un résumé court de tes 7 derniers jours. Ouvre le dashboard pour creuser.
      </p>
      ${sections}
      <a href="https://vitals.club/dashboard" style="${BUTTON_STYLE}">Ouvrir mon dashboard →</a>
      <hr style="border:none;border-top:1px solid #27272a;margin:32px 0 16px" />
      <p style="font-size:12px;color:#71717a;margin:0;line-height:1.5">
        Vitals · plateforme de santé personnelle · données chiffrées · hébergement EU<br/>
        Tu reçois cet email parce que tu as une activité récente sur Vitals.
        <a href="https://vitals.club/legal/privacy" style="color:#10b981">Confidentialité</a>.
      </p>
    </div>
  </body></html>`;

  // Plain-text fallback
  const lines: string[] = [];
  lines.push(`Voici ce qui a changé chez toi${name ? `, ${deltas.firstName}` : ""} cette semaine`);
  lines.push("");
  if (deltas.newBiomarkers.length) {
    lines.push(`Nouveaux biomarqueurs (${deltas.newBiomarkers.length}) :`);
    for (const b of deltas.newBiomarkers.slice(0, 8)) {
      lines.push(`  - ${b.name} : ${b.value} (${formatDate(b.date)})`);
    }
    lines.push("");
  }
  if (deltas.redFlagSymptoms.length) {
    lines.push("Symptômes à surveiller :");
    for (const s of deltas.redFlagSymptoms) {
      lines.push(`  - ${RED_FLAG_LABELS[s.key] ?? s.key} (${s.count}x)`);
    }
    lines.push("");
  }
  if (deltas.overdueScreenings.length) {
    lines.push("Examens en retard :");
    for (const id of deltas.overdueScreenings) {
      lines.push(`  - ${SCREENING_LABELS[id] ?? id}`);
    }
    lines.push("");
  }
  if (deltas.supplementAdherencePct != null) {
    lines.push(`Adhérence suppléments : ${deltas.supplementAdherencePct}%`);
    lines.push("");
  }
  if (deltas.vitalsScoreChange.current != null) {
    const c = deltas.vitalsScoreChange.current;
    const p = deltas.vitalsScoreChange.previousWeek;
    if (p == null) {
      lines.push(`Score Vitals : ${c}/100`);
    } else {
      const diff = c - p;
      const sign = diff > 0 ? "+" : "";
      lines.push(`Score Vitals : ${c}/100 (${sign}${diff} vs semaine dernière)`);
    }
    lines.push("");
  }
  lines.push("Dashboard : https://vitals.club/dashboard");

  return {
    subject: "Ton résumé Vitals de la semaine",
    html,
    text: lines.join("\n"),
  };
}
