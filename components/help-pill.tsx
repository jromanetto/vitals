"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { HelpCircle, ArrowRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  question: string;
  label?: string;
  title?: string;
  explanation?: string;
};

export function HelpPill({ question, label = "Demander à l'équipe médicale", title, explanation }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const href = `/chat?ask=${encodeURIComponent(question)}`;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  // No explanation → keep direct-link behavior
  if (!explanation) {
    return (
      <Link
        href={href}
        title={label}
        aria-label={label}
        className="inline-flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground/60 hover:text-emerald hover:bg-emerald/10 transition shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </Link>
    );
  }

  return (
    <span ref={ref} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((o) => !o); }}
        title={label}
        aria-label={label}
        aria-expanded={open}
        className={`inline-flex items-center justify-center h-4 w-4 rounded-full transition ${open ? "text-emerald bg-emerald/15" : "text-muted-foreground/60 hover:text-emerald hover:bg-emerald/10"}`}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -2, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-5 z-50 w-72 rounded-xl border border-border bg-card shadow-2xl shadow-black/40 backdrop-blur-md p-3 space-y-2 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="text-sm font-semibold leading-tight">{title}</div>
            )}
            <p className="text-xs text-muted-foreground leading-relaxed">{explanation}</p>
            <Link
              href={href}
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-xs text-emerald hover:underline pt-1"
            >
              <Sparkles className="h-3 w-3" /> En savoir plus avec l&apos;équipe médicale <ArrowRight className="h-3 w-3" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
