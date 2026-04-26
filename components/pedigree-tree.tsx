"use client";
import { motion } from "framer-motion";
import type { Pedigree, Person } from "./pedigree-editor";

const RISK_KEYWORDS = ["cancer", "diabète", "diabete", "infarctus", "AVC", "alzheimer", "parkinson", "hypertension", "cholestérol", "thrombose"];

function riskLevel(p: Person | undefined): "high" | "moderate" | "low" {
  if (!p) return "low";
  const t = (p.conditions + " " + (p.causeOfDeath ?? "")).toLowerCase();
  let count = 0;
  for (const kw of RISK_KEYWORDS) if (t.includes(kw.toLowerCase())) count++;
  if (count >= 2 || /cancer|infarctus|avc/i.test(t)) return "high";
  if (count >= 1) return "moderate";
  return "low";
}

const COLORS = {
  high: { bg: "fill-red-500/20", border: "stroke-red-500/60" },
  moderate: { bg: "fill-amber-500/20", border: "stroke-amber-500/60" },
  low: { bg: "fill-emerald/15", border: "stroke-emerald/40" },
};

export function PedigreeTree({ data }: { data: Pedigree }) {
  // Layout: 4 grandparents top row, 2 parents middle, ego bottom-left, siblings bottom row, children below
  const W = 880, H = 560;
  const node = (x: number, y: number, p: Person | undefined, label: string, isEgo = false) => {
    const filled = p?.name || (p?.conditions ?? "");
    const r = riskLevel(p);
    const c = COLORS[r];
    return (
      <g key={`${label}-${x}-${y}`}>
        <motion.rect
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          x={x - 70} y={y - 30} rx={8} ry={8} width={140} height={60}
          className={`${filled ? c.bg : "fill-secondary/20"} ${filled ? c.border : "stroke-border"} stroke-2`}
        />
        <text x={x} y={y - 12} textAnchor="middle" className="fill-foreground text-[11px] font-medium">{p?.name || label}</text>
        <text x={x} y={y + 4} textAnchor="middle" className="fill-muted-foreground text-[9px]">
          {p?.alive === "deceased" ? `† ${p?.ageOrDeath ?? ""}` : p?.ageOrDeath ?? ""}
        </text>
        <text x={x} y={y + 18} textAnchor="middle" className="fill-muted-foreground text-[8px]">
          {(p?.conditions ?? "").slice(0, 30)}{(p?.conditions ?? "").length > 30 ? "…" : ""}
        </text>
        {isEgo && <circle cx={x + 60} cy={y - 22} r={6} className="fill-primary" />}
      </g>
    );
  };

  const link = (x1: number, y1: number, x2: number, y2: number) => (
    <line key={`l-${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-border stroke-1" />
  );

  // Coords
  const yGP = 60, yP = 220, yEgo = 380, yKids = 500;
  const xPGF = 110, xPGM = 250, xMGF = 630, xMGM = 770;
  const xFather = 180, xMother = 700;

  const siblingsX = data.siblings.length > 0 ? Array.from({ length: data.siblings.length }, (_, i) => 250 + i * 160) : [];
  const childrenX = data.children.length > 0 ? Array.from({ length: data.children.length }, (_, i) => 200 + i * 160) : [];

  return (
    <div className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* Lines */}
        {link(xPGF, yGP + 30, xFather, yP - 30)}
        {link(xPGM, yGP + 30, xFather, yP - 30)}
        {link(xMGF, yGP + 30, xMother, yP - 30)}
        {link(xMGM, yGP + 30, xMother, yP - 30)}
        {link(xFather, yP + 30, 440, yEgo - 30)}
        {link(xMother, yP + 30, 440, yEgo - 30)}
        {siblingsX.map((sx, i) => link(440, (yEgo + 30 + yEgo - 30) / 2, sx, yEgo - 30))}
        {/* horizontal sibling bus */}
        {siblingsX.length > 0 && link(150, yEgo, Math.max(...siblingsX, 150), yEgo)}
        {childrenX.map((cx) => link(440, yEgo + 30, cx, yKids - 30))}

        {/* Nodes */}
        {node(xPGF, yGP, data.paternalGrandfather, "Grand-père paternel")}
        {node(xPGM, yGP, data.paternalGrandmother, "Grand-mère paternelle")}
        {node(xMGF, yGP, data.maternalGrandfather, "Grand-père maternel")}
        {node(xMGM, yGP, data.maternalGrandmother, "Grand-mère maternelle")}
        {node(xFather, yP, data.father, "Père")}
        {node(xMother, yP, data.mother, "Mère")}
        {node(440, yEgo, { name: "Moi", alive: "alive", ageOrDeath: "", conditions: "" }, "Moi", true)}
        {data.siblings.map((s, i) => node(siblingsX[i], yEgo, s, `Frère/Sœur ${i + 1}`))}
        {data.children.map((c, i) => node(childrenX[i], yKids, c, `Enfant ${i + 1}`))}
      </svg>
      <div className="flex flex-wrap gap-3 mt-3 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald/15 border border-emerald/40 inline-block" /> Pas de pathologie</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/60 inline-block" /> 1 pathologie</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/60 inline-block" /> Cancer / cardio / 2+ patho</span>
        <span className="ml-auto text-muted-foreground">Color-coded par mots-clés (cancer, diabète, infarctus, AVC, Alzheimer, etc.)</span>
      </div>
    </div>
  );
}
