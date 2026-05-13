type TocEntry = {
  id: string;
  number: string;
  title: string;
  subtitle?: string;
};

const ENTRIES: TocEntry[] = [
  {
    id: "section-medecin",
    number: "01",
    title: "Pour mon médecin généraliste",
    subtitle: "Synthèse exécutive — 1 page",
  },
  {
    id: "section-naturopathe",
    number: "02",
    title: "Pour mon naturopathe / médecine fonctionnelle",
    subtitle: "Biomarqueurs détaillés · ADN · suppléments · style de vie",
  },
  {
    id: "section-suivi",
    number: "03",
    title: "Suivi mensuel",
    subtitle: "Tendances sur 60 jours · adhérence · symptômes",
  },
];

export function DoctorPackToc() {
  return (
    <section className="dp-toc dp-avoid-break" aria-label="Sommaire">
      <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 font-medium mb-4">
        Sommaire
      </div>
      <h2 className="text-3xl font-semibold tracking-tight text-foreground mb-2">
        Ce que tu trouveras ici
      </h2>
      <div className="dp-rule mt-4 mb-10" />

      <ol className="space-y-6">
        {ENTRIES.map((e) => (
          <li key={e.id} className="flex items-baseline gap-6 border-b border-border pb-5 last:border-b-0">
            <span className="text-2xl font-semibold tracking-tight text-emerald tabular-nums shrink-0 w-12">
              {e.number}
            </span>
            <div className="flex-1 min-w-0">
              <a
                href={`#${e.id}`}
                className="text-lg font-semibold tracking-tight text-foreground hover:text-emerald transition-colors"
              >
                {e.title}
              </a>
              {e.subtitle ? (
                <p className="mt-1 text-sm text-muted-foreground italic leading-relaxed">
                  {e.subtitle}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-16 dp-card text-sm leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Comment lire ce document.</strong> Donne la
        section 01 à ton médecin généraliste pressé : tout y est en 1 page. Réserve la
        section 02 à un praticien qui creuse (naturopathe, médecine fonctionnelle). La
        section 03 sert au suivi entre deux rendez-vous.
      </div>
    </section>
  );
}
