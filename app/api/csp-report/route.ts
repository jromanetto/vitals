import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

/**
 * Browser sends violation reports here when a Content-Security-Policy-Report-Only
 * directive is violated. We just log to a file for a week before flipping the
 * header from -Report-Only to enforce mode.
 *
 * Public on purpose (browsers can't authenticate). Rate-limit not strictly
 * needed — only browsers post here on real violations, and the volume is
 * naturally bounded by user actions.
 */
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const logDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logDir)) {
      try { fs.mkdirSync(logDir, { recursive: true }); } catch {}
    }
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ua: req.headers.get("user-agent") || null,
      referer: req.headers.get("referer") || null,
      body,
    }) + "\n";
    try {
      fs.appendFileSync(path.join(logDir, "csp-violations.jsonl"), line);
    } catch {}
  } catch {}
  // 204 — no body needed, browser doesn't care about the response
  return new NextResponse(null, { status: 204 });
}
