"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Activity, Dna, FileText, Clock, MessageSquare,
  User, Pill, GitMerge, Upload, StickyNote, Brain, Shield, Bell, IdCard, CheckSquare, CalendarCheck,
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
      { href: "/weekly", label: "Bilan semaine", icon: CalendarCheck },
      { href: "/stack", label: "Stack", icon: Pill },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/todo", label: "À faire", icon: CheckSquare },
      { href: "/chat", label: "Équipe médicale", icon: MessageSquare },
      { href: "/reports", label: "Rapports & vue praticien", icon: FileText },
      { href: "/correlations", label: "Corrélations", icon: GitMerge },
      { href: "/timeline", label: "Timeline", icon: Clock },
    ],
  },
  {
    label: "Données",
    items: [
      { href: "/data/profile", label: "Profil santé", icon: IdCard },
      { href: "/notes", label: "Notes", icon: StickyNote },
      { href: "/memory", label: "Memory", icon: Brain },
      { href: "/import", label: "Import", icon: Upload },
    ],
  },
  {
    label: "Compte",
    items: [
      { href: "/profile", label: "Compte", icon: User },
      { href: "/reminders", label: "Rappels", icon: Bell },
      { href: "/profile/security", label: "Sécurité", icon: Shield },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card/40 sticky top-0 h-screen">
      <div className="px-6 pt-8 pb-5 flex items-center gap-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-emerald shadow-[0_0_8px_rgb(16_185_129_/_0.4)]" />
        <span className="text-lg font-semibold tracking-tight">Vitals</span>
      </div>
      <nav className="flex-1 px-3 py-2 overflow-y-auto scrollbar-thin">
        {groups.map((g, gi) => (
          <div key={gi} className={gi > 0 ? "mt-6" : ""}>
            {g.label && (
              <div className="px-3 mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70 font-medium">
                {g.label}
              </div>
            )}
            <div className="space-y-1">
              {g.items.map((it) => {
                const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href));
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={cn(
                      "relative flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm transition-colors",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="sidebar-active"
                        className="absolute inset-0 bg-secondary rounded-lg"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <Icon className={cn("relative h-4 w-4 shrink-0 transition-colors", active && "text-emerald")} />
                    <span className="relative">{it.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-6 py-4 border-t border-border text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
        Beta · {process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}
      </div>
    </aside>
  );
}
