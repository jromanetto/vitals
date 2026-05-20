"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sparkles, Send } from "lucide-react";

const SUGGESTIONS = [
  "Que peux-tu me dire sur mon dernier bilan ?",
  "Quels suppléments dois-je ajuster ?",
  "Comment optimiser mon sommeil cette semaine ?",
  "Mon score longévité, comment l'améliorer ?",
];

export function HomeChatBar() {
  const router = useRouter();
  const [input, setInput] = useState("");

  function submit(text: string) {
    const q = text.trim();
    if (!q) return;
    router.push(`/chat?ask=${encodeURIComponent(q)}`);
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-8"
    >
      <div className="absolute inset-0 gradient-emerald pointer-events-none opacity-60" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-emerald" />
          <span className="text-[11px] uppercase tracking-[0.18em] text-emerald font-medium">
            Équipe médicale
          </span>
          <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">
            médecin fonctionnel · généticien · nutrithérapeute
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
          className="relative"
        >
          <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-emerald/40 via-sky-400/30 to-purple-400/30 opacity-50 blur-sm pointer-events-none" />
          <div className="relative flex items-center gap-2 bg-background border border-border rounded-xl px-4 py-3 focus-within:border-emerald transition">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pose une question à ton équipe médicale…"
              className="flex-1 bg-transparent text-sm md:text-base outline-none placeholder:text-muted-foreground"
              aria-label="Question pour l'équipe médicale"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition"
              aria-label="Envoyer la question"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => submit(q)}
              className="text-[11px] md:text-xs px-2.5 py-1 rounded-full bg-secondary/40 hover:bg-secondary border border-border hover:border-emerald/40 text-muted-foreground hover:text-foreground transition"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
