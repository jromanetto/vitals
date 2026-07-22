// Waitlist — where signups land once the private beta hits its capacity cap.
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireServer } from "./lib/auth";

export const add = mutation({
  args: { secret: v.string(), email: v.string() },
  handler: async (ctx, { secret, email }) => {
    requireServer(secret);
    const lower = email.toLowerCase();
    // Idempotent, matching the previous INSERT OR IGNORE: signing up twice must
    // not create a duplicate entry.
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", lower))
      .first();
    if (existing) return { added: false };
    await ctx.db.insert("waitlist", { email: lower, createdAt: Date.now() });
    return { added: true };
  },
});
