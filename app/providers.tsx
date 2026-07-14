"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import { useState, useCallback } from "react";

// Browser Convex client, authenticated via the custom JWT minted at
// /api/convex-token (iron-session proves the user). Enables live reactive
// useQuery on the client. Server components keep using the server-bridge.
const convex = process.env.NEXT_PUBLIC_CONVEX_URL
  ? new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL)
  : null;

function useNextAuth() {
  const fetchAccessToken = useCallback(async (_opts: { forceRefreshToken: boolean }) => {
    try {
      const r = await fetch("/api/convex-token", { cache: "no-store" });
      if (!r.ok) return null;
      const { token } = await r.json();
      return (token as string) ?? null;
    } catch {
      return null;
    }
  }, []);
  // The authed app subtree always has a session; on public pages the token fetch
  // returns null and Convex stays unauthenticated (queries just won't resolve).
  return { isLoading: false, isAuthenticated: true, fetchAccessToken };
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      })
  );
  const tree = <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  if (!convex) return tree;
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useNextAuth}>
      {tree}
    </ConvexProviderWithAuth>
  );
}
