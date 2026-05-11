"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Save, User } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SECTIONS, completion, type Section } from "@/components/profile-form";
import { IdentiteSection, IDENTITE_SECTION_IDS } from "./sections/identite";
import { MedicalSection, MEDICAL_SECTION_IDS } from "./sections/medical";
import { FamilleSection, FAMILLE_SECTION_IDS } from "./sections/famille";
import { EnvironnementSection, ENVIRONNEMENT_SECTION_IDS } from "./sections/environnement";
import { LifestyleSection, LIFESTYLE_SECTION_IDS } from "./sections/lifestyle";
import { SupplementsSection, SUPPLEMENTS_SECTION_IDS } from "./sections/supplements";
import { SymptomesSection, SYMPTOMES_SECTION_IDS } from "./sections/symptomes";
import { ScreeningSection, SCREENING_SECTION_IDS } from "./sections/screening";
import { ReproductionSection, REPRODUCTION_SECTION_IDS } from "./sections/reproduction";
import { ObjectifsSection, OBJECTIFS_SECTION_IDS } from "./sections/objectifs";
import { AutoExtractButton } from "@/components/auto-extract-button";
import { PrefillButton } from "./prefill-button";

type TabId =
  | "identite"
  | "medical"
  | "famille"
  | "symptomes"
  | "screening"
  | "lifestyle"
  | "reproduction"
  | "environnement"
  | "objectifs"
  | "supplements";

type TabDef = {
  id: TabId;
  label: string;
  emoji: string;
  toastLabel: string;
  sectionIds: string[];
};

const ALL_TABS: TabDef[] = [
  { id: "identite", label: "Identité", emoji: "👤", toastLabel: "Identité", sectionIds: IDENTITE_SECTION_IDS },
  { id: "medical", label: "Santé", emoji: "🏥", toastLabel: "Santé", sectionIds: MEDICAL_SECTION_IDS },
  { id: "famille", label: "Famille", emoji: "🧬", toastLabel: "Famille", sectionIds: FAMILLE_SECTION_IDS },
  { id: "symptomes", label: "Symptômes", emoji: "🩺", toastLabel: "Symptômes", sectionIds: SYMPTOMES_SECTION_IDS },
  { id: "screening", label: "Suivi médical", emoji: "📅", toastLabel: "Suivi médical", sectionIds: SCREENING_SECTION_IDS },
  { id: "lifestyle", label: "Lifestyle", emoji: "🏃", toastLabel: "Lifestyle", sectionIds: LIFESTYLE_SECTION_IDS },
  { id: "reproduction", label: "Reproduction", emoji: "🌱", toastLabel: "Reproduction", sectionIds: REPRODUCTION_SECTION_IDS },
  { id: "environnement", label: "Environnement", emoji: "🌍", toastLabel: "Environnement", sectionIds: ENVIRONNEMENT_SECTION_IDS },
  { id: "objectifs", label: "Objectifs", emoji: "🎯", toastLabel: "Objectifs", sectionIds: OBJECTIFS_SECTION_IDS },
  { id: "supplements", label: "Suppléments", emoji: "💊", toastLabel: "Suppléments", sectionIds: SUPPLEMENTS_SECTION_IDS },
  // Sécurité is account-scope (2FA, password, audit log) — lives at /profile/security,
  // not in the health profile wizard.
];

// Reproduction tab is shown for everyone; the section itself filters womens/mens
// sub-sections by data.sex (see ReproductionSection).
const TABS = ALL_TABS;

function tabCompletion(tab: TabDef, data: Record<string, unknown>): number {
  if (tab.id === "environnement") {
    // Use the standard environment heuristic from completion()
    const envSection = SECTIONS.find((s) => s.id === "environment");
    return envSection ? completion(envSection as Section, data) : 0;
  }
  const sections = (SECTIONS as Section[]).filter((s) => tab.sectionIds.includes(s.id));
  if (sections.length === 0) return 0;
  const sum = sections.reduce((a, s) => a + completion(s, data), 0);
  return Math.round(sum / sections.length);
}

function isFilledValue(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v)) {
    if (v.length === 0) return false;
    if (typeof v[0] === "object" && v[0] !== null) {
      return v.some((r: { name?: string }) => r && typeof r.name === "string" && r.name.trim().length > 0);
    }
    return true;
  }
  return true;
}

function overallCompletion(data: Record<string, unknown>): number {
  // Count of filled fields across all (form) sections / total fields
  const all = SECTIONS as Section[];
  let total = 0;
  let filled = 0;
  for (const s of all) {
    if (s.id === "environment") {
      total += 5;
      const cur = data.currentLocation as { countryCode?: string; city?: string } | undefined;
      if (cur?.countryCode) filled++;
      if (cur?.city) filled++;
      if (data.occupation) filled++;
      if (data.workEnvironment) filled++;
      if (data.toxicExposure) filled++;
      continue;
    }
    for (const f of s.fields) {
      total++;
      if (isFilledValue(data[f.id])) filled++;
    }
  }
  return total === 0 ? 0 : Math.round((filled / total) * 100);
}

export function ProfileWizard({ initial }: { initial: Record<string, unknown> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabId) || "identite";
  const validInitial = TABS.some((t) => t.id === initialTab) ? initialTab : "identite";

  const [activeTab, setActiveTab] = useState<TabId>(validInitial);
  const [data, setData] = useState<Record<string, unknown>>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const lastSavedHash = useRef<string>(JSON.stringify(initial));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // URL <-> tab sync
  useEffect(() => {
    const t = (searchParams.get("tab") as TabId) || "identite";
    if (TABS.some((x) => x.id === t) && t !== activeTab) setActiveTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const switchTab = useCallback(
    (id: TabId) => {
      setActiveTab(id);
      router.replace(`/profile?tab=${id}`, { scroll: false });
    },
    [router]
  );

  const saveNow = useCallback(async (toastLabel: string) => {
    const snapshot = dataRef.current;
    const hash = JSON.stringify(snapshot);
    if (hash === lastSavedHash.current) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: hash,
      });
      if (res.ok) {
        lastSavedHash.current = hash;
        setSavedAt(new Date());
        toast.success(`${toastLabel} sauvegardé`);
      } else {
        toast.error("Échec de la sauvegarde");
      }
    } catch {
      toast.error("Erreur réseau lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }, []);

  // Debounced auto-save (800ms after last change). Triggered by any field change.
  const scheduleSave = useCallback(
    (tab: TabId) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const tabDef = TABS.find((t) => t.id === tab) || TABS[0];
      debounceRef.current = setTimeout(() => {
        saveNow(tabDef.toastLabel);
      }, 800);
    },
    [saveNow]
  );

  const onChange = useCallback(
    (id: string, value: unknown) => {
      setData((d) => ({ ...d, [id]: value }));
      scheduleSave(activeTab);
    },
    [activeTab, scheduleSave]
  );

  const onPatch = useCallback(
    (patch: Record<string, unknown>) => {
      setData((d) => ({ ...d, ...patch }));
      scheduleSave(activeTab);
    },
    [activeTab, scheduleSave]
  );

  // Flush pending save on tab switch / unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const overall = useMemo(() => overallCompletion(data), [data]);
  const activeDef = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profil"
        description="Plus tu remplis, plus les analyses et corrélations seront pertinentes. Toutes les infos restent privées et locales."
        icon={<User className="h-5 w-5 text-emerald" />}
        actions={
          <div className="flex items-center gap-2">
            <PrefillButton />
            <AutoExtractButton />
          </div>
        }
      />

      {/* Progress bar */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Progression globale
          </span>
          <span className="text-sm font-medium tabular-nums">{overall}%</span>
        </div>
        <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
          <motion.div
            className="h-full bg-emerald"
            initial={false}
            animate={{ width: `${overall}%` }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar — sticky on md+, horizontal scroll on mobile */}
        <nav
          aria-label="Sections du profil"
          className="md:sticky md:top-20 md:self-start md:max-h-[calc(100vh-6rem)] md:overflow-auto scrollbar-thin"
        >
          <ul className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible -mx-1 px-1 md:mx-0 md:px-0 scrollbar-thin pb-1 md:pb-0">
            {TABS.map((tab) => {
              const pct = tabCompletion(tab, data);
              const isActive = tab.id === activeTab;
              const isDone = pct === 100;
              return (
                <li key={tab.id} className="shrink-0 md:shrink">
                  <button
                    type="button"
                    onClick={() => switchTab(tab.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap transition border ${
                      isActive
                        ? "bg-emerald/10 border-emerald/40 text-emerald"
                        : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {tab.emoji}
                    </span>
                    <span className="flex-1 text-left">{tab.label}</span>
                    {isDone ? (
                      <Check className="h-3.5 w-3.5 text-emerald" />
                    ) : (
                      <span
                        className={`text-[10px] tabular-nums ${
                          pct >= 50 ? "text-amber-400" : "text-muted-foreground"
                        }`}
                      >
                        {pct}%
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Active tab content */}
        <div className="min-w-0 space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeTab === "identite" && (
                <IdentiteSection data={data} onChange={onChange} />
              )}
              {activeTab === "medical" && (
                <MedicalSection data={data} onChange={onChange} />
              )}
              {activeTab === "famille" && (
                <FamilleSection data={data} onChange={onChange} />
              )}
              {activeTab === "symptomes" && (
                <SymptomesSection data={data} onChange={onChange} />
              )}
              {activeTab === "screening" && (
                <ScreeningSection data={data} onChange={onChange} />
              )}
              {activeTab === "lifestyle" && (
                <LifestyleSection data={data} onChange={onChange} />
              )}
              {activeTab === "reproduction" && (
                <ReproductionSection data={data} onChange={onChange} />
              )}
              {activeTab === "environnement" && (
                <EnvironnementSection data={data} onChange={onChange} onPatch={onPatch} />
              )}
              {activeTab === "objectifs" && (
                <ObjectifsSection data={data} onChange={onChange} />
              )}
              {activeTab === "supplements" && (
                <SupplementsSection data={data} onChange={onChange} />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="sticky bottom-4 z-10 flex justify-end">
            <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg flex items-center gap-2 text-xs">
              <AnimatePresence mode="wait">
                {saving ? (
                  <motion.span
                    key="s"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-muted-foreground"
                  >
                    <Save className="h-3 w-3 animate-pulse" /> Enregistrement…
                  </motion.span>
                ) : savedAt ? (
                  <motion.span
                    key="d"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-emerald"
                  >
                    <Check className="h-3 w-3" /> Sauvegarde — {activeDef.toastLabel}
                  </motion.span>
                ) : (
                  <span className="text-muted-foreground">Auto-save activé (800ms)</span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
