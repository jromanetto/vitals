// Proof query for the browser->Convex JWT bridge: returns the authenticated
// user's id from ctx.auth (the custom JWT `sub`). Used to verify reactivity auth.
import { query } from "./_generated/server";

export const whoami = query({
  args: {},
  handler: async (ctx) => {
    const id = await ctx.auth.getUserIdentity();
    return { userId: id ? Number(id.subject) : null, subject: id?.subject ?? null, issuer: id?.issuer ?? null };
  },
});
