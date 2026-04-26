"use client";
import { useRouter } from "next/navigation";
import { LogOut, Search, Command } from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/mobile-nav";

export function TopBar({ email }: { email: string }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  function openPalette() {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }
  return (
    <>
      <header className="h-14 border-b border-border flex items-center px-4 md:px-10 gap-3 md:gap-4 bg-background/80 backdrop-blur sticky top-0 z-40">
        <MobileNav />
        <button onClick={openPalette} className="flex-1 max-w-md flex items-center gap-2 bg-secondary/40 border border-border rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/50 transition">
          <Search className="h-4 w-4" />
          <span>Rechercher…</span>
          <span className="ml-auto hidden sm:flex items-center gap-0.5 text-[10px]">
            <kbd className="px-1 py-0.5 rounded bg-secondary border border-border"><Command className="h-2.5 w-2.5 inline" /></kbd>
            <kbd className="px-1 py-0.5 rounded bg-secondary border border-border">K</kbd>
          </span>
        </button>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <span className="text-xs text-muted-foreground hidden lg:inline">{email}</span>
          <button onClick={logout} className="p-2 rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition" aria-label="Logout">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <CommandPalette />
    </>
  );
}
