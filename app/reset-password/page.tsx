"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken((params.get("token") || "").trim());
  }, []);

  const longEnough = pwd.length >= 10;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasDigit = /\d/.test(pwd);
  const match = pwd.length > 0 && pwd === confirm;
  const valid = longEnough && hasUpper && hasDigit && match && token.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pwd }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.error || "Échec de la réinitialisation.");
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => { window.location.href = "/login"; }, 2000);
    } catch {
      setErr("Erreur réseau. Réessaye.");
      setLoading(false);
    }
  }

  const Check = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className={ok ? "text-emerald" : "text-muted-foreground"}>{ok ? "✓" : "○"} {label}</span>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="glass border border-border rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-2 w-2 rounded-full bg-emerald" />
            <h1 className="text-2xl font-semibold tracking-tight">Vitals</h1>
          </div>
          <p className="text-muted-foreground text-sm mb-7">Nouveau mot de passe</p>

          {done ? (
            <div className="px-3 py-3 rounded-md bg-emerald/10 border border-emerald/30 text-sm text-foreground">
              Mot de passe mis à jour. Redirection vers la connexion…
            </div>
          ) : !token ? (
            <div className="space-y-5">
              <div className="px-3 py-3 rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-sm">
                Lien invalide ou incomplet. Refais une demande de réinitialisation.
              </div>
              <a href="/forgot-password" className="text-emerald hover:underline text-sm">Demander un nouveau lien</a>
            </div>
          ) : (
            <>
              {err && (
                <div className="mb-4 px-3 py-2 rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-sm">{err}</div>
              )}
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Nouveau mot de passe</label>
                  <input
                    type="password" required autoFocus value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    placeholder="Minimum 10 caractères"
                    className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2.5 outline-none focus:border-primary transition"
                  />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs pt-1">
                    <Check ok={longEnough} label="≥ 10 car." />
                    <Check ok={hasUpper} label="1 maj." />
                    <Check ok={hasDigit} label="1 chiffre" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Confirmer</label>
                  <input
                    type="password" required value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Retape ton mot de passe"
                    className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2.5 outline-none focus:border-primary transition"
                  />
                  {confirm.length > 0 && !match && (
                    <p className="text-xs text-destructive pt-1">Les mots de passe ne correspondent pas.</p>
                  )}
                </div>
                <button
                  type="submit" disabled={loading || !valid}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 rounded-md transition disabled:opacity-50"
                >
                  {loading ? "Mise à jour…" : "Réinitialiser le mot de passe"}
                </button>
              </form>
              <div className="mt-5 pt-4 border-t border-border/40 text-center text-sm text-muted-foreground">
                <a href="/login" className="text-emerald hover:underline">← Retour à la connexion</a>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
