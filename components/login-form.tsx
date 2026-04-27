"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const idle = sp.get("reason") === "idle";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    const body: Record<string, string> = { email, password };
    if (needTotp && totpCode) body.totpCode = totpCode;
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      router.push(sp.get("from") || "/");
      router.refresh();
      return;
    }
    let data: { error?: string; retryAfter?: number } = {};
    try { data = await res.json(); } catch {}
    if (res.status === 429) {
      setErr(`Trop de tentatives. Réessaye dans ${data.retryAfter ?? "10 min"}.`);
    } else if (data.error === "totp_required") {
      setNeedTotp(true);
      setErr(null);
    } else if (data.error === "totp_invalid") {
      setErr("Code 2FA invalide");
    } else {
      setErr("Identifiants invalides");
      setNeedTotp(false);
    }
    setLoading(false);
  }

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
          <p className="text-muted-foreground text-sm mb-7">Health intelligence dashboard</p>

          {idle && !err && (
            <div className="mb-4 px-3 py-2 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-500 text-sm">
              Session expirée pour inactivité. Reconnecte-toi.
            </div>
          )}

          {err && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-4 px-3 py-2 rounded-md bg-destructive/15 border border-destructive/30 text-destructive text-sm"
            >
              {err}
            </motion.div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
              <input
                type="email" required autoFocus value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2.5 outline-none focus:border-primary transition"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Mot de passe</label>
              <input
                type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2.5 outline-none focus:border-primary transition"
              />
            </div>
            {needTotp && (
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Code 2FA</label>
                <input
                  type="text" inputMode="numeric" autoComplete="one-time-code" required autoFocus
                  value={totpCode} maxLength={8}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="123 456"
                  className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2.5 outline-none focus:border-primary transition tracking-widest font-mono"
                />
              </div>
            )}
            <button
              type="submit" disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 rounded-md transition disabled:opacity-50"
            >
              {loading ? "Connexion…" : needTotp ? "Vérifier le code" : "Se connecter"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
