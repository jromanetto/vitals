"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart3, Sparkles, Target, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab =
  | { kind: "link"; href: string; label: string; icon: React.ComponentType<{ className?: string }>; matchPrefix?: boolean }
  | { kind: "action"; label: string; icon: React.ComponentType<{ className?: string }>; onClick: () => void };

export function BottomNav() {
  const pathname = usePathname();

  const tabs: Tab[] = [
    { kind: "link", href: "/", label: "Dashboard", icon: Home },
    { kind: "link", href: "/biomarkers", label: "Bilan", icon: BarChart3, matchPrefix: true },
    { kind: "link", href: "/chat", label: "Chat", icon: Sparkles, matchPrefix: true },
    { kind: "link", href: "/action-plan", label: "Plan", icon: Target, matchPrefix: true },
    {
      kind: "action",
      label: "Plus",
      icon: MoreHorizontal,
      onClick: () => window.dispatchEvent(new Event("open-mobile-drawer")),
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[60px] bg-card/95 backdrop-blur border-t border-border flex items-stretch"
      aria-label="Navigation principale"
    >
      {tabs.map((t, i) => {
        const Icon = t.icon;
        const active =
          t.kind === "link" &&
          (t.matchPrefix
            ? pathname === t.href || pathname.startsWith(t.href + "/") || pathname === t.href
            : pathname === t.href);

        const className = cn(
          "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
          active ? "text-emerald" : "text-muted-foreground hover:text-foreground"
        );

        if (t.kind === "link") {
          return (
            <Link key={i} href={t.href} className={className} aria-current={active ? "page" : undefined}>
              <Icon className="h-5 w-5" />
              <span>{t.label}</span>
            </Link>
          );
        }
        return (
          <button key={i} onClick={t.onClick} className={className} aria-label={t.label}>
            <Icon className="h-5 w-5" />
            <span>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
