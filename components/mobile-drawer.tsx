"use client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu, X,
  LayoutDashboard, Activity, Dna, FileText, Clock, MessageSquare,
  User, Pill, GitMerge, Upload, StickyNote, Brain, Shield, CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type Group = { label: string | null; items: Item[] };

const groups: Group[] = [
  {
    label: null,
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Santé",
    items: [
      { href: "/biomarkers", label: "Biomarqueurs", icon: Activity },
      { href: "/dna", label: "DNA", icon: Dna },
      { href: "/weekly", label: "Bilan semaine", icon: CalendarCheck },
      { href: "/supplements", label: "Suppléments", icon: Pill },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/chat", label: "Équipe médicale", icon: MessageSquare },
      { href: "/reports", label: "Rapports", icon: FileText },
      { href: "/correlations", label: "Corrélations", icon: GitMerge },
      { href: "/timeline", label: "Timeline", icon: Clock },
    ],
  },
  {
    label: "Données",
    items: [
      { href: "/notes", label: "Notes", icon: StickyNote },
      { href: "/memory", label: "Memory", icon: Brain },
      { href: "/import", label: "Import", icon: Upload },
    ],
  },
  {
    label: "Compte",
    items: [
      { href: "/profile", label: "Profil", icon: User },
      { href: "/profile/security", label: "Sécurité", icon: Shield },
    ],
  },
];

export function MobileDrawer() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  // Portal target only exists on the client.
  useEffect(() => { setMounted(true); }, []);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Open via global event (so the BottomNav "Plus" tab can trigger it)
  useEffect(() => {
    function onOpen() { setOpen(true); }
    window.addEventListener("open-mobile-drawer", onOpen);
    return () => window.removeEventListener("open-mobile-drawer", onOpen);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden p-2 rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition"
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mounted && createPortal(
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] bg-card border-r border-border flex flex-col md:hidden shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navigation"
            >
              <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-emerald" />
                  <span className="text-lg font-semibold tracking-tight">Vitals</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="flex-1 px-3 py-2 overflow-y-auto scrollbar-thin">
                {groups.map((g, gi) => (
                  <div key={gi} className={gi > 0 ? "mt-4" : ""}>
                    {g.label && (
                      <div className="px-3 mb-1 text-[0.65rem] uppercase tracking-wider text-muted-foreground/60 font-medium">
                        {g.label}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {g.items.map((it) => {
                        const active =
                          pathname === it.href ||
                          (it.href !== "/" && pathname.startsWith(it.href));
                        const Icon = it.icon;
                        return (
                          <Link
                            key={it.href}
                            href={it.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                              active
                                ? "bg-secondary text-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span>{it.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="px-6 py-4 border-t border-border text-xs text-muted-foreground">
                Beta · build {process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>,
      document.body
      )}
    </>
  );
}
