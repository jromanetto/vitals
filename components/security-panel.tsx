"use client";
import { useState } from "react";
import type { AuditRow } from "@/lib/audit";

type Props = {
  totpEnabled: boolean;
  anonymizeEnabled: boolean;
  events: AuditRow[];
};

export function SecurityPanel({ totpEnabled, anonymizeEnabled, events }: Props) {
  const [enabled, setEnabled] = useState(totpEnabled);
  const [anon, setAnon] = useState(anonymizeEnabled);
  const [setupQr, setSetupQr] = useState<string | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [disablingMode, setDisablingMode] = useState(false);

  async function startSetup() {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await fetch("/api/auth/totp/setup", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "error");
      setSetupQr(d.qrDataUrl);
      setSetupSecret(d.secret);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup() {
    if (!setupSecret || !code) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: setupSecret, code }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Code invalide");
      setEnabled(true);
      setSetupQr(null); setSetupSecret(null); setCode("");
      setMsg("2FA activée.");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function disableTotp() {
    if (!code) { setErr("Saisis ton code 2FA actuel pour désactiver"); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/auth/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erreur");
      setEnabled(false); setCode(""); setDisablingMode(false);
      setMsg("2FA désactivée.");
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function toggleAnon() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/security/anonymize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !anon }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erreur");
      setAnon(d.enabled);
      setMsg(d.enabled ? "Anonymisation LLM activée." : "Anonymisation LLM désactivée.");
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-8">
      <section className="glass border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Authentification 2FA (TOTP)</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Google Authenticator, 1Password, Authy… code à 6 chiffres exigé à la connexion.
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-md ${enabled ? "bg-emerald/10 text-emerald border border-emerald/30" : "bg-secondary text-muted-foreground border border-border"}`}>
            {enabled ? "Active" : "Désactivée"}
          </span>
        </div>

        {err && <div className="text-sm px-3 py-2 rounded-md bg-destructive/15 border border-destructive/30 text-destructive">{err}</div>}
        {msg && <div className="text-sm px-3 py-2 rounded-md bg-emerald/10 border border-emerald/30 text-emerald">{msg}</div>}

        {!enabled && !setupQr && (
          <button onClick={startSetup} disabled={busy} className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-2 rounded-md transition disabled:opacity-50">
            {busy ? "…" : "Activer la 2FA"}
          </button>
        )}

        {!enabled && setupQr && (
          <div className="space-y-3">
            <p className="text-sm">Scanne ce QR code avec ton app TOTP, puis saisis le code à 6 chiffres pour confirmer.</p>
            <img src={setupQr} alt="QR 2FA" className="w-56 h-56 bg-white rounded-md p-2" />
            <p className="text-xs text-muted-foreground font-mono break-all">Secret manuel : {setupSecret}</p>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" inputMode="numeric" maxLength={8} className="w-40 bg-secondary/50 border border-border rounded-md px-3 py-2 outline-none focus:border-primary transition" />
            <div className="flex gap-2">
              <button onClick={confirmSetup} disabled={busy || code.length < 6} className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-2 rounded-md transition disabled:opacity-50">Confirmer</button>
              <button onClick={() => { setSetupQr(null); setSetupSecret(null); setCode(""); }} className="px-4 py-2 rounded-md border border-border hover:bg-secondary transition">Annuler</button>
            </div>
          </div>
        )}

        {enabled && !disablingMode && (
          <button onClick={() => setDisablingMode(true)} className="px-4 py-2 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition">Désactiver la 2FA</button>
        )}

        {enabled && disablingMode && (
          <div className="space-y-2">
            <p className="text-sm">Confirme avec ton code 2FA actuel.</p>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" inputMode="numeric" maxLength={8} className="w-40 bg-secondary/50 border border-border rounded-md px-3 py-2 outline-none focus:border-primary transition" />
            <div className="flex gap-2">
              <button onClick={disableTotp} disabled={busy} className="bg-destructive hover:bg-destructive/90 text-white font-medium px-4 py-2 rounded-md transition disabled:opacity-50">Désactiver</button>
              <button onClick={() => { setDisablingMode(false); setCode(""); }} className="px-4 py-2 rounded-md border border-border hover:bg-secondary transition">Annuler</button>
            </div>
          </div>
        )}
      </section>

      <section className="glass border border-border rounded-xl p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Anonymisation LLM</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Masque ton prénom/nom, email, téléphone, date de naissance et localisation avant tout envoi à Claude.
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-md ${anon ? "bg-emerald/10 text-emerald border border-emerald/30" : "bg-secondary text-muted-foreground border border-border"}`}>
            {anon ? "Activée" : "Désactivée"}
          </span>
        </div>
        <button onClick={toggleAnon} disabled={busy} className={`px-4 py-2 rounded-md transition disabled:opacity-50 ${anon ? "border border-border hover:bg-secondary" : "bg-primary hover:bg-primary/90 text-primary-foreground font-medium"}`}>
          {anon ? "Désactiver" : "Activer"}
        </button>
      </section>

      <section className="glass border border-border rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold">Journal d'audit (50 derniers événements)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground border-b border-border">
              <tr><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Action</th><th className="py-2 pr-4">Cible</th><th className="py-2 pr-4">IP</th></tr>
            </thead>
            <tbody>
              {events.length === 0 && (<tr><td colSpan={4} className="py-3 text-muted-foreground">Aucun événement</td></tr>)}
              {events.map((e) => (
                <tr key={e.id} className="border-b border-border/50">
                  <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{new Date(e.created_at).toLocaleString("fr-FR")}</td>
                  <td className="py-2 pr-4 font-mono">{e.action}</td>
                  <td className="py-2 pr-4 truncate max-w-[200px]">{e.target ?? "—"}</td>
                  <td className="py-2 pr-4 font-mono text-muted-foreground">{e.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
