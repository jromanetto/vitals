import { NextResponse } from "next/server";
import { currentUserId, isDemoUser } from "@/lib/auth";
import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";
import { listHousehold } from "@/lib/household";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/** List my household links: who I can view, requests I'm waiting on, and
 * requests awaiting MY approval (someone asking to view my data). */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await listHousehold(userId));
}

/** Request to view another member's data — creates a pending link they must
 * approve from their own account. The viewer is always the authenticated user. */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(userId)) return NextResponse.json({ error: "Mode démo en lecture seule." }, { status: 403 });

  const body = await req.json().catch(() => ({})) as { email?: string; label?: string; relationship?: string };
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return NextResponse.json({ error: "Email invalide" }, { status: 400 });

  const convex = convexServer();
  const secret = bridgeSecret();
  const { id: targetId } = await convex.query(api.household.findUserByEmail, { secret, email });
  if (targetId == null) return NextResponse.json({ error: "Aucun compte Vitals avec cet email. La personne doit d'abord créer son compte." }, { status: 404 });
  if (targetId === userId) return NextResponse.json({ error: "Tu ne peux pas te lier à toi-même." }, { status: 400 });

  const label = (body.label || "").trim().slice(0, 60) || null;
  const relationship = (body.relationship || "").trim().slice(0, 40) || null;
  const res = await convex.mutation(api.household.request, { secret, viewerId: userId, subjectId: targetId, label, relationship });
  if (!res.ok) {
    return NextResponse.json({ error: "Demande déjà envoyée ou lien déjà actif." }, { status: 409 });
  }
  logAudit("household-request", `viewer=${userId} subject=${targetId}`, req);
  return NextResponse.json({ ok: true });
}
