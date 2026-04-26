"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutDashboard, Activity, Dna, FileText, Clock, BookOpen, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/biomarkers", label: "Biomarkers", icon: Activity },
  { href: "/dna", label: "DNA Analysis", icon: Dna },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
  { href: "/profile", label: "Profile", icon: User },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button onClick={() => setOpen(true)} className="md:hidden p-2 rounded-md hover:bg-secondary/60" aria-label="Menu">
        <Menu className="h-5 w-5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-64 h-full bg-card border-r border-border flex flex-col"
            >
              <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-emerald" />
                  <span className="text-lg font-semibold tracking-tight">Vitals</span>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Fermer"><X className="h-4 w-4" /></button>
              </div>
              <nav className="flex-1 px-3 py-2 space-y-0.5">
                {items.map((it) => {
                  const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href));
                  const Icon = it.icon;
                  return (
                    <Link
                      key={it.href} href={it.href} onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{it.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
