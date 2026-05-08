"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const STORAGE_KEY = "vitals_onboarding_seen";

type Step = {
  emoji: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
};

function buildSteps(documents: number): Step[] {
  // If the user already imported at least 1 doc but hasn't seen the onboarding modal,
  // push them toward the profile wizard instead of yet another import.
  const firstStep: Step =
    documents >= 1
      ? {
          emoji: "👤",
          title: "Compléter ton profil",
          description:
            "Tu as déjà importé un document. Quelques minutes de profil suffisent pour des analyses sur-mesure.",
          ctaLabel: "Compléter mon profil",
          ctaHref: "/profile?tab=identite",
        }
      : {
          emoji: "🩸",
          title: "Importer ton premier bilan sanguin",
          description:
            "Glisse-dépose un PDF de bilan. On extrait automatiquement chaque biomarqueur et son évolution.",
          ctaLabel: "Importer un bilan",
          ctaHref: "/import",
        };
  return [
    firstStep,
    {
      emoji: "🧬",
      title: "Importer ton ADN 23andMe",
      description:
        "Ton fichier brut 23andMe ou Ancestry débloque des insights génétiques personnalisés.",
      ctaLabel: "Importer mon ADN",
      ctaHref: "/import",
    },
    {
      emoji: "👤",
      title: "Compléter ton profil",
      description:
        "Âge, sexe, antécédents, sport et mode de vie — tout cela affine tes recommandations.",
      ctaLabel: "Compléter mon profil",
      ctaHref: "/profile",
    },
  ];
}

type Props = {
  documents?: number;
  /** Force-show even when localStorage flag is set (for testing). */
  force?: boolean;
};

export function OnboardingModal({ documents = 0, force = false }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (force || (!seen && documents < 3)) {
      // small delay so the dashboard mounts first
      const t = window.setTimeout(() => setOpen(true), 350);
      return () => window.clearTimeout(t);
    }
  }, [documents, force]);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setOpen(false);
  }

  const STEPS = buildSteps(documents);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="onb-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={dismiss}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Skip */}
            <button
              type="button"
              onClick={dismiss}
              className="absolute top-3 right-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label="Passer l'onboarding"
            >
              Passer <X className="h-3.5 w-3.5" aria-hidden />
            </button>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="p-8 pt-12 text-center space-y-4"
              >
                <div className="text-5xl leading-none" aria-hidden>
                  {current.emoji}
                </div>
                <h2 className="text-xl font-semibold tracking-tight">
                  {current.title}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  {current.description}
                </p>
                <div className="pt-3">
                  <Link
                    href={current.ctaHref}
                    onClick={dismiss}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald text-white text-sm font-medium hover:brightness-110 transition focus-visible:ring-2 focus-visible:ring-emerald focus-visible:outline-none"
                  >
                    {current.ctaLabel}
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Dots + nav */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border bg-background/40">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-0 disabled:pointer-events-none"
              >
                ← Précédent
              </button>
              <div className="flex items-center gap-1.5" role="tablist" aria-label="Étapes onboarding">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === step}
                    aria-label={`Étape ${i + 1}`}
                    onClick={() => setStep(i)}
                    className={`h-1.5 rounded-full transition-all ${
                      i === step
                        ? "w-6 bg-emerald"
                        : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                    }`}
                  />
                ))}
              </div>
              {isLast ? (
                <button
                  type="button"
                  onClick={dismiss}
                  className="text-xs font-medium text-emerald hover:brightness-110 transition"
                >
                  Terminer
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                  className="text-xs font-medium text-emerald hover:brightness-110 transition"
                >
                  Suivant →
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
