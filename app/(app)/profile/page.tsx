import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { UserCog, Lock, HeartPulse, Bell, FileText, ArrowRight } from "lucide-react";
import { getSession, currentUserId, effectiveUserId, isDemoUser, hasTotpEnabled } from "@/lib/auth";
import { AccountContact } from "@/components/profile/account-contact";
import { decryptProfile } from "@/lib/crypto-fields";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

async function loadPhone(authUserId: number, viewUserId: number | null): Promise<string> {
  try {
    const { data } = await convexServer().query(api.profile.get, {
      secret: bridgeSecret(),
      authUserId,
      viewUserId: viewUserId ?? authUserId,
    });
    if (!data) return "";
    const raw = typeof data === "string" ? JSON.parse(data) : data;
    const profile = decryptProfile(raw);
    return typeof profile.phone === "string" ? profile.phone : "";
  } catch {
    return "";
  }
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; prefill?: string }>;
}) {
  // Legacy links pointed at /profile?tab=X for the health wizard. The wizard
  // now lives at /data/profile — preserve the tab + prefill query.
  const sp = await searchParams;
  if (sp.tab || sp.prefill) {
    const qs = new URLSearchParams();
    if (sp.tab) qs.set("tab", sp.tab);
    if (sp.prefill) qs.set("prefill", sp.prefill);
    redirect(`/data/profile?${qs.toString()}`);
  }
  const session = await getSession();
  const userId = await currentUserId();
  const demo = userId !== null && userId !== undefined && isDemoUser(userId);
  const totp = hasTotpEnabled();
  const email = (session as { email?: string } | null)?.email ?? "—";
  const viewUserId = await effectiveUserId();
  const phone = userId ? await loadPhone(userId, viewUserId) : "";

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader
        title="Compte"
        description="Identifiants de connexion, sécurité et préférences plateforme. Les questions de santé sont dans Profil santé."
        icon={<UserCog className="h-5 w-5 text-emerald" />}
      />

      {/* Identifiants & contact */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div>
          <h2 className="text-base font-medium tracking-tight mb-4 flex items-center gap-2">
            <UserCog className="h-4 w-4 text-emerald" /> Identifiants
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Email de connexion</dt>
              <dd className="font-medium font-mono">{email}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Statut</dt>
              <dd className="flex items-center gap-2">
                {demo ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/40">Démo (lecture seule)</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-emerald/15 text-emerald border border-emerald/40">Bêta</span>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">2FA</dt>
              <dd className="text-xs">
                {totp ? (
                  <span className="text-emerald">Activée</span>
                ) : (
                  <span className="text-amber-400">Désactivée — recommandé d&apos;activer</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
        <div className="border-t border-border pt-5">
          <h3 className="text-sm font-medium tracking-tight mb-3">Contact</h3>
          <AccountContact initialPhone={phone} />
        </div>
      </section>

      {/* Profil santé — la grosse CTA */}
      <Link
        href="/data/profile"
        className="block rounded-xl border border-emerald/40 bg-emerald/5 hover:bg-emerald/10 p-6 transition group"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium tracking-tight flex items-center gap-2 mb-1">
              <HeartPulse className="h-4 w-4 text-emerald" /> Profil santé
            </h2>
            <p className="text-sm text-muted-foreground">
              Identité, anthropométrie, antécédents, famille, lifestyle, symptômes, suivi médical, environnement, objectifs. Toutes les questions qui pré-remplissent l&apos;IA.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-emerald flex-shrink-0 group-hover:translate-x-0.5 transition" />
        </div>
      </Link>

      {/* Sécurité */}
      <Link
        href="/profile/security"
        className="block rounded-xl border border-border bg-card hover:bg-secondary/40 p-6 transition group"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium tracking-tight flex items-center gap-2 mb-1">
              <Lock className="h-4 w-4 text-emerald" /> Sécurité
            </h2>
            <p className="text-sm text-muted-foreground">
              Mot de passe, double authentification (TOTP), anonymisation LLM, notifications push, audit log.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0 group-hover:translate-x-0.5 transition" />
        </div>
      </Link>

      {/* Rappels */}
      <Link
        href="/reminders"
        className="block rounded-xl border border-border bg-card hover:bg-secondary/40 p-6 transition group"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-medium tracking-tight flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 text-emerald" /> Rappels
            </h2>
            <p className="text-sm text-muted-foreground">
              Configurer tes rappels de prise de compléments, bilans périodiques, RDV.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0 group-hover:translate-x-0.5 transition" />
        </div>
      </Link>

      {/* Légal */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-medium tracking-tight mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" /> Légal
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 text-sm">
          <Link href="/legal/terms" className="text-emerald hover:underline">Conditions générales</Link>
          <Link href="/legal/privacy" className="text-emerald hover:underline">Politique de confidentialité</Link>
          <Link href="/about" className="text-emerald hover:underline">À propos</Link>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center pt-4">
        Toutes tes données restent locales (SQLite chiffrée au repos sur serveur EU). Aucune donnée n&apos;est revendue ou partagée sans ton consentement explicite.
      </p>
    </div>
  );
}
