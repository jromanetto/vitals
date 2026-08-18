/**
 * Vitals brand mark.
 *
 * Concept (brandkit — monogram + product-action fusion): the "V" of Vitals is
 * drawn as the trough of an ECG / vital-sign pulse, terminated by a single
 * accent dot — the "current reading" point. It fuses V + heartbeat (health) +
 * data point (reading), stays legible at 16px, and is monochrome via
 * currentColor with only the endpoint dot in the emerald accent.
 *
 * Vector on purpose: the repo bans raster icons, and an SVG mark themes with
 * the surrounding text and scales from favicon to hero without an asset
 * pipeline (no sharp, no next/image).
 */
import * as React from "react";

export function VitalsMark({
  className,
  title = "Vitals",
  dotClassName = "text-emerald",
}: {
  className?: string;
  title?: string;
  /** Tailwind text-color class applied to the endpoint dot (the accent). */
  dotClassName?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
    >
      {/* baseline pulse — flat in, sharp V beat, flat out */}
      <path
        d="M2 16 H10 L15 25 L20 7 L25 16 H29"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* current-reading point at the terminal */}
      <circle cx="29" cy="16" r="2.4" className={dotClassName} fill="currentColor" />
    </svg>
  );
}

export function VitalsWordmark({
  className,
  markClassName = "h-5 w-5",
  textClassName = "text-lg font-semibold tracking-tight",
}: {
  className?: string;
  markClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <VitalsMark className={markClassName} />
      <span className={textClassName}>Vitals</span>
    </span>
  );
}
