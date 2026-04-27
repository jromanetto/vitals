"use client";

function parseTime(t: string): number | null {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
}

function chronotypeFor(wake: number | null): string | null {
  if (wake == null) return null;
  if (wake < 7) return 'matinal';
  if (wake > 9) return 'vespéral';
  return 'intermédiaire';
}

export function SleepWindow({ bedTime, wakeTime, onChange }: {
  bedTime: string; wakeTime: string;
  onChange: (patch: { bedTime?: string; wakeTime?: string; sleepDurationCalc?: number; chronotype?: string }) => void;
}) {
  const wake = parseTime(wakeTime);
  const bed = parseTime(bedTime);
  let duration: number | null = null;
  if (wake != null && bed != null) {
    let d = wake - bed;
    if (d <= 0) d += 24;
    duration = Math.round(d * 10) / 10;
  }
  const chrono = chronotypeFor(wake);

  function updateBed(v: string) {
    const newBed = parseTime(v);
    let dur: number | undefined = undefined;
    if (wake != null && newBed != null) {
      let d = wake - newBed;
      if (d <= 0) d += 24;
      dur = Math.round(d * 10) / 10;
    }
    onChange({ bedTime: v, sleepDurationCalc: dur, chronotype: chrono ?? undefined });
  }
  function updateWake(v: string) {
    const newWake = parseTime(v);
    let dur: number | undefined = undefined;
    if (newWake != null && bed != null) {
      let d = newWake - bed;
      if (d <= 0) d += 24;
      dur = Math.round(d * 10) / 10;
    }
    const c = chronotypeFor(newWake) ?? undefined;
    onChange({ wakeTime: v, sleepDurationCalc: dur, chronotype: c });
  }

  return (
    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Heure de coucher habituelle</label>
        <input type="time" value={bedTime || ''} onChange={(e) => updateBed(e.target.value)}
          className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Heure de réveil habituelle</label>
        <input type="time" value={wakeTime || ''} onChange={(e) => updateWake(e.target.value)}
          className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition" />
      </div>
      {(duration != null || chrono) && (
        <div className="md:col-span-2 text-xs text-muted-foreground italic">
          {duration != null ? `Tu dors ${duration} h en moyenne` : 'Durée non calculée'}
          {chrono ? ` — chronotype ${chrono}` : ''}
        </div>
      )}
    </div>
  );
}
