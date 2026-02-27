import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPortalContext, type PortalContext } from "@/lib/getPortalContext";
import PortalClient from "./PortalClient";
import styles from "./portal.module.css";

type PortalSignFlowState = "signed" | "closed" | "open";

function getSignFlowState(context: PortalContext): PortalSignFlowState {
  if (context.signer?.status === "signed") {
    return "signed";
  }

  if (context.is_round_closed) {
    return "closed";
  }

  return "open";
}

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ debug?: string }>;
}) {
  const { slug } = await params;
  const { debug: debugParam } = await searchParams;
  const isDebugMode = debugParam === "1";

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (isDebugMode) {
      const result = await getPortalContext(slug, { debug: true });
      if (result && typeof result === "object" && "ok" in result && !result.ok) {
        return (
          <div className="portal-page portal-page-padded">
            <pre className={styles.debugPreFull}>{JSON.stringify(result.debug, null, 2)}</pre>
          </div>
        );
      }
    }
    const redirectTo = `/portal/${slug}${isDebugMode ? "?debug=1" : ""}`;
    redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  }

  const result = await getPortalContext(slug, { debug: isDebugMode });

  if (isDebugMode && result && typeof result === "object" && "ok" in result) {
    if (!result.ok) {
      return (
        <div className="portal-page portal-page-padded">
          <pre className={styles.debugPreFull}>{JSON.stringify(result.debug, null, 2)}</pre>
        </div>
      );
    }
    if (result.ok && result.ctx) {
      const signFlowState = getSignFlowState(result.ctx);
      const phase = (result.ctx.company?.phase ?? result.ctx.phase ?? "").toLowerCase();
      const isIssuancePhase = phase === "issuance" || phase === "issuing";
      const lifecycle = (result.ctx.investor_account?.lifecycle_stage ?? result.ctx.lifecycle_stage ?? "").toLowerCase();
      const canFinalizeInvestment =
        isIssuancePhase && (lifecycle === "loi_signed" || lifecycle === "investing" || lifecycle === "invested");
      return (
        <div className="portal-page">
          {canFinalizeInvestment && (
            <div className={styles.authGate}>
              <Link href={`/investor/issuance/${slug}`} className={styles.ctaPrimary}>
                Finalizza investimento
              </Link>
            </div>
          )}
          <PortalClient slug={slug} context={result.ctx} signFlowState={signFlowState} />
        </div>
      );
    }
  }

  const context = (typeof result === "object" && result && "ok" in result && result.ok ? result.ctx : result) as PortalContext;
  const signFlowState = getSignFlowState(context);
  const phase = (context.company?.phase ?? context.phase ?? "").toLowerCase();
  const isIssuancePhase = phase === "issuance" || phase === "issuing";
  const lifecycle = (context.investor_account?.lifecycle_stage ?? context.lifecycle_stage ?? "").toLowerCase();
  const canFinalizeInvestment =
    isIssuancePhase && (lifecycle === "loi_signed" || lifecycle === "investing" || lifecycle === "invested");

  if (!context?.company) {
    console.error("[Portal] Company non trovata:", { slug });
    return (
      <div className="portal-page portal-page-padded">
        <div className="portal-error">
          <h1>Company non trovata</h1>
          <p>Lo slug &quot;{slug}&quot; non corrisponde a nessuna azienda. Controlla che public_slug sia impostato.</p>
        </div>
      </div>
    );
  }

  if (!context.investor_id || !context.investor_account) {
    return (
      <div className="portal-page portal-page-padded">
        <div className="portal-error">
          <h1>{context.company.name}</h1>
          <p>Non autorizzato. Invito necessario.</p>
          <p className="portal-error-hint">
            Per accedere al portal devi ricevere un invito dalla società. Contatta {context.company.name} per ottenere l&apos;accesso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-page">
      {canFinalizeInvestment && (
        <div className={styles.authGate}>
          <Link href={`/investor/issuance/${slug}`} className={styles.ctaPrimary}>
            Finalizza investimento
          </Link>
        </div>
      )}
      <PortalClient slug={slug} context={context} signFlowState={signFlowState} />
    </div>
  );
}
