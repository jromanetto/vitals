"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Send, Sparkles, Plus, Trash2, MessageSquare, MessagesSquare, FileSearch } from "lucide-react";
import { ChatMarkdown } from "@/components/chat-markdown";
import { ChatThinking } from "@/components/chat-thinking";
import { KnowledgeSearch } from "@/components/knowledge-search";

type Msg = { role: "user" | "assistant"; content: string; sources?: { path: string; snippet?: string }[]; streaming?: boolean; toolCalls?: { name: string; input: unknown }[] };
type Session = { id: number; title: string; created_at: number; updated_at: number };

export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sidebarTab, setSidebarTab] = useState<"conversations" | "docs">("conversations");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => { fetch("/api/chat/sessions").then((r) => r.json()).then((d) => setSessions(d.sessions ?? [])); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function loadSession(id: number) {
    setActiveId(id);
    const r = await fetch(`/api/chat/sessions/${id}/messages`);
    const d = await r.json();
    setMsgs((d.messages ?? []).map((m: { role: "user" | "assistant"; content: string; sources: string | null }) => ({
      role: m.role, content: m.content,
      sources: m.sources ? (() => { try { const j = JSON.parse(m.sources); return Array.isArray(j) ? j.map((p: unknown) => typeof p === "string" ? { path: p } : p) : undefined; } catch { return undefined; } })() : undefined,
    })));
  }
  function newSession() { setActiveId(null); setMsgs([]); }

  async function deleteSession(id: number) {
    await fetch(`/api/chat/sessions?id=${id}`, { method: "DELETE" });
    setSessions((s) => s.filter((x) => x.id !== id));
    if (activeId === id) { setActiveId(null); setMsgs([]); }
  }

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: input };
    const next: Msg[] = [...msgs, userMsg, { role: "assistant", content: "", streaming: true, toolCalls: [] }];
    setMsgs(next); setInput(""); setLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [...msgs, userMsg], sessionId: activeId }),
    });

    if (!res.body) { setLoading(false); return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantContent = "";
    const toolCalls: { name: string; input: unknown }[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "delta") {
              assistantContent += event.text;
              setMsgs((cur) => {
                const arr = [...cur];
                arr[arr.length - 1] = { role: "assistant", content: assistantContent, streaming: true, toolCalls: [...toolCalls] };
                return arr;
              });
            } else if (event.type === "tool") {
              toolCalls.push({ name: event.name, input: event.input });
              setMsgs((cur) => {
                const arr = [...cur];
                arr[arr.length - 1] = { role: "assistant", content: assistantContent, streaming: true, toolCalls: [...toolCalls] };
                return arr;
              });
            } else if (event.type === "done") {
              setMsgs((cur) => {
                const arr = [...cur];
                arr[arr.length - 1] = { role: "assistant", content: assistantContent, sources: event.sources, streaming: false, toolCalls: [...toolCalls] };
                return arr;
              });
              if (event.sessionId && event.sessionId !== activeId) setActiveId(event.sessionId);
              const sr = await fetch("/api/chat/sessions");
              setSessions((await sr.json()).sessions ?? []);
            } else if (event.type === "error") {
              setMsgs((cur) => {
                const arr = [...cur];
                arr[arr.length - 1] = { role: "assistant", content: `Erreur: ${event.message}`, streaming: false };
                return arr;
              });
            }
          } catch {}
        }
      }
    } finally {
      setLoading(false);
    }
  }

  /* auto-ask */

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "docs") setSidebarTab("docs");
  }, [searchParams]);

  useEffect(() => {
    const ask = searchParams.get("ask");
    if (!ask) return;
    setInput(ask);
    // strip the param so it doesn't re-fire on remount
    const t = setTimeout(() => {
      const btn = document.getElementById("chat-send-btn") as HTMLButtonElement | null;
      btn?.click();
      router.replace("/chat");
    }, 60);
    return () => clearTimeout(t);
  }, [searchParams, router]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6 h-[calc(100vh-9rem)]">
      <aside className="rounded-xl border border-border bg-card p-3 flex flex-col min-h-0">
        <div className="flex gap-1 p-1 bg-secondary/30 rounded-md border border-border mb-2">
          <button onClick={() => setSidebarTab("conversations")}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition ${sidebarTab === "conversations" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <MessagesSquare className="h-3 w-3" /> Conversations
          </button>
          <button onClick={() => setSidebarTab("docs")}
            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-medium transition ${sidebarTab === "docs" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <FileSearch className="h-3 w-3" /> Documents
          </button>
        </div>
        {sidebarTab === "conversations" ? (
          <>
            <button onClick={newSession} className="flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-secondary/40 hover:bg-secondary text-sm transition mb-2">
              <Plus className="h-4 w-4" /> Nouvelle conversation
            </button>
            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-0.5">
              {sessions.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Aucune conversation</div>}
              {sessions.map((s) => (
                <div key={s.id} className={`group flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition cursor-pointer ${activeId === s.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/30 hover:text-foreground"}`} onClick={() => loadSession(s.id)}>
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{s.title}</span>
                  <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} className="opacity-0 group-hover:opacity-100 transition p-0.5 hover:text-red-400" aria-label="Supprimer">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
              Recherche directe dans tes documents indexés (rapports, consultations, notes). Pour creuser, demande à l'équipe médicale.
            </div>
            <KnowledgeSearch compact />
          </div>
        )}
      </aside>

      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-emerald" />
          <h1 className="text-2xl font-semibold tracking-tight">Équipe médicale</h1>
          <span className="text-xs text-muted-foreground ml-2">médecin fonctionnel · généticien · nutrithérapeute · endocrinologue</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
          {msgs.length === 0 && (
            <div className="text-muted-foreground text-sm space-y-3">
              Pose une question à ton équipe médicale. Tu peux parler comme à un médecin qui a tout ton dossier sous les yeux. Exemples :
              <ul className="mt-2 space-y-1.5 text-xs">
                {[
                  "Avec mon APOE4 et mon LDL actuel, quelle est ma stratégie cardio sur 5 ans ?",
                  "Mon HRV a baissé ce mois-ci — est-ce corrélé à ma supplémentation magnésium ?",
                  "Compare mes biomarkers thyroïde 2017 vs 2025 et donne-moi un protocole.",
                  "Quels SNPs MTHFR + COMT j'ai, et comment ça change ma supplémentation B9 ?",
                  "Donne-moi un plan longévité sur 12 mois basé sur tout mon dossier.",
                ].map((q) => (
                  <li key={q}><button onClick={() => setInput(q)} className="text-left hover:text-emerald transition">→ {q}</button></li>
                ))}
              </ul>
            </div>
          )}
          <AnimatePresence initial={false}>
            {msgs.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                  {m.role === "assistant" ? (
                    <div className="text-sm">
                      {(m.streaming || (m.toolCalls && m.toolCalls.length > 0)) && (
                        <ChatThinking toolCalls={m.toolCalls ?? []} hasContent={!!m.content} />
                      )}
                      {m.content && <ChatMarkdown text={m.content} />}
                      {m.streaming && m.content && <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-emerald animate-pulse" />}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/60 space-y-1">
                      {m.sources.map((s, j) => (
                        <div key={j} className="text-xs text-muted-foreground">[{j + 1}] {s.path?.split("/").slice(-1)[0] ?? JSON.stringify(s)}</div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-3 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Parle à ton équipe médicale…"
                 className="flex-1 bg-secondary/40 border border-border rounded-md px-3 py-2.5 outline-none focus:border-primary transition" />
          <button id="chat-send-btn" className="px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
