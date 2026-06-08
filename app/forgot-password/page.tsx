"use client";
import { useState } from "react";
import { motion } from "framer-motion";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } catch {}
    setLoading(false);
    setSent(true);
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
          <p className="text-muted-foreground text-sm mb-7">Mot de passe oublié</p>

          {sent ? (
            <div className="space-y-5">
              <div className="px-3 py-3 rounded-md bg-emerald/10 border border-emerald/30 text-sm text-foreground">
                Si un compte existe avec cette adresse, un email avec un lien de réinitialisation vient d&apos;être envoyé. Vérifie ta boîte (et les spams).
              </div>
              <a href="/login" className="text-emerald hover:underline text-sm">← Retour à la connexion</a>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-5">
                Entre ton email — on t&apos;envoie un lien pour choisir un nouveau mot de passe.
              </p>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
                  <input
                    type="email" required autoFocus value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ton@email.com"
                    className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2.5 outline-none focus:border-primary transition"
                  />
                </div>
                <button
                  type="submit" disabled={loading}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 rounded-md transition disabled:opacity-50"
                >
                  {loading ? "Envoi…" : "Envoyer le lien"}
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
