import Link from "next/link";
import { Heart, Sparkles, Shield, Globe } from "lucide-react";
import { VitalsWordmark } from "@/components/brand/logo";
export const metadata = { title: "À propos — Vitals" };

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border"><div className="max-w-3xl mx-auto px-6 py-4"><Link href="/" aria-label="Vitals — accueil"><VitalsWordmark /></Link></div></header>
      <article className="max-w-3xl mx-auto px-6 py-16 space-y-10">
        <div><h1 className="text-4xl font-semibold tracking-tight mb-4">Notre mission</h1><p className="text-lg text-muted-foreground leading-relaxed">Donner à chacun le pouvoir de comprendre son corps et d&apos;optimiser sa longévité — avec des outils que seul un médecin spécialisé avait jusqu&apos;ici.</p></div>
        <section><h2 className="text-2xl font-semibold tracking-tight mb-4">Pourquoi Vitals ?</h2><div className="space-y-3 leading-relaxed"><p>Tu as 10 ans de bilans sanguins éparpillés dans des PDF, ton 23andMe que tu n&apos;as jamais vraiment exploité, des suppléments dont tu ne sais pas s&apos;ils servent vraiment, et un Whoop qui collecte plein de données sans contexte.</p><p>Aucun outil ne réunit tout ça. Pourtant, c&apos;est précisément le croisement de ces données qui révèle des insights actionnables sur ta santé et ta longévité.</p><p className="font-medium">Vitals fait ce travail à ta place.</p></div></section>
        <section><h2 className="text-2xl font-semibold tracking-tight mb-4">Nos principes</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="rounded-xl border border-border bg-card p-5"><Shield className="h-5 w-5 text-emerald mb-3" /><h3 className="font-semibold mb-2">Tes données t&apos;appartiennent</h3><p className="text-sm text-muted-foreground leading-relaxed">Pas de revente, pas de pub. Hébergement EU. Export à tout moment.</p></div><div className="rounded-xl border border-border bg-card p-5"><Heart className="h-5 w-5 text-emerald mb-3" /><h3 className="font-semibold mb-2">Pas de remplacement médical</h3><p className="text-sm text-muted-foreground leading-relaxed">Vitals informe et synthétise. Ton médecin reste le décideur.</p></div><div className="rounded-xl border border-border bg-card p-5"><Sparkles className="h-5 w-5 text-emerald mb-3" /><h3 className="font-semibold mb-2">Au-delà du normal</h3><p className="text-sm text-muted-foreground leading-relaxed">On vise la santé optimale et la longévité, pas l&apos;absence de maladie.</p></div><div className="rounded-xl border border-border bg-card p-5"><Globe className="h-5 w-5 text-emerald mb-3" /><h3 className="font-semibold mb-2">Sources transparentes</h3><p className="text-sm text-muted-foreground leading-relaxed">Cibles longévité issues de Peter Attia, Bryan Johnson, EFSA, NIH ODS.</p></div></div></section>
        <section><h2 className="text-2xl font-semibold tracking-tight mb-4">Contact</h2><p>contact@vitals.blueproject.org</p></section>
        <p className="pt-8 text-sm text-muted-foreground"><Link href="/" className="text-emerald hover:underline">← Retour à l&apos;accueil</Link></p>
      </article>
    </main>
  );
}
