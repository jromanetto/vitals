"use client";
import { WEARABLE_LABELS_FR, type WearableId } from "@/lib/medical/types";

const ORDER: WearableId[] = [
  "whoop",
  "oura",
  "appleWatch",
  "garmin",
  "fitbit",
  "polar",
  "withings",
  "cgm",
  "bpMonitor",
  "smartScale",
];

export function WearablesChips({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: WearableId[] | undefined;
  onChange: (v: WearableId[]) => void;
}) {
  const selected = value ?? [];
  function toggle(id: WearableId) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  return (
    <div className="md:col-span-2 space-y-1.5">
      {label && <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>}
      <div className="flex flex-wrap gap-2">
        {ORDER.map((id) => {
          const active = selected.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={`px-2.5 py-1 rounded-full text-xs border transition ${
                active
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {WEARABLE_LABELS_FR[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
