import { renderMarkdown } from "@/lib/markdown";

type Props = {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  intro?: string;
  /** Raw markdown content (already extracted from the doctor-pack body). */
  markdown: string;
  /** Optional empty-state copy when no content is available. */
  emptyHint?: string;
  /** If true, inserts a CSS page-break-before before this section. */
  pageBreakBefore?: boolean;
};

export function DoctorPackSection({
  id,
  number,
  eyebrow,
  title,
  intro,
  markdown,
  emptyHint,
  pageBreakBefore = true,
}: Props) {
  const hasContent = markdown.trim().length > 0;
  return (
    <section
      id={id}
      aria-label={title}
      className={pageBreakBefore ? "dp-section-break pt-2" : "pt-2"}
    >
      <header className="mb-6 dp-avoid-break">
        <div className="flex items-baseline gap-4">
          <span className="text-3xl font-semibold tracking-tight text-emerald tabular-nums">
            {number}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80 font-medium">
              {eyebrow}
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mt-1">
              {title}
            </h2>
          </div>
        </div>
        <div className="dp-rule mt-4" />
        {intro ? (
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed italic max-w-2xl">
            {intro}
          </p>
        ) : null}
      </header>

      {hasContent ? (
        <div
          className="dp-md text-[10.5pt] leading-relaxed text-foreground"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
        />
      ) : (
        <div className="dp-card text-sm text-muted-foreground italic">
          {emptyHint ??
            "Pas encore de contenu pour cette section. Reviens après ton prochain bilan ou ajoute des données dans Vitals."}
        </div>
      )}
    </section>
  );
}
