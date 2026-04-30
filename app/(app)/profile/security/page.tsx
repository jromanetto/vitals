import { SecurityPanel } from "@/components/security-panel";
import { PushPanel } from "@/components/push-panel";
import { hasTotpEnabled } from "@/lib/auth";
import { isAnonymizeEnabled } from "@/lib/anonymize";
import { listAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const totp = hasTotpEnabled();
  const anonymize = isAnonymizeEnabled();
  const events = listAudit(50);
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sécurité</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          2FA, anonymisation LLM, notifications push, et journal d'audit. Toutes les protections sont locales et chiffrées.
        </p>
      </div>
      <PushPanel />
      <SecurityPanel totpEnabled={totp} anonymizeEnabled={anonymize} events={events} />
    </div>
  );
}
