"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type ShareRow = {
  id: number;
  token: string;
  scope: string;
  createdAt: number;
  expiresAt: number;
  views: number;
  lastViewedAt: number | null;
  revoked: number;
};

function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString("fr-FR", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function buildUrl(token: string): string {
  if (typeof window === "undefined") return `/share/${token}`;
  return `${window.location.origin}/share/${token}`;
}

export function ShareLinkManager() {
  const [rows, setRows] = useState<ShareRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [duration, setDuration] = useState<24 | 168>(24);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/share", { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        setRows(j.rows || []);
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Lien copié dans le presse-papiers");
    } catch {
      toast.error("Impossible de copier");
    }
  }

  async function createLink() {
    setCreating(true);
    try {
      const r = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope: "praticien", durationHours: duration }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(j?.error || "Échec de création");
        return;
      }
      const j = await r.json();
      setModalOpen(false);
      await load();
      try {
        await navigator.clipboard.writeText(j.url);
        toast.success("Lien créé et copié", {
          description: `Expire le ${fmtDateTime(j.expiresAt)}`,
        });
      } catch {
        toast.success("Lien créé", { description: j.url });
      }
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: number) {
    if (!confirm("Révoquer ce lien partagé ? Le médecin ne pourra plus y accéder.")) return;
    const r = await fetch(`/api/share?id=${id}`, { method: "DELETE" });
    if (r.ok) {
      toast.success("Lien révoqué");
      await load();
    } else {
      toast.error("Échec de révocation");
    }
  }

  return (
    <div className="no-print mb-6 rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">Partager avec un médecin</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Génère un lien temporaire en lecture seule. Aucune connexion requise pour le médecin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-3 py-1.5 transition"
        >
          + Créer un lien partagé
        </button>
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground mt-3">Chargement…</p>
      )}

      {!loading && rows && rows.length === 0 && (
        <p className="text-xs text-muted-foreground mt-3">Aucun lien partagé actif.</p>
      )}

      {!loading && rows && rows.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((r) => {
            const url = buildUrl(r.token);
            return (
              <li key={r.id} className="py-2.5 flex items-center gap-3 flex-wrap">
                <code className="text-xs font-mono text-muted-foreground truncate max-w-[260px] sm:max-w-[420px]" title={url}>
                  {url}
                </code>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Expire le {fmtDateTime(r.expiresAt)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {r.views} vue{r.views !== 1 ? "s" : ""}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copy(url)}
                    className="rounded-md border border-border bg-background hover:bg-muted text-xs px-2 py-1"
                  >
                    Copier
                  </button>
                  <button
                    type="button"
                    onClick={() => revoke(r.id)}
                    className="rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs px-2 py-1"
                  >
                    Révoquer
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => !creating && setModalOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-xl p-5 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold tracking-tight">Créer un lien partagé</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Choisis la durée pendant laquelle le lien sera valide.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDuration(24)}
                className={`rounded-md border px-3 py-2 text-sm transition ${
                  duration === 24
                    ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                    : "border-border bg-background hover:bg-muted text-muted-foreground"
                }`}
              >
                24 heures
              </button>
              <button
                type="button"
                onClick={() => setDuration(168)}
                className={`rounded-md border px-3 py-2 text-sm transition ${
                  duration === 168
                    ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                    : "border-border bg-background hover:bg-muted text-muted-foreground"
                }`}
              >
                7 jours
              </button>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={creating}
                className="rounded-md border border-border bg-background hover:bg-muted text-sm px-3 py-1.5"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={createLink}
                disabled={creating}
                className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-3 py-1.5 disabled:opacity-50"
              >
                {creating ? "Création…" : "Créer le lien"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
