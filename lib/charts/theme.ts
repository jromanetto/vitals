// Centralized theme tokens for all recharts/SVG charts in the app.
// Keep colors aligned with Tailwind config (emerald / sky / amber / red).

export const CHART_COLORS = {
  primary: "hsl(160 84% 39%)",     // emerald
  secondary: "hsl(199 89% 48%)",   // sky
  warning: "hsl(38 92% 50%)",      // amber
  danger: "hsl(0 84% 60%)",        // red
  muted: "hsl(0 0% 45%)",
  grid: "hsl(0 0% 20% / 0.4)",
};

export const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  padding: "8px 12px",
};

export const axisStyle = {
  stroke: "hsl(0 0% 45%)",
  fontSize: 10,
  fontFamily: "ui-monospace, monospace",
};

// Helpers used by sparklines: classify direction relative to an optimum band.
export type TrendDirection = "toward" | "away" | "flat";

export function trendColor(direction: TrendDirection): string {
  if (direction === "toward") return CHART_COLORS.primary;
  if (direction === "away") return CHART_COLORS.warning;
  return CHART_COLORS.muted;
}
