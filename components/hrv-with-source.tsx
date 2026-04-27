"use client";

const SOURCES = ['', 'Oura Ring', 'Whoop', 'Apple Watch', 'Garmin', 'Polar', 'Autre'];
const METRICS = ['', 'rMSSD (ms)', 'SDNN (ms)', 'Score HRV propriétaire'];

export function HrvWithSource({ hrv, source, metric, onChange }: {
  hrv: number | string; source: string; metric: string;
  onChange: (patch: { hrv?: number | string; hrvSource?: string; hrvMetric?: string }) => void;
}) {
  return (
    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr] gap-3">
      <div className="space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">HRV moyenne</label>
        <div className="relative">
          <input type="number" value={hrv ?? ''}
            onChange={(e) => onChange({ hrv: e.target.value === '' ? '' : Number(e.target.value) })}
            className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">ms</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Source HRV</label>
        <select value={source || ''} onChange={(e) => onChange({ hrvSource: e.target.value })}
          className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition">
          {SOURCES.map((s) => <option key={s} value={s}>{s || '—'}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Métrique</label>
        <select value={metric || ''} onChange={(e) => onChange({ hrvMetric: e.target.value })}
          className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition">
          {METRICS.map((m) => <option key={m} value={m}>{m || '—'}</option>)}
        </select>
      </div>
    </div>
  );
}
