"use client";
import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";

type Props = {
  reportId: number;
  cardIndex: number;
  cardTitle: string;
};

type Status = "idle" | "sending" | "sent" | "error";
type Rating = "up" | "down";

function storageKey(reportId: number, cardIndex: number) {
  return `vitals:card-feedback:${reportId}:${cardIndex}`;
}

export function CardFeedback({ reportId, cardIndex, cardTitle }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [hidden, setHidden] = useState(false);

  // On mount, hide the widget if this card already has a rating in localStorage.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey(reportId, cardIndex));
      if (stored) setHidden(true);
    } catch {}
  }, [reportId, cardIndex]);

  async function send(rating: Rating, withComment?: string) {
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId,
          cardIndex,
          cardTitle,
          rating,
          comment: withComment?.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("bad status");
      setStatus("sent");
      try {
        window.localStorage.setItem(
          storageKey(reportId, cardIndex),
          JSON.stringify({ rating, at: Date.now() }),
        );
      } catch {}
      // Hide the buttons after a brief success flash so the "Merci !" stays
      // visible for a moment before disappearing.
      setTimeout(() => setHidden(true), 1500);
    } catch {
      setStatus("error");
    }
  }

  if (hidden) return null;

  if (status === "sent") {
    return (
      <div className="text-xs text-emerald-500 px-1 py-0.5">Merci !</div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Utile"
          disabled={status === "sending"}
          onClick={() => send("up")}
          className="p-1.5 rounded-md border border-border bg-secondary/40 text-muted-foreground hover:text-emerald-500 hover:border-emerald-500/40 transition disabled:opacity-50"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Pas utile"
          disabled={status === "sending"}
          onClick={() => send("down")}
          className="p-1.5 rounded-md border border-border bg-secondary/40 text-muted-foreground hover:text-rose-500 hover:border-rose-500/40 transition disabled:opacity-50"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          aria-label="Laisser un commentaire"
          disabled={status === "sending"}
          onClick={() => setShowComment((s) => !s)}
          className={`p-1.5 rounded-md border transition disabled:opacity-50 ${
            showComment
              ? "border-primary/40 text-primary bg-primary/10"
              : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
        {status === "error" && (
          <span className="text-xs text-rose-500 ml-2">Erreur</span>
        )}
      </div>
      {showComment && (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Votre commentaire…"
            rows={2}
            className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 focus:outline-none focus:border-primary/40"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={status === "sending" || comment.trim().length === 0}
              onClick={() => send("up", comment)}
              className="text-xs px-2 py-1 rounded-md border border-border bg-primary/15 text-primary hover:bg-primary/25 transition disabled:opacity-50"
            >
              Envoyer
            </button>
            <button
              type="button"
              onClick={() => {
                setShowComment(false);
                setComment("");
              }}
              className="text-xs px-2 py-1 rounded-md border border-border bg-secondary/40 text-muted-foreground hover:text-foreground transition"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CardFeedback;
