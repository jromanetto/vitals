import { ProfileForm } from "@/components/profile-form";
import { AutoExtractButton } from "@/components/auto-extract-button";
import { ensureSchema } from "@/lib/db/migrate";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { decryptProfile } from "@/lib/crypto-fields";

export const dynamic = "force-dynamic";

async function getProfile() {
  ensureSchema();
  const d = db();
  const rows = await d.select().from(schema.profile).orderBy(sql`${schema.profile.updatedAt} desc`).limit(1);
  return decryptProfile((rows[0]?.data as Record<string, unknown>) ?? {});
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
      <div className="flex flex-wrap gap-2 mb-2">
        <a href="/profile/family" className="text-xs px-3 py-1.5 rounded-md bg-emerald/10 border border-emerald/30 text-emerald hover:bg-emerald/20 transition">Pedigree familial →</a>
        <AutoExtractButton />
      </div>
      <ProfileForm initial={initial} />
    </div>
  );
}
