"use client";
import Link from "next/link";
import { Shield, Key, FileText, ArrowRight } from "lucide-react";

export const SECURITE_SECTION_IDS: string[] = [];

export function SecuriteSection() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-medium tracking-tight">Sécurité &amp; confidentialité</h2>
        <p className="text-sm text-muted-foreground mt-1">
          2FA, anonymisation LLM, et journal d&apos;audit. Toutes les protections sont locales et chiffrées.
        </p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <div className="flex items-center gap-2 text-emerald">
              <Shield className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wider font-medium">2FA</span>
            </div>
            <p className="text-sm mt-2 text-muted-foreground">
              Authentification à deux facteurs (TOTP) pour protéger l&apos;accès au compte.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <div className="flex items-center gap-2 text-emerald">
              <Key className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wider font-medium">Chiffrement</span>
            </div>
            <p className="text-sm mt-2 text-muted-foreground">
              Champs sensibles chiffrés au repos avec une clé locale (AES-256-GCM).
            </p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <div className="flex items-center gap-2 text-emerald">
              <FileText className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wider font-medium">Audit log</span>
            </div>
            <p className="text-sm mt-2 text-muted-foreground">
              Journal des accès et modifications consultable à tout moment.
            </p>
          </div>
        </div>

        <Link
          href="/profile/security"
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald/10 border border-emerald/30 text-sm text-emerald hover:bg-emerald/20 transition"
        >
          Ouvrir le panneau Sécurité
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>
    </div>
  );
}
