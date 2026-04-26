"use client";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
        <div className="text-xs uppercase tracking-widest text-amber-400 mb-2">Erreur</div>
        <h1 className="text-xl font-semibold tracking-tight mb-3">Quelque chose s'est mal passé</h1>
        <p className="text-sm text-muted-foreground mb-6">{error.message || "Erreur inconnue"}</p>
        <button onClick={reset} className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90">Réessayer</button>
      </div>
    </div>
  );
}
