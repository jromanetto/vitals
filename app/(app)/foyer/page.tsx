import { currentUserId, getSession } from "@/lib/auth";
import { listHousehold } from "@/lib/household";
import { FoyerManager } from "@/components/foyer-manager";

export const dynamic = "force-dynamic";

export default async function FoyerPage() {
  const session = await getSession();
  const userId = await currentUserId();
  const data = userId ? await listHousehold(userId) : { canView: [], pendingOutgoing: [], pendingIncoming: [] };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80 font-medium">Foyer</div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-2">Profils du foyer</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-xl">
          Relie les comptes de tes proches pour consulter leurs données de santé au même endroit.
          Chacun garde son compte : la personne doit <strong className="text-foreground">approuver</strong> ta
          demande avant que tu puisses voir ses données — et l&apos;accès reste en <strong className="text-foreground">lecture seule</strong>.
        </p>
      </div>
      <FoyerManager initial={data} selfEmail={session?.email ?? ""} />
    </div>
  );
}
