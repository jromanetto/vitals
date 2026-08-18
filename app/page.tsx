import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { VitalsWordmark } from "@/components/brand/logo";
import { Reveal, Stagger, Item, HoverCard, Press } from "@/components/marketing/motion";
import { WidgetCard } from "@/components/marketing/widget-card";

export const metadata = {
  title: "Vitals — La santé qui se lit comme un relevé, pas comme un mystère",
  description:
    "Centralise tes bilans sanguins, ton ADN, tes suppléments et tes wearables. Une équipe médicale IA croise le tout et te répond en français, chiffres à l'appui.",
};

// Emerald→amber fill for a reference-range bar that sits above its personalised
// target (the LDL / APOE4 example). Written with the theme's HSL tokens so it
// reads identically in light and dark.
const RR_FILL = "linear-gradient(90deg, hsl(160 84% 39%), hsl(38 92% 50%))";

export default function LandingPage() {
  return (
    <div className="mkt-ambient min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" aria-label="Vitals — accueil">
            <VitalsWordmark />
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="#lit" className="text-muted-foreground hover:text-foreground transition hidden md:inline">
              Comment ça lit tes données
            </Link>
            <Link href="#prix" className="text-muted-foreground hover:text-foreground transition hidden md:inline">
              Tarifs
            </Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground transition">
              Se connecter
            </Link>
            <Press className="inline-flex">
              <Link
                href="/signup"
                className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
              >
                Rejoindre la bêta
              </Link>
            </Press>
          </nav>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-16 md:pt-20 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-14 items-center">
          <Stagger gap={0.09}>
            <Item>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald/30 bg-emerald/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-emerald mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald motion-safe:animate-pulse" /> Bêta privée · accès sur invitation
              </span>
            </Item>
            <Item>
              <h1 className="text-4xl md:text-6xl font-bold tracking-[-0.035em] leading-[1.03] text-balance">
                La santé qui se lit comme un <span className="text-emerald">relevé</span>, pas comme un mystère.
              </h1>
            </Item>
            <Item>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl">
                Tes bilans sanguins, ton ADN, tes suppléments et tes wearables — au même endroit. Une équipe
                médicale IA croise le tout et te répond en français, chiffres à l&apos;appui.
              </p>
            </Item>
            <Item>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Press className="inline-flex">
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition"
                  >
                    Créer un compte gratuit <ArrowRight className="h-4 w-4" />
                  </Link>
                </Press>
                <Press className="inline-flex">
                  <Link
                    href="/login?demo=1"
                    className="px-5 py-3 rounded-lg border border-border bg-card hover:bg-secondary/50 transition font-medium"
                  >
                    Voir la démo
                  </Link>
                </Press>
              </div>
            </Item>
            <Item>
              <p className="mt-5 font-mono text-xs text-muted-foreground tracking-wide">
                chiffré de bout en bout · hébergé en UE · zéro publicité
              </p>
            </Item>
          </Stagger>

          {/* Readout — the thesis */}
          <Reveal x={26} y={0} delay={0.15} className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/40">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald motion-safe:animate-pulse" /> Équipe médicale
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">médecin · généticien · nutri</div>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sm font-medium text-foreground/80">LDL cholestérol</span>
                  <span className="font-mono tabular-nums text-[15px] font-semibold">
                    111 <span className="text-muted-foreground font-normal">mg/dL</span>
                  </span>
                </div>
                <div className="relative h-2 rounded-md bg-secondary/60 border border-border overflow-hidden">
                  <div className="animate-rr h-full rounded-md" style={{ width: "58%", background: RR_FILL }} />
                  {/* personalised APOE4 target marker */}
                  <div className="absolute -top-1 -bottom-1 w-0.5 bg-foreground/60" style={{ left: "38%" }} />
                </div>
                <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground tabular-nums">
                  <span>0</span>
                  <span>cible APOE4 · 70</span>
                  <span>190</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Au-dessus de la cible longévité pour porteur <span className="text-amber-500 font-medium">APOE3/4</span>.
                  Le repère est ton seuil personnalisé, pas la norme labo.
                </p>
              </div>

              <div className="border-t border-dashed border-border pt-4 space-y-2.5">
                <div className="flex justify-end">
                  <div className="max-w-[82%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground text-sm px-3 py-2">
                    Mon LDL est à 111 avec mon APOE4, je m&apos;inquiète ?
                  </div>
                </div>
                <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-secondary/50 border border-border text-sm px-3 py-2.5 text-foreground/90">
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-emerald mb-1.5">raisonnement</div>
                  Avec ton variant <code className="font-mono text-emerald bg-emerald/10 px-1 py-0.5 rounded text-xs">rs429358 CT</code>{" "}
                  (APOE3/4), la cible LDL est plus stricte que la population générale. À 111 mg/dL tu dépasses le
                  seuil longévité (&lt; 70 pour porteur APOE4).
                  <br />
                  <br />
                  Priorité : ApoB &lt; 80, index oméga-3 &gt; 8 %, et discuter une statine faible dose avec ton médecin.
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* How it reads your data — zig-zag */}
        <section id="lit" className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
          <Reveal className="max-w-2xl mb-14">
            <div className="eyebrow font-mono">Ce que Vitals fait de tes données</div>
            <h2 className="mt-3 text-3xl md:text-[2.4rem] font-bold tracking-[-0.03em] leading-tight text-balance">
              Chaque chiffre est rattaché à ton dossier, pas à une moyenne.
            </h2>
            <p className="mt-3 text-muted-foreground">Trois lectures qui parlent entre elles : le sang, les gènes, le quotidien.</p>
          </Reveal>

          <div className="space-y-6">
            {/* 1 — bloodwork + trend sparkline */}
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center py-6">
              <Reveal>
                <div className="eyebrow font-mono">Bilans + IA</div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Importe un PDF, récupère une lecture.</h3>
                <p className="mt-3 text-foreground/80 leading-relaxed max-w-lg">
                  L&apos;IA détecte chaque marqueur, le classe par système, et compare deux prises pour mesurer
                  l&apos;effet d&apos;une intervention — pas juste « dans la norme / hors norme ».
                </p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {["Détection PDF, photo ou saisie manuelle", "Comparaison entre deux bilans : qu'est-ce qui a bougé ?", "Vue praticien imprimable pour ton vrai médecin"].map(
                    (t) => (
                      <li key={t} className="flex gap-2.5 text-foreground/80">
                        <span className="font-mono text-emerald">→</span> {t}
                      </li>
                    ),
                  )}
                </ul>
              </Reveal>
              <WidgetCard cap="Ferritine · 5 dernières prises">
                <svg viewBox="0 0 320 84" className="w-full h-20 text-emerald" preserveAspectRatio="none" aria-label="Tendance ferritine en hausse">
                  <defs>
                    <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="currentColor" stopOpacity="0.28" />
                      <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,66 L64,58 L128,60 L192,40 L256,30 L320,18 L320,84 L0,84 Z" fill="url(#spark)" />
                  <path d="M0,66 L64,58 L128,60 L192,40 L256,30 L320,18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="320" cy="18" r="4" fill="currentColor" />
                </svg>
                <div className="mt-2 flex justify-between font-mono text-[11px] tabular-nums">
                  <span className="text-muted-foreground">34 → 68 µg/L</span>
                  <span className="text-emerald">▲ +100 % / 14 mois</span>
                </div>
              </WidgetCard>
            </div>

            {/* 2 — DNA + SNP table */}
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center py-6">
              <WidgetCard cap="Variants pertinents · aujourd'hui" className="md:order-first">
                <div className="divide-y divide-border">
                  {[
                    { g: "MTHFR", v: "C677T · AG", chip: "folate méthylé", tone: "watch" },
                    { g: "COMT", v: "V158M · AA", chip: "catéchol lent", tone: "watch" },
                    { g: "APOE", v: "rs429358 · CT", chip: "LDL strict", tone: "watch" },
                    { g: "FTO", v: "rs9939609 · TT", chip: "favorable", tone: "ok" },
                  ].map((r) => (
                    <div key={r.g} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="font-mono font-semibold">
                        {r.g} <span className="text-muted-foreground font-normal text-xs">{r.v}</span>
                      </span>
                      <span
                        className={`font-mono text-[10.5px] px-2 py-0.5 rounded ${
                          r.tone === "ok" ? "text-emerald bg-emerald/10" : "text-amber-500 bg-amber-500/10"
                        }`}
                      >
                        {r.chip}
                      </span>
                    </div>
                  ))}
                </div>
              </WidgetCard>
              <Reveal>
                <div className="eyebrow font-mono">ADN + Suppléments</div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">160+ variants extraits de ton 23andMe.</h3>
                <p className="mt-3 text-foreground/80 leading-relaxed max-w-lg">
                  Recommandations rattachées à tes vrais génotypes — et surtout, les suppléments à éviter selon tes
                  variants. Un import à vie suffit.
                </p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {["Méthylation, détox, réponse aux nutriments", "Bilan nutritionnel quotidien vs cible longévité", "Alertes d'interaction supplément × génotype"].map((t) => (
                    <li key={t} className="flex gap-2.5 text-foreground/80">
                      <span className="font-mono text-emerald">→</span> {t}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            {/* 3 — Longevity plan + score dial */}
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center py-6">
              <Reveal>
                <div className="eyebrow font-mono">Plan d&apos;action longévité</div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Un score quotidien, trois leviers.</h3>
                <p className="mt-3 text-foreground/80 leading-relaxed max-w-lg">
                  Sommeil, sport, nutrition. Chaque action est priorisée et reliée à un biomarqueur réel — pas des
                  conseils génériques recopiés d&apos;un blog.
                </p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {["Score 0–100 recalculé chaque jour", "Actions classées par impact attendu", "Rappels santé personnalisés"].map((t) => (
                    <li key={t} className="flex gap-2.5 text-foreground/80">
                      <span className="font-mono text-emerald">→</span> {t}
                    </li>
                  ))}
                </ul>
              </Reveal>
              <WidgetCard cap="Vitals Score · aujourd'hui">
                <div className="flex items-center gap-5">
                  <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0 text-emerald" aria-label="Score 74 sur 100">
                    <circle cx="48" cy="48" r="40" fill="none" className="text-secondary" stroke="currentColor" strokeWidth="8" />
                    <circle
                      cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray="251.2" strokeDashoffset="65" transform="rotate(-90 48 48)"
                    />
                  </svg>
                  <div>
                    <div className="font-mono tabular-nums text-4xl font-bold tracking-tight">
                      74<span className="text-base text-muted-foreground font-normal">/100</span>
                    </div>
                    <div className="mt-1 space-y-1 text-[13px] text-foreground/80">
                      <div>
                        sommeil <span className="font-mono text-emerald">+6</span> · sport{" "}
                        <span className="font-mono text-emerald">+4</span>
                      </div>
                      <div>
                        nutrition <span className="font-mono text-amber-500">−3</span> oméga-3 bas
                      </div>
                    </div>
                  </div>
                </div>
              </WidgetCard>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="prix" className="max-w-5xl mx-auto px-6 py-20 border-t border-border">
          <Reveal className="mb-12">
            <div className="eyebrow font-mono">Tarifs</div>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-[-0.03em]">Simple, et honnête.</h2>
            <p className="mt-3 text-muted-foreground">Bêta privée gratuite jusqu&apos;au lancement officiel.</p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-5">
            <HoverCard className="rounded-2xl border border-border bg-card p-6 flex flex-col">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Free</div>
              <div className="mt-2 font-mono tabular-nums text-4xl font-bold tracking-tight">
                0 €<span className="text-base text-muted-foreground font-normal"> / mois</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground mb-5">L&apos;essentiel pour démarrer ton dossier</p>
              <ul className="space-y-2.5 text-sm text-foreground/80 mb-6">
                {["1 bilan sanguin / mois", "ADN illimité (1 import à vie)", "5 questions chat / jour", "Vue praticien imprimable"].map((t) => (
                  <li key={t}>
                    <span className="text-emerald font-semibold">✓</span> {t}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-auto text-center px-4 py-2.5 rounded-lg border border-border hover:bg-secondary/50 active:translate-y-px transition font-medium">
                Commencer gratuitement
              </Link>
            </HoverCard>
            <HoverCard className="relative rounded-2xl border-2 border-emerald bg-emerald/5 p-6 flex flex-col">
              <span className="absolute -top-2.5 left-6 font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded bg-emerald text-primary-foreground">
                recommandé
              </span>
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald">Pro</div>
              <div className="mt-2 font-mono tabular-nums text-4xl font-bold tracking-tight">
                9 €<span className="text-base text-muted-foreground font-normal"> / mois</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground mb-5">Pour optimiser ta longévité</p>
              <ul className="space-y-2.5 text-sm text-foreground/80 mb-6">
                {[
                  "Bilans illimités + comparaison",
                  "Chat illimité avec l'équipe médicale",
                  "Sync wearables (Whoop, Oura, Apple Health)",
                  "Plan d'action quotidien + rappels",
                  "Partage médecin par lien sécurisé",
                ].map((t) => (
                  <li key={t}>
                    <span className="text-emerald font-semibold">✓</span> {t}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-auto text-center px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 active:translate-y-px transition">
                Rejoindre la bêta
              </Link>
            </HoverCard>
          </div>
        </section>

        {/* CTA band */}
        <section className="border-y border-border bg-card">
          <Reveal className="max-w-3xl mx-auto px-6 py-20 text-center">
            <h2 className="text-3xl md:text-[2.6rem] font-bold tracking-[-0.035em] text-balance">
              Cinq minutes pour tout centraliser.
            </h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Crée ton compte, importe un premier bilan, et pose ta première question comme à un médecin qui aurait
              déjà tout ton dossier sous les yeux.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Press className="inline-flex">
                <Link href="/signup" className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition">
                  Créer mon compte <ArrowRight className="h-4 w-4" />
                </Link>
              </Press>
              <Press className="inline-flex">
                <Link href="/login?demo=1" className="px-5 py-3 rounded-lg border border-border bg-background hover:bg-secondary/50 transition font-medium">
                  Voir la démo
                </Link>
              </Press>
            </div>
          </Reveal>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <VitalsWordmark className="mb-3" />
            <p className="text-muted-foreground text-xs leading-relaxed max-w-[26ch]">
              La plateforme de santé personnelle. Hébergement UE, données chiffrées. Vitals n&apos;est pas un
              dispositif médical.
            </p>
          </div>
          <div>
            <div className="font-semibold mb-3">Produit</div>
            <ul className="space-y-2 text-muted-foreground">
              <li><Link href="#lit" className="hover:text-foreground transition">Fonctionnalités</Link></li>
              <li><Link href="#prix" className="hover:text-foreground transition">Tarifs</Link></li>
              <li><Link href="/login" className="hover:text-foreground transition">Se connecter</Link></li>
              <li><Link href="/about" className="hover:text-foreground transition">À propos</Link></li>
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
              <li className="font-mono">contact@vitals.club</li>
              <li>RGPD compliant</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Vitals. Vitals n&apos;est pas un dispositif médical. Consulte ton médecin avant
          toute décision de santé.
        </div>
      </footer>
    </div>
  );
}
