type Props = {
  patientLabel: string;
  generatedAt: number | string | Date;
  reportTitle?: string;
};

function fmtDateLong(d: number | string | Date): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

export function DoctorPackCover({ patientLabel, generatedAt, reportTitle }: Props) {
  return (
    <section className="dp-cover dp-avoid-break" aria-label="Page de couverture">
      <div className="flex items-center gap-3 pt-2">
        <div className="h-3 w-3 rounded-full bg-emerald shadow-[0_0_8px_rgb(16_185_129_/_0.4)]" />
        <span className="text-lg font-semibold tracking-tight text-foreground">Vitals</span>
      </div>

      <div className="mt-[90mm] mb-12">
        <div className="dp-rule mb-6" />
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-medium mb-3">
          Dossier médical résumé
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground leading-tight">
          {patientLabel}
        </h1>
        {reportTitle ? (
          <p className="mt-4 text-sm text-muted-foreground italic">{reportTitle}</p>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-12 gap-y-4 mt-16 max-w-md text-sm">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium">Préparé le</dt>
          <dd className="mt-1 font-medium text-foreground">{fmtDateLong(generatedAt)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium">Préparé par</dt>
          <dd className="mt-1 font-medium text-foreground">Vitals — IA santé</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium">Pour</dt>
          <dd className="mt-1 font-medium text-foreground">Mon médecin / praticien</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium">Format</dt>
          <dd className="mt-1 font-medium text-foreground">A4 — 3 sections</dd>
        </div>
      </dl>

      <p className="mt-20 text-[10.5pt] leading-relaxed text-muted-foreground max-w-md italic">
        Ce document synthétise mes données de santé (bilans, ADN, suppléments, symptômes)
        pour préparer notre rendez-vous. Il a été généré automatiquement à partir de mes
        données personnelles dans Vitals. Il ne constitue pas un diagnostic médical.
      </p>
    </section>
  );
}
