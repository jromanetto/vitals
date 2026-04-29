"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowUp, X, Send } from "lucide-react";

const SUGGESTIONS = [
  "Que peux-tu me dire sur mon dernier bilan sanguin ?",
  "Quels sont mes points forts génétiques ?",
  "Comment optimiser mon sommeil cette semaine ?",
  "Mes suppléments sont-ils bien dosés ?",
  "Quel est mon score longévité ?",
];

export function FloatingChat() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  // Hide on the chat page itself
  useEffect(() => {
    if (pathname?.startsWith("/chat")) setOpen(false);
  }, [pathname]);

  if (pathname?.startsWith("/chat")) return null;

  function submit(text: string) {
    const q = text.trim();
    if (!q) return;
    setOpen(false);
    setInput("");
    router.push(`/chat?ask=${encodeURIComponent(q)}`);
  }

  return (
    <>
      {/* Bottom floating bar (idle state) */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.25 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-40 group hidden md:flex"
            aria-label="Ouvrir le chat"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald via-sky-400 to-purple-400 opacity-60 blur-md group-hover:opacity-90 transition" />
              <div className="relative h-14 w-14 rounded-full bg-card border border-border flex items-center justify-center shadow-xl">
                <Sparkles className="h-5 w-5 text-emerald" />
              </div>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,640px)]"
            >
              <div className="relative rounded-2xl border border-border bg-card shadow-2xl p-4 space-y-3">
                <button
                  onClick={() => setOpen(false)}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-2 pr-8">
                  <Sparkles className="h-4 w-4 text-emerald" />
                  <h3 className="text-sm font-semibold">Panel médical</h3>
                  <span className="text-[11px] text-muted-foreground">médecin fonctionnel · généticien · nutrithérapeute</span>
                </div>

                <p className="text-[11px] text-muted-foreground italic">
                  Le panel a accès à tes biomarqueurs, ADN, suppléments et wearables. Pose ta question librement.
                </p>

                <div className="space-y-1.5">
                  {SUGGESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => submit(q)}
                      className="w-full text-left text-xs px-3 py-2 rounded-md bg-secondary/40 hover:bg-secondary/70 border border-border hover:border-emerald/40 transition flex items-center gap-2"
                    >
                      <ArrowUp className="h-3 w-3 text-emerald rotate-45 shrink-0" />
                      <span className="truncate">{q}</span>
                    </button>
                  ))}
                </div>

                <form onSubmit={(e) => { e.preventDefault(); submit(input); }}
                      className="relative">
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald/40 via-sky-400/40 to-purple-400/40 opacity-50 blur-sm" />
                  <div className="relative flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2.5 focus-within:border-emerald transition">
                    <input
                      autoFocus
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Pose ta question…"
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition"
                      aria-label="Envoyer"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
