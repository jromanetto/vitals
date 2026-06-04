import { Suspense } from "react";
import { ProfileWizard } from "@/components/profile/wizard";
import { ensureSchema } from "@/lib/db/migrate";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { decryptProfile } from "@/lib/crypto-fields";
import { currentUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getProfile(userId: number) {
  ensureSchema();
  const d = db();
  const rows = await d
    .select()
    .from(schema.profile)
    .where(sql`user_id = ${userId}`)
    .orderBy(sql`${schema.profile.updatedAt} desc`)
    .limit(1);
  return decryptProfile((rows[0]?.data as Record<string, unknown>) ?? {});
}

export default async function ProfilePage() {
  const userId = await currentUserId();
  const initial = userId ? await getProfile(userId) : {};
  return (
    <div className="max-w-5xl">
      <Suspense fallback={null}>
        <ProfileWizard initial={initial} />
      </Suspense>
    </div>
  );
}
