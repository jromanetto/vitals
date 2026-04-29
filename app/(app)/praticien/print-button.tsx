"use client";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm border border-border bg-card hover:bg-secondary/40 transition-colors"
      aria-label="Imprimer"
    >
      <Printer className="h-4 w-4" />
      Imprimer
    </button>
  );
}
