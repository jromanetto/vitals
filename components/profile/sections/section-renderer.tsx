"use client";
import { SECTIONS, FieldRow, type Section } from "@/components/profile-form";
import { FamilyDiseaseGrid } from "@/components/profile/family-disease-grid";
import { SymptomChecklist } from "@/components/profile/symptom-checklist";
import { ScreeningSchedule } from "@/components/profile/screening-schedule";
import type { FamilyHistory, ScreeningHistory } from "@/lib/medical/types";

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
  const sex = data.sex === "Femme" ? "female" : data.sex === "Homme" ? "male" : undefined;
  return (
    <div className="space-y-6">
      {sections.map((section) => {
        if (section.customRenderer === "family") {
          return (
            <section key={section.id} id={section.id} className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-medium tracking-tight">{section.title}</h2>
              {section.description && (
                <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
              )}
              <div className="mt-5">
                <FamilyDiseaseGrid
                  value={data.familyHistory as FamilyHistory | undefined}
                  onChange={(v) => onChange("familyHistory", v)}
                />
              </div>
            </section>
          );
        }
        if (section.customRenderer === "symptoms") {
          return (
            <section key={section.id} id={section.id} className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-medium tracking-tight">{section.title}</h2>
              {section.description && (
                <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
              )}
              <div className="mt-5">
                <SymptomChecklist
                  value={data.activeSymptoms as string[] | undefined}
                  onChange={(v) => onChange("activeSymptoms", v)}
                />
              </div>
            </section>
          );
        }
        if (section.customRenderer === "screening") {
          return (
            <section key={section.id} id={section.id} className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-medium tracking-tight">{section.title}</h2>
              {section.description && (
                <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
              )}
              <div className="mt-5">
                <ScreeningSchedule
                  value={data.screeningHistory as ScreeningHistory | undefined}
                  onChange={(v) => onChange("screeningHistory", v)}
                  birthDate={data.birthDate as string | undefined}
                  sex={sex}
                />
              </div>
            </section>
          );
        }
        return (
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
        );
      })}
    </div>
  );
}
