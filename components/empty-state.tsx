import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon, title, description, ctaHref, ctaLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-12 text-center space-y-3">
      <div className="h-12 w-12 mx-auto rounded-full bg-secondary/40 flex items-center justify-center">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
      </div>
      <div className="text-base font-medium tracking-tight">{title}</div>
      <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">{description}</p>
      {ctaHref && (
        <Link href={ctaHref}
              className="inline-flex mt-2 items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          {ctaLabel ?? "Démarrer →"}
        </Link>
      )}
    </div>
  );
}
