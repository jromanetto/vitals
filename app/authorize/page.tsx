import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/auth";
import { isAllowedRedirect } from "@/lib/oauth/config";
import { OAuthConsent } from "@/components/oauth-consent";
import { VitalsWordmark } from "@/components/brand/logo";
import { Plug } from "lucide-react";

export const dynamic = "force-dynamic";

// OAuth 2.0 authorization endpoint (consent screen). Public in middleware so we
// can preserve the full query when bouncing an unauthenticated user to /login.
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) || "";
  };
  const responseType = get("response_type");
  const clientId = get("client_id");
  const redirectUri = get("redirect_uri");
  const codeChallenge = get("code_challenge");
  const codeChallengeMethod = get("code_challenge_method");
  const state = get("state");

  const invalid =
    responseType !== "code" || !isAllowedRedirect(redirectUri) || !codeChallenge || codeChallengeMethod !== "S256";

  const userId = invalid ? null : await currentUserId();

  // Not logged in → send to login, preserving the entire authorize request so
  // the flow resumes after authentication.
  if (!invalid && !userId) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
    redirect(`/login?from=${encodeURIComponent(`/authorize?${qs.toString()}`)}`);
  }

  return (
    <div className="mkt-ambient min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <VitalsWordmark />
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-2xl">
          {invalid ? (
            <>
              <h1 className="text-xl font-semibold tracking-tight mb-2">Requête invalide</h1>
              <p className="text-sm text-muted-foreground">
                Cette demande d&apos;autorisation est incomplète ou non autorisée (redirection non reconnue, ou PKCE
                manquant). Relance la connexion depuis ton app Claude.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-emerald text-xs font-medium mb-3">
                <Plug className="h-3.5 w-3.5" /> Connexion d&apos;une application
              </div>
              <h1 className="text-xl font-semibold tracking-tight mb-1">Autoriser Claude à lire tes données ?</h1>
              <p className="text-sm text-muted-foreground mb-4">
                Claude pourra consulter tes données Vitals en{" "}
                <span className="text-foreground/80 font-medium">lecture seule</span> pour mieux te conseiller.
              </p>
              <ul className="text-sm text-foreground/80 space-y-2 mb-2 rounded-lg border border-border bg-secondary/20 p-3">
                <li>
                  <span className="text-emerald font-semibold">✓</span> Biomarqueurs, ADN, suppléments, score, rapports,
                  symptômes
                </li>
                <li>
                  <span className="text-emerald font-semibold">✓</span> Aucune écriture, aucune suppression
                </li>
                <li>
                  <span className="text-emerald font-semibold">✓</span> Révocable à tout moment dans Profil → Sécurité
                </li>
              </ul>
              <OAuthConsent
                clientId={clientId}
                redirectUri={redirectUri}
                codeChallenge={codeChallenge}
                codeChallengeMethod={codeChallengeMethod}
                state={state}
              />
              <p className="mt-4 text-[11px] text-muted-foreground font-mono break-all">→ {redirectUri}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
