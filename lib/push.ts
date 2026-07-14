// @ts-ignore -- web-push has no types
import webpush from "web-push";
import fs from "node:fs";
import path from "node:path";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

let configured = false;

type AuthFile = {
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  vapidSubject?: string;
};

function readAuth(): AuthFile {
  const p = process.env.VITALS_CREDS_PATH || path.join(process.cwd(), "data", "auth.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function getVapidPublicKey(): string | null {
  try {
    return readAuth().vapidPublicKey ?? null;
  } catch {
    return null;
  }
}

function configure() {
  if (configured) return;
  const auth = readAuth();
  if (!auth.vapidPublicKey || !auth.vapidPrivateKey) {
    throw new Error("VAPID keys missing in data/auth.json");
  }
  webpush.setVapidDetails(
    auth.vapidSubject || "mailto:contact@vitals.blueproject.org",
    auth.vapidPublicKey,
    auth.vapidPrivateKey
  );
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  badge?: string;
};

export async function sendToUser(userId: number, payload: PushPayload) {
  configure();
  const convex = convexServer();
  const secret = bridgeSecret();
  const { rows: subs } = await convex.query(api.push.subsForSend, { secret, userId });

  const data = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data
        );
        await convex.mutation(api.push.touchLastUsed, { secret, id: s.id });
      } catch (e: any) {
        // 410 Gone / 404 Not Found = expired endpoint, prune it
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          await convex.mutation(api.push.deleteById, { secret, id: s.id });
        }
        throw e;
      }
    })
  );
  const sent = results.filter((r) => r.status === "fulfilled").length;
  return { sent, total: subs.length };
}
