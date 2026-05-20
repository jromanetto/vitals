import Link from "next/link";
export const metadata = { title: "Confidentialité — Vitals" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-2 w-2 rounded-full bg-emerald" />
            <span className="font-semibold tracking-tight">Vitals</span>
          </Link>
        </div>
      </header>
      <article className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Politique de confidentialité</h1>
        <p className="text-sm text-muted-foreground">Dernière mise à jour : avril 2026</p>
        <section className="space-y-3"><h2 className="text-xl font-semibold tracking-tight mt-8">1. Données collectées</h2><p className="text-sm leading-relaxed">Vitals collecte uniquement les données que tu choisis d&apos;importer : bilans sanguins (PDF/photos/saisie manuelle), données génétiques (23andMe), suppléments, symptômes, exports wearables (Whoop, Oura), notes personnelles, et les informations de profil que tu renseignes. Ton email et ton mot de passe (haché bcrypt 12 rounds) sont stockés.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold tracking-tight mt-8">2. Hébergement et sécurité</h2><p className="text-sm leading-relaxed">Tes données sont hébergées en Union Européenne (Belgique). Communications TLS 1.3, mots de passe bcrypt, clé de chiffrement individuelle, sauvegardes chiffrées quotidiennes.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold tracking-tight mt-8">3. Utilisation Anthropic Claude (sous-traitant US)</h2><p className="text-sm leading-relaxed">Les requêtes à l&apos;équipe médicale envoient des extraits ciblés de tes données à l&apos;API Anthropic (Claude Sonnet 4.5/4.6, hébergé aux États-Unis). L&apos;<strong>anonymisation LLM est active par défaut</strong> : avant chaque envoi, ton prénom, nom, email, téléphone, adresse, date de naissance précise (remplacée par l&apos;âge) et noms de proches dans le pedigree sont strippés. Les valeurs médicales (biomarqueurs, ADN, symptômes) sont conservées car elles n&apos;identifient pas directement. Anthropic ne stocke pas ces requêtes pour entraînement (politique commerciale Tier Workspace). Tu peux désactiver l&apos;anonymisation depuis Compte → Sécurité si tu préfères des réponses plus personnalisées.</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold tracking-tight mt-8">4. Tes droits (RGPD)</h2><ul className="text-sm leading-relaxed space-y-2 list-disc pl-5"><li>Accès : export complet depuis Profil → Export</li><li>Rectification : tout est éditable dans l&apos;app</li><li>Effacement : suppression de compte cascade</li><li>Portabilité : export JSON</li><li>Opposition : opt-out API Claude possible</li></ul></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold tracking-tight mt-8">5. Aucun partage</h2><p className="text-sm leading-relaxed">Aucune revente, aucune publicité, aucun tracker tiers. Services externes : Anthropic (chat) + Cloudflare (CDN).</p></section>
        <section className="space-y-3"><h2 className="text-xl font-semibold tracking-tight mt-8">6. Contact</h2><p className="text-sm leading-relaxed">contact@vitals.blueproject.org · Tu peux déposer plainte CNIL (FR) ou APD (BE).</p></section>
        <p className="pt-12 text-xs text-muted-foreground"><Link href="/" className="text-emerald hover:underline">← Retour à l&apos;accueil</Link></p>
      </article>
    </main>
  );
}
