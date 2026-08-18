"use client";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

export function OAuthConsent(props: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  state: string;
}) {
  const [loading, setLoading] = useState<"approve" | "deny" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function approve() {
    setLoading("approve");
    setErr(null);
    try {
      const r = await fetch("/api/oauth/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(props),
      });
      const d = await r.json();
      if (!r.ok || !d.redirectUrl) throw new Error(d.error || "Échec de l'autorisation");
      window.location.assign(d.redirectUrl);
    } catch (e) {
      setErr((e as Error).message);
      setLoading(null);
    }
  }

  function deny() {
    setLoading("deny");
    try {
      const u = new URL(props.redirectUri);
      u.searchParams.set("error", "access_denied");
      if (props.state) u.searchParams.set("state", props.state);
      window.location.assign(u.toString());
    } catch {
      setLoading(null);
    }
  }

  return (
    <div className="mt-6">
      {err && <div className="mb-3 text-xs text-red-400">{err}</div>}
      <div className="flex gap-3">
        <button
          onClick={approve}
          disabled={loading !== null}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition"
        >
          {loading === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Autoriser
        </button>
        <button
          onClick={deny}
          disabled={loading !== null}
          className="px-4 py-2.5 rounded-lg border border-border hover:bg-secondary/50 disabled:opacity-50 transition font-medium"
        >
          Refuser
        </button>
      </div>
    </div>
  );
}
