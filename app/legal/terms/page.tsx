import Link from "next/link";
export const metadata = { title: "CGU — Vitals" };

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border"><div className="max-w-3xl mx-auto px-6 py-4"><Link href="/" className="flex items-center gap-2.5"><div className="h-2 w-2 rounded-full bg-emerald" /><span className="font-semibold tracking-tight">Vitals</span></Link></div></header>
      <article className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Conditions générales</h1>
        <p className="text-sm text-muted-foreground">Dernière mise à jour : avril 2026</p>
        <section className="space-y-3"><h2 className="text-xl font-semibold tracking-tight mt-8">1. Pas un dispositif médical</h2><p className="text-sm leading-relaxed font-medium">Vitals N&apos;EST PAS un dispositif médical. Les analyses, recommandations et compte-rendus IA sont à titre informatif uniquement et ne remplacent pas un médecin qualifié. Consulte toujours un professionnel avant toute décision santé.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold tracking-tight mt-8">2. Compte et sécurité</h2><p className="text-sm leading-relaxed">Tu es responsable de la confidentialité de ton mot de passe. Active la 2FA dans Sécurité.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold tracking-tight mt-8">3. Bêta privée</h2><p className="text-sm leading-relaxed">Vitals est en bêta privée gratuite. Service susceptible d&apos;interruptions et de changements sans préavis.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold tracking-tight mt-8">4. Limitation de responsabilité</h2><p className="text-sm leading-relaxed">Vitals fourni en l&apos;état. Aucune garantie d&apos;exactitude médicale. Aucune responsabilité pour décisions basées sur Vitals.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold tracking-tight mt-8">5. Suppression</h2><p className="text-sm leading-relaxed">Compte supprimable à tout moment depuis Profil → Sécurité avec cascade complète sous 30 jours.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold tracking-tight mt-8">6. Droit applicable</h2><p className="text-sm leading-relaxed">Droit belge. Tribunaux de Bruxelles.</p></section>
        <p className="pt-12 text-xs text-muted-foreground"><Link href="/" className="text-emerald hover:underline">← Retour à l&apos;accueil</Link></p>
      </article>
    </main>
  );
}
