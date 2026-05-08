"use client";

export function ScaleButtons({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  minLabel,
  maxLabel,
}: {
  label?: string;
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  minLabel?: string;
  maxLabel?: string;
}) {
  const buttons: number[] = [];
  for (let i = min; i <= max; i++) buttons.push(i);
  return (
    <div className="md:col-span-2 space-y-1.5">
      {label && <label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</label>}
      <div className="flex flex-wrap gap-1">
        {buttons.map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`min-w-[2.25rem] h-8 px-2 rounded-md text-xs border transition ${
                active
                  ? "bg-primary/15 border-primary/40 text-primary font-medium"
                  : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{minLabel ?? min}</span>
          <span>{maxLabel ?? max}</span>
        </div>
      )}
    </div>
  );
}
