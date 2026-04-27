"use client";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, MapPin, Wind, Sun, Globe } from "lucide-react";
import { COUNTRIES, COUNTRY_BY_CODE } from "@/lib/countries";

export type ResidencePeriod = {
  countryCode: string;
  city: string;
  region?: string;
  from?: string; // YYYY or YYYY-MM
  to?: string;   // YYYY or YYYY-MM, empty = present
};

const AQI_COLORS = {
  excellent: "bg-emerald/15 text-emerald border-emerald/30",
  bonne: "bg-emerald/10 text-emerald border-emerald/25",
  moyenne: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  mauvaise: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "très mauvaise": "bg-red-500/15 text-red-400 border-red-500/30",
} as const;

const UV_COLORS = {
  faible: "bg-emerald/15 text-emerald border-emerald/30",
  modéré: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  élevé: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "très élevé": "bg-red-500/15 text-red-400 border-red-500/30",
  extrême: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
} as const;

export function EnvironmentSection({
  current, history, occupation, workEnvironment, toxicExposure,
  onChange,
}: {
  current: ResidencePeriod;
  history: ResidencePeriod[];
  occupation: string;
  workEnvironment: string;
  toxicExposure: string;
  onChange: (patch: { currentLocation?: ResidencePeriod; residenceHistory?: ResidencePeriod[]; occupation?: string; workEnvironment?: string; toxicExposure?: string }) => void;
}) {
  const [countryFilter, setCountryFilter] = useState("");
  const filtered = useMemo(
    () => COUNTRIES.filter((c) => c.name.toLowerCase().includes(countryFilter.toLowerCase()) || c.code.toLowerCase().includes(countryFilter.toLowerCase())),
    [countryFilter],
  );

  const currentCountry = current.countryCode ? COUNTRY_BY_CODE[current.countryCode] : null;

  function setCurrent(patch: Partial<ResidencePeriod>) {
    onChange({ currentLocation: { ...current, ...patch } });
  }
  function addPast() {
    onChange({ residenceHistory: [...history, { countryCode: "", city: "", from: "", to: "" }] });
  }
  function updatePast(i: number, patch: Partial<ResidencePeriod>) {
    const next = [...history];
    next[i] = { ...next[i], ...patch };
    onChange({ residenceHistory: next });
  }
  function removePast(i: number) {
    onChange({ residenceHistory: history.filter((_, idx) => idx !== i) });
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-border bg-card p-6 space-y-5"
      id="environment"
    >
      <div>
        <h2 className="text-lg font-medium tracking-tight">Environnement & exposition</h2>
        <p className="text-sm text-muted-foreground mt-1">Lieu de résidence + historique. Climat / pollution / UV dérivés automatiquement.</p>
      </div>

      {/* CURRENT LOCATION */}
      <div className="space-y-3">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <MapPin className="h-3 w-3" /> Résidence actuelle
        </h3>
        <CountryCombobox value={current.countryCode} onChange={(code) => setCurrent({ countryCode: code })} placeholder="Sélectionner un pays…" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input type="text" placeholder="Ville (ex: Ixelles)" value={current.city ?? ""} onChange={(e) => setCurrent({ city: e.target.value })}
                 className="bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
          <input type="text" placeholder="Région / quartier (optionnel)" value={current.region ?? ""} onChange={(e) => setCurrent({ region: e.target.value })}
                 className="bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
        <input type="text" placeholder="Depuis (ex: 2018 ou 2018-09)" value={current.from ?? ""} onChange={(e) => setCurrent({ from: e.target.value })}
               className="w-full md:w-1/2 bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />

        {/* DERIVED ATTRIBUTES */}
        {currentCountry && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      className="rounded-md bg-secondary/20 border border-border/50 p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-emerald flex items-center gap-1.5">
              <Globe className="h-3 w-3" /> Dérivé automatiquement de {currentCountry.flag} {currentCountry.name}
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-secondary/60 border border-border">🌡 {currentCountry.climate}</span>
              <span className={`px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${AQI_COLORS[currentCountry.aqiBand]}`}>
                <Wind className="h-2.5 w-2.5" /> AQI {currentCountry.aqiBand}
              </span>
              <span className={`px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${UV_COLORS[currentCountry.uvIndex]}`}>
                <Sun className="h-2.5 w-2.5" /> UV {currentCountry.uvIndex}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-secondary/60 border border-border">📍 {currentCountry.latitudeBand}</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Indications : pollution moyenne PM2.5 (WHO 2021), index UV pic estival (IARC), bande latitudinale (impacte vit D hiver). Saisis "Expositions toxiques" pour spécificités locales.
            </p>
          </motion.div>
        )}
      </div>

      {/* RESIDENCE HISTORY */}
      <div className="space-y-3 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Historique de résidences ({history.length})</h3>
          <button type="button" onClick={addPast} className="text-xs px-2 py-1 rounded-md bg-secondary/40 hover:bg-secondary border border-border inline-flex items-center gap-1">
            <Plus className="h-3 w-3" /> Ajouter
          </button>
        </div>
        {history.length === 0 && <div className="text-xs text-muted-foreground py-2">Pas d'historique.</div>}
        <AnimatePresence>
          {history.map((h, i) => {
            const c = h.countryCode ? COUNTRY_BY_CODE[h.countryCode] : null;
            return (
              <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          className="rounded-md bg-secondary/20 border border-border/40 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-8">#{i + 1}</span>
                  <span className="text-xs">{c ? `${c.flag} ${c.name}` : "—"}</span>
                  <button type="button" onClick={() => removePast(i)} className="ml-auto text-muted-foreground hover:text-red-400" aria-label="Supprimer">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <CountryCombobox value={h.countryCode} onChange={(code) => updatePast(i, { countryCode: code })} placeholder="Pays…" compact />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="Ville" value={h.city ?? ""} onChange={(e) => updatePast(i, { city: e.target.value })}
                         className="bg-secondary/30 border border-border rounded-md px-2 py-1.5 text-xs outline-none focus:border-primary" />
                  <input type="text" placeholder="Région (opt.)" value={h.region ?? ""} onChange={(e) => updatePast(i, { region: e.target.value })}
                         className="bg-secondary/30 border border-border rounded-md px-2 py-1.5 text-xs outline-none focus:border-primary" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" placeholder="De (ex: 2010)" value={h.from ?? ""} onChange={(e) => updatePast(i, { from: e.target.value })}
                         className="bg-secondary/30 border border-border rounded-md px-2 py-1.5 text-xs outline-none focus:border-primary" />
                  <input type="text" placeholder="À (ex: 2018, vide=actuel)" value={h.to ?? ""} onChange={(e) => updatePast(i, { to: e.target.value })}
                         className="bg-secondary/30 border border-border rounded-md px-2 py-1.5 text-xs outline-none focus:border-primary" />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* OCCUPATION + TOXIC */}
      <div className="space-y-3 pt-3 border-t border-border/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Métier</label>
            <input type="text" value={occupation ?? ""} onChange={(e) => onChange({ occupation: e.target.value })}
                   className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Type d'environnement de travail</label>
            <select value={workEnvironment ?? ""} onChange={(e) => onChange({ workEnvironment: e.target.value })}
                    className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary">
              <option value="">—</option>
              <option>Bureau</option><option>Télétravail</option><option>Industriel</option>
              <option>Médical</option><option>Extérieur</option><option>Voyage fréquent</option>
              <option>Mixte</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Expositions toxiques connues</label>
          <textarea value={toxicExposure ?? ""} onChange={(e) => onChange({ toxicExposure: e.target.value })} rows={2}
                    placeholder="Pesticides, fumée passive, amiante, métaux lourds, solvants…"
                    className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
      </div>
    </motion.section>
  );
}

function CountryCombobox({ value, onChange, placeholder, compact }: { value: string; onChange: (code: string) => void; placeholder?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const filtered = useMemo(
    () => COUNTRIES.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()) || c.code.toLowerCase().includes(filter.toLowerCase())),
    [filter],
  );
  const sel = value ? COUNTRY_BY_CODE[value] : null;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
              className={`w-full flex items-center justify-between bg-secondary/40 border border-border rounded-md px-3 ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} text-left hover:border-primary/50 transition`}>
        {sel ? (
          <span className="inline-flex items-center gap-2">
            <span className="text-base leading-none">{sel.flag}</span>
            <span>{sel.name}</span>
            <span className="text-[10px] text-muted-foreground">({sel.code})</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{placeholder ?? "Pays"}</span>
        )}
        <span className="text-muted-foreground text-xs">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-md border border-border bg-card shadow-lg scrollbar-thin">
          <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Rechercher pays…"
                 className="sticky top-0 w-full bg-card border-b border-border px-3 py-2 text-sm outline-none" />
          {filtered.map((c) => (
            <button type="button" key={c.code} onClick={() => { onChange(c.code); setOpen(false); setFilter(""); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-secondary/40">
              <span className="text-base leading-none">{c.flag}</span>
              <span className="flex-1">{c.name}</span>
              <span className="text-[10px] text-muted-foreground">{c.code}</span>
            </button>
          ))}
          {filtered.length === 0 && <div className="px-3 py-4 text-xs text-muted-foreground text-center">Aucun pays.</div>}
        </div>
      )}
    </div>
  );
}
