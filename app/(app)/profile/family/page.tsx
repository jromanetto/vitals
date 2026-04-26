import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { sql } from "drizzle-orm";
import { schema } from "@/lib/db";
import { PedigreeEditor } from "@/components/pedigree-editor";

export const dynamic = "force-dynamic";

async function getProfile() {
  ensureSchema();
  const d = db();
  const rows = await d.select().from(schema.profile).orderBy(sql`${schema.profile.updatedAt} desc`).limit(1);
  return (rows[0]?.data as Record<string, unknown>) ?? {};
}

export default async function FamilyPage() {
  const profile = await getProfile();
  const pedigree = (profile.pedigree as Record<string, unknown>) ?? {};
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pedigree familial</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Histoire de santé sur 3 générations. Plus c'est rempli, mieux les risques héréditaires sont détectés.
        </p>
      </div>
      <PedigreeEditor initial={pedigree} />
    </div>
  );
}
