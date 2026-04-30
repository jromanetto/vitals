"use client";
import { useRouter } from "next/navigation";
import { Sparkles, LogOut } from "lucide-react";

export function DemoBanner() {
  const router = useRouter();

  async function exitDemo(target: string) {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push(target);
    router.refresh();
  }

  return (
    <div className="sticky top-0 z-50 bg-amber-500/95 text-amber-950 border-b border-amber-700 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium">
            Mode démo · Patient fictif · Tu peux explorer mais pas modifier
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => exitDemo("/")}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-100/30 text-amber-950 text-xs font-medium hover:bg-amber-100/50 transition"
          >
            <LogOut className="h-3 w-3" /> Quitter la démo
          </button>
          <button
            onClick={() => exitDemo("/signup")}
            className="px-3 py-1 rounded-md bg-amber-950 text-amber-50 text-xs font-semibold hover:bg-amber-900 transition"
          >
            Créer mon compte
          </button>
        </div>
      </div>
    </div>
  );
}
