"use client";
import { useRouter } from "next/navigation";
import { LogOut, Search, Command } from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileDrawer } from "@/components/mobile-drawer";

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
      <header className="h-16 border-b border-border flex items-center px-4 md:px-12 gap-3 md:gap-4 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <MobileDrawer />
        <button onClick={openPalette} className="flex-1 max-w-md flex items-center gap-2 bg-secondary/40 border border-border rounded-lg px-3.5 py-2 text-sm text-muted-foreground hover:border-primary/40 hover:bg-secondary/60 transition">
          <Search className="h-4 w-4" />
          <span>Rechercher…</span>
          <span className="ml-auto hidden sm:flex items-center gap-0.5 text-[10px]">
            <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border"><Command className="h-2.5 w-2.5 inline" /></kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border">K</kbd>
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
