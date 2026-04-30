"use client";

import { useEffect, useState, useCallback } from "react";

type SubRow = {
  id: number;
  endpoint: string;
  user_agent: string | null;
  created_at: number;
  last_used_at: number | null;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  // Allocate a plain ArrayBuffer (not SharedArrayBuffer) so the typed array satisfies BufferSource.
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

function shortEndpoint(endpoint: string): string {
  try {
    const u = new URL(endpoint);
    const tail = endpoint.slice(-12);
    return `${u.host} · …${tail}`;
  } catch {
    return endpoint.slice(0, 60) + "…";
  }
}

function deviceLabel(ua: string | null): string {
  if (!ua) return "Appareil inconnu";
  if (/iphone/i.test(ua)) return "iPhone";
  if (/ipad/i.test(ua)) return "iPad";
  if (/android/i.test(ua)) return "Android";
  if (/mac/i.test(ua) && /safari/i.test(ua) && !/chrome/i.test(ua)) return "Safari macOS";
  if (/chrome/i.test(ua) && /mac/i.test(ua)) return "Chrome macOS";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/edg/i.test(ua)) return "Edge";
  if (/chrome/i.test(ua)) return "Chrome";
  return "Navigateur";
}

export function PushPanel() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unknown">("unknown");
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/push/subscribe", { method: "GET" });
      if (r.ok) {
        const d = await r.json();
        setSubs(d.rows ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (ok) {
      setPermission(Notification.permission);
      refresh();
    }
  }, [refresh]);

  async function enable() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") throw new Error("Permission refusée par le navigateur.");

      const keyRes = await fetch("/api/push/key");
      const keyJson = await keyRes.json();
      if (!keyRes.ok || !keyJson.publicKey) throw new Error(keyJson.error || "Clé VAPID indisponible.");

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const appServerKey = urlBase64ToUint8Array(keyJson.publicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey as BufferSource,
        });
      }
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const r = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Échec d'enregistrement.");
      setMsg("Notifications push activées sur cet appareil.");
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch("/api/push/test", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erreur");
      setMsg(`Test envoyé (${d.sent}/${d.total}).`);
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number, endpoint: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Erreur");
      // Best-effort: also unsubscribe locally if it's this device
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const local = await reg?.pushManager.getSubscription();
        if (local && local.endpoint === endpoint) await local.unsubscribe();
      } catch {}
      setMsg("Appareil révoqué.");
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (supported === null) return null;

  return (
    <section className="glass border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Notifications push</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Reçois tes rappels (suppléments, RDV, biomarqueurs) directement dans le navigateur, même quand
            l'onglet est fermé.
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-md ${
            subs.length > 0
              ? "bg-emerald/10 text-emerald border border-emerald/30"
              : "bg-secondary text-muted-foreground border border-border"
          }`}
        >
          {subs.length > 0 ? `Activées · ${subs.length} appareil${subs.length > 1 ? "s" : ""}` : "Désactivées"}
        </span>
      </div>

      {!supported && (
        <div className="text-sm px-3 py-2 rounded-md bg-secondary border border-border text-muted-foreground">
          Ce navigateur ne supporte pas les notifications push (essaye Chrome, Firefox, Edge, ou Safari iOS 16.4+
          en PWA installée).
        </div>
      )}
      {err && (
        <div className="text-sm px-3 py-2 rounded-md bg-destructive/15 border border-destructive/30 text-destructive">
          {err}
        </div>
      )}
      {msg && (
        <div className="text-sm px-3 py-2 rounded-md bg-emerald/10 border border-emerald/30 text-emerald">
          {msg}
        </div>
      )}

      {supported && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={enable}
            disabled={busy}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-4 py-2 rounded-md transition disabled:opacity-50"
          >
            {busy ? "…" : "Activer les notifications push"}
          </button>
          <button
            onClick={sendTest}
            disabled={busy || subs.length === 0}
            className="px-4 py-2 rounded-md border border-border hover:bg-secondary transition disabled:opacity-50"
          >
            Tester
          </button>
        </div>
      )}

      {permission === "denied" && (
        <p className="text-xs text-muted-foreground">
          Les notifications sont bloquées au niveau du navigateur. Autorise-les dans les paramètres du site.
        </p>
      )}

      {subs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Appareils enregistrés</h3>
          <ul className="divide-y divide-border/50 border border-border rounded-md">
            {subs.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{deviceLabel(s.user_agent)}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{shortEndpoint(s.endpoint)}</div>
                  <div className="text-[10px] text-muted-foreground/70">
                    Ajouté le {new Date(s.created_at).toLocaleString("fr-FR")}
                  </div>
                </div>
                <button
                  onClick={() => revoke(s.id, s.endpoint)}
                  disabled={busy}
                  className="text-xs px-2 py-1 rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 transition disabled:opacity-50"
                >
                  Révoquer
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
