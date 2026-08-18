"use client";
import { useEffect, useState } from "react";
import { Plug, Copy, Check, Trash2, Loader2, KeyRound, TriangleAlert } from "lucide-react";

type Token = { id: string; name: string | null; createdAt: number; lastUsedAt: number | null };

const MCP_URL = "https://vitals.club/api/mcp";
const fmt = (ts: number) => new Date(ts).toLocaleDateString("fr-FR");

export function McpTokenPanel() {
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null); // plaintext shown once
  const [copied, setCopied] = useState<"token" | "config" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/security/mcp-token");
      const d = await r.json();
      setTokens(d.tokens ?? []);
    } catch {
      setTokens([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setCreating(true);
    setErr(null);
    setFresh(null);
    try {
      const r = await fetch("/api/security/mcp-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Échec de la génération");
      setFresh(d.token);
      setName("");
      load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/security/mcp-token?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  }

  async function copy(text: string, which: "token" | "config") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const configSnippet = `{
  "mcpServers": {
    "vitals": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${MCP_URL}",
        "--header", "Authorization: Bearer <TON_TOKEN>"]
    }
  }
}`;

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2.5 mb-1">
        <Plug className="h-5 w-5 text-emerald" />
        <h2 className="text-lg font-semibold tracking-tight">Connecter Claude (MCP)</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5 max-w-2xl">
        Génère un token d&apos;accès personnel pour connecter ton app Claude à ton compte Vitals en{" "}
        <span className="text-foreground/80 font-medium">lecture seule</span>. Claude pourra lire tes biomarqueurs,
        ton ADN, tes suppléments, ton score et tes rapports pour mieux te conseiller. Révocable à tout moment.
      </p>

      {/* Create */}
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs uppercase tracking-wider text-muted-foreground/80 font-medium block mb-1.5">
            Nom (optionnel)
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Claude Desktop"
            className="w-full bg-secondary/40 border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition"
          />
        </div>
        <button
          onClick={create}
          disabled={creating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 transition"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Générer un token
        </button>
      </div>
      {err && <div className="mb-4 text-xs text-red-400">{err}</div>}

      {/* Freshly-created plaintext token — shown once */}
      {fresh && (
        <div className="mb-5 rounded-lg border border-emerald/30 bg-emerald/5 p-4">
          <div className="flex items-center gap-2 text-emerald text-xs font-medium mb-2">
            <TriangleAlert className="h-4 w-4" /> Copie ce token maintenant — il ne sera plus jamais affiché.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs break-all bg-background border border-border rounded px-3 py-2">
              {fresh}
            </code>
            <button
              onClick={() => copy(fresh, "token")}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-border hover:bg-secondary/50 text-sm transition"
            >
              {copied === "token" ? <Check className="h-4 w-4 text-emerald" /> : <Copy className="h-4 w-4" />}
              Copier
            </button>
          </div>
        </div>
      )}

      {/* Existing tokens */}
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground/80 font-medium mb-2">
          Tokens actifs
        </div>
        {tokens == null ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : tokens.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aucun token. Génère-en un pour connecter Claude.</div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                <div>
                  <div className="font-medium">{t.name || "Sans nom"}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    créé {fmt(t.createdAt)}
                    {t.lastUsedAt ? ` · utilisé ${fmt(t.lastUsedAt)}` : " · jamais utilisé"}
                  </div>
                </div>
                <button
                  onClick={() => revoke(t.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/40 transition text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Révoquer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Connection instructions */}
      <div className="rounded-lg border border-border bg-secondary/20 p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground/80 font-medium mb-3">
          Connecter Claude Desktop
        </div>
        <ol className="text-sm text-foreground/80 space-y-1.5 mb-3 list-decimal list-inside">
          <li>
            Endpoint : <code className="font-mono text-xs text-emerald bg-emerald/10 px-1.5 py-0.5 rounded">{MCP_URL}</code>
          </li>
          <li>
            Ajoute ce bloc à <code className="font-mono text-xs">claude_desktop_config.json</code> (remplace{" "}
            <code className="font-mono text-xs">&lt;TON_TOKEN&gt;</code>), puis redémarre Claude.
          </li>
        </ol>
        <div className="relative">
          <pre className="font-mono text-[11px] leading-relaxed bg-background border border-border rounded-md p-3 overflow-x-auto">
            {configSnippet}
          </pre>
          <button
            onClick={() => copy(configSnippet, "config")}
            className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-card hover:bg-secondary/50 text-xs transition"
          >
            {copied === "config" ? <Check className="h-3.5 w-3.5 text-emerald" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Sur claude.ai (web), ajoute plutôt un « connecteur personnalisé » pointant vers l&apos;endpoint ci-dessus avec
          le même en-tête d&apos;autorisation.
        </p>
      </div>
    </section>
  );
}
