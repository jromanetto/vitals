import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { TodoClient } from "@/components/todo/todo-client";
import { PageHeader } from "@/components/page-header";
import { CheckSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TodoPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/login");
  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        title="À faire"
        description="Examens à programmer, devices à considérer, spécialistes à voir, compléments manquants. Mis à jour en continu à partir de tes données."
        icon={<CheckSquare className="h-5 w-5 text-emerald" />}
      />
      <TodoClient />
    </div>
  );
}
