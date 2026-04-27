/**
 * Spearman rank correlation between two paired series.
 * Used to find correlations between:
 *   - symptom_log values × biomarker values (matched by date proximity ±3d)
 *   - symptom × supplement adherence
 *   - habit × symptom
 */

export function rank(values: number[]): number[] {
  const sorted = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length).fill(0);
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].v === sorted[i].v) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[sorted[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

export function spearman(x: number[], y: number[]): number | null {
  if (x.length !== y.length || x.length < 5) return null;
  const rx = rank(x), ry = rank(y);
  const n = x.length;
  const meanX = rx.reduce((a, b) => a + b, 0) / n;
  const meanY = ry.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - meanX;
    const dy = ry[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? null : num / den;
}

/** p-value approximation via t-test (rough, n>=10 reasonable) */
export function spearmanP(rho: number, n: number): number {
  if (n < 5 || Math.abs(rho) >= 1) return 0;
  const t = rho * Math.sqrt((n - 2) / (1 - rho * rho));
  // Two-tailed p approximation using Student's t with df=n-2 via normal approximation for n>30
  const df = n - 2;
  // Crude Welch–Satterthwaite normal approximation
  const z = t * (1 - 1 / (4 * df)) / Math.sqrt(1 + (t * t) / (2 * df));
  return 2 * (1 - normalCdf(Math.abs(z)));
}

function normalCdf(x: number): number {
  // Abramowitz & Stegun 7.1.26 approximation
  const t = 1 / (1 + 0.2316419 * x);
  const d = 0.3989423 * Math.exp(-x * x / 2);
  return 1 - d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
}

export type DatedValue = { date: string; value: number };

/**
 * Pair two daily series by date with a ±tolerance window.
 * Each x value is paired with the closest y value within tolerance.
 */
export function pairDated(xs: DatedValue[], ys: DatedValue[], toleranceDays = 3): { x: number[]; y: number[] } {
  const pairsX: number[] = [], pairsY: number[] = [];
  const yMap = new Map<string, number>();
  for (const y of ys) yMap.set(y.date, y.value);

  for (const x of xs) {
    if (yMap.has(x.date)) {
      pairsX.push(x.value); pairsY.push(yMap.get(x.date)!);
      continue;
    }
    // Search nearest within ±tolerance
    let best: { delta: number; v: number } | null = null;
    const xDate = new Date(x.date).getTime();
    for (let d = 1; d <= toleranceDays; d++) {
      for (const sign of [-1, 1]) {
        const probe = new Date(xDate + sign * d * 86400000).toISOString().slice(0, 10);
        if (yMap.has(probe)) { best = { delta: d, v: yMap.get(probe)! }; break; }
      }
      if (best) break;
    }
    if (best) { pairsX.push(x.value); pairsY.push(best.v); }
  }
  return { x: pairsX, y: pairsY };
}
