import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { loadPraticienData } from "@/lib/praticien-data";
import { PraticienReport } from "@/components/praticien-report";
import { PrintButton } from "./print-button";
import { ShareLinkManager } from "@/components/share-link-manager";

export const dynamic = "force-dynamic";

export default async function PraticienPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  const data = await loadPraticienData(userId);

  return (
    <div className="praticien-doc max-w-[800px] mx-auto bg-white text-black print:max-w-none print:mx-0">
      <ShareLinkManager />

      <div className="flex justify-end mb-4 no-print">
        <PrintButton />
      </div>

      <PraticienReport data={data} />

      <footer className="mt-10 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
        Document généré par Vitals — vitals.blueproject.org
      </footer>
    </div>
  );
}
