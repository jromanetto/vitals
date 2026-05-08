"use client";
import { FREQUENCY_LABELS_FR, type FrequencyBucket } from "@/lib/medical/types";

const ORDER: FrequencyBucket[] = ["never", "rare", "sometimes", "often", "daily"];

export function FrequencyChips({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: FrequencyBucket | undefined;
  onChange: (v: FrequencyBucket) => void;
}) {
  return (
    <div className="md:col-span-2 space-y-1.5">
      {label && <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>}
      <div className="flex flex-wrap gap-2">
        {ORDER.map((k) => {
          const active = value === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange(k)}
              className={`px-2.5 py-1 rounded-full text-xs border transition ${
                active
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {FREQUENCY_LABELS_FR[k]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
