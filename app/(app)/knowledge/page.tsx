export const dynamic = "force-dynamic";
import { KnowledgeSearch } from "@/components/knowledge-search";

export default function KnowledgePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge base</h1>
        <p className="text-muted-foreground mt-1 text-sm">Recherche dans tous tes rapports, consultations, notes et fichiers indexés.</p>
      </div>
      <KnowledgeSearch />
    </div>
  );
}
