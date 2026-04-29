"use client";
import { SECTIONS, FieldRow, type Section } from "@/components/profile-form";

export function SectionRenderer({
  ids,
  data,
  onChange,
}: {
  ids: string[];
  data: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
}) {
  const sections = (SECTIONS as Section[]).filter((s) => ids.includes(s.id));
  function toggleMulti(k: string, opt: string) {
    const cur = (data[k] as string[]) || [];
    onChange(k, cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
  }
  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="rounded-xl border border-border bg-card p-6"
        >
          <h2 className="text-lg font-medium tracking-tight">{section.title}</h2>
          {section.description && (
            <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
          )}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.fields.map((f) => (
              <FieldRow
                key={f.id}
                field={f}
                value={data[f.id]}
                onChange={(v) => onChange(f.id, v)}
                onMulti={(opt) => toggleMulti(f.id, opt)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
