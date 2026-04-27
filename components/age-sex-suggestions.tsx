"use client";
import { Stethoscope } from "lucide-react";

function ageFromBirthDate(iso: string | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function isMale(sex: string | undefined): boolean {
  return (sex || "").toLowerCase().startsWith("homme");
}
function isFemale(sex: string | undefined): boolean {
  return (sex || "").toLowerCase().startsWith("femme");
}
function isSmoker(s: string | undefined): boolean {
  if (!s) return false;
  const v = s.toLowerCase();
  return v === "occasionnel" || v === "régulier" || v === "regulier";
}
function familyHasAlzheimer(arr: unknown): boolean {
  return Array.isArray(arr) && arr.some((x) => typeof x === "string" && x.toLowerCase().includes("alzheimer"));
}
function familyHasBreastOvarianCancer(arr: unknown, freeTexts: string[]): boolean {
  if (Array.isArray(arr) && arr.some((x) => typeof x === "string" && x.toLowerCase() === "cancer")) {
    // generic cancer flag — also check free text fields for "sein" / "ovaire"
    const blob = freeTexts.join(" ").toLowerCase();
    if (blob.includes("sein") || blob.includes("ovaire") || blob.includes("brca")) return true;
  }
  const blob = freeTexts.join(" ").toLowerCase();
  return blob.includes("cancer du sein") || blob.includes("cancer de l'ovaire") || blob.includes("brca");
}

export function AgeSexSuggestions({ data }: { data: Record<string, unknown> }) {
  const birthDate = data.birthDate as string | undefined;
  const sex = data.sex as string | undefined;
  if (!birthDate || !sex) return null;
  const age = ageFromBirthDate(birthDate);
  if (age === null) return null;

  const male = isMale(sex);
  const female = isFemale(sex);
  const smoker = isSmoker(data.smoker as string | undefined);
  const familyDiseases = data.familyDiseases;
  const familyTexts = [
    (data.fatherHealth as string) || "",
    (data.motherHealth as string) || "",
    (data.grandparentsHealth as string) || "",
    (data.siblingsHealth as string) || "",
  ];
  const alz = familyHasAlzheimer(familyDiseases);
  const brca = familyHasBreastOvarianCancer(familyDiseases, familyTexts);

  const items: string[] = [];

  if (age < 30) {
    items.push("Bilan biologique de base + Lp(a) une fois pour la vie entière.");
  }
  if (male && age > 40) {
    items.push("Bilan prostate (PSA), bilan cardio approfondi (Lp(a) une fois, ApoB).");
  }
  if (female && age > 35) {
    items.push("Mammographie, frottis cervico-utérin, bilan thyroïdien.");
  }
  if (age > 50) {
    items.push("Coloscopie de dépistage, ostéodensitométrie.");
  }
  if (age > 60) {
    items.push("Bilan cognitif annuel, bilan auditif et ophtalmologique.");
  }
  if (smoker) {
    items.push(
      age > 55
        ? "Spirométrie + scanner thoracique low-dose annuel (dépistage cancer du poumon)."
        : "Spirométrie de référence."
    );
  }
  if (alz) {
    items.push("Bilan cognitif baseline (antécédent familial d'Alzheimer).");
  }
  if (brca) {
    items.push("Test génétique BRCA + suivi gynécologique rapproché (antécédent familial).");
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-emerald/30 bg-emerald/5 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="h-4 w-4 text-emerald" />
        <h3 className="text-sm font-medium tracking-tight text-emerald">
          Suggestions de check-up — {age} ans
        </h3>
      </div>
      <ul className="space-y-1.5 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-emerald mt-0.5">•</span>
            <span className="text-foreground/90">{it}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted-foreground italic">
        Recommandations indicatives basées sur les recos HAS / INCa / ESC. Discute avec ton médecin pour
        une stratégie personnalisée.
      </p>
    </div>
  );
}
