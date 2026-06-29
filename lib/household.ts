import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";

export type HouseholdMember = { id: number; otherId: number; label: string; email: string; relationship: string | null; status: string; created_at: number };
export type IncomingRequest = { id: number; otherId: number; email: string; relationship: string | null; created_at: number };

/** All household links for a user: members they can view, requests they sent
 * awaiting approval, and requests awaiting THEIR approval (consent inbox). */
export function listHousehold(userId: number): { canView: HouseholdMember[]; pendingOutgoing: HouseholdMember[]; pendingIncoming: IncomingRequest[] } {
  ensureSchema();
  const sqlite = db().$client;

  const outgoing = sqlite.prepare(`
    SELECT h.id, h.subject_user_id AS otherId, COALESCE(h.label, u.email) AS label,
           u.email AS email, h.relationship, h.status, h.created_at
    FROM household_link h JOIN user u ON u.id = h.subject_user_id
    WHERE h.viewer_user_id = ? ORDER BY label
  `).all(userId) as HouseholdMember[];

  const pendingIncoming = sqlite.prepare(`
    SELECT h.id, h.viewer_user_id AS otherId, u.email AS email, h.relationship, h.created_at
    FROM household_link h JOIN user u ON u.id = h.viewer_user_id
    WHERE h.subject_user_id = ? AND h.status = 'pending' ORDER BY h.created_at DESC
  `).all(userId) as IncomingRequest[];

  return {
    canView: outgoing.filter((o) => o.status === "active"),
    pendingOutgoing: outgoing.filter((o) => o.status === "pending"),
    pendingIncoming,
  };
}
