"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Pill, Salad } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SupplementsTab } from "@/components/stack/supplements-tab";
import { NutritionTab } from "@/components/stack/nutrition-tab";

type TabKey = "supplements" | "nutrition";

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "supplements", label: "Suppléments", icon: Pill },
  { key: "nutrition", label: "Nutrition", icon: Salad },
];

function StackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = (searchParams.get("tab") as TabKey | null) === "nutrition" ? "nutrition" : "supplements";
  const [tab, setTab] = useState<TabKey>(initial);

  // Keep state in sync if the URL changes (e.g. via sidebar deep link)
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "nutrition" || t === "supplements") {
      if (t !== tab) setTab(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function selectTab(next: TabKey) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`/stack?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Stack"
        description="Compléments et nutrition"
        icon={<Pill className="h-5 w-5 text-emerald" />}
      />

      <div className="sticky top-0 z-30 -mx-6 md:-mx-12 px-6 md:px-12 py-2 bg-background/85 backdrop-blur border-b border-border">
        <nav className="flex gap-1" role="tablist" aria-label="Stack">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => selectTab(t.key)}
                role="tab"
                aria-selected={active}
                className={`relative inline-flex items-center gap-2 px-4 py-2 text-sm transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-emerald" : ""}`} />
                {t.label}
                {active && (
                  <motion.span
                    layoutId="stack-tab"
                    className="absolute inset-x-2 -bottom-2 h-0.5 bg-emerald rounded-full"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === "supplements" ? <SupplementsTab /> : <NutritionTab />}
    </div>
  );
}

export default function StackPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground">Chargement…</div>}>
      <StackInner />
    </Suspense>
  );
}
