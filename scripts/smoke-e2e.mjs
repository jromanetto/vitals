// End-to-end smoke: forge a real iron-session cookie, exercise every migrated
// route + page against the running dev server, report status + a data signal.
import fs from "node:fs";
import { sealData } from "iron-session";

const BASE = "http://127.0.0.1:3015";
const auth = JSON.parse(fs.readFileSync("data/auth.json", "utf8"));
const tok = await sealData(
  { userId: 1, email: "julien@romanetto.com", iat: Date.now() },
  { password: auth.secret, ttl: 60 * 60 * 24 * 30 }
);
const COOKIE = `vitals_session=${tok}; vitals_active=1`;

const API = [
  "/api/health-check",
  "/api/supplements", "/api/supplements/log", "/api/supplements/coverage",
  "/api/supplements/effects", "/api/supplements/suggestions",
  "/api/biomarkers/latest", "/api/biomarkers/series?slugs=ldl,hdl", "/api/biomarkers/compare",
  "/api/notes", "/api/symptoms", "/api/habits", "/api/weekly",
  "/api/reminders", "/api/wearables", "/api/correlations", "/api/timeline",
  "/api/todo", "/api/recommendations", "/api/interactions", "/api/search?q=ldl",
  "/api/sparklines", "/api/nutrition/prefs", "/api/household", "/api/profile",
  "/api/export", "/api/convex-token", "/api/push/subscribe", "/api/memory",
  "/api/chat/sessions", "/api/blood-tests/report",
];
const PAGES = [
  "/dashboard", "/stack", "/biomarkers", "/reports", "/reminders", "/foyer",
  "/timeline", "/correlations", "/notes", "/memory", "/profile", "/import",
];

function signal(j) {
  if (j == null) return "";
  if (Array.isArray(j)) return `[${j.length}]`;
  if (typeof j !== "object") return String(j).slice(0, 20);
  for (const k of ["rows", "hits", "events", "series", "points", "recommendations", "suggestions", "canView", "correlations"]) {
    if (Array.isArray(j[k])) return `${k}=${j[k].length}`;
  }
  if (j.token) return "token ✓";
  if (j.ok !== undefined) return `ok=${j.ok}`;
  const keys = Object.keys(j);
  return keys.length ? `{${keys.slice(0, 3).join(",")}}` : "{}";
}

let fail = 0;
console.log("=== API ROUTES ===");
for (const p of API) {
  try {
    const r = await fetch(BASE + p, { headers: { cookie: COOKIE } });
    let sig = "";
    try { sig = signal(await r.json()); } catch { sig = "(non-json)"; }
    const ok = r.status === 200;
    if (!ok) fail++;
    console.log(`${ok ? "ok  " : "FAIL"} ${String(r.status).padEnd(4)} ${p.padEnd(42)} ${sig}`);
  } catch (e) {
    fail++;
    console.log(`FAIL ERR  ${p.padEnd(42)} ${String(e.message).slice(0, 50)}`);
  }
}

console.log("\n=== PAGES (server-rendered) ===");
for (const p of PAGES) {
  try {
    const r = await fetch(BASE + p, { headers: { cookie: COOKIE }, redirect: "manual" });
    let ok = r.status === 200;
    let hint = "";
    if (ok) {
      const html = await r.text();
      // Real failure markers (not the word "error" inside dev JS bundles).
      const broken = /Application error: a (client|server)-side exception|Internal Server Error|__next_error__|Unhandled Runtime Error/i.test(html);
      const hasShell = /Vitals/.test(html); // sidebar brand => the app shell rendered
      ok = !broken && hasShell;
      hint = broken ? "⚠ Next error page" : hasShell ? `${(html.length / 1024).toFixed(0)}kb, shell ✓` : "⚠ no app shell";
    }
    if (!ok) fail++;
    console.log(`${ok ? "ok  " : "FAIL"} ${String(r.status).padEnd(4)} ${p.padEnd(42)} ${hint}`);
  } catch (e) {
    fail++;
    console.log(`FAIL ERR  ${p.padEnd(42)} ${String(e.message).slice(0, 50)}`);
  }
}
console.log(`\n${fail === 0 ? "ALL GREEN ✓" : `${fail} FAILURE(S)`}`);
