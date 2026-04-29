"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";

export default function ProfileImportPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function extract() {
    setLoading(true); setError(null);
    const r = await fetch("/api/profile/import", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const d = await r.json();
    setLoading(false);
    if (d.error) { setError(d.error); return; }
    setExtracted(d.extracted);
  }

  async function applyToProfile() {
    if (!extracted) return;
    // Merge with existing profile
    const cur = await (await fetch("/api/profile")).json();
    const merged = { ...(cur.data ?? {}), ...extracted };
    await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(merged) });
    router.push("/profile");
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-emerald" /><h1 className="text-2xl font-semibold tracking-tight">Importer un texte</h1></div>
        <p className="text-muted-foreground mt-1 text-sm">Colle une lettre de médecin, un résumé de bilan, ou n'importe quel texte santé. Claude extrait les infos pour remplir ton profil.</p>
      </div>
      <div className="space-y-3">
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={14}
          placeholder="Colle ici la lettre du médecin, ton résumé de checkup, etc."
          className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition font-mono"
        />
        <button onClick={extract} disabled={loading || text.length < 30}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
          {loading ? "Extraction…" : "Extraire les infos"} <ArrowRight className="h-4 w-4" />
        </button>
        {error && <div className="text-sm text-red-400">{error}</div>}
      </div>
      {extracted && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Champs extraits ({Object.keys(extracted).length})</div>
          <pre className="text-xs bg-secondary/30 p-3 rounded-md overflow-x-auto max-h-[400px] scrollbar-thin">{JSON.stringify(extracted, null, 2)}</pre>
          <div className="flex gap-2">
            <button onClick={applyToProfile} className="px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm">Fusionner dans mon profile</button>
            <button onClick={() => setExtracted(null)} className="px-3 py-2 rounded-md bg-secondary border border-border text-sm">Annuler</button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
