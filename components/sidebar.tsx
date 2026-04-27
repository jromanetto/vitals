"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Activity, Dna, FileText, Clock, BookOpen, MessageSquare, User, Pill, HeartPulse, ListChecks, GitMerge, Upload, StickyNote, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/biomarkers", label: "Biomarkers", icon: Activity },
  { href: "/dna", label: "DNA Analysis", icon: Dna },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/correlations", label: "Corrélations", icon: GitMerge },
  { href: "/notes", label: "Notes", icon: StickyNote },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/chat", label: "Panel médical", icon: MessageSquare },
  { href: "/memory", label: "Memory", icon: Brain },
  { href: "/supplements", label: "Suppléments", icon: Pill },
  { href: "/symptoms", label: "Symptômes", icon: HeartPulse },
  { href: "/habits", label: "Habitudes", icon: ListChecks },
  { href: "/import", label: "Import wearables", icon: Upload },
  { href: "/profile", label: "Profile", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 flex-col border-r border-border bg-card/30 sticky top-0 h-screen">
      <div className="px-6 pt-7 pb-4 flex items-center gap-2.5">
        <div className="h-2 w-2 rounded-full bg-emerald" />
        <span className="text-lg font-semibold tracking-tight">Vitals</span>
      </div>
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {items.map((it) => {
          const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href));
          const Icon = it.icon;
          return (
            <Link key={it.href} href={it.href}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}>
              {active && (
                <motion.span layoutId="sidebar-active" className="absolute inset-0 bg-secondary rounded-md"
                             transition={{ type: "spring", stiffness: 380, damping: 30 }} />
              )}
              <Icon className="relative h-4 w-4 shrink-0" />
              <span className="relative">{it.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t border-border text-xs text-muted-foreground">
        Beta · build {process.env.NEXT_PUBLIC_BUILD_ID ?? "dev"}
      </div>
    </aside>
  );
}
