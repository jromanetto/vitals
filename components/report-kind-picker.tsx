"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

type Kind = { id: string; label: string; desc: string };

export function ReportKindPicker({ kinds }: { kinds: Kind[] }) {
  const [generating, setGenerating] = useState<string | null>(null);
  const router = useRouter();

  async function go(kind: string) {
    setGenerating(kind);
    const r = await fetch("/api/reports/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
    const d = await r.json();
    if (d.redirect) router.push(d.redirect);
    setGenerating(null);
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {kinds.map((k, i) => (
        <motion.button
          key={k.id} onClick={() => go(k.id)} disabled={!!generating}
          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.03 }}
          className="text-left rounded-xl border border-border bg-card hover:border-emerald/40 p-4 transition disabled:opacity-50"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{k.label}</span>
            {generating === k.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald" />}
          </div>
          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{k.desc}</div>
        </motion.button>
      ))}
    </div>
  );
}
