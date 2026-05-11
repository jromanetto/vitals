import { Suspense } from "react";
import { ProfileWizard } from "@/components/profile/wizard";
import { ensureSchema } from "@/lib/db/migrate";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { decryptProfile } from "@/lib/crypto-fields";

export const dynamic = "force-dynamic";

async function getProfile() {
  ensureSchema();
  const d = db();
  const rows = await d
    .select()
    .from(schema.profile)
    .orderBy(sql`${schema.profile.updatedAt} desc`)
    .limit(1);
  return decryptProfile((rows[0]?.data as Record<string, unknown>) ?? {});
}

export default async function ProfilePage() {
  const initial = await getProfile();
  return (
    <div className="max-w-5xl">
      <Suspense fallback={null}>
        <ProfileWizard initial={initial} />
      </Suspense>
    </div>
  );
}
