import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export const runtime = "nodejs";

type Hit = { kind: "biomarker" | "dna" | "report" | "doc" | "page" | "note" | "supplement" | "habit" | "action" | "reminder"; title: string; subtitle?: string; href: string };

const PAGES: Hit[] = [
  { kind: "page", title: "Dashboard", href: "/" },
  { kind: "page", title: "Biomarqueurs", subtitle: "tous tes bilans sanguins", href: "/biomarkers" },
  { kind: "page", title: "Comparer bilans", subtitle: "deltas entre 2 panels", href: "/biomarkers/compare" },
  { kind: "page", title: "ADN", subtitle: "variants génétiques par catégorie", href: "/dna" },
  { kind: "page", title: "Plan d'action", subtitle: "sommeil · sport · nutrition", href: "/action-plan" },
  { kind: "page", title: "Vue praticien", subtitle: "résumé imprimable pour ton médecin", href: "/praticien" },
  { kind: "page", title: "Équipe médicale", subtitle: "discuter de tes données", href: "/chat" },
  { kind: "page", title: "Documents", subtitle: "recherche dans tes documents", href: "/chat?tab=docs" },
  { kind: "page", title: "Rapports", href: "/reports" },
  { kind: "page", title: "Timeline", href: "/timeline" },
  { kind: "page", title: "Corrélations", href: "/correlations" },
  { kind: "page", title: "Notes", href: "/notes" },
  { kind: "page", title: "Suppléments", href: "/supplements" },
  { kind: "page", title: "Nutrition", subtitle: "à privilégier · à éviter · par repas", href: "/nutrition" },
  { kind: "page", title: "Bilan semaine", subtitle: "check-in hebdo", href: "/weekly" },
  { kind: "page", title: "Quotidien", subtitle: "historique journalier", href: "/daily" },
  { kind: "page", title: "Symptômes", href: "/symptoms" },
  { kind: "page", title: "Habitudes", href: "/habits" },
  { kind: "page", title: "Rappels", subtitle: "échéances santé", href: "/reminders" },
  { kind: "page", title: "Import", subtitle: "drag-drop tout fichier", href: "/import" },
  { kind: "page", title: "Memory", href: "/memory" },
  { kind: "page", title: "Compte", subtitle: "identifiants, légal", href: "/profile" },
  { kind: "page", title: "Profil santé", subtitle: "questions & antécédents", href: "/data/profile" },
  { kind: "page", title: "Pedigree familial", href: "/data/profile/family" },
  { kind: "page", title: "Import IA (profil)", subtitle: "texte → form", href: "/data/profile/import" },
  { kind: "page", title: "Sécurité", subtitle: "2FA · clé de chiffrement", href: "/profile/security" },
];

const ACTIONS: Hit[] = [
  { kind: "action", title: "+ Nouveau supplément", subtitle: "ajouter à ta stack", href: "/supplements?new=1" },
  { kind: "action", title: "+ Nouveau rappel", subtitle: "prise de sang, cure, RDV", href: "/reminders?new=1" },
  { kind: "action", title: "+ Nouveau symptôme", subtitle: "logger un événement santé", href: "/symptoms?new=1" },
  { kind: "action", title: "↑ Importer un fichier", subtitle: "PDF, ADN, CSV wearable", href: "/import" },
  { kind: "action", title: "💬 Demander à l'équipe médicale", subtitle: "question libre", href: "/chat" },
  { kind: "action", title: "📋 Générer un rapport longévité", subtitle: "synthèse complète", href: "/reports" },
  { kind: "action", title: "🖨 Imprimer ma vue praticien", subtitle: "résumé pour mon médecin", href: "/praticien" },
];

export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  ensureSchema();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();
  if (!q) return NextResponse.json({ hits: [...ACTIONS, ...PAGES] });

  const sqlite = db().$client;
  const hits: Hit[] = [];

  for (const a of ACTIONS) if (a.title.toLowerCase().includes(q) || (a.subtitle ?? "").toLowerCase().includes(q)) hits.push(a);
  for (const p of PAGES) if (p.title.toLowerCase().includes(q) || (p.subtitle ?? "").toLowerCase().includes(q)) hits.push(p);

  // Reminders — scoped per user.
  try {
    const reminders = sqlite.prepare(`SELECT id, title, description, due_at, done FROM reminder WHERE user_id = ? AND (LOWER(title) LIKE ? OR LOWER(COALESCE(description, '')) LIKE ?) ORDER BY done ASC, due_at ASC LIMIT 5`).all(userId, `%${q}%`, `%${q}%`) as Array<{ id: number; title: string; description: string | null; due_at: number; done: number }>;
    for (const r of reminders) {
      const dueStr = new Date(r.due_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
      hits.push({ kind: "reminder", title: r.title, subtitle: `${r.done ? "fait" : "à faire"} · ${dueStr}`, href: "/reminders" });
    }
  } catch {}

  const bms = sqlite.prepare(`SELECT DISTINCT slug, name, category FROM biomarker WHERE user_id = ? AND (LOWER(name) LIKE ? OR LOWER(category) LIKE ?) LIMIT 8`).all(userId, `%${q}%`, `%${q}%`) as Array<{ slug: string; name: string; category: string | null }>;
  for (const b of bms) hits.push({ kind: "biomarker", title: b.name, subtitle: b.category ?? "biomarker", href: `/biomarkers/${b.slug}` });

  const dna = sqlite.prepare(`SELECT DISTINCT rsid, category, trait FROM dna_insight WHERE user_id = ? AND (LOWER(trait) LIKE ? OR LOWER(category) LIKE ? OR LOWER(rsid) LIKE ?) LIMIT 6`).all(userId, `%${q}%`, `%${q}%`, `%${q}%`) as Array<{ rsid: string; category: string; trait: string }>;
  for (const d of dna) hits.push({ kind: "dna", title: d.trait, subtitle: `${d.category} · ${d.rsid}`, href: `/dna/${d.category}` });

  const reports = sqlite.prepare(`SELECT id, title, kind FROM report WHERE user_id = ? AND (LOWER(title) LIKE ? OR LOWER(kind) LIKE ?) ORDER BY created_at DESC LIMIT 5`).all(userId, `%${q}%`, `%${q}%`) as Array<{ id: number; title: string; kind: string }>;
  for (const r of reports) hits.push({ kind: "report", title: r.title, subtitle: r.kind, href: `/reports/${r.id}` });

  const docs = sqlite.prepare(`SELECT id, path, title, category FROM document WHERE user_id = ? AND (LOWER(path) LIKE ? OR LOWER(title) LIKE ?) LIMIT 5`).all(userId, `%${q}%`, `%${q}%`) as Array<{ id: number; path: string; title: string | null; category: string }>;
  for (const d of docs) hits.push({ kind: "doc", title: d.title || d.path.split("/").slice(-1)[0], subtitle: d.category, href: `/files/${d.id}` });

  const notes = sqlite.prepare(`SELECT id, target_type, target_id, body, tags FROM note WHERE user_id = ? AND (LOWER(body) LIKE ? OR LOWER(tags) LIKE ?) ORDER BY created_at DESC LIMIT 5`).all(userId, `%${q}%`, `%${q}%`) as Array<{ id: number; target_type: string; target_id: string; body: string; tags: string | null }>;
  for (const n of notes) {
    const href = n.target_type === "biomarker" ? `/biomarkers/${n.target_id}` : n.target_type === "dna" ? `/dna/${n.target_id.split(":")[0] ?? ""}` : n.target_type === "file" ? `/files/${n.target_id}` : "/notes";
    hits.push({ kind: "note", title: n.body.slice(0, 60), subtitle: `note · ${n.target_type} · ${n.tags ?? ""}`, href });
  }

  const sups = sqlite.prepare(`SELECT id, name FROM supplement WHERE user_id = ? AND LOWER(name) LIKE ? AND ended_at IS NULL LIMIT 5`).all(userId, `%${q}%`) as Array<{ id: number; name: string }>;
  for (const sp of sups) hits.push({ kind: "supplement", title: sp.name, subtitle: "supplément actif", href: "/supplements" });

  return NextResponse.json({ hits });
}
