"use client";
import { motion } from "framer-motion";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <motion.div
      animate={{ opacity: [0.5, 0.9, 0.5] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      className={`bg-secondary/40 rounded ${className}`}
    />
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 border-t border-border">
      <Skeleton className="h-4 flex-1 max-w-[180px]" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-14" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-4 w-20" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Skeleton className="h-5 w-32 mb-3" />
      <Skeleton className="h-3 w-full mb-1.5" />
      <Skeleton className="h-3 w-4/5 mb-1.5" />
      <Skeleton className="h-3 w-3/5 mb-3" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonChat() {
  return (
    <div className="space-y-2">
      <div className="flex justify-end"><Skeleton className="h-12 w-2/3 rounded-xl" /></div>
      <div className="flex justify-start"><Skeleton className="h-20 w-3/4 rounded-xl" /></div>
    </div>
  );
}
