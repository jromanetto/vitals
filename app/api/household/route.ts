import { NextResponse } from "next/server";
import { currentUserId, isDemoUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { listHousehold } from "@/lib/household";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/** List my household links: who I can view, requests I'm waiting on, and
 * requests awaiting MY approval (someone asking to view my data). */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(listHousehold(userId));
}

/** Request to view another member's data — creates a pending link they must
 * approve from their own account. The viewer is always the authenticated user. */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule." }, { status: 403 });
  ensureSchema();

  const body = await req.json().catch(() => ({})) as { email?: string; label?: string; relationship?: string };
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Email invalide" }, { status: 400 });

  const sqlite = db().$client;
  const target = sqlite.prepare(`SELECT id FROM user WHERE LOWER(email) = ?`).get(email) as { id: number } | undefined;
  if (!target) return NextResponse.json({ error: "Aucun compte Vitals avec cet email. La personne doit d'abord créer son compte." }, { status: 404 });
  if (target.id === userId) return NextResponse.json({ error: "Tu ne peux pas te lier à toi-même." }, { status: 400 });

  const existing = sqlite.prepare(`SELECT id, status FROM household_link WHERE viewer_user_id = ? AND subject_user_id = ?`).get(userId, target.id) as { id: number; status: string } | undefined;
  if (existing) {
    const msg = existing.status === "active" ? "Tu peux déjà voir ce profil." : "Demande déjà envoyée, en attente d'approbation.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const label = (body.label || "").trim().slice(0, 60) || null;
  const relationship = (body.relationship || "").trim().slice(0, 40) || null;
  sqlite.prepare(`INSERT INTO household_link (viewer_user_id, subject_user_id, label, relationship, status) VALUES (?, ?, ?, ?, 'pending')`)
    .run(userId, target.id, label, relationship);
  logAudit("household-request", `viewer=${userId} subject=${target.id}`, req);
  return NextResponse.json({ ok: true });
}
