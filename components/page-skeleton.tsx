"use client";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/skeleton";

type Props = { cards?: number };

export function PageSkeleton({ cards = 4 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Header shimmer mimicking PageHeader */}
      <header className="flex items-start gap-3 pb-2">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </header>

      {/* N rectangular cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04, duration: 0.3 }}
            className="rounded-2xl border border-border bg-card p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
