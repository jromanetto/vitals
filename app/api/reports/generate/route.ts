import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { logAudit } from "@/lib/audit";
import { spawn } from "node:child_process";
import path from "node:path";

export const runtime = "nodejs";

const KINDS = ["overview", "cardiovascular", "metabolic", "longevity", "nutrition", "cognition", "hormonal", "inflammation", "dna-deep-dive", "next-bloodwork-prep", "supplement-recommendations"] as const;
const TITLES: Record<string, string> = {
  "overview": "Vue d'ensemble santé", "cardiovascular": "Santé cardiovasculaire", "metabolic": "Santé métabolique",
  "longevity": "Longévité", "nutrition": "Nutrition personnalisée", "cognition": "Cognition",
  "hormonal": "Profil hormonal", "inflammation": "Inflammation", "dna-deep-dive": "Analyse ADN approfondie",
  "next-bloodwork-prep": "Préparation prochaine prise de sang", "supplement-recommendations": "Recommandations supplémentation",
};

function startGen(reportId: number, kind: string) {
  const cwd = process.cwd();
  const script = path.join(cwd, "scripts", "gen-report.mjs");
  const proc = spawn("node", [script, String(reportId), kind], {
    cwd, detached: true, stdio: ["ignore", "ignore", "ignore"], env: process.env,
  });
  proc.unref();
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const { kind = "overview" } = await req.json().catch(() => ({}));
  const validKind = (KINDS as readonly string[]).includes(kind) ? kind : "overview";
  const title = TITLES[validKind];
  const ins = await db().insert(schema.report).values({ kind: validKind, title: `${title} — génération…`, body: "", meta: { status: "generating" } }).returning({ id: schema.report.id });
  const id = ins[0].id;
  startGen(id, validKind);
  logAudit("report_create", `id=${id} kind=${validKind}`, req);
  return NextResponse.json({ id, kind: validKind, redirect: `/reports/${id}` });
}

export async function GET(req: Request) {
  const s = await getSession();
  const fwdHost = req.headers.get("x-forwarded-host");
  const baseUrl = fwdHost ? `https://${fwdHost}` : req.url;
  if (!s) return NextResponse.redirect(new URL("/login", baseUrl));
  ensureSchema();
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") ?? "overview";
  const validKind = (KINDS as readonly string[]).includes(kind) ? kind : "overview";
  const title = TITLES[validKind];
  const ins = await db().insert(schema.report).values({ kind: validKind, title: `${title} — génération…`, body: "", meta: { status: "generating" } }).returning({ id: schema.report.id });
  const id = ins[0].id;
  startGen(id, validKind);
  logAudit("report_create", `id=${id} kind=${validKind}`, req);
  return NextResponse.redirect(new URL(`/reports/${id}`, baseUrl));
}
