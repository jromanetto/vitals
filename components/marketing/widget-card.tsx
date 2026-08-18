"use client";
/** Data-widget shell: bordered card with a mono caption, revealed + lifted on
 * hover via Framer Motion. */
import * as React from "react";
import { HoverCard } from "@/components/marketing/motion";

export function WidgetCard({
  cap,
  children,
  className,
}: {
  cap: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <HoverCard className={`rounded-2xl border border-border bg-card p-5 shadow-xl ${className ?? ""}`}>
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-4">{cap}</div>
      {children}
    </HoverCard>
  );
}
