import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

type Hit = { kind: "biomarker" | "dna" | "report" | "doc" | "page" | "note" | "supplement" | "habit"; title: string; subtitle?: string; href: string };

const PAGES: Hit[] = [
  { kind: "page", title: "Dashboard", href: "/" },
  { kind: "page", title: "Biomarkers", href: "/biomarkers" },
  { kind: "page", title: "DNA Analysis", href: "/dna" },
  { kind: "page", title: "Reports", href: "/reports" },
  { kind: "page", title: "Timeline", href: "/timeline" },
  { kind: "page", title: "Knowledge", href: "/knowledge" },
  { kind: "page", title: "Corrélations", href: "/correlations" },
  { kind: "page", title: "Notes", href: "/notes" },
  { kind: "page", title: "AI Chat", href: "/chat" },
  { kind: "page", title: "Suppléments", href: "/supplements" },
  { kind: "page", title: "Symptômes", href: "/symptoms" },
  { kind: "page", title: "Habitudes", href: "/habits" },
  { kind: "page", title: "Import wearables", href: "/import" },
  { kind: "page", title: "Profile", href: "/profile" },
  { kind: "page", title: "Pedigree familial", href: "/profile/family" },
];

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();
  if (!q) return NextResponse.json({ hits: PAGES });

  const sqlite = db().$client;
  const hits: Hit[] = [];

  for (const p of PAGES) if (p.title.toLowerCase().includes(q)) hits.push(p);

  const bms = sqlite.prepare(`SELECT DISTINCT slug, name, category FROM biomarker WHERE LOWER(name) LIKE ? OR LOWER(category) LIKE ? LIMIT 8`).all(`%${q}%`, `%${q}%`) as Array<{ slug: string; name: string; category: string | null }>;
  for (const b of bms) hits.push({ kind: "biomarker", title: b.name, subtitle: b.category ?? "biomarker", href: `/biomarkers/${b.slug}` });

  const dna = sqlite.prepare(`SELECT DISTINCT rsid, category, trait FROM dna_insight WHERE LOWER(trait) LIKE ? OR LOWER(category) LIKE ? OR LOWER(rsid) LIKE ? LIMIT 6`).all(`%${q}%`, `%${q}%`, `%${q}%`) as Array<{ rsid: string; category: string; trait: string }>;
  for (const d of dna) hits.push({ kind: "dna", title: d.trait, subtitle: `${d.category} · ${d.rsid}`, href: `/dna/${d.category}` });

  const reports = sqlite.prepare(`SELECT id, title, kind FROM report WHERE LOWER(title) LIKE ? OR LOWER(kind) LIKE ? ORDER BY created_at DESC LIMIT 5`).all(`%${q}%`, `%${q}%`) as Array<{ id: number; title: string; kind: string }>;
  for (const r of reports) hits.push({ kind: "report", title: r.title, subtitle: r.kind, href: `/reports/${r.id}` });

  const docs = sqlite.prepare(`SELECT id, path, title, category FROM document WHERE LOWER(path) LIKE ? OR LOWER(title) LIKE ? LIMIT 5`).all(`%${q}%`, `%${q}%`) as Array<{ id: number; path: string; title: string | null; category: string }>;
  for (const d of docs) hits.push({ kind: "doc", title: d.title || d.path.split("/").slice(-1)[0], subtitle: d.category, href: `/files/${d.id}` });

  const notes = sqlite.prepare(`SELECT id, target_type, target_id, body, tags FROM note WHERE LOWER(body) LIKE ? OR LOWER(tags) LIKE ? ORDER BY created_at DESC LIMIT 5`).all(`%${q}%`, `%${q}%`) as Array<{ id: number; target_type: string; target_id: string; body: string; tags: string | null }>;
  for (const n of notes) {
    const href = n.target_type === "biomarker" ? `/biomarkers/${n.target_id}` : n.target_type === "dna" ? `/dna/${n.target_id.split(":")[0] ?? ""}` : n.target_type === "file" ? `/files/${n.target_id}` : "/notes";
    hits.push({ kind: "note", title: n.body.slice(0, 60), subtitle: `note · ${n.target_type} · ${n.tags ?? ""}`, href });
  }

  const sups = sqlite.prepare(`SELECT id, name FROM supplement WHERE LOWER(name) LIKE ? AND ended_at IS NULL LIMIT 5`).all(`%${q}%`) as Array<{ id: number; name: string }>;
  for (const sp of sups) hits.push({ kind: "supplement", title: sp.name, subtitle: "supplément actif", href: "/supplements" });

  return NextResponse.json({ hits });
}
