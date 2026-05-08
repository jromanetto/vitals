"use client";
import type { YesNoUnknown } from "@/lib/medical/types";

const OPTIONS: { v: YesNoUnknown; label: string }[] = [
  { v: "yes", label: "Oui" },
  { v: "no", label: "Non" },
  { v: "unknown", label: "Je ne sais pas" },
];

export function YesNoUnknownChips({
  label,
  value,
  onChange,
  inline,
}: {
  label?: string;
  value: YesNoUnknown | undefined;
  onChange: (v: YesNoUnknown) => void;
  inline?: boolean;
}) {
  return (
    <div className={inline ? "" : "md:col-span-2 space-y-1.5"}>
      {label && !inline && <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>}
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(o.v)}
              className={`px-2.5 py-1 rounded-full text-xs border transition ${
                active
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
