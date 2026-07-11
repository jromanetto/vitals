import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { logAudit } from "@/lib/audit";
import { spawn } from "node:child_process";
import path from "node:path";

export const runtime = "nodejs";

/** Create a placeholder report in Convex owned by the requesting user. Returns
 * its legacyId (the client-facing report id). */
async function insertReport(kind: string, title: string, userId: number): Promise<number> {
  const { id } = await convexServer().mutation(api.reports.insert, {
    secret: bridgeSecret(), authUserId: userId, kind, title, body: "",
    meta: JSON.stringify({ status: "generating" }), status: "generating",
  });
  return id;
}

const KINDS = ["overview", "cardiovascular", "metabolic", "longevity", "nutrition", "cognition", "hormonal", "inflammation", "dna-deep-dive", "next-bloodwork-prep", "supplement-recommendations"] as const;
const TITLES: Record<string, string> = {
  "overview": "Vue d'ensemble santé", "cardiovascular": "Santé cardiovasculaire", "metabolic": "Santé métabolique",
  "longevity": "Longévité", "nutrition": "Nutrition personnalisée", "cognition": "Cognition",
  "hormonal": "Profil hormonal", "inflammation": "Inflammation", "dna-deep-dive": "Analyse ADN approfondie",
  "next-bloodwork-prep": "Préparation prochaine prise de sang", "supplement-recommendations": "Recommandations supplémentation",
};

// Detached worker generates + writes the body back via Convex HTTP (bypasses the
// CF 60s timeout). userId is passed so the worker scopes its Convex reads to the owner.
function startGen(reportId: number, kind: string, userId: number) {
  const cwd = process.cwd();
  const script = path.join(cwd, "scripts", "gen-report.mjs");
  const proc = spawn("node", [script, String(reportId), kind, String(userId)], {
    cwd, detached: true, stdio: ["ignore", "ignore", "ignore"], env: process.env,
  });
  proc.unref();
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { kind = "overview" } = await req.json().catch(() => ({}));
  const validKind = (KINDS as readonly string[]).includes(kind) ? kind : "overview";
  const title = TITLES[validKind];
  const id = await insertReport(validKind, `${title} — génération…`, s.userId);
  startGen(id, validKind, s.userId);
  logAudit("report_create", `id=${id} kind=${validKind}`, req);
  return NextResponse.json({ id, kind: validKind, redirect: `/reports/${id}` });
}

export async function GET(req: Request) {
  const s = await getSession();
  const fwdHost = req.headers.get("x-forwarded-host");
  const baseUrl = fwdHost ? `https://${fwdHost}` : req.url;
  if (!s) return NextResponse.redirect(new URL("/login", baseUrl));
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "overview";
  const validKind = (KINDS as readonly string[]).includes(kind) ? kind : "overview";
  const title = TITLES[validKind];
  const id = await insertReport(validKind, `${title} — génération…`, s.userId);
  startGen(id, validKind, s.userId);
  logAudit("report_create", `id=${id} kind=${validKind}`, req);
  return NextResponse.redirect(new URL(`/reports/${id}`, baseUrl));
}
