"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Sparkles, Ticket } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");

  // Read ?invite=XXX from URL on mount — using window.location instead of
  // useSearchParams to avoid the Suspense boundary requirement.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInviteCode((params.get("invite") || "").trim());
  }, []);
  const hasInvite = inviteCode.length > 0;

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const pwdLen = pwd.length >= 10;
  const pwdHasUpper = /[A-Z]/.test(pwd);
  const pwdHasDigit = /\d/.test(pwd);
  const pwdMatch = pwd.length > 0 && pwd === pwd2;
  const canSubmit = emailValid && pwdLen && pwdHasUpper && pwdHasDigit && pwdMatch && accepted;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pwd, inviteCode: inviteCode || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erreur lors de la création du compte");
      // Redirect to welcome wizard
      window.location.href = "/welcome";
    } catch (e) {
      setError((e as Error).message);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 bg-gradient-to-br from-emerald/5 via-background to-background">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
                  className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald" />
          <span className="text-lg font-semibold tracking-tight">Vitals</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-2xl">
          <div className="flex items-center gap-2 text-emerald text-xs font-medium mb-1">
            <Sparkles className="h-3.5 w-3.5" /> Bêta privée
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Créer mon compte</h1>
          <p className="text-sm text-muted-foreground mb-4">Quelques minutes pour démarrer ton dossier santé.</p>
          {hasInvite && (
            <div className="mb-6 flex items-center gap-2 px-3 py-2 rounded-md border border-emerald/30 bg-emerald/10 text-emerald text-xs">
              <Ticket className="h-3.5 w-3.5 shrink-0" />
              <span>Invitation valide — tu peux créer ton compte directement.</span>
            </div>
          )}
          {!hasInvite && <div className="mb-2" />}

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground/80 font-medium block mb-1.5">Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2.5 text-sm outline-none focus:border-primary transition"
                placeholder="ton@email.com"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground/80 font-medium block mb-1.5">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"} required value={pwd} onChange={(e) => setPwd(e.target.value)}
                  className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2.5 pr-10 text-sm outline-none focus:border-primary transition"
                  placeholder="Minimum 10 caractères"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition" tabIndex={-1}>
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
                <Check label="≥ 10 car." ok={pwdLen} />
                <Check label="1 maj." ok={pwdHasUpper} />
                <Check label="1 chiffre" ok={pwdHasDigit} />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground/80 font-medium block mb-1.5">Confirmer</label>
              <input
                type={showPwd ? "text" : "password"} required value={pwd2} onChange={(e) => setPwd2(e.target.value)}
                className={`w-full bg-secondary/40 border ${pwd2 && !pwdMatch ? "border-red-500/50" : "border-border"} rounded-md px-3 py-2.5 text-sm outline-none focus:border-primary transition`}
                placeholder="Retape ton mot de passe"
              />
              {pwd2 && !pwdMatch && <div className="text-[10px] text-red-400 mt-1">Les mots de passe ne correspondent pas</div>}
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-muted-foreground">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600" />
              <span>
                J'accepte les <Link href="/legal/terms" className="text-emerald hover:underline">CGU</Link> et la <Link href="/legal/privacy" className="text-emerald hover:underline">politique de confidentialité</Link>. Je comprends que mes données médicales sont chiffrées et hébergées en EU.
              </span>
            </label>

            {error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">{error}</div>
            )}

            <button type="submit" disabled={!canSubmit || loading}
                    className="w-full px-4 py-2.5 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Création…" : "Créer mon compte"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center text-sm text-muted-foreground">
            Déjà un compte ? <Link href="/login" className="text-emerald hover:underline">Se connecter →</Link>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-6">
          Données chiffrées · Hébergement EU · RGPD compliant
        </p>
      </motion.div>
    </div>
  );
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-1 px-1.5 py-1 rounded ${ok ? "text-emerald" : "text-muted-foreground"}`}>
      {ok ? <span className="text-emerald">✓</span> : <span className="opacity-50">○</span>} {label}
    </div>
  );
}
