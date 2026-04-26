"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function ReportBodyPoller({ id, initialBody }: { id: number; initialBody: string }) {
  const [body, setBody] = useState(initialBody);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (body && body.length > 30) return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/reports/${id}/status`);
      const d = await r.json();
      if (d.body && d.body.length > 30) {
        setBody(d.body);
        setTimeout(() => window.location.reload(), 600);
      } else {
        setTick((x) => x + 1);
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [body, tick, id]);

  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        className="inline-block"
      >
        <div className="h-6 w-6 rounded-full border-2 border-border border-t-emerald" />
      </motion.div>
      <p className="text-sm text-muted-foreground mt-4">Claude rédige ton rapport personnalisé…</p>
      <p className="text-xs text-muted-foreground/60 mt-1">Ça peut prendre 30-60 secondes.</p>
    </div>
  );
}
