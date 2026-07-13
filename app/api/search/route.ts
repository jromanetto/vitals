import { NextResponse } from "next/server";
import { currentUserId, effectiveUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

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
  const userId = await effectiveUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const authId = (await currentUserId()) ?? userId;
  ensureSchema();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").toLowerCase().trim();
  if (!q) return NextResponse.json({ hits: [...ACTIONS, ...PAGES] });

  const sqlite = db().$client;
  const hits: Hit[] = [];

  for (const a of ACTIONS) if (a.title.toLowerCase().includes(q) || (a.subtitle ?? "").toLowerCase().includes(q)) hits.push(a);
  for (const p of PAGES) if (p.title.toLowerCase().includes(q) || (p.subtitle ?? "").toLowerCase().includes(q)) hits.push(p);

  // Reminders — owner-scoped, via Convex.
  try {
    const rem = await convexServer().query(api.reminders.list, { secret: bridgeSecret(), authUserId: userId });
    const reminders = (rem.rows as Array<{ id: number; title: string; description: string | null; dueAt: number; done: number }>)
      .filter((r) => r.title.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q))
      .sort((a, b) => (a.done - b.done) || (a.dueAt - b.dueAt))
      .slice(0, 5);
    for (const r of reminders) {
      const dueStr = new Date(r.dueAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
      hits.push({ kind: "reminder", title: r.title, subtitle: `${r.done ? "fait" : "à faire"} · ${dueStr}`, href: "/reminders" });
    }
  } catch {}

  // Biomarkers via Convex (read scoped to auth user + active Foyer view). `q` is
  // already lowercased; replicate DISTINCT slug + (name|category) LIKE + LIMIT 8.
  const { rows: bmRows } = await convexServer().query(api.biomarkers.all, {
    secret: bridgeSecret(), authUserId: authId, viewUserId: userId,
  });
  const seenBm = new Set<string>();
  for (const b of bmRows) {
    if (seenBm.size >= 8) break;
    if (seenBm.has(b.slug)) continue;
    if (!((b.name ?? "").toLowerCase().includes(q) || (b.category ?? "").toLowerCase().includes(q))) continue;
    seenBm.add(b.slug);
    hits.push({ kind: "biomarker", title: b.name, subtitle: b.category ?? "biomarker", href: `/biomarkers/${b.slug}` });
  }

  // DNA insights via Convex. Replicate DISTINCT (rsid,category,trait) +
  // (trait|category|rsid) LIKE + LIMIT 6.
  const { rows: dnaRows } = await convexServer().query(api.dna.insights, {
    secret: bridgeSecret(), authUserId: authId, viewUserId: userId,
  });
  const seenDna = new Set<string>();
  for (const dn of dnaRows) {
    if (seenDna.size >= 6) break;
    const key = `${dn.rsid}|${dn.category}|${dn.trait}`;
    if (seenDna.has(key)) continue;
    if (!((dn.trait ?? "").toLowerCase().includes(q) || (dn.category ?? "").toLowerCase().includes(q) || (dn.rsid ?? "").toLowerCase().includes(q))) continue;
    seenDna.add(key);
    hits.push({ kind: "dna", title: dn.trait, subtitle: `${dn.category} · ${dn.rsid}`, href: `/dna/${dn.category}` });
  }

  // Reports via Convex (read scoped to auth user + active Foyer view). `q` is
  // already lowercased; replicate the LOWER(...) LIKE match + created_at DESC LIMIT 5.
  const { rows: reportRows } = await convexServer().query(api.reports.list, {
    secret: bridgeSecret(), authUserId: authId, viewUserId: userId,
  });
  const reports = reportRows
    .filter((r) => r.title.toLowerCase().includes(q) || r.kind.toLowerCase().includes(q))
    .slice(0, 5);
  for (const r of reports) hits.push({ kind: "report", title: r.title, subtitle: r.kind, href: `/reports/${r.id}` });

  const docs = sqlite.prepare(`SELECT id, path, title, category FROM document WHERE user_id = ? AND (LOWER(path) LIKE ? OR LOWER(title) LIKE ?) LIMIT 5`).all(userId, `%${q}%`, `%${q}%`) as Array<{ id: number; path: string; title: string | null; category: string }>;
  for (const d of docs) hits.push({ kind: "doc", title: d.title || d.path.split("/").slice(-1)[0], subtitle: d.category, href: `/files/${d.id}` });

  const { rows: noteRows } = await convexServer().query(api.notes.list, { secret: bridgeSecret(), authUserId: authId, viewUserId: userId });
  const notes = (noteRows as Array<{ targetType: string; targetId: string; body: string; tags: string | null }>)
    .filter((n) => n.body.toLowerCase().includes(q) || (n.tags ?? "").toLowerCase().includes(q))
    .slice(0, 5)
    .map((n) => ({ target_type: n.targetType, target_id: n.targetId, body: n.body, tags: n.tags }));
  for (const n of notes) {
    const href = n.target_type === "biomarker" ? `/biomarkers/${n.target_id}` : n.target_type === "dna" ? `/dna/${n.target_id.split(":")[0] ?? ""}` : n.target_type === "file" ? `/files/${n.target_id}` : "/notes";
    hits.push({ kind: "note", title: n.body.slice(0, 60), subtitle: `note · ${n.target_type} · ${n.tags ?? ""}`, href });
  }

  const { rows: supRows } = await convexServer().query(api.supplements.list, { secret: bridgeSecret(), authUserId: authId, viewUserId: userId });
  const sups = (supRows as Array<{ id: number; name: string; endedAt: number | null }>)
    .filter((s) => s.endedAt == null && (s.name ?? "").toLowerCase().includes(q))
    .slice(0, 5);
  for (const sp of sups) hits.push({ kind: "supplement", title: sp.name, subtitle: "supplément actif", href: "/supplements" });

  return NextResponse.json({ hits });
}
