"use client";
import { useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";

export function TopBar({ email }: { email: string }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <header className="h-14 border-b border-border flex items-center px-6 md:px-10 gap-4 bg-background/80 backdrop-blur sticky top-0 z-40">
      <div className="flex-1 max-w-md relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          placeholder="Search biomarkers, files, DNA…"
          className="w-full bg-secondary/40 border border-border rounded-md pl-9 pr-3 py-1.5 text-sm outline-none focus:border-primary transition"
        />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground hidden md:inline">{email}</span>
        <button
          onClick={logout}
          className="p-2 rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition"
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
