"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, UserPlus, X, Check, Clock, Loader2, Inbox, ShieldCheck } from "lucide-react";

type Member = { id: number; otherId: number; label: string; email: string; relationship: string | null; status: string; created_at: number };
type Incoming = { id: number; otherId: number; email: string; relationship: string | null; created_at: number };
type Data = { canView: Member[]; pendingOutgoing: Member[]; pendingIncoming: Incoming[] };

export function FoyerManager({ initial, selfEmail }: { initial: Data; selfEmail: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [relationship, setRelationship] = useState("");

  async function call(key: string, url: string, init: RequestInit) {
    setBusy(key); setError(null);
    try {
      const r = await fetch(url, init);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Échec");
      router.refresh();
      return true;
    } catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(null); }
  }

  async function request(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    const ok = await call("add", "/api/household", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, label, relationship }),
    });
    if (ok) { setEmail(""); setLabel(""); setRelationship(""); }
  }

  const viewAs = (subjectId: number) => call(`view-${subjectId}`, "/api/household/view", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectId }),
  });
  const revoke = (id: number) => call(`del-${id}`, `/api/household/${id}`, { method: "DELETE" });
  const respond = (id: number, action: "approve" | "reject") => call(`resp-${id}`, "/api/household/respond", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }),
  });

  const spin = (k: string) => busy === k;

  return (
    <div className="space-y-8">
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</div>}

      {/* Consent inbox — requests awaiting MY approval */}
      {initial.pendingIncoming.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
            <Inbox className="h-4 w-4" /> Demandes d&apos;accès à tes données
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Ces personnes veulent consulter tes données de santé. Tu décides.</p>
          <div className="mt-3 space-y-2">
            {initial.pendingIncoming.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
                <span className="flex-1 truncate">{r.email}</span>
                <button onClick={() => respond(r.id, "approve")} disabled={!!busy}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                  {spin(`resp-${r.id}`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approuver
                </button>
                <button onClick={() => respond(r.id, "reject")} disabled={!!busy}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50">
                  Refuser
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Members I can view */}
      <section>
        <h2 className="text-sm font-medium flex items-center gap-2"><Eye className="h-4 w-4 text-muted-foreground" /> Proches que je peux consulter</h2>
        <div className="mt-3 space-y-2">
          {initial.canView.length === 0 && (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-4 py-5 text-center">
              Personne pour l&apos;instant. Envoie une demande ci-dessous.
            </p>
          )}
          {initial.canView.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
              <span className="grid place-items-center h-8 w-8 rounded-full bg-secondary text-[11px] font-semibold">{m.label.replace(/@.*/, "").slice(0, 2).toUpperCase()}</span>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{m.label}</div>
                <div className="truncate text-xs text-muted-foreground">{m.relationship ? `${m.relationship} · ` : ""}{m.email}</div>
              </div>
              <button onClick={() => viewAs(m.otherId)} disabled={!!busy}
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-secondary/70 disabled:opacity-50">
                {spin(`view-${m.otherId}`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Consulter
              </button>
              <button onClick={() => revoke(m.id)} disabled={!!busy} aria-label="Retirer"
                className="p-1.5 text-muted-foreground hover:text-red-400 disabled:opacity-50">
                {spin(`del-${m.id}`) ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Outgoing pending */}
      {initial.pendingOutgoing.length > 0 && (
        <section>
          <h2 className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> En attente d&apos;approbation</h2>
          <div className="mt-3 space-y-2">
            {initial.pendingOutgoing.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{m.email}</span>
                <button onClick={() => revoke(m.id)} disabled={!!busy}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:text-foreground disabled:opacity-50">
                  {spin(`del-${m.id}`) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Annuler
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add member */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium flex items-center gap-2"><UserPlus className="h-4 w-4 text-muted-foreground" /> Lier un proche</h2>
        <p className="mt-1 text-xs text-muted-foreground">La personne doit déjà avoir un compte Vitals. Elle recevra ta demande à approuver.</p>
        <form onSubmit={request} className="mt-3 space-y-2.5">
          <input type="email" required placeholder="Email du proche" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm" />
          <div className="flex gap-2.5">
            <input placeholder="Nom affiché (ex : Noelly)" value={label} onChange={(e) => setLabel(e.target.value)}
              className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm" />
            <input placeholder="Lien (ex : conjointe)" value={relationship} onChange={(e) => setRelationship(e.target.value)}
              className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {spin("add") ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Envoyer la demande
          </button>
        </form>
      </section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        Connecté en tant que <span className="text-foreground">{selfEmail}</span>. Les données médicales restent privées : visibles uniquement après consentement explicite, en lecture seule.
      </p>
    </div>
  );
}
