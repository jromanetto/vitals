#!/usr/bin/env node
// Write-path smoke: exercises real mutations through the live app (REST route ->
// server bridge -> Convex), then confirms the LIVE reactive query (ctx.auth JWT,
// the exact path the browser uses) sees the change. Cleans up everything it creates.
//   SMOKE_BASE=https://vitals.club CONVEX_URL=<prod> node scripts/smoke-writes.mjs
import fs from "node:fs";
import crypto from "node:crypto";
import { sealData } from "iron-session";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const BASE = process.env.SMOKE_BASE || "http://127.0.0.1:3015";
const auth = JSON.parse(fs.readFileSync("data/auth.json", "utf8"));
const USER = 1;

const tok = await sealData({ userId: USER, email: auth.email, iat: Date.now() }, { password: auth.secret, ttl: 2592000 });
const COOKIE = `vitals_session=${tok}; vitals_active=1`;
const j = (r) => r.json();
const post = (p, body, method = "POST") =>
  fetch(BASE + p, { method, headers: { cookie: COOKIE, "content-type": "application/json" }, body: JSON.stringify(body) });
const del = (p) => fetch(BASE + p, { method: "DELETE", headers: { cookie: COOKIE } });

// Browser-equivalent reactive client (JWT -> ctx.auth), pointed at the same Convex
// deployment the deployed client bundle uses.
const b64 = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const now = Math.floor(Date.now() / 1000);
const h = b64(JSON.stringify({ alg: "RS256", typ: "JWT", kid: auth.convexJwtKid }));
const pl = b64(JSON.stringify({ iss: "https://vitals.club", aud: "vitals", sub: String(USER), iat: now, exp: now + 3600 }));
const jwt = `${h}.${pl}.${b64(crypto.createSign("RSA-SHA256").update(`${h}.${pl}`).sign(auth.convexJwtPrivateKey))}`;
const convex = new ConvexHttpClient(process.env.CONVEX_URL || auth.convexUrl);
convex.setAuth(jwt);

let fail = 0;
const check = (name, cond, detail = "") => {
  if (!cond) fail++;
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(52)} ${detail}`);
};

// --- SUPPLEMENT: create -> live query sees it -> delete -> gone ---
{
  const before = (await convex.query(api.supplements.listLive, {})).rows.length;
  const r = await post("/api/supplements", { name: "__SMOKE_TEST__", dose: "1", unit: "mg" });
  const { id } = await j(r);
  const afterRows = (await convex.query(api.supplements.listLive, {})).rows;
  check("supplement: create -> LIVE reactive query sees it", afterRows.length === before + 1 && afterRows.some((s) => s.name === "__SMOKE_TEST__"), `${before} -> ${afterRows.length}`);
  await del(`/api/supplements?id=${id}`);
  const gone = (await convex.query(api.supplements.listLive, {})).rows;
  check("supplement: delete -> live query updated (cleanup)", gone.length === before, `${afterRows.length} -> ${gone.length}`);
}

// --- SUPPLEMENT LOG (toggle taken today) ---
{
  const r0 = await post("/api/supplements", { name: "__SMOKE_TEST2__" });
  const { id } = await j(r0);
  await post("/api/supplements/log", { supplementId: id, taken: true });
  const taken = (await convex.query(api.supplements.listLive, {})).takenToday;
  check("supplement log: toggle taken -> live takenToday", taken.includes(id), `takenToday=${taken.length}`);
  await post("/api/supplements/log", { supplementId: id, taken: false });
  await del(`/api/supplements?id=${id}`);
}

// --- REMINDER: create -> live -> toggle done -> delete ---
{
  const before = (await convex.query(api.reminders.listLive, {})).rows.length;
  const r = await post("/api/reminders", { title: "__SMOKE_TEST__", dueAt: Date.now() + 86400000, category: "other" });
  const { row } = await j(r);
  const live = (await convex.query(api.reminders.listLive, {})).rows;
  check("reminder: create -> LIVE reactive query sees it", live.length === before + 1, `${before} -> ${live.length}`);
  await post("/api/reminders", { id: row.id, done: true }, "PATCH");
  const done = (await convex.query(api.reminders.listLive, {})).rows.find((x) => x.id === row.id);
  check("reminder: toggle done -> live reflects it", done && done.done === 1, `done=${done?.done}`);
  await del(`/api/reminders?id=${row.id}`);
  const gone = (await convex.query(api.reminders.listLive, {})).rows.length;
  check("reminder: delete -> live query updated (cleanup)", gone === before, `${live.length} -> ${gone}`);
}

// --- NOTE: create -> read back -> delete ---
{
  const r = await post("/api/notes", { targetType: "biomarker", targetId: "ldl", body: "__SMOKE_TEST__" });
  const { id } = await j(r);
  const rows = (await j(await fetch(`${BASE}/api/notes?targetType=biomarker&targetId=ldl`, { headers: { cookie: COOKIE } }))).rows;
  check("note: create -> read back through the app", rows.some((n) => n.body === "__SMOKE_TEST__"), `rows=${rows.length}`);
  await del(`/api/notes?id=${id}`);
  const after = (await j(await fetch(`${BASE}/api/notes?targetType=biomarker&targetId=ldl`, { headers: { cookie: COOKIE } }))).rows;
  check("note: delete (cleanup)", !after.some((n) => n.body === "__SMOKE_TEST__"), `rows=${after.length}`);
}

// --- SYMPTOM: log -> read back -> delete ---
{
  const today = new Date().toISOString().slice(0, 10);
  await post("/api/symptoms", { date: today, key: "energy", value: 7 });
  const rows = (await j(await fetch(`${BASE}/api/symptoms?days=2`, { headers: { cookie: COOKIE } }))).rows;
  const hit = rows.find((s) => s.date === today && s.key === "energy");
  check("symptom: log -> read back through the app", !!hit, `value=${hit?.value}`);
  if (hit) await del(`/api/symptoms?id=${hit.id}`);
}

// --- PROFILE: write -> read back decrypted (encryption round-trip on PROD) ---
{
  const cur = await j(await fetch(`${BASE}/api/profile`, { headers: { cookie: COOKIE } }));
  const orig = cur.data ?? cur;
  const probe = { ...orig, __smokeProbe: "x1" };
  await post("/api/profile", probe.data ? probe.data : probe);
  const back = await j(await fetch(`${BASE}/api/profile`, { headers: { cookie: COOKIE } }));
  const b = back.data ?? back;
  check("profile: write -> read back (decrypts correctly)", b.__smokeProbe === "x1" && (b.firstName === undefined || !String(b.firstName).startsWith("enc:")), `firstName=${String(b.firstName).slice(0, 12)}`);
  // restore original (drop the probe)
  const restored = { ...b };
  delete restored.__smokeProbe;
  await post("/api/profile", restored);
  const final = await j(await fetch(`${BASE}/api/profile`, { headers: { cookie: COOKIE } }));
  const f = final.data ?? final;
  check("profile: probe removed (cleanup)", f.__smokeProbe === undefined, "");
}

console.log(`\n${fail === 0 ? "WRITE PATHS ALL GREEN ✓" : `${fail} FAILURE(S)`}`);
process.exit(fail ? 1 : 0);
