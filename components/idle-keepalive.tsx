"use client";
import { useEffect } from "react";

/**
 * Refreshes the vitals_active cookie (15 min sliding) on user activity.
 * Debounced to one ping per 30s to avoid hammering the server.
 */
export function IdleKeepalive() {
  useEffect(() => {
    let last = 0;
    let pending = false;
    const ping = () => {
      const now = Date.now();
      if (now - last < 30_000) return;
      if (pending) return;
      pending = true;
      last = now;
      fetch("/api/auth/keepalive", { method: "POST", credentials: "same-origin" })
        .catch(() => {})
        .finally(() => { pending = false; });
    };
    const opts: AddEventListenerOptions = { passive: true };
    window.addEventListener("mousemove", ping, opts);
    window.addEventListener("keydown", ping, opts);
    window.addEventListener("scroll", ping, opts);
    window.addEventListener("touchstart", ping, opts);
    window.addEventListener("focus", ping, opts);
    // Initial ping after mount so freshly-loaded tabs stay active.
    ping();
    return () => {
      window.removeEventListener("mousemove", ping);
      window.removeEventListener("keydown", ping);
      window.removeEventListener("scroll", ping);
      window.removeEventListener("touchstart", ping);
      window.removeEventListener("focus", ping);
    };
  }, []);
  return null;
}
