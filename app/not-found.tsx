import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-10 text-center">
        <div className="text-xs uppercase tracking-widest text-emerald mb-2">404</div>
        <h1 className="text-2xl font-semibold tracking-tight mb-3">Page introuvable</h1>
        <p className="text-sm text-muted-foreground mb-7">Cette page n'existe pas ou a été déplacée.</p>
        <Link href="/" className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 inline-block">
          Retour au dashboard
        </Link>
      </div>
    </div>
  );
}
