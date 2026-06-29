"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Eye, Check, ChevronDown, Settings, Loader2 } from "lucide-react";

export type ViewContext = {
  selfId: number; selfEmail: string; viewingId: number; viewingSelf: boolean;
  canView: Array<{ id: number; label: string; email: string }>;
};

function initials(label: string): string {
  return label.replace(/@.*/, "").slice(0, 2).toUpperCase();
}

/** Full-width banner shown while consulting another member's data — a constant,
 * unmissable reminder that you're in read-only "view as" mode. */
export function ViewingBanner({ ctx }: { ctx: ViewContext }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (ctx.viewingSelf) return null;
  const member = ctx.canView.find((m) => m.id === ctx.viewingId);

  async function back() {
    setBusy(true);
    try {
      await fetch("/api/household/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subjectId: null }) });
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-2 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-b border-amber-500/30 px-4 md:px-12 py-2 text-sm">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">
        Tu consultes les données de <strong>{member?.label ?? "un proche"}</strong> — lecture seule.
      </span>
      <button onClick={back} disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1 text-xs font-medium disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Revenir à moi
      </button>
    </div>
  );
}

export function ProfileSwitcher({ ctx }: { ctx: ViewContext }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Nothing to switch to and viewing self → just show a quiet "manage" entry point.
  const hasMembers = ctx.canView.length > 0;

  const current = ctx.viewingSelf
    ? { label: "Moi", email: ctx.selfEmail }
    : ctx.canView.find((m) => m.id === ctx.viewingId) ?? { label: "Profil", email: "" };

  async function switchTo(subjectId: number | null) {
    setBusy(true);
    try {
      const r = await fetch("/api/household/view", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId }),
      });
      if (r.ok) { setOpen(false); router.refresh(); }
    } finally { setBusy(false); }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition ${
          ctx.viewingSelf
            ? "border-border bg-secondary/40 hover:bg-secondary/60 text-foreground"
            : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        }`}
        aria-label="Changer de profil"
      >
        {ctx.viewingSelf
          ? <Users className="h-4 w-4 shrink-0" />
          : <Eye className="h-4 w-4 shrink-0" />}
        <span className="max-w-[7rem] truncate font-medium">{current.label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-60 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-50">
          <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">Foyer</div>

          <button
            onClick={() => switchTo(null)}
            disabled={busy}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-secondary/50 transition disabled:opacity-50"
          >
            <span className="grid place-items-center h-7 w-7 rounded-full bg-emerald/15 text-emerald text-[11px] font-semibold">{initials(ctx.selfEmail)}</span>
            <span className="flex-1 text-left truncate">Moi <span className="text-muted-foreground">({ctx.selfEmail})</span></span>
            {ctx.viewingSelf && <Check className="h-4 w-4 text-emerald" />}
          </button>

          {ctx.canView.map((m) => (
            <button
              key={m.id}
              onClick={() => switchTo(m.id)}
              disabled={busy}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-secondary/50 transition disabled:opacity-50"
            >
              <span className="grid place-items-center h-7 w-7 rounded-full bg-secondary text-foreground text-[11px] font-semibold">{initials(m.label)}</span>
              <span className="flex-1 text-left truncate">{m.label}</span>
              {!ctx.viewingSelf && ctx.viewingId === m.id && <Eye className="h-4 w-4 text-amber-500" />}
            </button>
          ))}

          {!hasMembers && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Aucun proche lié pour le moment.</p>
          )}

          <Link
            href="/foyer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary/50 border-t border-border transition"
          >
            <Settings className="h-3.5 w-3.5" /> Gérer le foyer
          </Link>

          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-card/60">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
