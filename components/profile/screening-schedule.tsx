"use client";
import { Check, Clock, AlertTriangle } from "lucide-react";
import {
  SCREENING_CATALOG,
  applicableScreenings,
  statusForScreening,
} from "@/lib/medical/screening-catalog";
import type { ScreeningHistory } from "@/lib/medical/types";

const STATUS_TONE: Record<string, string> = {
  done: "border-emerald/40 bg-emerald/5",
  due: "border-amber-500/40 bg-amber-500/5",
  overdue: "border-red-500/40 bg-red-500/5",
  upcoming: "border-border bg-secondary/20 opacity-60",
  na: "hidden",
};

const STATUS_LABEL: Record<string, string> = {
  done: "À jour",
  due: "Bientôt",
  overdue: "En retard",
  upcoming: "Pas encore l'âge",
  na: "",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  done: <Check className="h-4 w-4 text-emerald" />,
  due: <Clock className="h-4 w-4 text-amber-500" />,
  overdue: <AlertTriangle className="h-4 w-4 text-red-500" />,
  upcoming: <Clock className="h-4 w-4 text-muted-foreground" />,
};

function ageFromBirthDate(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 86_400_000));
}

export function ScreeningSchedule({
  value,
  onChange,
  birthDate,
  sex,
}: {
  value: ScreeningHistory | undefined;
  onChange: (v: ScreeningHistory) => void;
  birthDate?: string;
  sex?: "male" | "female";
}) {
  const history: ScreeningHistory = value ?? {};
  const age = ageFromBirthDate(birthDate);
  const applicable = applicableScreenings(age, sex);

  function setLast(id: string, lastDate: string) {
    onChange({ ...history, [id]: { lastDate: lastDate || undefined } });
  }

  const groups: Array<{ title: string; items: typeof SCREENING_CATALOG }> = [
    { title: "Annuel & général", items: applicable.filter((e) => ["1y", "2y"].includes(e.cadence) && !e.sex) },
    { title: "Femme", items: applicable.filter((e) => e.sex === "female") },
    { title: "Homme", items: applicable.filter((e) => e.sex === "male") },
    { title: "Périodique (5-10 ans)", items: applicable.filter((e) => ["3y", "5y", "10y", "once"].includes(e.cadence) && !e.sex) },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Renseigne la date du dernier examen pour chaque ligne. Les recommandations s&apos;adaptent à
        ton âge et ton sexe.
      </p>
      {groups.map((g) => {
        if (g.items.length === 0) return null;
        return (
          <div key={g.title}>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{g.title}</p>
            <div className="space-y-1.5">
              {g.items.map((e) => {
                const status = statusForScreening(e, history, age, sex);
                if (status === "na") return null;
                const last = history[e.id]?.lastDate ?? "";
                return (
                  <div
                    key={e.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition ${STATUS_TONE[status]}`}
                  >
                    <div className="flex-shrink-0">{STATUS_ICON[status]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{e.label}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Tous les {e.cadence === "once" ? "—" : e.cadence.replace("y", " an(s)")}
                        {" · "}
                        {STATUS_LABEL[status]}
                      </p>
                    </div>
                    <input
                      type="date"
                      value={last}
                      onChange={(ev) => setLast(e.id, ev.target.value)}
                      className="w-36 h-8 bg-secondary/40 border border-border rounded-md px-2 text-xs outline-none focus:border-primary"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
