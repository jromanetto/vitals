import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { ReportBodyPoller } from "@/components/report-body-poller";
import { PrintTrigger } from "@/components/print-trigger";
import { DoctorPackCover } from "@/components/praticien/doctor-pack-cover";
import { DoctorPackToc } from "@/components/praticien/doctor-pack-toc";
import { DoctorPackSection } from "@/components/praticien/doctor-pack-section";
import { DoctorPackFooter } from "@/components/praticien/doctor-pack-footer";
import { PrintButton } from "../print-button";

export const dynamic = "force-dynamic";

type ReportRow = {
  id: number;
  kind: string;
  title: string;
  body: string;
  created_at: number;
};

type ProfileRow = { data: string };

async function loadReport(id: number): Promise<ReportRow | undefined> {
  ensureSchema();
  return db()
    .$client.prepare(`SELECT id, kind, title, body, created_at FROM report WHERE id = ?`)
    .get(id) as ReportRow | undefined;
}

function loadPatientLabel(): string {
  try {
    const row = db()
      .$client.prepare(`SELECT data FROM profile ORDER BY updated_at DESC LIMIT 1`)
      .get() as ProfileRow | undefined;
    if (!row?.data) return "Patient";
    const obj = JSON.parse(row.data) as { firstName?: string; lastName?: string };
    const first = (obj.firstName || "").trim();
    const last = (obj.lastName || "").trim();
    if (first) return first;
    if (last) return last[0] + ".";
    return "Patient";
  } catch {
    return "Patient";
  }
}

/**
 * Split a markdown body into sections keyed by their H2 heading.
 * Anything that appears before the first H2 is stored under the special key "__intro__".
 */
function splitByH2(md: string): { intro: string; sections: Array<{ heading: string; body: string }> } {
  const lines = md.split(/\r?\n/);
  const sections: Array<{ heading: string; body: string }> = [];
  let intro: string[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  // Match "## Heading", "**1. Heading**" patterns, but primarily H2.
  // Also tolerate "## 1. Heading" or "# Heading" if H2 is sparse.
  const h2 = /^##\s+(.+)$/;
  const numbered = /^\*\*(\d+\.\s+.+?)\*\*\s*$/;
  for (const ln of lines) {
    let hMatch = ln.match(h2);
    if (!hMatch) {
      const n = ln.match(numbered);
      if (n) hMatch = [ln, n[1]] as RegExpMatchArray;
    }
    if (hMatch) {
      if (current) sections.push({ heading: current.heading, body: current.lines.join("\n").trim() });
      current = { heading: hMatch[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(ln);
    } else {
      intro.push(ln);
    }
  }
  if (current) sections.push({ heading: current.heading, body: current.lines.join("\n").trim() });
  return { intro: intro.join("\n").trim(), sections };
}

type Bucket = "medecin" | "naturopathe" | "suivi";

const ROUTING: Array<{ bucket: Bucket; patterns: RegExp[] }> = [
  {
    bucket: "medecin",
    patterns: [
      /synth[èe]se/i,
      /hors\s*range/i,
      /hors\s*plage/i,
      /marqueurs?\s+anormaux/i,
      /questions?\s+(à|a)\s+poser/i,
      /examens?\s+compl[ée]mentaires/i,
      /\b(é|e)tat\s+g[ée]n[ée]ral/i,
      /alerte/i,
    ],
  },
  {
    bucket: "naturopathe",
    patterns: [
      /profil\s+adn/i,
      /\badn\b/i,
      /g[ée]n[ée]tique/i,
      /stack\s+suppl[ée]mentaire/i,
      /suppl[ée]ments?/i,
      /style\s+de\s+vie/i,
      /lifestyle/i,
      /nutrition/i,
      /alimentation/i,
      /micronutriment/i,
      /optimale/i,
    ],
  },
  {
    bucket: "suivi",
    patterns: [
      /tendances?/i,
      /[ée]volution/i,
      /suivi/i,
      /sympt[ôo]mes?/i,
      /adh[ée]rence/i,
      /\b60\s*jours\b/i,
      /\b30\s*jours\b/i,
      /timeline/i,
    ],
  },
];

function bucketFor(heading: string): Bucket {
  for (const r of ROUTING) {
    for (const p of r.patterns) {
      if (p.test(heading)) return r.bucket;
    }
  }
  // Default: route unknown into "medecin" so nothing is lost from the exec summary.
  return "medecin";
}

function buildBucket(
  sections: Array<{ heading: string; body: string }>,
  bucket: Bucket,
): string {
  const parts: string[] = [];
  for (const s of sections) {
    if (bucketFor(s.heading) !== bucket) continue;
    parts.push(`## ${s.heading}`);
    if (s.body) parts.push(s.body);
  }
  return parts.join("\n\n").trim();
}

export default async function PraticienDoctorPackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/login");

  const { id } = await params;
  const { print } = await searchParams;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return (
      <div className="text-muted-foreground">Identifiant de rapport invalide.</div>
    );
  }

  const report = await loadReport(numericId);
  if (!report) {
    return (
      <div className="max-w-2xl">
        <Link
          href="/reports"
          className="no-print inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Tous les rapports
        </Link>
        <p className="mt-6 text-muted-foreground">Rapport introuvable.</p>
      </div>
    );
  }

  const generating = !report.body || report.body.length < 30;
  const printMode = print === "1";
  const patientLabel = loadPatientLabel();

  const { sections } = generating
    ? { sections: [] as Array<{ heading: string; body: string }> }
    : splitByH2(report.body);

  const medecinMd = buildBucket(sections, "medecin");
  const naturopatheMd = buildBucket(sections, "naturopathe");
  const suiviMd = buildBucket(sections, "suivi");

  return (
    <article className="doctor-pack max-w-[210mm] mx-auto">
      {printMode && !generating && <PrintTrigger />}

      {/* Top actions — hidden on print */}
      <div className="no-print flex items-center justify-between gap-3 mb-8">
        <Link
          href={`/reports/${report.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Retour au rapport
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/praticien/${report.id}?print=1`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-border bg-card hover:bg-secondary/40 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Imprimer / PDF
          </Link>
          <PrintButton />
        </div>
      </div>

      {generating ? (
        <div className="max-w-2xl mx-auto py-16">
          <ReportBodyPoller id={report.id} initialBody={report.body} />
        </div>
      ) : (
        <>
          <DoctorPackCover
            patientLabel={patientLabel}
            generatedAt={report.created_at}
            reportTitle={report.title}
          />
          <DoctorPackToc />
          <DoctorPackSection
            id="section-medecin"
            number="01"
            eyebrow="Section 01"
            title="Pour mon médecin généraliste"
            intro="Synthèse exécutive — tout ce qu'un médecin pressé doit voir en 2 minutes : marqueurs hors range, questions clés, examens à envisager."
            markdown={medecinMd}
            emptyHint="Cette section sera remplie automatiquement à partir de tes derniers bilans."
            pageBreakBefore
          />
          <DoctorPackSection
            id="section-naturopathe"
            number="02"
            eyebrow="Section 02"
            title="Pour mon naturopathe / médecine fonctionnelle"
            intro="Lecture détaillée : profil ADN, ranges optimales, stack supplémentaire actuel et leviers de style de vie."
            markdown={naturopatheMd}
            emptyHint="Ajoute ton ADN et tes suppléments dans Vitals pour enrichir cette section."
            pageBreakBefore
          />
          <DoctorPackSection
            id="section-suivi"
            number="03"
            eyebrow="Section 03"
            title="Suivi mensuel"
            intro="Tendances sur 60 jours, adhérence aux suppléments et symptômes signalés — à relire avant chaque rendez-vous."
            markdown={suiviMd}
            emptyHint="Continue à logger tes symptômes et tes prises pour construire ton suivi."
            pageBreakBefore
          />
          <DoctorPackFooter />
        </>
      )}
    </article>
  );
}
