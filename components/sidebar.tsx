"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Activity, Dna, FileText, Clock, BookOpen, MessageSquare,
  User, Pill, HeartPulse, ListChecks, GitMerge, Upload, StickyNote, Brain, Shield, Target, Printer, Bell, Salad,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type Group = { label: string | null; items: Item[] };

const groups: Group[] = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Santé",
    items: [
      { href: "/biomarkers", label: "Biomarqueurs", icon: Activity },
      { href: "/dna", label: "DNA", icon: Dna },
      { href: "/symptoms", label: "Symptômes", icon: HeartPulse },
      { href: "/supplements", label: "Suppléments", icon: Pill },
      { href: "/nutrition", label: "Nutrition", icon: Salad },
      { href: "/habits", label: "Habitudes", icon: ListChecks },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/chat", label: "Panel médical", icon: MessageSquare },
      { href: "/reports", label: "Rapports", icon: FileText },
      { href: "/praticien", label: "Vue praticien", icon: Printer },
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
      { href: "/reminders", label: "Rappels", icon: Bell },
      { href: "/profile/security", label: "Sécurité", icon: Shield },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card/30 sticky top-0 h-screen">
      <div className="px-6 pt-7 pb-4 flex items-center gap-2.5">
        <div className="h-2 w-2 rounded-full bg-emerald" />
        <span className="text-lg font-semibold tracking-tight">Vitals</span>
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
                const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href));
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={cn(
                      "relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-0 bg-secondary rounded-md"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <Icon className="relative h-4 w-4 shrink-0" />
                    <span className="relative">{it.label}</span>
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
    </aside>
  );
}
