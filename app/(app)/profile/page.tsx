import { ProfileForm } from "@/components/profile-form";
import { ensureSchema } from "@/lib/db/migrate";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function getProfile() {
  ensureSchema();
  const d = db();
  const rows = await d.select().from(schema.profile).orderBy(sql`${schema.profile.updatedAt} desc`).limit(1);
  return (rows[0]?.data as Record<string, unknown>) ?? {};
}

export default async function ProfilePage() {
  const initial = await getProfile();
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Plus tu remplis, plus les analyses et corrélations seront pertinentes. Toutes les infos restent privées et locales.
        </p>
      </div>
      <ProfileForm initial={initial} />
    </div>
  );
}
