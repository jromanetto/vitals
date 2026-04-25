"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; sources?: { path: string; snippet: string }[] };

export default function ChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send() {
    if (!input.trim() || streaming) return;
    const next: Msg[] = [...msgs, { role: "user" as const, content: input }];
    setMsgs(next); setInput(""); setStreaming(true);
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
    const d = await r.json();
    setMsgs([...next, { role: "assistant", content: d.content ?? "(pas de réponse)", sources: d.sources }]);
    setStreaming(false);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-emerald" />
        <h1 className="text-2xl font-semibold tracking-tight">AI Chat</h1>
        <span className="text-xs text-muted-foreground ml-2">Powered by Claude · contexte = ta knowledge base + profile + biomarkers + DNA</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
        {msgs.length === 0 && (
          <div className="text-muted-foreground text-sm">
            Pose-moi des questions sur ta santé. Exemples :
            <ul className="mt-2 space-y-1 list-disc list-inside text-xs">
              <li>Compare mon LDL entre 2017 et 2025.</li>
              <li>Quels SNPs influencent ma sensibilité à la caféine ?</li>
              <li>Résume mes 3 derniers bilans en 5 lignes.</li>
            </ul>
          </div>
        )}
        <AnimatePresence initial={false}>
          {msgs.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
                    {m.sources.map((s, j) => (
                      <div key={j} className="text-xs text-muted-foreground">📎 {s.path}</div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {streaming && <div className="text-xs text-muted-foreground">Claude réfléchit…</div>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-3 flex gap-2">
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Pose ta question…"
          className="flex-1 bg-secondary/40 border border-border rounded-md px-3 py-2.5 outline-none focus:border-primary transition"
        />
        <button className="px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50" disabled={streaming || !input.trim()}>
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
