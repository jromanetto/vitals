import { convexServer, bridgeSecret } from "@/lib/convex-server";
import { api } from "@/convex/_generated/api";

export type HouseholdMember = { id: number; otherId: number; label: string; email: string; relationship: string | null; status: string; created_at: number };
export type IncomingRequest = { id: number; otherId: number; email: string; relationship: string | null; created_at: number };

/** All household links for a user: members they can view, requests they sent
 * awaiting approval, and requests awaiting THEIR approval (consent inbox).
 * Reads from Convex — the source of truth for view-as (resolveReadUser). */
export async function listHousehold(userId: number): Promise<{ canView: HouseholdMember[]; pendingOutgoing: HouseholdMember[]; pendingIncoming: IncomingRequest[] }> {
  const res = await convexServer().query(api.household.list, { secret: bridgeSecret(), userId });
  return {
    canView: res.canView as HouseholdMember[],
    pendingOutgoing: res.pendingOutgoing as HouseholdMember[],
    pendingIncoming: res.pendingIncoming as IncomingRequest[],
  };
}
