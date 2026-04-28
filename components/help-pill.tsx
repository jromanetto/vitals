"use client";
import Link from "next/link";
import { HelpCircle } from "lucide-react";

/**
 * Small help pill. Clicking it opens the Panel médical with a pre-filled question.
 * The chat page reads the `ask` query param and auto-sends it.
 */
export function HelpPill({ question, label = "Demander au panel médical" }: { question: string; label?: string }) {
  const href = `/chat?ask=${encodeURIComponent(question)}`;
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
