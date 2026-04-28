"use client";
import { motion } from "framer-motion";

type Props = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, icon, actions }: Props) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-start justify-between gap-4 flex-wrap pb-2"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="h-10 w-10 rounded-xl border border-border bg-card flex items-center justify-center shadow-sm">
              {icon}
            </div>
          )}
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
        </div>
        {description && <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-3xl">{description}</p>}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </motion.header>
  );
}
