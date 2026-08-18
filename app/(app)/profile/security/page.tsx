import { SecurityPanel } from "@/components/security-panel";
import { PushPanel } from "@/components/push-panel";
import { McpTokenPanel } from "@/components/mcp-token-panel";
import { hasTotpEnabled } from "@/lib/auth";
import { isAnonymizeEnabled } from "@/lib/anonymize";
import { listAudit } from "@/lib/audit";
import { PageHeader } from "@/components/page-header";
import { Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const totp = hasTotpEnabled();
  const anonymize = isAnonymizeEnabled();
  const events = await listAudit(50);
  return (
    <div className="space-y-12">
      <PageHeader
        title="Sécurité"
        description="2FA, anonymisation LLM, notifications push, et journal d'audit. Toutes les protections sont locales et chiffrées."
        icon={<Lock className="h-5 w-5 text-emerald" />}
      />
      <PushPanel />
      <McpTokenPanel />
      <SecurityPanel totpEnabled={totp} anonymizeEnabled={anonymize} events={events} />
    </div>
  );
}
