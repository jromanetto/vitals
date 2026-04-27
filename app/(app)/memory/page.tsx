"use client";
import { useEffect, useState } from "react";
import { Brain, Plus, Trash2, Power } from "lucide-react";

type Memory = {
  id: number;
  kind: string;
  body: string;
  source_session_id: number | null;
  confidence: number;
  created_at: number;
  active: number;
};

const KIND_LABELS: Record<string, string> = {
  fact: "Fait médical",
  preference: "Préférence",
  goal: "Objectif",
  concern: "Inquiétude",
  medical_history: "Antécédent",
};
const KIND_ORDER = ["fact", "medical_history", "goal", "preference", "concern"];

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKind, setNewKind] = useState("fact");
  const [newBody, setNewBody] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");

  async function refresh() {
    setLoading(true);
    const r = await fetch("/api/memory");
    const d = await r.json();
    setMemories(d.memories ?? []);
    setLoading(false);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function addMemory() {
    if (!newBody.trim()) return;
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: newKind, body: newBody.trim(), confidence: 1.0 }),
    });
    setNewBody("");
    refresh();
  }

  async function toggleActive(m: Memory) {
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, active: m.active ? 0 : 1 }),
    });
    refresh();
  }

  async function saveEdit(id: number) {
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, body: editBody }),
    });
    setEditingId(null);
    refresh();
  }

  async function del(id: number) {
    if (!confirm("Supprimer cette mémoire ?")) return;
    await fetch(`/api/memory?id=${id}`, { method: "DELETE" });
    refresh();
  }

  const grouped: Record<string, Memory[]> = {};
  for (const m of memories) (grouped[m.kind] ??= []).push(m);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-emerald" />
        <h1 className="text-2xl font-semibold tracking-tight">Mémoire long-terme</h1>
        <span className="text-xs text-muted-foreground ml-auto">
          {memories.filter((m) => m.active).length} actives / {memories.length} totales
        </span>
      </div>
      <p className="text-sm text-muted-foreground max-w-2xl">
        Les mémoires actives sont injectées dans CHAQUE conversation avec le panel médical. Elles sont
        extraites automatiquement à la fin de chaque session, ou ajoutées manuellement ici.
      </p>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Ajouter une mémoire</h2>
        <div className="flex flex-col md:flex-row gap-2">
          <select
            value={newKind}
            onChange={(e) => setNewKind(e.target.value)}
            className="bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <input
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Ex: Cholécystectomie en 2018"
            className="flex-1 bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
            onKeyDown={(e) => e.key === "Enter" && addMemory()}
          />
          <button
            onClick={addMemory}
            disabled={!newBody.trim()}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Ajouter
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Chargement…</div>}

      {KIND_ORDER.filter((k) => grouped[k]?.length).map((kind) => (
        <section key={kind} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {KIND_LABELS[kind]} ({grouped[kind].length})
          </h2>
          <div className="space-y-1.5">
            {grouped[kind].map((m) => (
              <div
                key={m.id}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-md border border-border bg-card text-sm ${
                  m.active ? "" : "opacity-50"
                }`}
              >
                {editingId === m.id ? (
                  <>
                    <input
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="flex-1 bg-secondary/40 border border-border rounded-md px-2 py-1 text-sm outline-none"
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(m.id)}
                      autoFocus
                    />
                    <button onClick={() => saveEdit(m.id)} className="text-xs text-emerald hover:underline">
                      Sauver
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Annuler
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className="flex-1 cursor-pointer"
                      onClick={() => {
                        setEditingId(m.id);
                        setEditBody(m.body);
                      }}
                    >
                      {m.body}
                    </span>
                    <span className="text-xs text-muted-foreground">conf {m.confidence.toFixed(2)}</span>
                    <button
                      onClick={() => toggleActive(m)}
                      className="opacity-50 group-hover:opacity-100 transition p-1 hover:text-emerald"
                      title={m.active ? "Désactiver" : "Activer"}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => del(m.id)}
                      className="opacity-0 group-hover:opacity-100 transition p-1 hover:text-red-400"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {!loading && memories.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucune mémoire pour l'instant. Le panel médical en extraira automatiquement après quelques échanges,
          ou ajoute-en manuellement ci-dessus.
        </div>
      )}
    </div>
  );
}
