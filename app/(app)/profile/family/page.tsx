import { db } from "@/lib/db";
import { ensureSchema } from "@/lib/db/migrate";
import { sql } from "drizzle-orm";
import { schema } from "@/lib/db";
import { PedigreeEditor } from "@/components/pedigree-editor";
import { decryptProfile } from "@/lib/crypto-fields";
import { PageHeader } from "@/components/page-header";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

async function getProfile() {
  ensureSchema();
  const d = db();
  const rows = await d.select().from(schema.profile).orderBy(sql`${schema.profile.updatedAt} desc`).limit(1);
  return decryptProfile((rows[0]?.data as Record<string, unknown>) ?? {});
}

export default async function FamilyPage() {
  const profile = await getProfile();
  const pedigree = (profile.pedigree as Record<string, unknown>) ?? {};
  return (
    <div className="space-y-12">
      <PageHeader
        title="Pedigree familial"
        description="Histoire de santé sur 3 générations. Plus c'est rempli, mieux les risques héréditaires sont détectés."
        icon={<Users className="h-5 w-5 text-emerald" />}
      />
      <PedigreeEditor initial={pedigree} />
    </div>
  );
}
