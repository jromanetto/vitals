"use client";
import { useEffect, useState } from "react";
import { Save, Check, Loader2 } from "lucide-react";

export function AccountContact({ initialPhone }: { initialPhone: string }) {
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDirty(phone !== initialPhone);
  }, [phone, initialPhone]);

  async function save() {
    if (!dirty) return;
    setSaving(true);
    try {
      const r = await fetch("/api/profile");
      const d = await r.json();
      const data = { ...(d.data ?? {}), phone };
      const w = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (w.ok) {
        setSavedAt(new Date());
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-xs uppercase tracking-wider text-muted-foreground w-24 flex-shrink-0">
          Téléphone
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={save}
          placeholder="+33 6 12 34 56 78"
          className="flex-1 bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition"
        />
        <div className="w-20 text-right text-xs">
          {saving ? (
            <span className="text-muted-foreground flex items-center gap-1 justify-end">
              <Loader2 className="h-3 w-3 animate-spin" /> Save…
            </span>
          ) : savedAt && !dirty ? (
            <span className="text-emerald flex items-center gap-1 justify-end">
              <Check className="h-3 w-3" /> Enregistré
            </span>
          ) : dirty ? (
            <button
              type="button"
              onClick={save}
              className="text-emerald hover:underline flex items-center gap-1 justify-end"
            >
              <Save className="h-3 w-3" /> Enregistrer
            </button>
          ) : null}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Utilisé pour les rappels SMS (à venir) et pour le contact d&apos;urgence si renseigné dans le profil santé.
      </p>
    </div>
  );
}
