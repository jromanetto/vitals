"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Save, X, Tag, Lock, Unlock } from "lucide-react";

type Note = {
  id: number; targetType: string; targetId: string;
  body: string; tags: string | null;
  createdAt: number; updatedAt: number;
  encrypted?: boolean;
};

export function NotesWidget({ targetType, targetId, label = "Notes" }: { targetType: string; targetId: string; label?: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editing, setEditing] = useState<{ id?: number; body: string; tags: string; private: boolean } | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  async function load(unlock = unlocked) {
    const qs = new URLSearchParams({ targetType, targetId });
    if (unlock) qs.set("unlock", "1");
    const r = await fetch(`/api/notes?${qs.toString()}`);
    const d = await r.json();
    setNotes(d.rows ?? []);
  }
  useEffect(() => { load(); }, [targetType, targetId]);

  async function save() {
    if (!editing || !editing.body.trim()) return;
    await fetch("/api/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, targetType, targetId, body: editing.body, tags: editing.tags, private: editing.private }),
    });
    setEditing(null);
    load();
  }
  async function remove(id: number) {
    if (!confirm("Supprimer cette note ?")) return;
    await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
    load();
  }

  async function toggleUnlock() {
    const next = !unlocked;
    setUnlocked(next);
    await load(next);
  }

  const hasEncrypted = notes.some((n) => n.encrypted);

  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-labelledby={`notes-${targetType}-${targetId}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 id={`notes-${targetType}-${targetId}`} className="text-sm font-medium">{label} ({notes.length})</h3>
        <div className="flex items-center gap-2">
          {hasEncrypted && (
            <button onClick={toggleUnlock}
                    className="text-xs px-2 py-1 rounded-md bg-secondary/40 hover:bg-secondary border border-border inline-flex items-center gap-1.5"
                    aria-label={unlocked ? "Verrouiller" : "Déverrouiller"}>
              {unlocked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
              {unlocked ? "verrouiller" : "déverrouiller"}
            </button>
          )}
          {!editing && (
            <button onClick={() => setEditing({ body: "", tags: "", private: false })}
                    className="text-xs px-2 py-1 rounded-md bg-secondary/40 hover:bg-secondary border border-border inline-flex items-center gap-1.5">
              <Plus className="h-3 w-3" /> Note
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 mb-3">
            <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                      placeholder="Note libre…" rows={3} autoFocus
                      className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
            <input value={editing.tags} onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                   placeholder="Tags séparés par virgule (ex: cardio, à-suivre, médecin)"
                   className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-xs outline-none focus:border-primary" />
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
              <input type="checkbox" checked={editing.private}
                     onChange={(e) => setEditing({ ...editing, private: e.target.checked })}
                     className="h-3 w-3 accent-primary" />
              <Lock className="h-3 w-3" /> Note privée (chiffrée at-rest)
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-md text-xs hover:bg-secondary/40 inline-flex items-center gap-1">
                <X className="h-3 w-3" /> Annuler
              </button>
              <button onClick={save} className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 inline-flex items-center gap-1">
                <Save className="h-3 w-3" /> Enregistrer
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {notes.length === 0 && !editing && <div className="text-xs text-muted-foreground py-3">Aucune note.</div>}
      <ul className="space-y-2">
        {notes.map((n) => (
          <motion.li key={n.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                     className="rounded-md bg-secondary/30 border border-border p-3 group">
            <div className="text-sm whitespace-pre-wrap flex items-start gap-2">
              {n.encrypted && <Lock className="h-3 w-3 mt-1 text-muted-foreground shrink-0" aria-label="chiffrée" />}
              <span>{n.body}</span>
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                {n.tags && n.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald/10 text-emerald border border-emerald/20">
                    <Tag className="h-2.5 w-2.5" />{t}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{new Date(n.createdAt).toLocaleDateString("fr-FR")}</span>
                {(!n.encrypted || unlocked) && (
                  <button onClick={() => setEditing({ id: n.id, body: n.body, tags: n.tags ?? "", private: !!n.encrypted })}
                          className="opacity-0 group-hover:opacity-100 transition hover:text-foreground" aria-label="Modifier">
                    modifier
                  </button>
                )}
                <button onClick={() => remove(n.id)}
                        className="opacity-0 group-hover:opacity-100 transition hover:text-red-400" aria-label="Supprimer">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
