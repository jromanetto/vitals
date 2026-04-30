import Link from "next/link";
import { ArrowRight, Activity, Brain, Dna, Pill, Target, Heart, FlaskConical, Sparkles } from "lucide-react";

export const metadata = {
  title: "Vitals — La plateforme de santé qui te connaît mieux que ton médecin",
  description: "Centralise tes bilans sanguins, ADN, suppléments et wearables. Le panel médical IA t'explique tout.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top nav */}
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald" />
            <span className="text-lg font-semibold tracking-tight">Vitals</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/about" className="text-muted-foreground hover:text-foreground transition hidden sm:inline">À propos</Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground transition">Se connecter</Link>
            <Link href="/signup" className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition font-medium">Rejoindre la bêta</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald/10 via-background to-background" />
        <div className="max-w-5xl mx-auto px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald/30 bg-emerald/10 text-emerald text-xs font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5" /> Bêta privée — accès sur invitation
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-tight max-w-4xl mx-auto">
            La plateforme de santé qui te <span className="text-emerald">connaît mieux</span> que ton médecin
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mt-6 max-w-2xl mx-auto leading-relaxed">
            Centralise tes bilans sanguins, ton ADN, tes suppléments et tes wearables. Le panel médical IA t'explique tout, en français, et te guide vers la longévité.
          </p>
          <div className="flex items-center justify-center gap-3 mt-10 flex-wrap">
            <Link href="/signup" className="px-5 py-3 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition inline-flex items-center gap-2">
              Créer un compte gratuit <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login?demo=1" className="px-5 py-3 rounded-md border border-border bg-card hover:bg-secondary/40 transition font-medium">
              Voir la démo
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-4">Données chiffrées · Hébergement EU · Aucune publicité</p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
        <div className="text-center mb-12">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium mb-2">Ce que Vitals fait</div>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Toute ta santé, un seul endroit</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Activity, title: "Bilans + IA", desc: "Importe tes PDF, l'IA analyse, classe par système, génère un compte-rendu adapté à ton historique. Comparaison entre 2 prises pour mesurer l'effet d'une intervention." },
            { icon: Dna, title: "ADN + Suppléments", desc: "Charge ton 23andMe, on extrait 160+ variants. Recommandations personnalisées (MTHFR, COMT, APOE…). Bilan nutritionnel quotidien : alimentation + supplément vs cible longévité." },
            { icon: Target, title: "Plan d'action longévité", desc: "Score 0-100 quotidien. 3 piliers actionnables : sommeil, sport, nutrition. Chaque action est priorisée et liée à tes vrais biomarqueurs." },
          ].map((f, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-6">
              <div className="h-12 w-12 rounded-xl bg-emerald/15 border border-emerald/30 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-emerald" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-card/30 border-y border-border">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium mb-2">Comment ça marche</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">5 minutes pour démarrer</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { n: "1", t: "Crée ton compte", d: "Email, mot de passe. Hébergement EU, chiffré." },
              { n: "2", t: "Importe ton 1er bilan", d: "PDF, photo, ou saisie manuelle. L'IA détecte tout." },
              { n: "3", t: "Discute avec le panel", d: "Pose tes questions comme à un médecin qui a tout ton dossier." },
              { n: "4", t: "Suis ton plan", d: "Sommeil, sport, nutrition. Score quotidien, rappels santé." },
            ].map((s, i) => (
              <div key={i} className="relative">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="text-3xl font-semibold tabular-nums text-emerald mb-2">{s.n}</div>
                  <h3 className="font-semibold mb-1">{s.t}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.d}</p>
                </div>
                {i < 3 && <div className="hidden md:block absolute top-1/2 -right-3 -translate-y-1/2 z-10"><ArrowRight className="h-4 w-4 text-emerald/60" /></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities deeper */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium mb-2">Panel médical IA</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Comme un médecin qui a vraiment lu ton dossier</h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Médecin fonctionnel, généticien, nutrithérapeute, endocrinologue : un panel d'experts virtuels qui croisent tes données et te répondent en langage clair.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Recommandations personnalisées selon ton ADN (MTHFR, COMT, APOE…)",
                "Comparaison entre tes prises de sang : qu'est-ce qui a bougé ?",
                "Détection des suppléments à éviter selon tes variants génétiques",
                "Vue praticien imprimable pour partager avec ton vrai médecin",
              ].map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald mt-2 shrink-0" />
                  <span className="text-foreground/90">{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
              <Sparkles className="h-4 w-4 text-emerald" />
              <span className="font-semibold">Panel médical</span>
              <span className="text-xs text-muted-foreground ml-auto">médecin · généticien · nutrithérapeute</span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 max-w-[80%]">
                  Mon LDL est à 111 mg/dL avec mon APOE4, c'est inquiétant ?
                </div>
              </div>
              <div className="bg-secondary/40 rounded-lg px-3 py-2">
                <div className="text-emerald text-xs font-medium mb-1">Réflexion en cours…</div>
                <div className="text-foreground/90">
                  Avec ton variant <span className="text-emerald font-mono">rs429358 CT</span> (APOE3/4), la cible LDL doit être plus stricte que la population standard. À 111 mg/dL tu es au-dessus de la cible longévité (&lt; 70 mg/dL pour APOE4 carriers selon Attia).
                  <br /><br />
                  Stratégie : ApoB &lt; 80 mg/dL prioritaire, oméga-3 index &gt; 8%, et envisager une statine basse dose après discussion médicale.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="bg-card/30 border-y border-border">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium mb-2">Pricing</div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Simple et juste</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Free</div>
              <div className="text-3xl font-semibold mb-2">0 €<span className="text-base font-normal text-muted-foreground">/mois</span></div>
              <p className="text-sm text-muted-foreground mb-4">Tout l'essentiel pour démarrer</p>
              <ul className="text-sm space-y-2">
                <li>✓ 1 bilan sanguin / mois</li>
                <li>✓ ADN illimité (1 import à vie)</li>
                <li>✓ 5 questions chat / jour</li>
                <li>✓ Vue praticien imprimable</li>
                <li>✓ Profil santé complet</li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-emerald bg-emerald/5 p-6 relative">
              <span className="absolute -top-3 right-4 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-emerald text-primary-foreground">Recommandé</span>
              <div className="text-[10px] uppercase tracking-wider text-emerald mb-2">Pro</div>
              <div className="text-3xl font-semibold mb-2">9 €<span className="text-base font-normal text-muted-foreground">/mois</span></div>
              <p className="text-sm text-muted-foreground mb-4">Pour optimiser ta longévité</p>
              <ul className="text-sm space-y-2">
                <li>✓ Bilans illimités</li>
                <li>✓ Chat illimité avec panel médical</li>
                <li>✓ Sync wearables (Whoop, Oura, Apple Health)</li>
                <li>✓ Plan d'action quotidien IA</li>
                <li>✓ Comparaison de bilans</li>
                <li>✓ Rappels santé personnalisés</li>
                <li>✓ Partage médecin (lien sécurisé)</li>
              </ul>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-8">Bêta privée gratuite jusqu'au lancement officiel.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-2 w-2 rounded-full bg-emerald" />
              <span className="font-semibold">Vitals</span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">La plateforme de santé personnelle. Hébergement EU, données chiffrées.</p>
          </div>
          <div>
            <div className="font-semibold mb-3">Produit</div>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="/about" className="hover:text-foreground transition">À propos</Link></li>
              <li><Link href="/login" className="hover:text-foreground transition">Se connecter</Link></li>
              <li><Link href="/signup" className="hover:text-foreground transition">Rejoindre la bêta</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-3">Légal</div>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="/legal/privacy" className="hover:text-foreground transition">Confidentialité</Link></li>
              <li><Link href="/legal/terms" className="hover:text-foreground transition">CGU</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-3">Contact</div>
            <ul className="space-y-2 text-muted-foreground text-xs">
              <li>contact@vitals.blueproject.org</li>
              <li>RGPD compliant</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Vitals. Vitals n'est pas un dispositif médical. Consulte ton médecin avant toute décision de santé.
        </div>
      </footer>
    </div>
  );
}
