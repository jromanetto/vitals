"use client";
import { Info, Activity } from "lucide-react";

type Props = {
  data: Record<string, unknown>;
};

function bmiCategory(bmi: number): { label: string; tone: string } {
  if (bmi < 18.5) return { label: "Maigreur", tone: "text-amber-400" };
  if (bmi < 25) return { label: "Poids normal", tone: "text-emerald" };
  if (bmi < 30) return { label: "Surpoids", tone: "text-amber-400" };
  if (bmi < 35) return { label: "Obésité grade I", tone: "text-orange-400" };
  if (bmi < 40) return { label: "Obésité grade II", tone: "text-red-400" };
  return { label: "Obésité grade III", tone: "text-red-500" };
}

/**
 * Boer LBM formula — Lean Body Mass (kg).
 * Men:   0.407·W + 0.267·H − 19.2
 * Women: 0.252·W + 0.473·H − 48.3
 * Returns null if the inputs are missing or sex is undeclared.
 */
function lbmBoer(weight: number, heightCm: number, sex: string | undefined): number | null {
  if (!Number.isFinite(weight) || !Number.isFinite(heightCm) || weight <= 0 || heightCm <= 0) return null;
  if (sex === "Homme") return 0.407 * weight + 0.267 * heightCm - 19.2;
  if (sex === "Femme") return 0.252 * weight + 0.473 * heightCm - 48.3;
  return null; // Intersex / unset — formula isn't validated without a binary sex baseline.
}

export function AnthroComputed({ data }: Props) {
  const heightCm = typeof data.height === "number" ? data.height : Number(data.height) || 0;
  const weight = typeof data.weight === "number" ? data.weight : Number(data.weight) || 0;
  const sex = typeof data.sex === "string" ? data.sex : undefined;
  const bodyFatPct = typeof data.bodyFat === "number" ? data.bodyFat : Number(data.bodyFat) || 0;

  const heightM = heightCm / 100;
  const bmi = heightM > 0 && weight > 0 ? weight / (heightM * heightM) : null;
  const lbm = lbmBoer(weight, heightCm, sex);
  // True body fat in kg if user filled %MG, plus implied lean mass from BF%.
  const fatKg = weight > 0 && bodyFatPct > 0 ? weight * (bodyFatPct / 100) : null;
  const leanFromBf = weight > 0 && bodyFatPct > 0 ? weight - (fatKg ?? 0) : null;

  if (!bmi && !lbm) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-xs text-muted-foreground flex items-start gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>Renseigne taille + poids pour le calcul automatique de l&apos;IMC et de la masse maigre estimée.</span>
      </div>
    );
  }

  const cat = bmi !== null ? bmiCategory(bmi) : null;

  return (
    <div className="rounded-lg border border-emerald/30 bg-emerald/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-emerald font-medium">
        <Activity className="h-3.5 w-3.5" /> Calculé automatiquement
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {bmi !== null && cat && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">IMC</div>
            <div className="font-medium text-lg tabular-nums">
              {bmi.toFixed(1)} <span className={`text-xs ${cat.tone}`}>{cat.label}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Poids (kg) / Taille² (m)</div>
          </div>
        )}
        {lbm !== null && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
              Masse maigre estimée
            </div>
            <div className="font-medium text-lg tabular-nums">
              {lbm.toFixed(1)} <span className="text-xs text-muted-foreground">kg</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Formule Boer (taille + poids + sexe) · ±5 kg
            </div>
          </div>
        )}
        {fatKg !== null && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
              Masse grasse
            </div>
            <div className="font-medium text-lg tabular-nums">
              {fatKg.toFixed(1)} <span className="text-xs text-muted-foreground">kg</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Depuis ton % MG saisi</div>
          </div>
        )}
        {leanFromBf !== null && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
              Masse maigre réelle
            </div>
            <div className="font-medium text-lg tabular-nums">
              {leanFromBf.toFixed(1)} <span className="text-xs text-muted-foreground">kg</span>
            </div>
            <div className="text-[10px] text-muted-foreground">Poids − masse grasse</div>
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-emerald/20 pt-2">
        Le <strong>% masse grasse</strong> ne se calcule pas depuis taille + poids seuls — il faut
        une balance à impédancemétrie, un DEXA-scan, ou la formule Navy (tour de taille + tour de cou + âge + sexe).
        Si tu ne le connais pas, laisse vide.
      </p>
    </div>
  );
}
