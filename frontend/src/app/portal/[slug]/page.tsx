import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPortalContext } from "@/lib/getPortalContext";
import PortalClient from "./PortalClient";
import PortalDebug from "./PortalDebug";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const showDebug = process.env.NODE_ENV !== "production";
  const { slug } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const redirectTo = `/portal/${slug}`;
    redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  }

  const context = await getPortalContext(slug);

  if (!context.company) {
    console.error("[Portal] Company non trovata:", { slug });
    return (
      <div className="portal-page portal-page-padded">
        <div className="portal-error">
          <h1>Company non trovata</h1>
          <p>Lo slug &quot;{slug}&quot; non corrisponde a nessuna azienda. Controlla che public_slug sia impostato.</p>
        </div>
        {showDebug ? <PortalDebug slug={slug} /> : null}
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
        {showDebug ? <PortalDebug slug={slug} /> : null}
      </div>
    );
  }

  return (
    <div className="portal-page">
      <PortalClient slug={slug} context={context} />
      {showDebug ? <PortalDebug slug={slug} /> : null}
    </div>
  );
}
